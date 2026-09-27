from __future__ import annotations

import contextvars
import json
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone

from sqlmodel import Session

from app.core.config import DATA_DIR

logger = logging.getLogger("blastradius.cost")

COSTS_FILE = DATA_DIR / "costs.json"

PRICING = {
    "gpt-5.4-mini": {"input": 0.75 / 1_000_000, "output": 4.50 / 1_000_000},
    "text-embedding-3-small": {"input": 0.02 / 1_000_000},
}

_active_tracker: contextvars.ContextVar[CostTracker | None] = contextvars.ContextVar(
    "cost_tracker", default=None
)


@dataclass
class ModelUsage:
    input_tokens: int = 0
    output_tokens: int = 0


@dataclass
class CostTracker:
    workflow_type: str
    repo_id: str
    started_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    usage_by_model: dict[str, ModelUsage] = field(default_factory=dict)

    def record(self, model: str, input_tokens: int, output_tokens: int = 0):
        if model not in self.usage_by_model:
            self.usage_by_model[model] = ModelUsage()
        self.usage_by_model[model].input_tokens += input_tokens
        self.usage_by_model[model].output_tokens += output_tokens

    @property
    def total_cost_usd(self) -> float:
        total = 0.0
        for model, usage in self.usage_by_model.items():
            prices = PRICING.get(model, {})
            total += usage.input_tokens * prices.get("input", 0)
            total += usage.output_tokens * prices.get("output", 0)
        return total


def start_tracker(workflow_type: str, repo_id: str) -> CostTracker:
    tracker = CostTracker(workflow_type=workflow_type, repo_id=repo_id)
    _active_tracker.set(tracker)
    return tracker


def get_tracker() -> CostTracker | None:
    return _active_tracker.get()


def record_usage(model: str, input_tokens: int, output_tokens: int = 0):
    tracker = _active_tracker.get()
    if tracker:
        tracker.record(model, input_tokens, output_tokens)


def persist_tracker(tracker: CostTracker, session: Session):
    from app.models.workflow_cost import WorkflowCost

    now = datetime.now(timezone.utc)
    duration = (now - tracker.started_at).total_seconds()

    llm = tracker.usage_by_model.get("gpt-5.4-mini", ModelUsage())
    emb = tracker.usage_by_model.get("text-embedding-3-small", ModelUsage())

    record = WorkflowCost(
        repo_id=tracker.repo_id,
        workflow_type=tracker.workflow_type,
        started_at=tracker.started_at,
        completed_at=now,
        duration_seconds=duration,
        llm_model="gpt-5.4-mini",
        llm_input_tokens=llm.input_tokens,
        llm_output_tokens=llm.output_tokens,
        embedding_model="text-embedding-3-small",
        embedding_input_tokens=emb.input_tokens,
        total_cost_usd=tracker.total_cost_usd,
    )
    session.add(record)
    session.commit()

    _append_to_json(record)
    _active_tracker.set(None)

    logger.info(
        f"workflow={tracker.workflow_type} repo={tracker.repo_id} "
        f"duration={duration:.1f}s cost=${tracker.total_cost_usd:.6f} "
        f"llm_in={llm.input_tokens} llm_out={llm.output_tokens} "
        f"emb_in={emb.input_tokens}"
    )

    return record


def _append_to_json(record):
    COSTS_FILE.parent.mkdir(parents=True, exist_ok=True)

    entries = []
    if COSTS_FILE.exists():
        try:
            entries = json.loads(COSTS_FILE.read_text())
        except (json.JSONDecodeError, ValueError):
            entries = []

    entries.append({
        "id": record.id,
        "repo_id": record.repo_id,
        "workflow_type": record.workflow_type,
        "started_at": record.started_at.isoformat(),
        "completed_at": record.completed_at.isoformat(),
        "duration_seconds": record.duration_seconds,
        "llm_model": record.llm_model,
        "llm_input_tokens": record.llm_input_tokens,
        "llm_output_tokens": record.llm_output_tokens,
        "embedding_model": record.embedding_model,
        "embedding_input_tokens": record.embedding_input_tokens,
        "total_cost_usd": record.total_cost_usd,
    })

    COSTS_FILE.write_text(json.dumps(entries, indent=2))
