"use client"

import { useRouter } from "next/navigation"
import { formatRelativeTime } from "@/lib/format-relative-time"
import type { NotificationInfo } from "../types"

interface NotificationItemProps {
  notification: NotificationInfo
  workspaceSlug: string
  onRead: (id: string) => void
}

export function NotificationItem({ notification, workspaceSlug, onRead }: NotificationItemProps) {
  const router = useRouter()
  const isUnread = !notification.readAt

  const handleClick = () => {
    if (isUnread) onRead(notification.id)
    if (notification.projectSlug) {
      router.push(`/${workspaceSlug}/projects/${notification.projectSlug}`)
    }
  }

  const title = (notification.payload.taskTitle as string) || "a task"
  const actor = notification.actorDisplayName || notification.actorUsername

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-muted/50 transition-colors cursor-pointer ${
        isUnread ? "bg-muted/30" : ""
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug">
          {notification.type === "task_assigned" && (
            <><span className="font-semibold">{actor}</span> assigned you to <span className="font-semibold">{title}</span></>
          )}
          {notification.type === "task_commented" && (
            <><span className="font-semibold">{actor}</span> commented on <span className="font-semibold">{title}</span></>
          )}
          {notification.type === "task_status_changed" && (
            <><span className="font-semibold">{actor}</span> changed <span className="font-semibold">{title}</span> to <span className="font-semibold">{notification.payload.to as string}</span></>
          )}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0 mt-0.5">
        <span className="text-xs text-muted-foreground tabular-nums" suppressHydrationWarning>
          {formatRelativeTime(notification.createdAt)}
        </span>
        <div className="w-2 flex items-center justify-center">
          {isUnread && <div className="h-2 w-2 rounded-full bg-brand" />}
        </div>
      </div>
    </button>
  )
}
