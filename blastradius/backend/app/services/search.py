from __future__ import annotations

import json
import logging
from collections import defaultdict

import numpy as np
from openai import AsyncOpenAI
from sqlmodel import Session, select

from app.core.config import DATA_DIR, OPENAI_API_KEY
from app.models import CodeUnit, GraphEdge, ProjectGraphSnapshot

logger = logging.getLogger("blastradius.search")


def get_latest_snapshot(repo_id: str, snapshot_id: str | None, session: Session) -> ProjectGraphSnapshot | None:
    if snapshot_id:
        snap = session.get(ProjectGraphSnapshot, snapshot_id)
        if snap and snap.repo_id == repo_id:
            return snap
        return None
    main_snap = session.exec(
        select(ProjectGraphSnapshot)
        .where(ProjectGraphSnapshot.repo_id == repo_id, ProjectGraphSnapshot.branch_name == "main")
        .order_by(ProjectGraphSnapshot.created_at.desc())
    ).first()
    if main_snap:
        return main_snap
    return session.exec(
        select(ProjectGraphSnapshot)
        .where(ProjectGraphSnapshot.repo_id == repo_id)
        .order_by(ProjectGraphSnapshot.created_at.desc())
    ).first()


async def vector_search(
    repo_id: str,
    snapshot: ProjectGraphSnapshot,
    queries: list[str],
    top_k: int,
    session: Session,
) -> list[dict]:
    vectors_path = DATA_DIR / f"vectors_{repo_id}.npy"
    index_path = DATA_DIR / f"vectors_{repo_id}_index.json"
    if not vectors_path.exists() or not index_path.exists():
        return []

    matrix = np.load(str(vectors_path))
    with open(index_path) as f:
        hash_to_idx: dict[str, int] = json.load(f)

    client = AsyncOpenAI(api_key=OPENAI_API_KEY)
    resp = await client.embeddings.create(input=queries, model="text-embedding-3-small", dimensions=768)
    query_vecs = [np.array(d.embedding) for d in sorted(resp.data, key=lambda d: d.index)]

    units = session.exec(select(CodeUnit).where(CodeUnit.snapshot_id == snapshot.id)).all()
    unit_by_id = {u.id: u for u in units}
    hash_to_units: dict[str, list[CodeUnit]] = defaultdict(list)
    for u in units:
        hash_to_units[u.code_hash].append(u)

    snapshot_indices = [hash_to_idx[h] for h in hash_to_units if h in hash_to_idx]
    if not snapshot_indices:
        return []

    norms = np.linalg.norm(matrix, axis=1)
    idx_to_hash = {v: k for k, v in hash_to_idx.items()}

    mask_template = np.full(len(norms), -np.inf)
    for idx in snapshot_indices:
        mask_template[idx] = 0.0

    best_sim: dict[str, float] = {}
    for qv in query_vecs:
        sims = (matrix @ qv) / (norms * np.linalg.norm(qv) + 1e-10)
        masked = np.where(mask_template == 0.0, sims, -np.inf)
        top_indices = np.argsort(masked)[::-1][:top_k]
        for i in top_indices:
            idx = int(i)
            if masked[idx] == -np.inf:
                break
            ch = idx_to_hash.get(idx)
            if not ch:
                continue
            for u in hash_to_units.get(ch, []):
                if u.id not in best_sim or masked[idx] > best_sim[u.id]:
                    best_sim[u.id] = float(masked[idx])
                break

    edges = session.exec(select(GraphEdge).where(GraphEdge.snapshot_id == snapshot.id)).all()
    adj_out: dict[str, list[GraphEdge]] = defaultdict(list)
    adj_in: dict[str, list[GraphEdge]] = defaultdict(list)
    for e in edges:
        adj_out[e.source_unit_id].append(e)
        adj_in[e.target_unit_id].append(e)

    HUB_THRESHOLD = 0.15
    sorted_units = sorted(best_sim.items(), key=lambda x: -x[1])[:top_k]

    results: list[dict] = []
    for uid, sim in sorted_units:
        u = unit_by_id.get(uid)
        if not u:
            continue
        neighbors = []
        for e in adj_out.get(u.id, [])[:5]:
            t = unit_by_id.get(e.target_unit_id)
            if t and t.hub_score <= HUB_THRESHOLD:
                neighbors.append({"id": t.id, "qualname": t.qualname, "symbol_name": t.symbol_name, "kind": t.kind, "llm_description": t.llm_description, "edge_type": e.edge_type, "direction": "outgoing"})
        for e in adj_in.get(u.id, [])[:5]:
            s = unit_by_id.get(e.source_unit_id)
            if s and s.hub_score <= HUB_THRESHOLD:
                neighbors.append({"id": s.id, "qualname": s.qualname, "symbol_name": s.symbol_name, "kind": s.kind, "llm_description": s.llm_description, "edge_type": e.edge_type, "direction": "incoming"})
        results.append({
            "id": u.id, "qualname": u.qualname, "symbol_name": u.symbol_name,
            "file_path": u.file_path, "kind": u.kind,
            "llm_description": u.llm_description, "similarity": round(sim, 4),
            "neighbors": neighbors,
        })

    logger.info(f"search queries={queries} top_k={top_k} results={len(results)}")
    return results


def graph_traverse(
    snapshot: ProjectGraphSnapshot,
    seed_ids: list[str],
    mode: str,
    direction: str,
    max_depth: int,
    max_nodes: int,
    session: Session,
) -> dict:
    HUB_THRESHOLD = 0.15
    max_depth = min(max_depth, 5)
    max_nodes = min(max_nodes, 50)

    units = session.exec(select(CodeUnit).where(CodeUnit.snapshot_id == snapshot.id)).all()
    unit_by_id = {u.id: u for u in units}
    hub_ids = {u.id for u in units if u.hub_score > HUB_THRESHOLD}
    seed_set_for_hub = set(seed_ids)

    edges = session.exec(select(GraphEdge).where(GraphEdge.snapshot_id == snapshot.id)).all()

    adj: dict[str, list[tuple[str, GraphEdge]]] = defaultdict(list)
    for e in edges:
        if mode == "expand":
            if direction in ("outgoing", "both"):
                adj[e.source_unit_id].append((e.target_unit_id, e))
            if direction in ("incoming", "both"):
                adj[e.target_unit_id].append((e.source_unit_id, e))
        else:
            adj[e.source_unit_id].append((e.target_unit_id, e))
            adj[e.target_unit_id].append((e.source_unit_id, e))

    seed_set = set(seed_ids)
    visited: dict[str, int] = {}
    parent: dict[str, str | None] = {}

    if mode == "connect":
        origin: dict[str, str] = {}
        frontier: list[tuple[str, int, str]] = []
        for sid in seed_ids:
            if sid in unit_by_id:
                visited[sid] = 0
                origin[sid] = sid
                frontier.append((sid, 0, sid))

        bridge_nodes: set[str] = set()
        while frontier and len(visited) < max_nodes:
            next_frontier: list[tuple[str, int, str]] = []
            for node_id, depth, orig in frontier:
                if depth >= max_depth:
                    continue
                for neighbor_id, edge in adj.get(node_id, []):
                    if neighbor_id in hub_ids and neighbor_id not in seed_set_for_hub:
                        continue
                    if neighbor_id in visited:
                        if origin.get(neighbor_id) != orig:
                            bridge_nodes.add(neighbor_id)
                            bridge_nodes.add(node_id)
                        continue
                    if len(visited) >= max_nodes:
                        break
                    visited[neighbor_id] = depth + 1
                    origin[neighbor_id] = orig
                    parent[neighbor_id] = node_id
                    next_frontier.append((neighbor_id, depth + 1, orig))
            frontier = next_frontier

        result_ids = set(seed_set)
        for bid in bridge_nodes:
            cur: str | None = bid
            while cur and cur not in seed_set:
                result_ids.add(cur)
                cur = parent.get(cur)
            if cur:
                result_ids.add(cur)
        result_ids.update(seed_set & set(unit_by_id.keys()))
    else:
        frontier_list: list[tuple[str, int]] = []
        for sid in seed_ids:
            if sid in unit_by_id:
                visited[sid] = 0
                frontier_list.append((sid, 0))

        while frontier_list and len(visited) < max_nodes:
            next_list: list[tuple[str, int]] = []
            for node_id, depth in frontier_list:
                if depth >= max_depth:
                    continue
                for neighbor_id, edge in adj.get(node_id, []):
                    if neighbor_id in hub_ids and neighbor_id not in seed_set_for_hub:
                        continue
                    if neighbor_id in visited:
                        continue
                    if len(visited) >= max_nodes:
                        break
                    visited[neighbor_id] = depth + 1
                    next_list.append((neighbor_id, depth + 1))
            frontier_list = next_list

        result_ids = set(visited.keys())

    result_nodes = []
    for uid in result_ids:
        u = unit_by_id.get(uid)
        if u:
            result_nodes.append({
                "id": u.id, "qualname": u.qualname, "symbol_name": u.symbol_name,
                "file_path": u.file_path, "kind": u.kind,
                "llm_description": u.llm_description, "is_seed": u.id in seed_set,
            })

    result_edges = []
    for e in edges:
        if e.source_unit_id in result_ids and e.target_unit_id in result_ids:
            s = unit_by_id.get(e.source_unit_id)
            t = unit_by_id.get(e.target_unit_id)
            if s and t:
                result_edges.append({
                    "source_id": s.id, "target_id": t.id,
                    "source_qualname": s.qualname, "target_qualname": t.qualname,
                    "edge_type": e.edge_type,
                })

    logger.info(f"traverse mode={mode} seeds={len(seed_ids)} nodes={len(result_nodes)} edges={len(result_edges)}")
    return {"nodes": result_nodes, "edges": result_edges}
