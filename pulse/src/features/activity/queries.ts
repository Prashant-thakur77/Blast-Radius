import { eq, asc, desc } from "drizzle-orm"
import { db } from "@/db"
import { activityEvents } from "@/db/schema/activity"
import { users } from "@/db/schema/users"
import type { ActivityEventInfo, ActivityType } from "./types"

export async function getActivityByTask(taskId: string): Promise<ActivityEventInfo[]> {
  const rows = await db
    .select({
      id: activityEvents.id,
      workspaceId: activityEvents.workspaceId,
      projectId: activityEvents.projectId,
      taskId: activityEvents.taskId,
      actorUserId: activityEvents.actorUserId,
      actorUsername: users.username,
      actorDisplayName: users.displayName,
      type: activityEvents.type,
      payload: activityEvents.payload,
      createdAt: activityEvents.createdAt,
    })
    .from(activityEvents)
    .leftJoin(users, eq(activityEvents.actorUserId, users.id))
    .where(eq(activityEvents.taskId, taskId))
    .orderBy(asc(activityEvents.createdAt))

  return rows.map((r) => ({
    id: r.id,
    workspaceId: r.workspaceId,
    projectId: r.projectId,
    taskId: r.taskId,
    actorUserId: r.actorUserId,
    actorUsername: r.actorUsername ?? "",
    actorDisplayName: r.actorDisplayName ?? null,
    type: r.type as ActivityType,
    payload: JSON.parse(r.payload),
    createdAt: r.createdAt,
  }))
}

export async function getRecentActivityByProject(
  projectId: string,
  limit = 20
): Promise<ActivityEventInfo[]> {
  const rows = await db
    .select({
      id: activityEvents.id,
      workspaceId: activityEvents.workspaceId,
      projectId: activityEvents.projectId,
      taskId: activityEvents.taskId,
      actorUserId: activityEvents.actorUserId,
      actorUsername: users.username,
      actorDisplayName: users.displayName,
      type: activityEvents.type,
      payload: activityEvents.payload,
      createdAt: activityEvents.createdAt,
    })
    .from(activityEvents)
    .leftJoin(users, eq(activityEvents.actorUserId, users.id))
    .where(eq(activityEvents.projectId, projectId))
    .orderBy(desc(activityEvents.createdAt))
    .limit(limit)

  return rows.map((r) => ({
    id: r.id,
    workspaceId: r.workspaceId,
    projectId: r.projectId,
    taskId: r.taskId,
    actorUserId: r.actorUserId,
    actorUsername: r.actorUsername ?? "",
    actorDisplayName: r.actorDisplayName ?? null,
    type: r.type as ActivityType,
    payload: JSON.parse(r.payload),
    createdAt: r.createdAt,
  }))
}
