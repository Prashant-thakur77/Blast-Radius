from __future__ import annotations

import re
from collections import Counter

import numpy as np
import hdbscan
from sqlmodel import Session, select

from app.models import ClusterMember, CodeUnit, FeatureCluster

_API_RESOURCE_DOMAINS = {
    "tasks": "tasks",
    "comments": "comments",
    "notifications": "notifications",
    "projects": "projects",
    "members": "workspace",
    "workspaces": "workspace",
    "search": "search",
    "activity": "activity",
}


def cluster_snapshot(
    snapshot_id: str,
    vectors: dict[str, list[float]],
    session: Session,
    min_cluster_size: int = 5,
) -> int:
    units = session.exec(
        select(CodeUnit).where(CodeUnit.snapshot_id == snapshot_id)
    ).all()

    HUB_CLUSTER_THRESHOLD = 0.3
    indexed_units: list[CodeUnit] = []
    matrix_rows: list[list[float]] = []
    for u in units:
        if u.hub_score > HUB_CLUSTER_THRESHOLD:
            continue
        vec = vectors.get(u.code_hash)
        if vec is not None:
            indexed_units.append(u)
            matrix_rows.append(vec)

    if len(indexed_units) < min_cluster_size:
        return 0

    matrix = np.array(matrix_rows)

    clusterer = hdbscan.HDBSCAN(
        min_cluster_size=min_cluster_size,
        min_samples=2,
        metric="euclidean",
    )
    labels = clusterer.fit_predict(matrix)

    _clear_clusters(snapshot_id, session)

    cluster_groups: dict[int, list[int]] = {}
    for i, label in enumerate(labels):
        if label >= 0:
            cluster_groups.setdefault(label, []).append(i)

    for label_idx, member_indices in cluster_groups.items():
        cluster_vecs = matrix[member_indices]
        centroid_vec = cluster_vecs.mean(axis=0)
        distances = np.linalg.norm(cluster_vecs - centroid_vec, axis=1)
        centroid_local = int(np.argmin(distances))
        centroid_unit = indexed_units[member_indices[centroid_local]]

        member_units = [indexed_units[i] for i in member_indices]

        cluster = FeatureCluster(
            snapshot_id=snapshot_id,
            method="hdbscan",
            method_version="2",
            label=_derive_cluster_label(member_units, centroid_unit),
            centroid_unit_id=centroid_unit.id,
        )
        session.add(cluster)
        session.flush()

        for idx in member_indices:
            session.add(ClusterMember(
                cluster_id=cluster.id,
                code_unit_id=indexed_units[idx].id,
            ))

    session.commit()
    return len(cluster_groups)


def _clear_clusters(snapshot_id: str, session: Session):
    existing = session.exec(
        select(FeatureCluster).where(FeatureCluster.snapshot_id == snapshot_id)
    ).all()
    for c in existing:
        members = session.exec(
            select(ClusterMember).where(ClusterMember.cluster_id == c.id)
        ).all()
        for m in members:
            session.delete(m)
        session.delete(c)
    session.commit()


def _extract_domain(file_path: str) -> str | None:
    parts = file_path.split("/")

    for i, p in enumerate(parts):
        if p == "features" and i + 1 < len(parts):
            return parts[i + 1]

    if "app/api" in file_path or "app\\api" in file_path:
        for segment in reversed(parts):
            if segment.startswith("["):
                continue
            domain = _API_RESOURCE_DOMAINS.get(segment)
            if domain:
                return domain
        for i, p in enumerate(parts):
            if p == "api" and i + 1 < len(parts):
                seg = parts[i + 1]
                if not seg.startswith("["):
                    return seg

    m = re.search(r"app/\((\w+)\)", file_path)
    if m:
        group_name = m.group(1)
        if group_name == "auth":
            return "auth"
        if group_name == "app":
            for i, p in enumerate(parts):
                if p == "(app)" and i + 1 < len(parts):
                    seg = parts[i + 1]
                    if seg.startswith("["):
                        if i + 2 < len(parts):
                            return parts[i + 2]
                    else:
                        return seg

    if "components/ui" in file_path:
        return None

    return None


def _derive_cluster_label(members: list[CodeUnit], centroid: CodeUnit) -> str:
    votes: list[str] = []
    feature_votes: list[str] = []

    for unit in members:
        domain = _extract_domain(unit.file_path)
        if domain:
            votes.append(domain)
            if "/features/" in unit.file_path:
                feature_votes.append(domain)

    if not votes:
        parts = centroid.file_path.split("/")
        if len(parts) >= 2:
            return parts[-2]
        return centroid.kind

    counter = Counter(votes)
    top_count = counter.most_common(1)[0][1]
    tied = [label for label, count in counter.items() if count == top_count]

    if len(tied) == 1:
        return tied[0]

    if feature_votes:
        feature_counter = Counter(feature_votes)
        for label, _ in feature_counter.most_common():
            if label in tied:
                return label

    return tied[0]
