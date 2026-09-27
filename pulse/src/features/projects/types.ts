export type ProjectStatus = "planning" | "active" | "completed" | "archived"

export type ProjectIcon =
  | "folder-kanban"
  | "rocket"
  | "target"
  | "palette"
  | "globe"
  | "code"
  | "bar-chart-3"
  | "megaphone"
  | "users"
  | "book-open"
  | "wrench"
  | "flask-conical"

export interface ProjectInfo {
  id: string
  workspaceId: string
  name: string
  slug: string
  description: string | null
  status: ProjectStatus
  icon: ProjectIcon
  createdBy: string
  createdAt: Date
  updatedAt: Date
}
