from __future__ import annotations

import joblib
import numpy as np
import umap
from sqlmodel import Session, select

from app.core.config import DATA_DIR
from app.models import CodeUnit, ProjectGraphSnapshot

UMAP_RANDOM_STATE = 42
LAYOUT_EXTENT = 30.0


def _normalize(coords: np.ndarray, extent: float = LAYOUT_EXTENT) -> np.ndarray:
    mins = coords.min(axis=0)
    maxs = coords.max(axis=0)
    max_range = (maxs - mins).max() or 1.0
    return ((coords - mins) / max_range - 0.5) * (extent * 2)


def _fit_and_project(
    fit_matrix: np.ndarray,
    fit_hashes: list[str],
    historical_only: list[str],
    vectors: dict[str, list[float]],
    n_components: int,
    repo_id: str,
) -> dict[str, tuple[float, ...]]:
    n_neighbors = min(15, len(fit_matrix) - 1)
    reducer = umap.UMAP(
        n_components=n_components,
        random_state=UMAP_RANDOM_STATE,
        n_neighbors=n_neighbors,
        min_dist=0.4,
        spread=2.0,
    )
    fit_coords = reducer.fit_transform(fit_matrix)

    DATA_DIR.mkdir(exist_ok=True)
    joblib.dump(reducer, DATA_DIR / f"reducer_{n_components}d_{repo_id}.pkl")

    hist_coords = None
    if historical_only:
        hist_matrix = np.array([vectors[ch] for ch in historical_only])
        hist_coords = reducer.transform(hist_matrix)

    all_coords = np.vstack([fit_coords] + ([hist_coords] if hist_coords is not None else []))
    all_coords = _normalize(all_coords)

    fit_coords = all_coords[: len(fit_hashes)]
    if hist_coords is not None:
        hist_coords = all_coords[len(fit_hashes) :]

    hash_to_pos: dict[str, tuple[float, ...]] = {}
    for i, ch in enumerate(fit_hashes):
        hash_to_pos[ch] = tuple(float(v) for v in fit_coords[i])

    if hist_coords is not None:
        for i, ch in enumerate(historical_only):
            hash_to_pos[ch] = tuple(float(v) for v in hist_coords[i])

    return hash_to_pos


def compute_layout(
    repo_id: str,
    vectors: dict[str, list[float]],
    session: Session,
) -> int:
    snapshots = session.exec(
        select(ProjectGraphSnapshot)
        .where(ProjectGraphSnapshot.repo_id == repo_id)
        .order_by(ProjectGraphSnapshot.created_at.asc())
    ).all()
    if not snapshots:
        return 0

    latest = snapshots[-1]
    latest_units = session.exec(
        select(CodeUnit).where(CodeUnit.snapshot_id == latest.id)
    ).all()

    HUB_LAYOUT_THRESHOLD = 0.3
    hub_hashes: set[str] = set()
    for u in latest_units:
        if u.hub_score > HUB_LAYOUT_THRESHOLD:
            hub_hashes.add(u.code_hash)

    fit_hashes: list[str] = []
    fit_rows: list[list[float]] = []
    for u in latest_units:
        if u.code_hash in hub_hashes:
            continue
        if u.code_hash in vectors and u.code_hash not in fit_hashes:
            fit_hashes.append(u.code_hash)
            fit_rows.append(vectors[u.code_hash])

    if len(fit_rows) < 5:
        return 0

    fit_matrix = np.array(fit_rows)

    all_hashes_in_history: set[str] = set()
    for snap in snapshots[:-1]:
        hist_units = session.exec(
            select(CodeUnit.code_hash)
            .where(CodeUnit.snapshot_id == snap.id)
            .distinct()
        ).all()
        all_hashes_in_history.update(hist_units)

    historical_only = [
        ch for ch in all_hashes_in_history
        if ch not in set(fit_hashes) and ch in vectors
    ]

    pos_2d = _fit_and_project(fit_matrix, fit_hashes, historical_only, vectors, 2, repo_id)
    pos_3d = _fit_and_project(fit_matrix, fit_hashes, historical_only, vectors, 3, repo_id)

    updated = 0
    for snap in snapshots:
        snap_units = session.exec(
            select(CodeUnit).where(CodeUnit.snapshot_id == snap.id)
        ).all()
        for u in snap_units:
            p2 = pos_2d.get(u.code_hash)
            p3 = pos_3d.get(u.code_hash)
            if p2 or p3:
                if p2:
                    u.x2d = p2[0]
                    u.y2d = p2[1]
                if p3:
                    u.x3d = p3[0]
                    u.y3d = p3[1]
                    u.z3d = p3[2]
                session.add(u)
                updated += 1

    session.commit()
    return updated
