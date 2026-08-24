from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI, HTTPException, UploadFile
from tempfile import NamedTemporaryFile
from pydantic import BaseModel, Field

from app.core import parse_csv, parse_pdf, parse_xlsx

app = FastAPI(title="Pramana Cx document ingestion", version="0.1.0")
UPLOAD_ROOT = Path(os.environ.get("UPLOAD_ROOT", "./data/uploads")).resolve()

MAX_UPLOAD_BYTES = 100 * 1024 * 1024

XLSX_CONTENT_TYPES = {
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
}
CSV_CONTENT_TYPES = {"text/csv", "application/csv", "application/vnd.ms-excel.sheet.csv"}
PDF_CONTENT_TYPES = {"application/pdf"}

EXTENSION_KIND = {".pdf": "pdf", ".csv": "csv", ".xlsx": "xlsx"}


class ParseRequest(BaseModel):
    object_key: str = Field(min_length=1, max_length=500)


def safe_path(object_key: str) -> Path:
    candidate = (UPLOAD_ROOT / object_key).resolve()
    if UPLOAD_ROOT not in candidate.parents:
        raise HTTPException(status_code=400, detail="Invalid object key")
    return candidate


def kind_for_extension(suffix: str) -> str | None:
    return EXTENSION_KIND.get(suffix.lower())


def kind_for_upload(content_type: str | None, filename: str | None) -> str | None:
    """Resolve pdf/csv/xlsx from a client-supplied content-type, falling back to file extension
    since browsers and API clients are inconsistent about CSV/XLSX content-types."""
    extension_kind = kind_for_extension(Path(filename).suffix) if filename else None
    if content_type in PDF_CONTENT_TYPES:
        return "pdf"
    if content_type in CSV_CONTENT_TYPES:
        return "csv"
    if content_type in XLSX_CONTENT_TYPES:
        return "xlsx"
    return extension_kind


def parse_source_file(path: Path, kind: str) -> list[dict[str, object]]:
    if kind == "pdf":
        return parse_pdf(path)
    if kind == "csv":
        return parse_csv(path)
    if kind == "xlsx":
        return parse_xlsx(path)
    raise HTTPException(status_code=415, detail="Unsupported source format")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "ingestion"}


@app.post("/parse")
def parse_source(request: ParseRequest) -> dict[str, object]:
    path = safe_path(request.object_key)
    kind = kind_for_extension(path.suffix)
    if not path.exists() or kind is None:
        raise HTTPException(status_code=404, detail="Source not found")
    try:
        chunks = parse_source_file(path, kind)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    return {"chunks": chunks}


@app.post("/parse-upload")
async def parse_uploaded_source(file: UploadFile) -> dict[str, object]:
    kind = kind_for_upload(file.content_type, file.filename)
    if kind is None:
        raise HTTPException(status_code=415, detail="Only PDF, CSV, and XLSX sources are accepted")

    first = await file.read(5)
    if kind == "pdf" and first[:5] != b"%PDF-":
        raise HTTPException(status_code=415, detail="PDF magic bytes are invalid")
    if kind == "xlsx" and first[:4] != b"PK\x03\x04":
        raise HTTPException(status_code=415, detail="XLSX signature is invalid")
    # CSV has no reliable magic bytes; extension/content-type is what we have.

    suffix = {"pdf": ".pdf", "csv": ".csv", "xlsx": ".xlsx"}[kind]
    with NamedTemporaryFile(suffix=suffix) as temporary:
        temporary.write(first)
        while chunk := await file.read(1024 * 1024):
            temporary.write(chunk)
            if temporary.tell() > MAX_UPLOAD_BYTES:
                raise HTTPException(status_code=413, detail="Source exceeds 100 MB")
        temporary.flush()
        try:
            chunks = parse_source_file(Path(temporary.name), kind)
        except ValueError as error:
            raise HTTPException(status_code=422, detail=str(error)) from error
    return {"chunks": chunks}
