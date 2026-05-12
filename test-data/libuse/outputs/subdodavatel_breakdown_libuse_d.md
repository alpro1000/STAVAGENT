# Subdodavatel breakdown — Libuše objekt D

**Date:** 2026-05-12 (refresh after PROBE_14a + PROBE_15 + PROBE_17)
**Source:** `items_objekt_D_complete.json` post `phase_0_21_list13_filter_view_plus.py`
enrichment.
**Mapping:** `test-data/libuse/data/subdodavatel_mapping.json` **v1.1** (was v1.0).

> **Mapping changelog v1.1 (2026-05-12, PROBE_14a):** PSV-783 (Ochrana
> konstrukcí proti agresivnímu prostředí) split z monolitního "zámečník"
> do granular per-F-kód / per-keyword trades via new `_kapitola_popis_granular`
> section. 91 z 93 PSV-783 items moved out of zámečník → 87 podlahář
> (epoxidový/PU) + 2 malíř (anti-graffiti) + 2 betonář (mazaniny); 2 stayed
> as zámečník (žárové zinkování + prášková úprava ocelových konstrukcí).
> See PROBE_14a v carry_forward_findings.

---

## TL;DR

| Skupina | Items | % celku |
|---|---:|---:|
| **Vlastní** (HSV in-house — generální dodavatel) | 1 224 | **29,9 %** |
| **Subdodavatel** (specialist trades) | 2 866 | **70,1 %** |
| **TOTAL** | **4 090** | **100 %** |

31 distinkt kategorií (+2 nové od v1.0: "podlahář (epoxidový/PU)" + "malíř
(anti-graffiti)"). Top 10 pokrývá **88 %** všech položek.

---

## Per-subdodavatel breakdown (sorted by count)

| # | Subdodavatel | Items | % celku |
|---:|---|---:|---:|
| 1 | vlastní (prostupy ve stropech) | 942 | 23,0 % |
| 2 | betonář (mazaniny) | 525 | 12,8 % |
| 3 | malíř | 523 | 12,8 % |
| 4 | SDK montér | 401 | 9,8 % |
| 5 | obkladač | 374 | 9,1 % |
| 6 | omítkář | 312 | 7,6 % |
| 7 | podlahář (vinyl / PVC) | 168 | 4,1 % |
| 8 | izolatér | 168 | 4,1 % |
| 9 | vlastní (osazení dveří/oken) | 101 | 2,5 % |
| 10 | zámečník | 99 | 2,4 % |
| 11 | **podlahář (epoxidový/PU)** 🆕 | **87** | **2,1 %** |
| 12 | vlastní (stykové detaily) | 73 | 1,8 % |
| 13 | truhlář | 55 | 1,3 % |
| 14 | vlastní (prostupy ve stěnách + stropech) | 48 | 1,2 % |
| 15 | dodavatel dveří | 43 | 1,1 % |
| 16 | klempíř | 41 | 1,0 % |
| 17 | izolatér + střechař | 19 | 0,5 % |
| 18 | zedník (překlady) | 14 | 0,3 % |
| 19 | fasádista | 13 | 0,3 % |
| 20 | vlastní (úklid) | 13 | 0,3 % |
| 21 | vlastní (vedlejší rozpočtové náklady) | 11 | 0,3 % |
| 22 | vlastní (lešení) | 10 | 0,2 % |
| 23 | pokrývač | 9 | 0,2 % |
| 24 | vlastní (pomocné práce) | 9 | 0,2 % |
| 25 | vlastní (prostupy ve stěnách) | 9 | 0,2 % |
| 26 | truhlář (spec. dveře) | 8 | 0,2 % |
| 27 | vlastní (zařízení staveniště) | 5 | 0,1 % |
| 28 | vlastní (přesun hmot) | 3 | 0,1 % |
| 29 | dodavatel oken | 3 | 0,1 % |
| 30 | **malíř (anti-graffiti)** 🆕 | **2** | **0,0 %** |
| 31 | dodavatel oken (curtain wall) | 2 | 0,0 % |
| **TOTAL** | | **4 090** | **100 %** |

---

## Delta v1.0 → v1.1 (PROBE_14a impact)

| Subdodavatel | v1.0 (4 025 items) | v1.1 (4 090 items) | Note |
|---|---:|---:|---|
| zámečník | 190 | **99** | **−91** PSV-783 reclass + 0 from new items (PSV-767 zámečnické výrobky unchanged at 97) |
| **podlahář (epoxidový/PU)** 🆕 | 0 | **87** | F14 Sikagard ŽB stěn (78) + F11 epoxid (3) + F10 PU (4) + F14 transparentní (2) |
| **malíř (anti-graffiti)** 🆕 | 0 | **2** | F23 penetrace + permanent nátěr |
| betonář (mazaniny) | 503 | 525 | +2 from F00 pancéřový (PSV-783 reclass) + 20 from PROBE_17 FF20/FF30 base (penetrace + potěr + kari síť + PSB ~5 items × 5 rooms) |
| malíř | 491 | 523 | +32 from PROBE_17 podhled malba (4 items × 8 rooms 3.NP F20→F17) |
| SDK montér | 393 | 401 | +8 from PROBE_17 SDK podhled Knauf D112 (8 rooms 3.NP) |
| izolatér | 163 | 168 | +5 from PROBE_17 kročejová izolace 25mm (1 item × 5 FF20/FF30 rooms) |
| omítkář | 312 | 312 | 0 (PROBE_15 6 items HSV-611 already mapped) |
| (other 23 categories) | unchanged | unchanged | — |
| **TOTAL** | **4 025** | **4 090** | **+65 new** (PROBE_17) + 0 net from PROBE_14a re-tagging |

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
