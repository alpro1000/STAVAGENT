"""
MinerU Service — standalone PDF parsing microservice.

Cloud Run microservice wrapping magic-pdf CLI.
Scale to zero, 4GB RAM, called by concrete-agent via HTTP.
"""

from fastapi import FastAPI, UploadFile, HTTPException
from fastapi.responses import JSONResponse
import tempfile
import os
import subprocess
import logging
from pathlib import Path

logger = logging.getLogger(__name__)
app = FastAPI(title="MinerU Service", version="1.0.0")


@app.get("/health")
def health():
    """Health check for Cloud Run."""
    # MinerU 2.x CLI: try 'mineru' first (v2.x), then 'magic-pdf' (v1.x)
    mineru_ok = False
    cli_cmd = None
    for cmd in ["mineru", "magic-pdf"]:
        try:
            result = subprocess.run(
                [cmd, "--version"],
                capture_output=True, timeout=5
            )
            if result.returncode == 0:
                mineru_ok = True
                cli_cmd = cmd
                break
        except FileNotFoundError:
            continue
        except Exception:
            continue

    return {
        "status": "ok" if mineru_ok else "degraded",
        "mineru_available": mineru_ok,
        "cli_command": cli_cmd,
    }


@app.post("/parse-pdf")
async def parse_pdf(
    file: UploadFile,
    method: str = "auto",
):
    """
    Parse PDF using MinerU and return extracted text as markdown.

    method="auto" — MinerU decides (text vs OCR)
    method="txt"  — text layer only, fast
    method="ocr"  — PaddleOCR, for scanned documents
    """
    if not file.filename or not file.filename.lower().endswith('.pdf'):
        raise HTTPException(400, "Only PDF files are supported")

    if method not in ("auto", "txt", "ocr"):
        raise HTTPException(400, f"Invalid method: {method}")

    with tempfile.TemporaryDirectory() as tmpdir:
        pdf_path = os.path.join(tmpdir, "input.pdf")
        content = await file.read()
        with open(pdf_path, 'wb') as f:
            f.write(content)

        out_dir = os.path.join(tmpdir, "output")
        os.makedirs(out_dir)

        cli_cmd = _detect_cli()
        try:
            result = subprocess.run(
                [cli_cmd, "-p", pdf_path, "-o", out_dir, "--method", method],
                capture_output=True,
                timeout=180,
                text=True,
            )
        except subprocess.TimeoutExpired:
            raise HTTPException(504, "MinerU timeout (>180s)")

        if result.returncode != 0:
            logger.error(f"MinerU stderr: {result.stderr}")
            raise HTTPException(500, f"MinerU failed: {result.stderr[:200]}")

        # Find output .md file
        md_text = _find_md_output(out_dir)

        return JSONResponse({
            "text": md_text,
            "method_used": method,
            "pages_processed": md_text.count('\n\n'),
            "chars": len(md_text),
        })


def _detect_cli() -> str:
    """Detect MinerU CLI command name (v2.x='mineru', v1.x='magic-pdf')."""
    import shutil
    for cmd in ["mineru", "magic-pdf"]:
        if shutil.which(cmd):
            return cmd
    raise RuntimeError("Neither 'mineru' nor 'magic-pdf' CLI found in PATH")


def _find_md_output(out_dir: str) -> str:
    """Find the markdown output file from MinerU."""
    for root, dirs, files in os.walk(out_dir):
        for fname in sorted(files):
            if fname.endswith('.md'):
                with open(os.path.join(root, fname), encoding='utf-8') as fh:
                    return fh.read()
    return ""
