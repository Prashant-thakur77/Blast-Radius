import { z } from "zod"

const taskStatuses = ["todo", "in_progress", "done"] as const
const taskPriorities = ["low", "medium", "high"] as const

export const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  priority: z.enum(taskPriorities).default("medium"),
  assigneeUserId: z.string().optional(),
  status: z.enum(taskStatuses).default("todo"),
})

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  priority: z.enum(taskPriorities).optional(),
  assigneeUserId: z.string().nullable().optional(),
  status: z.enum(taskStatuses).optional(),
})

export const moveTaskSchema = z.object({
  status: z.enum(taskStatuses),
  position: z.number().int(),
})
