import { NextResponse } from "next/server"
import { getSession } from "@/features/auth/session"
import { getUserById } from "@/features/auth/queries"
import { getWorkspaceMember } from "@/features/workspace/queries"
import { getTaskById } from "@/features/tasks/queries"
import { getCommentsByTask, getCommentById } from "@/features/comments/queries"
import { createComment } from "@/features/comments/mutations"
import { createCommentSchema } from "@/features/comments/schema"
import { notifyTaskCommented } from "@/features/notifications/notify"

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
  { params }: { params: Promise<{ id: string; projectId: string; taskId: string }> }
) {
  try {
    const { id, taskId } = await params
    const user = await authorize(id)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const task = await getTaskById(taskId)
    if (!task || task.workspaceId !== id) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    const comments = await getCommentsByTask(taskId)
    return NextResponse.json({ comments })
  } catch (error) {
    console.error("List comments error:", error)
    return NextResponse.json({ error: "Failed to list comments" }, { status: 500 })
  }
}

export async function POST(
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
    if (!task || task.workspaceId !== id) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    const body = await request.json()
    const parsed = createCommentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 })
    }

    const commentId = await createComment(taskId, id, user.id, parsed.data.body.trim())
    const comment = await getCommentById(commentId)

    await notifyTaskCommented({
      workspaceId: id,
      projectId,
      taskId,
      taskTitle: task.title,
      actorUserId: user.id,
      assigneeUserId: task.assigneeUserId,
      commentPreview: parsed.data.body.trim(),
    })

    return NextResponse.json({ comment })
  } catch (error) {
    console.error("Create comment error:", error)
    return NextResponse.json({ error: "Failed to create comment" }, { status: 500 })
  }
}
