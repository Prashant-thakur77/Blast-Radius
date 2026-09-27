"use client"

import { useState, useRef, useCallback } from "react"
import { ArrowUp, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { CommentInfo } from "../types"

const MAX_HEIGHT = 120

interface CommentFormProps {
  taskId: string
  workspaceId: string
  projectId: string
  onCommentAdded: (comment: CommentInfo) => void
}

export function CommentForm({ taskId, workspaceId, projectId, onCommentAdded }: CommentFormProps) {
  const [body, setBody] = useState("")
  const [saving, setSaving] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const resize = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = "0"
    const scrollHeight = Math.min(textarea.scrollHeight, MAX_HEIGHT)
    textarea.style.height = `${scrollHeight}px`
    textarea.style.overflowY = textarea.scrollHeight > MAX_HEIGHT ? "auto" : "hidden"
  }, [])

  const handleSend = async () => {
    if (body.trim().length < 1 || saving) return

    setSaving(true)
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: body.trim() }),
        }
      )
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Failed to add comment")
        return
      }
      setBody("")
      if (textareaRef.current) textareaRef.current.style.height = "auto"
      onCommentAdded(data.comment)
    } catch {
      toast.error("Network error")
    } finally {
      setSaving(false)
    }
  }

  const canSend = body.trim().length > 0 && !saving

  return (
    <div className="flex items-end gap-2">
      <textarea
        ref={textareaRef}
        value={body}
        onInput={(e) => {
          setBody(e.currentTarget.value)
          resize()
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            handleSend()
          }
        }}
        placeholder="Add a comment..."
        disabled={saving}
        rows={1}
        className="flex-1 resize-none bg-transparent py-1 text-base md:text-sm leading-6 outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
        style={{ minHeight: 28, maxHeight: MAX_HEIGHT }}
      />
      <button
        type="button"
        onClick={handleSend}
        disabled={!canSend}
        className={cn(
          "mb-[3px] flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors",
          canSend
            ? "cursor-pointer border-border text-foreground hover:bg-accent"
            : "border-border/50 text-muted-foreground/30"
        )}
      >
        {saving ? <Loader2 className="size-3.5 animate-spin" /> : <ArrowUp className="size-3.5" />}
      </button>
    </div>
  )
}
