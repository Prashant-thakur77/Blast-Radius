"use client"

import { useState } from "react"
import Link from "next/link"
import { Activity, ChevronLeft, ChevronRight } from "lucide-react"
import { formatRelativeTime } from "@/lib/format-relative-time"
import type { WorkspaceActivityEvent } from "../types"

const PAGE_SIZE = 6

interface RecentActivityListProps {
  events: WorkspaceActivityEvent[]
  workspaceSlug: string
}

const statusLabel: Record<string, string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
}

function describeEvent(event: WorkspaceActivityEvent): string {
  const p = event.payload
  const task = (p.taskTitle as string) || "a task"
  switch (event.type) {
    case "task_created":
      return `created "${task}"`
    case "task_status_changed":
      return `moved "${task}" to ${statusLabel[p.to as string] ?? p.to}`
    case "task_assignee_changed":
      return `reassigned "${task}"`
    case "comment_edited":
      return `edited a comment on "${task}"`
    case "comment_deleted":
      return `deleted a comment on "${task}"`
    default:
      return event.type
  }
}

export function RecentActivityList({ events, workspaceSlug }: RecentActivityListProps) {
  const [page, setPage] = useState(0)
  const totalPages = Math.ceil(events.length / PAGE_SIZE)
  const visible = events.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-sm text-muted-foreground">
        <Activity className="h-5 w-5 mb-2 opacity-50" />
        No recent activity
      </div>
    )
  }

  return (
    <div>
      <div className="rounded-lg border divide-y h-[319px]">
        {visible.map((event) => (
          <Link
            key={event.id}
            href={`/${workspaceSlug}/projects/${event.projectSlug}`}
            className="flex items-start gap-2 px-3 py-2 hover:bg-muted/50 transition-colors first:rounded-t-lg last:rounded-b-lg"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm leading-snug">
                <span className="font-medium">{event.actorDisplayName || event.actorUsername}</span>{" "}
                {describeEvent(event)}
              </p>
              <p className="text-xs text-muted-foreground">{event.projectName}</p>
            </div>
            <span className="text-xs text-muted-foreground shrink-0 mt-0.5 tabular-nums" suppressHydrationWarning>
              {formatRelativeTime(event.createdAt)}
            </span>
          </Link>
        ))}
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-1 mt-2">
          <button
            type="button"
            onClick={() => setPage((p) => p - 1)}
            disabled={page === 0}
            className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted/50 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="text-xs text-muted-foreground tabular-nums px-1">
            {page + 1}/{totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= totalPages - 1}
            className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted/50 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}
