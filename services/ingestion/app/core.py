from __future__ import annotations

import hashlib
from pathlib import Path

import fitz

MAX_CHARS = 1100
OVERLAP_CHARS = 160


def merge_page_blocks(page: fitz.Page) -> list[dict[str, object]]:
    """Create deterministic, page-local citation regions from visual PDF blocks."""
    blocks = sorted(page.get_text("blocks"), key=lambda block: (round(block[1], 2), round(block[0], 2)))
    regions: list[dict[str, object]] = []
    buffer: list[str] = []
    x0 = y0 = float("inf")
    x1 = y1 = float("-inf")

    def flush() -> None:
        nonlocal buffer, x0, y0, x1, y1
        text = "\n".join(buffer).strip()
        if text:
            regions.append({
                "page_number": page.number + 1,
                "bbox": [x0, y0, x1, y1],
                "text": text,
                "content_hash": hashlib.sha256(text.encode("utf-8")).hexdigest(),
            })
        buffer, x0, y0, x1, y1 = [], float("inf"), float("inf"), float("-inf"), float("-inf")

    for block in blocks:
        block_text = " ".join(block[4].split())
        if not block_text:
            continue
        if buffer and sum(len(item) for item in buffer) + len(block_text) > MAX_CHARS:
            overlap = buffer[-1][-OVERLAP_CHARS:]
            flush()
            if overlap:
                buffer.append(overlap)
        buffer.append(block_text)
        x0, y0 = min(x0, block[0]), min(y0, block[1])
        x1, y1 = max(x1, block[2]), max(y1, block[3])
    flush()
    return regions


def parse_pdf(path: Path) -> list[dict[str, object]]:
    try:
        with fitz.open(path) as document:
            return [region for page in document for region in merge_page_blocks(page)]
    except fitz.FileDataError as error:
        raise ValueError("Unreadable PDF") from error
