# HK212 Zpevněné plochy — pre-mutation audit

**Date:** 2026-05-27
**Trigger:** Combined fixup task §1 audit-first discipline
**Branch:** `claude/hk212-vk-fixup-rampy-okapni`
**Verdict:** ⛔ **STOP — material discrepancy detected across 3 independent sources.** Mutations blocked pending user decision.

---

## §1. Source documents read

| Document | Path | Pages read |
|---|---|---|
| TZ ARS Souhrnná zpráva B | `inputs/tz/02_ars_souhrnna_B.pdf` | p04, p05, p06, p08, p09, p21 |
| TZ ARS Průvodní A | `inputs/tz/01_ars_pruvodni_A.pdf` | p03 |
| TZ ARS D.1.1 | `inputs/tz/03_ars_d11_TZ.pdf` | p02, p05 |
| PBR komplet | `inputs/tz/07_pbr_kpl.pdf` | p04, p05, p21, p22 |
| C.3 koordinační situace DPS | `inputs/situace/C3_koordinacni_situace_DPS_2026-05.pdf` | legenda + zoom okolí haly |

**TZ ARS DPZ explicitně** (uvedeno v task spec) — NEEXISTUJE jako samostatný soubor v repu. TZ ARS souhrnná B + D1.1 jsou ekvivalent.

---

## §2. Spec citace verbatim — material zpevněných ploch okolo haly

### TZ ARS Souhrnná B, p09:

> Objekt je napojen na stávající areálovou obslužnou komunikaci. **Bude zachována zpevněná komunikace o celkové šířce 6,87 m podél SZ fasády objektu. Podél haly bude vybudován chodník pro pěší ze zámkové dlažby o šířce 1,5 m.**

### TZ ARS Souhrnná B, p21:

> Bilance vozidel pro obsluhu haly je 5 nákladních automobilů za týden. Navýšení pohybu osobních vozidel se nepředpokládá. Jako skladníci budou pracovat stávající zaměstnanci.
> Bude zachována zpevněná komunikace o celkové šířce 6,8 m podél SZ fasády objektu. **Podél haly bude vybudována chodník ze zámkové dlažby pro pěší o šířce 1,5 m.**

### TZ ARS Souhrnná B, p04:

> Na pozemku se nachází zpevněné asfaltové komunikace.

(→ EXISTING asfalt na pozemku, NE nový.)

### TZ ARS D.1.1, p05:

> Odvodnění stávající zpevněné plochy bude zajištěno liniovým žlabem kolem SZ a JZ fasády zapuštěným v komunikaci.

(→ Liniový žlab pouze podél SZ + JZ fasády, ne kompletní obvod.)

### PBR komplet, p21:

> Jako přístupové komunikace k řešenému objektu slouží **stávající zpevněné komunikace**. K areálu vede dvoupruhová komunikace šířky cca 6 m (ul. Vážní). **Areálová komunikace je šířky min. 6 m a vede až ke vchodům do objektu**, tj. zastavení je možné před vchody do budovy (vždy do 10 m).

(→ Přístupové komunikace = STÁVAJÍCÍ, NE nové.)

### C.3 KOO Situace DPS — legenda:

Položky v legendě obsahující slovo "asfalt" / "vozovka":
- **STÁVAJÍCÍ VOZOVKA - ASFALT** (existing)

Žádná položka "navržená zámková dlažba", "navržený asfalt", "navržená komunikace" v legendě C.3 NEEXISTUJE — pouze značky pro:
- TRÁVNÍK, NÍZKÁ ZELEŇ (navrhované — záměna existující asfalt → tráva nebo new)
- STÁVAJÍCÍ VYSOKÁ ZELEŇ
- STÁVAJÍCÍ VOZOVKA - ASFALT
- LINIOVÝ ŽLAB PRO ODVOD DEŠŤOVÉ VODY
- VSTUP

---

## §3. Material classification — výsledek auditu

| Element | Source verbatim | Material spec | Plocha spec |
|---|---|---|---|
| **SZ areálová komunikace** | TZ ARS B p09 + p21 + PBR p21 | **EXISTING asfalt — zachovat** | 6.87 m × ? = mimo bid scope |
| **Chodník podél haly pro pěší** | TZ ARS B p09 + p21 | **NEW zámková dlažba** | šíře **1.5 m** × obvod (mimo vstupy) |
| **Manipulační plochy okolo haly** | nezmíněno explicitně v TZ ARS / PBR / C.3 legend | NESPECIFIKOVÁNO | nespecifikováno |
| **Parkoviště 10 stání** | nezmíněno explicitně — bilance vozidel 5 nákladních/týden + bez OA nárůstu | NESPECIFIKOVÁNO | nespecifikováno |
| **Příjezdová komunikace** | PBR p21 explicit STÁVAJÍCÍ | EXISTING ul. Vážní + areálová min 6 m — zachovat | mimo bid scope |
| **0.7 × 0.18 m perimeter concrete element** (per user řez detail) | NEEXISTUJE v TZ — pouze v řezech (DPS detail) | beton C25/30 XF3 pravděpodobně lůžko pod dlažbu | šíře 0.7 m (částečné, ne celých 1.5 m chodníku) |
| **Liniový žlab** | TZ ARS D.1.1 p05 | linije žlab zapuštěný v komunikaci | pouze SZ + JZ fasáda (NE celý obvod) |

---

## §4. Material certainty per source

| Element | Certainty | Reason |
|---|---|---|
| Chodník = zámková dlažba 1.5 m | **HIGH** | 2 nezávislé strany TZ ARS (p09 + p21) + chybí v C.3 legend novou položku "asfalt" |
| SZ asfalt = stávající, zachovat | **HIGH** | TZ ARS B p09 + p21 + PBR p21 + C.3 legend "stávající" |
| Liniový žlab pouze SZ+JZ | **HIGH** | TZ ARS D.1.1 p05 explicit |
| 0.7 m perimeter concrete = lůžko pod dlažbu | **MEDIUM** | Inferred from řez geometry + ČSN 73 6131 standard buildup pro dlažební chodník; chybí explicit TZ statement |
| Manipulační plochy + parkoviště new asfalt | **LOW** | Nezmíněno v TZ — user assumption Variant A nepodporeno spec |

---

## §5. Discrepancy with task §1.3 Variant A

| Task §1.3 Variant A assumption | TZ + PBR + C.3 reality | Status |
|---|---|---|
| Asfalt ACO 11+ obrusna 50 mm — 545 m² | Žádný nový asfalt v TZ / C.3 legend — pouze EXISTING asfalt SZ komunikace | ❌ **CONFLICT** |
| Asfalt ACL 16+ podkladní 70 mm — 545 m² | — neexistuje v TZ | ❌ CONFLICT |
| MZK nosná 220 mm — 545 m² | — neexistuje v TZ | ❌ CONFLICT |
| ŠD 0/63 podklad 250 mm — 545 m² | — neexistuje v TZ | ❌ CONFLICT |
| Plocha 545 m² (z C.3 měření) | Per TZ ARS B p09: chodník 1.5 m × ~obvod (mimo vstupy) → cca **125-145 m² zámková dlažba** | ❌ **3-4× větší** |
| Material asfalt | Material **zámková dlažba** | ❌ jiný material |

**Task §1.3 user note:**
> "это уже мои предположения а не проект но тем более развязаны руки я просто выставлю больший счет — t.j. user assumption-based scope, NE projektant spec. ABMV mandatory."

**Audit verdict:** "Развязаны руки" platí když TZ je TICHÝ (silent). Zde TZ ARS na 2 místech (p09 + p21) **explicitně specifikuje** zámkovou dlažbu 1.5 m. Toto NENÍ silent TZ, je to **přímý conflict** s asfalt Variant A.

Per task §4 instructions: *"Stop if audit reveals material discrepancy (e.g. C.3 explicit drátkobeton spec) — flag and wait user decision."*

This case is exactly that scenario. **Mutations halted.**

---

## §6. Recommended scenarios for user decision

### Scenario A — Honor TZ exactly (lowest risk, NEjméně optimisticky pro fakturu)

| Item | Material | Mnozstvi | Note |
|---|---|---:|---|
| M-VK-013 podklad ŠD | drcený štěrk 0/63 tl 100 mm | ~143 m² × 0.10 m = 14.3 m³ | jen pod dlažbou |
| M-VK-014 → REPLACE | **zámková dlažba 80 mm + lože štěrk 30 mm** | **~143 m² (1.5 m × ~95 m mimo vstupy)** | TZ ARS B p09 + p21 verbatim |
| ~~M-VK-024 ACL 16+~~ | — | — | DROP — neexistuje per TZ |
| ~~M-VK-025 MZK~~ | — | — | DROP — neexistuje per TZ |
| M-VK-015 obrubník | zachovat | 95 m | obrubník kolem dlažby |
| M-VK-017 komunikační napojení | drop / minimal | — | komunikace stávající |
| Liniový žlab M-VK-012 | zachovat 40 m | pouze SZ + JZ fasáda per TZ D.1.1 p05 | OK existing |
| Manipulační + parkování | **NEEXISTUJÍ v scope** | — | mimo TZ |

**Cena dopad:** ~−40 % vs Variant A (méně materiálu).

### Scenario B — Honor TZ + add nespecifikované rozšíření per user assumption

| Item | Material | Mnozstvi |
|---|---|---:|
| Chodník zámková dlažba per TZ | 1.5 m × 95 m | 143 m² |
| Manipulační plochy (user assumption) | beton drátkobeton C25/30 XF4 tl 150 mm | ~200 m² |
| Parkoviště 10 stání (user assumption) | asfalt ACO 11+ tl 50 mm + ACL + ŠD | ~125 m² |
| ABMV: spec mimo TZ — investor confirm |

**Cena dopad:** +0-15 % vs Variant A.

### Scenario C — Honor Variant A purely (overrride TZ)

Ignore TZ explicit zámková dlažba spec; build 489 m² asphalt + okapní chodník per task §2C. **High audit risk** — projektant Volka může odmítnout položky při sklad-2 kontrole. **Investor SOLAR DISPOREC může odmítnout fakturaci** pokud položky neodpovídají schválené dokumentaci.

**Cena dopad:** +30 % vs Scenario A (více materiálu, ale extra-spec scope).

### Scenario D — Ask projektant Volka before proceeding

Zaslat dotaz Stanislav Jirucha (autor TZ ARS) nebo statika Volka:
1. Je zpevněná plocha okolo haly opravdu pouze chodník 1.5 m zámková dlažba + zachovaná SZ komunikace?
2. Plánuje se navíc parkoviště 10 stání nebo manipulační plochy mimo TZ?
3. Specifikace materiálu manipulačních ploch — asfalt nebo drátkobeton (pojezd VZV)?

**Cena dopad:** unknown — depends on projektant response. Pravděpodobně Scenario A nebo blízko k němu.

---

## §7. Other audit findings (informational, no blocker)

### 7.1 Okapní chodník 0.7 × 0.18 m perimeter — NEEXISTUJE explicit spec v TZ

Z řezů detail screenshots 2026-05-27 user identified perimeter concrete 0.7 × 0.18-0.20 m. TZ ARS / PBR / C.3 nezmiňují tento element.

**Pravděpodobná interpretace:** lůžko z betonu C16/20 nebo C25/30 pod zámkovou dlažbu (chodník 1.5 m wide; 0.7 m představuje partial cross-section adjacent to hala wall; full 1.5 m je vidět v půdorysu A101 ale ne v sub-1m řezu).

**Alternative interpretation:** separate concrete sokl element. Pouze projektant Volka může confirm. Doporučeno ABMV.

### 7.2 Liniový žlab — partial perimeter only

TZ ARS D.1.1 p05 explicit: "kolem SZ a JZ fasády" — NE celý obvod haly. M-VK-012 (40 m) v PR #1235 odpovídá ~29 m SZ + ~10 m JZ = ~39-40 m. **OK already correct.**

### 7.3 Parkoviště 10 stání — nepodporeno TZ

TZ ARS B p21 explicit: "**Navýšení pohybu osobních vozidel se nepředpokládá. Jako skladníci budou pracovat stávající zaměstnanci.**" Bilance vozidel 5 nákladních / týden.

Zde nepřímo: stávající zaměstnanci → stávající parkoviště. **NE NEW 10 stání** podle TZ.

User assumption v task §2C (10× kolmá parkování 125 m²) je **nepodložené spec**. Pokud projektant chce 10 nová stání → musí být v dokumentaci, není v TZ ARS.

---

## §8. Recommended next steps

1. **Block mutations** until user explicitly chooses Scenario A / B / C / D.
2. Upload TZ ARS DPZ pokud existuje samostatně (různý od souhrnné B) — current corpus má pouze 01-A + 02-B + 03-D.1.1.
3. If projektant query (Scenario D) — pošli Stanislav Jirucha email s 3 otázkami výše.
4. If Variant B (TZ + extras) — ABMV mandatory na investor confirmation per scope expansion.

---

## §9. Files referenced

- TZ ARS pages: `outputs/tz_pages/02_ars_souhrnna_B__p{04,05,06,09,21}.txt`
- TZ ARS D.1.1 pages: `outputs/tz_pages/03_ars_d11_TZ__p05.txt`
- PBR pages: `outputs/tz_pages/07_pbr_kpl__p{04,05,21,22}.txt`
- C.3 KOO situace: `inputs/situace/C3_koordinacni_situace_DPS_2026-05.pdf`
- Source PDFs: `inputs/tz/{01_ars_pruvodni_A,02_ars_souhrnna_B,03_ars_d11_TZ,07_pbr_kpl}.pdf`
