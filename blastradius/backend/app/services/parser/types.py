"""Intermediate dataclasses used during parsing, before conversion to DB models."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from tree_sitter import Tree


@dataclass
class ParsedUnit:
    file_path: str
    symbol_name: str
    qualname: str
    kind: str
    runtime: str
    language: str
    start_line: int
    end_line: int
    code_hash: str
    source_text: str


@dataclass
class ParsedEdge:
    source_qualname: str
    target_qualname: str
    edge_type: str


@dataclass
class ImportRecord:
    local_name: str
    source_module: str
    original_name: str | None = None
    resolved_file: str | None = None


@dataclass
class FileContext:
    file_path: str
    source_text: str
    tree: Tree
    runtime: str
    imports: list[ImportRecord] = field(default_factory=list)
    units: list[ParsedUnit] = field(default_factory=list)
