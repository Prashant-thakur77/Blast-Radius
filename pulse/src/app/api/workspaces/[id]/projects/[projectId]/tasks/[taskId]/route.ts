import { NextResponse } from "next/server"
import { getSession } from "@/features/auth/session"
import { getUserById } from "@/features/auth/queries"
import { getWorkspaceMember } from "@/features/workspace/queries"
import { getTaskById } from "@/features/tasks/queries"
import { updateTask, deleteTask } from "@/features/tasks/mutations"
import { updateTaskSchema } from "@/features/tasks/schema"
import { logEvent } from "@/features/activity/log-event"
import { notifyTaskAssigned, notifyTaskStatusChanged } from "@/features/notifications/notify"

async function authorize(workspaceId: string) {
  const session = await getSession()
  if (!session) return null

  const user = await getUserById(session.sub)
  if (!user) return null

  const member = await getWorkspaceMember(workspaceId, user.id)
  if (!member) return null

  return user
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; projectId: string; taskId: string }> }
) {
  try {
    const { id, projectId, taskId } = await params
    const user = await authorize(id)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const task = await getTaskById(taskId)
    if (!task || task.projectId !== projectId || task.workspaceId !== id) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    const body = await request.json()
    const parsed = updateTaskSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 })
    }

    const updates: Record<string, unknown> = {}
    if (parsed.data.title !== undefined) updates.title = parsed.data.title.trim()
    if (parsed.data.description !== undefined) updates.description = parsed.data.description || null
    if (parsed.data.priority !== undefined) updates.priority = parsed.data.priority
    if (parsed.data.assigneeUserId !== undefined) updates.assigneeUserId = parsed.data.assigneeUserId
    if (parsed.data.status !== undefined) updates.status = parsed.data.status

    await updateTask(taskId, updates)

    if (parsed.data.status !== undefined && parsed.data.status !== task.status) {
      await logEvent({
        workspaceId: id,
        projectId,
        taskId,
        actorUserId: user.id,
        type: "task_status_changed",
        payload: { from: task.status, to: parsed.data.status, taskTitle: task.title },
      })
      await notifyTaskStatusChanged({
        workspaceId: id,
        projectId,
        taskId,
        taskTitle: task.title,
        actorUserId: user.id,
        assigneeUserId: task.assigneeUserId,
        fromStatus: task.status,
        toStatus: parsed.data.status,
      })
    }

    if (parsed.data.assigneeUserId !== undefined && parsed.data.assigneeUserId !== task.assigneeUserId) {
      await logEvent({
        workspaceId: id,
        projectId,
        taskId,
        actorUserId: user.id,
        type: "task_assignee_changed",
        payload: { fromUserId: task.assigneeUserId, toUserId: parsed.data.assigneeUserId, taskTitle: task.title },
      })
      if (parsed.data.assigneeUserId) {
        await notifyTaskAssigned({
          workspaceId: id,
          projectId,
          taskId,
          taskTitle: task.title,
          actorUserId: user.id,
          assigneeUserId: parsed.data.assigneeUserId,
        })
      }
    }

    const updated = await getTaskById(taskId)
    return NextResponse.json({ task: updated })
  } catch (error) {
    console.error("Update task error:", error)
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; projectId: string; taskId: string }> }
) {
  try {
    const { id, projectId, taskId } = await params
    const user = await authorize(id)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const task = await getTaskById(taskId)
    if (!task || task.projectId !== projectId || task.workspaceId !== id) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    await deleteTask(taskId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete task error:", error)
    return NextResponse.json({ error: "Failed to delete task" }, { status: 500 })
  }
}
