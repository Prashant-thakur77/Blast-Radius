from __future__ import annotations

import numpy as np
import umap
from sklearn.cluster import KMeans
from sqlmodel import Session, select

from app.models import (
    ClusterMember,
    CodeUnit,
    EmbeddingRecord,
    FeatureCluster,
    ProjectGraphSnapshot,
)
from app.services.embedding.worker import generate_embeddings
from app.services.llm.worker import generate_descriptions
from app.services.parser.types import ParsedUnit

N_CLUSTERS = 8
UMAP_RANDOM_STATE = 42


async def enrich_snapshot(snapshot_id: str, session: Session) -> dict:
    units = session.exec(
        select(CodeUnit).where(CodeUnit.snapshot_id == snapshot_id)
    ).all()

    needs_description = [u for u in units if not u.llm_description]
    desc_count = 0

    if needs_description:
        parsed = [
            ParsedUnit(
                file_path=u.file_path,
                symbol_name=u.symbol_name,
                qualname=u.qualname,
                kind=u.kind,
                runtime=u.runtime,
                language=u.language,
                start_line=u.start_line,
                end_line=u.end_line,
                code_hash=u.code_hash,
                source_text=u.source_text,
            )
            for u in needs_description
        ]
        descriptions = await generate_descriptions(parsed)
        for u in needs_description:
            desc = descriptions.get(u.qualname)
            if desc:
                u.llm_description = desc
                session.add(u)
                desc_count += 1
        session.commit()
        units = session.exec(
            select(CodeUnit).where(CodeUnit.snapshot_id == snapshot_id)
        ).all()

    units_with_desc = [u for u in units if u.llm_description]
    if not units_with_desc:
        return {"descriptions": desc_count, "embeddings": 0, "clusters": 0, "layout": False}

    desc_map = {u.qualname: u.llm_description for u in units_with_desc}
    vectors = await generate_embeddings(desc_map)

    qualnames = list(vectors.keys())
    matrix = np.array([vectors[qn] for qn in qualnames])

    unit_by_qn = {u.qualname: u for u in units_with_desc}

    for i, qn in enumerate(qualnames):
        u = unit_by_qn[qn]
        record = EmbeddingRecord(
            snapshot_id=snapshot_id,
            code_unit_id=u.id,
            source_kind="description",
            model_name="text-embedding-3-small",
            model_version="1",
            source_hash=u.code_hash,
            vector_index=i,
        )
        session.add(record)
        session.flush()
        u.embedding_id = record.id
        session.add(u)

    session.commit()

    n_clusters = min(N_CLUSTERS, len(matrix))
    kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
    labels = kmeans.fit_predict(matrix)

    session.exec(
        select(ClusterMember).where(
            ClusterMember.cluster_id.in_(
                select(FeatureCluster.id).where(FeatureCluster.snapshot_id == snapshot_id)
            )
        )
    )
    existing_clusters = session.exec(
        select(FeatureCluster).where(FeatureCluster.snapshot_id == snapshot_id)
    ).all()
    for c in existing_clusters:
        members = session.exec(
            select(ClusterMember).where(ClusterMember.cluster_id == c.id)
        ).all()
        for m in members:
            session.delete(m)
        session.delete(c)
    session.commit()

    cluster_objects: dict[int, FeatureCluster] = {}
    for label_idx in range(n_clusters):
        member_indices = [i for i, l in enumerate(labels) if l == label_idx]
        if not member_indices:
            continue
        centroid_idx = member_indices[0]
        min_dist = float("inf")
        centroid_vec = kmeans.cluster_centers_[label_idx]
        for idx in member_indices:
            dist = np.linalg.norm(matrix[idx] - centroid_vec)
            if dist < min_dist:
                min_dist = dist
                centroid_idx = idx
        centroid_unit = unit_by_qn[qualnames[centroid_idx]]
        cluster_label = _derive_cluster_label(centroid_unit)
        cluster = FeatureCluster(
            snapshot_id=snapshot_id,
            method="kmeans",
            method_version="1",
            label=cluster_label,
            centroid_unit_id=centroid_unit.id,
        )
        session.add(cluster)
        session.flush()
        cluster_objects[label_idx] = cluster

    for i, qn in enumerate(qualnames):
        u = unit_by_qn[qn]
        cluster = cluster_objects.get(labels[i])
        if cluster:
            member = ClusterMember(cluster_id=cluster.id, code_unit_id=u.id)
            session.add(member)

    session.commit()

    return {
        "descriptions": desc_count,
        "embeddings": len(vectors),
        "clusters": n_clusters,
        "layout": False,
    }


def compute_layout_all_snapshots(repo_id: str, session: Session) -> int:
    snapshots = session.exec(
        select(ProjectGraphSnapshot)
        .where(ProjectGraphSnapshot.repo_id == repo_id)
        .order_by(ProjectGraphSnapshot.created_at.asc())
    ).all()

    if not snapshots:
        return 0

    latest = snapshots[-1]
    latest_units = session.exec(
        select(CodeUnit).where(
            CodeUnit.snapshot_id == latest.id,
            CodeUnit.embedding_id.isnot(None),
        )
    ).all()

    if len(latest_units) < 3:
        return 0

    latest_records = session.exec(
        select(EmbeddingRecord).where(EmbeddingRecord.snapshot_id == latest.id)
    ).all()
    record_by_unit = {r.code_unit_id: r for r in latest_records}

    all_records = session.exec(select(EmbeddingRecord)).all()
    all_vectors_by_snapshot: dict[str, list] = {}
    for r in all_records:
        all_vectors_by_snapshot.setdefault(r.snapshot_id, []).append(r)

    latest_qn_order = []
    latest_vectors = []
    for u in latest_units:
        rec = record_by_unit.get(u.id)
        if rec:
            latest_qn_order.append(u.qualname)

    if not latest_qn_order:
        return 0

    np_file = None
    import os
    from pathlib import Path
    data_dir = Path(__file__).parent.parent / "data"
    for f in ["vectors_pulse.npy"]:
        p = data_dir / f
        if p.exists():
            np_file = p
            break

    if np_file is None:
        return 0

    all_vecs = np.load(str(np_file))
    import json
    index_file = data_dir / "vectors_pulse_index.json"
    if not index_file.exists():
        return 0
    with open(index_file) as f:
        vec_index = json.load(f)

    fit_qualnames = [qn for qn in latest_qn_order if qn in vec_index]
    if len(fit_qualnames) < 3:
        return 0

    fit_matrix = np.array([all_vecs[vec_index[qn]] for qn in fit_qualnames])

    reducer = umap.UMAP(n_components=2, random_state=UMAP_RANDOM_STATE, n_neighbors=min(15, len(fit_matrix) - 1))
    coords_2d = reducer.fit_transform(fit_matrix)

    qn_to_pos: dict[str, tuple[float, float]] = {}
    for i, qn in enumerate(fit_qualnames):
        qn_to_pos[qn] = (float(coords_2d[i][0]), float(coords_2d[i][1]))

    updated = 0
    for snap in snapshots:
        snap_units = session.exec(
            select(CodeUnit).where(CodeUnit.snapshot_id == snap.id)
        ).all()
        for u in snap_units:
            pos = qn_to_pos.get(u.qualname)
            if pos:
                pass
        snap_qns = [u.qualname for u in snap_units if u.qualname in vec_index]
        if not snap_qns:
            continue
        snap_matrix = np.array([all_vecs[vec_index[qn]] for qn in snap_qns])
        try:
            snap_coords = reducer.transform(snap_matrix)
        except Exception:
            continue
        for i, qn in enumerate(snap_qns):
            qn_to_pos[qn] = (float(snap_coords[i][0]), float(snap_coords[i][1]))
        updated += 1

    for snap in snapshots:
        snap_units = session.exec(
            select(CodeUnit).where(CodeUnit.snapshot_id == snap.id)
        ).all()
        for u in snap_units:
            pos = qn_to_pos.get(u.qualname)
            if pos:
                u.source_text = u.source_text
                session.execute(
                    CodeUnit.__table__.update()
                    .where(CodeUnit.__table__.c.id == u.id)
                    .values(source_text=u.source_text)
                )

    session.commit()
    return updated


def _derive_cluster_label(unit: CodeUnit) -> str:
    parts = unit.file_path.split("/")
    for i, p in enumerate(parts):
        if p == "features" and i + 1 < len(parts):
            return parts[i + 1]
        if p == "api" and i + 1 < len(parts):
            return parts[i + 1]
    if len(parts) >= 2:
        return parts[-2]
    return unit.kind
