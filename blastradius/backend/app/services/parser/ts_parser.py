"""tree-sitter setup and CodeUnit extraction from TypeScript/TSX ASTs."""

from __future__ import annotations

import hashlib

import tree_sitter as ts
import tree_sitter_typescript as tst

from app.services.parser.types import FileContext, ParsedUnit

_tsx_lang = ts.Language(tst.language_tsx())
_ts_lang = ts.Language(tst.language_typescript())

_HTTP_METHODS = frozenset({"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"})


def make_parser(tsx: bool = True) -> ts.Parser:
    return ts.Parser(_tsx_lang if tsx else _ts_lang)


def _node_text(node: ts.Node, source: bytes) -> str:
    return source[node.start_byte:node.end_byte].decode("utf-8", errors="replace")


def _is_route_file(file_path: str) -> bool:
    return file_path.endswith("route.ts") or file_path.endswith("route.tsx")


def _has_jsx_return(node: ts.Node) -> bool:
    """Check if a function body contains a return statement with JSX."""
    if node.type == "return_statement":
        for desc in _walk(node):
            if desc.type in ("jsx_element", "jsx_self_closing_element", "jsx_fragment"):
                return True
        return False
    for child in node.children:
        if _has_jsx_return(child):
            return True
    return False


def _walk(node: ts.Node):
    """Yield all descendants of a node."""
    yield node
    for child in node.children:
        yield from _walk(child)


def _detect_kind(name: str, func_node: ts.Node, file_path: str) -> str:
    if _is_route_file(file_path) and name in _HTTP_METHODS:
        return "api_handler"
    if len(name) > 3 and name.startswith("use") and name[3].isupper():
        return "hook"
    # Check for JSX return in the function body
    body = func_node.child_by_field_name("body")
    if body and _has_jsx_return(body):
        return "component"
    return "function"


def _extract_from_function_declaration(
    node: ts.Node, source: bytes, file_path: str, runtime: str,
) -> ParsedUnit | None:
    name_node = node.child_by_field_name("name")
    if name_node is None:
        return None
    name = _node_text(name_node, source)
    text = _node_text(node, source)
    return ParsedUnit(
        file_path=file_path,
        symbol_name=name,
        qualname=f"{file_path}::{name}",
        kind=_detect_kind(name, node, file_path),
        runtime=runtime,
        language="typescript",
        start_line=node.start_point[0] + 1,
        end_line=node.end_point[0] + 1,
        code_hash=hashlib.sha256(text.encode("utf-8")).hexdigest(),
        source_text=text,
    )


def _extract_from_variable_declarator(
    node: ts.Node, source: bytes, file_path: str, runtime: str
) -> ParsedUnit | None:
    """Extract from `const Foo = () => ...` or `const foo = function() ...`."""
    name_node = node.child_by_field_name("name")
    value_node = node.child_by_field_name("value")
    if name_node is None or value_node is None:
        return None
    if value_node.type not in ("arrow_function", "function_expression", "function"):
        # Check if it wraps a call like React.forwardRef(() => ...)
        # For v1, skip non-function assignments
        return None
    name = _node_text(name_node, source)
    # Use the full variable declarator as source text (includes the name)
    text = _node_text(node, source)
    return ParsedUnit(
        file_path=file_path,
        symbol_name=name,
        qualname=f"{file_path}::{name}",
        kind=_detect_kind(name, value_node, file_path),
        runtime=runtime,
        language="typescript",
        start_line=node.start_point[0] + 1,
        end_line=node.end_point[0] + 1,
        code_hash=hashlib.sha256(text.encode("utf-8")).hexdigest(),
        source_text=text,
    )


def extract_units(file_ctx: FileContext) -> list[ParsedUnit]:
    """Extract all code units from a parsed file."""
    source = file_ctx.source_text.encode("utf-8")
    units: list[ParsedUnit] = []

    for child in file_ctx.tree.root_node.children:
        is_exported = child.type == "export_statement"
        target = child

        if is_exported:
            # The actual declaration is inside the export
            for c in child.children:
                if c.type in ("function_declaration", "lexical_declaration"):
                    target = c
                    break
            else:
                continue

        if target.type == "function_declaration":
            unit = _extract_from_function_declaration(
                target, source, file_ctx.file_path, file_ctx.runtime,
            )
            if unit:
                units.append(unit)

        elif target.type == "lexical_declaration":
            for declarator in target.children:
                if declarator.type == "variable_declarator":
                    unit = _extract_from_variable_declarator(
                        declarator, source, file_ctx.file_path, file_ctx.runtime
                    )
                    if unit:
                        units.append(unit)

    return units
