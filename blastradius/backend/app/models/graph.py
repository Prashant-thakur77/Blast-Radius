"""Dependency graph edges between code units."""

from uuid import uuid4

from sqlmodel import Field, SQLModel


class GraphEdge(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True, description="UUID primary key")
    snapshot_id: str = Field(foreign_key="projectgraphsnapshot.id", description="Parent snapshot")
    source_unit_id: str = Field(foreign_key="codeunit.id", description="Edge source")
    target_unit_id: str = Field(foreign_key="codeunit.id", description="Edge target")
    edge_type: str = Field(description="Relationship kind: calls, http_calls, renders")
