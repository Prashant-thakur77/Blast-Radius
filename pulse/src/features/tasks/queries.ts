import { eq, and, asc, inArray, sql } from "drizzle-orm"
import { db } from "@/db"
import { tasks } from "@/db/schema/tasks"
import { users } from "@/db/schema/users"
import type { TaskInfo, TaskStatus } from "./types"

export async function getTasksByProject(projectId: string): Promise<TaskInfo[]> {
  const rows = await db
    .select({
      id: tasks.id,
      projectId: tasks.projectId,
      workspaceId: tasks.workspaceId,
      title: tasks.title,
      description: tasks.description,
      status: tasks.status,
      priority: tasks.priority,
      assigneeUserId: tasks.assigneeUserId,
      assigneeUsername: users.username,
      assigneeDisplayName: users.displayName,
      position: tasks.position,
      createdBy: tasks.createdBy,
      createdAt: tasks.createdAt,
      updatedAt: tasks.updatedAt,
    })
    .from(tasks)
    .leftJoin(users, eq(tasks.assigneeUserId, users.id))
    .where(eq(tasks.projectId, projectId))
    .orderBy(asc(tasks.position))

  return rows.map((r) => ({
    id: r.id,
    projectId: r.projectId,
    workspaceId: r.workspaceId,
    title: r.title,
    description: r.description,
    status: r.status as TaskInfo["status"],
    priority: r.priority as TaskInfo["priority"],
    assigneeUserId: r.assigneeUserId,
    assigneeUsername: r.assigneeUsername ?? null,
    assigneeDisplayName: r.assigneeDisplayName ?? null,
    position: r.position,
    createdBy: r.createdBy,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }))
}

export async function getTaskById(id: string) {
  const rows = await db
    .select({
      id: tasks.id,
      projectId: tasks.projectId,
      workspaceId: tasks.workspaceId,
      title: tasks.title,
      description: tasks.description,
      status: tasks.status,
      priority: tasks.priority,
      assigneeUserId: tasks.assigneeUserId,
      assigneeUsername: users.username,
      assigneeDisplayName: users.displayName,
      position: tasks.position,
      createdBy: tasks.createdBy,
      createdAt: tasks.createdAt,
      updatedAt: tasks.updatedAt,
    })
    .from(tasks)
    .leftJoin(users, eq(tasks.assigneeUserId, users.id))
    .where(eq(tasks.id, id))

  if (rows.length === 0) return null
  const r = rows[0]
  return {
    id: r.id,
    projectId: r.projectId,
    workspaceId: r.workspaceId,
    title: r.title,
    description: r.description,
    status: r.status as TaskStatus,
    priority: r.priority as TaskInfo["priority"],
    assigneeUserId: r.assigneeUserId,
    assigneeUsername: r.assigneeUsername ?? null,
    assigneeDisplayName: r.assigneeDisplayName ?? null,
    position: r.position,
    createdBy: r.createdBy,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }
}

export async function getTaskCountsByProjects(
  projectIds: string[]
): Promise<Record<string, { total: number; done: number }>> {
  if (projectIds.length === 0) return {}

  const rows = await db
    .select({
      projectId: tasks.projectId,
      total: sql<number>`count(*)`,
      done: sql<number>`sum(case when ${tasks.status} = 'done' then 1 else 0 end)`,
    })
    .from(tasks)
    .where(inArray(tasks.projectId, projectIds))
    .groupBy(tasks.projectId)

  const result: Record<string, { total: number; done: number }> = {}
  for (const r of rows) {
    result[r.projectId] = { total: r.total, done: r.done ?? 0 }
  }
  return result
}

export async function getMaxPosition(projectId: string, status: string): Promise<number> {
  const result = await db
    .select({ maxPos: sql<number>`coalesce(max(${tasks.position}), 0)` })
    .from(tasks)
    .where(and(eq(tasks.projectId, projectId), eq(tasks.status, status)))

  return result[0]?.maxPos ?? 0
}
