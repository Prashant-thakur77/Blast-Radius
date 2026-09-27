"""Embedding metadata; actual vectors live in external artifact files."""

from uuid import uuid4

from sqlmodel import Field, SQLModel


class EmbeddingRecord(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True, description="UUID primary key")
    snapshot_id: str = Field(foreign_key="projectgraphsnapshot.id", description="Parent snapshot")
    code_unit_id: str = Field(foreign_key="codeunit.id", description="Source code unit")
    source_kind: str = Field(description="What was embedded, e.g. source, description, combined")
    model_name: str = Field(description="Embedding model name")
    model_version: str = Field(description="Embedding model version")
    source_hash: str = Field(description="Hash of the input text that was embedded")
    vector_index: int = Field(description="Row index into the external vector file")
