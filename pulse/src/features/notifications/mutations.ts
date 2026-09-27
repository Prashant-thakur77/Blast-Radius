import { nanoid } from "nanoid"
import { db } from "@/db"
import { notifications } from "@/db/schema/notifications"
import { eq, and, isNull } from "drizzle-orm"

export async function createNotification(params: {
  workspaceId: string
  recipientUserId: string
  actorUserId: string
  type: string
  projectId: string
  taskId: string | null
  payload: Record<string, unknown>
}) {
  const id = nanoid()
  await db.insert(notifications).values({
    id,
    workspaceId: params.workspaceId,
    recipientUserId: params.recipientUserId,
    actorUserId: params.actorUserId,
    type: params.type,
    projectId: params.projectId,
    taskId: params.taskId,
    payload: JSON.stringify(params.payload),
    createdAt: new Date(),
  })
  return id
}

export async function markAsRead(notificationId: string) {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.id, notificationId), isNull(notifications.readAt)))
}

export async function markAllAsRead(workspaceId: string, userId: string) {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.workspaceId, workspaceId),
        eq(notifications.recipientUserId, userId),
        isNull(notifications.readAt)
      )
    )
}
