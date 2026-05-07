# `sources/` — MASTER INVENTORY

Phase Π.0.0 sorted layout for the Libuše komplex. All source files
classified per objekt + format. `inputs/` retained as symlinks pointing
into this directory so existing Phase 0.x scripts continue working
unchanged.

**Status**: 58 files sorted (PR D-deliverable already shipped). A / B /
C buckets empty — awaiting ABMV upload before Π.1+ komplex pricing.

---

## Cross-objekt summary

| Objekt | Files | DWG | PDF | XLSX | DOCX | Status |
|--------|----:|----:|----:|----:|----:|--------|
| `shared/` | **33** | 3 | 19 | 10 | 1 | ✅ komplex tables + drawings + TZ |
| `D/` | **25** | 11 | 14 | 0 | 0 | ✅ all D-specific drawings present |
| `A/` | **0** | 0 | 0 | 0 | 0 | ⏳ awaiting ABMV |
| `B/` | **0** | 0 | 0 | 0 | 0 | ⏳ awaiting ABMV |
| `C/` | **0** | 0 | 0 | 0 | 0 | ⏳ awaiting ABMV |
| **TOTAL** | **58** | **14** | **33** | **10** | **1** | |

---

## Coverage matrix

Rows: drawing/table codes. Cols: objekt buckets. Cells: ✅ present /
❌ missing / — not expected.

### Komplex-wide (`shared/` — `_100_` prefix expected)

| Code | Description | shared XLSX | shared DWG | shared PDF |
|------|------------|:-----------:|:----------:|:----------:|
| 0010 | TZ technická zpráva | ✅ (DOCX) | — | ✅ |
| 0011 | Radonový posudek | — | — | ✅ |
| 0020 | Tabulka místností | ✅ | — | ✅ |
| 0030 | Tabulka skladeb | ✅ | — | ✅ |
| 0040 | Tabulka výplňování otvorů | — | — | ✅ |
| 0041 | Tabulka dveří | ✅ | — | — |
| 0042 | Tabulka oken | ✅ | — | — |
| 0043 | Tabulka prosklených příček | ✅ | — | — |
| 0050 | Tabulka zámečnických | ✅ | — | ✅ |
| 0060 | Tabulka klempířských | ✅ | — | ✅ |
| 0070 | Tabulka překladů | ✅ | — | ✅ |
| 0080 | Tabulka ostatních | ✅ | — | ✅ |
| 4010 | Půdorys výkopu | — | — | ✅ |
| 4020 | Podkladní betony | — | — | ✅ |
| 4030 | Půdorys 1.PP | — | ✅ | ✅ |
| 4040 | Odvodnění teras | — | ✅ | ✅ |
| 5000 | Řezy 1.PP | — | ✅ | ✅ |
| 8030 | Kniha detailů | — | — | ✅ |
| 8050 | Zásady spárořezu | — | — | ✅ |
| 9000 | 1.PP koor. výkres část A | — | — | ✅ |
| 9001 | 1.PP koor. výkres část B | — | — | ✅ |
| Vykaz_vymer_stary | komplex BOQ | ✅ | — | — |

### D-specific (`D/` — `_140_` prefix expected)

| Code | Description | D DWG | D PDF |
|------|------------|:-----:|:-----:|
| 4410 | OBJEKT D — Půdorys 1.NP | ✅ | ✅ |
| 4420 | OBJEKT D — Půdorys 2.NP | ✅ | ✅ |
| 4430 | OBJEKT D — Půdorys 3.NP | ✅ | ✅ |
| 4440 | OBJEKT D — Půdorys střecha | ✅ | ✅ |
| 5400 | OBJEKT D — Řezy | ✅ | ✅ |
| 6400 | OBJEKT D — Pohledy | ✅ | ✅ |
| 7410 | OBJEKT D — Podhledy 1.NP | ✅ | ✅ |
| 7420 | OBJEKT D — Podhledy 2.NP | ✅ | ✅ |
| 7430 | OBJEKT D — Podhledy 3.NP | ✅ | ✅ |
| 9410 | OBJEKT D — Koor. výkres 1.NP | — | ✅ |
| 9420 | OBJEKT D — Koor. výkres 2.NP | — | ✅ |
| 9421 | OBJEKT D — Koor. byt jader 2.NP | ✅ | ✅ |
| 9430 | OBJEKT D — Koor. výkres 3.NP | — | ✅ |
| ARS | OBJEKT D — desky (slab reinf.) | ✅ | ✅ |

D-objekt has **9410/9420/9430 DWG missing** (only PDF present). These
are coordination drawings — currently MEP/structural overlay; not
required for finishing-spec extraction. Flag to ABMV if A/B/C come with
DWG koordinace and we want consistency.

---

## Pipeline coupling — symlink mode (Option b)

`inputs/` retained as a symlink shadow over `sources/`. All 58 source
files have a `inputs/<original-path>` → `../sources/{objekt}/{ext}/<file>`
relative symlink.

**Why**: existing Phase 0.x scripts hardcode paths like
`test-data/libuse/inputs/dwg/...` and continue to work without
modification. Π.0a will rewire downstream consumers to read directly
from `sources/{objekt}/...`.

**Smoke test passed**: `openpyxl.load_workbook` reads
`inputs/185-01_…_0020_…_TABULKA MISTNOSTI.xlsx` → `sources/shared/xlsx/`
→ 935 rows confirmed. DWG paths resolve correctly through the symlink.

**Cleanup**: when Π.0a fully cuts over downstream consumers, delete the
symlinks. `git rm test-data/libuse/inputs/<file>` × 58 + retain
`.gitkeep` in `inputs/{dwg,pdf,dxf}/` if backwards-compat directory
references are wanted.

---

## Awaiting from ABMV (A / B / C komplex pricing prerequisites)

Per objekt (× 3):

| Format | Required files |
|--------|---------------|
| DWG | `_140_4410..4440` (1.NP / 2.NP / 3.NP / střecha půdorys) |
| DWG | `_140_5400` (řezy) |
| DWG | `_140_6400` (pohledy) |
| DWG | `_140_7410..7430` (podhledy 1.NP / 2.NP / 3.NP) |
| DWG | `_140_9421` (koor. byt jader, optional but useful) |
| PDF | All DWG renders + koor. výkresy 9410/9420/9430 |

**NOT required from ABMV** — komplex-wide tables in `sources/shared/`
already cover A/B/C (Tabulka 0020 mistnosti has 935 rows for the whole
komplex; Tabulka 0041 dveře has 297 doors covering all four buildings;
similar for 0030 / 0042 / 0043 / 0050 / 0060 / 0070 / 0080).

**Drop-in upload target**:

```
sources/A/dwg/    sources/A/pdf/    (sources/A/xlsx/ rare)
sources/B/dwg/    sources/B/pdf/
sources/C/dwg/    sources/C/pdf/
```

Upon upload, re-run `sources_manifest.md` classifier to verify naming
convention before triggering Π.0a extraction for A/B/C.

---

## Per-objekt INVENTORY references

- [`sources/A/INVENTORY.md`](A/INVENTORY.md) — placeholder (awaiting)
- [`sources/B/INVENTORY.md`](B/INVENTORY.md) — placeholder (awaiting)
- [`sources/C/INVENTORY.md`](C/INVENTORY.md) — placeholder (awaiting)
- [`sources/D/INVENTORY.md`](D/INVENTORY.md) — full inventory + coverage check
- [`sources/shared/INVENTORY.md`](shared/INVENTORY.md) — full inventory + coverage check

---

## Provenance

- Classification source: `test-data/libuse/sources_manifest.md`
- Move execution: 58 × `git mv` operations (single batch, 100 % success)
- Symlinks: relative paths (`../sources/...`) for cross-machine portability
- All operations preserve git history (`git log --follow` works)

_Generated by Claude Code Π.0.0 Part 3 sorting execution, 2026-05-06._
