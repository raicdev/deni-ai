import {
  modelDescriptions,
  reasoningEffortType,
} from "@/lib/modelDescriptions";
import { memo, useState } from "react";
import { ModelSelector } from "./ModelSelector";
import { ReasoningEffortSelector } from "./ReasoningEffortSelector";
import { Button } from "@workspace/ui/components/button";
import { Settings, GitFork, MenuIcon } from "lucide-react"; // Added GitFork
import { EasyTip } from "@/components/easytip";
import { useSettingsDialog } from "@/context/SettingsDialogContext";
import { useTranslations } from "next-intl";
import { useIsMobile } from "@workspace/ui/hooks/use-mobile";
import { cn } from "@workspace/ui/lib/utils";
import ShareButton from "./ShareButton";
import { CreateBranchModal } from "./CreateBranchModal"; // Assuming this path
import { ChatSession } from "@/hooks/use-chat-sessions";
import { User } from "@supabase/supabase-js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { useSettings } from "@/hooks/use-settings";

interface HeaderAreaProps {
  model: string;
  stop?: () => void;
  generating?: boolean;
  handleModelChange: (model: string) => void;
  reasoningEffort?: reasoningEffortType;
  handleReasoningEffortChange?: (effort: reasoningEffortType) => void;
  currentSession?: ChatSession;
  user: User;
  messages: any[];
}

const HeaderArea: React.FC<HeaderAreaProps> = memo(
  ({
    model,
    stop,
    generating,
    handleModelChange,
    reasoningEffort,
    handleReasoningEffortChange,
    currentSession,
    user,
    messages,
  }) => {
    const isMobile = useIsMobile();
    const t = useTranslations();
    const { openDialog } = useSettingsDialog();
    const { settings } = useSettings();
    const [createBranchModalOpen, setCreateBranchModalOpen] = useState(false);

    return (
      <div
        className={cn(
          "shadow-xl bg-secondary/70 rounded-full flex items-center justify-between mx-auto",
          isMobile ? "p-1 px-2 gap-0.5" : "p-2 w-fit",
        )}
      >
        <div
          className={cn("flex items-center", isMobile ? "gap-0.5" : "gap-1")}
        >
          <ModelSelector
            handleModelChange={handleModelChange}
            model={model}
            modelDescriptions={modelDescriptions}
          />
          {reasoningEffort &&
            handleReasoningEffortChange &&
            modelDescriptions[model]?.reasoning && (
              <ReasoningEffortSelector
                model={model}
                reasoningEffort={reasoningEffort}
                handleReasoningEffortChange={handleReasoningEffortChange}
                availableEfforts={modelDescriptions[model]?.reasoningEffort}
              />
            )}
          <EasyTip content={t("settings.title")}>
            <Button
              className={cn("rounded-full", isMobile && "px-2 py-1")}
              variant={"secondary"}
              onClick={() => openDialog()}
            >
              <Settings size={isMobile ? 18 : 24} />
              {!isMobile && t("settings.title")}
            </Button>
          </EasyTip>
          {currentSession && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  className={cn("rounded-full", isMobile && "px-2 py-1")}
                  variant={"secondary"}
                >
                  <MenuIcon size={isMobile ? 18 : 24} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem>
                  <ShareButton
                    currentSession={currentSession}
                    user={user}
                    messages={messages}
                  />
                </DropdownMenuItem>
                {settings.branch && (
                  <DropdownMenuItem
                    onClick={() => setCreateBranchModalOpen(true)}
                  >
                    <GitFork />
                    {t("header.createBranch")}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        {currentSession && (
          <CreateBranchModal
            open={createBranchModalOpen}
            onOpenChange={setCreateBranchModalOpen}
            currentSession={currentSession}
          />
        )}{" "}
        {/* Modal rendered here */}
      </div>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.model === nextProps.model &&
      prevProps.reasoningEffort === nextProps.reasoningEffort &&
      prevProps.handleModelChange === nextProps.handleModelChange
    );
  },
);
HeaderArea.displayName = "HeaderArea";

export default HeaderArea;
