# ADR-001: Every workspace route authorizes membership first

Status: Accepted
Applies to: workspace, projects, tasks, comments, notifications, activity, search

## Context

All data in Pulse belongs to a workspace. A bug in one route's authorization leaks or blocks data for real users.

## Decision

- Every API route under `/api/workspaces/[id]` MUST call `getWorkspaceMember(workspaceId, userId)` before it reads or writes any workspace data.
- A missing membership MUST return 403, never 404 and never data.
- Argument order is part of the contract. Changing it requires updating every caller in the same PR and a test for at least one route per subsystem.

## Consequences

`getWorkspaceMember` is on the hot path of 17 route files. Treat any change to it as high risk.
