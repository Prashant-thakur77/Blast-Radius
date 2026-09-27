from datetime import datetime, timezone
from uuid import uuid4

from sqlmodel import Field, SQLModel


class WorkflowCost(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    repo_id: str = Field(foreign_key="repo.id", index=True)
    workflow_type: str
    started_at: datetime
    completed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    duration_seconds: float = Field(default=0.0)
    llm_model: str = Field(default="gpt-5.4-mini")
    llm_input_tokens: int = Field(default=0)
    llm_output_tokens: int = Field(default=0)
    embedding_model: str = Field(default="text-embedding-3-small")
    embedding_input_tokens: int = Field(default=0)
    total_cost_usd: float = Field(default=0.0)
