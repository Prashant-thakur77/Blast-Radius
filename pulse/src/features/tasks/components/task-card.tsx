"use client"

import { useState } from "react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { ChevronDown } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { formatRelativeTime } from "@/lib/format-relative-time"
import { taskPriorityConfig } from "../task-priority"
import type { TaskInfo } from "../types"

interface TaskCardProps {
  task: TaskInfo
  isOverlay?: boolean
  readonly?: boolean
  onClick?: () => void
}

export function TaskCard({ task, isOverlay, readonly, onClick }: TaskCardProps) {
  const [expanded, setExpanded] = useState(false)
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, disabled: readonly })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : undefined,
  }

  const pc = taskPriorityConfig[task.priority]
  const hasDescription = !!task.description?.trim()


  return (
    <div
      ref={isOverlay ? undefined : setNodeRef}
      style={isOverlay ? undefined : style}
      {...(isOverlay || readonly ? {} : attributes)}
      {...(isOverlay || readonly ? {} : listeners)}
      className={`rounded-lg border bg-background p-3 shadow-sm transition-colors ${
        readonly
          ? "cursor-default"
          : "cursor-grab active:cursor-grabbing hover:border-foreground/20"
      } ${isOverlay ? "shadow-lg ring-1 ring-foreground/10" : ""}`}
      onClick={(e) => {
        if (isDragging || readonly) return
        e.stopPropagation()
        onClick?.()
      }}
    >
      {/* Top row: title + timestamp */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-snug line-clamp-2 flex-1">{task.title}</p>
        <span className="text-[11px] text-muted-foreground tabular-nums shrink-0 mt-0.5" suppressHydrationWarning>
          {formatRelativeTime(task.updatedAt)}
        </span>
      </div>

      {/* Description — 1 line collapsed, expandable */}
      <div className="mt-1.5 min-h-[1lh] flex items-start gap-1">
        {hasDescription ? (
          <>
            <p className={`text-xs text-muted-foreground leading-relaxed flex-1 ${expanded ? "" : "line-clamp-1"}`}>
              {task.description}
            </p>
            {task.description!.length > 60 && (
              <button
                type="button"
                className="shrink-0 mt-0.5 text-muted-foreground/40 hover:text-foreground cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation()
                  setExpanded(!expanded)
                }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
              </button>
            )}
          </>
        ) : (
          <p className="text-xs text-muted-foreground/30 leading-relaxed">No description</p>
        )}
      </div>

      {/* Bottom row: priority + assignee */}
      <div className="flex items-center justify-between mt-2">
        <Badge variant={pc.variant}>
          {pc.label}
        </Badge>
        {task.assigneeUsername && (
          <span className="text-xs text-muted-foreground truncate max-w-[120px]">
            {task.assigneeDisplayName || task.assigneeUsername}
          </span>
        )}
      </div>
    </div>
  )
}
