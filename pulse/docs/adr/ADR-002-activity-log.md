# ADR-002: Task and comment mutations always write an activity event

Status: Accepted
Applies to: tasks, comments, activity

## Context

The activity feed is how teams audit who changed what. Users rely on it to reconstruct what happened to a task.

## Decision

- Every mutation of a task or a comment (create, update, move, archive, delete, edit) MUST call `logEvent` in the same request, after the mutation succeeds.
- New mutations MUST add their event type to `ActivityType` in `features/activity/types.ts`.
- `logEvent` never throws. Callers must not rely on it to validate anything.

## Consequences

A mutation without `logEvent` is invisible in the feed. Reviewers should reject it.
