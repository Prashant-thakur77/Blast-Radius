import { describe, it, expect } from "vitest"
import { db } from "@/db"
import { users } from "@/db/schema/users"
import { seedWorkspace, signInAs, jsonRequest } from "./harness"
import { PATCH } from "@/app/api/workspaces/[id]/route"

describe("workspace PATCH /api/workspaces/[id] (ADR-001 contract: getWorkspaceMember signature)", () => {
  it("returns 200 for an owner", async () => {
    const { user, workspace } = await seedWorkspace()
    signInAs(user)
    const resp = await PATCH(
      jsonRequest("PATCH", { name: "Renamed" }),
      { params: Promise.resolve({ id: workspace.id }) }
    )
    expect(resp.status).toBe(200)
  })

  it("returns 403 for a non-member", async () => {
    const { workspace } = await seedWorkspace()
    const now = new Date()
    const stranger = {
      id: `stranger_${Math.random().toString(36).slice(2, 8)}`,
      username: `stranger_${Math.random().toString(36).slice(2, 8)}`,
      displayName: "Stranger",
      passwordHash: "x",
      createdAt: now,
    }
    await db.insert(users).values(stranger)
    signInAs(stranger)
    const resp = await PATCH(
      jsonRequest("PATCH", { name: "Hijacked" }),
      { params: Promise.resolve({ id: workspace.id }) }
    )
    expect(resp.status).toBe(403)
  })
})
