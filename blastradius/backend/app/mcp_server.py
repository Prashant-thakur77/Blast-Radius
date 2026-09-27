"""BlastRadius MCP server: gives IBM Bob a map of the codebase for PR review.

Run:  python -m app.mcp_server        (stdio transport, launched by Bob via .bob/mcp.json)
Repo: BLASTRADIUS_REPO env var, or the `repo` argument on each tool.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import tempfile
from pathlib import Path

from mcp.server.fastmcp import FastMCP

from app.review import engine
from app.review.subsystems import subsystem_for

mcp = FastMCP(
    "blastradius",
    instructions=(
        "BlastRadius computes the blast radius of a pull request from a code graph. "
        "Start with analyze_pr(head=<branch>). Every finding carries file:line evidence. "
        "Use get_subsystem and check_docs before judging risk, and run_tests to prove it."
    ),
)


def _repo(repo: str | None) -> str:
    r = repo or os.environ.get("BLASTRADIUS_REPO") or os.getcwd()
    return str(Path(r).expanduser().resolve())


def _resolve(g: engine.Graph, symbol: str) -> list[str]:
    if "::" in symbol:
        return [symbol] if symbol in g.units else []
    return sorted(qn for qn, u in g.units.items() if u.symbol_name == symbol)


def _save_report(repo: str, head: str, report: dict) -> str:
    out = Path(repo) / ".blastradius" / "reports"
    out.mkdir(parents=True, exist_ok=True)
    path = out / (re.sub(r"[^A-Za-z0-9._-]", "_", head) + ".json")
    path.write_text(json.dumps(report, indent=2))
    return str(path)


@mcp.tool()
def analyze_pr(head: str, base: str = "main", repo: str | None = None, source_root: str | None = None) -> dict:
    """Blast radius of branch `head` against `base`.

    Returns the 0-100 risk score with a per-factor breakdown, changed units, dependents
    (ripple, nearest first, with the edge they come through), affected subsystems,
    signature (contract) changes, callers that were NOT updated for a changed signature,
    untested units, and ADR/doc sections in scope. The report is also saved under
    .blastradius/reports/ in the repo.
    """
    r = _repo(repo)
    report = engine.analyze_refs(r, base, head, source_root)
    report["saved_to"] = _save_report(r, head, report)
    return report


@mcp.tool()
def get_dependents(symbol: str, ref: str = "HEAD", depth: int = 2, repo: str | None = None) -> dict:
    """Who calls or renders `symbol` (a function/component name or a file::name qualname) at `ref`."""
    g = engine.build_graph_at(_repo(repo), ref)
    matches = _resolve(g, symbol)
    return {
        "ref": ref,
        "matches": [
            {"qualname": qn, "file": g.units[qn].file_path, "line": g.units[qn].start_line,
             "dependents": engine.get_dependents(g, qn, depth)}
            for qn in matches
        ],
    }


@mcp.tool()
def get_subsystem(name: str, ref: str = "HEAD", repo: str | None = None) -> dict:
    """Everything in one subsystem at `ref`: units, API entry points, tests that mention them, and ADRs that apply."""
    r = _repo(repo)
    g = engine.build_graph_at(r, ref)
    units = [u for u in g.units.values() if subsystem_for(u.file_path) == name]
    tests = engine.test_index(g.root)
    docs = [d for d in engine.doc_hits(engine.scan_docs(g.root), set(), {name}, set())]
    return {
        "subsystem": name,
        "ref": ref,
        "units": [{"qualname": u.qualname, "kind": u.kind, "file": u.file_path, "line": u.start_line,
                   "callers": len(g.callers.get(u.qualname, ()))} for u in sorted(units, key=lambda u: (u.file_path, u.start_line))],
        "entry_points": [u.qualname for u in units if u.kind == "api_handler"],
        "tests": sorted({t for u in units for t in engine.tests_covering(u.symbol_name, tests)}),
        "adrs": [{"file": d["file"], "line": d["line"], "heading": d["heading"], "rules": d["rules"]} for d in docs],
        "test_harness": "src/__regression__/harness.ts (seedWorkspace, signInAs, jsonRequest, activityFor)",
    }


@mcp.tool()
def find_untested(symbols: list[str], ref: str = "HEAD", repo: str | None = None) -> dict:
    """For each symbol, the test files that reference it. An empty list means untested."""
    g = engine.build_graph_at(_repo(repo), ref)
    tests = engine.test_index(g.root)
    return {s: engine.tests_covering(s.split("::")[-1], tests) for s in symbols}


@mcp.tool()
def check_docs(subsystems: list[str] | None = None, symbols: list[str] | None = None, ref: str = "HEAD",
               repo: str | None = None) -> dict:
    """ADR and architecture doc sections that apply to the given subsystems or name the given symbols.

    Each hit includes the rules (lines with MUST/never/always) and an excerpt, with file:line.
    Decide yourself whether the PR violates each rule; cite the file and line.
    """
    g = engine.build_graph_at(_repo(repo), ref)
    hits = engine.doc_hits(engine.scan_docs(g.root), set(symbols or []), set(subsystems or []), set())
    return {"ref": ref, "sections": hits}


@mcp.tool()
def run_tests(paths: list[str], repo: str | None = None) -> dict:
    """Run vitest on the given test files in the repo's working tree and return real pass/fail per test."""
    r = _repo(repo)
    out_file = Path(tempfile.mkstemp(suffix=".json")[1])
    cmd = ["npx", "vitest", "run", *paths, "--reporter=json", f"--outputFile={out_file}"]
    env = {**os.environ}
    env.setdefault("HOME", str(Path.home()))
    env["PATH"] = env.get("PATH", "") + os.pathsep + str(Path.home() / ".volta" / "bin")
    proc = subprocess.run(cmd, cwd=r, capture_output=True, text=True, timeout=300, env=env)
    try:
        data = json.loads(out_file.read_text() or "{}")
    except json.JSONDecodeError:
        data = {}
    results = []
    for f in data.get("testResults", []):
        for a in f.get("assertionResults", []):
            results.append({
                "file": os.path.relpath(f.get("name", ""), r),
                "test": a.get("fullName") or a.get("title"),
                "status": a.get("status"),
                "failure": (a.get("failureMessages") or [""])[0].split("\n")[0][:300],
            })
    return {
        "command": " ".join(cmd[:-2]),
        "exit_code": proc.returncode,
        "passed": sum(1 for x in results if x["status"] == "passed"),
        "failed": sum(1 for x in results if x["status"] == "failed"),
        "results": results,
        "stderr_tail": proc.stderr[-800:] if proc.returncode and not results else "",
    }


@mcp.tool()
def build_graph(ref: str = "HEAD", repo: str | None = None) -> dict:
    """Parse the repo at `ref` into the code graph and summarize it by subsystem."""
    g = engine.build_graph_at(_repo(repo), ref)
    by_sub: dict[str, int] = {}
    for u in g.units.values():
        s = subsystem_for(u.file_path)
        by_sub[s] = by_sub.get(s, 0) + 1
    hubs = sorted(g.units, key=lambda qn: -len(g.callers.get(qn, ())))[:8]
    return {
        "ref": ref, "sha": g.sha, "units": len(g.units), "edges": len(g.edges), "parse_ms": g.parse_ms,
        "subsystems": dict(sorted(by_sub.items(), key=lambda kv: -kv[1])),
        "most_depended_on": [{"qualname": qn, "callers": len(g.callers.get(qn, ()))} for qn in hubs],
    }


@mcp.tool()
def summarize_review(head: str, base: str = "main", repo: str | None = None) -> dict:
    """A short plain-English summary of the blast radius. Uses IBM Granite on watsonx.ai when
    WATSONX_APIKEY and WATSONX_PROJECT_ID are set; otherwise a deterministic template."""
    from app.review.granite import summarize
    report = engine.analyze_refs(_repo(repo), base, head)
    return summarize(report)


def main() -> None:
    mcp.run()


if __name__ == "__main__":
    main()
