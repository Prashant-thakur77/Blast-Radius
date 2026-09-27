#!/usr/bin/env python3
"""
Seed script: creates repo, ingests all branches, enriches, and runs MR analysis.
Usage: cd blastradius/backend && .venv/bin/python scripts/seed.py
"""

import json
import subprocess
import sys
import time
from pathlib import Path

API = "http://localhost:8000"
KEY = "REDACTED"
REPO_URL = "https://github.com/username/project.git"
REPO_NAME = "pulse"
SOURCE_ROOT = "pulse"
MR_SOURCE_BRANCH = "feature/task-due-reminders"
MR_TARGET_BRANCH = "main"


def api(method: str, path: str, body: dict | None = None, timeout: int = 600) -> dict:
    cmd = ["curl", "-s", "-X", method, f"{API}{path}", "-H", f"X-API-Key: {KEY}"]
    if body:
        cmd += ["-H", "Content-Type: application/json", "-d", json.dumps(body)]
    cmd += ["--max-time", str(timeout)]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"  FAILED: {result.stderr}", file=sys.stderr)
        sys.exit(1)
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError:
        print(f"  Bad response: {result.stdout[:200]}", file=sys.stderr)
        sys.exit(1)


def get_or_create_repo() -> str:
    repos = api("GET", "/api/repos")
    for r in repos:
        if r.get("remote_url") == REPO_URL:
            print(f"  repo exists: {r['id']}")
            return r["id"]

    r = api("POST", "/api/repos", {"name": REPO_NAME, "url": REPO_URL, "source_root": SOURCE_ROOT})
    print(f"  created: {r['id']}")
    return r["id"]


def get_changed_files(repo_dir: Path, source: str, target: str) -> list[dict]:
    subprocess.run(["git", "-C", str(repo_dir), "fetch", "origin"], capture_output=True)

    diff_output = subprocess.run(
        ["git", "-C", str(repo_dir), "diff", "--name-status", f"origin/{target}...origin/{source}"],
        capture_output=True, text=True,
    ).stdout.strip()

    if not diff_output:
        print("  No diff found")
        return []

    changed = []
    for line in diff_output.splitlines():
        parts = line.split("\t", 1)
        if len(parts) < 2:
            continue
        status_code, file_path = parts[0], parts[1]

        if status_code.startswith("A"):
            status = "added"
        elif status_code.startswith("D"):
            status = "deleted"
        else:
            status = "modified"

        content = None
        if status != "deleted":
            try:
                content = subprocess.run(
                    ["git", "-C", str(repo_dir), "show", f"origin/{source}:{file_path}"],
                    capture_output=True, text=True,
                ).stdout
            except Exception:
                pass

        if not file_path.endswith((".ts", ".tsx")):
            continue

        changed.append({"path": file_path, "content": content, "status": status})

    return changed


def main():
    print("=== Blast Radius Seed ===\n")

    print("[1/4] Repo...")
    repo_id = get_or_create_repo()
    print()

    print("[2/4] Ingest all branches...")
    t0 = time.time()
    result = api("POST", f"/api/repos/{repo_id}/ingest")
    print(f"  {result} ({time.time() - t0:.1f}s)")
    print()

    print("[3/4] Enrich...")
    t0 = time.time()
    result = api("POST", f"/api/repos/{repo_id}/enrich", timeout=600)
    print(f"  {result} ({time.time() - t0:.1f}s)")
    print()

    print("[4/4] Analyze MR (feature/task-due-reminders -> main)...")
    from app.core.config import REPOS_DIR
    repo_dir = REPOS_DIR / repo_id
    changed_files = get_changed_files(repo_dir, MR_SOURCE_BRANCH, MR_TARGET_BRANCH)
    print(f"  {len(changed_files)} changed .ts/.tsx files")

    if changed_files:
        t0 = time.time()
        result = api("POST", f"/api/repos/{repo_id}/analyze-mr", {
            "mr_iid": 1,
            "changed_files": changed_files,
        }, timeout=600)
        print(f"  risk: {result.get('risk_level')}")
        print(f"  changed: {len(result.get('changed_units', []))} units")
        print(f"  impacted: {len(result.get('impacted_units', []))} units")
        print(f"  ({time.time() - t0:.1f}s)")

        with open(Path(__file__).parent / "mr_result.json", "w") as f:
            json.dump(result, f, indent=2)
        print("  saved to scripts/mr_result.json")
    print()

    print(f"=== Done === Open: http://localhost:3000/{repo_id}")


if __name__ == "__main__":
    main()
