"""Public API for parsing TypeScript/Next.js projects."""

from __future__ import annotations

import os
from pathlib import Path

from app.services.parser.edge_extractor import extract_edges
from app.services.parser.import_resolver import resolve_imports
from app.services.parser.route_matcher import build_route_map
from app.services.parser.runtime_detector import detect_runtime
from app.services.parser.ts_parser import extract_units, make_parser
from app.services.parser.types import FileContext, ParsedEdge, ParsedUnit

_IGNORE_DIRS = {"node_modules", ".next", "dist", ".git", "__pycache__"}


def discover_files(repo_root: str) -> list[str]:
    """Find all .ts/.tsx files, excluding common build/vendor dirs."""
    files: list[str] = []
    for dirpath, dirnames, filenames in os.walk(repo_root):
        dirnames[:] = [d for d in dirnames if d not in _IGNORE_DIRS]
        for f in filenames:
            if f.endswith((".ts", ".tsx")) and not f.endswith(".d.ts"):
                abs_path = os.path.join(dirpath, f)
                rel_path = os.path.relpath(abs_path, repo_root).replace("\\", "/")
                files.append(rel_path)
    return files


def parse_project(
    repo_root: str,
    file_paths: list[str] | None = None,
) -> tuple[list[ParsedUnit], list[ParsedEdge]]:
    """Parse a TypeScript/Next.js project and return code units and edges.

    Args:
        repo_root: Absolute path to the repository root.
        file_paths: Optional list of repo-relative file paths to parse.
                    If None, discovers all .ts/.tsx files.

    Returns:
        Tuple of (units, edges).
    """
    if file_paths is None:
        file_paths = discover_files(repo_root)

    tsx_parser = make_parser(tsx=True)
    ts_parser = make_parser(tsx=False)

    # Phase 1: Per-file extraction
    file_contexts: list[FileContext] = []
    all_units_list: list[ParsedUnit] = []

    for rel_path in file_paths:
        abs_path = os.path.join(repo_root, rel_path)
        if not os.path.isfile(abs_path):
            continue

        with open(abs_path, "rb") as f:
            source_bytes = f.read()

        source_text = source_bytes.decode("utf-8", errors="replace")
        parser = tsx_parser if rel_path.endswith(".tsx") else ts_parser
        tree = parser.parse(source_bytes)

        runtime = detect_runtime(rel_path, tree)

        file_ctx = FileContext(
            file_path=rel_path,
            source_text=source_text,
            tree=tree,
            runtime=runtime,
        )

        file_ctx.imports = resolve_imports(tree, source_bytes, repo_root, rel_path)
        file_ctx.units = extract_units(file_ctx)
        all_units_list.extend(file_ctx.units)
        file_contexts.append(file_ctx)

    # Phase 2: Build indexes
    all_units_dict: dict[str, ParsedUnit] = {u.qualname: u for u in all_units_list}
    route_map = build_route_map(all_units_list)

    # Phase 3: Edge extraction
    all_edges: list[ParsedEdge] = []
    for file_ctx in file_contexts:
        edges = extract_edges(file_ctx, all_units_dict, route_map)
        all_edges.extend(edges)

    return all_units_list, all_edges
