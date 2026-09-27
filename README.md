<div align="center">

<img src="docs/media/cover.png" alt="BlastRadius: review the blast radius, not the diff" width="820">

# BlastRadius

**Review the blast radius, not the diff.**

BlastRadius maps everything a pull request can break and hands that map to **IBM Bob**. Bob reviews in a custom mode, checks the team's ADRs, sends a subagent into each affected subsystem, then writes regression tests and runs them.

[Live demo](https://site-seven-zeta-33.vercel.app) · [Demo video](docs/media/BlastRadius_demo.mp4) · [Slides](submission/BlastRadius_slides.pdf) · [Bob session evidence](bob_sessions/README.md) · [Plan](docs/PLAN.md)

Built for the **IBM Bob 2.0 Hackathon** on lablab.ai · Workflow: **code review** · MIT licensed

</div>

---

<p align="center"><img src="docs/media/blast-radius-pr3.gif" alt="3D blast radius of PR-3: changed units in red, the caller left behind ringed" width="900"></p>

## In 30 seconds

- A pull request swaps the argument order of `getWorkspaceMember(workspaceId, userId)` and updates 17 of its 18 callers. Both arguments are strings, so TypeScript passes and CI is green. The one missed caller locks real members out of editing comments.
- BlastRadius scores that PR **95/100 (critical)** in under a second and points at the exact line: `comments/[commentId]/route.ts:18`.
- IBM Bob, in our **BlastRadius Reviewer** mode, stopped at the gate and sent **three subagents in parallel**. They wrote 7 regression tests; **2 failed** (`expected 403 to be 200`, and a missing activity event that breaks ADR-002). Bob proposed the fixes and applied them after approval, and **5 of 5** tests passed. You can watch it happen in the [demo video](docs/media/BlastRadius_demo.mp4).

## The problem

Code review happens on the diff. The damage a pull request does usually sits in code the diff doesn't show: callers in other subsystems, tests that don't exist, and team rules nobody re-read.

Our hero PR on the Pulse sample app adds task archiving and a small refactor. The refactor reorders `getWorkspaceMember` to `(userId, workspaceId)` and updates 17 call sites. The 18th, `comments/[commentId]/route.ts:18`, still passes `(workspaceId, user.id)`. It compiles, and every real member then gets a 403 when editing or deleting a comment. The same PR adds an archive endpoint that never writes to the activity log, breaking a written team rule (ADR-002).

The diff has 19 tidy files, and none of them points at either bug.

## What IBM Bob did with it (a recorded session)

<table>
<tr>
<td width="33%"><img src="docs/media/bob-pr3-gate.png" alt="Bob stops at risk 95 and reports the missed caller"></td>
<td width="33%"><img src="docs/media/bob-pr3-subagents.png" alt="Three subagents write regression tests in parallel"></td>
<td width="33%"><img src="docs/media/bob-pr3-tests-green.png" alt="All fixes applied, 5 of 5 tests green"></td>
</tr>
<tr>
<td>Risk 95. Bob stops and reports the missed caller before touching anything.</td>
<td>Three subagents (workspace, tasks, comments) each write a vitest test.</td>
<td>After the approved fixes, 5 of 5 tests pass.</td>
</tr>
</table>

Tests Bob's subagents wrote and ran on `pr-3-task-archiving`:

| Test file | Test | Before fix | After fix |
|---|---|---|---|
| `tasks-pr-3-task-archiving.test.ts` | archive returns 200 for member | ✅ | ✅ |
| `tasks-pr-3-task-archiving.test.ts` | archive returns 403 for non-member | ✅ | ✅ |
| `tasks-pr-3-task-archiving.test.ts` | archiveTask writes activity event | ❌ `expected 0 to be greater than 0` | ✅ |
| `comments-pr-3-task-archiving.test.ts` | PATCH returns 200 for comment author | ❌ `expected 403 to be 200` | ✅ |
| `comments-pr-3-task-archiving.test.ts` | DELETE returns 403 for non-member | ✅ | ✅ |
| `workspace-pr-3-task-archiving.test.ts` | PATCH returns 200 for owner | ✅ | not rerun |
| `workspace-pr-3-task-archiving.test.ts` | PATCH returns 403 for non-member | ✅ | not rerun |

Bob's full report is [`reviews/pr-3-task-archiving.md`](reviews/pr-3-task-archiving.md). The test files and the fixes it applied are in [`reviews/pr-3-task-archiving/`](reviews/pr-3-task-archiving/). Bob also noticed that `docs/ARCHITECTURE.md` still documents the old signature, and left it as a manual follow-up because the Reviewer mode is not allowed to edit docs.

## How it works

```mermaid
flowchart LR
  PR[PR branch] --> ENG[BlastRadius engine<br/>tree-sitter code graph]
  ENG --> MCP[blastradius MCP server<br/>8 tools]
  MCP --> MODE[IBM Bob<br/>BlastRadius Reviewer mode + skill]
  MODE --> S1[subagent: comments]
  MODE --> S2[subagent: workspace]
  MODE --> S3[subagent: tasks]
  S1 & S2 & S3 --> T[vitest regression tests<br/>real pass/fail]
  MODE --> ADR[docs/adr/*.md]
  T --> V[reviews/branch.md verdict]
  ADR --> V
  CI[GitHub Action: CLI gate + Bob Shell] --> MODE
```

1. **The engine** (`blastradius/backend/app/review/`) parses the base and head of a branch straight from git with tree-sitter. It needs no database, network or LLM. For the head it computes:
   - Changed units, and every dependent reached through reverse call and render edges.
   - The subsystems affected.
   - Signature changes, and **callers left behind**. For each caller the PR didn't update, it compares the call's arguments against the old and new parameter order.
   - Untested units, and the ADR and doc sections in scope. It flags a doc that still names a changed signature.
   - A 0–100 score in which every point has a written reason.
2. **The MCP server** (`app/mcp_server.py`) gives Bob 8 tools: `analyze_pr`, `get_dependents`, `get_subsystem`, `find_untested`, `check_docs`, `run_tests`, `build_graph`, `summarize_review`.
3. **Bob reviews.** The **BlastRadius Reviewer** custom mode, its protocol rules and the `blast-radius-review` skill tell Bob to:
   - Analyze the PR, and stop for a human at score 70 or more or when a caller was left behind.
   - Read the ADRs and judge each rule.
   - Send one subagent per risky subsystem to write and run a regression test.
   - Propose fixes, and apply them only after a yes.
4. **Granite writes the summary.** `app/review/granite.py` calls `ibm/granite-4-h-small` on watsonx.ai. It passes only the JSON evidence, with temperature 0, a fixed seed and a no-invention prompt. Without credentials it falls back to a template, so the review never fails because the narrator did.

### The score

| Factor | Max | What earns points |
|---|---:|---|
| reach | 25 | Dependents, weighted by distance, including callers the PR itself edited |
| spread | 15 | Number of subsystems touched |
| criticality | 15 | Changes to auth, session, membership or db code, or to a hub with 10+ callers |
| contract | 10 | Exported signature changes |
| missed_callers | 20 | Callers not updated for a changed signature |
| untested | 8 | Changed or directly affected units with no test |
| docs | 7 | ADR and doc sections in scope, plus doc drift |

Bands: under 30 low, 30–59 medium, 60–79 high, 80 and up critical.

## IBM Bob at the core

| Bob feature | Where | What it does in BlastRadius | Evidence |
|---|---|---|---|
| MCP server | `.bob/mcp.json`, `blastradius/backend/app/mcp_server.py` | Bob's map of the code: score, dependents, missed callers, ADRs, test runs | tasks 03–05 |
| Custom mode | `.bob/custom_modes.yaml` | **BlastRadius Reviewer**: read, MCP, skill, subagent and execute groups; edits limited to regression tests, review reports and approved fixes | tasks 03–05 |
| Mode rules | `.bob/rules-blast-radius-reviewer/01-review-protocol.md` | Evidence rules, stop conditions, subagent brief, report format | task 05 gate |
| Skill | `.bob/skills/blast-radius-review/SKILL.md` | The 9-step review procedure, reusable from any mode | tasks 03–05 |
| Parallel subagents | skill step 6 | One `general` subagent per risky subsystem; each writes and runs one test | task 05 |
| Document understanding | `pulse/docs/adr/*.md`, `check_docs` | Judges each ADR rule as violated, respected or not applicable, with the file and line | tasks 02, 05 |
| `/init` and AGENTS.md | `AGENTS.md`, `.bob/rules-{agent,ask,plan}/` | Written by Bob | task 01 |
| Code review | Agent mode | Bob reviewed the engine and listed edge cases, each with a line number, severity and fix | task 06 |
| PR authoring | Agent mode | Bob wrote the PR description for the hackathon work | task 07 |
| Bob Shell | `.github/workflows/blastradius.yml` | `bob run` writes the review in CI after the CLI gate | workflow file |
| `.bobignore` | `.bobignore` | Keeps `.env`, databases and `node_modules` out of Bob's reads | |

### Bob session evidence

Every task is listed with its screenshot in [`bob_sessions/README.md`](bob_sessions/README.md).

| Task | Mode | Result | Bobcoins |
|---|---|---|---:|
| 01 `/init` | Agent | Wrote `AGENTS.md` and three mode rule files | |
| 02 ADR checklist | Ask | Reviewer checklist from the architecture doc and three ADRs | 0.07 |
| 03 Review PR-1 | BlastRadius Reviewer | APPROVE, score 6 (low) | 0.30 |
| 04 Review PR-2 | BlastRadius Reviewer | APPROVE WITH NOTES, score 70 (high), 11 flows to click through | 0.62 |
| 05 Review PR-3 | BlastRadius Reviewer | REQUEST CHANGES, score 95, 3 subagents, 7 tests (2 red), fixes applied, 5/5 green | 3.24 |
| 06 Code review | Agent | Edge cases in `engine.py`, each with a line number, severity and fix | 0.22 |
| 07 PR description | Agent | PR description with an "IBM Bob features used" table | 0.35 |

Tasks 02 to 07 used about **4.8 Bobcoins** of the 40 available.

## Results on the seeded PRs

Measured with `scripts/export_site_data.py`. Every run gives the same numbers.

| PR | What it changes | Files in diff | Files in blast radius | Dependents | Subsystems | Score | Engine time |
|---|---|---:|---:|---:|---:|---:|---:|
| PR-1 | Dashboard copy | 1 | 2 | 1 | 1 | 6 low | ~0.9 s |
| PR-2 | `getSession` rejects tokens older than `SESSION_EPOCH` (3 lines) | 1 | 34 | 34 | 13 | 70 high | ~0.9 s |
| PR-3 | Task archiving + `getWorkspaceMember` argument swap | 19 | 20 | 19 | 9 | 95 critical | ~0.9 s |

Across the three PRs the diffs showed 21 files, and the blast radius covered 56.

## Quick start

```bash
git clone https://github.com/Prashant-thakur77/Blast-Radius.git && cd Blast-Radius

# 1. Engine (Python 3.10+)
cd blastradius/backend && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt && cd ../..

# 2. Sample app dependencies and the three seeded PR branches
(cd pulse && npm install) && ./scripts/seed_demo.sh

# 3. Review a branch from the command line (exit code 2 when the score is >= 70)
cd blastradius/backend && .venv/bin/python -m app.cli review \
  --repo ../../demo-workspace/pulse --head pr-3-task-archiving --fail-on 70
```

<p align="center"><img src="docs/media/cli.jpg" alt="CLI output for PR-3" width="820"></p>

**In IBM Bob IDE (2.0.2 or later):**
1. Open the repo and trust the workspace with `/permissions`.
2. The paths in `.bob/mcp.json` are absolute. Change them to your clone, then check that the `blastradius` MCP server shows as connected.
3. Switch the mode to **BlastRadius Reviewer**.
4. Ask: `Review branch pr-3-task-archiving. Use parallel subagents for the affected subsystems and run the regression tests they write.`

**Tests:**

```bash
cd blastradius/backend && .venv/bin/pytest tests/test_review_engine.py   # 11 engine tests
cd pulse && npx vitest run                                                # regression harness
```

**watsonx.ai (optional):** put `WATSONX_APIKEY`, `WATSONX_PROJECT_ID` and `WATSONX_URL=https://us-south.ml.cloud.ibm.com` in `blastradius/backend/.env`. The engine, CLI and MCP server need no API key.

## CI

`.github/workflows/blastradius.yml` runs on every pull request:
1. Runs the CLI and fails the check at score 80 or more, or when a caller was left behind.
2. Runs `bob run` with the same skill to write the review, when a `BOB_API_KEY` secret is set.
3. Posts one sticky PR comment, found by a hidden marker and updated on each push.

## Repo layout

| Path | What |
|---|---|
| `blastradius/backend/app/review/` | Review engine: `engine.py`, `subsystems.py`, `gitrefs.py`, `granite.py` |
| `blastradius/backend/app/mcp_server.py`, `app/cli.py` | MCP server for Bob; CLI for humans and CI |
| `blastradius/backend/app/services/parser/` | tree-sitter TypeScript/TSX parser (units and edges) |
| `blastradius/frontend/` | Next.js 3D graph explorer (older UI, uses the REST API) |
| `site/` | The live demo: 3D blast view and the three reports |
| `pulse/` | Our own sample app: ADRs in `docs/adr/`, vitest harness in `src/__regression__/` |
| `demo/prs/`, `scripts/seed_demo.sh` | The three seeded PRs as patches, and the script that builds `demo-workspace/pulse` |
| `.bob/`, `AGENTS.md`, `.bobignore` | Bob configuration |
| `reviews/` | Review reports, tests and fixes written by Bob |
| `bob_sessions/` | Screenshots of every Bob task, with an index |
| `video/` | Narration script, scenes, renderer, and the script that splices in Bob footage |
| `submission/` | lablab texts, slides, cover image |

## How the video was made

- **Narration:** Chatterbox TTS (`video/tts.py`).
- **Scenes:** `video/scenes.html` renders the real Pulse graph with three.js. Playwright captures it frame by frame in Chromium (`video/render.py`).
- **Bob footage:** `video/splice_bob.py` cuts the recorded session into the PR-3 section.
- **Audio:** ffmpeg ducks the music under the voice and mixes to −14 LUFS.

The result is 2:51.

## What existed before the hackathon, and what we built during it

The git history starts with an **Initial commit**: the code as it stood before the event. That was the TypeScript parser, the REST API with per-commit graph snapshots, and the Next.js 3D explorer running on OpenAI. Every later commit was made during the event:
- the review engine and missed-caller detector
- the MCP server and everything in `.bob/`
- the seeded PRs, ADRs and vitest harness
- the CLI, the Granite summarizer and the CI workflow
- the site and the video
- Bob's own work: `AGENTS.md`, the reviews, the tests and the fixes

We also removed an earlier agent integration for another platform and a hardcoded key.

**Tools we used:** IBM Bob IDE ran the reviews, wrote `AGENTS.md`, reviewed the engine and wrote the PR description; `bob_sessions/` has each task. We also used Claude Code to write much of the engine, the site and the video pipeline.

## Data and licenses

- Pulse is a sample app we wrote. It contains no user data.
- Music: "Inspired" by Kevin MacLeod (incompetech.com), licensed under Creative Commons: By Attribution 4.0 (https://creativecommons.org/licenses/by/4.0/).
- Narration: Chatterbox TTS by Resemble AI (MIT), with its default voice.
- Fonts: EB Garamond, Figtree and JetBrains Mono (SIL Open Font License), via Google Fonts.
- three.js (MIT) is vendored in `site/vendor/`.
- The site's colors and type take their cue from the Wispr Flow website. No assets were copied.

BlastRadius is MIT licensed. See [LICENSE](LICENSE).
