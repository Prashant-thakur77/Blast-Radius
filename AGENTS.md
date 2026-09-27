# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Repo layout (non-obvious)

This is a monorepo with two separate projects:
- `blastradius/backend/` — Python engine, MCP server, CLI (no frontend logic here)
- `pulse/` — Next.js 16 sample app used **only** as the review target; it is NOT the BlastRadius product
- `demo-workspace/pulse/` — git repo seeded by `scripts/seed_demo.sh` with three PR branches; vitest runs here, not in `pulse/`

The MCP server's `BLASTRADIUS_REPO` env var points to `demo-workspace/pulse` (see `.bob/mcp.json`), NOT the root repo.

## Commands

### Python engine (run from `blastradius/backend/`)
```bash
# Setup (one-time)
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt

# Seed demo workspace (required before engine tests)
./scripts/seed_demo.sh

# Run all engine tests
.venv/bin/pytest tests/test_review_engine.py

# Run a single engine test
.venv/bin/pytest tests/test_review_engine.py::test_missed_caller_is_found_with_file_and_line

# CLI review (exit 2 if score >= threshold)
.venv/bin/python -m app.cli review --repo ../../demo-workspace/pulse --head pr-3-task-archiving --fail-on 70

# MCP server (stdio, launched by Bob)
python -m app.mcp_server
```

### Pulse / regression tests (run from `pulse/` or `demo-workspace/pulse/`)
```bash
npm install          # in pulse/ — node_modules symlinked into demo-workspace/pulse
npx vitest run       # all tests
npx vitest run src/__regression__/tasks-auth.test.ts   # single file
npx vitest run -t "lets a workspace member"            # single test by name
```

## Critical architecture details

- **Engine is fully deterministic** — no DB, no LLM, no network. `build_graph_at()` uses an in-process `_GRAPH_CACHE`; the same `(sha, source_root)` tuple always returns the cached graph. Don't add side effects.
- **MCP server paths are absolute** in `.bob/mcp.json` — update them when cloning to a different path.
- **Granite summarizer** (`app/review/granite.py`) never fails the review — exceptions are caught and fall back to `template()`. Credentials: `WATSONX_APIKEY` + `WATSONX_PROJECT_ID` env vars.
- **CI gate** is score ≥ 80 OR missed callers (`.github/workflows/blastradius.yml`). The reviewer mode stop threshold is 70.

## Regression test harness (`pulse/src/__regression__/`)

- `setup.ts` sets `PULSE_DB_PATH=":memory:"` and mocks `getSession`. Every test gets a fresh in-memory SQLite with real drizzle migrations applied.
- `harness.ts` exports: `seedWorkspace()`, `signInAs(user)`, `jsonRequest(method, body?)`, `activityFor(taskId)`.
- New regression test files go in `src/__regression__/<subsystem>-<branch>.test.ts`.
- `vitest.config.ts` uses `pool: "forks"` and `testTimeout: 20000`. Tests import route handlers directly (no HTTP server).

## BlastRadius Reviewer mode

- Edits restricted to: `__regression__/*.test.ts`, `reviews/*.md`, `demo-workspace/pulse/src/**/*.tsx?`
- Protocol: stop for human approval if score ≥ 70 or `missed_callers` non-empty; never apply a fix without explicit approval.
- Review output written to `reviews/<branch>.md`.

## Subsystem naming

`app/review/subsystems.py` maps file paths to subsystem names deterministically. `src/features/<name>/` → `<name>`; `src/app/api/.../<resource>/` → resource from `API_RESOURCES` dict; `src/components/ui/` → `ui-kit`.

## Env vars

See `blastradius/backend/.env.example`. The engine, CLI and MCP server do NOT need `OPENAI_API_KEY`. Only watsonx Granite summarizer needs `WATSONX_APIKEY` + `WATSONX_PROJECT_ID`.
