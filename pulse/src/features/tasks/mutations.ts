import { eq } from "drizzle-orm"
import { nanoid } from "nanoid"
import { db } from "@/db"
import { tasks } from "@/db/schema/tasks"
import type { TaskPriority, TaskStatus } from "./types"

export async function createTask(
  projectId: string,
  workspaceId: string,
  title: string,
  description: string | undefined,
  status: TaskStatus,
  priority: TaskPriority,
  assigneeUserId: string | undefined,
  position: number,
  createdBy: string
) {
  const now = new Date()
  const id = nanoid()
  await db.insert(tasks).values({
    id,
    projectId,
    workspaceId,
    title,
    description: description ?? null,
    status,
    priority,
    assigneeUserId: assigneeUserId ?? null,
    position,
    createdBy,
    createdAt: now,
    updatedAt: now,
  })
  return id
}

export async function updateTask(
  id: string,
  data: {
    title?: string
    description?: string | null
    status?: string
    priority?: string
    assigneeUserId?: string | null
  }
) {
  await db
    .update(tasks)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(tasks.id, id))
}

export async function moveTask(id: string, status: string, position: number) {
  await db
    .update(tasks)
    .set({ status, position, updatedAt: new Date() })
    .where(eq(tasks.id, id))
}

export async function deleteTask(id: string) {
  await db.delete(tasks).where(eq(tasks.id, id))
}
