from __future__ import annotations

import logging
import subprocess
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.core.auth import require_api_key
from app.core.config import FRONTEND_URL, REPOS_DIR
from app.core.database import get_session
from app.models import CodeUnit, GraphEdge, ProjectGraphSnapshot, Repo, WorkflowCost
from app.models import MergeRequestAnalysis
from app.schemas.api import (
    AnalyzeByURLRequest,
    AnalyzeMRRequest,
    IngestResult,
    MRAnalysisResponse,
    RepoCreate,
    RepoOut,
    SyncByURLRequest,
    SyncResult,
)
from app.services.parser import parse_project

logger = logging.getLogger("blastradius.ingest")

router = APIRouter(prefix="/api/repos", tags=["repos"])


def _repo_dir(repo_id: str) -> Path:
    return REPOS_DIR / repo_id


def _parse_root(repo_dir: Path, source_root: str | None) -> str:
    if source_root:
        return str(repo_dir / source_root)
    return str(repo_dir)


@router.get("", response_model=list[RepoOut])
def list_repos(session: Session = Depends(get_session)):
    repos = session.exec(select(Repo)).all()
    return [RepoOut(id=r.id, name=r.name, remote_url=r.remote_url, source_root=r.source_root, welcome_message=r.welcome_message) for r in repos]


def _git(repo_dir: Path, *args: str) -> str:
    result = subprocess.run(
        ["git", "-C", str(repo_dir), *args],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)} failed: {result.stderr.strip()}")
    return result.stdout.strip()


@router.post("", response_model=RepoOut)
def create_repo(body: RepoCreate, session: Session = Depends(get_session), _: None = Depends(require_api_key)):
    existing = session.exec(select(Repo).where(Repo.remote_url == body.url)).first()
    if existing:
        raise HTTPException(409, "Repository already exists")
    repo = Repo(name=body.name, remote_url=body.url, source_root=body.source_root)
    dest = _repo_dir(repo.id)
    dest.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        ["git", "clone", body.url, str(dest)],
        check=True,
        capture_output=True,
        text=True,
    )
    session.add(repo)
    session.commit()
    session.refresh(repo)
    return RepoOut(id=repo.id, name=repo.name, remote_url=repo.remote_url, source_root=repo.source_root, welcome_message=repo.welcome_message)


def _ingest_branch(
    repo_id: str,
    repo_dir: Path,
    branch: str,
    existing_shas: set[str],
    session: Session,
    source_root: str | None = None,
) -> tuple[int, str | None]:
    try:
        _git(repo_dir, "checkout", branch, "--quiet")
    except RuntimeError:
        try:
            _git(repo_dir, "checkout", "-b", branch, f"origin/{branch}", "--quiet")
        except RuntimeError:
            logger.warning(f"branch '{branch}' not found, skipping")
            return 0, None

    latest = session.exec(
        select(ProjectGraphSnapshot)
        .where(ProjectGraphSnapshot.repo_id == repo_id, ProjectGraphSnapshot.branch_name == branch)
        .order_by(ProjectGraphSnapshot.created_at.desc())
    ).first()

    log_args = ["log", "--reverse", "--format=%H", branch]
    if latest:
        log_args.append(f"--after={latest.created_at.isoformat()}")
    if source_root:
        log_args += ["--", source_root]
    shas = _git(repo_dir, *log_args).splitlines()
    if latest:
        shas = [s for s in shas if s and s != latest.commit_sha and s not in existing_shas]
    else:
        shas = [s for s in shas if s and s not in existing_shas]

    if not shas:
        return 0, latest.id if latest else None

    sha_to_snapshot = dict(
        session.exec(
            select(ProjectGraphSnapshot.commit_sha, ProjectGraphSnapshot.id)
            .where(ProjectGraphSnapshot.repo_id == repo_id)
        ).all()
    )

    parent_id = latest.id if latest else None
    prev_units: dict[str, CodeUnit] = {}

    if latest:
        existing = session.exec(
            select(CodeUnit).where(CodeUnit.snapshot_id == latest.id)
        ).all()
        prev_units = {u.qualname: u for u in existing}

    logger.info(f"ingesting {len(shas)} commits on {branch} for repo={repo_id}")

    created = 0
    last_snapshot_id = None

    for sha in shas:
        _git(repo_dir, "checkout", sha, "--quiet")

        if parent_id is None:
            try:
                git_parent_sha = _git(repo_dir, "log", "-1", "--format=%P", sha).split()[0]
                if git_parent_sha in sha_to_snapshot:
                    parent_id = sha_to_snapshot[git_parent_sha]
                    parent_snap = session.get(ProjectGraphSnapshot, parent_id)
                    if parent_snap:
                        existing_units = session.exec(
                            select(CodeUnit).where(CodeUnit.snapshot_id == parent_snap.id)
                        ).all()
                        prev_units = {u.qualname: u for u in existing_units}
            except (RuntimeError, IndexError):
                pass

        commit_message = _git(repo_dir, "log", "-1", "--format=%s", sha)
        commit_time_str = _git(repo_dir, "log", "-1", "--format=%aI", sha)
        commit_time = datetime.fromisoformat(commit_time_str).astimezone(timezone.utc)

        parsed_units, parsed_edges = parse_project(_parse_root(repo_dir, source_root))

        new_qualnames: dict[str, str] = {}
        for pu in parsed_units:
            new_qualnames[pu.qualname] = pu.code_hash

        prev_qualname_hashes: dict[str, str] = {qn: u.code_hash for qn, u in prev_units.items()}
        units_added = len([qn for qn in new_qualnames if qn not in prev_qualname_hashes])
        units_removed = len([qn for qn in prev_qualname_hashes if qn not in new_qualnames])
        units_modified = len([qn for qn in new_qualnames if qn in prev_qualname_hashes and new_qualnames[qn] != prev_qualname_hashes[qn]])

        snapshot = ProjectGraphSnapshot(
            repo_id=repo_id,
            commit_sha=sha,
            commit_message=commit_message,
            commit_time=commit_time,
            parent_snapshot_id=parent_id,
            branch_name=branch,
            units_added=units_added,
            units_modified=units_modified,
            units_removed=units_removed,
        )
        session.add(snapshot)
        session.flush()
        existing_shas.add(sha)

        qualname_to_id: dict[str, str] = {}
        new_prev: dict[str, CodeUnit] = {}

        for pu in parsed_units:
            carried = prev_units.get(pu.qualname)
            if carried and carried.code_hash == pu.code_hash:
                cu = CodeUnit(
                    snapshot_id=snapshot.id,
                    file_path=carried.file_path,
                    symbol_name=carried.symbol_name,
                    qualname=carried.qualname,
                    kind=carried.kind,
                    runtime=carried.runtime,
                    language=carried.language,
                    start_line=carried.start_line,
                    end_line=carried.end_line,
                    code_hash=carried.code_hash,
                    source_text=carried.source_text,
                    llm_description=carried.llm_description,
                    embedding_id=None,
                )
            else:
                cu = CodeUnit(
                    snapshot_id=snapshot.id,
                    file_path=pu.file_path,
                    symbol_name=pu.symbol_name,
                    qualname=pu.qualname,
                    kind=pu.kind,
                    runtime=pu.runtime,
                    language=pu.language,
                    start_line=pu.start_line,
                    end_line=pu.end_line,
                    code_hash=pu.code_hash,
                    source_text=pu.source_text,
                )
            session.add(cu)
            session.flush()
            qualname_to_id[cu.qualname] = cu.id
            new_prev[cu.qualname] = cu

        for pe in parsed_edges:
            src_id = qualname_to_id.get(pe.source_qualname)
            tgt_id = qualname_to_id.get(pe.target_qualname)
            if src_id and tgt_id:
                edge = GraphEdge(
                    snapshot_id=snapshot.id,
                    source_unit_id=src_id,
                    target_unit_id=tgt_id,
                    edge_type=pe.edge_type,
                )
                session.add(edge)

        session.commit()
        prev_units = new_prev
        parent_id = snapshot.id
        last_snapshot_id = snapshot.id
        created += 1
        logger.info(f"[{branch}] commit {created}/{len(shas)} sha={sha[:8]} +{units_added} ~{units_modified} -{units_removed}")

    return created, last_snapshot_id


@router.post("/{repo_id}/ingest", response_model=IngestResult)
def ingest_repo(repo_id: str, session: Session = Depends(get_session), _: None = Depends(require_api_key)):
    repo = session.get(Repo, repo_id)
    if not repo:
        raise HTTPException(404, "Repo not found")

    repo_dir = _repo_dir(repo_id)
    if not repo_dir.exists():
        raise HTTPException(400, "Repo directory missing")

    try:
        _git(repo_dir, "fetch", "origin", "--prune")
    except RuntimeError:
        pass

    branch_output = _git(repo_dir, "branch", "-r", "--format=%(refname:short)")
    branches = [b.replace("origin/", "") for b in branch_output.splitlines() if b and "HEAD" not in b]
    if not branches:
        branches = ["main"]

    if "main" in branches:
        branches.remove("main")
        branches.insert(0, "main")

    existing_shas = set(
        row for row in session.exec(
            select(ProjectGraphSnapshot.commit_sha)
            .where(ProjectGraphSnapshot.repo_id == repo_id)
        ).all()
    )

    total_created = 0
    last_id = None

    for branch in branches:
        created, snap_id = _ingest_branch(repo_id, repo_dir, branch, existing_shas, session, source_root=repo.source_root)
        total_created += created
        if snap_id:
            last_id = snap_id

    _git(repo_dir, "checkout", "main", "--quiet")

    return IngestResult(snapshots_created=total_created, latest_snapshot_id=last_id)


@router.post("/{repo_id}/enrich")
async def enrich_repo_endpoint(repo_id: str, session: Session = Depends(get_session), _: None = Depends(require_api_key)):
    """Run the full enrichment pipeline: descriptions → embeddings → clustering → layout."""
    from app.services.enrichment import enrich_repo

    repo = session.get(Repo, repo_id)
    if not repo:
        raise HTTPException(404, "Repo not found")

    result = await enrich_repo(repo_id, session)
    return result


@router.post("/{repo_id}/sync", response_model=SyncResult)
async def sync_repo(repo_id: str, session: Session = Depends(get_session), _: None = Depends(require_api_key)):
    repo = session.get(Repo, repo_id)
    if not repo:
        raise HTTPException(404, "Repo not found")

    repo_dir = _repo_dir(repo_id)
    if not repo_dir.exists():
        raise HTTPException(400, "Repo directory missing")

    return await _sync_repo_internal(repo_id, repo_dir, session, source_root=repo.source_root)


@router.get("/{repo_id}/costs")
def get_costs(repo_id: str, session: Session = Depends(get_session)):
    repo = session.get(Repo, repo_id)
    if not repo:
        raise HTTPException(404, "Repo not found")
    costs = session.exec(
        select(WorkflowCost)
        .where(WorkflowCost.repo_id == repo_id)
        .order_by(WorkflowCost.started_at.desc())
    ).all()
    return costs


def _find_or_create_repo(repo_url: str, repo_name: str, session: Session, source_root: str | None = None) -> Repo:
    normalized = repo_url.rstrip("/")
    repo = session.exec(select(Repo).where(Repo.remote_url == normalized)).first()
    if repo:
        return repo

    name = repo_name or normalized.split("/")[-1].replace(".git", "")
    repo = Repo(name=name, remote_url=normalized, source_root=source_root)
    dest = _repo_dir(repo.id)
    dest.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        ["git", "clone", normalized, str(dest)],
        check=True, capture_output=True, text=True,
    )
    session.add(repo)
    session.commit()
    session.refresh(repo)
    return repo


async def _sync_repo_internal(repo_id: str, repo_dir: Path, session: Session, source_root: str | None = None) -> SyncResult:
    from app.services.enrichment import enrich_repo

    try:
        _git(repo_dir, "fetch", "origin", "--prune")
    except RuntimeError:
        pass

    branch_output = _git(repo_dir, "branch", "-r", "--format=%(refname:short)")
    branches = [b.replace("origin/", "") for b in branch_output.splitlines() if b and "HEAD" not in b]
    if not branches:
        branches = ["main"]
    if "main" in branches:
        branches.remove("main")
        branches.insert(0, "main")

    existing_shas = set(
        row for row in session.exec(
            select(ProjectGraphSnapshot.commit_sha).where(ProjectGraphSnapshot.repo_id == repo_id)
        ).all()
    )

    total_created = 0
    synced_branches: list[str] = []
    for branch in branches:
        created, _ = _ingest_branch(repo_id, repo_dir, branch, existing_shas, session, source_root=source_root)
        total_created += created
        if created > 0:
            synced_branches.append(branch)

    _git(repo_dir, "checkout", "main", "--quiet")

    if total_created > 0:
        await enrich_repo(repo_id, session)

    open_mrs = session.exec(
        select(MergeRequestAnalysis)
        .where(MergeRequestAnalysis.repo_id == repo_id, MergeRequestAnalysis.status == "open")
    ).all()
    main_shas = set(
        row for row in session.exec(
            select(ProjectGraphSnapshot.commit_sha)
            .where(ProjectGraphSnapshot.repo_id == repo_id, ProjectGraphSnapshot.branch_name == "main")
        ).all()
    )
    for mr in open_mrs:
        branch_snaps = session.exec(
            select(ProjectGraphSnapshot)
            .where(
                ProjectGraphSnapshot.repo_id == repo_id,
                ProjectGraphSnapshot.branch_name == mr.source_branch,
            )
            .order_by(ProjectGraphSnapshot.commit_time.desc())
        ).first()
        if branch_snaps and branch_snaps.commit_sha in main_shas:
            mr.status = "merged"
            session.add(mr)
    session.commit()

    return SyncResult(
        snapshots_created=total_created,
        branches_synced=synced_branches,
        url=f"{FRONTEND_URL}/{repo_id}",
    )


@router.post("/analyze-by-url", response_model=MRAnalysisResponse)
async def analyze_by_url(
    body: AnalyzeByURLRequest,
    session: Session = Depends(get_session),
    _: None = Depends(require_api_key),
):
    from app.services.analysis.impact import analyze_mr
    from app.services.cost import persist_tracker, start_tracker
    from app.api.routes.analysis import _diff_branches

    repo = _find_or_create_repo(body.repo_url, body.repo_name, session, source_root=body.source_root)
    repo_dir = _repo_dir(repo.id)

    await _sync_repo_internal(repo.id, repo_dir, session, source_root=repo.source_root)

    snapshot = session.exec(
        select(ProjectGraphSnapshot)
        .where(ProjectGraphSnapshot.repo_id == repo.id, ProjectGraphSnapshot.branch_name == body.target_branch)
        .order_by(ProjectGraphSnapshot.created_at.desc())
    ).first()
    if not snapshot:
        raise HTTPException(400, f"No snapshots for branch '{body.target_branch}' after sync")

    repo_root = str(repo_dir)
    parse_root = _parse_root(repo_dir, repo.source_root)
    changed_files = _diff_branches(repo_root, body.source_branch, body.target_branch, source_root=repo.source_root)
    if not changed_files:
        raise HTTPException(400, "No changed .ts/.tsx files between branches")

    mr_request = AnalyzeMRRequest(
        mr_iid=body.mr_iid,
        source_branch=body.source_branch,
        target_branch=body.target_branch,
        changed_files=changed_files,
    )

    tracker = start_tracker("analyze_mr", repo.id)
    report = await analyze_mr(snapshot, mr_request, parse_root, session)
    persist_tracker(tracker, session)

    mr = MergeRequestAnalysis(
        repo_id=repo.id,
        mr_iid=body.mr_iid,
        source_branch=body.source_branch,
        target_branch=body.target_branch,
        snapshot_id=snapshot.id,
        risk_level=report.risk_level,
        report_json=report.model_dump_json(),
    )
    session.add(mr)
    session.commit()
    session.refresh(mr)

    return MRAnalysisResponse(
        id=mr.id,
        mr_iid=mr.mr_iid,
        source_branch=mr.source_branch,
        target_branch=mr.target_branch,
        risk_level=mr.risk_level,
        status=mr.status,
        url=f"{FRONTEND_URL}/{repo.id}?mr={mr.id}",
        report=report,
    )


@router.post("/sync-by-url", response_model=SyncResult)
async def sync_by_url(
    body: SyncByURLRequest,
    session: Session = Depends(get_session),
    _: None = Depends(require_api_key),
):
    normalized = body.repo_url.rstrip("/")
    repo = session.exec(select(Repo).where(Repo.remote_url == normalized)).first()
    if not repo:
        raise HTTPException(404, "Repo not found, use analyze-by-url first to register it")

    repo_dir = _repo_dir(repo.id)
    if not repo_dir.exists():
        raise HTTPException(400, "Repo directory missing")

    return await _sync_repo_internal(repo.id, repo_dir, session, source_root=repo.source_root)
