# Pulse architecture

Pulse is a small team task manager: workspaces contain projects, projects contain tasks, tasks have comments. It is the sample app BlastRadius reviews in its demo.

## Layers

- `src/app/api/**/route.ts`: HTTP handlers. Each one authorizes the caller, validates input with zod, calls a feature mutation or query, then records side effects.
- `src/features/<name>/`: one folder per domain (auth, workspace, projects, tasks, comments, activity, notifications, search, settings, dashboard). Queries and mutations live here.
- `src/db/`: drizzle schema and the SQLite connection.

## Key functions

- `getSession()` in `features/auth/session.ts` reads and verifies the session cookie. Every API route and the app layout call it.
- `getWorkspaceMember(workspaceId, userId)` in `features/workspace/queries.ts` returns the caller's membership row, or undefined. Routes treat undefined as 403.
- `logEvent(params)` in `features/activity/log-event.ts` writes one row to `activity_events`. It swallows errors so a logging failure never breaks a request.
- `notifyTaskStatusChanged`, `notifyTaskAssigned`, `notifyTaskCommented` in `features/notifications/notify.ts` fan out notifications.

## Decisions

See `docs/adr/`. Reviewers check every PR against these.
