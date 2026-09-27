import { eq, and, like, notInArray, sql } from "drizzle-orm"
import { db } from "@/db"
import { workspaces, workspaceMembers } from "@/db/schema/workspaces"
import { users } from "@/db/schema/users"
import type { WorkspaceMemberInfo, WorkspaceRole } from "./types"

export async function getDefaultWorkspace(userId: string) {
  const membership = await db.query.workspaceMembers.findFirst({
    where: eq(workspaceMembers.userId, userId),
    with: { workspace: true },
    orderBy: (members, { asc }) => [asc(members.joinedAt)],
  })
  return membership?.workspace ?? null
}

export async function getWorkspaceMembers(workspaceId: string): Promise<WorkspaceMemberInfo[]> {
  const rows = await db
    .select({
      id: workspaceMembers.id,
      userId: workspaceMembers.userId,
      username: users.username,
      displayName: users.displayName,
      role: workspaceMembers.role,
      joinedAt: workspaceMembers.joinedAt,
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(workspaceMembers.userId, users.id))
    .where(eq(workspaceMembers.workspaceId, workspaceId))
    .orderBy(sql`case when ${workspaceMembers.role} = 'owner' then 0 else 1 end`, workspaceMembers.joinedAt)

  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    username: r.username,
    displayName: r.displayName ?? null,
    role: r.role as WorkspaceRole,
    joinedAt: r.joinedAt,
  }))
}

export async function getWorkspaceMemberCount(workspaceId: string) {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.workspaceId, workspaceId))

  return result[0]?.count ?? 0
}

export async function getWorkspaceById(id: string) {
  return db.query.workspaces.findFirst({
    where: eq(workspaces.id, id),
  })
}

export async function getWorkspaceBySlug(slug: string) {
  return db.query.workspaces.findFirst({
    where: eq(workspaces.slug, slug),
  })
}

export async function getUserWorkspaces(userId: string) {
  const memberships = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      slug: workspaces.slug,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(eq(workspaceMembers.userId, userId))

  return memberships
}

export async function getWorkspaceMember(workspaceId: string, userId: string) {
  return db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, workspaceId),
      eq(workspaceMembers.userId, userId)
    ),
  })
}

export async function searchUsersByUsername(query: string, excludeWorkspaceId: string) {
  const existingMemberIds = db
    .select({ userId: workspaceMembers.userId })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.workspaceId, excludeWorkspaceId))

  const results = await db
    .select({ id: users.id, username: users.username, displayName: users.displayName })
    .from(users)
    .where(and(
      like(users.username, `%${query}%`),
      notInArray(users.id, existingMemberIds)
    ))
    .limit(5)

  return results
}
