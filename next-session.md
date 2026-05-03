# next-session.md — Libuše DPS / dokončovací práce

**Předchozí session:** 2026-05-03 (feasibility, Session 1 částečná — Phase 0.0 + Phase 0.5 setup)
**Branch:** `claude/phase-0-setup-c1tsZ`
**Task spec:** `test-data/TASK_VykazVymer_Libuse_Dokoncovaci_Prace.md`

> Předchozí handoff (Task 3 — Smart Extractor Incremental, branch `claude/task-03-tz-incremental`)
> byl přepsán touto session. Plný obsah najdete v git history: `git show HEAD~1:next-session.md`
> nebo na předchozí větvi.

---

## Co bylo hotovo

### Phase 0.0 — File reorganization ✅
PRE-INTERVIEW Q1+Q2 odsouhlaseny. 58 souborů přesunuto z `test-data/` rootu
do `test-data/libuse/inputs/{pdf,dwg}/` přes `git mv` (zachová history).

- 33 PDF → `test-data/libuse/inputs/pdf/`
- 14 DWG → `test-data/libuse/inputs/dwg/`
- 1 DOCX TZ + 9 XLSX tabulek → `test-data/libuse/inputs/`
- Starý výkaz přejmenován z `unprotect_BS Libuše_Vykaz vymer R01_DMG Stav.xlsx` na `Vykaz_vymer_stary.xlsx`
- Prázdné `test-data/libuse/inputs/dxf/` a `test-data/libuse/outputs/` (s `.gitkeep`)
- `TASK_VykazVymer_Libuse_Dokoncovaci_Prace.md` ponechán v `test-data/`
- `test-data/tz/` (jiný projekt: SO-202/203/207/VP4) NETKNUTO

Inventář report: `test-data/libuse/outputs/inventory_report.md`

### Phase 0.5 — Setup ✅ (vlastní konverze + parsing pending)

- `requirements.txt` upraven: `ezdxf>=1.3.0` (bumped z 1.1.0), nově `shapely>=2.0`
- pip install ověřen: ezdxf 1.4.3, shapely 2.1.2 nainstalovány v env
- skeleton `concrete-agent/packages/core-backend/app/services/dwg_to_dxf.py`
  - `ConversionBackend(Enum)`: `oda` / `libredwg` / `online_api` / `pdf_only`
  - `ConversionResult` dataclass
  - signatury: `detect_backend()`, `convert_one()`, `convert_batch()` — všechny `NotImplementedError`
- skeleton `concrete-agent/packages/core-backend/app/services/dxf_parser.py`
  - `RoomGeometry`, `Opening`, `DxfExtraction` dataclasses
  - regexy `ROOM_CODE_RE = r"[A-D]\.\d\.\d\.\d{2}"`, `OPENING_BLOCK_RE`
  - signatury: `parse_dxf_drawing()`, `find_enclosing_polyline()`, `detect_units()` — všechny `NotImplementedError`
- PoC import test: oba moduly načteny, dataclassy + enums OK, viz `test-data/libuse/outputs/phase_0_5_poc.md`

---

## Co BLOKUJE pokračování

### ODA File Converter NENÍ nainstalovaný

PRE-INTERVIEW Q3 odpověď: **Install ODA Converter (Recommended)**.

Probe results (viz `test-data/libuse/outputs/phase_0_5_poc.md`):

- `which ODAFileConverter` → empty
- `ezdxf.addons.odafc.is_installed()` → `False`
- `unix_exec_path` ezdxf nastavení → prázdný string
- `libredwg-tools`, `LibreCAD`: nedostupné v apt
- LibreOffice: instalovaný ale neumí DWG

**Akce před Session 2 (manuální, vyžaduje uživatele):**

1. Registrovat se a stáhnout ODA File Converter (free):
   - https://www.opendesign.com/guestfiles/oda_file_converter
   - Linux balík: `ODAFileConverter_QT5_lnxX64_8.3dll_25.X.deb` (nebo AppImage)
2. Nainstalovat buď:
   - systémově: `sudo dpkg -i ODAFileConverter_*.deb` → `/usr/bin/ODAFileConverter`
   - lokálně: extrahovat do `tools/oda/` (přidat do `.gitignore`)
3. Nastavit cestu pro ezdxf, např. před spuštěním:
   ```python
   import ezdxf
   ezdxf.options['odafc-addon']['unix_exec_path'] = '/usr/bin/ODAFileConverter'
   ```
   nebo `ODAFC_PATH` env var (následně načíst v `dwg_to_dxf.detect_backend()`).
4. Sanity check: `python3 -c "from ezdxf.addons import odafc; print(odafc.is_installed())"` → `True`.

Po instalaci může Session 2 začít plnou implementací:
- `detect_backend()` → vrátí `ConversionBackend.ODA`
- `convert_one()` → `odafc.convert(dwg, dxf, version="ACAD2018", audit=True)`
- `convert_batch()` → smyčka přes 14 DWG s logem do `outputs/extraction_log.md`
- `parse_dxf_drawing()` → ezdxf modelspace walk (TEXT/MTEXT/POLYLINE/INSERT)

---

## Důležité observace pro další session

### 🚨 DWG coverage gap — pouze objekt D + spol. 1.PP

DWG dataset (14 souborů) pokrývá **jen objekt D a společný suterén 1.PP**.
Objekty **A, B, C v DWG NEJSOU**. Pro A/B/C jsou k dispozici **pouze PDF**
(půdorysy/řezy/pohledy se stejnými výkresovými čísly).

**Důsledek pro spec:**

- Phase 0.7 (Cross-Object Geometric Validation) — primárně z DXF přesné jen pro objekt D. Pro A/B/C bude potřeba PDF measurement (confidence 0.7–0.85 dle spec recovery patterns).
- Phase 1 triangulation — DXF/Tabulka/PDF cross-validation funguje plně jen pro D; A/B/C bude jen Tabulka+PDF, bez DXF anchor.
- Kontrolní pomery v `cross_object_validation.json` budou mít smíšenou confidence — vyžaduje user note.

**Open question pro Q4 (po Phase 0.5):** zeptat se klienta zda existují DWG
půdorysy A/B/C. Pokud ne, Phase 0.7 pojede v hybrid režimu (DXF jen D, ostatní
PDF measurement).

### Sample DWG version
`file` reportuje `DWG AutoDesk AutoCAD 2013-2017` — plně pokryto ODA Converter
target `ACAD2018` a ezdxf 1.4 readback. Žádný expected format risk.

### Path / encoding
DWG filenames obsahují české diakritiky a mezery (`Půdorys 1 .NP.dwg`).
Při `convert_batch()` použít `Path` objekty + `subprocess.run([..., str(p)])`,
ne shell strings, aby se nemíchaly cesty s mezerami.

---

## Open questions pro Session 2

1. **ODA binary cesta** — kam chce uživatel binárku (system-wide vs `tools/oda/`)?
2. **DWG gap pro A/B/C** — existují další DWG, nebo jet hybrid PDF-only pro tyto objekty?
3. **Smaž / ponech raw .dwg** po konverzi do DXF? (DXF je 5–10× větší, ale gitované — preference?)
4. **Phase 0.5 KROK 5 output** — `cad_extraction.json` schéma už máme draftované v skeleton dataclassech (`DxfExtraction`); chce uživatel v JSONu i `bbox` extents pro pozdější objekt-detekci (boundingbox A/B/C/D)?

---

## Files touched (this session)

```
A  test-data/libuse/inputs/dxf/.gitkeep
A  test-data/libuse/inputs/dwg/<14 DWG, git mv>
A  test-data/libuse/inputs/pdf/<33 PDF, git mv>
A  test-data/libuse/inputs/<10 XLSX/DOCX, git mv + 1 rename>
A  test-data/libuse/outputs/.gitkeep
A  test-data/libuse/outputs/inventory_report.md
A  test-data/libuse/outputs/phase_0_5_poc.md
A  concrete-agent/packages/core-backend/app/services/dwg_to_dxf.py    (skeleton)
A  concrete-agent/packages/core-backend/app/services/dxf_parser.py    (skeleton)
M  concrete-agent/packages/core-backend/requirements.txt              (ezdxf bump + shapely)
M  next-session.md                                                    (rewritten for this track)
```

V této session zatím **žádný commit ani push** — branch `claude/phase-0-setup-c1tsZ`
obsahuje pouze pracovní strom; uživatel rozhodne co commitnout (typicky
jeden FEAT commit `feat: Phase 0.0+0.5 setup — file reorg + DWG/DXF skeletons`,
nebo split na `chore: reorg test-data/libuse` + `feat: DWG/DXF skeleton + deps`).

---

## Pre-flight checklist pro Session 2

- [ ] ODA File Converter nainstalovaný (manuální krok výše)
- [ ] `ezdxf.addons.odafc.is_installed()` returns `True`
- [ ] User decision: hybrid mode pro A/B/C objekty (PDF-only) NEBO čekat na další DWG
- [ ] Implementovat těla `detect_backend()`, `convert_one()`, `convert_batch()` v `dwg_to_dxf.py`
- [ ] Implementovat `parse_dxf_drawing()` + helpers v `dxf_parser.py`
- [ ] Konvertovat všech 14 DWG → DXF, log do `outputs/extraction_log.md`
- [ ] Phase 0.5 KROK 5 output: `outputs/cad_extraction.json`
- [ ] Phase 0.5 KROK 4: skeleton `triangulation_engine.py` + napojení na Tabulku místností XLSX
- [ ] Acceptance gate Q4 + sample review (5–10 místností)
