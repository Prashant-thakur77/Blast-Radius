from fastapi import APIRouter, Depends

from app.core.auth import require_api_key

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get("/verify")
def verify_key(_: None = Depends(require_api_key)):
    return {"valid": True}
