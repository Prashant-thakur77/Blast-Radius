from __future__ import annotations

import asyncio
import logging
import math
from typing import TYPE_CHECKING

from openai import AsyncOpenAI
from pydantic import BaseModel

from app.core.config import OPENAI_API_KEY
from app.services.cost import record_usage
from app.services.llm.prompt import SYSTEM_PROMPT, build_batch_prompt

if TYPE_CHECKING:
    from app.services.parser.types import ParsedUnit

logger = logging.getLogger("blastradius.llm")

DEFAULT_MODEL = "gpt-5.4-mini"
DEFAULT_MAX_WORKERS = 15
DEFAULT_BATCH_MIN = 5
DEFAULT_BATCH_MAX = 20


class FunctionDescription(BaseModel):
    index: int
    description: str


class BatchResult(BaseModel):
    descriptions: list[FunctionDescription]


def _compute_batches(
    total: int,
    max_workers: int,
    batch_min: int,
    batch_max: int,
) -> list[tuple[int, int]]:
    """Compute (start, end) slices for batching.

    - 4 functions → 1 worker × 4
    - 300 functions → 15 workers × 20 = 1 round
    - 500 functions → 15 workers × 20 = 2 rounds (sliding window)
    """
    if total == 0:
        return []

    if total <= batch_min:
        return [(0, total)]

    num_workers = min(max_workers, math.ceil(total / batch_min))
    batch_size = math.ceil(total / num_workers)
    batch_size = max(batch_min, min(batch_max, batch_size))

    batches = []
    for start in range(0, total, batch_size):
        end = min(start + batch_size, total)
        batches.append((start, end))
    return batches


async def _describe_batch(
    batch_units: list[ParsedUnit],
    client: AsyncOpenAI,
    semaphore: asyncio.Semaphore,
    model: str,
) -> list[tuple[str, str]]:
    """Describe a batch of code units via structured output. Returns [(qualname, description)]."""
    async with semaphore:
        prompt = build_batch_prompt(batch_units)

        response = await client.responses.parse(
            model=model,
            instructions=SYSTEM_PROMPT,
            input=[{"role": "user", "content": prompt}],
            text_format=BatchResult,
        )
        if response.usage:
            record_usage(model, response.usage.input_tokens, response.usage.output_tokens)

        parsed: BatchResult | None = None
        for output in response.output:
            if output.type != "message":
                continue
            for item in output.content:
                if hasattr(item, "parsed") and item.parsed:
                    parsed = item.parsed
                    break

        results: list[tuple[str, str]] = []
        if parsed:
            for fd in parsed.descriptions:
                if 0 <= fd.index < len(batch_units):
                    results.append((batch_units[fd.index].qualname, fd.description))

        return results


async def generate_descriptions(
    units: list[ParsedUnit],
    model: str = DEFAULT_MODEL,
    max_workers: int = DEFAULT_MAX_WORKERS,
    batch_min: int = DEFAULT_BATCH_MIN,
    batch_max: int = DEFAULT_BATCH_MAX,
) -> dict[str, str]:
    """Generate LLM descriptions for code units using batched parallel workers.

    Returns: {qualname: description}
    """
    if not units:
        return {}

    client = AsyncOpenAI(api_key=OPENAI_API_KEY)
    semaphore = asyncio.Semaphore(max_workers)

    batches = _compute_batches(len(units), max_workers, batch_min, batch_max)

    tasks = [
        _describe_batch(units[start:end], client, semaphore, model)
        for start, end in batches
    ]

    results = await asyncio.gather(*tasks, return_exceptions=True)

    descriptions: dict[str, str] = {}
    errors: list[str] = []
    for r in results:
        if isinstance(r, Exception):
            errors.append(str(r))
        else:
            for qualname, desc in r:
                descriptions[qualname] = desc

    if errors:
        logger.error(f"{len(errors)} batch errors out of {len(batches)} batches")
        for err in errors[:5]:
            logger.error(f"  {err}")

    logger.info(f"generated {len(descriptions)} descriptions in {len(batches)} batches")
    return descriptions
