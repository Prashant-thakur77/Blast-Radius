from fastapi import Header, HTTPException

from app.core.config import BLASTRADIUS_API_SECRET


def require_api_key(x_api_key: str | None = Header(None)):
    if not BLASTRADIUS_API_SECRET:
        return
    if not x_api_key:
        raise HTTPException(401, "API key required")
    if x_api_key != BLASTRADIUS_API_SECRET:
        raise HTTPException(403, "Invalid API key")
