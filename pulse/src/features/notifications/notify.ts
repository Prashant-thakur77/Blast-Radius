import { createNotification } from "./mutations"
import { getUserSettings } from "@/features/settings/queries"

export async function notifyTaskAssigned(params: {
  workspaceId: string
  projectId: string
  taskId: string
  taskTitle: string
  actorUserId: string
  assigneeUserId: string
}) {
  if (params.actorUserId === params.assigneeUserId) return
  const settings = await getUserSettings(params.assigneeUserId)
  if (!settings.notifyOnTaskAssigned) return
  try {
    await createNotification({
      workspaceId: params.workspaceId,
      recipientUserId: params.assigneeUserId,
      actorUserId: params.actorUserId,
      type: "task_assigned",
      projectId: params.projectId,
      taskId: params.taskId,
      payload: { taskTitle: params.taskTitle },
    })
  } catch (error) {
    console.error("Failed to create notification:", error)
  }
}

export async function notifyTaskCommented(params: {
  workspaceId: string
  projectId: string
  taskId: string
  taskTitle: string
  actorUserId: string
  assigneeUserId: string | null
  commentPreview: string
}) {
  if (!params.assigneeUserId) return
  if (params.actorUserId === params.assigneeUserId) return
  const commentSettings = await getUserSettings(params.assigneeUserId)
  if (!commentSettings.notifyOnTaskComment) return
  try {
    await createNotification({
      workspaceId: params.workspaceId,
      recipientUserId: params.assigneeUserId,
      actorUserId: params.actorUserId,
      type: "task_commented",
      projectId: params.projectId,
      taskId: params.taskId,
      payload: {
        taskTitle: params.taskTitle,
        commentPreview: params.commentPreview.slice(0, 100),
      },
    })
  } catch (error) {
    console.error("Failed to create notification:", error)
  }
}

export async function notifyTaskStatusChanged(params: {
  workspaceId: string
  projectId: string
  taskId: string
  taskTitle: string
  actorUserId: string
  assigneeUserId: string | null
  fromStatus: string
  toStatus: string
}) {
  if (!params.assigneeUserId) return
  if (params.actorUserId === params.assigneeUserId) return
  const statusSettings = await getUserSettings(params.assigneeUserId)
  if (!statusSettings.notifyOnTaskStatusChange) return
  try {
    await createNotification({
      workspaceId: params.workspaceId,
      recipientUserId: params.assigneeUserId,
      actorUserId: params.actorUserId,
      type: "task_status_changed",
      projectId: params.projectId,
      taskId: params.taskId,
      payload: {
        taskTitle: params.taskTitle,
        from: params.fromStatus,
        to: params.toStatus,
      },
    })
  } catch (error) {
    console.error("Failed to create notification:", error)
  }
}
