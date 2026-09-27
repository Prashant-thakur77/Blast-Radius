# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Non-obvious coding rules

- **Never import from `app.review.engine` inside the MCP tool functions** — use the module-level helpers (`engine.analyze_refs`, `engine.build_graph_at`). The `_GRAPH_CACHE` dict is in-process; re-importing a submodule bypasses it.
- **`from __future__ import annotations`** is required at the top of every Python file in `app/` — the codebase uses it uniformly for forward references.
- **Tree-sitter parsers are module-level singletons** (`_ts_parser`, `_tsx_parser` in `engine.py`). Do not instantiate new parsers in hot paths.
- **`subsystem_for(path)`** must be the sole source of subsystem names — never hardcode a subsystem string in tests or reports.
- **Regression test files** must be named `src/__regression__/<subsystem>-<branch>.test.ts` and use `seedWorkspace()` / `signInAs()` / `jsonRequest()` from `harness.ts`. They call route handlers directly, not via HTTP.
- **`PULSE_DB_PATH=":memory:"` is set in `setup.ts`** (setupFiles), so `src/db/index.ts` uses an in-memory SQLite. Do not set this env var elsewhere in tests.
- **`demo-workspace/pulse/`** shares `node_modules` via a symlink to `pulse/node_modules` (created by `seed_demo.sh`). Never run `npm install` inside `demo-workspace/pulse/`.
- **CLI exit codes**: 0 = ok, 2 = score ≥ threshold or missed callers, 1 = unhandled exception.
- **Granite summarizer** must never raise — always catch exceptions and return `template(report)` as fallback.
