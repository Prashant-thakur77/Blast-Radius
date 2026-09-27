import { NextResponse } from "next/server"
import { getSession } from "@/features/auth/session"
import { getUserById } from "@/features/auth/queries"
import { getWorkspaceMember } from "@/features/workspace/queries"
import { getCommentById } from "@/features/comments/queries"
import { updateComment, deleteComment } from "@/features/comments/mutations"
import { updateCommentSchema } from "@/features/comments/schema"
import { getTaskById } from "@/features/tasks/queries"
import { logEvent } from "@/features/activity/log-event"

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
  { params }: { params: Promise<{ id: string; projectId: string; taskId: string; commentId: string }> }
) {
  try {
    const { id, projectId, taskId, commentId } = await params
    const user = await authorize(id)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const comment = await getCommentById(commentId)
    if (!comment || comment.workspaceId !== id) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 })
    }

    if (comment.authorUserId !== user.id) {
      return NextResponse.json({ error: "Cannot edit another user's comment" }, { status: 403 })
    }

    const body = await request.json()
    const parsed = updateCommentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 })
    }

    await updateComment(commentId, parsed.data.body.trim())

    const task = await getTaskById(taskId)
    await logEvent({
      workspaceId: id,
      projectId,
      taskId,
      actorUserId: user.id,
      type: "comment_edited",
      payload: { taskTitle: task?.title ?? "" },
    })

    const updated = await getCommentById(commentId)
    return NextResponse.json({ comment: updated })
  } catch (error) {
    console.error("Update comment error:", error)
    return NextResponse.json({ error: "Failed to update comment" }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; projectId: string; taskId: string; commentId: string }> }
) {
  try {
    const { id, projectId, taskId, commentId } = await params
    const user = await authorize(id)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const comment = await getCommentById(commentId)
    if (!comment || comment.workspaceId !== id) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 })
    }

    if (comment.authorUserId !== user.id) {
      return NextResponse.json({ error: "Cannot delete another user's comment" }, { status: 403 })
    }

    const task = await getTaskById(taskId)

    await deleteComment(commentId)

    await logEvent({
      workspaceId: id,
      projectId,
      taskId,
      actorUserId: user.id,
      type: "comment_deleted",
      payload: { taskTitle: task?.title ?? "" },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete comment error:", error)
    return NextResponse.json({ error: "Failed to delete comment" }, { status: 500 })
  }
}
