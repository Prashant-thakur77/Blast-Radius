"""Export the demo graph (with a deterministic 3D layout) and the three PR reports for the static site.

Run: blastradius/backend/.venv/bin/python scripts/export_site_data.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "blastradius" / "backend"))

from app.review import analyze_refs, build_graph_at  # noqa: E402
from app.review.subsystems import subsystem_for  # noqa: E402

REPO = str(ROOT / "demo-workspace" / "pulse")
PRS = [
    ("pr-1-dashboard-copy", "Dashboard copy tweak"),
    ("pr-2-session-epoch", "Sign everyone out after a key rotation"),
    ("pr-3-task-archiving", "Task archiving + getWorkspaceMember refactor"),
]
OUT = ROOT / "site" / "data"


def layout(nodes: list[str], edges: list[tuple[int, int]], groups: list[str], seed: int = 7) -> np.ndarray:
    rng = np.random.default_rng(seed)
    uniq = sorted(set(groups))
    # subsystem anchors spread on a sphere (fibonacci)
    k = len(uniq)
    anchors = {}
    for i, g in enumerate(uniq):
        y = 1 - 2 * (i + 0.5) / k
        r = np.sqrt(1 - y * y)
        th = np.pi * (3 - np.sqrt(5)) * i
        anchors[g] = np.array([np.cos(th) * r, y, np.sin(th) * r]) * 9
    pos = np.array([anchors[g] + rng.normal(0, 1.2, 3) for g in groups])
    n = len(nodes)
    E = np.array(edges) if edges else np.zeros((0, 2), int)
    for it in range(260):
        d = pos[:, None, :] - pos[None, :, :]
        dist2 = (d ** 2).sum(-1) + 0.05
        rep = (d / dist2[..., None] ** 1.5).sum(1) * 2.2
        att = np.zeros_like(pos)
        if len(E):
            de = pos[E[:, 1]] - pos[E[:, 0]]
            np.add.at(att, E[:, 0], de * 0.06)
            np.add.at(att, E[:, 1], -de * 0.06)
        anc = np.array([anchors[g] for g in groups]) - pos
        step = 0.35 * (1 - it / 300)
        pos += step * (rep + att + anc * 0.08)
    pos -= pos.mean(0)
    pos /= np.abs(pos).max() / 14
    return pos


def main() -> None:
    g = build_graph_at(REPO, "main")
    names = sorted(g.units)
    idx = {qn: i for i, qn in enumerate(names)}
    groups = [subsystem_for(g.units[qn].file_path) for qn in names]
    edges = sorted({(idx[e.source_qualname], idx[e.target_qualname]) for e in g.edges
                    if e.source_qualname in idx and e.target_qualname in idx and e.source_qualname != e.target_qualname})
    pos = layout(names, edges, groups)
    graph = {
        "units": [{"id": i, "q": qn, "s": g.units[qn].symbol_name, "f": g.units[qn].file_path, "k": g.units[qn].kind,
                   "g": groups[i], "p": [round(float(v), 3) for v in pos[i]],
                   "c": len(g.callers.get(qn, ()))} for i, qn in enumerate(names)],
        "edges": edges,
        "subsystems": sorted(set(groups)),
    }
    (OUT / "graph.json").write_text(json.dumps(graph, separators=(",", ":")))
    reports = []
    for head, title in PRS:
        r = analyze_refs(REPO, "main", head)
        r["title"] = title
        r.pop("repo", None)
        for d in r["docs"]:
            d["excerpt"] = d["excerpt"][:400]
        reports.append(r)
        print(head, r["score"]["total"], r["score"]["band"], r["stats"]["analysis_ms"], "ms")
    (OUT / "reports.json").write_text(json.dumps(reports, indent=1))
    print("units", len(names), "edges", len(edges))


if __name__ == "__main__":
    main()
