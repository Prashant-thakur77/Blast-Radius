export interface MyOpenTask {
  id: string
  title: string
  status: "todo" | "in_progress"
  priority: "low" | "medium" | "high"
  projectId: string
  projectName: string
  projectSlug: string
  createdAt: Date
}

export interface WorkspaceActivityEvent {
  id: string
  projectId: string
  projectName: string
  projectSlug: string
  taskId: string | null
  actorUsername: string
  actorDisplayName: string | null
  type: string
  payload: Record<string, unknown>
  createdAt: Date
}
