"""Test that incremental parsing produces the same unit set as full parsing.

Walks through all 11 Pulse commits, doing a full parse at each commit and
an incremental parse (only changed files + carried-forward units). Asserts
the two approaches produce identical results.
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

# Ensure the backend package is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.services.parser import discover_files, parse_project
from app.services.parser.types import ParsedUnit

PULSE_REPO = "/Users/zelongwang/Documents/GitHub/pulse"

COMMITS = [
    "4071196",  # 1: initial commit
    "17498e6",  # 2: app shell and layout
    "b2ee62b",  # 3: authentication + landing
    "9ca7e6d",  # 4: workspace management
    "ff722e4",  # 5: project management
    "9353d21",  # 6: task management
    "4dc12ca",  # 7: comments and activity
    "c6cbdcd",  # 8: notifications inbox
    "ae5d2d5",  # 9: dashboard insights
    "631baab",  # 10: global search
    "0fb4d74",  # 11: user settings
]


def git_checkout(sha: str) -> None:
    subprocess.run(
        ["git", "checkout", sha, "--quiet"],
        cwd=PULSE_REPO,
        check=True,
        capture_output=True,
    )


def git_current_branch() -> str:
    result = subprocess.run(
        ["git", "rev-parse", "--abbrev-ref", "HEAD"],
        cwd=PULSE_REPO,
        capture_output=True,
        text=True,
    )
    return result.stdout.strip()


def get_changed_files(prev_sha: str, curr_sha: str) -> dict[str, list[str]]:
    """Return {'A': [...], 'M': [...], 'D': [...]} of changed .ts/.tsx files."""
    result = subprocess.run(
        ["git", "diff", "--name-status", prev_sha, curr_sha],
        cwd=PULSE_REPO,
        capture_output=True,
        text=True,
        check=True,
    )
    changes: dict[str, list[str]] = {"A": [], "M": [], "D": [], "R": []}
    for line in result.stdout.strip().split("\n"):
        if not line:
            continue
        parts = line.split("\t")
        status = parts[0][0]  # R100 → R
        file_path = parts[-1]  # for renames, take the new path
        if not file_path.endswith((".ts", ".tsx")) or file_path.endswith(".d.ts"):
            continue
        if status == "R":
            old_path = parts[1]
            changes["D"].append(old_path)
            changes["A"].append(file_path)
        elif status in changes:
            changes[status].append(file_path)
    return changes


def units_to_set(units: list[ParsedUnit]) -> dict[str, str]:
    """Convert units to {qualname: code_hash} for comparison."""
    return {u.qualname: u.code_hash for u in units}


def run_test() -> None:
    original_branch = git_current_branch()
    if original_branch == "HEAD":
        # Detached HEAD, get the SHA instead
        result = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=PULSE_REPO,
            capture_output=True,
            text=True,
        )
        original_branch = result.stdout.strip()

    try:
        # Step 1: Full parse at commit 2 (first meaningful commit)
        print(f"[Commit 2] {COMMITS[1]} — full parse (baseline)")
        git_checkout(COMMITS[1])
        full_units_2, _ = parse_project(PULSE_REPO)
        print(f"  {len(full_units_2)} units")

        prev_units = full_units_2
        prev_sha = COMMITS[1]
        passed = 0
        failed = 0

        # Step 2: For each subsequent commit, compare full vs incremental
        for i in range(2, len(COMMITS)):
            curr_sha = COMMITS[i]
            print(f"\n[Commit {i + 1}] {curr_sha}")

            # --- Full parse ---
            git_checkout(curr_sha)
            full_units, full_edges = parse_project(PULSE_REPO)
            full_set = units_to_set(full_units)

            # --- Incremental parse ---
            changes = get_changed_files(prev_sha, curr_sha)
            files_to_reparse = changes["A"] + changes["M"]
            deleted_files = set(changes["D"])

            # Carry forward units from unchanged files
            changed_file_set = set(files_to_reparse) | deleted_files
            carried = [u for u in prev_units if u.file_path not in changed_file_set]

            # Parse only changed/added files
            new_units, _ = parse_project(PULSE_REPO, file_paths=files_to_reparse)

            # Combine
            incremental_units = carried + new_units
            incremental_set = units_to_set(incremental_units)

            # --- Compare ---
            full_qualnames = set(full_set.keys())
            incr_qualnames = set(incremental_set.keys())

            missing = full_qualnames - incr_qualnames
            extra = incr_qualnames - full_qualnames
            hash_mismatches = {
                q for q in full_qualnames & incr_qualnames
                if full_set[q] != incremental_set[q]
            }

            ok = not missing and not extra and not hash_mismatches

            status = "PASS" if ok else "FAIL"
            print(f"  Full: {len(full_units)} units, {len(full_edges)} edges")
            print(f"  Incremental: {len(incremental_units)} units "
                  f"({len(carried)} carried + {len(new_units)} reparsed)")
            print(f"  Changed files: +{len(changes['A'])} added, "
                  f"~{len(changes['M'])} modified, -{len(changes['D'])} deleted")
            print(f"  Result: {status}")

            if missing:
                print(f"  MISSING in incremental ({len(missing)}):")
                for q in sorted(missing)[:5]:
                    print(f"    - {q}")
            if extra:
                print(f"  EXTRA in incremental ({len(extra)}):")
                for q in sorted(extra)[:5]:
                    print(f"    - {q}")
            if hash_mismatches:
                print(f"  HASH MISMATCHES ({len(hash_mismatches)}):")
                for q in sorted(hash_mismatches)[:5]:
                    print(f"    - {q}")

            if ok:
                passed += 1
            else:
                failed += 1

            # Prepare for next iteration
            prev_units = full_units  # always carry forward the full parse as ground truth
            prev_sha = curr_sha

        print(f"\n{'='*60}")
        print(f"Results: {passed} passed, {failed} failed out of {passed + failed} steps")
        if failed:
            sys.exit(1)

    finally:
        # Restore original branch
        print(f"\nRestoring pulse repo to: {original_branch}")
        git_checkout(original_branch)


if __name__ == "__main__":
    run_test()
