import { z } from "zod"

const projectIcons = [
  "folder-kanban", "rocket", "target", "palette", "globe", "code",
  "bar-chart-3", "megaphone", "users", "book-open", "wrench", "flask-conical",
] as const
const projectStatuses = ["planning", "active", "completed", "archived"] as const

export const createProjectSchema = z.object({
  name: z.string().min(2).max(50),
  description: z.string().max(500).optional(),
  icon: z.enum(projectIcons).default("folder-kanban"),
})

export const updateProjectSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  description: z.string().max(500).optional(),
  status: z.enum(projectStatuses).optional(),
  icon: z.enum(projectIcons).optional(),
})
