"""Pydantic artifacts for 2-D layout results."""

from pydantic import BaseModel


class LayoutPoint(BaseModel):
    """Single code unit positioned in 2-D space."""

    code_unit_id: str
    x: float
    y: float


class LayoutArtifact(BaseModel):
    """Complete 2-D layout for one snapshot."""

    snapshot_id: str
    layout_method: str
    layout_version: str
    points: list[LayoutPoint]
