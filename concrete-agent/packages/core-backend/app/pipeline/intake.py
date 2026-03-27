"""
Layer 0: File Intake — validation, format detection, conversion routing.
"""

import logging
from pathlib import Path
from typing import Optional

from .models import FileFormat, IntakeResult

logger = logging.getLogger(__name__)

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB

# Extension → FileFormat mapping
EXTENSION_MAP: dict[str, FileFormat] = {
    ".pdf": FileFormat.PDF,
    ".xlsx": FileFormat.XLSX,
    ".xlsm": FileFormat.XLSX,
    ".xls": FileFormat.XLS,
    ".csv": FileFormat.CSV,
    ".tsv": FileFormat.CSV,
    ".xml": FileFormat.XML,
    ".docx": FileFormat.DOCX,
    ".doc": FileFormat.DOC,
    ".jpg": FileFormat.JPEG,
    ".jpeg": FileFormat.JPEG,
    ".png": FileFormat.PNG,
    ".tif": FileFormat.TIFF,
    ".tiff": FileFormat.TIFF,
    ".dwg": FileFormat.DWG,
    ".dxf": FileFormat.DXF,
    ".ifc": FileFormat.IFC,
    ".rvt": FileFormat.RVT,
    ".zip": FileFormat.ZIP,
    ".rar": FileFormat.ZIP,
    ".7z": FileFormat.ZIP,
}

# Magic bytes for format verification
MAGIC_BYTES: dict[FileFormat, list[bytes]] = {
    FileFormat.PDF: [b"%PDF"],
    FileFormat.XLSX: [b"PK\x03\x04"],  # ZIP-based
    FileFormat.XLS: [b"\xd0\xcf\x11\xe0"],  # OLE2
    FileFormat.DOCX: [b"PK\x03\x04"],
    FileFormat.DOC: [b"\xd0\xcf\x11\xe0"],
    FileFormat.ZIP: [b"PK\x03\x04", b"Rar!", b"7z\xbc\xaf"],
    FileFormat.PNG: [b"\x89PNG"],
    FileFormat.JPEG: [b"\xff\xd8\xff"],
    FileFormat.TIFF: [b"II\x2a\x00", b"MM\x00\x2a"],
}

# Formats that need conversion before processing
NEEDS_CONVERSION: dict[FileFormat, str] = {
    FileFormat.DOC: "docx",
    FileFormat.DWG: "pdf",
    FileFormat.RVT: "ifc",
}


def intake_file(
    filename: str,
    file_bytes: bytes,
    content_type: Optional[str] = None,
) -> IntakeResult:
    """Validate file, detect format, check if conversion is needed."""
    ext = Path(filename).suffix.lower()
    fmt = EXTENSION_MAP.get(ext, FileFormat.UNKNOWN)
    size = len(file_bytes)

    # Size validation
    if size == 0:
        return IntakeResult(
            format=fmt, size_bytes=0, is_valid=False,
            error="Soubor je prázdný.", original_filename=filename,
        )
    if size > MAX_FILE_SIZE:
        return IntakeResult(
            format=fmt, size_bytes=size, is_valid=False,
            error=f"Soubor je příliš velký ({size // (1024*1024)} MB, max {MAX_FILE_SIZE // (1024*1024)} MB).",
            original_filename=filename,
        )

    # Unknown format
    if fmt == FileFormat.UNKNOWN:
        return IntakeResult(
            format=fmt, size_bytes=size, is_valid=False,
            error=f"Nepodporovaný formát: {ext}",
            original_filename=filename,
        )

    # Magic bytes verification (optional — skip for small files)
    if fmt in MAGIC_BYTES and size >= 8:
        header = file_bytes[:8]
        if not any(header.startswith(magic) for magic in MAGIC_BYTES[fmt]):
            logger.warning(
                f"Magic bytes mismatch for {filename}: expected {fmt.value}, "
                f"header={header[:4].hex()}"
            )
            # Don't reject — extension is usually right, magic bytes can vary

    # Conversion needed?
    needs_conv = fmt in NEEDS_CONVERSION
    conv_target = NEEDS_CONVERSION.get(fmt)

    logger.info(
        f"[Intake] {filename}: format={fmt.value}, size={size}, "
        f"needs_conversion={needs_conv}"
    )

    return IntakeResult(
        format=fmt,
        size_bytes=size,
        is_valid=True,
        needs_conversion=needs_conv,
        conversion_target=conv_target,
        original_filename=filename,
        mime_type=content_type,
    )
