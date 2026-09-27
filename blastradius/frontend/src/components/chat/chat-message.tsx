"use client"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { FlowCard } from "./flow-card"
import { ReasoningSteps } from "./reasoning-steps"
import type { Message } from "@/store/chat-store"

interface ChatMessageProps {
  message: Message
  activeFlowId: string | null
  onFlowClick: (flowId: string) => void
  isStreaming?: boolean
}

export function ChatMessage({
  message,
  activeFlowId,
  onFlowClick,
  isStreaming,
}: ChatMessageProps) {
  const isUser = message.role === "user"

  return (
    <div className={cn(
      "w-full",
      isUser ? "flex flex-col items-end" : "flex flex-col items-start",
    )}>
      <div className={cn(
        "rounded-2xl py-2 text-sm",
        isUser ? "max-w-[88%] bg-muted px-3.5" : "max-w-[88%] w-[88%] bg-background px-1",
      )}>
        {isUser ? (
          message.blocks[0]?.type === "text" ? message.blocks[0].text : ""
        ) : (
          <>
            {message.reasoningSteps.length > 0 && (
              <ReasoningSteps steps={message.reasoningSteps} />
            )}
            {message.blocks.map((block, i) => {
              if (block.type === "text") {
                return (
                  <div key={i} className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-li:my-0 break-words whitespace-normal">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {block.text}
                    </ReactMarkdown>
                  </div>
                )
              }
              if (block.type === "flow") {
                return (
                  <FlowCard
                    key={block.flow.id}
                    flow={block.flow}
                    isActive={activeFlowId === block.flow.id}
                    onClick={() => onFlowClick(
                      activeFlowId === block.flow.id ? "" : block.flow.id,
                    )}
                  />
                )
              }
              return null
            })}
            {isStreaming && message.blocks.length === 0 && (
              <div className="flex items-center gap-2 h-8">
                <div className="size-4 flex items-center justify-center shrink-0">
                  <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
