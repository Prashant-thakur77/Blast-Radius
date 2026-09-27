"""Deterministic subsystem naming from file paths (no embeddings needed).

Rules, first match wins:
  src/features/<name>/...                  -> <name>
  src/app/api/.../<resource>/...           -> deepest known API resource
  src/app/(group)/[param]/<page>/...       -> <page>
  src/components/ui/...                    -> ui-kit
  src/components/layout/... , app layouts  -> app-shell
  src/lib/... , src/db/...                 -> lib / db
"""

from __future__ import annotations

API_RESOURCES = {
    "comments": "comments",
    "tasks": "tasks",
    "move": "tasks",
    "archive": "tasks",
    "projects": "projects",
    "notifications": "notifications",
    "read-all": "notifications",
    "members": "workspace",
    "workspaces": "workspace",
    "search": "search",
    "activity": "activity",
    "auth": "auth",
    "user": "account",
    "users": "account",
    "settings": "settings",
}

PAGE_NAMES = {
    "dashboard": "dashboard",
    "projects": "projects",
    "settings": "settings",
    "account": "settings",
    "sign-in": "auth",
    "sign-up": "auth",
    "new-workspace": "workspace",
    "landing": "marketing",
}


def subsystem_for(path: str) -> str:
    parts = [p for p in path.split("/") if p]
    if parts and parts[0] == "src":
        parts = parts[1:]
    if not parts:
        return "root"
    if parts[0] == "features" and len(parts) > 1:
        return parts[1]
    if parts[0] == "app":
        rest = parts[1:]
        if rest and rest[0] == "api":
            found = None
            for seg in rest[1:]:
                if seg in API_RESOURCES:
                    found = API_RESOURCES[seg]
            return found or "api"
        for seg in rest:
            if seg in PAGE_NAMES:
                return PAGE_NAMES[seg]
        return "app-shell"
    if parts[0] == "components" and len(parts) > 1:
        return {"ui": "ui-kit", "layout": "app-shell", "shared": "ui-kit"}.get(parts[1], parts[1])
    if parts[0] in ("lib", "db", "store", "hooks", "types"):
        return parts[0]
    return parts[0]
