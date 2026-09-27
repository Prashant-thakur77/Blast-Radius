import { eq, ne, and, desc } from "drizzle-orm"
import { db } from "@/db"
import { tasks } from "@/db/schema/tasks"
import { projects } from "@/db/schema/projects"
import { activityEvents } from "@/db/schema/activity"
import { users } from "@/db/schema/users"
import type { MyOpenTask, WorkspaceActivityEvent } from "./types"

export async function getMyOpenTasks(
  workspaceId: string,
  userId: string,
  limit = 20
): Promise<MyOpenTask[]> {
  const rows = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      status: tasks.status,
      priority: tasks.priority,
      projectId: tasks.projectId,
      projectName: projects.name,
      projectSlug: projects.slug,
      createdAt: tasks.createdAt,
    })
    .from(tasks)
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .where(
      and(
        eq(tasks.workspaceId, workspaceId),
        eq(tasks.assigneeUserId, userId),
        ne(tasks.status, "done")
      )
    )
    .orderBy(desc(tasks.updatedAt))
    .limit(limit)

  return rows as MyOpenTask[]
}

export async function getRecentWorkspaceActivity(
  workspaceId: string,
  limit = 15
): Promise<WorkspaceActivityEvent[]> {
  const rows = await db
    .select({
      id: activityEvents.id,
      projectId: activityEvents.projectId,
      projectName: projects.name,
      projectSlug: projects.slug,
      taskId: activityEvents.taskId,
      actorUsername: users.username,
      actorDisplayName: users.displayName,
      type: activityEvents.type,
      payload: activityEvents.payload,
      createdAt: activityEvents.createdAt,
    })
    .from(activityEvents)
    .leftJoin(users, eq(activityEvents.actorUserId, users.id))
    .leftJoin(projects, eq(activityEvents.projectId, projects.id))
    .where(eq(activityEvents.workspaceId, workspaceId))
    .orderBy(desc(activityEvents.createdAt))
    .limit(limit)

  return rows.map((r) => ({
    id: r.id,
    projectId: r.projectId,
    projectName: r.projectName ?? "",
    projectSlug: r.projectSlug ?? "",
    taskId: r.taskId,
    actorUsername: r.actorUsername ?? "",
    actorDisplayName: r.actorDisplayName ?? null,
    type: r.type,
    payload: JSON.parse(r.payload),
    createdAt: r.createdAt,
  }))
}
