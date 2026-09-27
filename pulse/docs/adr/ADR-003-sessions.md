# ADR-003: Session handling lives in one place

Status: Accepted
Applies to: auth

## Decision

- `getSession()` is the only way code reads the session. Never read the cookie directly.
- Any change that can invalidate existing sessions MUST be announced to support before release, because every signed-in user is affected at once.
