# TASK: Říms Calculator UX Audit — Field Visibility + Unit Conventions

> **Verze:** v1.1 (updated after Alexander review 2026-05-20)
> **Datum:** 2026-05-20
> **Priorita:** P0 (foundational — нужно до Phase D implementation)
> **Effort estimate:** ~4-6 часов Claude Code session (audit only, no fixes)
> **Depends on:** Phase A discovery уже завершён (commit 5b7453b)
> **Blocks:** Phase D implementation říms calibration

---

## Контекст

Phase A audit обнаружил расхождения между Python и TypeScript для римсы.
Этот task — **глубокий UX audit** калькулятора в manual mode для element=rimsa.

Основан на исследовании следующих источников (документировано в analyse):
- **TKP 18 §18.3** — нормативные требования pre říms (curing class 4, trhliny ≤ 0.2 mm, sealed working joints)
- **Metodika MD ČR** pro řízené smršťovací spáry — 6 m default pro shrinkage cracks
- **DOKA katalog** — Doka-Římsové bednění T vs Římsový vozík T (различные продукты!)
- **ÚRS 317353191** — bednění říms měřené v m² (площадь)
- **OTSKP 317325** — agregovaná pozice m³ — **бетон + bednění + práce + manipulace одна позиция**
- **OTSKP 317365** — výztuž říms B500B — **отдельная pozice** v t (specifika OTSKP CZ)
- **Wikipedia Mostní římsa + Pokorný-Šertler** — preffabrikat 100mm × 2000mm, osy kotev 230-400 mm
- **Praxe (boss confirmation):** Pracovní záběry 25-30 m реально, smršťovací spáry внутри по 6 m

**Note on OTSKP:** В Чехии OTSKP агрегирует bednění+beton+práci в одну m³ pozицy, но výztuž остаётся separate. В других странах (BKI Germany, Polish KNR, French Batiprix) конвенции другие — но **наповнění práci se nemění**. Калькулятор vычисляет fyzická množství; pricing katalog je layer above.

---

## КЛЮЧЕВОЙ INSIGHT: Two-level pour model

Калькулятор сейчас путает **2 разных понятия** под одно поле `cycle_length_bm`. Реально это **двухуровневая модель** (confirmed Alexander's boss + TKP 18 + Metodika MD ČR):

### Level 1 — Pracovní záběr (concrete pour batch)

**Что это:** Длина непрерывной заливки за раз. Между ними **pracovní spára** = sealed against water per TKP 18.

**Default:** **25 m** (per Czech praxe)
**Range:** 15-40 m (реалистично)
**Determines:** Curing schedule (9 dní per záběr), formwork relocation count, crew dni, cost of sealed working joints

### Level 2 — Smršťovací spára (shrinkage crack joint)

**Что это:** Запроектированная trhlина для контроля smršťování betonu. Внутри pracovního záběru. NOT остановка betonáže.

**Default:** **6 m** (per Metodika MD ČR — "ekonomická délka výztuže")
**Range:** 3-8 m (typical)
**Determines:** Cost of joint sealing strips, výztuž design, NOT curing schedule

### Example — SO 206 (70 bm total, 2 strony po 35 bm)

```
Per side (35 bm):
  Pracovní záběr 1: 0-25 m  
    └─ Smršťovací spáry: na 6, 12, 18, 24 m (4 ks)
  Pracovní spára (sealed against water) na 25 m
  Pracovní záběr 2: 25-35 m  
    └─ Smršťovací spára na 31 m (1 ks)
  
Total per side: 2 pracovní záběry + 5 smršťovacích spár
Total bridge (2 sides): 4 pracovní záběry + 10 smršťovacích spár

Curing dní (calendar):
  - Sequential: 2 záběry × 9 dní = 18 dní (1 sada bednění)
  - Parallel: 9 dní (2 sады bednění)
  
NEPRAVOIDLO: nesmí sčítat smršťovací spáry × 9 dní = nesmysl
```

### Why calculator is wrong now

Калькулятор сейчас:
- Принимает `cycle_length_bm=6` → думает 12 záběrů по 6 m
- Возвращает `num_tacts: 12` → правильно для **smršťovací**, ale wrong для **pracovní**
- Возвращает `curing_days: 108` (9 × 12) → **очень неправильно** (sum smršťovacích spár)
- Должно быть: 2 záběry × 9 dní = **18 dní sequential** OR **9 dní parallel**

**Fix v Phase D:** разделить fields:
- `pracovni_zaber_length_bm` (default 25, range 15-40) — pro curing schedule
- `smrstovaci_spara_distance_bm` (default 6, range 3-8) — pro joint count/cost

---

## МАНТРА

Прочитай весь репо. Naming по существующим конвенциям.
NO КОД — только audit + report + open questions.

---

## Phase 1 — Manual mode калькулятора (UI screenshot audit)

### 1.1 Открыть kalkulator.stavagent.cz/planner manually

Выбрать element_type = "rimsa" (Říms).

Перечислить ВСЕ поля которые становятся видимыми, с классификацией:

| Поле | Тип input | Текущий placeholder/default | Relevant? |
|---|---|---|---|
| ... | ... | ... | ✓/❌/⚠️ |

**Категории классификации:**
- ✓ Relevant — поле нужно для říms
- ❌ Irrelevant — поле не имеет смысла для říms (например `pile_diameter_mm`, `nk_subtype`, `prestress_*`)
- ⚠️ Hidden but relevant — должно быть видно но скрыто
- 🔄 Duplicate — то же значение спрашивается 2×
- 💀 Dead code — поле существует, но не wired в engine

### 1.2 Field validation checklist (что НЕ должно появляться для říms)

Audit список — каждое из этого должно быть **скрыто или absent** для element=rimsa:

```
❌ pile_diameter_mm — это для pilot
❌ pile_count — это для pilot  
❌ pile_geology — это для pilot
❌ nk_subtype (deskovy/jednotramovy/...) — это для mostovkova_deska
❌ is_prestressed — říms никогда не předpjatá
❌ span_m — říms не má rozpětí
❌ num_spans — říms не má pole
❌ num_bridges (kromě если striktně 1 vs 2 параллелno) — možná
❌ construction_technology (MSS/cantilever) — это для mostovky
```

### 1.3 Field gaps checklist (что ДОЛЖНО быть для říms но нет)

Из практики (web research summary):

```
✓ width_m (ширина римсы в cross-section, например 0.75 m)
✓ height_m (высота cross-section, например 0.6 m) — ОТДЕЛЬНО от высоты моста
✓ length_bm (общая длина римсы в bm, например 70)
✓ pracovni_zaber_length_bm (default 25 m, range 15-40) ★ NEW
✓ smrstovaci_spara_distance_bm (default 6 m, range 3-8) ★ NEW  
✓ num_dilatation_units (количество дилатационных целков NK)
✓ pohledove_bedneni_preffabrikat (boolean — preffabrikat 100×2000mm jako pohledové bednění)
✓ kotveni_do_NK (kotvení римсы do mostovky — anchors)
✓ anchor_to_NK_distance_mm (extension výztuže do mostovky, 230-400 mm typ.)
✓ formwork_system (filtered options: T-bednění, vozík T, vozík TU, místní + zábradlí systémy)
✓ has_kapsa_na_svodidlo (boolean — есть карман для svodidla?)
✓ has_chodnik (boolean — chodník у римсы — может изменить ширину)
```

**Старое поле `cycle_length_bm` должно быть deprecated** — заменено двумя полями выше (pracovní záběr + smršťovací spára).

### 1.4 Two-level pour model audit (NEW)

Проверить current calculator semantics:
- Что калькулятор думает что значит `cycle_length_bm=6`?
- Сейчас он считает 6 m как **pracovní záběr** (записывает 12 záběrů × 9 dní curing = 108)
- Это **wrong** — 6 m должно быть smršťovací spára (внутри pracovního záběru), не сам záběr
- Pracovní záběr должен быть 25 m (4 smršťovacích spáр в одном záběre)

**Acceptance test:** запустить calculator s SO 206 данными (volume=22.562, length=70, true cycle = 25 m pracovní + 6 m smršťovací):
- Expected: 4 pracovní záběry (2 per side × 2 sides), 18 dní curing sequential / 9 dní parallel
- Actual: ? (документировать)
- Variance: ? (рассчитать diff)

### 1.4 Formwork dropdown options audit

Когда выбран element=rimsa, dropdown "Výrobce bednění" + "Systém bednění" должен показывать только:

**Должно показывать для říms:**
- ✓ DOKA: **Doka-Římsové bednění T** (stacionárne, default для < 100 bm)
- ✓ DOKA: **Římsový vozík T** (для dlouhých mostů > 200 bm)
- ✓ DOKA: **Římsový vozík TU** (upgraded vozík)
- ✓ PERI: **VARIOKIT konzole** (alternative)
- ✓ ULMA: konzole pro říms
- ✓ Místní: tradiční dřevěné bednění (small projects)

**НЕ должно показывать для říms:**
- ❌ Frami Xlife (стены до 3m — irrelevant)
- ❌ Framax Xlife (стены/пилиере до 6.75m)
- ❌ MAXIMO (стены/пилиере)
- ❌ VARIO GT 24 (стены до 12m)
- ❌ Dokaflex (стропы)
- ❌ SKYDECK (стропы)
- ❌ Top 50 (мостовка falsework)
- ❌ Staxo 100 (тяжёлая podpůrná)
- ❌ DOKA MSS / VARIOKIT Mobile (MSS для длинных мостов — не для říms specifically)

---

## Phase 2 — Unit conventions audit

### 2.1 Triple unit problem documentation

Документируй в audit report что для říms существуют **3 параллельные units conventions** (varies per pricing catalog, fyzická práce stejná):

| Контекст | Единица | Что включено | Pricing source |
|---|---|---|---|
| **Physical DOKA rental** | Kč/bm/měs | Только bednění аренда | DOKA katalog (commercial) |
| **ÚRS 317353191** | m² | Bednění zřízení (bez betonu, bez výztuže) | ÚRS 2024+ — separate pozice (3 items) |
| **OTSKP 317325** | m³ | **Бетон + bednění + práce + manipulace** (aggregated) | OTSKP 1/2025 — 16,900 Kč/m³ |
| **OTSKP 317365** | t | **Výztuž říms B500B** (separate) | OTSKP — 41,635 Kč/t |

**Klíčové:** OTSKP агрегирует бетон+bednění+práci в **одну m³ pozицу**, ale **výztuž je vždy separate t pozice** (specifika OTSKP CZ pro veřejné zakázky). V Germany/Poland/France konvence mohou být jiné, ale **fyzická práce zůstává stejná**.

**Калькулятор musí:**
- Vypočítat **physical** quantities: m³ beton, m² bednění, t výztuž, bm délka
- Mapovat na konkrétní pricing katalog: OTSKP aggregates (m³+t), ÚRS separates (m³ + m² + t)
- Podle volby uživatele — který výstupní format

### 2.2 Verify calculator output — какую конвенцию использует?

Сейчас calculator возвращает:
- `formwork_area_m2: 90.2` ← откуда эта цифра? (70 bm × ??? = 90.2)

Investigate в engine code:
- Где конверsion bm → m² для říms?
- Какая cross-section assumed?
- Соответствует ли ÚRS 317353191 measurement?

### 2.3 Recommendation v report

Какая модель должна быть default?

Рекомендую:
- **Internal calculation:** bm (physical) — для DOKA rental + cycle counting
- **Display 1:** m² bednění (ÚRS) + m³ beton + t výztuž — для soupis prací
- **Display 2:** m³ aggregated (OTSKP) — для D6 silniční
- **Toggle UI:** user vybírá катаlog (ÚRS / OTSKP / both)

---

## Phase 3 — Behavior bugs verification

### 3.1 Verify all 8 known bugs из říms calibration task

Запустить calculator на SO 206 типичных значениях, verify каждый bug:

| Bug # | Описание | Test input | Expected | Actual | Status |
|---|---|---|---|---|---|
| 1 | Discrete shifts (5d → ≥1 directionа) | rimsa C30/37 XF4, volume=22.562 | rebar_days = ceil hours/8 | 18 | ? |
| 2 | rebar_days ignores crew_size | crew_size_rebar=6 | 18/2 = 9 days | 18 days (always) | ? |
| 3 | T-bednění norms missing relocate | formwork_length_bm=70, cycles=12 | setup 70 + relocate 70×11 × 0.5 + strip 70 × 0.4 | 24 days (?) | ? |
| 4 | Curing summed linearly | num_tacts=12 | 9 days total (final záběr) | 108 days (9×12) | ? |
| 5 | Volume vs length input | input volume + length | length-based primary | volume primary | ? |
| 6 | Auto-selects vozík | length=70 bm | "Římsové bednění T" | "Římsový vozík" | ? |
| 7 | Default ratio 130 vs 140 | rimsa default | 140 kg/m³ | 130 kg/m³ | ? |
| 8 | No max záběr validation | cycle_length_bm=30 | warning >6m | accepts silently | ? |

### 3.2 New bugs found через web research

| Bug | Описание | Verify |
|---|---|---|
| 9 | num_tacts=1 без length | calculator с rimsa volume only → returns 1 záběr (impossibly large pour) | run test |
| 10 | Field `height_m` ambiguous | trактует как height моста, не cross-section | inspect engine |
| 11 | No `width_m` field for říms | nelze zadat ширину римсы | inspect UI |
| 12 | No `smrstovaci_spary_distance` | nelze nastavit per Metodika MD | inspect UI |
| 13 | No `pohledove_bedneni_preffabrikat` | preffabrikat jako bednění není option | inspect UI |
| 14 | Formwork dropdown nefiltrovaný | показывает стропní systémy для říms | inspect UI |

### 3.3 Formwork productivity audit (NEW — per Alexander боссова комментаря)

**Контекст:** Босс Alexandra (přípravář s 20+ годами в Berger Bohemia) říká že **montáž římsového bednění je долгая и сложная работа** — реалистично занимает значительно больше времени чем теоретическая norma.

**Источники нашёл в research:**

| Источник | Setup productivity | Strip productivity | Note |
|---|---|---|---|
| **DOKA T-bednění** (manufacturer spec) | ~1.0 h/bm | ~0.4 h/bm | Modular system, optimized |
| **DOKA T-bednění relocate** (mezi záběry) | ~0.5 h/bm | — | Faster než první setup |
| **Methvin formwork general** | 0.5-2.0 h/m² | 0.3-0.5 h/m² | Generic, не říms-specific |
| **Singapore BCA real measurement** | 0.44 manhours/m² | — | Wall formwork, ne říms |
| **HeavyBid bridge overhang** | 1.33 h/m² | — | Mostová specifická productivity |
| **RTS HSV 411 norma** (1980s) | 2-3 h/m² | 1-1.5 h/m² | Old hardware norma |
| **Калькулятор сейчас** | hardcoded 1.0 h/bm (setup only) | 0.43 h/bm | Bez relocate, bez learning curve |

**Чего калькулятору не хватает:**

1. **Relocate productivity** — между záběry поле/код отсутствует. Должно быть ~0.5 h/bm.
2. **Learning curve** — первый záběr 1.5×, второй 1.0×, třetí+ 0.7-0.8×.
3. **Difficulty multiplier** — работа над пропастью ×1.3, C2d pohledový ×1.5, sklon ×1.2, radius ×1.1
4. **Crew composition** — 1 hlavní tesař + 2 montéři + 1 pomocník (crew=4 typical)
5. **Anchor holes drilling** — 20 holes × 15 min = 5 hodin extra na záběr
6. **Safety preparation** — záchytné prostředky add 30-50% k času

**Acceptance test pro Phase 3.3:**

Запустить calculator на SO 206 (35 bm říms × 2 strony) и сравнить:
- Expected (per boss + research): **~3 dni paralelně OR ~6 dni sekvenčně**
- Calculator returns: ?
- Variance > 20% → bug ticket

**Open question pro Alexandra:**
Какой default productivity использовать?
- (A) Theoretická norma RTS (3 h/m²) — pesimistic
- (B) DOKA spec (1.0 h/bm setup + 0.5 relocate + 0.4 strip) — optimistic
- (C) **Calibrated reality (1.5× DOKA spec)** ← recommend default
- (D) Per-project adjustment (factor 1.0-2.0 по сложности)

### 3.4 Shift rounding rule (NEW — per Alexander)

**Контекст:** Калькулятор сейчас считает raw hours / 8 без rounding to discrete shifts. Это нереалистично pro real construction site.

**Industry rule (Czech praxe, per Alexander confirmation):**

```
Work duration  →  Shifts counted
< 4 hours      →  0.5 směny (можно совмещать с другой činností)
4-6 hours      →  1 směna (если другая činnost lekká)
6-9 hours      →  1 směna FULL (no other major task fits) ← Alexandrovo pravidlo
9-12 hours     →  1 směna + potential přesčas (per ZP §93)
12-16 hours    →  1.5-2 směny (split per Zákoník §83 max 12h)
16-20 hours    →  2 směny (sequential 2 dni OR 2 crews paralelně)
20-24 hours    →  2-3 směny
```

**Rationale (Alexandrovo logické vysvětlení):**

1. Setup overhead následujícího tasku — переключение činnostmi 1-2 h
2. Crew nemůže "wait" — простой = плата без productivity
3. Logistics constraints — beton delivery, jeřáb time, weather window
4. Coordination cost — other tasks depend on this sequence
5. Per Zákoník práce §83: max směna 12 h, min 11 h rest between shifts

**Acceptance criteria pro Phase D:**

- Calculator should apply shift_rounding_rule before reporting calendar days
- New config field: `shift_length_h` (default 10) — для conversion hours → shifts
- New config field: `min_shift_threshold_h` (default 6) — works ≥6h count as full shift
- All scheduling outputs in shifts AND in calendar days (both visible)

### 3.5 Rebar productivity для říms (NEW)

**Контекст:** Калькулятор сейчас hardcodes 18 dní rebar regardless of quantity or crew.

**Industry sources (h/t):**

| Source | h/t | Element |
|---|---|---|
| Quora industry avg | 17.33 | Generic rebar fixing |
| Planning Planet | 20-30 | Foundations |
| Philippines guide | 12-21 | Beams |
| **STAVAGENT memory (calibrated)** | **22.4** | D12 in beams/columns |
| **STAVAGENT memory** | **30** | D6-12 stirrups |
| **Realistic для říms** | **25-30** | D10/D12 + lots of stirrups |

**Říms specifics:**
- Small diameters (D10/D12) → slower per kg
- Many třmínky (každé 100-150 mm) → complex armování
- Difficult access (above void) → +20% time

**SO 206 calculation example (2.93 t per side):**
- 2.93 t × 25 h/t = **73 man-hours per side**
- Crew = 3 vazači × 10 h směna = 30 h/směna
- Calendar time = 73 / 30 = **2.4 směny per side**
- Per shift rounding: **3 směny per side sekvenčně**
- Per shift rounding paralelně (2 crews): **3 směny celkem oba boky**

**Open question pro Alexandra:**
Какой default productivity для říms rebar?
- (A) 22 h/t (general beam standard)
- (B) **25 h/t (říms with stirrups)** ← recommend default
- (C) 30 h/t (complex říms with anchors)

### 3.6 Concrete pouring для říms (NEW)

**Параметры production-realistic:**

| Параметр | Value | Note |
|---|---|---|
| Pump output | 30-60 m³/h | Mobile boom M28-M36 |
| 22.5 m³ pour time | **30-60 min** | 1 pump dostačí |
| Setup + cleanup | 2-3 h | Pump positioning, concrete supply |
| Total betonáž calendar | **3-4 h = 1 směna** (per shift rule) | Per pracovní záběr |
| Crew | 5 betonáři | 1 укладка + 2 vibrace + 1 finiš + 1 koordinátor |
| Max pour height | 1.5 m | Anti-segregation |
| Concrete delivery distance | ≤30 km ideal | Per ČSN EN 206 |
| Air content (XF4) | 4-6% mandatory | Provzdušněný beton |

**Calculator gap:** Sucasný engine vrátí concrete_days=12 (per_tact 1 × 12 záběrů). Reálně:
- Per pracovní záběr (25 m): 1 směna
- 4 pracovní záběry total (SO 206 obě strony) = **4 směny sekvenčně** OR **2 směny paralelně**
- Cannot do all in 1 day (pump availability, crew, concrete delivery limit)

### 3.7 Curing methods für říms (NEW per TKP 18 §7.8.3)

**Class 4 mandatory pro říms** (per TKP 18):

| Temperatura | Min duration |
|---|---|
| ≥25°C | 7 dní |
| 15-25°C | **9 dní** ← typical |
| 10-15°C | 12 dní |
| 5-10°C | 18 dní |
| <5°C | Special winter measures |

**Methods compatibility for říms:**

| Method | OK для říms? | Reason |
|---|---|---|
| Spraying water | ⚠️ NOT preferred | Can wash out cement, damage C2d surface |
| Wet burlap (jutové plachty) | ✓ Preferred | Stable moisture, no surface damage |
| Plastic foil (geotextilie) | ✓ Good | Sealed moisture |
| Curing compounds (postřiky) | ✓ **Best pro C2d** | Single application, lasts 9 dní |
| Self-curing concrete | ✓ Available | Special admixture, no external action |

**Calculator gap:** Currently не selects curing method. Should ask user (or auto-suggest based on C2d requirement + temperature + project budget).

---

## Phase 4 — DOKA pricing architecture (NEW — критическая архитектурная находка)

### 4.1 Problem — calculator uses list prices for sorting

**Сейчас калькулятор делает:**
```
1. Calculate technical fit
2. Sort by LIST PRICE  ← BUG
3. Recommend cheapest
```

**Why это плохо:**

DOKA discount practice (industry):

| Tier | Discount | Customer profile |
|---|---|---|
| Standard | **0-15%** | Small contractor, ad-hoc rental |
| Volume | **15-40%** | Regular project flow |
| Strategic partner | **40-70%** | Long-term framework agreement |
| **Berger Bohemia level** | **68%** | Strategic partner (confirmed Alexander memory) |

**Discount applies per:**
- Volume-based (more dní rental = bigger %)
- Project-specific negotiations
- Frame agreement (annual contract)
- Competitive bidding pressure
- Long-term partnership

**Effect:** List price má **near-zero correlation** s actual cost pro real contractor.

### 4.2 Recommended new architecture

```
Step 1 — PRIMARY criterion: TECHNICAL FIT
  Filters from catalog:
    - Geometry compatibility (DOKA T-bednění diagram h × b)
    - Load capacity (DIN 18218 boční tlak)
    - Length suitability (T-bednění ≤100 bm, vozík >200 bm)
    - Pohledový quality (C2d requires specific system)
    - Element type (rimsa requires říms-specific)
  
  Result: 1-3 technically suitable systems

Step 2 — SECONDARY: SHOW BOTH PRICES
  For each suitable system display:
    - list_price_kc_bm_mes (катаlog price)
    - estimated_actual_price = list_price × (1 - user_discount_pct)
    - Где user_discount_pct берётся из:
      
      a) Default: 0% (no assumption made)
      
      b) User profile setting "DOKA partnership level":
         - "Standard customer" → typical 0-15%
         - "Volume customer" → typical 15-40%
         - "Strategic partner" → typical 40-70%
      
      c) Manual override "Actual project discount: __%"

Step 3 — RECOMMENDATION
  - Show all technically suitable options (1-3)
  - Display: technical fit reasoning + list price + estimated actual
  - User chooses based on их knowledge of actual contracts
  
NEVER:
  - Sort by price as primary criterion
  - Auto-select "cheapest" without showing technical fit
  - Hide list price (always show both)
```

### 4.3 New fields requirement

```
User profile / settings (organization-wide):
  - doka_partnership_level: enum {standard, volume, strategic, custom}
  - doka_typical_discount_pct: float (auto-set from level, override possible)
  - peri_partnership_level: enum
  - peri_typical_discount_pct: float
  - ulma_partnership_level: enum
  - ulma_typical_discount_pct: float

Per-project override:
  - actual_doka_discount_pct: float (if known from negotiation)
  - actual_peri_discount_pct: float
  - etc.

Calculator output for each formwork option:
  - list_price_total_kc: float
  - applied_discount_pct: float
  - estimated_actual_price_kc: float
  - technical_fit_score: float (0-100, primary ranking)
  - price_rank_secondary: int (after technical sort)
```

### 4.4 Acceptance criteria

- ✅ Calculator sorts by **technical fit primary**, price secondary
- ✅ Both list price + estimated actual visible
- ✅ User discount setting persists per organization
- ✅ Per-project override available
- ✅ Recommendation explains WHY (technical fit reasons), not just price
- ✅ "Cheapest" never appears as auto-recommendation without technical justification

---

## Phase 5 — Norma compliance audit

### 4.1 TKP 18 compliance check

| TKP 18 requirement | Calculator handles? |
|---|---|
| Max trhlina 0.2 mm na římsách | ❓ není ve výpočtu? |
| Curing class 4 mandatory pro nosné mostní | ✓ když explicit, default? |
| Sealed working joints | ❓ není option? |
| Provzdušněný beton pro mostní konstrukce | ❓ není option? |
| Min cover do výztuže (specific pro říms) | ❓ není field? |

### 4.2 Metodika MD ČR compliance

| Metodika requirement | Calculator handles? |
|---|---|
| Smršťovací spáry 6 m default | ✓ jako cycle_length_bm, ale není linkováno na metodiku |
| Pracovní spáry vs smršťovací — рaзлična terminology | ❌ není rozlišení |
| Návrh těsnění spár | ❌ není component |

### 4.3 ČSN EN 13670 compliance

| ČSN EN 13670 requirement | Calculator handles? |
|---|---|
| Min curing pro XF3/XF4 (7 dní floor) | ✓ exposure_floor_days |
| Strip strength check | ✓ maturity model |
| Vzduchové póry для freeze-thaw | ❌ není component |

---

## Phase 5 — Cross-check проти SO 206 reality

Реальные данные SO 206 (most na D6 km 4,720 SO 101 MÚK Žalmanov):

```yaml
SO_206_reality:
  num_rimsa: 2  (1 levá + 1 pravá)
  length_per_rimsa_bm: 35.026
  total_length_bm: 70.052
  total_volume_m3: 22.562
  concrete_class: C30/37
  exposure: XF4 + XD3
  rebar_class: B500B
  rebar_actual_kg: 3115  (138 kg/m³ skutečná)
  cycles_per_rimsa: 6×6m + 1×5.026m  (per Metodika MD + TKP 18)
  formwork_system_used: DOKA T-bednění  (по DOKA nabídce 540045359)
  rental_with_discount: 528 Kč/bm/měs (after 68% discount)
```

Audit: пройти калькулятор с этими параметрами, документировать каждое расхождение.

---

## Acceptance criteria

1. ✅ Markdown report со всеми found gaps
2. ✅ Field visibility audit table (для всех ~50 fields)
3. ✅ Formwork dropdown filter audit (что показывает vs что должно)
4. ✅ Triple unit problem documented с recommendation
5. ✅ 8 known + 6 new bugs verified с file:line references
6. ✅ TKP/Metodika/ČSN compliance gaps documented
7. ✅ SO 206 reality cross-check completed
8. ✅ Open questions list для Phase D implementation
9. ✅ Commit on branch claude/rimsa-calibration-phase-a
10. ✅ NO code changes, NO PR

---

## Output structure

```markdown
# Říms Calculator UX Audit Report — 2026-05-20

## Executive summary
- Total fields in UI: N
- Relevant for říms: N
- Irrelevant: N (should hide)
- Missing: N (need to add)
- Formwork options shown: N (correct: N, irrelevant: N)
- Bugs verified: 8 known + N new = N total

## Phase 1 — Field visibility
[detailed tables]

## Phase 2 — Unit conventions
[triple model analysis]

## Phase 3 — Behavior bugs
[verification matrix]

## Phase 4 — Norma compliance
[TKP/Metodika/ČSN gaps]

## Phase 5 — SO 206 cross-check
[reality vs calculator output]

## Open questions
[10-15 questions for user decision before Phase D]

## Recommendations for Phase D scope
[ordered list of fixes with priority]
```

---

## Naming rule

> Naming a strukturu souborů určuj podle existujících konvencí v repo.
> Audit output goes to: docs/audits/rimsa_fullstack/2026-05-20_phase_a_addendum_ux_audit.md

---

## Connect to other tasks

Этот task — **расширение Phase A** для říms calibration. Не заменяет TASK_Rimsa_Calibration_FullStack_v1.md, а дополняет его открытыми questions для Phase D scope.

После завершения:
1. User reviews UX audit report
2. Recommendations from Phase D scope informиrowed by audit
3. Phase D implementation начинается с уже-known acceptance criteria

---

**Author:** STAVAGENT říms UX deep audit, 2026-05-20

**Inputs:** TKP 18, Metodika MD ČR, DOKA katalog, ÚRS 317353191, OTSKP 317325,
Wikipedia Mostní římsa, Pokorný-Šertler Betonové mosty II, calculator behavior testing.
