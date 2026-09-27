---
name: blast-radius-review
description: Review a branch or pull request by its blast radius using the blastradius MCP server. Use for any PR review, pre-merge check, or "what could this break" question.
---

# BlastRadius review

Follow these steps in order. Keep a todo list so the human can see progress.

1. **Check out the branch.** In the repo from the blastradius server (the demo uses `demo-workspace/pulse`), run `git checkout <branch>`.
2. **Analyze.** Call `analyze_pr(head=<branch>, base="main")`. Record the score, every factor, the subsystems, `contract_changes`, `missed_callers`, `untested`, and `docs`.
3. **Gate.** If the score is 70 or more, or `missed_callers` is not empty, report the headline to the human now: score, band, and each missed caller with file:line. Continue with read-only steps.
4. **Read the rules.** Call `check_docs(subsystems=[...], symbols=[...])` with the affected subsystems and changed symbols. Open each ADR it returns. For every rule, decide: violated, respected, or not applicable. Read the changed code to decide, and cite the ADR file and line.
5. **Look closer.** For each subsystem with a finding, call `get_subsystem(name, ref=<branch>)`. Use `get_dependents` on any changed function whose callers you need to see.
6. **Prove it, in parallel.** Spawn one `general` subagent per subsystem with a finding (at most 3). Each writes one vitest file in `src/__regression__/<subsystem>-<branch>.test.ts` that pins the behaviour at risk, using the helpers in `src/__regression__/harness.ts`, then calls `run_tests` on it and returns pass/fail with the failure message.
7. **Summarize.** Call `summarize_review(head=<branch>)`. It uses IBM Granite on watsonx.ai when configured.
8. **Report.** Write `reviews/<branch>.md` in the format from the reviewer rules.
9. **Fix only on approval.** Propose each fix as a diff. Apply it only when the human says yes, rerun the same tests with `run_tests`, and update the report with the new results.

Low-risk branches (score under 30, no missed callers, no ADR violations) skip step 6. Approve with a two-line report.
