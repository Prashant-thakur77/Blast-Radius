import type { ProjectStatus } from "./types"

export const statusConfig: Record<ProjectStatus, { label: string; variant: "default" | "secondary" | "outline" }> = {
  planning: { label: "Planning", variant: "secondary" },
  active: { label: "Active", variant: "default" },
  completed: { label: "Completed", variant: "outline" },
  archived: { label: "Archived", variant: "outline" },
}
