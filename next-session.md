# next-session.md — Libuše DPS / dokončovací práce

**Branch:** `claude/phase-0-setup-c1tsZ`
**Task spec:** `test-data/TASK_VykazVymer_Libuse_Dokoncovaci_Prace.md`

**Sessions:**
- Session 1 (2026-05-03, feasibility): Phase 0.0 + 0.5 setup ✅ commits `70de16e` + `84b24b7`
- Session 2 (2026-05-03, libredwg apt pivot): apt package missing in noble ❌ commit `7594f5f`
- Session 3 (2026-05-03, libredwg from-source): **PoC successful** ✅ (see below)

---

## ✅ Session 3 outcome — libredwg from source, PoC PASSED

Built `dwg2dxf` from `github.com/LibreDWG/libredwg` tag `0.13.4`
(commit `e3774bd`) with `--enable-trace --disable-bindings`. Installed
to `/usr/local/bin/dwg2dxf`. End-to-end pipeline validated.

| Step | Result |
|------|--------|
| Build deps via apt | OK (build-essential + autoconf-archive + swig + texinfo + ...) |
| autogen.sh + jsmn submodule | OK |
| `./configure --enable-trace --disable-bindings` | OK |
| `make -j4` | OK, ~4 min |
| `make install` + `ldconfig` | OK |
| `dwg2dxf --version` | `dwg2dxf 0.13.4` |
| Convert objekt D / 1.NP DWG → DXF | OK, exit 0, 3.0 MB / 407 K lines, AC1027 |
| ezdxf cross-check | OK — 58 layers (AIA discipline prefixes), 560 TEXT, 399 INSERT, 21 POLYLINE |
| Spec regex room codes | **18 hits** including known edge case `D.1.3.01` |
| Python wrapper smoke | `convert_one()` → 78 ms, status `ok` |

Full PoC report: `test-data/libuse/outputs/phase_0_5_poc.md`.

### Implementation landed

`concrete-agent/packages/core-backend/app/services/dwg_to_dxf.py` is now
**implemented** (no longer NotImplementedError):

- `detect_backend()` — env override (`STAVAGENT_DWG_BACKEND`) → `which dwg2dxf` → `odafc.is_installed()` → `PDF_ONLY` sentinel.
- `convert_one(dwg_path, dxf_dir, *, backend=None, timeout_s=60)` — `subprocess.run(['dwg2dxf','-y','-o', dxf, dwg], timeout=60)`. Treats exit code + non-empty output file as truth (libredwg prints harmless `Warning:` lines to stderr even on success).
- `convert_batch()` — per-file isolated try/except, info-log per success / error-log per failure.
- ODA path retained as `_convert_oda()` fallback (uses `ezdxf.addons.odafc`).
- New `STAVAGENT_DWG_BACKEND` env var for explicit override.

`dxf_parser.py` is still a skeleton — body is Session 4 work.

---

## (historical) Session 2 outcome — libredwg apt pivot BLOCKED

**Decision tested:** switch DWG→DXF backend from ODA File Converter (registration
gate) to `libredwg-tools` (open-source, apt-installable).

**Result:** `libredwg-tools` is **NOT available in Ubuntu 24.04 (noble) apt repos**.

### Probe trail

| Check | Result |
|-------|--------|
| `uname -a` | Linux vm 6.18.5 SMP x86_64 |
| `lsb_release` | Ubuntu 24.04.4 LTS noble |
| User | `root` (no sudo needed) |
| `which apt` | `/usr/bin/apt` |
| `which dwg2dxf` | empty (not installed) |
| `apt update` | OK (3 unrelated PPAs 403, irrelevant) |
| `apt-cache search libredwg` | **0 hits** |
| `apt-cache madison libredwg-tools` | **empty** |
| `apt install libredwg-tools` | `E: Unable to locate package libredwg-tools` |
| `apt-cache search dwg` | only `dwgsim` (bioinformatics, unrelated) |
| Components in `ubuntu.sources` | `main universe restricted multiverse` (universe IS enabled) |
| `libdxflib3` (DXF read/write) | available but DXF-only, no DWG decoder |
| `docker` | `/usr/bin/docker`, version 29.3.1 (could pull a prebuilt image) |

`libredwg-tools` was packaged in Debian unstable + Ubuntu jammy (22.04) but
appears to have been **dropped from noble** (24.04). This is consistent with
GH-LibreDWG/libredwg's own readme noting flaky packaging across distros.

**Per task instructions ("ОСТАНОВИСЬ ЗДЕСЬ"), no fallback was attempted in Session 2.**
Resolved in Session 3 by building libredwg from source — option 1 below was picked.

### Path-forward options that were on the table for Session 3

Pick one — needs user confirmation before the next session proceeds:

1. **Build libredwg from source** (~5–10 min, deps: `git`, `autoconf`, `automake`,
   `libtool`, `swig`, `python3-dev`, `texinfo`, `perl`). Clone
   `github.com/LibreDWG/libredwg`, `./autogen.sh && ./configure --enable-release && make && make install`.
   Pros: stays open-source, scriptable in CI. Cons: build-time fragility.
2. **Run ODA File Converter inside Docker** (e.g. `gablerw/oda-file-converter` or
   build a tiny image around the .deb). Docker IS present in env. User still
   has to download the .deb once (registration gate), but conversion becomes
   reproducible.
3. **Manual ODA install** as originally planned in Session 1. User downloads
   `ODAFileConverter_*.deb` from opendesign.com, runs `dpkg -i`, sets
   `unix_exec_path`. Same path as Session 1's open question.
4. **CloudConvert / ConvertCAD online API** — privacy concern (uploads DPS to
   3rd party), but zero install. ~$0.01/file × 14 files = trivial cost.
5. **PDF-only degraded mode** — skip DWG pipeline entirely. Accept ±50–100 mm
   OCR tolerance. Confidence drops 1.0 → 0.7–0.85. Loses layer structure.

### What did NOT change in Session 2

- No `app/services/dwg_to_dxf.py` edits — backend choice still pending.
- No new commits.
- No new files in `test-data/libuse/outputs/` (Session 1's `inventory_report.md`
  + `phase_0_5_poc.md` are still the only outputs).

---

## Pre-flight checklist for Session 4

- [ ] User confirmation to proceed with Phase 0.5 batch (14 DWG → 14 DXF)
- [ ] Implement bodies of `parse_dxf_drawing()` / `find_enclosing_polyline()` / `detect_units()` in `dxf_parser.py`
- [ ] Ship `outputs/cad_extraction.json` for all 14 DWG (rooms + openings + layers)
- [ ] Open question — DWG coverage gap for objekty A/B/C (only D + spol. 1.PP have DWG): hybrid PDF measurement OR wait for more DWG?
- [ ] Acceptance gate Q4 (sample review of 5–10 rooms after triangulation)
- [ ] CI consideration: `dwg2dxf` is not in noble apt — Cloud Run / Docker images need to either bundle the libredwg build or ship the .deb. Decision deferred to deploy session.

---

## Co bylo hotovo (Session 1, 2026-05-03)

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

---

## Gate 2 (calculator element classification) — closed 2026-05-03

**Branch:** `gate-2-element-classification` merged via PR `#1064`.
**Tests:** 1036 passing. **Element types:** 23 classification-correct
per canonical §9.4 (22 baseline + `zaklady_oper` added in Phase 3).

Note: this Gate 2 work is on a **different branch / different topic**
than Libuše DPS work above. Gate 2 = calculator element classification
(Monolit-Planner shared/src/classifiers); Libuše DPS = parser pipeline
(concrete-agent core-backend services). No overlap; both can progress
in parallel.

### Lessons learned (16 stop-and-ask instances Gate 1 + Gate 2)

1. **Task specs are starting hypotheses, not implementation contracts.**
   Multiple task spec details proved incorrect on verification (e.g.
   `mostni_zaver` not in union, `Top 50 Cornice` not a real catalog
   entry, `result.falsework.system` shape doesn't exist).

2. **Implementation reality (TypeScript types, current architecture)
   is authoritative.** When task spec example code conflicts with
   current code, current code wins.

3. **Stop-and-ask is fastest path** — each catch prevents 1–3 broken
   commits. 16 instances caught truncations, broken cross-refs, scope
   creep, architectural surprises, data inconsistencies.

4. **Architectural fixes beat per-element fixes** — Option W principle
   pre-empted Phase 4 entirely. 3–4 days estimated → ~10 minutes
   actual because Option W extension auto-fixed 11 pozemní elements.

5. **With-height vs without-height path coverage matters.**
   `recommendFormwork()` has two branches; tests must exercise both.
   Existing "recommends Frami for foundations" test always passed
   because single-arg call short-circuited to `recommended[0]` —
   never exercised the buggy with-height path.

6. **`undefined` as universal applicability semantics.** Filter logic
   must handle both: `!apt || apt.includes(type)`. Original guard
   formulation `apt?.includes(type)` would have failed silently for
   universal systems (Frami Xlife). Caught by stop-and-ask 13th
   instance.

7. **Atomic commits with code + tests together prevent broken
   intermediate states.** Each Phase 2 commit (e.g. `b60d24d` Top 50)
   bundled the data change + ALL corresponding test inversions in
   lockstep so test suite stayed green at every commit boundary.

### Next steps for Gate 3 / Gate 4 / Gate 7

Currently no urgent action. All 5 decisions signed off (2026-04-30).
Architectural foundation solid. When ready:

- **Gate 3** (UI labels + W1-W4 warnings, ~5–7 days): Staxo 100
  reclassification, `warnings_structured` shape, card titles per
  canonical §9.3, tooltips with canonical doc references
- **Gate 4** (Pricing split, ~5–7 days): 4 cost rows per system,
  MSS P1 fix, Excel field names disambiguation, MCP `accuracy_note`,
  dual-write deprecation aliases until 2026-07-29
- **Gate 7** (Cleanup, deadline **2026-07-29**): remove deprecation
  aliases (`grep -r "DEPRECATED until 2026-07-29"`), Section 9
  cleanup, `atrium`/`attika`/`vence`/`rampa` final decision

**Cleanup deadline: 2026-07-29** (3 months from Gate 1 closure
2026-04-29). Tracked as blocking prerequisite for public MCP launch.

---

## Backlog (cross-cutting, not Gate-2)

### URS_MATCHER_SERVICE → Unified Retrieval Service (acronym redefinition)

Recorded 2026-05-07 during Phase 0 audit of the v3.2 landing reposition
(`AUDIT_REPORT_landing_v3.md` §18). Replaces the earlier idea of
renaming the directory + Cloud Run service.

**Approach:** keep the abbreviation `URS_MATCHER_SERVICE` everywhere in
infra (Cloud Run service name `urs-matcher-service`, `cloudbuild-urs.yaml`,
env var `URS_BACKEND`, repo directory, CI workflow `test-urs-matcher.yml`,
Portal route `for-kiosk/urs_matcher`, `value="urs"` dropdown attribute,
`urs_matcher` services-table key). Redefine the acronym in documentation
to `Unified Retrieval Service` — defensible non-trademark term, accurately
describes what the service does (unifies retrieval from OTSKP local DB +
Perplexity AI semantic search + future regional integrations).

**Reason:** v3.2 audit (in flight) scrubs `ÚRS` from public UI surfaces in
~10 places (Klasifikátor `app.js` column headers + exports, Portal
`VerifyEmailPage.tsx:149`, Portal `schema-postgres.sql:686-747` service
seeds). Internal `URS_MATCHER_SERVICE` acronym remains. Recoding the
acronym's official meaning closes the loop without touching infrastructure.

**Where to update (when triggered):**
- `CLAUDE.md` (root) — service-description section
- `README.md` (root) — service-table row + architecture diagram caption
- `URS_MATCHER_SERVICE/README.md` — replace "URS Matcher Service - Web kiosk for ÚRS position matching"
- `URS_MATCHER_SERVICE/backend/package.json:4` — npm `description` field

**Canonical doc entry:**

```
### URS_MATCHER_SERVICE

Unified Retrieval Service — microservice that unifies retrieval from
multiple catalog sources (OTSKP local DB + AI-based semantic search +
future regional integrations). Provides matching layer between user
input (work descriptions) and structured catalog codes.
```

**Trigger conditions** (do it when any of these happens):
- New contributor asks "what does URS stand for?"
- Repository becomes publicly indexed / open-sourced (npm description
  + README will be crawled)
- Legal/IP review surfaces trademark-proximity concern with ÚRS Praha
- A UI/docs PR happens to touch any of the 4 files above — bundle in

**Effort:** ~30 min once triggered. 4 files, ~20 lines edited.

**Status:** Deferred. Not urgent.
