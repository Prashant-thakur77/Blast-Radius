"""Detect whether a file runs on client, server, or shared."""

from __future__ import annotations

import re
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from tree_sitter import Tree

_API_ROUTE_RE = re.compile(r"app/api/.+/route\.ts$")
_SERVER_FILE_RE = re.compile(
    r"(queries|mutations|actions)\.tsx?$"
    r"|/db/"
    r"|/lib/server/"
    r"|/server/"
)


def _has_use_client(tree: Tree) -> bool:
    """Check if the first statement is 'use client'."""
    root = tree.root_node
    for child in root.children:
        if child.type == "comment":
            continue
        if child.type == "expression_statement":
            expr = child.children[0] if child.children else None
            if expr and expr.type == "string":
                text = expr.text
                if text and text.decode("utf-8", errors="replace").strip("\"'") == "use client":
                    return True
        break
    return False


def detect_runtime(file_path: str, tree: Tree) -> str:
    """Return 'client', 'server', or 'shared' for the given file."""
    if _has_use_client(tree):
        return "client"
    if _API_ROUTE_RE.search(file_path):
        return "server"
    if file_path.endswith(".tsx") and "/app/" in file_path and "/api/" not in file_path:
        return "server"
    if _SERVER_FILE_RE.search(file_path):
        return "server"
    return "shared"
