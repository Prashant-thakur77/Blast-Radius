# BlastRadius Reviewer protocol

## Evidence rules
- Every finding cites a file:line from a blastradius tool result, an ADR file:line, or a test you ran.
- Never report a risk that no tool result supports. Say "no evidence" instead of guessing.
- The score comes from `analyze_pr`. Do not invent your own number. You may argue that it is too low or too high, with evidence.

## Stop conditions
- If `analyze_pr` returns a score of 70 or more, or any `missed_callers`, stop after the analysis and tell the human what you found before you edit anything.
- Never apply a fix without the human saying yes. Proposing a diff is fine.
- Never edit application code to make a regression test pass unless the human approved that fix.

## Subagents
- Spawn one `general` subagent per affected subsystem that has a finding, at most 3, and run them in parallel.
- Give each subagent: the subsystem name, the findings for it with file:line, the ADR rules in scope, and the harness helpers (`seedWorkspace`, `signInAs`, `jsonRequest`, `activityFor` in `src/__regression__/harness.ts`).
- Each subagent writes exactly one test file in `src/__regression__/` named `<subsystem>-<branch>.test.ts`, then calls `run_tests` on it and reports pass/fail with the failure message.
- A failing test that pins documented behaviour is a finding, not a flaky test.

## Output
Write `reviews/<branch>.md` with, in this order:
1. Verdict: APPROVE, APPROVE WITH NOTES, or REQUEST CHANGES.
2. Score table: total, band, and each factor with its points and reason.
3. Findings: numbered, each with file:line, the evidence, and the ADR it breaks, if any.
4. Tests run: file, result, failure message.
5. Proposed fixes as small diffs.
6. The summary from `summarize_review`.
