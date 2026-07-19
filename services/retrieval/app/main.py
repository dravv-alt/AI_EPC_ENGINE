from __future__ import annotations

from fastapi import FastAPI
from pydantic import BaseModel, Field
from sentence_transformers import CrossEncoder, SentenceTransformer

MODEL_NAME = "BAAI/bge-base-en-v1.5"
RERANKER_NAME = "BAAI/bge-reranker-base"
DIMENSIONS = 768
QUERY_INSTRUCTION = "Represent this sentence for searching relevant passages: "

app = FastAPI(title="Pramana Cx retrieval", version="0.1.0")

# Loaded once at module import (not per-request) so the container starts warm
# after the Docker build pre-downloads the weights. No DB access, no auth —
# this service is pure stateless compute, exactly like ingestion and solver.
embedding_model = SentenceTransformer(MODEL_NAME)
reranker = CrossEncoder(RERANKER_NAME)


class EmbedRequest(BaseModel):
    texts: list[str] = Field(min_length=1, max_length=256)
    kind: str = Field(default="passage", pattern="^(passage|query)$")


class RerankRequest(BaseModel):
    query: str = Field(min_length=1)
    documents: list[str] = Field(min_length=1, max_length=256)
    top_k: int = Field(default=10, ge=1, le=256)


@app.get("/health")
def health() -> dict[str, object]:
    return {"status": "ok", "service": "retrieval", "model": MODEL_NAME, "dimensions": DIMENSIONS}


@app.post("/embed")
def embed(request: EmbedRequest) -> dict[str, object]:
    # bge asymmetry: queries are prefixed with the retrieval instruction so the
    # asymmetric encoder aligns them with (bare) passage embeddings. Getting
    # this backwards silently degrades retrieval quality rather than erroring,
    # so it is applied here, once, rather than left to callers.
    texts = request.texts
    if request.kind == "query":
        texts = [f"{QUERY_INSTRUCTION}{text}" for text in texts]
    vectors = embedding_model.encode(texts, normalize_embeddings=True)
    return {
        "embeddings": [vector.tolist() for vector in vectors],
        "model": MODEL_NAME,
        "dimensions": DIMENSIONS,
    }


@app.post("/rerank")
def rerank(request: RerankRequest) -> dict[str, object]:
    pairs = [(request.query, document) for document in request.documents]
    scores = reranker.predict(pairs)
    ranked = sorted(
        ({"index": index, "score": float(score)} for index, score in enumerate(scores)),
        key=lambda result: result["score"],
        reverse=True,
    )
    return {"results": ranked[: request.top_k]}
