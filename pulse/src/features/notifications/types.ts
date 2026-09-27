export type NotificationType =
  | "task_assigned"
  | "task_commented"
  | "task_status_changed"

export interface NotificationInfo {
  id: string
  workspaceId: string
  recipientUserId: string
  actorUserId: string
  actorUsername: string
  actorDisplayName: string | null
  type: NotificationType
  projectId: string
  projectSlug: string
  taskId: string | null
  payload: Record<string, unknown>
  readAt: Date | null
  createdAt: Date
}
