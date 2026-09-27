from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.core.database import get_session
from app.models import Repo
from app.schemas.api import (
    SearchRequest,
    SearchResponse,
    SearchResult,
    TraverseEdge,
    TraverseNode,
    TraverseRequest,
    TraverseResponse,
)

logger = logging.getLogger("blastradius.search")

router = APIRouter(prefix="/api/repos/{repo_id}", tags=["search"])


def _get_snapshot(repo_id: str, snapshot_id: str | None, session: Session) -> ProjectGraphSnapshot:
    if snapshot_id:
        snap = session.get(ProjectGraphSnapshot, snapshot_id)
        if not snap or snap.repo_id != repo_id:
            raise HTTPException(404, "Snapshot not found")
        return snap
    snap = session.exec(
        select(ProjectGraphSnapshot)
        .where(ProjectGraphSnapshot.repo_id == repo_id)
        .order_by(ProjectGraphSnapshot.created_at.desc())
    ).first()
    if not snap:
        raise HTTPException(400, "No snapshots found")
    return snap


@router.post("/search", response_model=SearchResponse)
async def search_nodes(
    repo_id: str,
    body: SearchRequest,
    session: Session = Depends(get_session),
):
    from app.services.search import vector_search as vs, get_latest_snapshot

    repo = session.get(Repo, repo_id)
    if not repo:
        raise HTTPException(404, "Repo not found")

    snap = get_latest_snapshot(repo_id, body.snapshot_id, session)
    if not snap:
        raise HTTPException(400, "No snapshots found")

    queries = body.queries or ([body.query] if body.query else [])
    if not queries:
        raise HTTPException(400, "No query provided")

    results = await vs(repo_id, snap, queries, body.top_k, session)
    return SearchResponse(results=[SearchResult(**r) for r in results])


@router.post("/traverse", response_model=TraverseResponse)
def traverse_graph_endpoint(
    repo_id: str,
    body: TraverseRequest,
    session: Session = Depends(get_session),
):
    from app.services.search import graph_traverse as gt, get_latest_snapshot

    repo = session.get(Repo, repo_id)
    if not repo:
        raise HTTPException(404, "Repo not found")

    snap = get_latest_snapshot(repo_id, body.snapshot_id, session)
    if not snap:
        raise HTTPException(400, "No snapshots found")

    result = gt(snap, body.seed_ids, body.mode, body.direction, body.max_depth, body.max_nodes, session)
    return TraverseResponse(
        nodes=[TraverseNode(**n) for n in result["nodes"]],
        edges=[TraverseEdge(**e) for e in result["edges"]],
    )
