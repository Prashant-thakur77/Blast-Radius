# Bob IDE tasks for the BlastRadius submission

Run these in **Bob IDE 2.0.2 or later**, with `/home/prashant/blastradius` open as the workspace.

## Before you start
1. Settings → General: pick the **hackathon** Bob account, not a personal one.
2. Trust the workspace with `/permissions`. Untrusted folders switch off `.bob/` modes, skills and MCP.
3. Settings → MCP: check that the `blastradius` server shows as connected. It is defined in `.bob/mcp.json`.
4. Run `./scripts/seed_demo.sh` once in a terminal. It builds `demo-workspace/pulse` with the three PR branches.

## After each task
1. Open **Tasks** in the Bob chat and pick the task. Choose "All" if it isn't listed.
2. Click the **task header** to show the consumption summary.
3. Screenshot it as a PNG and save it in this folder with the filename shown below.

Replace `TEAM` with your lablab team name. Start a new task each time; that keeps the context small and the coins low.

| # | Mode | Prompt (paste exactly) | Screenshot filename | Coins |
|---|------|------------------------|---------------------|-------|
| 01 | Agent | `/init` | `TEAM_task01_init_agents_md.png` | 1–2 |
| 02 | Ask | `Read @pulse/docs/ARCHITECTURE.md and every file in @pulse/docs/adr. List each rule a pull request could break, with the ADR file and line, as a checklist a reviewer can use.` | `TEAM_task02_adr_rules_checklist.png` | ~1 |
| 03 | BlastRadius Reviewer | `Review branch pr-1-dashboard-copy.` | `TEAM_task03_review_pr1_low_risk.png` | 1–2 |
| 04 | BlastRadius Reviewer | `Review branch pr-2-session-epoch. Tell me which user flows to click through before release.` | `TEAM_task04_review_pr2_hidden_ripple.png` | 2–3 |
| 05 | BlastRadius Reviewer | `Review branch pr-3-task-archiving. Use parallel subagents for the affected subsystems and run the regression tests they write.` When Bob proposes fixes, answer `Yes, apply both fixes and rerun the tests.` | `TEAM_task05_review_pr3_subagents_tests.png` | 4–6 |
| 06 | Agent | `/review` | `TEAM_task06_bob_code_review.png` | 1–2 |
| 07 | Agent | `Write a commit message and a PR description for the current changes in this repo.` | `TEAM_task07_commit_and_pr_text.png` | ~0.5 |

**Record task 05 on screen**, 60–180 seconds at 1080p. That footage is the heart of the video. On GNOME, press Ctrl+Shift+Alt+R to start and stop; the file lands in `~/Videos/Screencasts/`.

With teammates, split the tasks. Every member must have at least one screenshot of their own.

After the tasks, also export each task (Tasks → Export) as markdown into `bob_sessions/exports/`. Search the exports for keys before committing.
