# Tasks: archive tasks, and make getWorkspaceMember user-first

Adds POST /tasks/[taskId]/archive and archiveTask(). Also reorders getWorkspaceMember to (userId, workspaceId) to match the other user-first queries, and updates its callers.
