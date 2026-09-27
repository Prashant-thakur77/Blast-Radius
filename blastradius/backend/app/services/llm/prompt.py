"""Prompt template for generating semantic descriptions of code units."""

SYSTEM_PROMPT = (
    "You will receive a batch of code functions. "
    "For each function, describe what it does. "
    "Name every business concept and domain entity it works with. "
    "Be dense — every word must carry meaning, no filler. "
    "Simple functions get short descriptions. "
    "Complex functions that touch multiple domains need longer descriptions to capture all concepts.\n"
    "NEVER mention: language, framework, libraries, syntax, "
    "implementation details, error handling, types, return values, or UI patterns."
)


def build_batch_prompt(units: list) -> str:
    """Build a prompt containing multiple functions for batch processing."""
    parts = []
    for i, unit in enumerate(units):
        parts.append(
            f"[{i}] File: {unit.file_path}\n"
            f"Name: {unit.symbol_name}\n"
            f"```\n{unit.source_text}\n```"
        )
    return "\n\n".join(parts)
