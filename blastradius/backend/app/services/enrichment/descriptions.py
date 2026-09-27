"""Generate LLM descriptions for all CodeUnits across all snapshots.

Uses code_hash deduplication: 1985 total units → ~331 unique hashes.
Each unique hash gets one LLM call, then the description propagates
to every CodeUnit sharing that hash across all snapshots.
"""

from __future__ import annotations

from sqlmodel import Session, select

from app.models import CodeUnit
from app.services.llm.worker import generate_descriptions
from app.services.parser.types import ParsedUnit


async def generate_all_descriptions(repo_id: str, session: Session) -> int:
    """Generate LLM descriptions for all undescribed units in the repo.

    Deduplicates by code_hash so each unique piece of code is described once,
    then propagates the description to all CodeUnit rows with matching hash.

    Returns the number of unique code_hash values newly described.
    """
    undescribed = session.exec(
        select(CodeUnit).where(CodeUnit.llm_description.is_(None))
    ).all()

    if not undescribed:
        return 0

    # Deduplicate: one representative unit per code_hash
    by_hash: dict[str, CodeUnit] = {}
    for u in undescribed:
        if u.code_hash not in by_hash:
            by_hash[u.code_hash] = u

    # Convert to ParsedUnit for the LLM worker
    parsed = [
        ParsedUnit(
            file_path=u.file_path,
            symbol_name=u.symbol_name,
            qualname=u.qualname,
            kind=u.kind,
            runtime=u.runtime,
            language=u.language,
            start_line=u.start_line,
            end_line=u.end_line,
            code_hash=u.code_hash,
            source_text=u.source_text,
        )
        for u in by_hash.values()
    ]

    descriptions = await generate_descriptions(parsed)

    # Build code_hash → description mapping
    hash_to_desc: dict[str, str] = {}
    for u in by_hash.values():
        desc = descriptions.get(u.qualname)
        if desc:
            hash_to_desc[u.code_hash] = desc

    # Propagate to ALL CodeUnits with matching code_hash
    for u in undescribed:
        desc = hash_to_desc.get(u.code_hash)
        if desc:
            u.llm_description = desc
            session.add(u)

    session.commit()
    return len(hash_to_desc)
