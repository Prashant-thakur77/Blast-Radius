import { nanoid } from "nanoid"
import { db } from "@/db"
import { activityEvents } from "@/db/schema/activity"
import type { ActivityType } from "./types"

export async function logEvent(params: {
  workspaceId: string
  projectId: string
  taskId: string | null
  actorUserId: string
  type: ActivityType
  payload: Record<string, unknown>
}) {
  try {
    await db.insert(activityEvents).values({
      id: nanoid(),
      workspaceId: params.workspaceId,
      projectId: params.projectId,
      taskId: params.taskId,
      actorUserId: params.actorUserId,
      type: params.type,
      payload: JSON.stringify(params.payload),
      createdAt: new Date(),
    })
  } catch (error) {
    console.error("Failed to log activity event:", error)
  }
}
