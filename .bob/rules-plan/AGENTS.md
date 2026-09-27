# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Non-obvious architectural constraints

- **Engine is stateless except for `_GRAPH_CACHE`** — the cache keyed on `(sha, source_root)` assumes the same SHA always produces the same graph. Any change to parser logic must invalidate this assumption.
- **MCP server runs via stdio transport** (launched by Bob from `.bob/mcp.json`), not HTTP. There is no persistent process to restart; Bob relaunches it per session.
- **Two separate test systems**: pytest for the Python engine (`blastradius/backend/tests/`); vitest for the TypeScript regression harness (`pulse/src/__regression__/`). They have no shared configuration.
- **The missed-caller detector compares argument texts** by position, not type — it detects reordered parameters by matching call-site argument strings against old vs. new parameter name order. This means it only catches positional changes, not type-only changes.
- **`seed_demo.sh` is idempotent** — it always `rm -rf demo-workspace/pulse` first. Anything written to that directory is destroyed on re-seed.
- **BlastRadius Reviewer mode** is write-restricted to `__regression__/*.test.ts`, `reviews/*.md`, and `demo-workspace/pulse/src/`. It must not edit `blastradius/backend/` or `pulse/` during a review.
- **Score thresholds differ by context**: CLI gate = 80 (`--fail-on 80` in CI); Bob reviewer protocol stop = 70; Bob reviewer protocol approval gate = 70. These are intentionally different.
- **watsonx.ai Granite** is optional — the entire review pipeline works without it. The summarizer is a narrative layer only; all evidence comes from the deterministic engine.
