import { NextResponse } from "next/server"
import { getSession } from "@/features/auth/session"
import { getUserById } from "@/features/auth/queries"
import { getWorkspaceMember } from "@/features/workspace/queries"
import { getTaskById } from "@/features/tasks/queries"
import { moveTask } from "@/features/tasks/mutations"
import { moveTaskSchema } from "@/features/tasks/schema"
import { logEvent } from "@/features/activity/log-event"
import { notifyTaskStatusChanged } from "@/features/notifications/notify"

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
    const parsed = moveTaskSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 })
    }

    await moveTask(taskId, parsed.data.status, parsed.data.position)

    if (parsed.data.status !== task.status) {
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

    const updated = await getTaskById(taskId)
    return NextResponse.json({ task: updated })
  } catch (error) {
    console.error("Move task error:", error)
    return NextResponse.json({ error: "Failed to move task" }, { status: 500 })
  }
}
