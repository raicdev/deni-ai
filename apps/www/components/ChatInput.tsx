"use client";

import React, { useState, useEffect, useRef, useCallback, memo } from "react";
import { useTranslations } from "next-intl";
import { modelDescriptions } from "@/lib/modelDescriptions";
import InputBox from "./InputBox";
import { ImagePreview } from "./ImagePreview";
import { ImageAddButton } from "./ImageAddButton";
import { SearchButton } from "./SearchButton";
import { DeepResearchButton, ResearchDepth } from "./DeepResearchButton";
import CanvasButton from "./CanvasButton";
import { useIsMobile } from "@workspace/ui/hooks/use-mobile";
import { cn } from "@workspace/ui/lib/utils";
import { Bot } from "@/types/bot";
import { AlertCircle, Loader2 } from "lucide-react";
import { Badge } from "@workspace/ui/components/badge";

type ModelDescription =
  (typeof modelDescriptions)[keyof typeof modelDescriptions];

interface ChatInputProps {
  input: string;
  image: string | null;
  model: string;
  isUploading: boolean;
  stop: () => void;
  generating: boolean;
  searchEnabled: boolean;
  deepResearch: boolean;
  researchDepth?: ResearchDepth;
  canvasEnabled: boolean;
  className?: string;
  bot?: Bot;
  sendButtonRef?: React.RefObject<HTMLButtonElement | null>;
  modelDescriptions: Record<string, ModelDescription>;
  intellipulse?: boolean;
  modelUsage?: {
    canUse: boolean;
    remaining: number;
    isPremium: boolean;
    displayName: string;
  } | null;
  usageLoading?: boolean;
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  deepResearchToggle: () => void;
  onResearchDepthChange?: (depth: ResearchDepth) => void;
  canvasToggle: () => void;
  handleSendMessage: (e: React.MouseEvent<HTMLButtonElement>) => void;
  handleSendMessageKey: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  handleImagePaste: (e: React.ClipboardEvent<HTMLDivElement>) => void;
  searchToggle: () => void;
  handleImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  setImage: (image: string | null) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  messages?: any[];
}

const ChatInput = memo(
  ({
    input,
    image,
    model,
    stop,
    generating,
    isUploading,
    searchEnabled,
    sendButtonRef,
    deepResearch,
    researchDepth,
    canvasEnabled,
    className,
    bot,
    deepResearchToggle,
    onResearchDepthChange,
    canvasToggle,
    searchToggle,
    modelDescriptions,
    modelUsage,
    usageLoading,
    handleInputChange,
    handleSendMessage,
    handleSendMessageKey,
    handleImagePaste,
    handleImageUpload,
    setImage,
    fileInputRef,
    intellipulse,
    messages = [],
  }: ChatInputProps) => {
    const t = useTranslations();
    const isMobile = useIsMobile();
    const isBot = !!bot;

    // Calculate disabled state and warnings
    const isDisabled = !!(modelUsage && !modelUsage.canUse);
    const showWarning = !!(modelUsage && modelUsage.isPremium && modelUsage.remaining <= 10 && modelUsage.remaining > 0);
    const showLimitReached = !!(modelUsage && !modelUsage.canUse);

    // Callback for ImageAddButton click
    const handleImageAddClick = useCallback(() => {
      fileInputRef.current?.click();
    }, []); // fileInputRef is stable

    return (
      <div className={cn("mt-4 border rounded-xl w-full p-2", className)}>
        <ImagePreview
          image={image}
          isUploading={isUploading}
          setImage={setImage}
        />
        
        {/* Usage Warning/Limit Messages */}
        {usageLoading && (
          <div className="flex items-center gap-2 p-3 mb-2 bg-muted/50 rounded-lg">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm text-muted-foreground">
              {t("settings.usage.loading")}
            </span>
          </div>
        )}
        
        {showLimitReached && (
          <div className="flex items-center gap-2 p-3 mb-2 bg-destructive/10 border border-destructive/20 rounded-lg">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <div className="flex-1">
              <p className="text-sm font-medium text-destructive">
                {t("chat.error.usageLimitReached", { model: modelUsage?.displayName })}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("chat.error.tryDifferentModel")}
              </p>
            </div>
          </div>
        )}
        
        {showWarning && !showLimitReached && (
          <div className="flex items-center gap-2 p-3 mb-2 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg">
            <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            <div className="flex-1">
              <p className="text-sm font-medium text-orange-800 dark:text-orange-200">
                {t("chat.error.usageLimitSoon")}
              </p>
              <p className="text-xs text-orange-600 dark:text-orange-400">
                {t("chat.error.usageLimitWarning", { 
                  remaining: modelUsage?.remaining,
                  model: modelUsage?.displayName 
                })}
              </p>
            </div>
            {modelUsage?.isPremium && (
              <Badge variant="secondary" className="text-xs">
                {t("settings.usage.premium")}
              </Badge>
            )}
          </div>
        )}
        
        <InputBox
          input={input}
          stop={stop}
          generating={generating}
          disabled={isDisabled}
          sendButtonRef={sendButtonRef}
          handleInputChange={handleInputChange}
          handleSendMessage={handleSendMessage}
          handleSendMessageKey={handleSendMessageKey}
          handleImagePaste={handleImagePaste}
          messages={messages}
          maxContextWindow={modelDescriptions[model]?.maxContextWindow}
        />
        <div className={cn("flex items-center", "gap-1 md:gap-2")}>
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleImageUpload}
            className="hidden"
          />
          <ImageAddButton
            modelSupportsVision={!!modelDescriptions[model]?.vision}
            onClick={handleImageAddClick}
          />
          <CanvasButton
            disabled={modelDescriptions[model]?.toolDisabled || isBot || false}
            canvasEnabled={canvasEnabled}
            intellipulse={intellipulse}
            canvasToggle={canvasToggle}
          />
          <SearchButton
            disabled={modelDescriptions[model]?.toolDisabled || isBot || false}
            searchEnabled={searchEnabled}
            searchToggle={searchToggle}
          />
          {researchDepth && onResearchDepthChange && (
            <DeepResearchButton
              disabled={
                modelDescriptions[model]?.toolDisabled ||
                isBot ||
                !searchEnabled ||
                false
              }
              intellipulse={intellipulse}
              deepResearch={deepResearch}
              researchDepth={researchDepth}
              deepResearchToggle={deepResearchToggle}
              onResearchDepthChange={onResearchDepthChange}
            />
          )}
        </div>
        {!isMobile && bot && (
          <span className="text-muted-foreground text-xs">
            {t("chatInput.botNotice", { botName: bot.name })}
          </span>
        )}
      </div>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.input === nextProps.input &&
      prevProps.image === nextProps.image &&
      prevProps.searchEnabled === nextProps.searchEnabled &&
      prevProps.deepResearch === nextProps.deepResearch &&
      prevProps.researchDepth === nextProps.researchDepth &&
      prevProps.isUploading === nextProps.isUploading &&
      prevProps.model === nextProps.model &&
      prevProps.canvasEnabled === nextProps.canvasEnabled &&
      prevProps.generating === nextProps.generating &&
      prevProps.usageLoading === nextProps.usageLoading &&
      prevProps.messages?.length === nextProps.messages?.length &&
      JSON.stringify(prevProps.modelDescriptions) ===
        JSON.stringify(nextProps.modelDescriptions) &&
      JSON.stringify(prevProps.modelUsage) ===
        JSON.stringify(nextProps.modelUsage)
    );
  },
);

ChatInput.displayName = "ChatInput";

export default ChatInput;
