from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.core.database import get_session
from sqlalchemy import func

from app.models import (
    ClusterMember,
    CodeUnit,
    FeatureCluster,
    GraphEdge,
    ProjectGraphSnapshot,
    Repo,
)
from app.schemas.api import (
    CodeUnitOut,
    GraphEdgeOut,
    GraphOut,
    SnapshotSummary,
)

router = APIRouter(prefix="/api/repos/{repo_id}", tags=["graph"])


def _get_latest_snapshot(
    repo_id: str, session: Session
) -> ProjectGraphSnapshot:
    snap = session.exec(
        select(ProjectGraphSnapshot)
        .where(ProjectGraphSnapshot.repo_id == repo_id)
        .order_by(ProjectGraphSnapshot.created_at.desc())
    ).first()
    if not snap:
        raise HTTPException(404, "No snapshots found")
    return snap


def _cluster_map(snapshot_id: str, session: Session) -> dict[str, str]:
    clusters = session.exec(
        select(FeatureCluster).where(FeatureCluster.snapshot_id == snapshot_id)
    ).all()
    if not clusters:
        return {}
    result: dict[str, str] = {}
    for cluster in clusters:
        members = session.exec(
            select(ClusterMember).where(ClusterMember.cluster_id == cluster.id)
        ).all()
        for m in members:
            result[m.code_unit_id] = cluster.label
    return result


@router.get("/snapshots", response_model=list[SnapshotSummary])
def list_snapshots(repo_id: str, branch: str | None = None, session: Session = Depends(get_session)):
    repo = session.get(Repo, repo_id)
    if not repo:
        raise HTTPException(404, "Repo not found")
    query = select(ProjectGraphSnapshot).where(ProjectGraphSnapshot.repo_id == repo_id)
    if branch:
        query = query.where(ProjectGraphSnapshot.branch_name == branch)
    snaps = session.exec(query.order_by(ProjectGraphSnapshot.commit_time.asc())).all()

    snap_ids = [s.id for s in snaps]
    unit_counts: dict[str, int] = {}
    edge_counts: dict[str, int] = {}
    if snap_ids:
        for sid, cnt in session.exec(
            select(CodeUnit.snapshot_id, func.count()).where(CodeUnit.snapshot_id.in_(snap_ids)).group_by(CodeUnit.snapshot_id)
        ):
            unit_counts[sid] = cnt
        for sid, cnt in session.exec(
            select(GraphEdge.snapshot_id, func.count()).where(GraphEdge.snapshot_id.in_(snap_ids)).group_by(GraphEdge.snapshot_id)
        ):
            edge_counts[sid] = cnt

    return [
        SnapshotSummary(
            id=s.id,
            commit_sha=s.commit_sha,
            commit_message=s.commit_message,
            commit_time=s.commit_time.isoformat(),
            branch_name=s.branch_name,
            parent_snapshot_id=s.parent_snapshot_id,
            unit_count=unit_counts.get(s.id, 0),
            edge_count=edge_counts.get(s.id, 0),
            units_added=s.units_added,
            units_modified=s.units_modified,
            units_removed=s.units_removed,
        )
        for s in snaps
    ]


@router.get("/graph", response_model=GraphOut)
def get_graph(
    repo_id: str,
    snapshot_id: str | None = None,
    session: Session = Depends(get_session),
):
    if snapshot_id:
        snap = session.get(ProjectGraphSnapshot, snapshot_id)
        if not snap or snap.repo_id != repo_id:
            raise HTTPException(404, "Snapshot not found")
    else:
        snap = _get_latest_snapshot(repo_id, session)

    units = session.exec(
        select(CodeUnit).where(CodeUnit.snapshot_id == snap.id)
    ).all()
    edges = session.exec(
        select(GraphEdge).where(GraphEdge.snapshot_id == snap.id)
    ).all()

    cluster_labels = _cluster_map(snap.id, session)

    nodes = [
        CodeUnitOut(
            id=u.id,
            qualname=u.qualname,
            symbol_name=u.symbol_name,
            file_path=u.file_path,
            kind=u.kind,
            runtime=u.runtime,
            start_line=u.start_line,
            end_line=u.end_line,
            llm_description=u.llm_description,
            cluster_label=cluster_labels.get(u.id),
            hub_score=u.hub_score,
            x2d=u.x2d,
            y2d=u.y2d,
            x3d=u.x3d,
            y3d=u.y3d,
            z3d=u.z3d,
        )
        for u in units
    ]

    edge_list = [
        GraphEdgeOut(
            source=e.source_unit_id,
            target=e.target_unit_id,
            edge_type=e.edge_type,
        )
        for e in edges
    ]

    return GraphOut(
        snapshot_id=snap.id,
        commit_sha=snap.commit_sha,
        nodes=nodes,
        edges=edge_list,
    )
