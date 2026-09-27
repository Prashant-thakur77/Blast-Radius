"""Find calls, http_calls, and renders edges between code units."""

from __future__ import annotations

from typing import TYPE_CHECKING

from app.services.parser.route_matcher import RouteMap, match_route
from app.services.parser.types import FileContext, ParsedEdge, ParsedUnit

if TYPE_CHECKING:
    import tree_sitter as ts


def _node_text(node: ts.Node, source: bytes) -> str:
    return source[node.start_byte:node.end_byte].decode("utf-8", errors="replace")


def _find_containing_unit(byte_offset: int, units: list[ParsedUnit], source: bytes, tree) -> ParsedUnit | None:
    """Find which unit contains the given byte offset."""
    for unit in units:
        # Convert line-based ranges to byte ranges via the tree
        start_byte = _line_to_byte(unit.start_line, source)
        end_byte = _line_to_byte(unit.end_line + 1, source)
        if start_byte <= byte_offset < end_byte:
            return unit
    return None


def _line_to_byte(line_1indexed: int, source: bytes) -> int:
    """Convert a 1-indexed line number to a byte offset."""
    line_0 = line_1indexed - 1
    offset = 0
    for i, byte in enumerate(source):
        if line_0 == 0:
            return i
        if byte == ord("\n"):
            line_0 -= 1
    return len(source)


def _walk(node: ts.Node):
    yield node
    for child in node.children:
        yield from _walk(child)


def _build_import_lookup(file_ctx: FileContext) -> dict[str, str]:
    """Build local_name → qualname lookup from file imports."""
    lookup: dict[str, str] = {}
    for imp in file_ctx.imports:
        if imp.resolved_file is None:
            continue
        if imp.original_name == "*":
            # Namespace import — store the file prefix for member access resolution
            lookup[f"__ns__{imp.local_name}"] = imp.resolved_file
        elif imp.original_name == "default":
            lookup[imp.local_name] = f"{imp.resolved_file}::default"
        else:
            target_name = imp.original_name or imp.local_name
            lookup[imp.local_name] = f"{imp.resolved_file}::{target_name}"
    return lookup


def _extract_fetch_url(node: ts.Node, source: bytes) -> str | None:
    """Extract URL string from the first argument of a fetch() call."""
    args = node.child_by_field_name("arguments")
    if args is None or len(args.children) < 2:  # ( and ) plus at least one arg
        return None
    first_arg = args.children[1]  # skip the opening paren
    if first_arg.type == "string":
        return _node_text(first_arg, source).strip("\"'`")
    if first_arg.type == "template_string":
        # Extract the template, replacing expressions with placeholders
        return _node_text(first_arg, source).strip("`")
    return None


def _extract_fetch_method(node: ts.Node, source: bytes) -> str:
    """Extract HTTP method from fetch options object, default GET."""
    args = node.child_by_field_name("arguments")
    if args is None:
        return "GET"
    # Look for second argument (options object)
    arg_children = [c for c in args.children if c.type not in ("(", ")", ",")]
    if len(arg_children) < 2:
        return "GET"
    opts = arg_children[1]
    if opts.type != "object":
        return "GET"
    for prop in opts.children:
        if prop.type == "pair":
            key = prop.child_by_field_name("key")
            value = prop.child_by_field_name("value")
            if key and value:
                key_text = _node_text(key, source)
                if key_text in ("method", '"method"', "'method'"):
                    return _node_text(value, source).strip("\"'").upper()
    return "GET"


def extract_edges(
    file_ctx: FileContext,
    all_units: dict[str, ParsedUnit],
    route_map: RouteMap,
) -> list[ParsedEdge]:
    """Extract all edges from a parsed file."""
    source = file_ctx.source_text.encode("utf-8")
    import_lookup = _build_import_lookup(file_ctx)
    edges: list[ParsedEdge] = []
    seen: set[tuple[str, str, str]] = set()

    for node in _walk(file_ctx.tree.root_node):
        if node.type == "call_expression":
            _handle_call(node, source, file_ctx, import_lookup, all_units, route_map, edges, seen)
        elif node.type in ("jsx_opening_element", "jsx_self_closing_element"):
            _handle_jsx(node, source, file_ctx, import_lookup, all_units, edges, seen)

    return edges


def _add_edge(
    edges: list[ParsedEdge],
    seen: set[tuple[str, str, str]],
    source_qualname: str,
    target_qualname: str,
    edge_type: str,
) -> None:
    key = (source_qualname, target_qualname, edge_type)
    if key not in seen:
        seen.add(key)
        edges.append(ParsedEdge(
            source_qualname=source_qualname,
            target_qualname=target_qualname,
            edge_type=edge_type,
        ))


def _handle_call(
    node,
    source: bytes,
    file_ctx: FileContext,
    import_lookup: dict[str, str],
    all_units: dict[str, ParsedUnit],
    route_map: RouteMap,
    edges: list[ParsedEdge],
    seen: set[tuple[str, str, str]],
) -> None:
    func_node = node.child_by_field_name("function")
    if func_node is None:
        return

    # Find the containing unit for this call
    container = _find_containing_unit(node.start_byte, file_ctx.units, source, file_ctx.tree)
    if container is None:
        return

    func_text = _node_text(func_node, source)

    # Check for fetch() calls
    if func_text == "fetch":
        url = _extract_fetch_url(node, source)
        if url and "/api/" in url:
            method = _extract_fetch_method(node, source)
            target = match_route(url, method, route_map)
            if target and target in all_units:
                _add_edge(edges, seen, container.qualname, target, "http_calls")
        return

    # Direct function call
    if func_node.type == "identifier":
        target_qualname = import_lookup.get(func_text)
        if target_qualname and target_qualname in all_units:
            _add_edge(edges, seen, container.qualname, target_qualname, "calls")
    elif func_node.type == "member_expression":
        # Handle namespace.func() calls
        obj = func_node.child_by_field_name("object")
        prop = func_node.child_by_field_name("property")
        if obj and prop:
            obj_text = _node_text(obj, source)
            prop_text = _node_text(prop, source)
            ns_file = import_lookup.get(f"__ns__{obj_text}")
            if ns_file:
                target_qualname = f"{ns_file}::{prop_text}"
                if target_qualname in all_units:
                    _add_edge(edges, seen, container.qualname, target_qualname, "calls")


def _handle_jsx(
    node,
    source: bytes,
    file_ctx: FileContext,
    import_lookup: dict[str, str],
    all_units: dict[str, ParsedUnit],
    edges: list[ParsedEdge],
    seen: set[tuple[str, str, str]],
) -> None:
    # Get the tag name
    tag_node = None
    for child in node.children:
        if child.type == "identifier":
            tag_node = child
            break
        if child.type == "member_expression":
            tag_node = child
            break
    if tag_node is None:
        return

    tag_text = _node_text(tag_node, source)

    # Only uppercase = component references (lowercase = HTML elements)
    if not tag_text[0].isupper():
        return

    container = _find_containing_unit(node.start_byte, file_ctx.units, source, file_ctx.tree)
    if container is None:
        return

    target_qualname = import_lookup.get(tag_text)
    if target_qualname and target_qualname in all_units:
        _add_edge(edges, seen, container.qualname, target_qualname, "renders")
