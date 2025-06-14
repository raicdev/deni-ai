import {
  modelDescriptions,
  reasoningEffortType,
  reasoningEffortValues,
} from "@/lib/modelDescriptions";
import { getSystemPrompt } from "@/lib/systemPrompt";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createXai } from "@ai-sdk/xai";
import {
  createGoogleGenerativeAI,
  GoogleGenerativeAIProviderOptions,
} from "@ai-sdk/google";
import {
  createOpenRouter,
  OpenRouterProviderOptions,
} from "@openrouter/ai-sdk-provider";
import { createGroq } from "@ai-sdk/groq";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  appendResponseMessages,
  convertToCoreMessages,
  createDataStream,
  extractReasoningMiddleware,
  generateId,
  smoothStream,
  streamText,
  Tool,
  UIMessage,
  wrapLanguageModel,
} from "ai";
import { NextResponse } from "next/server";
import { getTools } from "@/lib/utils";
import { RowServerBot } from "@/types/bot";
import {
  loadStreams,
  appendStreamId,
  saveChat,
  getMessagesByChatId,
} from "@/utils/chat-store";
import { after } from "next/server";
import { createResumableStreamContext } from "resumable-stream";
import { generateTitleFromUserMessage } from "@/lib/actions";
import z from "zod";

const chatPostRequestSchema = z.object({
  messages: z.array(z.any()),
  model: z.string(),
  reasoningEffort: reasoningEffortValues,
  toolList: z.array(z.string()),
  sessionId: z.string(),
  // Optional fields
  botId: z.string().optional().nullable(),
  language: z.string().optional().nullable().default("en"),
});

// Only enable resumable streams when Redis is available
const isRedisAvailable = !!process.env.REDIS_URL;
const streamContext = isRedisAvailable
  ? createResumableStreamContext({
      waitUntil: after,
    })
  : null;

export async function GET(request: Request) {
  // Only handle resumable streams if Redis is available
  if (!isRedisAvailable || !streamContext) {
    return new Response("Resumable streams not available", { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const chatId = searchParams.get("chatId");

  if (!chatId) {
    return new Response("id is required", { status: 400 });
  }

  const streamIds = await loadStreams(chatId);

  if (!streamIds.length) {
    return new Response("No streams found", { status: 404 });
  }

  const recentStreamId = streamIds.at(-1);

  if (!recentStreamId) {
    return new Response("No recent stream found", { status: 404 });
  }

  const emptyDataStream = createDataStream({
    execute: () => {},
  });

  const stream = await streamContext.resumableStream(
    recentStreamId,
    () => emptyDataStream,
  );

  if (stream) {
    return new Response(stream, { status: 200 });
  }

  /*
   * For when the generation is "active" during SSR but the
   * resumable stream has concluded after reaching this point.
   */

  const messages = await getMessagesByChatId({ id: chatId });
  const mostRecentMessage = messages.at(-1);

  if (!mostRecentMessage || mostRecentMessage.role !== "assistant") {
    return new Response(emptyDataStream, { status: 200 });
  }

  const messageCreatedAt = new Date(mostRecentMessage.createdAt);

  const streamWithMessage = createDataStream({
    execute: (buffer) => {
      buffer.writeData({
        type: "append-message",
        message: JSON.stringify(mostRecentMessage),
      });
    },
  });

  return new Response(streamWithMessage, { status: 200 });
}

export async function POST(req: Request) {
  try {
    const authorization = req.headers.get("Authorization");

    // Gracefully handle non-JSON Content-Types
    let requestBody: any;
    const contentType = req.headers.get("Content-Type") || "";
    try {
      if (contentType.includes("application/json")) {
        requestBody = await req.json();
      } else {
        const rawText = await req.text();
        requestBody = JSON.parse(rawText);
      }
    } catch (parseError) {
      console.error("Body parse error:", parseError);
      return new NextResponse("Invalid JSON in request body", { status: 400 });
    }

    const validationResult = chatPostRequestSchema.safeParse(requestBody);

    if (!validationResult.success) {
      console.error("Validation failed:", validationResult.error);
      return new NextResponse("Invalid request data", { status: 400 });
    }
    let {
      messages,
      model,
      reasoningEffort = "medium",
      botId,
      toolList,
      language = "en",
      sessionId,
    } = validationResult.data;

    // Validate required fields
    if (messages.length === 0) {
      return new NextResponse("Invalid request", { status: 400 });
    } // Supabase authentication - Support both authenticated and anonymous users
    const supabase = await createSupabaseServerClient();
    let userId: string | undefined = undefined;
    let isAnonymous = true;

    if (authorization) {
      try {
        // Extract token from Bearer format
        const token = authorization.replace("Bearer ", "");
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser(token);
        if (error || !user) {
          // Allow anonymous users to proceed without authentication
          console.log("Authentication failed, proceeding as anonymous user");
        } else {
          userId = user.id;
          isAnonymous = false;
        }
      } catch (error) {
        // Allow anonymous users to proceed without authentication
        console.log(
          "Authentication error, proceeding as anonymous user:",
          error,
        );
      }
    }

    // Check usage limits for authenticated users
    if (!isAnonymous && userId) {
      const { canUseModel } = await import("@/lib/usage");
      const canUse = await canUseModel(userId, model);

      if (!canUse) {
        return new NextResponse("Usage limit exceeded for this model", {
          status: 429,
        });
      }
    }

    let bot: RowServerBot | null = null;
    if (botId) {
      console.log("Bot ID provided:", botId);
      const { data: botData, error } = await supabase
        .from("bots")
        .select("*")
        .eq("id", botId)
        .single();

      console.log("Fetched bot data:", botData);

      if (error || !botData) {
        return new NextResponse("Bot not found", { status: 404 });
      }
      bot = botData as RowServerBot;
      bot.id = botId;
    }

    const modelDescription = modelDescriptions[model];
    const isReasoning = model.endsWith("-reasoning");

    model = model.replace("-reasoning", "");

    // const isCanary = modelDescription?.canary;

    // // Voids Provider (not used)
    // const VoidsOpenAI = createVoidsOAI({
    //   // custom settings, e.g.
    //   isCanary,
    //   apiKey: "no", // API key
    // });

    // const VoidsAnthropic = createVoidsAP({
    //   isCanary,
    //   apiKey: "no",
    // });

    // Official Provider
    const openai = createOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const anthropic = createAnthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const google = createGoogleGenerativeAI({
      apiKey: process.env.GOOGLE_API_KEY,
    });

    const openrouter = createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY,
    });

    const groq = createGroq({
      apiKey: process.env.GROQ_API_KEY,
    });

    const xai = createXai({
      apiKey: process.env.XAI_API_KEY,
    });

    const coreMessage = convertToCoreMessages(messages);
    // const coreMessage = messages as CoreMessage[]; // temporary fix for the new API

    if (modelDescription?.toolDisabled) {
      toolList = ["tooldisabled"];
    }

    coreMessage.unshift({
      role: "system",
      content: getSystemPrompt(toolList || [], bot),
    });

    const startTime = Date.now();
    let firstChunk = false;

    function errorHandler(error: unknown) {
      if (process.env.NODE_ENV === "development") {
        const errorStack = [
          "API Error at " + new Date().toISOString(),
          "Model: " + model,
          "Error: " + error,
        ].join("\n");

        console.error(errorStack);

        if (error == null) {
          return "unknown error";
        }

        if (typeof error === "string") {
          return error;
        }

        if (error instanceof Error) {
          return error.message;
        }

        return JSON.stringify(error);
      } else {
        // hide error details in production
        return "An error occurred while processing your request. Please try again later.";
      }
    }

    let selectedModel;
    const modelProvider = model.split("/")[0];
    const modelName = model.substring(model.indexOf("/") + 1);

    // switch (modelDescription?.type) {
    //   case "Claude":
    //     selectedModel = anthropic(model);
    //     break;
    //   default:
    //     if (modelDescription?.officialAPI) {
    //       selectedModel = officialOpenAI(model);
    //     } else {
    //       selectedModel = openai(model);
    //     }
    //     break;
    // }

    switch (modelProvider) {
      case "openai":
        selectedModel = openai(modelName, {
          structuredOutputs: false,
        });
        break;
      case "anthropic":
        selectedModel = anthropic(modelName);
        break;
      case "google":
        selectedModel = google(modelName);
        break;
      case "openrouter":
        selectedModel = openrouter(modelName);
        break;
      case "groq":
        selectedModel = groq(modelName);
        break;
      case "xai":
        selectedModel = xai(modelName);
        break;
      default:
        selectedModel = openai(modelName);
        break;
    }
    const newModel = wrapLanguageModel({
      model: selectedModel,
      middleware: extractReasoningMiddleware({ tagName: "think" }),
    }); // Generate a fresh streamId for resumable streams only if Redis is available
    const streamId = isRedisAvailable ? generateId() : null;

    // Record this new stream so we can resume later (only if Redis is available)
    if (sessionId && isRedisAvailable && streamId) {
      try {
        await appendStreamId({ chatId: sessionId, streamId });
      } catch (error) {
        console.error("Failed to record stream ID:", error);
        // Continue without recording - not critical for stream execution
      }
    } // Build the data stream that will emit tokens

    await saveChat({
      id: sessionId || crypto.randomUUID(),
      messages: coreMessage,
    });

    const lastMsg = messages[messages.length - 1];
    if (lastMsg) {
      // Check for existing session title
      const { data: existingSession } = await supabase
        .from("chat_sessions")
        .select("title")
        .eq("id", sessionId)
        .eq("user_id", userId)
        .single();

      if (existingSession?.title != "New Chat" || !existingSession?.title) {
        const title = await generateTitleFromUserMessage({ message: lastMsg });

        const { error: updateError } = await supabase
          .from("chat_sessions")
          .update({
            title: title,
            updated_at: new Date().toISOString(),
          })
          .eq("id", sessionId)
          .eq("user_id", userId);

        if (updateError) {
          console.error("Error updating session title:", updateError);
          return "Failed to update title";
        }
      }
    }

    const stream = createDataStream({
      execute: (dataStream) => {
        try {
          let tools: { [key: string]: Tool } | undefined = {};
          if (modelDescription?.toolDisabled) {
            tools = undefined;
          } else {
            tools = getTools(
              dataStream,
              toolList,
              sessionId,
              userId,
              modelDescription,
              language || "en",
            );
          }

          dataStream.writeMessageAnnotation({
            model,
          });

          const result = streamText({
            model:
              modelDescription?.type == "ChatGPT"
                ? openai.responses(modelName)
                : newModel,
            messages: coreMessage,
            tools: tools,
            maxSteps: 50,
            experimental_transform: smoothStream({
              chunking: /[\u3040-\u309F\u30A0-\u30FF]|\S+\s+/,
            }),
            temperature: 1,

            providerOptions: {
              ...(modelDescription?.reasoning && {
                openai: {
                  reasoningEffort: reasoningEffort,
                  reasoningSummary: "detailed",
                },
              }),
              google: {
                thinkingConfig: {
                  thinkingBudget: 8192,
                },
              } as GoogleGenerativeAIProviderOptions,
              openrouter: {
                reasoning: { effort: "medium" },
              } as OpenRouterProviderOptions,
              ...(isReasoning && {
                anthropic: {
                  thinking: { type: "enabled", budgetTokens: 8192 },
                },
              }),
            },
            onFinish: async ({ response }) => {
              const endTime = Date.now();
              const duration = endTime - startTime;

              dataStream.writeMessageAnnotation({
                generationTime: duration,
              });

              await saveChat({
                id: sessionId || crypto.randomUUID(),
                messages: appendResponseMessages({
                  messages,
                  responseMessages: response.messages,
                }),
              });

              // Record usage for authenticated users
              if (!isAnonymous && userId) {
                try {
                  const { recordUsage } = await import("@/lib/usage");
                  await recordUsage(userId, model);
                } catch (usageError) {
                  console.error("Failed to record usage:", usageError);
                  // Don't fail the entire request if usage recording fails
                }
              }
            },
          });

          result.mergeIntoDataStream(dataStream, {
            sendReasoning: true,
          });
        } catch (streamError) {
          console.error("Error in stream execution:", streamError);
          // Handle error by writing error message to stream
          const errorMessage = errorHandler(streamError);
          dataStream.writeData({
            type: "error",
            content: errorMessage,
          });
        }
      },
      onError: errorHandler,
    }); // Return a resumable stream to the client if Redis is available, otherwise return regular stream
    if (isRedisAvailable && streamContext && streamId) {
      console.log("Using resumable stream with ID:", streamId);
      return new Response(
        await streamContext.resumableStream(streamId, () => stream),
      );
    } else {
      // Fallback to regular stream when Redis is not available
      return new Response(stream);
    }
  } catch (error) {
    console.error(error);
    return new NextResponse(error as string, { status: 500 });
  }
}
