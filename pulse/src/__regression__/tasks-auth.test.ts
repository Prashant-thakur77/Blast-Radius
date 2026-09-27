import { describe, it, expect } from "vitest"
import { seedWorkspace, signInAs } from "./harness"
import { GET } from "@/app/api/workspaces/[id]/projects/[projectId]/tasks/route"

describe("tasks route authorization (ADR-001)", () => {
  it("lets a workspace member list tasks", async () => {
    const { user, workspace, project } = await seedWorkspace()
    signInAs(user)
    const res = await GET(new Request("http://test.local"), { params: Promise.resolve({ id: workspace.id, projectId: project.id }) })
    expect(res.status).toBe(200)
  })

  it("rejects a signed-in user who is not a member", async () => {
    const { workspace, project } = await seedWorkspace()
    const { user: stranger } = await seedWorkspace()
    signInAs(stranger)
    const res = await GET(new Request("http://test.local"), { params: Promise.resolve({ id: workspace.id, projectId: project.id }) })
    expect(res.status).toBe(403)
  })
})
