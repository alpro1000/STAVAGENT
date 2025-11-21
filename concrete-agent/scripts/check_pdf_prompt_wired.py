"""Validate that the PDF extraction prompt is wired into the runtime."""

import ast
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent

if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

PROMPT_PATH = PROJECT_ROOT / "app" / "prompts" / "pdf_extraction_system_prompt_v2_1.py"
REASONER_PATH = PROJECT_ROOT / "app" / "services" / "pdf_extraction_reasoner.py"
SRC_DOC = PROJECT_ROOT / "docs" / "pdf_extraction_system_prompt_v2_1.md"

CONSTANT_NAME = "PDF_EXTRACTION_SYSTEM_PROMPT_V2_1_COMPLETE"


def _run_sync_check() -> tuple[bool, str]:
    from scripts.sync_pdf_prompt import extract_prompt, generate_module_content

    if not SRC_DOC.exists():
        return False, f"Source prompt document missing: {SRC_DOC}"

    markdown = SRC_DOC.read_text(encoding="utf-8")
    extraction = extract_prompt(markdown)
    try:
        relative_src = SRC_DOC.relative_to(PROJECT_ROOT)
    except ValueError:
        relative_src = SRC_DOC

    expected = generate_module_content(extraction, src=relative_src)

    if not PROMPT_PATH.exists():
        return False, f"Destination prompt module missing: {PROMPT_PATH}"

    existing = PROMPT_PATH.read_text(encoding="utf-8")
    if existing != expected:
        return False, "Generated prompt module is outdated."

    return True, ""


def _constant_defined() -> bool:
    if not PROMPT_PATH.exists():
        return False

    tree = ast.parse(PROMPT_PATH.read_text(encoding="utf-8"))
    for node in tree.body:
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id == CONSTANT_NAME:
                    return True
    return False


def _reasoner_imports_constant() -> bool:
    tree = ast.parse(REASONER_PATH.read_text(encoding="utf-8"))
    has_import = False
    references_constant = False

    for node in tree.body:
        if isinstance(node, ast.ImportFrom) and node.module == "app.prompts.pdf_extraction_system_prompt_v2_1":
            if any(alias.name == CONSTANT_NAME for alias in node.names):
                has_import = True
                break

    for node in ast.walk(tree):
        if isinstance(node, ast.Name) and node.id == CONSTANT_NAME:
            references_constant = True
            break

    return has_import and references_constant


def main() -> int:
    errors: list[str] = []

    ok, sync_message = _run_sync_check()
    if not ok:
        errors.append("PDF extraction prompt is out of sync. Run `make prompt.sync`.")
        if sync_message:
            errors.append(sync_message)

    if not PROMPT_PATH.exists():
        errors.append(f"Missing generated prompt module: {PROMPT_PATH}")
    elif not _constant_defined():
        errors.append(
            f"Constant {CONSTANT_NAME} not found in {PROMPT_PATH}. Ensure sync script generated it."
        )

    if not REASONER_PATH.exists() or not _reasoner_imports_constant():
        errors.append(
            "PDF extraction reasoner does not import/use the v2.1 prompt constant."
        )

    if errors:
        for line in errors:
            print(line, file=sys.stderr)
        return 1

    print("PDF extraction prompt wiring verified.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
