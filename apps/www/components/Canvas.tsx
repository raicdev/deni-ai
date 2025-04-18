"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Paintbrush, Download, Copy, X, Save } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { ScrollArea } from "@workspace/ui/components/scroll-area";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { Pre } from "@/components/markdown";
import { motion, AnimatePresence } from "framer-motion";
import { useCanvas } from "@/context/CanvasContext";
import { cn } from "@workspace/ui/lib/utils";
import { useIsMobile } from "@workspace/ui/hooks/use-mobile";
interface CanvasProps {
  content: string;
  title: string;
  sessionId: string;
  onClose: () => void;
  canUpdate?: boolean;
  onUpdateCanvas?: (sessionId: string, data: { content: string; title: string }) => void;
}

export const Canvas: React.FC<CanvasProps> = React.memo(({
  content,
  title = "Untitled Document",
  sessionId,
  onClose,
  canUpdate = true,
  onUpdateCanvas,
}) => {
  const t = useTranslations();
  const { getCanvasData, updateCanvas } = useCanvas();
  const [editMode, setEditMode] = useState(false);
  const [editableContent, setEditableContent] = useState(content);
  const [isVisible, setIsVisible] = useState(true);
  const [canvasTitle, setCanvasTitle] = useState(title);
  const isMobile = useIsMobile();

  // セッションIDに対応するキャンバスデータをメモ化して取得
  // const canvasData = useMemo(() => getCanvasData(sessionId), [getCanvasData, sessionId]);

  // コンポーネントマウント時またはpropsやcanvasDataが変更されたときだけ内容を更新
  useEffect(() => {
    // コンポーネント内の状態を初期化
    setEditableContent(content);
    setCanvasTitle(title);
    // コンポーネントがマウントされたら表示状態にする
    setIsVisible(true);
  }, [content, title]);

  // Save changes to context with sessionId
  const saveChanges = useCallback(() => {
    if (canUpdate) {
      const updatedData = {
        content: editableContent,
        title: canvasTitle,
      };
      
      // 親から渡された更新関数があればそちらを使う
      if (onUpdateCanvas) {
        onUpdateCanvas(sessionId, updatedData);
      } else {
        // なければデフォルトのcontextの関数を使う
        updateCanvas(sessionId, updatedData);
      }
      
      toast.success(t("canvas.saved") || "Canvas saved successfully");
    }
  }, [canUpdate, editableContent, canvasTitle, sessionId, onUpdateCanvas, updateCanvas, t]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(editableContent);
    toast.success(t("canvas.copied") || "Content copied to clipboard");
  }, [editableContent, t]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([editableContent], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${canvasTitle.replace(/\s+/g, "-").toLowerCase()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [editableContent, canvasTitle]);

  const toggleEditMode = useCallback(() => {
    setEditMode(!editMode);
  }, [editMode]);

  const handleClose = useCallback(() => {
    setIsVisible(false);
    setTimeout(() => {
      onClose();
    }, 300);
  }, [onClose]);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  }, [handleClose]);

  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setCanvasTitle(e.target.value);
  }, []);

  const handleContentChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditableContent(e.target.value);
  }, []);

  return (
    <AnimatePresence mode="wait">
      {isVisible && (
        <motion.div
          className="fixed inset-0 z-50 flex justify-end bg-black/40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={handleBackdropClick}
        >
          <motion.div
            className="w-full max-w-2xl h-full bg-background shadow-lg flex flex-col"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
          >
            <div className={cn("flex items-center p-3 border-b justify-between", isMobile && "flex-col")}>
              <div className={cn("flex items-center gap-2 flex-1", isMobile && "w-full")}>
                <Paintbrush size={18} className="text-primary" />
                {editMode ? (
                  <input
                    type="text"
                    value={canvasTitle}
                    onChange={handleTitleChange}
                    className="font-medium text-lg bg-transparent border-b border-primary focus:outline-none"
                  />
                ) : (
                  <span className="font-medium text-lg">{canvasTitle}</span>
                )}
              </div>
              <div className={cn("flex items-center gap-2", isMobile && "mt-2 w-full")}>
                {canUpdate && editMode && (
                  <Button variant="default" size="sm" onClick={saveChanges}>
                    <Save size={16} className="mr-1" />
                    {t("canvas.save") || "Save"}
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={handleCopy}>
                  <Copy size={16} />
                </Button>
                <Button variant="ghost" size="sm" onClick={handleDownload}>
                  <Download size={16} />
                </Button>
                <Button variant="ghost" size="sm" onClick={toggleEditMode}>
                  {editMode
                    ? t("canvas.view") || "View"
                    : t("canvas.edit") || "Edit"}
                </Button>
                <Button variant="ghost" size="sm" onClick={handleClose}>
                  <X size={16} />
                </Button>
              </div>
            </div>

            <ScrollArea className="flex-1 p-4 overflow-y-scroll">
              {editMode ? (
                <textarea
                  className="w-full h-full min-h-[300px] p-3 font-mono text-sm bg-secondary/20 border rounded resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                  value={editableContent}
                  onChange={handleContentChange}
                />
              ) : (
                <div className="prose dark:prose-invert max-w-none">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{ pre: Pre }}
                  >
                    {editableContent}
                  </ReactMarkdown>
                </div>
              )}
            </ScrollArea>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

Canvas.displayName = "Canvas";

export default Canvas;
