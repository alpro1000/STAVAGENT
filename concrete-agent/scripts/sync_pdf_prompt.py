from __future__ import annotations

"""Synchronise the PDF extraction system prompt from docs into runtime."""

import argparse
import hashlib
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

VARIABLE_NAME = "PDF_EXTRACTION_SYSTEM_PROMPT_V2_1_COMPLETE"
DEFAULT_SRC = Path("docs/pdf_extraction_system_prompt_v2_1.md")
DEFAULT_DST = Path("app/prompts/pdf_extraction_system_prompt_v2_1.py")
BANNER_TEMPLATE = (
    "# AUTO-GENERATED FROM {src} — DO NOT EDIT\n"
    "# sha256: {sha}\n"
)


@dataclass(slots=True)
class PromptExtraction:
    """Represents the extracted prompt assignment from the markdown document."""

    assignment: str
    prompt_body: str
    sha256: str


class PromptExtractionError(RuntimeError):
    """Raised when the prompt could not be extracted from the source markdown."""


def _iter_code_blocks(lines: Iterable[str]) -> Iterable[list[str]]:
    inside_block = False
    block_lines: list[str] = []

    for line in lines:
        if line.strip().startswith("```"):
            if not inside_block:
                inside_block = True
                block_lines = []
                continue
            inside_block = False
            yield block_lines
            block_lines = []
            continue
        if inside_block:
            block_lines.append(line)


def extract_prompt(markdown: str, variable_name: str = VARIABLE_NAME) -> PromptExtraction:
    """Extract the triple-quoted assignment for ``variable_name`` from markdown."""

    for block in _iter_code_blocks(markdown.splitlines(keepends=True)):
        block_text = "".join(block)
        if variable_name not in block_text:
            continue

        assignment, prompt_body = _extract_assignment(block_text, variable_name)
        sha256 = hashlib.sha256(prompt_body.encode("utf-8")).hexdigest()
        return PromptExtraction(assignment=assignment, prompt_body=prompt_body, sha256=sha256)

    raise PromptExtractionError(
        f"Could not locate fenced code block with variable '{variable_name}' in markdown"
    )


def _extract_assignment(block_text: str, variable_name: str) -> tuple[str, str]:
    pattern = rf"^{re.escape(variable_name)}\s*=\s*(?P<quote>\"\"\"|''')"
    match = re.search(pattern, block_text, flags=re.MULTILINE)
    if not match:
        raise PromptExtractionError(
            f"Could not find triple-quoted assignment for '{variable_name}'"
        )

    quote_token = match.group("quote")
    assignment_start = match.start()
    body_start = match.end("quote")
    closing_index = block_text.find(quote_token, body_start)
    if closing_index == -1:
        raise PromptExtractionError(
            f"Could not find closing triple quotes for '{variable_name}'"
        )

    assignment_end = closing_index + len(quote_token)
    assignment_text = block_text[assignment_start:assignment_end].rstrip()
    prompt_body = block_text[body_start:closing_index]
    return assignment_text, prompt_body


def generate_module_content(
    extraction: PromptExtraction,
    src: Path = DEFAULT_SRC,
    variable_name: str = VARIABLE_NAME,
) -> str:
    """Generate the module file content based on the extracted prompt."""

    banner = BANNER_TEMPLATE.format(src=src.as_posix(), sha=extraction.sha256)
    lines = [
        banner,
        "# ruff: noqa: E501\n",
        "\n",
        "__all__ = [\"{name}\"]\n".format(name=variable_name),
        f"# Prompt SHA256: {extraction.sha256}\n",
        "\n",
        f"{extraction.assignment}\n",
    ]
    return "".join(lines)


def write_module(dst: Path, content: str) -> bool:
    """Write content to ``dst`` if it differs from existing content."""

    dst.parent.mkdir(parents=True, exist_ok=True)
    if dst.exists():
        existing = dst.read_text(encoding="utf-8")
        if existing == content:
            return False
    dst.write_text(content, encoding="utf-8")
    return True


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--src", type=Path, default=DEFAULT_SRC)
    parser.add_argument("--dst", type=Path, default=DEFAULT_DST)
    parser.add_argument(
        "--out",
        type=Path,
        dest="dst",
        help="Alias for --dst; kept for compatibility with Make targets",
    )
    parser.add_argument("--check", action="store_true", help="Check mode (no write, verify sync)")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)

    try:
        markdown = args.src.read_text(encoding="utf-8")
    except FileNotFoundError:
        print(f"Source markdown not found: {args.src}", file=sys.stderr)
        return 1

    try:
        extraction = extract_prompt(markdown)
    except PromptExtractionError as exc:
        print(str(exc), file=sys.stderr)
        return 1

    content = generate_module_content(extraction, src=args.src)

    if args.check:
        if not args.dst.exists():
            print(f"Destination file missing: {args.dst}", file=sys.stderr)
            return 1
        existing = args.dst.read_text(encoding="utf-8")
        if existing != content:
            print("PDF extraction prompt is out of sync. Run scripts/sync_pdf_prompt.sh.", file=sys.stderr)
            return 1
        return 0

    changed = write_module(args.dst, content)
    if changed:
        print(f"Updated {args.dst}")
    else:
        print(f"No changes for {args.dst}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
