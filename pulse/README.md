# Pulse

Pulse is a clean, modern team workspace app built as the primary testing repository for Blast Radius.

It is designed to be a realistic full-stack Next.js application with clear feature boundaries across authentication, workspaces, projects, tasks, comments, notifications, dashboard insights, search, and settings. The repository is intentionally structured and developed through incremental commits so its architecture can be parsed, embedded, clustered, and visualized over time.

## Purpose

Pulse is not just a demo UI. It is a deliberately designed application used to showcase:

- how a codebase evolves through commit history
- how Blast Radius builds structural graphs from source code
- how graph-aware agents can reason about architectural changes
- how pull requests can be analyzed beyond raw diffs

## Product concept

Pulse is a lightweight team workspace for managing:

- projects
- tasks
- comments
- notifications
- dashboard summaries
- search
- user and workspace settings

The product direction is inspired by modern internal tools and productivity software, but intentionally scoped to stay focused, understandable, and structurally clean.

## Tech stack

- Next.js (App Router)
- TypeScript
- Tailwind CSS
- shadcn/ui
- Lucide Icons
- Drizzle ORM
- SQLite
- Zod

## Design principles

This repository follows a few strict principles:

1. Incremental structure  
   New folders and modules are introduced only when the corresponding feature becomes real.

2. Clear feature boundaries  
   The codebase is organized so core product domains can form clean architectural clusters.

3. Realistic but scoped  
   Pulse should feel like a believable SaaS app without unnecessary complexity.

4. Graph-friendly evolution  
   The commit history is intentionally designed so system growth is visually and structurally meaningful.

## Planned feature map

- App shell and design system
- Authentication and current user flow
- Workspaces and member roles
- Project management
- Task management and assignee workflow
- Task comments and activity log
- Notifications inbox
- Dashboard insights
- Global search
- User settings and notification preferences

## Commit-driven development story

Pulse is developed in staged commits so Blast Radius can analyze how the system changes over time.

Planned mainline progression:

1. initialize app shell and design system
2. add authentication and current user flow
3. add workspaces and member roles
4. add project management
5. add task management and assignee workflow
6. add task comments and activity log
7. add notifications inbox and unread state
8. add dashboard insights and summary queries
9. add global search across projects and tasks
10. add user settings and notification preferences

Planned demo PR:

- add task due reminders and dashboard risk signals

This PR is intentionally designed to touch multiple system areas so Blast Radius can demonstrate graph-aware impact analysis.

## Repository role in Blast Radius

Pulse is the subject repository.

Blast Radius is the external system that:

- ingests this repository
- parses code entities
- generates descriptions
- creates embeddings
- clusters related code
- computes graph layouts
- analyzes commit history
- reasons about pull request impact

In other words:

- Pulse = the application being analyzed
- Blast Radius = the engine that understands it

## Status

This repository is being built incrementally for Blast Radius demos and project evaluation.

## License

TBD
