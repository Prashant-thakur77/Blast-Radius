from __future__ import annotations

import json
import logging

import numpy as np
from sqlmodel import Session, select

from openai import AsyncOpenAI

from app.core.config import DATA_DIR, OPENAI_API_KEY
from collections import Counter

from app.models import CodeUnit, GraphEdge, FeatureCluster, ClusterMember, ProjectGraphSnapshot, Repo
from app.services.cost import persist_tracker, start_tracker
from app.services.embedding.worker import generate_embeddings
from app.services.enrichment.clustering import cluster_snapshot
from app.services.enrichment.descriptions import generate_all_descriptions
from app.services.enrichment.layout import compute_layout

logger = logging.getLogger("blastradius.enrich")


async def enrich_repo(repo_id: str, session: Session) -> dict:
    """Run the full enrichment pipeline for a repo.

    Steps:
        1. Generate LLM descriptions for all undescribed units (deduped by code_hash)
        2. Generate embeddings from descriptions (deduped by code_hash)
        3. Cluster the latest snapshot using HDBSCAN
        4. Compute UMAP layout for all snapshots (fit on latest, transform all)

    Returns:
        Summary dict with counts for each step.
    """
    tracker = start_tracker("enrich", repo_id)
    logger.info(f"starting enrichment for repo={repo_id}")

    desc_count = await generate_all_descriptions(repo_id, session)
    logger.info(f"descriptions: {desc_count} unique hashes described")

    vectors = await _generate_all_embeddings(repo_id, session)
    logger.info(f"embeddings: {len(vectors)} vectors generated")

    latest = session.exec(
        select(ProjectGraphSnapshot)
        .where(ProjectGraphSnapshot.repo_id == repo_id)
        .order_by(ProjectGraphSnapshot.created_at.desc())
    ).first()

    hub_count = 0
    snapshots = session.exec(
        select(ProjectGraphSnapshot)
        .where(ProjectGraphSnapshot.repo_id == repo_id)
    ).all()
    for snap in snapshots:
        hub_count += _compute_hub_scores(snap.id, session)
    logger.info(f"hub scores: {hub_count} hub nodes detected")

    cluster_count = 0
    if vectors:
        for snap in snapshots:
            cluster_count += cluster_snapshot(snap.id, vectors, session)
    logger.info(f"clustering: {cluster_count} clusters across {len(snapshots)} snapshots")

    layout_count = 0
    if vectors:
        layout_count = compute_layout(repo_id, vectors, session)
    logger.info(f"layout: {layout_count} units positioned")

    repo = session.get(Repo, repo_id)
    if repo and latest:
        welcome = await _generate_welcome(repo, latest, session)
        repo.welcome_message = welcome
        session.add(repo)
        session.commit()
        logger.info(f"welcome message generated ({len(welcome)} chars)")

    cost_record = persist_tracker(tracker, session)

    return {
        "descriptions": desc_count,
        "embeddings": len(vectors),
        "clusters": cluster_count,
        "layout_units_updated": layout_count,
        "cost_usd": cost_record.total_cost_usd,
        "duration_seconds": cost_record.duration_seconds,
        "tokens": {
            "llm_input": cost_record.llm_input_tokens,
            "llm_output": cost_record.llm_output_tokens,
            "embedding_input": cost_record.embedding_input_tokens,
        },
    }


HUB_THRESHOLD = 0.15


def _compute_hub_scores(snapshot_id: str, session: Session) -> int:
    edges = session.exec(
        select(GraphEdge).where(GraphEdge.snapshot_id == snapshot_id)
    ).all()
    units = session.exec(
        select(CodeUnit).where(CodeUnit.snapshot_id == snapshot_id)
    ).all()

    if not edges or not units:
        return 0

    in_degree: Counter[str] = Counter()
    for e in edges:
        in_degree[e.target_unit_id] += 1

    max_deg = max(in_degree.values()) if in_degree else 1
    hub_count = 0

    for u in units:
        score = in_degree.get(u.id, 0) / max_deg
        u.hub_score = round(score, 4)
        if score > HUB_THRESHOLD:
            hub_count += 1
        session.add(u)

    session.commit()
    return hub_count


async def _generate_all_embeddings(
    repo_id: str,
    session: Session,
) -> dict[str, list[float]]:
    """Generate embeddings for all described units, deduped by code_hash.

    Persists vectors to disk as numpy array + JSON index for reuse.

    Returns:
        {code_hash: vector} mapping.
    """
    all_units = session.exec(
        select(CodeUnit).where(CodeUnit.llm_description.isnot(None))
    ).all()

    if not all_units:
        return {}

    # Deduplicate by code_hash
    by_hash: dict[str, str] = {}
    for u in all_units:
        if u.code_hash not in by_hash:
            by_hash[u.code_hash] = u.llm_description

    raw_vectors = await generate_embeddings(by_hash)

    # raw_vectors is keyed by code_hash (since we passed {code_hash: desc})
    vectors: dict[str, list[float]] = raw_vectors

    # Persist to disk for potential reuse
    DATA_DIR.mkdir(exist_ok=True)

    hashes = sorted(vectors.keys())
    matrix = np.array([vectors[h] for h in hashes])
    np.save(str(DATA_DIR / f"vectors_{repo_id}.npy"), matrix)
    with open(DATA_DIR / f"vectors_{repo_id}_index.json", "w") as f:
        json.dump({h: i for i, h in enumerate(hashes)}, f)

    return vectors


async def _generate_welcome(
    repo: Repo,
    snapshot: ProjectGraphSnapshot,
    session: Session,
) -> str:
    units = session.exec(
        select(CodeUnit).where(CodeUnit.snapshot_id == snapshot.id)
    ).all()

    clusters = session.exec(
        select(FeatureCluster).where(FeatureCluster.snapshot_id == snapshot.id)
    ).all()

    unit_by_id = {u.id: u for u in units}

    cluster_sections: list[str] = []
    for c in clusters:
        members = session.exec(
            select(ClusterMember).where(ClusterMember.cluster_id == c.id)
        ).all()
        centroid = unit_by_id.get(c.centroid_unit_id) if c.centroid_unit_id else None
        centroid_desc = centroid.llm_description if centroid and centroid.llm_description else ""
        cluster_sections.append(
            f"- {c.label} ({len(members)} units): {centroid_desc[:120]}" if centroid_desc
            else f"- {c.label} ({len(members)} units)"
        )

    dirs: set[str] = set()
    for u in units:
        parts = u.file_path.split("/")
        if len(parts) >= 2:
            dirs.add(parts[0] + "/" + parts[1])

    kind_counts: dict[str, int] = {}
    for u in units:
        kind_counts[u.kind] = kind_counts.get(u.kind, 0) + 1

    prompt = f"""You are a senior engineer giving a new teammate a 10-second verbal overview of a codebase.

Repository: **{repo.name}**

Subsystems detected:
{chr(10).join(cluster_sections) if cluster_sections else 'none'}

Stats: {len(units)} symbols ({', '.join(f'{v} {k}s' for k, v in sorted(kind_counts.items(), key=lambda x: -x[1]))})

Rules:
- Write 2 sentences MAX. Say what the app IS and what its main user flows are.
- DO NOT mention file paths, directories, folder structure, tech stack, or framework names.
- DO NOT say "this codebase" or "organized around". Just describe the product.
- Then output a :::actions block with exactly 3 prompts.

Format (output NOTHING else):

<2 sentences about what the app does>

:::actions
["prompt 1", "prompt 2", "prompt 3"]
:::

Prompt rules:
- Reference actual features from the subsystems above (e.g. "task", "auth", "notification")
- Under 8 words each
- Questions end with "?", commands have no punctuation
- Examples: "How does task creation work?", "What connects to auth?", "Trace the notification flow"
- No generic prompts """

    from app.services.cost import record_usage

    client = AsyncOpenAI(api_key=OPENAI_API_KEY)
    response = await client.responses.create(
        model="gpt-5.4-mini",
        input=[{"role": "user", "content": prompt}],
    )
    if response.usage:
        record_usage("gpt-5.4-mini", response.usage.input_tokens, response.usage.output_tokens)

    return response.output_text.strip()
