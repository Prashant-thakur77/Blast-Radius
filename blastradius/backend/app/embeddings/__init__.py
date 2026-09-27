from openai import AsyncOpenAI, OpenAI

from app.core.config import OPENAI_API_KEY

_client: OpenAI | None = None
_async_client: AsyncOpenAI | None = None


def get_openai_client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(api_key=OPENAI_API_KEY)
    return _client


def get_async_openai_client() -> AsyncOpenAI:
    global _async_client
    if _async_client is None:
        _async_client = AsyncOpenAI(api_key=OPENAI_API_KEY)
    return _async_client
