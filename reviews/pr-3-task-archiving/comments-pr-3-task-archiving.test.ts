/**
 * Regression tests for the comments subsystem — PR-3 task-archiving.
 *
 * Finding: `comments/[commentId]/route.ts:18` calls
 *   getWorkspaceMember(workspaceId, user.id)   ← OLD (wrong) argument order
 * The updated signature is getWorkspaceMember(userId, workspaceId).
 *
 * Effect:
 *   - Real members get 403 (their lookup returns null with swapped args).
 *   - Non-members whose id happens to match nothing still get 403, but for
 *     the wrong reason — the membership guard is broken for everyone.
 *
 * Test 1 (SHOULD FAIL on this branch): member PATCH returns 200.
 * Test 2 (SHOULD PASS):                non-member DELETE returns 403.
 */
import { describe, it, expect } from "vitest"
import { db } from "@/db"
import { users } from "@/db/schema/users"
import { seedWorkspace, signInAs, jsonRequest } from "./harness"
import {
  PATCH,
  DELETE,
} from "@/app/api/workspaces/[id]/projects/[projectId]/tasks/[taskId]/comments/[commentId]/route"

describe("comments route — PR-3 swapped-argument regression", () => {
  it("comment PATCH returns 200 for the comment author (workspace member)", async () => {
    // Seed: user is both a workspace owner and the comment author.
    const { user, workspace, project, task, comment } = await seedWorkspace()
    signInAs(user)

    const resp = await PATCH(
      jsonRequest("PATCH", { body: "updated text" }),
      {
        params: Promise.resolve({
          id: workspace.id,
          projectId: project.id,
          taskId: task.id,
          commentId: comment.id,
        }),
      }
    )

    // With the bug (swapped args) the membership check returns null → 403.
    // The correct behaviour is 200.
    expect(resp.status).toBe(200)
  })

  it("comment DELETE returns 403 for a non-member", async () => {
    // Seed a workspace with its own user/comment.
    const { workspace, project, task, comment } = await seedWorkspace()

    // Create a second user who has NO membership in that workspace.
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

    const resp = await DELETE(
      jsonRequest("DELETE"),
      {
        params: Promise.resolve({
          id: workspace.id,
          projectId: project.id,
          taskId: task.id,
          commentId: comment.id,
        }),
      }
    )

    // Non-member must always be rejected with 403.
    expect(resp.status).toBe(403)
  })
})
