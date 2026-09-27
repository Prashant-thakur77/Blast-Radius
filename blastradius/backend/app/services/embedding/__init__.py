"""Embedding generation service."""

from app.services.embedding.worker import generate_embeddings

__all__ = ["generate_embeddings"]
