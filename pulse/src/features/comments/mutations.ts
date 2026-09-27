import { eq } from "drizzle-orm"
import { nanoid } from "nanoid"
import { db } from "@/db"
import { comments } from "@/db/schema/comments"

export async function createComment(
  taskId: string,
  workspaceId: string,
  authorUserId: string,
  body: string
) {
  const now = new Date()
  const id = nanoid()
  await db.insert(comments).values({
    id,
    taskId,
    workspaceId,
    authorUserId,
    body,
    createdAt: now,
    updatedAt: now,
  })
  return id
}

export async function updateComment(id: string, body: string) {
  await db
    .update(comments)
    .set({ body, updatedAt: new Date() })
    .where(eq(comments.id, id))
}

export async function deleteComment(id: string) {
  await db.delete(comments).where(eq(comments.id, id))
}
