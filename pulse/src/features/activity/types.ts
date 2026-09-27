export type ActivityType =
  | "task_created"
  | "task_status_changed"
  | "task_assignee_changed"
  | "comment_edited"
  | "comment_deleted"

export interface ActivityEventInfo {
  id: string
  workspaceId: string
  projectId: string
  taskId: string | null
  actorUserId: string
  actorUsername: string
  actorDisplayName: string | null
  type: ActivityType
  payload: Record<string, unknown>
  createdAt: Date
}
