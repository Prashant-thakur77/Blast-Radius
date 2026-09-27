"""Materialize git refs into temp directories and diff them."""

from __future__ import annotations

import io
import os
import subprocess
import tarfile
import tempfile
from pathlib import Path

_CACHE_ROOT = Path(tempfile.gettempdir()) / "blastradius-trees"


def git(repo: str, *args: str) -> str:
    out = subprocess.run(["git", "-C", repo, *args], capture_output=True, text=True)
    if out.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)} failed: {out.stderr.strip()}")
    return out.stdout


def resolve(repo: str, ref: str) -> str:
    return git(repo, "rev-parse", "--verify", f"{ref}^{{commit}}").strip()


def materialize(repo: str, ref: str) -> tuple[str, str]:
    """Extract the tree at `ref` into a cached directory. Returns (sha, path)."""
    sha = resolve(repo, ref)
    dest = _CACHE_ROOT / sha
    marker = dest / ".complete"
    if marker.exists():
        return sha, str(dest)
    dest.mkdir(parents=True, exist_ok=True)
    data = subprocess.run(["git", "-C", repo, "archive", "--format=tar", sha], capture_output=True, check=True).stdout
    with tarfile.open(fileobj=io.BytesIO(data)) as tf:
        members = [m for m in tf.getmembers() if "node_modules/" not in m.name]
        tf.extractall(dest, members=members)
    marker.write_text(sha)
    return sha, str(dest)


def changed_files(repo: str, base: str, head: str, source_root: str | None) -> list[tuple[str, str]]:
    """Return [(status, path relative to source_root)] for files changed on head since merge-base."""
    try:
        out = git(repo, "diff", "--name-status", f"{base}...{head}")
    except RuntimeError:
        out = git(repo, "diff", "--name-status", base, head)
    result: list[tuple[str, str]] = []
    prefix = (source_root.strip("/") + "/") if source_root else ""
    for line in out.splitlines():
        parts = line.split("\t")
        if len(parts) < 2:
            continue
        code, path = parts[0], parts[-1]
        if prefix:
            if not path.startswith(prefix):
                continue
            path = path[len(prefix):]
        status = "added" if code.startswith("A") else "deleted" if code.startswith("D") else "modified"
        result.append((status, path))
    return result


def diff_stat(repo: str, base: str, head: str) -> dict:
    try:
        out = git(repo, "diff", "--shortstat", f"{base}...{head}")
    except RuntimeError:
        out = git(repo, "diff", "--shortstat", base, head)
    nums = [int(tok) for tok in out.replace(",", " ").split() if tok.isdigit()]
    files = nums[0] if nums else 0
    ins = nums[1] if len(nums) > 1 else 0
    dels = nums[2] if len(nums) > 2 else 0
    return {"files": files, "insertions": ins, "deletions": dels}


def root_for(tree_dir: str, source_root: str | None) -> str:
    return os.path.join(tree_dir, source_root) if source_root else tree_dir
