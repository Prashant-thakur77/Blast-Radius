# IBM Bob usage statement (under 500 words)

IBM Bob is the reviewer in BlastRadius. It does not assist from the side; the review runs inside Bob IDE.

How we use Bob in the product:
- **MCP server.** `.bob/mcp.json` registers the `blastradius` server (`blastradius/backend/app/mcp_server.py`). It gives Bob eight tools: analyze_pr, get_dependents, get_subsystem, find_untested, check_docs, run_tests, build_graph and summarize_review. Bob calls them to get the risk score, the dependents of every changed unit, callers left behind by a signature change, the ADRs in scope, and real test results.
- **Custom mode.** `.bob/custom_modes.yaml` defines BlastRadius Reviewer. It has read, MCP, skill, subagent, todo and execute tool groups. Edits are limited by a file regex to regression tests, review reports and fixes the human has approved.
- **Mode rules.** `.bob/rules-blast-radius-reviewer/01-review-protocol.md` sets evidence rules (every claim cites a file:line, an ADR line or a test result), stop conditions (score of 70 or more, or any missed caller), the subagent brief and the report format.
- **Skill.** `.bob/skills/blast-radius-review/SKILL.md` is the nine-step review procedure, reusable from any mode.
- **Subagents and parallel tasks.** For each risky subsystem Bob spawns a general subagent. Each one writes one vitest regression test with our harness and runs it through the MCP run_tests tool. On the hero PR, the comments subagent's test fails on the branch and passes after the fix Bob proposed and the human approved.
- **Document understanding.** Bob reads the team's ADRs (`pulse/docs/adr/`) and the architecture doc. It judges each rule as violated, respected or not applicable, citing the file and line. That is how it catches that the new archive route breaks ADR-002.
- **/init and AGENTS.md.** Bob wrote the project's AGENTS.md.
- **/review.** Bob reviewed the BlastRadius repo itself.
- **Bob Shell.** `.github/workflows/blastradius.yml` runs the CLI gate, then `bob run` with the same skill to write the review in CI.
- **.bobignore** keeps .env files, databases and node_modules out of Bob's reads.

Evidence: `bob_sessions/` holds a PNG of the consumption summary for every Bob task, named teamname_taskNN_description.png, with an index in `bob_sessions/README.md`.

Other tools we used: Claude Code wrote much of the review engine, the static site and the video pipeline. Chatterbox TTS generated the narration.

watsonx.ai: `blastradius/backend/app/review/granite.py` calls `ibm/granite-4-h-small` through the watsonx.ai chat API (Dallas) to write the one-paragraph review summary. It passes only the JSON evidence, with temperature 0, a fixed seed and a no-invention system prompt. Without credentials it uses a deterministic template, and the review never fails because the narrator did.
