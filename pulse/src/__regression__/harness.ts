// Helpers for BlastRadius regression tests: seed a workspace and sign in.
import { vi } from "vitest"
import { db } from "@/db"
import { users } from "@/db/schema/users"
import { workspaces, workspaceMembers } from "@/db/schema/workspaces"
import { projects } from "@/db/schema/projects"
import { tasks } from "@/db/schema/tasks"
import { comments } from "@/db/schema/comments"
import { activityEvents } from "@/db/schema/activity"
import { getSession } from "@/features/auth/session"
import { eq } from "drizzle-orm"

let n = 0
const id = (p: string) => `${p}_${++n}_${Math.random().toString(36).slice(2, 8)}`

export async function seedWorkspace() {
  const now = new Date()
  const user = { id: id("user"), username: id("ana"), displayName: "Ana", passwordHash: "x", createdAt: now }
  await db.insert(users).values(user)
  const workspace = { id: id("ws"), name: "Acme", slug: id("acme"), createdAt: now }
  await db.insert(workspaces).values(workspace)
  await db.insert(workspaceMembers).values({ id: id("mem"), workspaceId: workspace.id, userId: user.id, role: "owner", joinedAt: now })
  const project = { id: id("proj"), workspaceId: workspace.id, name: "Launch", slug: id("launch"), createdBy: user.id, createdAt: now, updatedAt: now }
  await db.insert(projects).values(project)
  const task = { id: id("task"), projectId: project.id, workspaceId: workspace.id, title: "Ship it", position: 0, createdBy: user.id, createdAt: now, updatedAt: now }
  await db.insert(tasks).values(task)
  const comment = { id: id("cmt"), taskId: task.id, workspaceId: workspace.id, authorUserId: user.id, body: "first", createdAt: now, updatedAt: now }
  await db.insert(comments).values(comment)
  return { user, workspace, project, task, comment }
}

export function signInAs(user: { id: string; username: string }) {
  vi.mocked(getSession).mockResolvedValue({ sub: user.id, username: user.username })
}

export function jsonRequest(method: string, body?: unknown) {
  return new Request("http://test.local/api", {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

export async function activityFor(taskId: string) {
  return db.select().from(activityEvents).where(eq(activityEvents.taskId, taskId))
}
