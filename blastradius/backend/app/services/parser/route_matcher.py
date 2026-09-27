"""Match fetch("/api/...") URL patterns to API route handler qualnames."""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from app.services.parser.types import ParsedUnit

# Matches Next.js dynamic segments like [id], [projectId]
_DYNAMIC_SEGMENT_RE = re.compile(r"\[([^\]]+)\]")
# Matches template literal expressions like ${foo.bar} or ${id}
_TEMPLATE_EXPR_RE = re.compile(r"\$\{[^}]+\}")


@dataclass
class RouteEntry:
    pattern: re.Pattern[str]
    handlers: dict[str, str]  # HTTP method → qualname


@dataclass
class RouteMap:
    routes: list[RouteEntry] = field(default_factory=list)


def build_route_map(all_units: list[ParsedUnit]) -> RouteMap:
    """Build a route map from all api_handler units."""
    # Group handlers by their route.ts file
    file_handlers: dict[str, dict[str, str]] = {}
    for unit in all_units:
        if unit.kind != "api_handler":
            continue
        file_handlers.setdefault(unit.file_path, {})[unit.symbol_name] = unit.qualname

    route_map = RouteMap()
    for file_path, handlers in file_handlers.items():
        url_pattern = _file_path_to_url_pattern(file_path)
        if url_pattern is None:
            continue
        regex = re.compile("^" + url_pattern + "$")
        route_map.routes.append(RouteEntry(pattern=regex, handlers=handlers))

    # Sort by specificity (more segments = more specific, check first)
    route_map.routes.sort(key=lambda r: -len(r.pattern.pattern.split("/")))
    return route_map


def _file_path_to_url_pattern(file_path: str) -> str | None:
    """Convert a route.ts file path to a URL regex pattern.

    e.g. src/app/api/workspaces/[id]/projects/route.ts → /api/workspaces/[^/]+/projects
    """
    # Find the /app/api/ portion
    idx = file_path.find("app/api/")
    if idx == -1:
        return None
    rest = file_path[idx + len("app/"):]  # "api/workspaces/[id]/projects/route.ts"
    # Remove route.ts(x) suffix
    rest = re.sub(r"/route\.tsx?$", "", rest)
    # Replace [param] with regex wildcard
    rest = _DYNAMIC_SEGMENT_RE.sub(r"[^/]+", rest)
    return "/" + rest


def match_route(url: str, method: str, route_map: RouteMap) -> str | None:
    """Match a fetch URL + method to an API handler qualname."""
    # Normalize template literal expressions to wildcards
    normalized = _TEMPLATE_EXPR_RE.sub("[^/]+", url)
    # Strip query string
    normalized = normalized.split("?")[0]
    method = method.upper()

    for entry in route_map.routes:
        if entry.pattern.search(normalized):
            return entry.handlers.get(method)
    return None
