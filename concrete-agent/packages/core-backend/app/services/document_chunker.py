"""
Document Chunker — Split documents into processable chunks.

Strategies:
  - PDF TZ: section-based (by headings like "4.1", "4.2") → fallback to page groups
  - PDF drawings: one page = one chunk
  - Excel: one díl/section = one chunk (via ParsedDocument adapter)
  - First 2-3 pages always a separate "metadata" chunk

Overlap: last paragraph of previous chunk prepended to next chunk.

Author: STAVAGENT Team
Version: 1.0.0
Date: 2026-04-01
"""

import logging
import re
from typing import List, Optional, Tuple

from app.models.extraction_schemas import ChunkInfo

logger = logging.getLogger(__name__)

# ── Section heading patterns for Czech construction TZ ────────

_SECTION_HEADING_RE = re.compile(
    r"^(?:"
    r"(\d{1,2}(?:\.\d{1,2}){0,3})\s+"   # numbered: 4.1, 4.1.2, etc.
    r"|([A-Z][A-Z\s]{5,80})$"             # ALL CAPS heading (standalone line)
    r")",
    re.MULTILINE,
)

_PAGE_BREAK = "--- PAGE BREAK ---"

# Min chars to consider a chunk valid
_MIN_CHUNK_CHARS = 200
# Max chars per chunk for AI (fits comfortably in Gemini Flash context)
_MAX_CHUNK_CHARS = 25000
# Pages per group in fallback mode
_PAGES_PER_GROUP = 4
# Overlap: chars from end of previous chunk prepended to next
_OVERLAP_CHARS = 500
# Metadata pages (title, TOC)
_METADATA_PAGES = 3


def chunk_pdf_text(
    full_text: str,
    total_pages: int,
    doc_type: str = "tz",
) -> List[Tuple[ChunkInfo, str]]:
    """
    Split PDF text into chunks with metadata.

    Returns list of (ChunkInfo, chunk_text) tuples.
    """
    if not full_text or not full_text.strip():
        return []

    pages = _split_into_pages(full_text)
    if not pages:
        pages = [full_text]

    actual_pages = len(pages)

    # Small document (≤5 pages) → single chunk, no splitting needed
    if actual_pages <= 5:
        chunk = ChunkInfo(
            chunk_id="chunk_0_full",
            chunk_index=0,
            page_start=1,
            page_end=actual_pages,
            section_title="Celý dokument",
            char_count=len(full_text),
            strategy="full",
        )
        return [(chunk, full_text)]

    # Drawing PDFs → one page per chunk
    if doc_type in ("drawing", "situace", "vykres"):
        return _chunk_by_single_page(pages)

    # TZ documents → try section-based, fallback to page groups
    chunks = _chunk_by_sections(pages, full_text)
    if chunks and len(chunks) > 1:
        return chunks

    # Fallback: page groups
    return _chunk_by_page_groups(pages)


def _split_into_pages(text: str) -> List[str]:
    """Split text by page break markers (from pdfplumber/MinerU)."""
    if _PAGE_BREAK in text:
        return [p.strip() for p in text.split(_PAGE_BREAK) if p.strip()]

    # MinerU sometimes uses triple newlines
    parts = re.split(r"\n{4,}", text)
    if len(parts) > 2:
        return [p.strip() for p in parts if p.strip()]

    return [text]


def _chunk_by_sections(
    pages: List[str], full_text: str
) -> List[Tuple[ChunkInfo, str]]:
    """Try to split by document section headings."""
    # Find all section headings with their positions
    sections: List[Tuple[int, str, int]] = []  # (char_offset, title, page_num)

    cumulative = 0
    page_starts: List[int] = []
    for p in pages:
        page_starts.append(cumulative)
        cumulative += len(p) + len(_PAGE_BREAK) + 2  # approximate

    for m in _SECTION_HEADING_RE.finditer(full_text):
        title = (m.group(1) or m.group(2) or "").strip()
        if not title or len(title) < 2:
            continue
        offset = m.start()
        # Determine page number
        page_num = 1
        for i, ps in enumerate(page_starts):
            if offset >= ps:
                page_num = i + 1
        sections.append((offset, title, page_num))

    # Need at least 3 sections to justify section-based chunking
    if len(sections) < 3:
        return []

    chunks: List[Tuple[ChunkInfo, str]] = []

    # Metadata chunk: everything before first section (or first N pages)
    first_section_offset = sections[0][0]
    if first_section_offset > _MIN_CHUNK_CHARS:
        meta_text = full_text[:first_section_offset].strip()
        meta_page_end = sections[0][2] - 1 if sections[0][2] > 1 else 1
        chunks.append((
            ChunkInfo(
                chunk_id="chunk_meta",
                chunk_index=0,
                page_start=1,
                page_end=max(1, meta_page_end),
                section_title="Metadata / Úvod",
                char_count=len(meta_text),
                strategy="sections",
            ),
            meta_text,
        ))

    # Section chunks
    for i, (offset, title, page_num) in enumerate(sections):
        end_offset = sections[i + 1][0] if i + 1 < len(sections) else len(full_text)
        end_page = sections[i + 1][2] if i + 1 < len(sections) else len(pages)
        section_text = full_text[offset:end_offset].strip()

        # If section is too large, split it further
        if len(section_text) > _MAX_CHUNK_CHARS:
            sub_chunks = _split_large_section(
                section_text, title, page_num, end_page, len(chunks)
            )
            chunks.extend(sub_chunks)
        elif len(section_text) >= _MIN_CHUNK_CHARS:
            chunks.append((
                ChunkInfo(
                    chunk_id=f"chunk_{len(chunks)}_{title[:20].replace(' ', '_')}",
                    chunk_index=len(chunks),
                    page_start=page_num,
                    page_end=end_page,
                    section_title=title,
                    char_count=len(section_text),
                    strategy="sections",
                ),
                section_text,
            ))

    return chunks


def _split_large_section(
    text: str, title: str, page_start: int, page_end: int, base_index: int
) -> List[Tuple[ChunkInfo, str]]:
    """Split an oversized section into sub-chunks by paragraph breaks."""
    paragraphs = re.split(r"\n{2,}", text)
    chunks: List[Tuple[ChunkInfo, str]] = []
    current_text = ""
    sub_idx = 0
    total_pages = max(1, page_end - page_start + 1)

    for para in paragraphs:
        if len(current_text) + len(para) > _MAX_CHUNK_CHARS and current_text:
            # Estimate page range proportionally
            progress = len(current_text) / max(1, len(text))
            est_page = page_start + int(progress * total_pages)
            chunks.append((
                ChunkInfo(
                    chunk_id=f"chunk_{base_index + len(chunks)}_{title[:15]}_{sub_idx}",
                    chunk_index=base_index + len(chunks),
                    page_start=page_start if sub_idx == 0 else est_page,
                    page_end=est_page,
                    section_title=f"{title} (část {sub_idx + 1})",
                    char_count=len(current_text),
                    strategy="sections",
                ),
                current_text,
            ))
            # Overlap: keep tail of previous chunk
            current_text = current_text[-_OVERLAP_CHARS:] + "\n\n" + para
            sub_idx += 1
        else:
            current_text += ("\n\n" if current_text else "") + para

    if current_text.strip():
        chunks.append((
            ChunkInfo(
                chunk_id=f"chunk_{base_index + len(chunks)}_{title[:15]}_{sub_idx}",
                chunk_index=base_index + len(chunks),
                page_start=page_start,
                page_end=page_end,
                section_title=f"{title} (část {sub_idx + 1})" if sub_idx > 0 else title,
                char_count=len(current_text),
                strategy="sections",
            ),
            current_text,
        ))

    return chunks


def _chunk_by_page_groups(pages: List[str]) -> List[Tuple[ChunkInfo, str]]:
    """Fallback: group pages into fixed-size chunks with overlap."""
    chunks: List[Tuple[ChunkInfo, str]] = []
    total = len(pages)

    # Metadata chunk: first N pages
    meta_end = min(_METADATA_PAGES, total)
    meta_text = ("\n\n" + _PAGE_BREAK + "\n\n").join(pages[:meta_end])
    if meta_text.strip():
        chunks.append((
            ChunkInfo(
                chunk_id="chunk_meta",
                chunk_index=0,
                page_start=1,
                page_end=meta_end,
                section_title="Metadata / Úvod",
                char_count=len(meta_text),
                strategy="pages",
            ),
            meta_text,
        ))

    # Remaining pages in groups
    i = meta_end
    while i < total:
        end = min(i + _PAGES_PER_GROUP, total)
        group_pages = pages[i:end]

        # Add overlap from previous page
        if i > 0:
            prev_text = pages[i - 1]
            overlap = prev_text[-_OVERLAP_CHARS:] if len(prev_text) > _OVERLAP_CHARS else prev_text
            group_text = overlap + "\n\n" + ("\n\n" + _PAGE_BREAK + "\n\n").join(group_pages)
        else:
            group_text = ("\n\n" + _PAGE_BREAK + "\n\n").join(group_pages)

        if group_text.strip():
            chunks.append((
                ChunkInfo(
                    chunk_id=f"chunk_{len(chunks)}_p{i+1}_{end}",
                    chunk_index=len(chunks),
                    page_start=i + 1,
                    page_end=end,
                    section_title=f"Stránky {i+1}–{end}",
                    char_count=len(group_text),
                    strategy="pages",
                ),
                group_text,
            ))

        i = end

    return chunks


def _chunk_by_single_page(pages: List[str]) -> List[Tuple[ChunkInfo, str]]:
    """Each page is a separate chunk (for drawings)."""
    chunks: List[Tuple[ChunkInfo, str]] = []
    for i, page_text in enumerate(pages):
        if not page_text.strip():
            continue
        chunks.append((
            ChunkInfo(
                chunk_id=f"chunk_{i}_drawing",
                chunk_index=i,
                page_start=i + 1,
                page_end=i + 1,
                section_title=f"Výkres strana {i+1}",
                char_count=len(page_text),
                strategy="pages",
            ),
            page_text,
        ))
    return chunks


def detect_text_layer_quality(file_path: str) -> str:
    """
    Check if PDF has usable text layer.
    Returns: "text" (pdfplumber ok), "scan" (needs MinerU), "hybrid"
    """
    try:
        import pdfplumber
        with pdfplumber.open(file_path) as pdf:
            sample_pages = pdf.pages[:3]
            if not sample_pages:
                return "scan"
            chars_per_page = []
            has_tables = False
            for page in sample_pages:
                text = page.extract_text() or ""
                chars_per_page.append(len(text))
                tables = page.extract_tables() or []
                if len(tables) > 3:
                    has_tables = True

            avg_chars = sum(chars_per_page) / len(chars_per_page) if chars_per_page else 0

            if avg_chars < 50:
                return "scan"
            if has_tables and avg_chars < 200:
                return "hybrid"
            return "text"
    except Exception as e:
        logger.warning("detect_text_layer_quality failed: %s", e)
        return "scan"
