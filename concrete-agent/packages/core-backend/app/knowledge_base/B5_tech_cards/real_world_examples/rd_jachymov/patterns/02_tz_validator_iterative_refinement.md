# Pattern 02 — TZ validator iterative refinement (regex hardening loop)

**Source pilot:** RD Jáchymov (Phase 0b §3.2)
**Pipeline phase:** validation gate before Phase 1 item generation
**Status:** validated

## Problem

Initial `phase0b_validator.py` mělo 33/69 matches (48 %). Failures spadly do 4 distinct regex weakness classes:

1. Czech curly quotes (`„X"` vs `"X"`) breaking string literals
2. `^I` literal tab markers in MTEXT (Czech CAD encoding) — `\t` regex nematchuje
3. Float precision drift (`0.85 - 0.75 = 0.0999999`) — direct `>= 0.10` fails
4. Diacritic-stripped vs diacritic-full keyword matching (`pozední` vs `pozedni`)

## Solution

**Iterative refinement loop, NOT one-shot regex:**

```
1. Run validator → log all FAIL cases with full source text + regex pattern
2. Cluster failures by class (manual or by error code)
3. Patch regex / patch string handling
4. Re-run → measure delta
5. Repeat until ≥ 95 % match rate OR remaining failures are honest absences
```

Iterations 1-4 ran in single afternoon: 33 → 48 → 61 → 67/69. Final 2 failures byly genuine missing data (vyjasnění #18 sklad geometry, vyjasnění #14 stupně PBŘ).

## Critical fixes per class

- **Class 1:** `text.replace('„', '"').replace('"', '"').replace('"', '"')` before regex
- **Class 2:** `text = re.sub(r'\^I', '\t', text)` (TAB_LITERAL_RE)
- **Class 3:** `round(diff, 4) >= 0.10` (NEVER raw float compare for drift)
- **Class 4:** `unicodedata.normalize('NFKD', s).encode('ASCII', 'ignore').decode().lower()` pre-compare

## Generalization

Czech construction PDFs konzistentně exhibitují tyto 4 classes. Future pilots dostanou prebaked normalizer module (`tools/cz_text_normalize.py`) místo per-pilot reinvention.
