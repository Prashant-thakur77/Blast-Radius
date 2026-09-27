from uuid import uuid4

from sqlmodel import Field, SQLModel


class CodeUnit(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    snapshot_id: str = Field(foreign_key="projectgraphsnapshot.id", index=True)
    file_path: str = Field()
    symbol_name: str = Field()
    qualname: str = Field()
    kind: str = Field()
    runtime: str = Field()
    language: str = Field()
    start_line: int = Field()
    end_line: int = Field()
    code_hash: str = Field(index=True)
    source_text: str = Field()
    llm_description: str | None = Field(default=None)
    embedding_id: str | None = Field(default=None, foreign_key="embeddingrecord.id")
    x2d: float = Field(default=0.0)
    y2d: float = Field(default=0.0)
    x3d: float = Field(default=0.0)
    y3d: float = Field(default=0.0)
    z3d: float = Field(default=0.0)
    hub_score: float = Field(default=0.0)
