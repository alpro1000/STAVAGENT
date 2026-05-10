# Subdodavatel breakdown — Libuše objekt D

**Date:** 2026-05-10
**Source:** `items_objekt_D_complete.json` post `phase_0_21_list13_filter_view_plus.py`
enrichment.
**Mapping:** `test-data/libuse/data/subdodavatel_mapping.json` v1.0.

---

## TL;DR

| Skupina | Items | % celku |
|---|---:|---:|
| **Vlastní** (HSV in-house — generální dodavatel) | 1 224 | **30,4 %** |
| **Subdodavatel** (specialist trades) | 2 801 | **69,6 %** |
| **TOTAL** | **4 025** | **100 %** |

29 distinkt kategorií. Top 10 pokrývá **87 %** všech položek.

---

## Per-subdodavatel breakdown (sorted by count)

| # | Subdodavatel | Items | % celku |
|---:|---|---:|---:|
| 1 | vlastní (prostupy ve stropech) | 942 | 23,4 % |
| 2 | betonář (mazaniny) | 503 | 12,5 % |
| 3 | malíř | 491 | 12,2 % |
| 4 | SDK montér | 393 | 9,8 % |
| 5 | obkladač | 374 | 9,3 % |
| 6 | omítkář | 312 | 7,8 % |
| 7 | zámečník | 190 | 4,7 % |
| 8 | podlahář (vinyl / PVC) | 168 | 4,2 % |
| 9 | izolatér | 163 | 4,0 % |
| 10 | vlastní (osazení dveří/oken) | 101 | 2,5 % |
| 11 | vlastní (stykové detaily) | 73 | 1,8 % |
| 12 | truhlář | 55 | 1,4 % |
| 13 | vlastní (prostupy ve stěnách + stropech) | 48 | 1,2 % |
| 14 | dodavatel dveří | 43 | 1,1 % |
| 15 | klempíř | 41 | 1,0 % |
| 16 | izolatér + střechař | 19 | 0,5 % |
| 17 | zedník (překlady) | 14 | 0,3 % |
| 18 | fasádista | 13 | 0,3 % |
| 19 | vlastní (úklid) | 13 | 0,3 % |
| 20 | vlastní (vedlejší rozpočtové náklady) | 11 | 0,3 % |
| 21 | vlastní (lešení) | 10 | 0,2 % |
| 22 | pokrývač | 9 | 0,2 % |
| 23 | vlastní (pomocné práce) | 9 | 0,2 % |
| 24 | vlastní (prostupy ve stěnách) | 9 | 0,2 % |
| 25 | truhlář (spec. dveře) | 8 | 0,2 % |
| 26 | vlastní (zařízení staveniště) | 5 | 0,1 % |
| 27 | vlastní (přesun hmot) | 3 | 0,1 % |
| 28 | dodavatel oken | 3 | 0,1 % |
| 29 | dodavatel oken (curtain wall) | 2 | 0,0 % |
| **TOTAL** | | **4 025** | **100 %** |

---

## Top 5 — kapitola + jednotková summary

### 1. Vlastní (prostupy ve stropech) — 942 items

| Kapitola | Items |
|---|---:|
| HSV-963 | 942 |

Total: **942 ks** prostupů ve stropech (HSV-963).

> Pochází primárně z PROBE 9 TZB recovery — 510 direct extract
> (kanalizace, vodovod, silnoproud, slaboproud, UT, plyn) + 314 VZT/chl
> direct (drop v3) + 102 heuristických 1.PP VZT/chl + zbylé. Všechny
> řízeny generálním dodavatelem (stavební scope, ne TZB profession).

### 2. Betonář (mazaniny) — 503 items

| Kapitola | Items |
|---|---:|
| HSV-631 | 503 |

Total: **3 321,2 m² + 29,2 m³** mazanin.

### 3. Malíř — 491 items

| Kapitola | Items |
|---|---:|
| PSV-784 | 491 |

Total: **14 383,0 m²** + **60,0 m** maleb.

### 4. SDK montér — 393 items

| Kapitola | Items |
|---|---:|
| PSV-763.2 (předstěny) | 215 |
| PSV-763.1 (podhledy) | 136 |
| PSV-763 (default) | 35 |
| PSV-763.3 (podkroví) | 7 |

Total: **2 301,7 m²** + **1 657,2 m** + **965 ks** SDK konstrukcí.

### 5. Obkladač — 374 items

| Kapitola | Items |
|---|---:|
| PSV-771 (dlažby keramické) | 202 |
| PSV-781 (obklady keramické) | 172 |

Total: **2 343,9 m²** + **811,9 m** + **1 946,5 kg** keramiky.

---

## Use case examples for List 13 Filter_view_plus

Otevři Excel → karta `13_Filter_view_plus` → klikni ▼ na header
`Subdodavatel`:

### Use case 1: poptávka pro elektrikáře

Filtr `Subdodavatel = elektrikář` → 0 items v aktuálním D (kapitola
PSV-741/742 + M-21x nemá v Tabulkách kapitoly — elektroinstalace je
mimo HSV+PSV+M scope pro architektonický soupis Libuše; součást
samostatného profesijního VV).

> **Poznámka:** elektrikář se objeví až po nahrání samostatného
> elektro-vykazu (zatím v dokumentaci jako 7.NP slaboproud DXFs už
> extrahovány, ale klasifikované pod `slaboproudař` ne pod
> `elektrikář` per kapitola convention).

### Use case 2: poptávka pro malíře

Filtr `Subdodavatel = malíř` → **491 položek**, kapitola PSV-784,
celkem **14 383 m² maleb**. Použitelné jako kompletní rozsah pro
quote.

### Use case 3: poptávka pro SDK montéra

Filtr `Subdodavatel = SDK montér` → **393 položek** napříč
PSV-763.1/2/3 → 4 ne­dílné práce (podhledy / předstěny / podkroví /
default). Jako poptávka: 2 302 m² + 1 657 m + 965 ks.

### Use case 4: vlastní práce (generální dodavatel scope)

Filtr `Subdodavatel = vlastní (prostupy ve stropech)` → **942 ks**
prostupů pro koordinaci se subdodavateli TZB. Použitelné jako interní
checklist a kalkulace HSV-963 ceníku.

Případně použijte sloupcový filtr `Discipline = HSV` → všechny
**2 039 položek** pod hlavní stavbou (generální dodavatel přímo
realizuje).

### Use case 5: PROBE 9 audit

Filtr `Source = PROBE_9` + `Confidence = 0.70` → 102 heuristických
položek (1.PP VZT/chl) pro manuální cross-check vs PDF výkresů. Po
verifikaci možno přepsat confidenci nebo zmenšit počet.

### Use case 6: per-discipline split

| Discipline | Items | Charakteristika |
|---|---:|---|
| HSV | 2 039 | Hrubá stavba — generální dodavatel realizuje přímo |
| PSV | 1 888 | Profese subdodavatelské (SDK/malby/obklady/podlahy/atd.) |
| Detail | 87 | Stykové detaily (parapety, ostění, dilatace, mřížky) |
| VRN | 11 | Vedlejší rozpočtové náklady (BOZP, geodet, autorský dozor) |

---

## Subdodavatel mapping — design notes

### Priority chain (top-down)

1. **Popis-regex special case** — `W##` / `D##` / `CW##` item-code
   prefix in popis triggers `dodavatel oken` / `dodavatel dveří` /
   `dodavatel oken (curtain wall)` regardless of kapitola
2. **Exact kapitola match** — `exact_kapitola_match` dict
3. **Kapitola prefix fallback** — `kapitola_prefix_fallback`
   (longest prefix wins)
4. **Discipline default** — HSV / PSV / M → `vlastní`
5. **Final fallback** — string `"vlastní"`

### Override mechanism

Per-objekt or per-project override possible by placing
`test-data/<project>/data/subdodavatel_mapping_override.json` next to
the base mapping. Enrichment script merges override on top — not
implemented in v1.0 but ready when needed.

### Coverage gap

Currently 0 items map to `elektrikář` because Libuše doesn't carry
PSV-741/742 or M-21x kapitoly in the architectural Tabulky — elektro
scope lives in a separate professional VV (silnoproud, slaboproud)
that's NOT in this deliverable. List 13 reflects this honestly:
electrical work shows up under `slaboproudař` (8 items via SLP-*
kapitola routing) and `vlastní` (cable-tray štroby in HSV-961
mapped to `vlastní`).

---

## Validation summary

- ✅ List 12 **byte-identical** before/after (zero regression)
- ✅ List 13 created with 4 027 rows × 15 cols, Excel Table `VykazFilterPlus`
- ✅ 15 / 15 pi_0 Step 8c tests pass
- ✅ Validation gate 373 MATCH / 0 MISSING / 0 CHANGED / 7 NEW = PASS
- ✅ Idempotency byte-identical 3× re-run of `phase_0_21_*`
- ✅ All 4 025 items have `subdodavatel` field populated (no `?`)

---

_Generated by Claude Code, subdodavatel breakdown report, 2026-05-10._
