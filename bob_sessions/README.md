# Bob session evidence

Each row is one IBM Bob IDE task. The PNG is the task's consumption summary: in Bob IDE, open Tasks, pick the task, and click its header. Prompts are in [TASKS.md](TASKS.md).

| # | Bob feature shown | Mode | What Bob did | Screenshot | Coins |
|---|---|---|---|---|---:|
| 01 | `/init`, AGENTS.md | Agent | Wrote `AGENTS.md` and the per-mode rules | `TEAM_task01_init_agents_md.png` | |
| 02 | Document understanding | Ask | Read the architecture doc and the three ADRs and turned them into a reviewer checklist | `TEAM_task02_adr_rules_checklist.png` | |
| 03 | Custom mode, skill, MCP | BlastRadius Reviewer | Reviewed PR-1 (score 6) and approved it without subagents | `TEAM_task03_review_pr1_low_risk.png` | |
| 04 | Custom mode, MCP, ADR check | BlastRadius Reviewer | Reviewed PR-2 (score 70): 24 direct callers of `getSession`; applied ADR-003; listed the flows to test | `TEAM_task04_review_pr2_hidden_ripple.png` | |
| 05 | Parallel subagents, executed tests, human gate | BlastRadius Reviewer | Reviewed PR-3 (score 95): stopped on the missed caller; spawned subagents that wrote and ran regression tests (red); flagged ADR-002; applied the approved fixes; reran the tests (green) | `TEAM_task05_review_pr3_subagents_tests.png` | |
| 06 | Code review | Agent | `/review` on the BlastRadius repo | `TEAM_task06_bob_code_review.png` | |
| 07 | Commit and PR text | Agent | Wrote the commit message and PR description for the hackathon changes | `TEAM_task07_commit_and_pr_text.png` | |

Review reports that Bob wrote are in `reviews/`. Exported task transcripts, scrubbed of keys, are in `exports/`.
