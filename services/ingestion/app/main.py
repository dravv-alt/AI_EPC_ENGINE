from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI, HTTPException, UploadFile
from tempfile import NamedTemporaryFile
from pydantic import BaseModel, Field

from app.core import parse_pdf

app = FastAPI(title="Pramana Cx document ingestion", version="0.1.0")
UPLOAD_ROOT = Path(os.environ.get("UPLOAD_ROOT", "./data/uploads")).resolve()


class ParseRequest(BaseModel):
    object_key: str = Field(min_length=1, max_length=500)


def safe_path(object_key: str) -> Path:
    candidate = (UPLOAD_ROOT / object_key).resolve()
    if UPLOAD_ROOT not in candidate.parents:
        raise HTTPException(status_code=400, detail="Invalid object key")
    return candidate


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "ingestion"}


@app.post("/parse")
def parse_source(request: ParseRequest) -> dict[str, object]:
    path = safe_path(request.object_key)
    if not path.exists() or path.suffix.lower() != ".pdf":
        raise HTTPException(status_code=404, detail="PDF source not found")
    try:
        chunks = parse_pdf(path)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    return {"chunks": chunks}


@app.post("/parse-upload")
async def parse_uploaded_source(file: UploadFile) -> dict[str, object]:
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=415, detail="Only PDF sources are accepted")
    first = await file.read(5)
    if first != b"%PDF-":
        raise HTTPException(status_code=415, detail="PDF magic bytes are invalid")
    with NamedTemporaryFile(suffix=".pdf") as temporary:
        temporary.write(first)
        while chunk := await file.read(1024 * 1024):
            temporary.write(chunk)
            if temporary.tell() > 20 * 1024 * 1024:
                raise HTTPException(status_code=413, detail="PDF exceeds 20 MB")
        temporary.flush()
        try:
            chunks = parse_pdf(Path(temporary.name))
        except ValueError as error:
            raise HTTPException(status_code=422, detail=str(error)) from error
    return {"chunks": chunks}
