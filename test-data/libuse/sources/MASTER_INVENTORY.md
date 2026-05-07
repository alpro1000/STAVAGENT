# `sources/` — MASTER INVENTORY

Phase Π.0.0 sorted layout for the Libuše komplex. All source files
classified per objekt + format. `inputs/` retained as symlinks pointing
into this directory so existing Phase 0.x scripts continue working
unchanged.

**Status**: 129 files sorted across full komplex (A/B/C/D + shared).
Π.0.0 first pass shipped D + shared (58 files). Π.0.0 Part 2 added
A/B/C uploads from ABMV (71 files).

---

## Cross-objekt summary

| Objekt | Files | DWG | PDF | XLSX | DOCX | Status |
|--------|----:|----:|----:|----:|----:|--------|
| `shared/` | **33** | 3 | 19 | 10 | 1 | ✅ komplex tables + drawings + TZ |
| `A/` | **22** | 9 | 13 | 0 | 0 | ✅ full architectural set; ⚠️ ARS desky (0000) missing — ABMV item #9 |
| `B/` | **24** | 10 | 14 | 0 | 0 | ✅ full architectural set + ARS desky |
| `C/` | **25** | 11 | 14 | 0 | 0 | ✅ full architectural set + ARS desky |
| `D/` | **25** | 11 | 14 | 0 | 0 | ✅ all D-specific drawings present |
| **TOTAL** | **129** | **44** | **74** | **10** | **1** | |

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
required for finishing-spec extraction.

**Confirmed consistent across A/B/C** — same `9X10/9X20/9X30` are
PDF-only across all four buildings. No need to flag to ABMV.

### A-specific (`A/` — `_110_` prefix, 22 files)

| Code | Description | A DWG | A PDF |
|------|------------|:-----:|:-----:|
| 4110 | OBJEKT A — Půdorys 1.NP | ✅ | ✅ |
| 4120 | OBJEKT A — Půdorys 2.NP | ✅ | ✅ |
| 4130 | OBJEKT A — Půdorys 3.NP | ✅ | ✅ |
| 4140 | OBJEKT A — Půdorys střechy | ✅ | ✅ |
| 5100 | OBJEKT A — Řezy | ✅ | ✅ |
| 6100 | OBJEKT A — Pohledy | ✅ | ✅ |
| 7110 | OBJEKT A — Podhledy 1.NP | ✅ | ✅ |
| 7120 | OBJEKT A — Podhledy 2.NP | ✅ | ✅ |
| 7130 | OBJEKT A — Podhledy 3.NP | ✅ | ✅ |
| 9110 | OBJEKT A — Koor. výkres 1.NP | — | ✅ |
| 9120 | OBJEKT A — Koor. výkres 2.NP | — | ✅ |
| 9121 | OBJEKT A — Koor. byt jader 2.NP | — | ✅ |
| 9130 | OBJEKT A — Koor. výkres 3.NP | — | ✅ |
| 0000 | OBJEKT A — desky (slab reinf.) | ❌ | ❌ |

**A — ARS desky (0000) missing** — neither DWG nor PDF. B / C / D have
both. Logged as **ABMV email item #9** in `documentation_inconsistencies.json`.

### B-specific (`B/` — `_120_` prefix, 24 files)

| Code | Description | B DWG | B PDF |
|------|------------|:-----:|:-----:|
| 4210 | OBJEKT B — Půdorys 1.NP | ✅ | ✅ |
| 4220 | OBJEKT B — Půdorys 2.NP | ✅ | ✅ |
| 4230 | OBJEKT B — Půdorys 3.NP | ✅ | ✅ |
| 4240 | OBJEKT B — Půdorys střechy | ✅ | ✅ |
| 5200 | OBJEKT B — Řezy | ✅ | ✅ |
| 6200 | OBJEKT B — Pohledy | ✅ | ✅ |
| 7210 | OBJEKT B — Podhledy 1.NP | ✅ | ✅ |
| 7220 | OBJEKT B — Podhledy 2.NP | ✅ | ✅ |
| 7230 | OBJEKT B — Podhledy 3.NP | ✅ | ✅ |
| 9210 | OBJEKT B — Koor. výkres 1.NP | — | ✅ |
| 9220 | OBJEKT B — Koor. výkres 2.NP | — | ✅ |
| 9221 | OBJEKT B — Koor. byt jader 2.NP | — | ✅ |
| 9230 | OBJEKT B — Koor. výkres 3.NP | — | ✅ |
| 0000 | OBJEKT B — desky (slab reinf.) | ✅ | ✅ |

### C-specific (`C/` — `_130_` prefix, 25 files)

| Code | Description | C DWG | C PDF |
|------|------------|:-----:|:-----:|
| 4310 | OBJEKT C — Půdorys 1.NP | ✅ | ✅ |
| 4320 | OBJEKT C — Půdorys 2.NP | ✅ | ✅ |
| 4330 | OBJEKT C — Půdorys 3.NP | ✅ | ✅ |
| 4340 | OBJEKT C — Půdorys střechy | ✅ | ✅ |
| 5300 | OBJEKT C — Řezy | ✅ | ✅ |
| 6300 | OBJEKT C — Pohledy | ✅ | ✅ |
| 7310 | OBJEKT C — Podhledy 1.NP | ✅ | ✅ |
| 7320 | OBJEKT C — Podhledy 2.NP | ✅ | ✅ |
| 7330 | OBJEKT C — Podhledy 3.NP | ✅ | ✅ |
| 9310 | OBJEKT C — Koor. výkres 1.NP | — | ✅ |
| 9320 | OBJEKT C — Koor. výkres 2.NP | — | ✅ |
| 9321 | OBJEKT C — Koor. byt jader 2.NP | — | ✅ |
| 9330 | OBJEKT C — Koor. výkres 3.NP | — | ✅ |
| 0000 | OBJEKT C — desky (slab reinf.) | ✅ | ✅ |

---

## Pipeline coupling — symlink mode (Option b)

`inputs/` retained as a symlink shadow over `sources/`. All 129 source
files have a `inputs/<filename>` → `../sources/{objekt}/{ext}/<file>`
relative symlink (58 from Π.0.0 first pass for D + shared, 71 added in
Part 2 for A + B + C).

**Why**: existing Phase 0.x scripts hardcode paths like
`test-data/libuse/inputs/dwg/...` and continue to work without
modification. Π.0a will rewire downstream consumers to read directly
from `sources/{objekt}/...`.

**Smoke tests passed (Part 2)**:
- `openpyxl.load_workbook` reads shared MISTNOSTI.xlsx via symlink → 935 rows ✅
- New `_110_` DWG file accessible via `inputs/` symlink → resolves to `sources/A/dwg/` ✅
- D-pipeline regression-clean: D drawings still resolve via existing symlinks.

**Cleanup**: when Π.0a fully cuts over downstream consumers, delete the
symlinks. `git rm test-data/libuse/inputs/<file>` × 129 + retain
`.gitkeep` in `inputs/{dwg,pdf,dxf}/` if backwards-compat directory
references are wanted.

---

## Outstanding ABMV items

A/B/C uploads received. Remaining ABMV question:

- **#9**: A — ARS desky drawing (`_110_0000_*`) missing — DWG i PDF.
  B/C/D mají tento výkres standardně. Confirm whether A genuinely has
  no separate slab-reinforcement drawing (e.g. shared with another
  building) nebo zda byla zapomenuta při uploadu. Logged in
  `documentation_inconsistencies.json` → `abmv_email_required[]`.

---

## Per-objekt INVENTORY references

- [`sources/A/INVENTORY.md`](A/INVENTORY.md) — full inventory + coverage check (22 files)
- [`sources/B/INVENTORY.md`](B/INVENTORY.md) — full inventory + coverage check (24 files)
- [`sources/C/INVENTORY.md`](C/INVENTORY.md) — full inventory + coverage check (25 files)
- [`sources/D/INVENTORY.md`](D/INVENTORY.md) — full inventory + coverage check (25 files)
- [`sources/shared/INVENTORY.md`](shared/INVENTORY.md) — full inventory + coverage check (33 files)

---

## Provenance

- Π.0.0 first pass: 58 files (D + shared) — `test-data/libuse/sources_manifest.md`
- Π.0.0 Part 2: 71 files (A + B + C) — `test-data/libuse/abc_classification_manifest.md`
- Move execution: 129 × `git mv` operations across two passes, 100 % success
- Symlinks: 129 × relative `../sources/...` for cross-machine portability
- All operations preserve git history (`git log --follow` works)

_Generated by Claude Code Π.0.0 Part 3 sorting execution, 2026-05-06; updated 2026-05-07 for A/B/C._
