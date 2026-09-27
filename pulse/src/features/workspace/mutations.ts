import { eq } from "drizzle-orm"
import { nanoid } from "nanoid"
import { db } from "@/db"
import { workspaces, workspaceMembers } from "@/db/schema/workspaces"
import type { WorkspaceRole } from "./types"

export async function createWorkspace(name: string, slug: string, ownerId: string) {
  const now = new Date()
  const workspace = {
    id: nanoid(),
    name,
    slug,
    createdAt: now,
  }

  await db.insert(workspaces).values(workspace)
  await db.insert(workspaceMembers).values({
    id: nanoid(),
    workspaceId: workspace.id,
    userId: ownerId,
    role: "owner" as WorkspaceRole,
    joinedAt: now,
  })

  return workspace
}

export async function updateWorkspaceName(workspaceId: string, name: string, slug: string) {
  await db
    .update(workspaces)
    .set({ name, slug })
    .where(eq(workspaces.id, workspaceId))
}

export async function deleteWorkspace(workspaceId: string) {
  await db.delete(workspaceMembers).where(eq(workspaceMembers.workspaceId, workspaceId))
  await db.delete(workspaces).where(eq(workspaces.id, workspaceId))
}

export async function removeWorkspaceMember(memberId: string) {
  await db.delete(workspaceMembers).where(eq(workspaceMembers.id, memberId))
}

export async function addWorkspaceMember(
  workspaceId: string,
  userId: string,
  role: WorkspaceRole
) {
  const id = nanoid()
  await db.insert(workspaceMembers).values({
    id,
    workspaceId,
    userId,
    role,
    joinedAt: new Date(),
  })
  return id
}
