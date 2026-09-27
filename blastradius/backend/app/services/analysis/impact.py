from __future__ import annotations

import logging
import os
import tempfile
from collections import defaultdict

import joblib
import numpy as np
from sqlmodel import Session, select

from app.core.config import DATA_DIR
from app.models import ClusterMember, CodeUnit, FeatureCluster, GraphEdge, ProjectGraphSnapshot
from app.schemas.api import (
    AnalyzeMRRequest,
    ChangedUnit,
    ClusterImpact,
    GraphDiffOut,
    GraphEdgeOut,
    ImpactedUnit,
    ImpactReport,
    OverlayGraph,
    OverlayNode,
)
from app.services.parser import parse_project
from app.services.parser.types import ParsedEdge, ParsedUnit

logger = logging.getLogger("blastradius.analysis")


def _build_cluster_map(snapshot_id: str, session: Session) -> dict[str, str]:
    clusters = session.exec(
        select(FeatureCluster).where(FeatureCluster.snapshot_id == snapshot_id)
    ).all()
    result: dict[str, str] = {}
    for c in clusters:
        members = session.exec(
            select(ClusterMember).where(ClusterMember.cluster_id == c.id)
        ).all()
        for m in members:
            result[m.code_unit_id] = c.label
    return result


def _parse_changed_files(
    changed_files: list[dict],
    repo_root: str,
) -> tuple[list[ParsedUnit], list[ParsedEdge]]:
    tmp_dir = tempfile.mkdtemp()
    file_paths: list[str] = []

    for cf in changed_files:
        if cf["status"] == "deleted" or cf["content"] is None:
            continue
        file_path = cf["path"]
        abs_path = os.path.join(tmp_dir, file_path)
        os.makedirs(os.path.dirname(abs_path), exist_ok=True)
        with open(abs_path, "w") as f:
            f.write(cf["content"])
        file_paths.append(file_path)

    if not file_paths:
        return [], []

    if os.path.isdir(repo_root):
        for dirpath, dirnames, filenames in os.walk(repo_root):
            dirnames[:] = [d for d in dirnames if d not in {"node_modules", ".next", "dist", ".git", "__pycache__"}]
            for fn in filenames:
                if fn.endswith((".ts", ".tsx")) and not fn.endswith(".d.ts"):
                    rel = os.path.relpath(os.path.join(dirpath, fn), repo_root)
                    changed_paths = {cf["path"] for cf in changed_files}
                    if rel not in changed_paths:
                        dest = os.path.join(tmp_dir, rel)
                        os.makedirs(os.path.dirname(dest), exist_ok=True)
                        src = os.path.join(dirpath, fn)
                        if not os.path.exists(dest):
                            os.symlink(src, dest)

    units, edges = parse_project(tmp_dir, file_paths)
    return units, edges


async def _enrich_new_units(
    units: list[ParsedUnit],
    repo_id: str,
) -> dict[str, tuple[str, float, float, float, float, float]]:
    """Generate descriptions, embeddings, and positions for new/modified units.

    Returns: {qualname: (description, x2d, y2d, x3d, y3d, z3d)}
    """
    zeros = (0.0, 0.0, 0.0, 0.0, 0.0)

    if not units:
        return {}

    from app.services.embedding.worker import generate_embeddings
    from app.services.llm.worker import generate_descriptions

    descriptions = await generate_descriptions(units)

    desc_for_embedding = {
        u.qualname: descriptions[u.qualname]
        for u in units
        if u.qualname in descriptions
    }

    if not desc_for_embedding:
        return {qn: (desc, *zeros) for qn, desc in descriptions.items()}

    vectors = await generate_embeddings(desc_for_embedding)

    reducer_2d_path = DATA_DIR / f"reducer_2d_{repo_id}.pkl"
    reducer_3d_path = DATA_DIR / f"reducer_3d_{repo_id}.pkl"

    if vectors and reducer_2d_path.exists():
        qualnames = list(vectors.keys())
        matrix = np.array([vectors[qn] for qn in qualnames])

        reducer_2d = joblib.load(reducer_2d_path)
        coords_2d = reducer_2d.transform(matrix)

        coords_3d = None
        if reducer_3d_path.exists():
            reducer_3d = joblib.load(reducer_3d_path)
            coords_3d = reducer_3d.transform(matrix)

        result: dict[str, tuple[str, float, float, float, float, float]] = {}
        for i, qn in enumerate(qualnames):
            x2d, y2d = float(coords_2d[i][0]), float(coords_2d[i][1])
            if coords_3d is not None:
                x3d, y3d, z3d = float(coords_3d[i][0]), float(coords_3d[i][1]), float(coords_3d[i][2])
            else:
                x3d, y3d, z3d = 0.0, 0.0, 0.0
            result[qn] = (descriptions.get(qn, ""), x2d, y2d, x3d, y3d, z3d)
        return result

    return {qn: (descriptions.get(qn, ""), *zeros) for qn in desc_for_embedding}


async def analyze_mr(
    snapshot: ProjectGraphSnapshot,
    request: AnalyzeMRRequest,
    repo_root: str | None,
    session: Session,
) -> ImpactReport:
    old_units = session.exec(
        select(CodeUnit).where(CodeUnit.snapshot_id == snapshot.id)
    ).all()
    old_edges = session.exec(
        select(GraphEdge).where(GraphEdge.snapshot_id == snapshot.id)
    ).all()

    old_by_qualname: dict[str, CodeUnit] = {u.qualname: u for u in old_units}
    cluster_map = _build_cluster_map(snapshot.id, session)

    changed_file_dicts = [cf.model_dump() for cf in request.changed_files]
    deleted_paths = {cf.path for cf in request.changed_files if cf.status == "deleted"}
    changed_paths = {cf.path for cf in request.changed_files}

    new_parsed_units, new_parsed_edges = _parse_changed_files(
        changed_file_dicts,
        repo_root or "",
    )

    new_units_by_qualname: dict[str, ParsedUnit] = {}
    for u in new_parsed_units:
        new_units_by_qualname[u.qualname] = u

    carried_units: dict[str, CodeUnit] = {}
    for qn, cu in old_by_qualname.items():
        if cu.file_path in deleted_paths:
            continue
        if cu.file_path in changed_paths:
            continue
        carried_units[qn] = cu

    all_new_qualnames = set(new_units_by_qualname.keys()) | set(carried_units.keys())

    modified_qualnames: list[str] = []
    added_qualnames: list[str] = []
    removed_qualnames: list[str] = []

    for qn in all_new_qualnames:
        if qn in new_units_by_qualname and qn in old_by_qualname:
            if new_units_by_qualname[qn].code_hash != old_by_qualname[qn].code_hash:
                modified_qualnames.append(qn)
        elif qn in new_units_by_qualname and qn not in old_by_qualname:
            added_qualnames.append(qn)

    for qn in old_by_qualname:
        if qn not in all_new_qualnames:
            removed_qualnames.append(qn)

    directly_changed = set(modified_qualnames + added_qualnames + removed_qualnames)

    old_adj: dict[str, set[str]] = defaultdict(set)
    old_qualname_by_id: dict[str, str] = {u.id: u.qualname for u in old_units}
    for e in old_edges:
        src_qn = old_qualname_by_id.get(e.source_unit_id)
        tgt_qn = old_qualname_by_id.get(e.target_unit_id)
        if src_qn and tgt_qn:
            old_adj[src_qn].add(tgt_qn)
            old_adj[tgt_qn].add(src_qn)

    old_edge_set: set[tuple[str, str, str]] = set()
    for e in old_edges:
        src_qn = old_qualname_by_id.get(e.source_unit_id)
        tgt_qn = old_qualname_by_id.get(e.target_unit_id)
        if src_qn and tgt_qn:
            old_edge_set.add((src_qn, tgt_qn, e.edge_type))

    new_edge_set: set[tuple[str, str, str]] = set()
    for pe in new_parsed_edges:
        new_edge_set.add((pe.source_qualname, pe.target_qualname, pe.edge_type))
    for e in old_edges:
        src_qn = old_qualname_by_id.get(e.source_unit_id)
        tgt_qn = old_qualname_by_id.get(e.target_unit_id)
        if src_qn and tgt_qn:
            if src_qn in carried_units and tgt_qn in carried_units:
                new_edge_set.add((src_qn, tgt_qn, e.edge_type))

    new_adj: dict[str, set[str]] = defaultdict(set)
    for src, tgt, _ in new_edge_set:
        new_adj[src].add(tgt)
        new_adj[tgt].add(src)

    HUB_THRESHOLD = 0.15
    hub_qualnames = {u.qualname for u in old_units if u.hub_score > HUB_THRESHOLD}

    ripple: dict[str, tuple[str, int]] = {}
    frontier = list(directly_changed)
    visited = set(directly_changed)
    depth = 0
    edge_type_for: dict[str, str] = {}

    while frontier and depth < 2:
        depth += 1
        next_frontier: list[str] = []
        for qn in frontier:
            for adj_source in [old_adj, new_adj]:
                for neighbor in adj_source.get(qn, set()):
                    if neighbor in hub_qualnames:
                        continue
                    if neighbor not in visited and neighbor not in directly_changed:
                        visited.add(neighbor)
                        for src, tgt, et in old_edge_set | new_edge_set:
                            if (src == qn and tgt == neighbor) or (tgt == qn and src == neighbor):
                                edge_type_for[neighbor] = et
                                break
                        ripple[neighbor] = (edge_type_for.get(neighbor, "calls"), depth)
                        next_frontier.append(neighbor)
        frontier = next_frontier

    def _unit_cluster(qn: str) -> str | None:
        cu = old_by_qualname.get(qn)
        if cu:
            return cluster_map.get(cu.id)
        return None

    # Enrich new/modified units with descriptions + positions
    units_to_enrich = [
        new_units_by_qualname[qn]
        for qn in modified_qualnames + added_qualnames
        if qn in new_units_by_qualname
    ]
    enriched = await _enrich_new_units(units_to_enrich, snapshot.repo_id)
    logger.info(f"enriched {len(enriched)} new/modified units for MR overlay")

    changed_units: list[ChangedUnit] = []
    for qn in modified_qualnames:
        pu = new_units_by_qualname.get(qn)
        ou = old_by_qualname.get(qn)
        desc = enriched.get(qn, (None,))[0] if qn in enriched else (ou.llm_description if ou else None)
        changed_units.append(ChangedUnit(
            qualname=qn,
            symbol_name=(pu or ou).symbol_name if (pu or ou) else qn.split("::")[-1],
            file_path=(pu or ou).file_path if (pu or ou) else "",
            kind=(pu or ou).kind if (pu or ou) else "",
            cluster_label=_unit_cluster(qn),
            change_type="modified",
            llm_description=desc,
        ))
    for qn in added_qualnames:
        pu = new_units_by_qualname[qn]
        desc = enriched.get(qn, (None,))[0] if qn in enriched else None
        changed_units.append(ChangedUnit(
            qualname=qn,
            symbol_name=pu.symbol_name,
            file_path=pu.file_path,
            kind=pu.kind,
            cluster_label=None,
            change_type="added",
            llm_description=desc,
        ))
    for qn in removed_qualnames:
        ou = old_by_qualname[qn]
        changed_units.append(ChangedUnit(
            qualname=qn,
            symbol_name=ou.symbol_name,
            file_path=ou.file_path,
            kind=ou.kind,
            cluster_label=_unit_cluster(qn),
            change_type="deleted",
            llm_description=ou.llm_description,
        ))

    impacted_units: list[ImpactedUnit] = []
    for qn, (et, dist) in ripple.items():
        ou = old_by_qualname.get(qn)
        if ou:
            impacted_units.append(ImpactedUnit(
                qualname=qn,
                symbol_name=ou.symbol_name,
                file_path=ou.file_path,
                kind=ou.kind,
                cluster_label=_unit_cluster(qn),
                edge_type=et,
                distance=dist,
                llm_description=ou.llm_description,
            ))

    cluster_counts: dict[str, dict] = defaultdict(lambda: {"changed": 0, "ripple": 0, "total": 0})
    for u in old_units:
        label = cluster_map.get(u.id, "unclustered")
        cluster_counts[label]["total"] += 1
    for cu in changed_units:
        label = cu.cluster_label or "unclustered"
        cluster_counts[label]["changed"] += 1
    for iu in impacted_units:
        label = iu.cluster_label or "unclustered"
        cluster_counts[label]["ripple"] += 1

    cluster_impact: list[ClusterImpact] = []
    for label, counts in cluster_counts.items():
        if counts["changed"] > 0 or counts["ripple"] > 0:
            total = max(counts["total"], 1)
            score = (counts["changed"] + counts["ripple"] * 0.5) / total
            cluster_impact.append(ClusterImpact(
                cluster=label,
                impact_score=round(min(score, 1.0), 2),
                changed_count=counts["changed"],
                ripple_count=counts["ripple"],
                total_count=counts["total"],
            ))
    cluster_impact.sort(key=lambda c: c.impact_score, reverse=True)

    num_clusters_hit = len(cluster_impact)
    max_score = cluster_impact[0].impact_score if cluster_impact else 0
    if num_clusters_hit > 3 or max_score > 0.8:
        risk = "critical"
    elif num_clusters_hit >= 2 or max_score > 0.5:
        risk = "high"
    elif max_score > 0.2:
        risk = "medium"
    else:
        risk = "low"

    labels = [risk + "-impact"]
    for ci in cluster_impact:
        if ci.cluster != "unclustered":
            labels.append(ci.cluster)
    if num_clusters_hit > 1:
        labels.append("cross-subsystem")

    added_edges_out = [
        GraphEdgeOut(source=s, target=t, edge_type=et)
        for s, t, et in (new_edge_set - old_edge_set)
    ]
    removed_edges_out = [
        GraphEdgeOut(source=s, target=t, edge_type=et)
        for s, t, et in (old_edge_set - new_edge_set)
    ]

    # Build overlay graph
    overlay_graph = _build_overlay_graph(
        old_units=old_units,
        old_by_qualname=old_by_qualname,
        new_units_by_qualname=new_units_by_qualname,
        carried_units=carried_units,
        cluster_map=cluster_map,
        modified_qualnames=set(modified_qualnames),
        added_qualnames=set(added_qualnames),
        removed_qualnames=set(removed_qualnames),
        ripple_qualnames=set(ripple.keys()),
        enriched=enriched,
        new_edge_set=new_edge_set,
    )

    return ImpactReport(
        mr_iid=request.mr_iid,
        risk_level=risk,
        changed_units=changed_units,
        impacted_units=impacted_units,
        cluster_impact=cluster_impact,
        suggested_labels=labels,
        graph_diff=GraphDiffOut(
            added_nodes=added_qualnames,
            removed_nodes=removed_qualnames,
            modified_nodes=modified_qualnames,
            added_edges=added_edges_out,
            removed_edges=removed_edges_out,
        ),
        overlay_graph=overlay_graph,
    )


def _build_overlay_graph(
    old_units: list[CodeUnit],
    old_by_qualname: dict[str, CodeUnit],
    new_units_by_qualname: dict[str, ParsedUnit],
    carried_units: dict[str, CodeUnit],
    cluster_map: dict[str, str],
    modified_qualnames: set[str],
    added_qualnames: set[str],
    removed_qualnames: set[str],
    ripple_qualnames: set[str],
    enriched: dict[str, tuple[str, float, float, float, float, float]],
    new_edge_set: set[tuple[str, str, str]],
) -> OverlayGraph:
    nodes: list[OverlayNode] = []

    for u in old_units:
        qn = u.qualname
        if qn in removed_qualnames:
            status = "deleted"
        elif qn in modified_qualnames:
            status = "changed"
        elif qn in ripple_qualnames:
            status = "ripple"
        else:
            status = "unaffected"

        if status == "changed" and qn in enriched:
            desc, x2d, y2d, x3d, y3d, z3d = enriched[qn]
        else:
            desc = u.llm_description
            x2d, y2d = u.x2d, u.y2d
            x3d, y3d, z3d = u.x3d, u.y3d, u.z3d

        nodes.append(OverlayNode(
            id=u.id,
            qualname=qn,
            symbol_name=u.symbol_name,
            file_path=u.file_path,
            kind=u.kind,
            runtime=u.runtime,
            x2d=x2d,
            y2d=y2d,
            x3d=x3d,
            y3d=y3d,
            z3d=z3d,
            llm_description=desc,
            cluster_label=cluster_map.get(u.id),
            impact_status=status,
        ))

    for qn in added_qualnames:
        pu = new_units_by_qualname[qn]
        if qn in enriched:
            desc, x2d, y2d, x3d, y3d, z3d = enriched[qn]
        else:
            desc, x2d, y2d, x3d, y3d, z3d = None, 0.0, 0.0, 0.0, 0.0, 0.0

        nodes.append(OverlayNode(
            id=f"mr-{pu.qualname}",
            qualname=qn,
            symbol_name=pu.symbol_name,
            file_path=pu.file_path,
            kind=pu.kind,
            runtime=pu.runtime,
            x2d=x2d,
            y2d=y2d,
            x3d=x3d,
            y3d=y3d,
            z3d=z3d,
            llm_description=desc,
            cluster_label=None,
            impact_status="added",
        ))

    all_overlay_qualnames = {n.qualname for n in nodes}
    edges: list[GraphEdgeOut] = [
        GraphEdgeOut(source=s, target=t, edge_type=et)
        for s, t, et in new_edge_set
        if s in all_overlay_qualnames and t in all_overlay_qualnames
    ]

    return OverlayGraph(nodes=nodes, edges=edges)
