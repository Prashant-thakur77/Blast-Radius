# BlastRadius design

This document explains how BlastRadius is built and why: the architecture, the review flow with IBM Bob, the engine, the score, CI, the demo setup, and the plan we followed. Every diagram is also in [`docs/diagrams/`](diagrams/). There are Mermaid sources (`.mmd`), rendered images (`.svg` and `.png`), and an editable draw.io file ([`blastradius.drawio`](diagrams/blastradius.drawio)).

## Principles

1. **Evidence is deterministic.** The engine parses git refs with tree-sitter and computes impact without a database, network or LLM. The same branch always gives the same report.
2. **Bob decides and proves.** Bob gets the evidence through MCP, judges it against the team's ADRs, and proves each finding with a test it writes and runs.
3. **A human approves.** Bob stops at a score of 70 or more, or when a caller was left behind. It changes application code only after a yes.
4. **Every claim cites something.** A finding points to a file and line, an ADR line, or a test result.

## 1. System architecture

![System architecture](diagrams/01-architecture.svg)

```mermaid
flowchart LR
  dev([Developer / reviewer])
  subgraph BOB[IBM Bob IDE]
    mode[BlastRadius Reviewer<br/>custom mode]
    skill[blast-radius-review<br/>skill]
    rules[review protocol<br/>rules]
    subs[parallel subagents<br/>one per subsystem]
  end
  subgraph BR[BlastRadius]
    mcp[MCP server<br/>8 tools, stdio]
    eng[Review engine<br/>score, ripple, missed callers]
    parser[tree-sitter parser<br/>units and edges]
    cli[CLI<br/>--json, --fail-on]
    granite[Granite summary<br/>watsonx.ai, optional]
  end
  subgraph REPO[Target repo]
    git[(git refs<br/>main + PR branch)]
    adr[docs/adr/*.md]
    tests[vitest regression<br/>harness]
  end
  subgraph CI[GitHub Actions]
    gate[CLI gate]
    shell[Bob Shell<br/>bob run]
  end
  site[Live demo site<br/>3D blast view]

  dev -->|"review branch X"| mode
  mode --> skill --> rules
  mode <-->|MCP| mcp
  mcp --> eng --> parser --> git
  eng --> adr
  mcp -->|run_tests| tests
  mode --> subs -->|write + run| tests
  mcp --> granite
  cli --> eng
  gate --> cli
  shell --> mode
  eng -. exported reports .-> site
```

The **engine** is a Python library (`blastradius/backend/app/review/`). Three front doors share it:
- the **MCP server**, which Bob uses (`app/mcp_server.py`)
- the **CLI**, for people and CI (`app/cli.py`)
- the **site exporter**, which feeds the live demo (`scripts/export_site_data.py`)

## 2. Review flow with IBM Bob

This is the sequence Bob followed in the recorded review of PR-3.

![Review flow](diagrams/02-review-flow.svg)

```mermaid
sequenceDiagram
  actor H as Reviewer
  participant B as Bob (Reviewer mode)
  participant M as blastradius MCP
  participant E as Engine
  participant S as Subagents x3
  participant T as vitest
  H->>B: Review branch pr-3-task-archiving
  B->>M: analyze_pr(head)
  M->>E: parse main + branch, diff, ripple, score
  E-->>M: score 95, missed caller route.ts:18, ADRs in scope
  M-->>B: JSON evidence
  B-->>H: STOP: risk 95 + missed caller
  H->>B: Continue
  B->>M: check_docs, get_subsystem
  B->>S: spawn workspace, tasks, comments
  S->>T: write + run one test each
  T-->>S: 2 failures (403, no activity event)
  S-->>B: results with failure messages
  B-->>H: findings + proposed fixes
  H->>B: Yes, apply both fixes
  B->>T: rerun affected tests
  T-->>B: 5 / 5 pass
  B->>B: write reviews/pr-3-task-archiving.md
```

## 3. Engine pipeline

![Engine pipeline](diagrams/03-engine-pipeline.svg)

```mermaid
flowchart TB
  A[git archive base + head<br/>cached by commit sha] --> B[tree-sitter parse<br/>units: function, component, hook, api_handler<br/>edges: calls, renders, http_calls]
  B --> C[changed units<br/>added / modified / deleted by code hash]
  C --> D[ripple<br/>BFS over reverse edges, depth 3]
  C --> E[contract changes<br/>parameter lists before vs after]
  E --> F[missed callers<br/>argument alignment per call site]
  D --> G[subsystems<br/>from file paths]
  C --> H[untested units<br/>test files that name the symbol]
  C --> I[ADR and doc hits<br/>symbols + 'Applies to' lines, doc drift]
  D & F & G & H & I --> J[score 0-100<br/>7 capped factors, each with a reason]
  J --> K[(JSON report)]
```

On the Pulse sample app a full parse is 237 units and 412 edges in about 0.9 s per ref. A PR analysis takes about 1 s.

## 4. Missed-caller detection

TypeScript can't catch a reordered pair of same-typed parameters. BlastRadius compares each call site with both parameter orders.

![Missed-caller detection](diagrams/04-missed-caller.svg)

```mermaid
flowchart TB
  S[modified exported function] --> P{parameter names<br/>before == after?}
  P -- yes --> OK[no contract change]
  P -- no --> K{same names,<br/>different order?}
  K -- yes --> R[kind = reordered]
  K -- no --> AR{different count?}
  AR -- yes --> Y[kind = arity]
  AR -- no --> N[kind = renamed]
  R --> C[for every caller in base + head graphs]
  Y --> C
  C --> CS[find call sites with tree-sitter<br/>collect argument texts]
  CS --> AL{reordered: arguments align better<br/>with the OLD order?<br/>arity: argument count wrong?}
  AL -- yes --> MISS[missed caller<br/>file:line + call + reason]
  AL -- no --> FINE[caller updated]
```

Alignment compares normalized names. For example, `user.id` matches `userId`, and `workspaceId` matches `workspaceId`. On PR-3, `getWorkspaceMember(workspaceId, user.id)` aligns with the old order `(workspaceId, userId)`, so `comments/[commentId]/route.ts:18` is flagged. The 17 updated callers are not.

## 5. Risk score

![Score factors](diagrams/05-score.svg)

```mermaid
pie showData
  title Maximum points per factor (total 100)
  "reach" : 25
  "missed callers" : 20
  "spread" : 15
  "criticality" : 15
  "contract" : 10
  "untested" : 8
  "docs" : 7
```

| Factor | Rule |
|---|---|
| reach | 2.5 × (sum of 1/distance over dependents + callers edited in the PR), capped at 25 |
| spread | 3 × (subsystems − 1), capped at 15 |
| criticality | 15 when auth, session, membership or db code changes, or a unit with 10+ callers |
| contract | 10 per exported signature change, capped at 10 |
| missed callers | 15 for the first, +5 for each more, capped at 20 |
| untested | 2 per changed or directly affected unit with no test, capped at 8 |
| docs | 3 per ADR or doc section in scope, +2 for doc drift, capped at 7 |

Bands are **low** (under 30), **medium** (30 to 59), **high** (60 to 79) and **critical** (80 and up). The CI gate fails at 80. Bob's stop condition is 70.

## 6. MCP tools

| Tool | Returns |
|---|---|
| `analyze_pr(head, base)` | The full report: score and factors, changed units, ripple, subsystems, contract changes, missed callers, untested units, doc hits |
| `get_dependents(symbol, ref, depth)` | Callers and renderers of a symbol, nearest first |
| `get_subsystem(name, ref)` | Units, API entry points, tests and ADRs of one subsystem |
| `find_untested(symbols, ref)` | The test files that reference each symbol |
| `check_docs(subsystems, symbols, ref)` | ADR and doc sections in scope, with rules and excerpts |
| `run_tests(paths)` | Real vitest pass or fail per test, with failure messages |
| `build_graph(ref)` | Unit and edge counts, subsystems, the most depended-on units |
| `summarize_review(head)` | A plain-English summary: Granite when configured, otherwise a template |

## 7. CI with Bob Shell

![CI pipeline](diagrams/06-ci.svg)

```mermaid
flowchart LR
  PR[pull request] --> CO[checkout, full history]
  CO --> SC[blastradius review --json<br/>and --fail-on 80 --fail-on-missed]
  SC --> BS{BOB_API_KEY set?}
  BS -- yes --> BOB[bob run --mode agent --max-cost 3<br/>blast-radius-review skill]
  BS -- no --> CM
  BOB --> CM[sticky PR comment<br/>found by a hidden marker]
  CM --> G{exit code 2?}
  G -- yes --> FAIL[check fails:<br/>a human must approve]
  G -- no --> PASS[check passes]
```

## 8. Demo setup

`scripts/seed_demo.sh` builds `demo-workspace/pulse` the same way every time, from `pulse/` plus three patches in `demo/prs/`.

![Demo repo](diagrams/07-demo-repo.svg)

```mermaid
gitGraph
  commit id: "Pulse baseline"
  branch pr-1-dashboard-copy
  commit id: "Dashboard copy (risk 6)"
  checkout main
  branch pr-2-session-epoch
  commit id: "SESSION_EPOCH (risk 70)"
  checkout main
  branch pr-3-task-archiving
  commit id: "archive + arg swap (risk 95)"
```

| PR | Why it is in the demo |
|---|---|
| PR-1 | A leaf change. It shows that BlastRadius doesn't cry wolf. |
| PR-2 | A 3-line change to a hub (`getSession`, 24 direct callers) that reaches 13 subsystems. It shows a blast radius the diff can't show. |
| PR-3 | A feature plus a refactor. It has a caller left behind that type checks and CI can't catch, and a new route that breaks ADR-002. It shows Bob proving both bugs with tests. |

## 9. Video pipeline

![Video pipeline](diagrams/08-video.svg)

```mermaid
flowchart LR
  SJ[video/script.json] --> TTS[Chatterbox TTS<br/>per-line narration]
  TTS --> TL[timeline from<br/>narration lengths]
  TL --> SC[scenes.html<br/>three.js graph + product UI]
  SC --> PW[Playwright + Chromium<br/>frame-by-frame capture]
  PW --> FF[ffmpeg<br/>H.264 1080p30]
  REC[Bob IDE screen recording] --> SP[splice_bob.py<br/>captioned clips]
  FF --> SP
  TTS --> MIX[music ducked under voice<br/>loudness -14 LUFS]
  SP --> OUT[BlastRadius_demo.mp4<br/>2:51]
  MIX --> OUT
```

## 10. Plan and roadmap

We planned the work in five milestones, and each one is a tagged release.

![Plan](diagrams/09-plan.svg)

```mermaid
timeline
  title BlastRadius milestones
  v0.1.0 : Parser, REST API, 3D explorer (before the hackathon)
  v0.2.0 : Review engine : Missed-caller detector : ADRs + regression harness : Seeded demo PRs
  v0.3.0 : MCP server for Bob : Reviewer mode, rules, skill : CLI + Granite summary
  v0.4.0 : Live demo site : Video pipeline : CI with Bob Shell
  v1.0.0 : Bob's reviews, tests and fixes : Session evidence : Final video
```

What we chose to build first, in order of its effect on the review workflow:
1. Put Bob in the review loop: the MCP server, the Reviewer mode, the skill and the rules.
2. Make the evidence trustworthy: deterministic engine output, file:line references, and the missed-caller detector.
3. Prove findings instead of asserting them: a regression harness that Bob's subagents write tests into and run.
4. Make it usable in three places: Bob IDE, the command line and CI.
5. Show it: seeded PRs, a live 3D demo and a narrated video with real Bob footage.

Next steps:
- More languages. The parser is TypeScript and TSX today; Python and Java are next.
- An MCP tool that lets Bob query past reviews ("which PRs touched billing this week?").
- Subsystem ownership read from `CODEOWNERS`, so Bob can tag the right reviewer.
- Calibrating the score weights against the team's real incident history.

## Repo map

| Path | What |
|---|---|
| `blastradius/backend/app/review/` | Engine: `engine.py`, `subsystems.py`, `gitrefs.py`, `granite.py` |
| `blastradius/backend/app/mcp_server.py`, `app/cli.py` | MCP server, CLI |
| `blastradius/backend/app/services/parser/` | tree-sitter TypeScript/TSX parser |
| `.bob/` | Reviewer mode, rules, skill, MCP config |
| `pulse/` | Sample app, ADRs, regression harness |
| `demo/prs/`, `scripts/seed_demo.sh` | Seeded PRs |
| `reviews/` | Bob's reports, tests and fixes |
| `bob_sessions/` | Bob task evidence |
| `site/` | Live demo |
| `video/` | Video pipeline |
| `docs/diagrams/` | Every diagram: `.mmd`, `.svg`, `.png`, `.drawio` |
