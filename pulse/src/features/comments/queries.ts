import { eq, asc } from "drizzle-orm"
import { db } from "@/db"
import { comments } from "@/db/schema/comments"
import { users } from "@/db/schema/users"
import type { CommentInfo } from "./types"

export async function getCommentsByTask(taskId: string): Promise<CommentInfo[]> {
  const rows = await db
    .select({
      id: comments.id,
      taskId: comments.taskId,
      workspaceId: comments.workspaceId,
      authorUserId: comments.authorUserId,
      authorUsername: users.username,
      authorDisplayName: users.displayName,
      body: comments.body,
      createdAt: comments.createdAt,
      updatedAt: comments.updatedAt,
    })
    .from(comments)
    .leftJoin(users, eq(comments.authorUserId, users.id))
    .where(eq(comments.taskId, taskId))
    .orderBy(asc(comments.createdAt))

  return rows.map((r) => ({
    id: r.id,
    taskId: r.taskId,
    workspaceId: r.workspaceId,
    authorUserId: r.authorUserId,
    authorUsername: r.authorUsername ?? "",
    authorDisplayName: r.authorDisplayName ?? null,
    body: r.body,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }))
}

export async function getCommentById(id: string) {
  const rows = await db
    .select({
      id: comments.id,
      taskId: comments.taskId,
      workspaceId: comments.workspaceId,
      authorUserId: comments.authorUserId,
      authorUsername: users.username,
      authorDisplayName: users.displayName,
      body: comments.body,
      createdAt: comments.createdAt,
      updatedAt: comments.updatedAt,
    })
    .from(comments)
    .leftJoin(users, eq(comments.authorUserId, users.id))
    .where(eq(comments.id, id))

  if (rows.length === 0) return null
  const r = rows[0]
  return {
    id: r.id,
    taskId: r.taskId,
    workspaceId: r.workspaceId,
    authorUserId: r.authorUserId,
    authorUsername: r.authorUsername ?? "",
    authorDisplayName: r.authorDisplayName ?? null,
    body: r.body,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }
}
