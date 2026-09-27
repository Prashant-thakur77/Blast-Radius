export type TaskStatus = "todo" | "in_progress" | "done"

export type TaskPriority = "low" | "medium" | "high"

export interface TaskInfo {
  id: string
  projectId: string
  workspaceId: string
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  assigneeUserId: string | null
  assigneeUsername: string | null
  assigneeDisplayName: string | null
  position: number
  createdBy: string
  createdAt: Date
  updatedAt: Date
}
