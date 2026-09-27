# Bob session evidence

Each row is one IBM Bob IDE task. The PNG is the task's consumption summary: in Bob IDE, open Tasks, pick the task, and click its header. Prompts are in [TASKS.md](TASKS.md).

| # | Bob feature shown | Mode | What Bob did | Screenshot | Coins |
|---|---|---|---|---|---:|
| 01 | `/init`, AGENTS.md | Agent | Wrote `AGENTS.md` plus `.bob/rules-agent`, `rules-ask`, `rules-plan` | `blastradius_task01_init_agents_md.png` | |
| 02 | Document understanding | Ask | Read the architecture doc and the three ADRs and turned them into a reviewer checklist with file:line references | `blastradius_task02_adr_rules_checklist.png`, `_2.png` | 0.07 |
| 03 | Custom mode, skill, MCP | BlastRadius Reviewer | Reviewed PR-1: APPROVE, score 6/100 (low), no subagents needed | `blastradius_task03_review_pr1_low_risk.png`, `_2.png` | 0.30 |
| 04 | Custom mode, MCP, ADR check | BlastRadius Reviewer | Reviewed PR-2: APPROVE WITH NOTES, score 70/100 (high); stopped at the gate; ADR-003 applies; listed 11 user flows to click through. Two network errors from Bob's model service (ETIMEDOUT, ECONNRESET) were resumed with a follow-up message | `blastradius_task04_review_pr2_hidden_ripple.png`, `_2.png` | 0.62 |
| 05 | Parallel subagents, executed tests, human gate | BlastRadius Reviewer | Reviewed PR-3: score 95/100 (critical); stopped on the missed caller; 3 subagents (workspace, tasks, comments) wrote 7 vitest tests, 2 failed (`expected 403 to be 200`; `archiveTask writes activity event`); flagged ADR-001 and ADR-002 and the stale ARCHITECTURE.md line; applied the approved fixes; 5/5 tests green. Screen recording is cut into the demo video | `blastradius_task05_review_pr3_subagents_tests.png` | |
| 06 | Code review | Agent | `/review` on the BlastRadius repo | `blastradius_task06_bob_code_review.png` | |
| 07 | Commit and PR text | Agent | Wrote the commit message and PR description for the hackathon changes | `blastradius_task07_commit_and_pr_text.png` | |

Review reports that Bob wrote are in `reviews/`. The three regression tests Bob's subagents wrote for PR-3, and the fixes it applied, are in `reviews/pr-3-task-archiving/`.
