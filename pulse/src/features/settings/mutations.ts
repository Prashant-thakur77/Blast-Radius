import { eq, and } from "drizzle-orm"
import { db } from "@/db"
import { users } from "@/db/schema/users"
import { userSettings } from "@/db/schema/user-settings"
import { workspaces, workspaceMembers } from "@/db/schema/workspaces"

export async function updateUserDisplayName(userId: string, displayName: string | null) {
  await db.update(users).set({ displayName }).where(eq(users.id, userId))
}

export async function upsertNotificationPreferences(
  userId: string,
  prefs: {
    notifyOnTaskAssigned?: boolean
    notifyOnTaskComment?: boolean
    notifyOnTaskStatusChange?: boolean
  }
) {
  const now = new Date()
  const existing = await db
    .select({ userId: userSettings.userId })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1)

  if (existing.length === 0) {
    await db.insert(userSettings).values({
      userId,
      notifyOnTaskAssigned: prefs.notifyOnTaskAssigned ?? true,
      notifyOnTaskComment: prefs.notifyOnTaskComment ?? true,
      notifyOnTaskStatusChange: prefs.notifyOnTaskStatusChange ?? true,
      createdAt: now,
      updatedAt: now,
    })
  } else {
    await db
      .update(userSettings)
      .set({ ...prefs, updatedAt: now })
      .where(eq(userSettings.userId, userId))
  }
}

export async function deleteUser(userId: string) {
  // Find workspaces owned by this user
  const ownedMemberships = await db
    .select({ workspaceId: workspaceMembers.workspaceId })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.userId, userId), eq(workspaceMembers.role, "owner")))

  // Delete owned workspaces (cascades to projects, tasks, comments, activity, notifications)
  for (const { workspaceId } of ownedMemberships) {
    await db.delete(workspaceMembers).where(eq(workspaceMembers.workspaceId, workspaceId))
    await db.delete(workspaces).where(eq(workspaces.id, workspaceId))
  }

  // Remove remaining memberships (workspaces where user is just a member)
  await db.delete(workspaceMembers).where(eq(workspaceMembers.userId, userId))
  await db.delete(userSettings).where(eq(userSettings.userId, userId))
  await db.delete(users).where(eq(users.id, userId))
}
