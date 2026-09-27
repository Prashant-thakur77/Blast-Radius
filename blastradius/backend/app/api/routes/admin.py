from __future__ import annotations

import logging
import shutil

from fastapi import APIRouter, Depends

from app.core.auth import require_api_key
from app.core.config import DATA_DIR, REPOS_DIR
from app.core.database import reset_db

logger = logging.getLogger("blastradius.admin")

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.delete("/reset")
def full_reset(_: None = Depends(require_api_key)):
    reset_db()
    logger.info("database reset")

    if REPOS_DIR.exists():
        shutil.rmtree(REPOS_DIR)
        REPOS_DIR.mkdir(parents=True, exist_ok=True)
        logger.info("repo directories cleaned")

    for pattern in ["vectors_*", "reducer_*"]:
        for f in DATA_DIR.glob(pattern):
            f.unlink()
            logger.info(f"removed {f.name}")

    return {"status": "reset"}
