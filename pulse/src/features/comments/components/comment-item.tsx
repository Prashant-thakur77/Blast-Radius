"use client"

import { useState, useRef, useCallback } from "react"
import { toast } from "sonner"
import { formatRelativeTime } from "@/lib/format-relative-time"
import type { CommentInfo } from "../types"

const MAX_HEIGHT = 120

interface CommentItemProps {
  comment: CommentInfo
  currentUserId: string
  workspaceId: string
  projectId: string
  taskId: string
  onUpdated: (comment: CommentInfo) => void
  onDeleted: (commentId: string) => void
}

export function CommentItem({
  comment,
  currentUserId,
  workspaceId,
  projectId,
  taskId,
  onUpdated,
  onDeleted,
}: CommentItemProps) {
  const [deleting, setDeleting] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editBody, setEditBody] = useState(comment.body)
  const [saving, setSaving] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isOwn = comment.authorUserId === currentUserId

  const resize = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = "0"
    const scrollHeight = Math.min(textarea.scrollHeight, MAX_HEIGHT)
    textarea.style.height = `${scrollHeight}px`
    textarea.style.overflowY = textarea.scrollHeight > MAX_HEIGHT ? "auto" : "hidden"
  }, [])

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/comments/${comment.id}`,
        { method: "DELETE" }
      )
      if (!res.ok) {
        toast.error("Failed to delete comment")
        return
      }
      onDeleted(comment.id)
    } catch {
      toast.error("Network error")
    } finally {
      setDeleting(false)
    }
  }

  const handleSaveEdit = async () => {
    if (editBody.trim().length < 1) return
    if (editBody.trim() === comment.body) {
      setEditing(false)
      return
    }

    setSaving(true)
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/comments/${comment.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: editBody.trim() }),
        }
      )
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Failed to edit comment")
        return
      }
      setEditing(false)
      onUpdated(data.comment)
    } catch {
      toast.error("Network error")
    } finally {
      setSaving(false)
    }
  }

  const startEdit = () => {
    setEditBody(comment.body)
    setEditing(true)
    requestAnimationFrame(() => {
      resize()
      textareaRef.current?.focus()
    })
  }

  const cancelEdit = () => {
    setEditing(false)
    setEditBody(comment.body)
  }

  const edited = new Date(comment.updatedAt).getTime() > new Date(comment.createdAt).getTime() + 1000

  return (
    <div className="group">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium">{comment.authorDisplayName || comment.authorUsername}</span>
        <span className="text-[11px] text-muted-foreground">
          {formatRelativeTime(new Date(comment.createdAt))}
          {edited && " (edited)"}
        </span>
      </div>
      {editing ? (
        <div className="mt-1">
          <textarea
            ref={textareaRef}
            value={editBody}
            onInput={(e) => {
              setEditBody(e.currentTarget.value)
              resize()
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleSaveEdit()
              }
              if (e.key === "Escape") {
                cancelEdit()
              }
            }}
            disabled={saving}
            rows={1}
            className="w-full resize-none bg-transparent py-1 text-sm leading-5 outline-none border-b border-input placeholder:text-muted-foreground"
            style={{ minHeight: 28, maxHeight: MAX_HEIGHT }}
          />
          <div className="flex items-center gap-2 mt-1">
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
              onClick={handleSaveEdit}
              disabled={saving || editBody.trim().length < 1}
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
              onClick={cancelEdit}
              disabled={saving}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm text-foreground/90 mt-0.5 whitespace-pre-wrap break-words">{comment.body}</p>
          {isOwn && (
            <div className="flex items-center gap-1 mt-0.5 text-[11px] text-muted-foreground">
              <button
                type="button"
                className="hover:text-foreground cursor-pointer"
                onClick={startEdit}
              >
                Edit
              </button>
              <span className="text-muted-foreground text-sm flex items-center">·</span>
              <button
                type="button"
                className="hover:text-destructive cursor-pointer"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
