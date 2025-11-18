"""PDF text layer recovery with cascading extractors.

This module implements Task F2 requirements.  It analyses each page of a PDF
document using multiple extractors (pdfminer, pypdfium2 and optionally
Poppler/pdftotext) and classifies the text layer quality.  When regular text
extraction fails due to broken ToUnicode CMaps or subset fonts, the fallback
extractors recover legible text which is then used for technical marker
extraction.

If all extractors fail to provide a usable text layer the page is queued for
OCR which is expected to be executed asynchronously by the orchestration
layer.  The recovery process tracks diagnostics for logging and caching.
"""

from __future__ import annotations

import concurrent.futures
import logging
import subprocess
import time
import unicodedata
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence

from app.core.config import settings

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------


@dataclass(slots=True)
class TextMetrics:
    """Statistics describing a text extraction candidate."""

    text: str
    valid_ratio: float
    pua_ratio: float
    state: str


@dataclass(slots=True)
class PageRecovery:
    """Final recovery result for a single PDF page."""

    page_number: int
    state: str
    miner: TextMetrics
    accepted: TextMetrics
    extractor: str
    fallbacks: Dict[str, TextMetrics] = field(default_factory=dict)
    queued_for_ocr: bool = False

    def to_dict(self) -> Dict[str, object]:
        """Serialise to a JSON-compatible structure."""

        payload = {
            "page": self.page_number,
            "state": self.state,
            "miner": {
                "valid_ratio": round(self.miner.valid_ratio, 3),
                "pua_ratio": round(self.miner.pua_ratio, 3),
            },
            "accepted": {
                "valid_ratio": round(self.accepted.valid_ratio, 3),
                "pua_ratio": round(self.accepted.pua_ratio, 3),
                "extractor": self.extractor,
            },
        }

        if self.fallbacks:
            payload["fallbacks"] = {
                name: {
                    "valid_ratio": round(metrics.valid_ratio, 3),
                    "pua_ratio": round(metrics.pua_ratio, 3),
                }
                for name, metrics in self.fallbacks.items()
            }

        if self.queued_for_ocr:
            payload["queued_for_ocr"] = True

        return payload


@dataclass(slots=True)
class PdfRecoverySummary:
    """Aggregate recovery result for a PDF document."""

    pages: List[PageRecovery]
    used_pdfium: int = 0
    used_poppler: int = 0
    queued_ocr_pages: List[int] = field(default_factory=list)
    ocr_elapsed_ms: float = 0.0

    def to_dict(self) -> Dict[str, object]:
        return {
            "pages": [page.to_dict() for page in self.pages],
            "used_pdfium": self.used_pdfium,
            "used_poppler": self.used_poppler,
            "ocr_pages": self.queued_ocr_pages,
            "ocr_elapsed_ms": round(self.ocr_elapsed_ms, 2),
        }

    def page_state_counters(self) -> Dict[str, int]:
        counters = {"good_text": 0, "encoded_text": 0, "image_only": 0}
        for page in self.pages:
            counters[page.state] = counters.get(page.state, 0) + 1
        return counters


# ---------------------------------------------------------------------------
# Helper utilities
# ---------------------------------------------------------------------------


_VALID_CATEGORIES = {"Lu", "Ll", "Lt", "Lo", "Lm", "Nd", "Nl", "No"}
_ALLOWED_SYMBOLS = set("°%±×÷Øø⌀…·•@#&$€£¥₽‰√∅→←≥≤±µΩ∠°" "-_/+()[]{}<>.,:;!?|*'\"\\")
_WHITESPACE = {" ", "\t", "\n", "\r", "\f", "\v"}


def _analyse_text(text: str) -> TextMetrics:
    """Return metrics describing the quality of ``text``."""

    if not text:
        return TextMetrics(text=text, valid_ratio=0.0, pua_ratio=0.0, state="image_only")

    valid = 0
    total = 0
    pua = 0

    for char in text:
        if char in _WHITESPACE:
            continue
        total += 1
        code_point = ord(char)

        if 0xE000 <= code_point <= 0xF8FF or 0xF0000 <= code_point <= 0xFFFFD or 0x100000 <= code_point <= 0x10FFFD:
            pua += 1
            continue

        if _is_valid_character(char):
            valid += 1

    if total == 0:
        return TextMetrics(text=text, valid_ratio=0.0, pua_ratio=0.0, state="image_only")

    valid_ratio = valid / total
    pua_ratio = pua / total

    if valid_ratio >= settings.PDF_VALID_CHAR_RATIO:
        state = "good_text"
    elif pua_ratio >= settings.PDF_PUA_RATIO:
        state = "encoded_text"
    else:
        state = "encoded_text"

    return TextMetrics(text=text, valid_ratio=valid_ratio, pua_ratio=pua_ratio, state=state)


def _is_valid_character(char: str) -> bool:
    category = unicodedata.category(char)
    if category in _VALID_CATEGORIES:
        return True
    if char in _ALLOWED_SYMBOLS:
        return True
    if category.startswith("M"):
        # Combining marks are treated as valid to preserve diacritics.
        return True
    if char.isnumeric():
        return True
    return False


def _is_better(candidate: TextMetrics, baseline: TextMetrics) -> bool:
    """Decide if ``candidate`` is better than ``baseline``."""

    if candidate.valid_ratio > baseline.valid_ratio + 0.02:
        return True
    if abs(candidate.valid_ratio - baseline.valid_ratio) <= 0.02 and candidate.pua_ratio + 0.05 < baseline.pua_ratio:
        return True
    return False


# ---------------------------------------------------------------------------
# Recovery engine
# ---------------------------------------------------------------------------


class PdfTextRecovery:
    """Recover usable text layers from PDF pages using multiple extractors."""

    def __init__(self) -> None:
        self._pdfium_available: Optional[bool] = None
        self._poppler_available: Optional[bool] = None

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def recover(self, file_path: Path, *, use_ocr: Optional[bool] = None) -> PdfRecoverySummary:
        """Run the recovery cascade for ``file_path``."""

        miner_pages = list(self._extract_pdfminer(file_path))
        total_pages = len(miner_pages)

        if total_pages == 0:
            total_pages = self._estimate_page_count(file_path)
            miner_pages = [""] * total_pages

        recovery: List[PageRecovery] = []

        fallback_candidates: List[int] = []
        pdfium_results: Dict[int, TextMetrics] = {}
        poppler_results: Dict[int, TextMetrics] = {}

        for index, text in enumerate(miner_pages, start=1):
            metrics = _analyse_text(text)

            if metrics.state != "good_text":
                fallback_candidates.append(index)

            page_recovery = PageRecovery(
                page_number=index,
                state=metrics.state,
                miner=metrics,
                accepted=metrics,
                extractor="pdfminer",
            )
            recovery.append(page_recovery)

        if fallback_candidates:
            pdfium_results = self._recover_with_pdfium(file_path, fallback_candidates)

        for page_number in fallback_candidates:
            page = recovery[page_number - 1]
            pdfium_metrics = pdfium_results.get(page_number)
            if pdfium_metrics and pdfium_metrics.valid_ratio >= settings.PDF_FALLBACK_VALID_RATIO:
                page.fallbacks["pdfium"] = pdfium_metrics
                page.accepted = pdfium_metrics
                page.extractor = "pdfium"
                continue

            if pdfium_metrics:
                page.fallbacks["pdfium"] = pdfium_metrics

            if not settings.PDF_ENABLE_POPPLER:
                continue

            poppler_metrics = self._recover_with_poppler(file_path, page_number)
            if poppler_metrics:
                page.fallbacks["poppler"] = poppler_metrics
                if _is_better(poppler_metrics, page.accepted) and poppler_metrics.valid_ratio >= settings.PDF_FALLBACK_VALID_RATIO:
                    page.accepted = poppler_metrics
                    page.extractor = "poppler"

        queued_for_ocr: List[int] = []
        ocr_enabled = settings.PDF_ENABLE_OCR if use_ocr is None else use_ocr
        ocr_budget = settings.PDF_MAX_PAGES_FOR_OCR if ocr_enabled else 0
        ocr_elapsed = 0.0
        ocr_budget_warned = False

        if ocr_enabled and not self._pdfium_available:
            self._pdfium_available = self._check_pdfium()

        if ocr_enabled and not self._pdfium_available:
            logger.debug("Cannot perform OCR for %s without pdfium", file_path.name)
            ocr_enabled = False

        if ocr_enabled:
            try:  # pragma: no cover - import guard executed in production env
                import pytesseract  # noqa: F401
            except ImportError:
                logger.debug("pytesseract not available. Disabling OCR fallback.")
                ocr_enabled = False

        per_page_timeout = settings.PDF_OCR_PAGE_TIMEOUT_SEC
        total_timeout = settings.PDF_OCR_TOTAL_TIMEOUT_SEC

        for page in recovery:
            if not ocr_enabled or ocr_budget <= 0:
                break

            reason = self._ocr_trigger_reason(page)
            if reason is None:
                continue

            remaining_budget = total_timeout - ocr_elapsed
            if remaining_budget <= 0:
                if not ocr_budget_warned:
                    logger.warning(
                        "OCR budget exceeded for %s after %.2fs; skipping remaining pages",
                        file_path.name,
                        ocr_elapsed,
                    )
                    ocr_budget_warned = True
                break

            timeout = min(per_page_timeout, max(0.0, remaining_budget))
            text, elapsed, error = self._perform_ocr(file_path, page.page_number, timeout)
            ocr_elapsed += elapsed
            ocr_budget -= 1

            page.queued_for_ocr = True
            queued_for_ocr.append(page.page_number)

            if error == "timeout":
                logger.warning(
                    "OCR timed out for %s page %s after %.0f ms",
                    file_path.name,
                    page.page_number,
                    elapsed * 1000,
                )
                continue

            if error:
                logger.warning(
                    "OCR failed for %s page %s: %s",
                    file_path.name,
                    page.page_number,
                    error,
                )
                continue

            if not text.strip():
                continue

            metrics = _analyse_text(text)
            page.fallbacks["ocr"] = metrics
            page.accepted = metrics
            page.extractor = "ocr"

            logger.warning(
                "OCR triggered for %s page %s: reason=%s elapsed_ms=%.0f",
                file_path.name,
                page.page_number,
                reason,
                elapsed * 1000,
            )

        used_pdfium = sum(1 for page in recovery if page.extractor == "pdfium")
        used_poppler = sum(1 for page in recovery if page.extractor == "poppler")

        return PdfRecoverySummary(
            pages=recovery,
            used_pdfium=used_pdfium,
            used_poppler=used_poppler,
            queued_ocr_pages=queued_for_ocr,
            ocr_elapsed_ms=ocr_elapsed * 1000,
        )

    # ------------------------------------------------------------------
    # Extractors
    # ------------------------------------------------------------------

    def _extract_pdfminer(self, file_path: Path) -> Iterable[str]:
        try:
            from pdfminer.high_level import extract_pages
            from pdfminer.layout import LTTextContainer
        except ImportError:  # pragma: no cover - environment without pdfminer
            logger.warning("pdfminer.six is not installed. Skipping primary extraction.")
            return []

        def _iter_pages() -> Iterable[str]:
            try:
                for page_layout in extract_pages(str(file_path)):
                    strings: List[str] = []
                    for element in page_layout:
                        if isinstance(element, LTTextContainer):
                            strings.append(element.get_text())
                    yield "".join(strings)
            except Exception as exc:  # pragma: no cover - pdfminer edge cases
                logger.warning("pdfminer failed on %s: %s", file_path.name, exc)

        return list(_iter_pages())

    def _recover_with_pdfium(self, file_path: Path, pages: Sequence[int]) -> Dict[int, TextMetrics]:
        if not pages:
            return {}

        if not self._pdfium_available:
            self._pdfium_available = self._check_pdfium()

        if not self._pdfium_available:
            return {}

        try:
            import pypdfium2 as pdfium
        except ImportError:  # pragma: no cover - optional dependency missing
            logger.warning("pypdfium2 not installed. Skipping fallback extraction.")
            self._pdfium_available = False
            return {}

        limited_pages = pages[: settings.PDF_MAX_PAGES_FOR_FALLBACK]
        results: Dict[int, TextMetrics] = {}

        with pdfium.PdfDocument(str(file_path)) as document:
            for page_number in limited_pages:
                try:
                    page = document.get_page(page_number - 1)
                except ValueError:
                    continue
                textpage = page.get_textpage()
                try:
                    text = textpage.get_text_range()
                finally:
                    textpage.close()
                    page.close()

                metrics = _analyse_text(text or "")
                results[page_number] = metrics

        return results

    def _recover_with_poppler(self, file_path: Path, page_number: int) -> Optional[TextMetrics]:
        if not self._poppler_available:
            self._poppler_available = self._check_poppler()

        if not self._poppler_available:
            return None

        command = [
            "pdftotext",
            "-layout",
            "-nopgbrk",
            "-f",
            str(page_number),
            "-l",
            str(page_number),
            str(file_path),
            "-",
        ]

        try:
            completed = subprocess.run(
                command,
                capture_output=True,
                text=True,
                timeout=settings.PDF_PAGE_TIMEOUT_SEC,
                check=False,
            )
        except FileNotFoundError:  # pragma: no cover - poppler missing
            logger.debug("pdftotext command not found. Disabling Poppler fallback.")
            self._poppler_available = False
            return None
        except subprocess.TimeoutExpired:
            logger.warning("pdftotext timed out on %s page %s", file_path.name, page_number)
            return None

        if completed.returncode != 0:
            logger.debug(
                "pdftotext failed on %s page %s with code %s", file_path.name, page_number, completed.returncode
            )
            return None

        text = completed.stdout or ""
        if not text.strip():
            return None

        return _analyse_text(text)

    # ------------------------------------------------------------------
    # OCR queue (placeholder implementation)
    # ------------------------------------------------------------------

    def _ocr_trigger_reason(self, page: PageRecovery) -> Optional[str]:
        metrics = page.accepted
        text = (metrics.text or "").strip()

        if metrics.state in {"encoded_text", "image_only"}:
            return "encoded_text_or_empty"

        if len(text) < 20:
            return "encoded_text_or_empty"

        return None

    def _perform_ocr(
        self,
        file_path: Path,
        page_number: int,
        timeout: float,
    ) -> tuple[str, float, Optional[str]]:
        start = time.perf_counter()

        def _worker() -> str:
            try:
                import pypdfium2 as pdfium
            except ImportError as exc:  # pragma: no cover - dependency missing
                raise RuntimeError("pypdfium2 not installed") from exc

            try:
                from PIL import Image
            except ImportError as exc:  # pragma: no cover - dependency missing
                raise RuntimeError("Pillow not installed") from exc

            try:
                import pytesseract
            except ImportError as exc:  # pragma: no cover - dependency missing
                raise RuntimeError("pytesseract not installed") from exc

            with pdfium.PdfDocument(str(file_path)) as document:
                try:
                    page = document.get_page(page_number - 1)
                except ValueError as exc:
                    raise RuntimeError(f"page {page_number} out of range") from exc

                bitmap = page.render(scale=2.0)
                pil_image = bitmap.to_pil()
                page.close()

            if not isinstance(pil_image, Image.Image):  # pragma: no cover - safety guard
                pil_image = Image.fromarray(pil_image)

            languages = "ces+eng"
            return pytesseract.image_to_string(pil_image, lang=languages)

        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(_worker)
            try:
                text = future.result(timeout=max(timeout, 0.1))
            except concurrent.futures.TimeoutError:
                duration = time.perf_counter() - start
                future.cancel()
                return "", duration, "timeout"
            except Exception as exc:  # noqa: BLE001 - propagated for diagnostics
                duration = time.perf_counter() - start
                return "", duration, str(exc)

        duration = time.perf_counter() - start
        return text, duration, None

    # ------------------------------------------------------------------
    # Utilities
    # ------------------------------------------------------------------

    @staticmethod
    def _estimate_page_count(file_path: Path) -> int:
        try:
            import pypdfium2 as pdfium
        except ImportError:  # pragma: no cover - optional dependency missing
            return 0

        with pdfium.PdfDocument(str(file_path)) as document:
            return len(document)

    @staticmethod
    def _check_pdfium() -> bool:
        try:
            import pypdfium2  # noqa: F401
        except ImportError:  # pragma: no cover - optional dependency missing
            logger.debug("pypdfium2 not available")
            return False
        return True

    @staticmethod
    def _check_poppler() -> bool:
        try:
            subprocess.run(["pdftotext", "-v"], capture_output=True, text=True, timeout=1)
        except FileNotFoundError:
            logger.debug("pdftotext binary not found")
            return False
        except subprocess.TimeoutExpired:
            return True
        return True


__all__ = ["PdfTextRecovery", "PdfRecoverySummary", "PageRecovery"]

