"""
IFC streaming strategy + RSS monitor — PR3 §3.3 + v3 §15.4.

Tiered strategy by file size (per v3 §15.4):

  <200 MB   → standard full-load              (~<500MB RAM)
  200MB-1GB → partial streaming                (~<1.5 GB RAM)
  1-2 GB    → strict streaming (multi-pass)    (~<1.5 GB RAM)
  >2 GB     → reject upfront

The extractor reads `pick_streaming_strategy(size)` and chooses how to
walk the model. PR3 ships the strategy enum + RSS monitor; the actual
streaming logic is selected via the strategy in IfcExtractor. Strict
multi-pass streaming is implemented as small bounded iterators inside
the extractor's per-category emitters (no full geometry pre-load).

RSS monitor (`RssAbortGuard`) runs in a background thread, checks
`psutil.Process().memory_info().rss` every 5 s, and sets a stop flag
when usage exceeds the configurable budget (default 95% of allocated).
The extractor checks the flag between phases and aborts gracefully
rather than OOM-crashing.

Reference: docs/TASK_DocumentExtraction_Universal_Pipeline.md §15.4
"""

from __future__ import annotations

import logging
import threading
import time
from enum import Enum

logger = logging.getLogger(__name__)


# Tier thresholds in bytes (per v3 §15.4).
STANDARD_LIMIT_BYTES = 200 * 1024 * 1024            # 200 MB
PARTIAL_LIMIT_BYTES = 1024 * 1024 * 1024            # 1 GB
STRICT_LIMIT_BYTES = 2 * 1024 * 1024 * 1024         # 2 GB
IFC_REJECT_THRESHOLD_BYTES = STRICT_LIMIT_BYTES     # hard reject > 2 GB


class StreamingStrategy(str, Enum):
    STANDARD = "standard"           # full-load, <200 MB
    PARTIAL = "partial"             # geometry iterator + selective full
    STRICT = "strict"               # multi-pass per entity category
    REJECT = "reject"               # too big for any strategy


def pick_streaming_strategy(size_bytes: int) -> StreamingStrategy:
    """Pure helper. The extractor reads this once at the top of
    `_extract` and embeds the choice in `raw_data` for audit replay."""

    if size_bytes <= STANDARD_LIMIT_BYTES:
        return StreamingStrategy.STANDARD
    if size_bytes <= PARTIAL_LIMIT_BYTES:
        return StreamingStrategy.PARTIAL
    if size_bytes <= STRICT_LIMIT_BYTES:
        return StreamingStrategy.STRICT
    return StreamingStrategy.REJECT


# ---------------------------------------------------------------------------
# RSS monitor — graceful-abort guard
# ---------------------------------------------------------------------------


class RssAbortGuard:
    """Background thread polling `psutil.Process().memory_info().rss`.

    When RSS exceeds `budget_bytes * abort_ratio`, sets `should_abort()`
    True. The extractor checks the flag between phases and raises a
    clean ExtractorError rather than OOM-crashing the worker.

    `psutil` import is lazy — without it, the guard becomes a no-op
    (production Docker image installs psutil; sandbox often doesn't).
    """

    def __init__(
        self,
        budget_bytes: int = 1_500_000_000,  # 1.5 GB per task §15.4
        abort_ratio: float = 0.95,
        poll_interval_s: float = 5.0,
    ) -> None:
        self._budget = int(budget_bytes * abort_ratio)
        self._poll_s = poll_interval_s
        self._abort_event = threading.Event()
        self._stop_event = threading.Event()
        self._thread: threading.Thread | None = None
        self._peak_rss = 0

    @property
    def peak_rss_bytes(self) -> int:
        return self._peak_rss

    def should_abort(self) -> bool:
        return self._abort_event.is_set()

    def start(self) -> None:
        try:
            import psutil  # type: ignore[import-not-found]
        except ImportError:
            logger.info("[uep.ifc] psutil unavailable; RssAbortGuard is a no-op")
            return
        self._proc = psutil.Process()  # type: ignore[attr-defined]
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop_event.set()
        if self._thread is not None:
            self._thread.join(timeout=2.0)

    def __enter__(self) -> "RssAbortGuard":
        self.start()
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        self.stop()

    def _loop(self) -> None:
        while not self._stop_event.is_set():
            try:
                rss = self._proc.memory_info().rss  # type: ignore[attr-defined]
                if rss > self._peak_rss:
                    self._peak_rss = rss
                if rss > self._budget and not self._abort_event.is_set():
                    logger.warning(
                        "[uep.ifc] RSS %.1f MB > budget %.1f MB — abort requested",
                        rss / 1024**2, self._budget / 1024**2,
                    )
                    self._abort_event.set()
            except Exception:  # noqa: BLE001 — guard never crashes the caller
                pass
            time.sleep(self._poll_s)
