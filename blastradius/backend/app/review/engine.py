"""BlastRadius review engine.

Given a git repo and two refs, compute the blast radius of the change:
changed units, dependents reached through reverse call/render edges,
affected subsystems, contract (signature) changes, callers that were not
updated, untested units, ADR/doc passages in scope, and a 0-100 risk score
whose every point traces back to evidence.

Everything here is deterministic. No database, no network, no LLM.
"""

from __future__ import annotations

import re
import time
from collections import defaultdict, deque
from dataclasses import dataclass, field
from pathlib import Path

import tree_sitter as ts

from app.review import gitrefs
from app.review.subsystems import subsystem_for
from app.services.parser import parse_project
from app.services.parser.ts_parser import make_parser
from app.services.parser.types import ParsedEdge, ParsedUnit

MAX_DEPTH = 3
CRITICAL_HINTS = ("auth", "session", "permission", "member", "/db/", "security", "payment")
TEST_PATTERNS = (".test.ts", ".test.tsx", ".spec.ts", ".spec.tsx")


# --------------------------------------------------------------------------- graph


@dataclass
class Graph:
    sha: str
    root: str
    units: dict[str, ParsedUnit]
    edges: list[ParsedEdge]
    callers: dict[str, set[str]] = field(default_factory=lambda: defaultdict(set))
    callees: dict[str, set[str]] = field(default_factory=lambda: defaultdict(set))
    edge_type: dict[tuple[str, str], str] = field(default_factory=dict)
    parse_ms: int = 0

    def index(self) -> None:
        for e in self.edges:
            if e.source_qualname == e.target_qualname:
                continue
            self.callers[e.target_qualname].add(e.source_qualname)
            self.callees[e.source_qualname].add(e.target_qualname)
            self.edge_type[(e.source_qualname, e.target_qualname)] = e.edge_type


_GRAPH_CACHE: dict[tuple[str, str | None], Graph] = {}


def build_graph_at(repo: str, ref: str, source_root: str | None = None) -> Graph:
    sha, tree = gitrefs.materialize(repo, ref)
    key = (sha, source_root)
    if key in _GRAPH_CACHE:
        return _GRAPH_CACHE[key]
    root = gitrefs.root_for(tree, source_root)
    t0 = time.perf_counter()
    units, edges = parse_project(root)
    g = Graph(sha=sha, root=root, units={u.qualname: u for u in units}, edges=edges)
    g.index()
    g.parse_ms = int((time.perf_counter() - t0) * 1000)
    _GRAPH_CACHE[key] = g
    return g


def get_dependents(g: Graph, qualname: str, depth: int = 2) -> list[dict]:
    """Units that (transitively) call or render `qualname`, nearest first."""
    out: list[dict] = []
    seen = {qualname}
    q: deque[tuple[str, int, str]] = deque([(qualname, 0, qualname)])
    while q:
        cur, d, _ = q.popleft()
        if d >= depth:
            continue
        for caller in sorted(g.callers.get(cur, ())):
            if caller in seen:
                continue
            seen.add(caller)
            u = g.units.get(caller)
            out.append({
                "qualname": caller,
                "file": u.file_path if u else caller.split("::")[0],
                "line": u.start_line if u else 0,
                "kind": u.kind if u else "",
                "distance": d + 1,
                "via": cur,
                "edge": g.edge_type.get((caller, cur), "calls"),
                "subsystem": subsystem_for(u.file_path if u else caller.split("::")[0]),
            })
            q.append((caller, d + 1, cur))
    return out


# --------------------------------------------------------------------------- signatures

_ts_parser = make_parser(tsx=False)
_tsx_parser = make_parser(tsx=True)


def _walk(node: ts.Node):
    yield node
    for c in node.children:
        yield from _walk(c)


def _parse_snippet(text: str, tsx: bool) -> tuple[ts.Tree, bytes]:
    src = text.encode("utf-8")
    return (_tsx_parser if tsx else _ts_parser).parse(src), src


def param_names(unit: ParsedUnit) -> list[str] | None:
    """Ordered formal parameter names of a function-like unit, or None."""
    tree, src = _parse_snippet(unit.source_text, unit.file_path.endswith(".tsx"))
    for node in _walk(tree.root_node):
        if node.type == "formal_parameters":
            names: list[str] = []
            for p in node.named_children:
                pat = p.child_by_field_name("pattern") or p
                txt = src[pat.start_byte:pat.end_byte].decode("utf-8", "replace")
                if pat.type == "object_pattern":
                    keys = [src[c.start_byte:c.end_byte].decode() for c in pat.named_children]
                    names.append("{" + ",".join(k.split(":")[0].strip() for k in keys) + "}")
                else:
                    names.append(txt.split(":")[0].strip().lstrip("."))
            return names
    return None


def call_sites(caller: ParsedUnit, callee_name: str) -> list[dict]:
    """Call expressions to `callee_name` inside the caller's source, with argument texts."""
    tree, src = _parse_snippet(caller.source_text, caller.file_path.endswith(".tsx"))
    sites: list[dict] = []
    for node in _walk(tree.root_node):
        if node.type != "call_expression":
            continue
        fn = node.child_by_field_name("function")
        if fn is None:
            continue
        fn_text = src[fn.start_byte:fn.end_byte].decode("utf-8", "replace")
        if fn_text != callee_name and not fn_text.endswith("." + callee_name):
            continue
        args_node = node.child_by_field_name("arguments")
        args = []
        if args_node is not None:
            args = [src[a.start_byte:a.end_byte].decode("utf-8", "replace") for a in args_node.named_children]
        sites.append({
            "line": caller.start_line + node.start_point[0],
            "call": src[node.start_byte:node.end_byte].decode("utf-8", "replace").replace("\n", " ")[:160],
            "args": args,
        })
    return sites


def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", s.lower())


def _match(arg: str, param: str) -> float:
    a, p = _norm(arg), _norm(param)
    if not a or not p:
        return 0.0
    if a == p:
        return 1.0
    if a.endswith(p) or p.endswith(a):
        return 0.7 if min(len(a), len(p)) > 2 else 0.2
    return 0.0


def _alignment(args: list[str], params: list[str]) -> float:
    return sum(_match(a, p) for a, p in zip(args, params))


# --------------------------------------------------------------------------- docs


def scan_docs(root: str) -> list[dict]:
    """Split markdown docs (docs/, adr/, ARCHITECTURE*, AGENTS.md) into sections."""
    base = Path(root)
    files: list[Path] = []
    for pattern in ("docs/**/*.md", "**/adr/*.md", "ARCHITECTURE*.md", "AGENTS.md"):
        files.extend(p for p in base.glob(pattern) if "node_modules" not in p.parts)
    sections: list[dict] = []
    for f in sorted(set(files)):
        rel = str(f.relative_to(base))
        lines = f.read_text(errors="replace").splitlines()
        title = lines[0].lstrip("# ").strip() if lines else rel
        cur = {"file": rel, "title": title, "heading": title, "line": 1, "text": []}
        for i, line in enumerate(lines, start=1):
            if line.startswith("#") and cur["text"]:
                sections.append(cur)
                cur = {"file": rel, "title": title, "heading": line.lstrip("# ").strip(), "line": i, "text": []}
            elif line.startswith("#"):
                cur["heading"], cur["line"] = line.lstrip("# ").strip(), i
            else:
                cur["text"].append(line)
        if cur["text"]:
            sections.append(cur)
    for s in sections:
        s["text"] = "\n".join(s["text"]).strip()
    return sections


def doc_hits(sections: list[dict], symbols: set[str], subsystems: set[str], contract_symbols: set[str]) -> list[dict]:
    hits: list[dict] = []
    for s in sections:
        body = s["heading"] + "\n" + s["text"]
        applies = re.search(r"(?im)^\s*\**applies to\**:?\s*(.+)$", body)
        applies_to = {_norm(x) for x in re.split(r"[,\s]+", applies.group(1))} if applies else set()
        matched_syms = sorted(sym for sym in symbols if re.search(rf"\b{re.escape(sym)}\b", body))
        matched_subs = sorted(sub for sub in subsystems if _norm(sub) in applies_to)
        if not matched_syms and not matched_subs:
            continue
        rules = [ln.strip("-* ").strip() for ln in s["text"].splitlines()
                 if re.search(r"\b(MUST|must|never|always|Never|Always|required)\b", ln)]
        hits.append({
            "file": s["file"],
            "line": s["line"],
            "title": s["title"],
            "heading": s["heading"],
            "matched_symbols": matched_syms,
            "matched_subsystems": matched_subs,
            "rules": rules[:6],
            "drift": sorted(set(matched_syms) & contract_symbols),
            "excerpt": s["text"][:700],
        })
    return hits


# --------------------------------------------------------------------------- tests


def test_index(root: str) -> dict[str, str]:
    """Map test file path -> source text for every test file under root."""
    out: dict[str, str] = {}
    base = Path(root)
    for p in base.rglob("*"):
        if "node_modules" in p.parts or not p.is_file():
            continue
        name = p.name
        if name.endswith(TEST_PATTERNS) or "__tests__" in p.parts:
            out[str(p.relative_to(base))] = p.read_text(errors="replace")
    return out


def tests_covering(symbol: str, tests: dict[str, str]) -> list[str]:
    pat = re.compile(rf"\b{re.escape(symbol)}\b")
    return sorted(path for path, text in tests.items() if pat.search(text))


# --------------------------------------------------------------------------- scoring


def band(score: int) -> str:
    if score >= 80:
        return "critical"
    if score >= 60:
        return "high"
    if score >= 30:
        return "medium"
    return "low"


def _score(changed, ripple, subsystems, contract_changes, missed, untested, docs, critical_units, changed_dependents=0) -> dict:
    reach_raw = sum(1.0 / r["distance"] for r in ripple) + changed_dependents
    direct = sum(1 for r in ripple if r["distance"] == 1) + changed_dependents
    factors = [
        {"name": "reach", "max": 25, "points": min(25, round(2.5 * reach_raw)),
         "why": f"{len(ripple) + changed_dependents} dependent units ({direct} direct"
                + (f", {changed_dependents} of them edited in this PR" if changed_dependents else "") + ")"},
        {"name": "spread", "max": 15, "points": min(15, 3 * max(0, len(subsystems) - 1)),
         "why": f"{len(subsystems)} subsystems touched"},
        {"name": "criticality", "max": 15, "points": 15 if critical_units else 0,
         "why": ("changes " + ", ".join(sorted(critical_units)[:3])) if critical_units else "no auth/session/membership/db units changed"},
        {"name": "contract", "max": 10, "points": min(10, 10 * len(contract_changes)),
         "why": f"{len(contract_changes)} exported signature change(s)"},
        {"name": "missed_callers", "max": 20, "points": min(20, 15 + 5 * (len(missed) - 1)) if missed else 0,
         "why": f"{len(missed)} caller(s) not updated for a changed signature"},
        {"name": "untested", "max": 8, "points": min(8, 2 * len(untested)),
         "why": f"{len(untested)} changed or directly affected units have no test"},
        {"name": "docs", "max": 7, "points": min(7, 3 * len(docs) + (2 if any(d['drift'] for d in docs) else 0)),
         "why": f"{len(docs)} ADR/doc section(s) in scope" + ("; doc names a changed signature" if any(d['drift'] for d in docs) else "")},
    ]
    total = min(100, sum(f["points"] for f in factors))
    return {"total": total, "band": band(total), "factors": factors}


# --------------------------------------------------------------------------- main entry


def analyze_refs(repo: str, base: str, head: str, source_root: str | None = None) -> dict:
    t0 = time.perf_counter()
    g_base = build_graph_at(repo, base, source_root)
    g_head = build_graph_at(repo, head, source_root)
    files = gitrefs.changed_files(repo, base, head, source_root)
    changed_paths = {p for _, p in files}

    # 1. changed units
    changed: list[dict] = []
    for qn, u in g_head.units.items():
        if u.file_path not in changed_paths:
            continue
        old = g_base.units.get(qn)
        if old is None:
            changed.append({"qualname": qn, "change": "added", "unit": u})
        elif old.code_hash != u.code_hash:
            changed.append({"qualname": qn, "change": "modified", "unit": u})
    for qn, u in g_base.units.items():
        if u.file_path in changed_paths and qn not in g_head.units:
            changed.append({"qualname": qn, "change": "deleted", "unit": u})
    changed_qns = {c["qualname"] for c in changed}

    # 2. ripple over reverse edges (dependents), union of base and head callers
    def callers_of(qn: str) -> set[str]:
        return set(g_head.callers.get(qn, ())) | set(g_base.callers.get(qn, ()))

    ripple: dict[str, dict] = {}
    frontier = deque((qn, 0, qn) for qn in changed_qns)
    while frontier:
        cur, d, origin = frontier.popleft()
        if d >= MAX_DEPTH:
            continue
        for caller in sorted(callers_of(cur)):
            if caller in changed_qns or caller in ripple:
                continue
            u = g_head.units.get(caller) or g_base.units.get(caller)
            if u is None:
                continue
            ripple[caller] = {
                "qualname": caller, "file": u.file_path, "line": u.start_line, "kind": u.kind,
                "distance": d + 1, "via": cur, "origin": origin,
                "edge": g_head.edge_type.get((caller, cur)) or g_base.edge_type.get((caller, cur), "calls"),
                "subsystem": subsystem_for(u.file_path),
            }
            frontier.append((caller, d + 1, origin))

    # 3. contract changes + missed callers
    contract_changes: list[dict] = []
    missed: list[dict] = []
    for c in changed:
        if c["change"] != "modified" or c["unit"].kind not in ("function", "hook"):
            continue
        new_u, old_u = c["unit"], g_base.units[c["qualname"]]
        new_p, old_p = param_names(new_u), param_names(old_u)
        if new_p is None or old_p is None or new_p == old_p:
            continue
        kind = "reordered" if sorted(new_p) == sorted(old_p) else "arity" if len(new_p) != len(old_p) else "renamed"
        callers = sorted(callers_of(c["qualname"]))
        contract_changes.append({
            "qualname": c["qualname"], "symbol": new_u.symbol_name, "file": new_u.file_path, "line": new_u.start_line,
            "old_params": old_p, "new_params": new_p, "kind": kind, "callers": len(callers),
        })
        for caller_qn in callers:
            cu = g_head.units.get(caller_qn)
            if cu is None:
                continue
            for site in call_sites(cu, new_u.symbol_name):
                args = site["args"]
                reason = None
                if kind == "arity" and len(args) != len(new_p) and not any(a.startswith("...") for a in args):
                    reason = f"passes {len(args)} argument(s); {new_u.symbol_name} now takes {len(new_p)}"
                elif kind == "reordered":
                    old_fit, new_fit = _alignment(args, old_p), _alignment(args, new_p)
                    if old_fit > new_fit:
                        reason = (f"arguments ({', '.join(args)}) still match the old order "
                                  f"({', '.join(old_p)}); new order is ({', '.join(new_p)})")
                if reason:
                    missed.append({
                        "callee": c["qualname"], "caller": caller_qn, "file": cu.file_path, "line": site["line"],
                        "call": site["call"], "reason": reason,
                        "caller_changed_in_pr": cu.file_path in changed_paths,
                    })

    # 4. subsystems
    subs: dict[str, dict] = defaultdict(lambda: {"changed": 0, "ripple": 0, "units": []})
    for c in changed:
        s = subsystem_for(c["unit"].file_path)
        subs[s]["changed"] += 1
        subs[s]["units"].append(c["qualname"])
    for r in ripple.values():
        subs[r["subsystem"]]["ripple"] += 1
        subs[r["subsystem"]]["units"].append(r["qualname"])
    subsystem_list = sorted(
        ({"name": k, **v} for k, v in subs.items()),
        key=lambda s: (-(s["changed"] * 2 + s["ripple"]), s["name"]),
    )

    # 5. tests
    tests = test_index(g_head.root)
    untested: list[dict] = []
    for qn in list(changed_qns) + [r["qualname"] for r in ripple.values() if r["distance"] == 1]:
        u = g_head.units.get(qn) or g_base.units.get(qn)
        if u is None or u.file_path.endswith(TEST_PATTERNS):
            continue
        if not tests_covering(u.symbol_name, tests):
            untested.append({"qualname": qn, "file": u.file_path, "line": u.start_line, "kind": u.kind})

    # 6. docs / ADRs
    symbols = {c["unit"].symbol_name for c in changed if c["unit"].symbol_name not in ("GET", "POST", "PATCH", "PUT", "DELETE", "default")}
    docs = doc_hits(scan_docs(g_head.root), symbols, set(subs.keys()), {cc["symbol"] for cc in contract_changes})

    # 7. score
    verbs = {"GET", "POST", "PUT", "PATCH", "DELETE", "default", "authorize"}
    critical_units = {c["unit"].symbol_name for c in changed
                      if any(h in c["unit"].file_path.lower() for h in CRITICAL_HINTS)
                      and c["unit"].symbol_name not in verbs}
    hub_changed = {c["unit"].symbol_name for c in changed if len(callers_of(c["qualname"])) >= 10}
    changed_dependents = sum(1 for qn in changed_qns if any(callee in changed_qns for callee in g_head.callees.get(qn, ())))
    score = _score(changed, list(ripple.values()), subs, contract_changes, missed, untested, docs,
                   critical_units | hub_changed, changed_dependents)

    files_in_radius = sorted({c["unit"].file_path for c in changed} | {r["file"] for r in ripple.values()})
    return {
        "tool": "blastradius",
        "version": 1,
        "repo": repo,
        "base": base, "head": head, "base_sha": g_base.sha, "head_sha": g_head.sha,
        "score": score,
        "changed_units": [
            {"qualname": c["qualname"], "symbol": c["unit"].symbol_name, "file": c["unit"].file_path,
             "line": c["unit"].start_line, "kind": c["unit"].kind, "change": c["change"],
             "subsystem": subsystem_for(c["unit"].file_path), "dependents": len(callers_of(c["qualname"]))}
            for c in sorted(changed, key=lambda c: (c["unit"].file_path, c["unit"].start_line))
        ],
        "ripple": sorted(ripple.values(), key=lambda r: (r["distance"], r["file"], r["line"])),
        "subsystems": subsystem_list,
        "contract_changes": contract_changes,
        "missed_callers": missed,
        "untested": untested,
        "docs": docs,
        "stats": {
            "units": len(g_head.units), "edges": len(g_head.edges),
            "parse_ms": g_base.parse_ms + g_head.parse_ms,
            "analysis_ms": int((time.perf_counter() - t0) * 1000),
            "diff": gitrefs.diff_stat(repo, base, head),
            "files_in_diff": len(changed_paths),
            "files_in_radius": len(files_in_radius),
            "test_files": len(tests),
        },
        "files_in_radius": files_in_radius,
    }
