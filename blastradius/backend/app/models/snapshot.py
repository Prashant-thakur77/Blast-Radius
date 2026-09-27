from datetime import datetime, timezone
from uuid import uuid4

from sqlmodel import Field, SQLModel


class ProjectGraphSnapshot(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    repo_id: str = Field(foreign_key="repo.id")
    commit_sha: str = Field()
    commit_message: str = Field(default="")
    commit_time: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    parent_snapshot_id: str | None = Field(default=None, foreign_key="projectgraphsnapshot.id")
    branch_name: str | None = Field(default=None)
    units_added: int = Field(default=0)
    units_modified: int = Field(default=0)
    units_removed: int = Field(default=0)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
