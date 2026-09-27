from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlmodel import SQLModel, Field


class MergeRequestAnalysis(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    repo_id: str = Field(foreign_key="repo.id", index=True)
    mr_iid: int | None = Field(default=None)
    source_branch: str
    target_branch: str = Field(default="main")
    snapshot_id: str = Field(foreign_key="projectgraphsnapshot.id")
    risk_level: str = Field(default="low")
    status: str = Field(default="open")
    report_json: str = Field(default="{}")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
