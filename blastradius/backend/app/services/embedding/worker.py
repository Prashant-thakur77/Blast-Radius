from __future__ import annotations

import asyncio
import logging

from openai import AsyncOpenAI

from app.core.config import OPENAI_API_KEY
from app.services.cost import record_usage

logger = logging.getLogger("blastradius.embedding")

DEFAULT_MODEL = "text-embedding-3-small"
DEFAULT_DIMENSIONS = 768
DEFAULT_BATCH_SIZE = 200
DEFAULT_MAX_WORKERS = 5


async def _embed_batch(
    qualnames: list[str],
    texts: list[str],
    client: AsyncOpenAI,
    semaphore: asyncio.Semaphore,
    model: str,
    dimensions: int,
) -> list[tuple[str, list[float]]]:
    """Embed a batch of texts. Returns [(qualname, vector)]."""
    async with semaphore:
        response = await client.embeddings.create(
            input=texts,
            model=model,
            dimensions=dimensions,
        )
        if response.usage:
            record_usage(model, response.usage.prompt_tokens)
        return [
            (qualnames[item.index], item.embedding)
            for item in response.data
        ]


async def generate_embeddings(
    descriptions: dict[str, str],
    model: str = DEFAULT_MODEL,
    dimensions: int = DEFAULT_DIMENSIONS,
    batch_size: int = DEFAULT_BATCH_SIZE,
    max_workers: int = DEFAULT_MAX_WORKERS,
) -> dict[str, list[float]]:
    """Generate embeddings for LLM descriptions in batched parallel calls.

    Args:
        descriptions: {qualname: llm_description}
        model: OpenAI embedding model.
        dimensions: Output vector dimensions.
        batch_size: Texts per API call.
        max_workers: Max concurrent API calls.

    Returns:
        {qualname: vector}
    """
    if not descriptions:
        return {}

    client = AsyncOpenAI(api_key=OPENAI_API_KEY)
    semaphore = asyncio.Semaphore(max_workers)

    qualnames = list(descriptions.keys())
    texts = [descriptions[q] for q in qualnames]

    # Split into batches
    tasks = []
    for start in range(0, len(qualnames), batch_size):
        end = min(start + batch_size, len(qualnames))
        tasks.append(
            _embed_batch(
                qualnames[start:end],
                texts[start:end],
                client,
                semaphore,
                model,
                dimensions,
            )
        )

    results = await asyncio.gather(*tasks, return_exceptions=True)

    embeddings: dict[str, list[float]] = {}
    errors: list[str] = []
    for r in results:
        if isinstance(r, Exception):
            errors.append(str(r))
        else:
            for qualname, vector in r:
                embeddings[qualname] = vector

    if errors:
        logger.error(f"{len(errors)} batch errors out of {len(tasks)} batches")
        for err in errors[:5]:
            logger.error(f"  {err}")

    logger.info(f"generated {len(embeddings)} embeddings in {len(tasks)} batches")
    return embeddings
