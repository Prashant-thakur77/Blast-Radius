import { NextResponse } from "next/server"
import { getSession } from "@/features/auth/session"
import { getUserById } from "@/features/auth/queries"
import { getWorkspaceMember } from "@/features/workspace/queries"
import { getProjectById } from "@/features/projects/queries"
import { getTasksByProject, getTaskById, getMaxPosition } from "@/features/tasks/queries"
import { createTask } from "@/features/tasks/mutations"
import { createTaskSchema } from "@/features/tasks/schema"
import { logEvent } from "@/features/activity/log-event"
import { notifyTaskAssigned } from "@/features/notifications/notify"

async function authorize(workspaceId: string) {
  const session = await getSession()
  if (!session) return null

  const user = await getUserById(session.sub)
  if (!user) return null

  const member = await getWorkspaceMember(workspaceId, user.id)
  if (!member) return null

  return user
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; projectId: string }> }
) {
  try {
    const { id, projectId } = await params
    const user = await authorize(id)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const project = await getProjectById(projectId)
    if (!project || project.workspaceId !== id) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    const tasks = await getTasksByProject(projectId)
    return NextResponse.json({ tasks })
  } catch (error) {
    console.error("List tasks error:", error)
    return NextResponse.json({ error: "Failed to list tasks" }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; projectId: string }> }
) {
  try {
    const { id, projectId } = await params
    const user = await authorize(id)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const project = await getProjectById(projectId)
    if (!project || project.workspaceId !== id) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    const body = await request.json()
    const parsed = createTaskSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 })
    }

    const { title, description, priority, assigneeUserId, status } = parsed.data
    const maxPos = await getMaxPosition(projectId, status)
    const position = maxPos + 1000

    const taskId = await createTask(
      projectId,
      id,
      title.trim(),
      description,
      status,
      priority,
      assigneeUserId,
      position,
      user.id
    )

    const created = await getTaskById(taskId)

    await logEvent({
      workspaceId: id,
      projectId,
      taskId,
      actorUserId: user.id,
      type: "task_created",
      payload: { taskTitle: title.trim() },
    })

    if (assigneeUserId) {
      await notifyTaskAssigned({
        workspaceId: id,
        projectId,
        taskId,
        taskTitle: title.trim(),
        actorUserId: user.id,
        assigneeUserId,
      })
    }

    return NextResponse.json({ task: created })
  } catch (error) {
    console.error("Create task error:", error)
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 })
  }
}
