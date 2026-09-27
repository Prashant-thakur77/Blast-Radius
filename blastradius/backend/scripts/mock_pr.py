#!/usr/bin/env python3
"""
Simulates the full agent PR flow:
1. POST /sync → ingest + enrich all branches
2. POST /analyze-mr with source_branch → auto-diff, analyze, persist
3. Print report + URL

Usage: cd blastradius/backend && .venv/bin/python scripts/mock_pr.py
"""

import json
import subprocess
import sys

API = "http://localhost:8000"
KEY = "REDACTED"
SOURCE = "feature/task-due-reminders"
TARGET = "main"


def curl(method, path, body=None, timeout=600):
    cmd = ["curl", "-s", "-X", method, f"{API}{path}", "-H", f"X-API-Key: {KEY}"]
    if body:
        cmd += ["-H", "Content-Type: application/json", "-d", json.dumps(body)]
    cmd += ["--max-time", str(timeout)]
    r = subprocess.run(cmd, capture_output=True, text=True)
    try:
        return json.loads(r.stdout)
    except json.JSONDecodeError:
        print(f"Bad response: {r.stdout[:500]}", file=sys.stderr)
        sys.exit(1)


repos = curl("GET", "/api/repos")
repo = next((r for r in repos if "pulse" in (r.get("name") or "")), None)
if not repo:
    print("No pulse repo found. Create it first.")
    sys.exit(1)

repo_id = repo["id"]
print(f"Repo: {repo_id}\n")

print("[1/2] Syncing (ingest + enrich)...")
sync = curl("POST", f"/api/repos/{repo_id}/sync")
print(f"  snapshots: {sync.get('snapshots_created')}")
print(f"  branches: {sync.get('branches_synced')}")
print(f"  url: {sync.get('url')}")

print(f"\n[2/2] Analyzing MR ({SOURCE} -> {TARGET})...")
result = curl("POST", f"/api/repos/{repo_id}/analyze-mr", {
    "mr_iid": 1,
    "source_branch": SOURCE,
    "target_branch": TARGET,
})

print(f"  id: {result.get('id')}")
print(f"  risk: {result.get('risk_level')}")
print(f"  status: {result.get('status')}")
print(f"  url: {result.get('url')}")

report = result.get("report", {})
print(f"  changed: {len(report.get('changed_units', []))} units")
print(f"  impacted: {len(report.get('impacted_units', []))} units")
print(f"  clusters: {len(report.get('cluster_impact', []))} affected")
print(f"  labels: {report.get('suggested_labels', [])}")

print(f"\nDone. View: {result.get('url')}")
