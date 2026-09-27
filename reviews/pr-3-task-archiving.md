# Review: pr-3-task-archiving

## Verdict: APPROVE WITH NOTES *(after fixes applied)*

Two blocking defects were found, both confirmed by failing regression tests, and both fixed and verified green.

---

## Score

| Factor | Points | Max | Reason |
|---|---|---|---|
| reach | 25 | 25 | 19 dependent units (18 of them edited in this PR) |
| spread | 15 | 15 | 9 subsystems touched |
| criticality | 15 | 15 | Changes `getWorkspaceMember`, hot-path of 17 route files |
| contract | 10 | 10 | 1 exported signature reordered |
| missed_callers | 15 | 20 | 1 caller not updated for changed signature |
| untested | 8 | 8 | 19 changed/affected units had no test before this PR |
| docs | 7 | 7 | 5 ADR/doc sections in scope; doc names the changed signature |
| **total** | **95** | **100** | **critical** |

---

## Findings

### Finding 1 — SECURITY: Missed caller leaves authorization broken (comments route) [BLOCKING]

- **File:** [`src/app/api/workspaces/[id]/projects/[projectId]/tasks/[taskId]/comments/[commentId]/route.ts:18`](demo-workspace/pulse/src/app/api/workspaces/[id]/projects/[projectId]/tasks/[taskId]/comments/[commentId]/route.ts:18)
- **Evidence:** The PR reordered `getWorkspaceMember`'s parameters from `(workspaceId, userId)` to `(userId, workspaceId)` ([`queries.ts:76`](demo-workspace/pulse/src/features/workspace/queries.ts:76)). 17 of 18 callers were updated; this file still calls `getWorkspaceMember(workspaceId, user.id)` with the **old** order. With the arguments swapped the DB query runs `WHERE workspaceId = user.id AND userId = workspaceId`, which never matches, so every workspace member is rejected with **403** and comment edits/deletes are completely broken for all users.
- **ADR violated:** [ADR-001:14](demo-workspace/pulse/docs/adr/ADR-001-workspace-authorization.md:14) — "Argument order is part of the contract. Changing it requires updating every caller in the same PR."
- **Confirmed by:** `comments-pr-3-task-archiving.test.ts` — test "comment PATCH returns 200 for the comment author (workspace member)" **FAILS** with `expected 403 to be 200`.

### Finding 2 — COMPLIANCE: `archiveTask` writes no activity event (ADR-002 violation) [BLOCKING]

- **File:** [`src/features/tasks/mutations.ts:64`](demo-workspace/pulse/src/features/tasks/mutations.ts:64)
- **Evidence:** `archiveTask()` sets `status: "archived"` but never calls `logEvent`. The `ActivityType` union ([`features/activity/types.ts:1`](demo-workspace/pulse/src/features/activity/types.ts:1)) has no `"task_archived"` entry.
- **ADR violated:**
  - [ADR-002:12](demo-workspace/pulse/docs/adr/ADR-002-activity-log.md:12) — "Every mutation of a task (create, update, move, **archive**, delete, edit) MUST call `logEvent` in the same request, after the mutation succeeds."
  - [ADR-002:13](demo-workspace/pulse/docs/adr/ADR-002-activity-log.md:13) — "New mutations MUST add their event type to `ActivityType`."
- **Confirmed by:** `tasks-pr-3-task-archiving.test.ts` — test "archiveTask writes an activity event (pins ADR-002 violation)" **FAILS** with `expected 0 to be greater than 0`.

### Finding 3 — DOCUMENTATION DRIFT: `docs/ARCHITECTURE.md` still documents old signature [INFORMATIONAL]

- **File:** [`docs/ARCHITECTURE.md:11`](demo-workspace/pulse/docs/ARCHITECTURE.md:11)
- **Evidence:** Architecture doc still reads `getWorkspaceMember(workspaceId, userId)` after the parameter order was reversed.
- ADR-001:14 requires callers to be updated; the same discipline applies to docs that name the signature.

---

## Tests Run

### Before fixes (original branch)

| File | Test | Result | Failure |
|---|---|---|---|
| `src/__regression__/tasks-pr-3-task-archiving.test.ts` | archive route returns 200 for a workspace member | ✅ PASS | — |
| `src/__regression__/tasks-pr-3-task-archiving.test.ts` | archive route returns 403 for a non-member | ✅ PASS | — |
| `src/__regression__/tasks-pr-3-task-archiving.test.ts` | archiveTask writes an activity event (pins ADR-002 violation) | ❌ FAIL | `expected 0 to be greater than 0` at `tasks-pr-3-task-archiving.test.ts:57` |
| `src/__regression__/workspace-pr-3-task-archiving.test.ts` | workspace PATCH returns 200 for an owner | ✅ PASS | — |
| `src/__regression__/workspace-pr-3-task-archiving.test.ts` | workspace PATCH returns 403 for a non-member | ✅ PASS | — |
| `src/__regression__/comments-pr-3-task-archiving.test.ts` | comment PATCH returns 200 for the comment author | ❌ FAIL | `expected 403 to be 200` at `comments-pr-3-task-archiving.test.ts:45` |
| `src/__regression__/comments-pr-3-task-archiving.test.ts` | comment DELETE returns 403 for a non-member | ✅ PASS | — |

### After fixes (all 5 tests green — `vitest run` 2 files, 5 tests, 0 failures)

| File | Test | Result |
|---|---|---|
| `src/__regression__/tasks-pr-3-task-archiving.test.ts` | archive route returns 200 for a workspace member | ✅ PASS |
| `src/__regression__/tasks-pr-3-task-archiving.test.ts` | archive route returns 403 for a non-member | ✅ PASS |
| `src/__regression__/tasks-pr-3-task-archiving.test.ts` | archiveTask writes an activity event | ✅ PASS |
| `src/__regression__/comments-pr-3-task-archiving.test.ts` | comment PATCH returns 200 for the comment author | ✅ PASS |
| `src/__regression__/comments-pr-3-task-archiving.test.ts` | comment DELETE returns 403 for a non-member | ✅ PASS |

---

## Proposed Fixes

### Fix 1 — Swap arguments in the missed caller (Finding 1)

```diff
--- a/src/app/api/workspaces/[id]/projects/[projectId]/tasks/[taskId]/comments/[commentId]/route.ts
+++ b/src/app/api/workspaces/[id]/projects/[projectId]/tasks/[taskId]/comments/[commentId]/route.ts
@@ -15,7 +15,7 @@
   const user = await getUserById(session.sub)
   if (!user) return null

-  const member = await getWorkspaceMember(workspaceId, user.id)
+  const member = await getWorkspaceMember(user.id, workspaceId)
   if (!member) return null
```

### Fix 2 — Add `"task_archived"` to `ActivityType` and call `logEvent` in `archiveTask` route (Finding 2)

The mutation itself (`archiveTask`) does not have access to the full activity context (workspaceId, projectId, actorUserId). The call to `logEvent` belongs in the API route handler that already has all that context, matching the pattern used by every other mutation in this codebase.

**Step A — add the type:**
```diff
--- a/src/features/activity/types.ts
+++ b/src/features/activity/types.ts
@@ -1,6 +1,7 @@
 export type ActivityType =
   | "task_created"
   | "task_status_changed"
   | "task_assignee_changed"
+  | "task_archived"
   | "comment_edited"
   | "comment_deleted"
```

**Step B — call `logEvent` in the archive route after `archiveTask` succeeds:**
```diff
--- a/src/app/api/workspaces/[id]/projects/[projectId]/tasks/[taskId]/archive/route.ts
+++ b/src/app/api/workspaces/[id]/projects/[projectId]/tasks/[taskId]/archive/route.ts
@@ -1,6 +1,7 @@
 import { NextResponse } from "next/server"
 import { getSession } from "@/features/auth/session"
 import { getUserById } from "@/features/auth/queries"
 import { getWorkspaceMember } from "@/features/workspace/queries"
 import { getTaskById } from "@/features/tasks/queries"
 import { archiveTask } from "@/features/tasks/mutations"
+import { logEvent } from "@/features/activity/log-event"
 
@@ -34,6 +35,14 @@
     await archiveTask(taskId)
+
+    await logEvent({
+      workspaceId: id,
+      projectId,
+      taskId,
+      actorUserId: user.id,
+      type: "task_archived",
+      payload: { taskTitle: task.title },
+    })
+
     return NextResponse.json({ ok: true })
```

### Fix 3 — Update ARCHITECTURE.md signature reference (Finding 3) ⚠️ MANUAL

`docs/ARCHITECTURE.md:11` still documents the old `(workspaceId, userId)` signature.
The reviewer mode's file-path restriction prevents editing `docs/` files directly.
**Action required:** update line 11 to read `getWorkspaceMember(userId, workspaceId)` before merging.

```diff
-  - `getWorkspaceMember(workspaceId, userId)` in `features/workspace/queries.ts` ...
+  - `getWorkspaceMember(userId, workspaceId)` in `features/workspace/queries.ts` ...
```

---

## Summary

Risk 95/100 (critical): 20 changed units reach 1 dependent across 9 subsystems.
[`comments/[commentId]/route.ts:18`](demo-workspace/pulse/src/app/api/workspaces/[id]/projects/[projectId]/tasks/[taskId]/comments/[commentId]/route.ts:18) was not updated: arguments `(workspaceId, user.id)` still match the old order `(workspaceId, userId)`; new order is `(userId, workspaceId)`.
`getWorkspaceMember` changed signature `(workspaceId, userId) → (userId, workspaceId)` with 18 callers.
Largest factor: reach (19 dependent units, 18 of them edited in this PR).
