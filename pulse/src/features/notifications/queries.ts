import { db } from "@/db"
import { notifications } from "@/db/schema/notifications"
import { users } from "@/db/schema/users"
import { projects } from "@/db/schema/projects"
import { eq, and, isNull, desc, sql } from "drizzle-orm"
import type { NotificationInfo, NotificationType } from "./types"

export async function getNotificationsByUser(
  workspaceId: string,
  userId: string,
  limit = 50
): Promise<NotificationInfo[]> {
  const rows = await db
    .select({
      id: notifications.id,
      workspaceId: notifications.workspaceId,
      recipientUserId: notifications.recipientUserId,
      actorUserId: notifications.actorUserId,
      actorUsername: users.username,
      actorDisplayName: users.displayName,
      type: notifications.type,
      projectId: notifications.projectId,
      projectSlug: projects.slug,
      taskId: notifications.taskId,
      payload: notifications.payload,
      readAt: notifications.readAt,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .leftJoin(users, eq(notifications.actorUserId, users.id))
    .leftJoin(projects, eq(notifications.projectId, projects.id))
    .where(
      and(
        eq(notifications.workspaceId, workspaceId),
        eq(notifications.recipientUserId, userId)
      )
    )
    .orderBy(desc(notifications.createdAt))
    .limit(limit)

  return rows.map((r) => ({
    ...r,
    actorUsername: r.actorUsername ?? "Unknown",
    actorDisplayName: r.actorDisplayName ?? null,
    projectSlug: r.projectSlug ?? "",
    type: r.type as NotificationType,
    payload: JSON.parse(r.payload as string),
  }))
}

export async function getUnreadCount(workspaceId: string, userId: string): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(
      and(
        eq(notifications.workspaceId, workspaceId),
        eq(notifications.recipientUserId, userId),
        isNull(notifications.readAt)
      )
    )
  return result[0]?.count ?? 0
}
