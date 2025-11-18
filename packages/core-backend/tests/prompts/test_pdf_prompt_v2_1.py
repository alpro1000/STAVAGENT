from __future__ import annotations

import hashlib
import sys
from pathlib import Path

import pytest

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.prompts.pdf_extraction_system_prompt_v2_1 import (  # noqa: E402
    PDF_EXTRACTION_SYSTEM_PROMPT_V2_1_COMPLETE,
)
from app.services.pdf_extraction_reasoner import PDFExtractionReasonerV2_1  # noqa: E402
from scripts.sync_pdf_prompt import DEFAULT_SRC, extract_prompt  # noqa: E402


def test_pdf_prompt_constant_contains_expected_markers() -> None:
    prompt = PDF_EXTRACTION_SYSTEM_PROMPT_V2_1_COMPLETE
    assert isinstance(prompt, str)
    assert len(prompt) > 1000
    assert "КАТЕГОРИИ МАРКЕРОВ" in prompt
    assert "norm_reference" in prompt
    assert "perplexity_lookup_required" in prompt


def test_pdf_prompt_sha_matches_docs() -> None:
    markdown = DEFAULT_SRC.read_text(encoding="utf-8")
    extraction = extract_prompt(markdown)

    module_path = Path("app/prompts/pdf_extraction_system_prompt_v2_1.py")
    module_source = module_path.read_text(encoding="utf-8")

    prompt_sha = hashlib.sha256(
        PDF_EXTRACTION_SYSTEM_PROMPT_V2_1_COMPLETE.encode("utf-8")
    ).hexdigest()

    assert prompt_sha == extraction.sha256
    assert f"# Prompt SHA256: {extraction.sha256}" in module_source


class DummyClaudeClient:
    def __init__(self) -> None:
        self.calls: list[dict[str, str]] = []

    def call(self, prompt: str, system_prompt: str | None = None, temperature: float = 0.3):
        self.calls.append(
            {
                "prompt": prompt,
                "system_prompt": system_prompt,
                "temperature": temperature,
            }
        )
        return {"status": "ok"}


@pytest.mark.parametrize(
    "version, expected_system_prompt",
    [
        ("v2.1", PDF_EXTRACTION_SYSTEM_PROMPT_V2_1_COMPLETE),
        ("legacy", "Legacy PDF extraction prompt v1"),
    ],
)
def test_reasoner_uses_configured_system_prompt(tmp_path: Path, version: str, expected_system_prompt: str) -> None:
    config_path = tmp_path / "pdf_extractor_config.yaml"
    config_path.write_text(
        "\n".join(
            [
                "pdf_extractor_p1:",
                f"  prompt_version: \"{version}\"",
            ]
        ),
        encoding="utf-8",
    )

    dummy_claude = DummyClaudeClient()
    reasoner = PDFExtractionReasonerV2_1(dummy_claude, config_path=config_path)

    payload = "PDF payload"
    result = reasoner.run(payload)

    assert dummy_claude.calls, "Claude client should be invoked"
    assert dummy_claude.calls[0]["prompt"] == payload
    assert dummy_claude.calls[0]["system_prompt"] == expected_system_prompt
    assert result == {"status": "ok"}
