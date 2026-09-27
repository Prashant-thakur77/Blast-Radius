import { describe, it, expect } from "vitest"
import { POST } from "@/app/api/workspaces/[id]/projects/[projectId]/tasks/[taskId]/archive/route"
import { seedWorkspace, signInAs, jsonRequest, activityFor } from "./harness"
import { db } from "@/db"
import { users } from "@/db/schema/users"

describe("tasks — pr-3-task-archiving regression", () => {
  it("archive route returns 200 and ok:true for a workspace member", async () => {
    const { user, workspace, project, task } = await seedWorkspace()
    signInAs(user)

    const resp = await POST(jsonRequest("POST"), {
      params: Promise.resolve({ id: workspace.id, projectId: project.id, taskId: task.id }),
    })

    expect(resp.status).toBe(200)
    const body = await resp.json()
    expect(body).toEqual({ ok: true })
  })

  it("archive route returns 403 for a non-member", async () => {
    const { workspace, project, task } = await seedWorkspace()

    // Create a separate user who is NOT a member of the seeded workspace
    const now = new Date()
    const outsider = {
      id: `outsider_${Math.random().toString(36).slice(2, 8)}`,
      username: `outsider_${Math.random().toString(36).slice(2, 8)}`,
      displayName: "Outsider",
      passwordHash: "x",
      createdAt: now,
    }
    await db.insert(users).values(outsider)
    signInAs(outsider)

    const resp = await POST(jsonRequest("POST"), {
      params: Promise.resolve({ id: workspace.id, projectId: project.id, taskId: task.id }),
    })

    expect(resp.status).toBe(403)
  })

  it("archiveTask writes an activity event (pins ADR-002 violation)", async () => {
    // ADR-002 (docs/adr/ADR-002-activity-log.md:12) requires every mutation —
    // including archive — to call logEvent with a "task_archived" ActivityType.
    // On this branch archiveTask() never calls logEvent and ActivityType has no
    // "task_archived" entry, so this test is EXPECTED TO FAIL.
    const { user, workspace, project, task } = await seedWorkspace()
    signInAs(user)

    await POST(jsonRequest("POST"), {
      params: Promise.resolve({ id: workspace.id, projectId: project.id, taskId: task.id }),
    })

    const events = await activityFor(task.id)
    const archivedEvents = events.filter((e) => e.type === "task_archived")
    expect(archivedEvents.length).toBeGreaterThan(0)
  })
})
