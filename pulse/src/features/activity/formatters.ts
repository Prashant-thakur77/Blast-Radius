import { taskStatusConfig } from "@/features/tasks/task-status"
import type { ActivityEventInfo } from "./types"

export function formatActivityMessage(event: ActivityEventInfo): string {
  const p = event.payload
  switch (event.type) {
    case "task_created":
      return `created "${p.taskTitle}"`
    case "task_status_changed": {
      const from = taskStatusConfig[p.from as keyof typeof taskStatusConfig]?.label ?? p.from
      const to = taskStatusConfig[p.to as keyof typeof taskStatusConfig]?.label ?? p.to
      return `moved "${p.taskTitle}" from ${from} to ${to}`
    }
    case "task_assignee_changed":
      return `updated assignee on "${p.taskTitle}"`
    case "comment_edited":
      return `edited a comment on "${p.taskTitle}"`
    case "comment_deleted":
      return `deleted a comment on "${p.taskTitle}"`
    default:
      return "performed an action"
  }
}
