"""Resolve TypeScript import specifiers to repo-relative file paths."""

from __future__ import annotations

import json
import os
from functools import lru_cache
from pathlib import Path
from typing import TYPE_CHECKING

from app.services.parser.types import ImportRecord

if TYPE_CHECKING:
    from tree_sitter import Tree

_EXTENSIONS = [".ts", ".tsx", "/index.ts", "/index.tsx"]


def _parse_jsonc(text: str) -> dict:
    """Parse JSON with comments (JSONC) by stripping comments outside strings."""
    result: list[str] = []
    i = 0
    n = len(text)
    while i < n:
        # Inside a string — pass through until closing quote
        if text[i] == '"':
            j = i + 1
            while j < n:
                if text[j] == '\\':
                    j += 2
                elif text[j] == '"':
                    j += 1
                    break
                else:
                    j += 1
            result.append(text[i:j])
            i = j
        # Single-line comment
        elif text[i:i+2] == '//':
            while i < n and text[i] != '\n':
                i += 1
        # Multi-line comment
        elif text[i:i+2] == '/*':
            i = text.find('*/', i + 2)
            i = i + 2 if i != -1 else n
        # Trailing commas before } or ] — skip
        elif text[i] == ',' :
            # Peek ahead for } or ]
            rest = text[i+1:].lstrip()
            if rest and rest[0] in '}]':
                i += 1
            else:
                result.append(text[i])
                i += 1
        else:
            result.append(text[i])
            i += 1
    return json.loads(''.join(result))


@lru_cache(maxsize=16)
def _load_path_aliases(repo_root: str) -> dict[str, str]:
    """Read tsconfig.json and return a mapping of alias prefix → directory."""
    tsconfig_path = os.path.join(repo_root, "tsconfig.json")
    if not os.path.isfile(tsconfig_path):
        return {}
    try:
        with open(tsconfig_path) as f:
            raw = f.read()
        # Strip comments carefully: only outside of strings
        data = _parse_jsonc(raw)
    except (ValueError, OSError):
        return {}

    paths = data.get("compilerOptions", {}).get("paths", {})
    base_url = data.get("compilerOptions", {}).get("baseUrl", ".")
    aliases: dict[str, str] = {}
    for alias, targets in paths.items():
        if not targets:
            continue
        # e.g. "@/*" -> ["./src/*"]
        prefix = alias.rstrip("*").rstrip("/")
        target = targets[0].rstrip("*").rstrip("/")
        resolved_dir = os.path.normpath(os.path.join(repo_root, base_url, target))
        aliases[prefix] = resolved_dir
    return aliases


def _resolve_specifier(
    specifier: str, repo_root: str, importing_file_abs: str
) -> str | None:
    """Resolve an import specifier to a repo-relative file path, or None."""
    if specifier.startswith("."):
        # Relative import
        base_dir = os.path.dirname(importing_file_abs)
        abs_path = os.path.normpath(os.path.join(base_dir, specifier))
    else:
        # Try path aliases
        aliases = _load_path_aliases(repo_root)
        resolved = None
        for prefix, target_dir in aliases.items():
            if specifier == prefix or specifier.startswith(prefix + "/"):
                rest = specifier[len(prefix):].lstrip("/")
                resolved = os.path.join(target_dir, rest) if rest else target_dir
                break
        if resolved is None:
            return None  # External package
        abs_path = os.path.normpath(resolved)

    # Try extensions
    for ext in _EXTENSIONS:
        candidate = abs_path + ext
        if os.path.isfile(candidate):
            return os.path.relpath(candidate, repo_root).replace("\\", "/")

    # Already has extension?
    if os.path.isfile(abs_path):
        return os.path.relpath(abs_path, repo_root).replace("\\", "/")

    return None


def resolve_imports(
    tree: Tree, source: bytes, repo_root: str, file_path: str
) -> list[ImportRecord]:
    """Extract and resolve all imports from a parsed file."""
    abs_file = os.path.join(repo_root, file_path)
    records: list[ImportRecord] = []

    for child in tree.root_node.children:
        if child.type != "import_statement":
            continue

        # Find the module specifier
        source_node = child.child_by_field_name("source")
        if source_node is None:
            continue
        raw_module = source[source_node.start_byte:source_node.end_byte].decode(
            "utf-8", errors="replace"
        ).strip("\"'")

        resolved = _resolve_specifier(raw_module, repo_root, abs_file)

        # Find the import clause
        import_clause = None
        for c in child.children:
            if c.type == "import_clause":
                import_clause = c
                break
        if import_clause is None:
            continue

        for node in import_clause.children:
            if node.type == "identifier":
                # Default import
                name = source[node.start_byte:node.end_byte].decode("utf-8")
                records.append(ImportRecord(
                    local_name=name,
                    source_module=raw_module,
                    original_name="default",
                    resolved_file=resolved,
                ))
            elif node.type == "named_imports":
                for spec in node.children:
                    if spec.type == "import_specifier":
                        name_node = spec.child_by_field_name("name")
                        alias_node = spec.child_by_field_name("alias")
                        if name_node:
                            original = source[name_node.start_byte:name_node.end_byte].decode("utf-8")
                            local = original
                            if alias_node:
                                local = source[alias_node.start_byte:alias_node.end_byte].decode("utf-8")
                            records.append(ImportRecord(
                                local_name=local,
                                source_module=raw_module,
                                original_name=original,
                                resolved_file=resolved,
                            ))
            elif node.type == "namespace_import":
                # import * as ns from "..."
                for c in node.children:
                    if c.type == "identifier":
                        name = source[c.start_byte:c.end_byte].decode("utf-8")
                        records.append(ImportRecord(
                            local_name=name,
                            source_module=raw_module,
                            original_name="*",
                            resolved_file=resolved,
                        ))
                        break

    return records
