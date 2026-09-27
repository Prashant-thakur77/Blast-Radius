"""Unit tests for the BlastRadius review engine against the seeded demo PRs.

Run: ./scripts/seed_demo.sh && cd blastradius/backend && .venv/bin/pytest tests/test_review_engine.py
"""

from __future__ import annotations

import subprocess
from pathlib import Path

import pytest

from app.review import analyze_refs
from app.review.subsystems import subsystem_for

ROOT = Path(__file__).resolve().parents[3]
REPO = ROOT / "demo-workspace" / "pulse"


@pytest.fixture(scope="module", autouse=True)
def seeded():
    if not (REPO / ".git").exists():
        subprocess.run([str(ROOT / "scripts" / "seed_demo.sh")], check=True)


def review(head: str) -> dict:
    return analyze_refs(str(REPO), "main", head)


def test_low_risk_pr_stays_low():
    r = review("pr-1-dashboard-copy")
    assert r["score"]["band"] == "low"
    assert r["missed_callers"] == []
    assert [s["name"] for s in r["subsystems"]] == ["dashboard"]


def test_small_diff_with_wide_reach_is_high():
    r = review("pr-2-session-epoch")
    assert r["stats"]["diff"]["files"] == 1
    assert sum(1 for x in r["ripple"] if x["distance"] == 1) == 24
    assert len(r["subsystems"]) >= 10
    assert r["score"]["band"] == "high"


def test_missed_caller_is_found_with_file_and_line():
    r = review("pr-3-task-archiving")
    assert r["score"]["band"] == "critical"
    [cc] = r["contract_changes"]
    assert cc["symbol"] == "getWorkspaceMember" and cc["kind"] == "reordered"
    [m] = r["missed_callers"]
    assert m["file"].endswith("comments/[commentId]/route.ts")
    assert m["line"] == 18
    assert "old order" in m["reason"]


def test_updated_callers_are_not_flagged():
    r = review("pr-3-task-archiving")
    flagged = {m["file"] for m in r["missed_callers"]}
    assert not any("members/route.ts" in f for f in flagged)


def test_adrs_in_scope_for_hero_pr():
    r = review("pr-3-task-archiving")
    files = {d["file"] for d in r["docs"]}
    assert "docs/adr/ADR-001-workspace-authorization.md" in files
    assert "docs/adr/ADR-002-activity-log.md" in files
    assert any(d["drift"] == ["getWorkspaceMember"] for d in r["docs"])


def test_every_point_has_a_reason():
    r = review("pr-3-task-archiving")
    assert sum(f["points"] for f in r["score"]["factors"]) >= r["score"]["total"]
    assert all(f["why"] for f in r["score"]["factors"])


@pytest.mark.parametrize("path,expected", [
    ("src/features/tasks/mutations.ts", "tasks"),
    ("src/app/api/workspaces/[id]/projects/[projectId]/tasks/[taskId]/comments/[commentId]/route.ts", "comments"),
    ("src/app/api/workspaces/[id]/members/route.ts", "workspace"),
    ("src/app/(app)/[workspace]/dashboard/page.tsx", "dashboard"),
    ("src/components/ui/button.tsx", "ui-kit"),
])
def test_subsystem_naming(path, expected):
    assert subsystem_for(path) == expected
