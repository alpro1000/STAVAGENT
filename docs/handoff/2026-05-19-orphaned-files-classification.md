# Orphaned files & data/peri-pdfs/ — Classification

**Datum:** 2026-05-19
**Auditor:** Claude Code (branch `claude/docs-audit-2026-05-19-0G3lF`)
**Source task:** `docs/docs/handoff/2026-05-19-orphaned-files.md` (sic — task delivered in-conversation)

---

## A. Souhrn (TL;DR)

| Kategorie | Počet | Akce |
|---|---|---|
| RD Jáchymov PDFs v root | 9 | **`git rm`** — všechny **byte-identické duplikáty** existujících souborů v `test-data/RD_Jachymov_dum/inputs/dokladova_cast/` (viz §B.2). Deviace od task §6.1 (kde se navrhoval `git mv` do nového `stavebni_povoleni/`) — kanonická lokace už existuje. |
| hk212 DXF v root | 4 | **`git rm`** — všechny **byte-identické duplikáty** existujících souborů v `test-data/hk212_hala/inputs/vykresy_dxf/` (viz §C.2). Stejná deviace od task §6.2. |
| `data/peri-pdfs/` soubory | 3 | `git mv` per task §6.3. Žádné aktuální PDF v této složce (jen 3 soubory). |
| Neidentifikovatelné | 0 | Gate 5 skip. |
| **Celkem dotčeno** | **16** | 13× delete, 3× move |

---

## B. RD Jáchymov stavebni_povoleni dokumentace (9 souborů)

### B.1 Soubory nalezené v root repa

```
01.02 - JES.pdf
02.06 - MU Jáchymov - rozhodnutí zřízení vjezdu.pdf
02.07 - MU Jáchymov - nabytí právní moci.pdf
03.02 - město Jáchymov - Souhlas.pdf
03.03 - město Jáchymov - Vyjádření k žádosti.pdf
05.02 - Stanovisko PČR_sig.pdf
05.02b - PČR - RD Jáchymov - dodatek PD č.1_sig.pdf
05.02c - PČR - C.03.R1 - Koordinační situační výkres_sig.pdf
06.01 - TI - DTM mapa.pdf
```

### B.2 SHA-256 comparison vs canonical destination

`test-data/RD_Jachymov_dum/inputs/dokladova_cast/` už obsahuje stejné soubory pod identickými jmény. SHA-256 prefix comparison:

| Soubor | Root SHA | `dokladova_cast/` SHA | Identical? |
|---|---|---|---|
| `01.02 - JES.pdf` | `5699d369f698` | `5699d369f698` | ✅ |
| `02.06 - MU Jáchymov - rozhodnutí zřízení vjezdu.pdf` | `96b5a665c05c` | `96b5a665c05c` | ✅ |
| `02.07 - MU Jáchymov - nabytí právní moci.pdf` | `e14b0ee55443` | `e14b0ee55443` | ✅ |
| `03.02 - město Jáchymov - Souhlas.pdf` | `4d2adb38cc7d` | `4d2adb38cc7d` | ✅ |
| `03.03 - město Jáchymov - Vyjádření k žádosti.pdf` | `6b586f725fdd` | `6b586f725fdd` | ✅ |
| `05.02 - Stanovisko PČR_sig.pdf` | `b8e281195f63` | `b8e281195f63` | ✅ |
| `05.02b - PČR - RD Jáchymov - dodatek PD č.1_sig.pdf` | `4d5c930c9103` | `4d5c930c9103` | ✅ |
| `05.02c - PČR - C.03.R1 - Koordinační situační výkres_sig.pdf` | `69b968a1e537` | `69b968a1e537` | ✅ |
| `06.01 - TI - DTM mapa.pdf` | `fe9632cd645c` | `fe9632cd645c` | ✅ |

**Závěr:** 9/9 root souborů je byte-identický duplikát již zacomitovaných souborů v `test-data/RD_Jachymov_dum/inputs/dokladova_cast/`.

### B.3 Akce v Gate 2

`git rm` 9 root duplikátů. NE `git mv`. NE vytvářet `stavebni_povoleni/` (vytvořilo by třetí kopii).

**Deviace od task §6.1:** task navrhoval přesun do nově vytvořeného `test-data/RD_Jachymov_dum/stavebni_povoleni/`, ale ta cesta by **duplikovala** již existující `inputs/dokladova_cast/`. Per task §6 "uprav pokud najdeš lepší" — kanonická destinace už existuje, jen smazat root duplikáty.

Krit. 3 (`git mv` zachová historii): NEPOUŽITELNÉ — root soubory byly do repa přidány v commitu `4c03441 Add files via upload` bez předchozí historie, žádná history k zachování. `git log --follow test-data/RD_Jachymov_dum/inputs/dokladova_cast/...` ukazuje plnou historii canonical kopie.

---

## C. hk212 DXF výkresy (4 soubory)

### C.1 Soubory nalezené v root repa

```
212_HK_volkajakub-Výkres - A101 - PŮDORYS 1NP.dxf
212_HK_volkajakub-Výkres - A102 - PŮDORYS STŘECHY.dxf
212_HK_volkajakub-Výkres - A105 - ZÁKLADY.dxf
212_HK_volkajakub-Výkres - A201 - VÝKOPY.dxf
```

### C.2 SHA comparison vs canonical destination

`test-data/hk212_hala/inputs/vykresy_dxf/` už obsahuje **7 DXF** pod sjednoceným naming pattern `A{NNN}_<lowercase_snake_case>.dxf`:

| Root soubor | Canonical | Identical? |
|---|---|---|
| `212_HK_volkajakub-Výkres - A101 - PŮDORYS 1NP.dxf` | `A101_pudorys_1np.dxf` | ✅ |
| `212_HK_volkajakub-Výkres - A102 - PŮDORYS STŘECHY.dxf` | `A102_pudorys_strechy.dxf` | ✅ |
| `212_HK_volkajakub-Výkres - A105 - ZÁKLADY.dxf` | `A105_zaklady.dxf` | ✅ |
| `212_HK_volkajakub-Výkres - A201 - VÝKOPY.dxf` | `A201_vykopy.dxf` | ✅ |

Naming convention v `inputs/vykresy_dxf/` je už sjednocená (snake_case bez Czech diakritiky, bez `212_HK_volkajakub-Výkres -` prefixu). Konsistentní s tím, co task §6.2 navrhuje jako preferenci.

### C.3 Akce v Gate 3

`git rm` 4 root duplikátů. NE `git mv`. NE vytvářet `test-data/hk212_hala/dxf/` (vytvořilo by třetí kopii — kanonická cesta je `inputs/vykresy_dxf/`).

**Deviace od task §6.2:** task navrhoval přesun do `test-data/hk212_hala/dxf/`, ale ta cesta by **duplikovala** `inputs/vykresy_dxf/`. Zvolena delete.

---

## D. `data/peri-pdfs/` reorganizace (3 soubory)

### D.1 Inventarizace

```
data/peri-pdfs/formwork_catalog_PERI_DOKA_2025.md   20K
data/peri-pdfs/parse_peri_pdfs.py                   20K
data/peri-pdfs/rimsa_element_spec_v2_DOKA_PERI.md   24K
```

**Žádné PDF v `data/peri-pdfs/`** navzdory názvu složky. (Vendor PDF manuály jsou už zacomitovány v `concrete-agent/packages/core-backend/app/knowledge_base/B5_tech_cards/peri_*/` per-product subdirs.)

### D.2 Cílové destinace

| Source | Target | Důvod |
|---|---|---|
| `data/peri-pdfs/formwork_catalog_PERI_DOKA_2025.md` | `docs/reference/formwork_catalog_2025.md` | Project-agnostic reference; `docs/steering/structure.md` §7 cheat sheet už **explicitně** odkazuje na tuto cestu (řádek 238) |
| `data/peri-pdfs/parse_peri_pdfs.py` | `scripts/parse_peri_pdfs.py` | Operational Python script; `scripts/` existuje a obsahuje podobné `parse_*` / `check_*` scripts |
| `data/peri-pdfs/rimsa_element_spec_v2_DOKA_PERI.md` | `docs/specs/element/rimsa-v2-doka-peri.md` | Polished spec dokument (14 sekcí, materiály + technologie + acceptance + vazby na ostatní elementy) — držet jako **single file** dokud nebude aktivně rozpracován do req/design/tasks (per task §6.3.1 fallback). `docs/specs/element/` se vytváří nově (per `docs/audit_project_knowledge.md` §3.4 "element specs" cluster). |

### D.3 Code reference check

`grep -r "data/peri-pdfs"` v repu vrací **10 markdown references** (vesměs v `docs/audits/knowledge_audit/`, `docs/INVENTORY_BEFORE_WORKS_PIPELINE.md`, `docs/document-bridge-architecture.md`). **Žádný code path** (Python import, TypeScript path, JSON config) na `data/peri-pdfs/` neodkazuje. Markdown odkazy v audit dokumentech jsou snapshot-in-time, per task §8 "měnit obsah přesunutých souborů" je out-of-scope — zůstanou stale, ale ničeho se nedotknou.

### D.4 Single file vs 3-file split pro rimsa spec (§6.3.1)

`rimsa_element_spec_v2_DOKA_PERI.md` má 14 sekcí: ČTO JE RIMSA + Podtypy + Materiály + Systémy bednění + Postup prací + Betonáž + Brigáda + Mechanizace + Doba + Normy + Vstupní parametry + Speciální situace + Výstup do TOV + Acceptance criteria + Vazby na ostatní elementy. Je to **polished doménová reference**, ne implementační spec — neсплитá se cleanly do req/design/tasks vzoru. Per §6.3.1 fallback: **single file** `docs/specs/element/rimsa-v2-doka-peri.md`. Až bude aktivně rozpracován Claude Code-em → split tehdy.

### D.5 Akce v Gate 4

- `git mv data/peri-pdfs/formwork_catalog_PERI_DOKA_2025.md docs/reference/formwork_catalog_2025.md` (s rename — odebrat `_PERI_DOKA_` infix konzistentně se steering cheat sheet)
- `git mv data/peri-pdfs/parse_peri_pdfs.py scripts/parse_peri_pdfs.py`
- `git mv data/peri-pdfs/rimsa_element_spec_v2_DOKA_PERI.md docs/specs/element/rimsa-v2-doka-peri.md`
- `rmdir data/peri-pdfs && rmdir data` (prázdné po move)

`docs/reference/` a `docs/specs/element/` vytvářím implicitně přes `git mv` (git auto-vytvoří parent dirs).

---

## E. Neidentifikovatelné soubory (Gate 5)

**Žádné.** Všech 13 orphaned root souborů + 3 data/peri-pdfs/ souborů má jednoznačnou klasifikaci. Gate 5 **SKIP** (per task §7 Gate 5 "Pokud žádné takové soubory — skip tento Gate").

---

## F. Akce provedené Claude Code v této tasce

| # | Gate | Akce | Cesta |
|---|---|---|---|
| 1 | 1 | Vytvořen classification report | `docs/handoff/2026-05-19-orphaned-files-classification.md` |
| 2 | 2 | `git rm` 9 root PDF duplikátů | (root) |
| 3 | 3 | `git rm` 4 root DXF duplikátů | (root) |
| 4 | 4 | `git mv` `data/peri-pdfs/formwork_catalog_PERI_DOKA_2025.md` | `docs/reference/formwork_catalog_2025.md` |
| 5 | 4 | `git mv` `data/peri-pdfs/parse_peri_pdfs.py` | `scripts/parse_peri_pdfs.py` |
| 6 | 4 | `git mv` `data/peri-pdfs/rimsa_element_spec_v2_DOKA_PERI.md` | `docs/specs/element/rimsa-v2-doka-peri.md` |
| 7 | 4 | `rmdir data/peri-pdfs && rmdir data` | (data/ odstraněno) |
| – | 5 | SKIP (žádné neidentifikovatelné soubory) | – |
| 8 | 6 | Update `docs/steering/structure.md` §5 (zakázat ad-hoc `data/`) | `docs/steering/structure.md` |
| 9 | 7 | Update `docs/soul.md` §9 session log | `docs/soul.md` |

---

## G. Otevřené otázky pro Alexandra

### G.1 Konfirmace deviace od §6.1/§6.2 (delete vs move)

Kanonická lokace pro RD Jáchymov dokladovou část je `test-data/RD_Jachymov_dum/inputs/dokladova_cast/`, ne `stavebni_povoleni/` jak task navrhoval. Stejně pro hk212 — `inputs/vykresy_dxf/`, ne `dxf/`. Volil jsem **smazat duplikáty** v root (nezakládat třetí kopii). OK?

### G.2 Stale references v audit docs

10 markdown souborů v `docs/audits/knowledge_audit/` (+ `INVENTORY_BEFORE_WORKS_PIPELINE.md`, `document-bridge-architecture.md`) odkazuje na `data/peri-pdfs/`. Po Gate 4 jsou tyto odkazy stale. Per task §8 "měnit obsah přesunutých souborů — out of scope". Mám:
- **A)** ponechat (audit docs = snapshot in time)
- **B)** udělat samostatnou follow-up tasku `chore/docs-fix-stale-peri-paths`?

Doporučuji **A** — audit docs by se neměly retroaktivně přepisovat.

### G.3 Rimsa spec single-file rozhodnutí

Per §D.4 rozhodl jsem zachovat jako single `.md` v `docs/specs/element/rimsa-v2-doka-peri.md`. Až bude potřeba implementační work — Claude Code split na req/design/tasks tehdy. OK?

### G.4 Naming konvence cílové cesty

`docs/reference/formwork_catalog_2025.md` (cheat-sheet name) vs `docs/reference/formwork_catalog_PERI_DOKA_2025.md` (full original name). Zvolil jsem **cheat-sheet name** (odebrání `_PERI_DOKA_`) — sjednocení s `docs/steering/structure.md` §7. Pokud preferuješ zachovat původní jméno, dej vědět.

---

## H. Versioning

| Date | Version | Changes |
|---|---|---|
| 2026-05-19 | 0.1 | Initial classification (Gate 1) |
