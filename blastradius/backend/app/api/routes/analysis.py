from __future__ import annotations

import json
import os
import subprocess

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.core.auth import require_api_key
from app.core.config import FRONTEND_URL, REPOS_DIR
from app.core.database import get_session
from app.models import MergeRequestAnalysis, ProjectGraphSnapshot, Repo
from app.schemas.api import (
    AnalyzeMRRequest,
    ChangedFile,
    ImpactReport,
    MRAnalysisResponse,
    MRAnalysisSummary,
)
from app.services.analysis.impact import analyze_mr
from app.services.cost import persist_tracker, start_tracker

router = APIRouter(prefix="/api/repos/{repo_id}", tags=["analysis"])


def _git(repo_dir: str, *args: str) -> str:
    result = subprocess.run(
        ["git", "-C", repo_dir, *args],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)} failed: {result.stderr.strip()}")
    return result.stdout.strip()


def _diff_branches(repo_dir: str, source: str, target: str, source_root: str | None = None) -> list[ChangedFile]:
    _git(repo_dir, "fetch", "origin")
    try:
        diff_lines = _git(repo_dir, "diff", "--name-status", f"origin/{target}...origin/{source}").splitlines()
    except RuntimeError:
        diff_lines = _git(repo_dir, "diff", "--name-status", f"origin/{target}..origin/{source}").splitlines()

    changed: list[ChangedFile] = []
    for line in diff_lines:
        parts = line.split("\t", 1)
        if len(parts) < 2:
            continue
        code, path = parts[0], parts[1]
        if not path.endswith((".ts", ".tsx")):
            continue
        if source_root and not path.startswith(source_root + "/"):
            continue

        status = "added" if code.startswith("A") else "deleted" if code.startswith("D") else "modified"
        content = None
        if status != "deleted":
            try:
                content = _git(repo_dir, "show", f"origin/{source}:{path}")
            except RuntimeError:
                continue

        changed.append(ChangedFile(path=path, content=content, status=status))

    return changed


@router.post("/analyze-mr", response_model=MRAnalysisResponse)
async def analyze_merge_request(
    repo_id: str,
    body: AnalyzeMRRequest,
    session: Session = Depends(get_session),
    _: None = Depends(require_api_key),
):
    repo = session.get(Repo, repo_id)
    if not repo:
        raise HTTPException(404, "Repo not found")

    snapshot = session.exec(
        select(ProjectGraphSnapshot)
        .where(ProjectGraphSnapshot.repo_id == repo_id, ProjectGraphSnapshot.branch_name == body.target_branch)
        .order_by(ProjectGraphSnapshot.created_at.desc())
    ).first()
    if not snapshot:
        raise HTTPException(400, "No snapshots found for target branch, run sync first")

    repo_dir = REPOS_DIR / repo_id
    repo_root = str(repo_dir) if repo_dir.exists() else None

    if not body.changed_files and body.source_branch:
        if not repo_root:
            raise HTTPException(400, "Repo directory missing, cannot auto-diff")
        body.changed_files = _diff_branches(repo_root, body.source_branch, body.target_branch, source_root=repo.source_root)

    if not body.changed_files:
        raise HTTPException(400, "No changed files provided and no source_branch to diff")

    tracker = start_tracker("analyze_mr", repo_id)
    report = await analyze_mr(snapshot, body, repo_root, session)
    persist_tracker(tracker, session)

    mr = MergeRequestAnalysis(
        repo_id=repo_id,
        mr_iid=body.mr_iid,
        source_branch=body.source_branch or "unknown",
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
        url=f"{FRONTEND_URL}/{repo_id}?mr={mr.id}",
        report=report,
    )


@router.get("/mrs", response_model=list[MRAnalysisSummary])
def list_mr_analyses(repo_id: str, session: Session = Depends(get_session)):
    repo = session.get(Repo, repo_id)
    if not repo:
        raise HTTPException(404, "Repo not found")

    mrs = session.exec(
        select(MergeRequestAnalysis)
        .where(MergeRequestAnalysis.repo_id == repo_id)
        .order_by(MergeRequestAnalysis.created_at.desc())
    ).all()

    return [
        MRAnalysisSummary(
            id=mr.id,
            mr_iid=mr.mr_iid,
            source_branch=mr.source_branch,
            target_branch=mr.target_branch,
            risk_level=mr.risk_level,
            status=mr.status,
            created_at=mr.created_at.isoformat(),
        )
        for mr in mrs
    ]


@router.get("/mrs/{mr_id}", response_model=MRAnalysisResponse)
def get_mr_analysis(repo_id: str, mr_id: str, session: Session = Depends(get_session)):
    mr = session.get(MergeRequestAnalysis, mr_id)
    if not mr or mr.repo_id != repo_id:
        raise HTTPException(404, "MR analysis not found")

    report = ImpactReport.model_validate_json(mr.report_json)

    return MRAnalysisResponse(
        id=mr.id,
        mr_iid=mr.mr_iid,
        source_branch=mr.source_branch,
        target_branch=mr.target_branch,
        risk_level=mr.risk_level,
        status=mr.status,
        url=f"{FRONTEND_URL}/{repo_id}?mr={mr.id}",
        report=report,
    )
