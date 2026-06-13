# SO-202 D6 OV–Žalmanov (most přes Lomnický potok, km 1,600) — Golden Test Data

**Source:** TZ DSP + soupis XC4 DI-009, SO 202.
**Source documents in repo:** `test-data/SO_202_D6_OV_Z/` (TZ `202_01_TechnickaZprava.pdf`
+ výkresy 202_03…202_23 + soupis `E_Soupis praci_XC4_DI-009.xml`).
**TZ technology digest:** `test-data/SO_202_D6_OV_Z/202_01_TechnickaZprava_tz_facts.md`.
**Audit date:** 2026-06-13 (Part C — finál Fáze 1).
**Sister golden (template):** `test-data/tz/SO-202_D6_most_golden_test.md` (KV–OV).

> **⚠️ STOP-GATE STATUS:** INPUTY nesou provenance; VÝSTUPY enginu **NEJSOU
> zafixovány jako golden assertions** — snímají se až po ruční verifikaci
> Alexandra. Tento soubor je STOP-gate artefakt. Náhrada dočasné Žalmanov
> fixtury v `validation-rules.test.ts` čeká na approve.
>
> **ŽÁDNÉ číslo NENÍ zděděno z KV** — vše z dokumentů Žalmanov (test-data/SO_202_D6_OV_Z).

---

## Provenance convention

`[TZ §X]` / `[VV pos. NNNNNN]` (soupis XC4 DI-009, pod-strom `~SO 202~N`) /
`[výkres NNN]` / `[CN]` / `[odhad]` (NOT authoritative) / `[task]` /
`[PENDING]` (zdroj zatím nečitelný — výkres bez textové vrstvy → STOP otázka).

---

## 0. Klíčový rozdíl od sesterského KV goldenu (NEdědit čísla!)

| Aspekt | KV–OV (SO-202 KV) | OV–Ž (SO-202 Žalmanov) |
|---|---|---|
| Založení | **piloty** Ø900 (122 ks) | **plošné** — ZÁKLADY ŽB C30/37 `[VV 272325]` (žádné piloty v pod-stromu) |
| NK technologie | pevná skruž **1 takt** `[TZ §7.2]` | pevná skruž **3 etapy** `[TZ §4.1.6]` |
| NK beton | C35/45 XF2 dvoutrám | C35/45 XF2 dvoutrám `[TZ §2]` (VV kód „DO C40/50" = cenové pásmo, Pattern 53) |
| NK trám výška | trám **1100 mm**, koncový příčník 950 `[výkres KV příčný řez NK]` | trám **2400 mm nad podporou**, š. 13.65 `[výkres 202_17 příčný řez osou uložení]` |
| NK rozpětí | 15+4×20+15 (max pole 20) | **32 + 44.5 + 32** (3 pole) `[task; PENDING výkres potvrzení]` |
| NK objem / most | 693.35 m³ `[VV÷2]` | **1348.97 m³** `[VV 422336: 2697.941 ÷ 2]` |
| Předpínací lana / most | 19.21 t `[VV÷2]` | **41.42 t** `[VV 422373: 82.84 ÷ 2]` |

> Naglядná lekce provenance: trám KV 1.1 m (pole 20 m) vs Žalmanov 2.4 m
> nad podporou (pole 44.5 m) — výška roste s rozpětím; čísla se NEdědí.

---

## 1. Stavba

- D6 OV–Žalmanov, SO 202 — **Most na D6 přes Lomnický potok v km 1,600** `[VV objekt ~SO 202]`
- 2 samostatné mosty (LM + PM); VV pro OBA → **na 1 most = VV ÷ 2** `[§5i, STOP gate A]`
- Sekvence: LM → snos starého ev.č. 6-049 → PM `[TZ §5.1]` (v etapách, ne v objemech)

## 2. Betony + exposure dle TZ §2 (Žalmanov, verbatim)

> `[TZ §2, str. ~ řádek 661-671 pdftotext]`

| Prvek | Beton-exposure (TZ §2) | element_type | Pozn. |
|---|---|---|---|
| Základy | C30/37-XF1+XA2+XC2 | `zaklady_piliru` | plošné |
| Dříky pilířů | C35/45-XF1+XD1+XC4 | `driky_piliru` | VV kód 334326 „DO C40/50" = pásmo (Pattern 53); skutečně **C35/45** |
| Opěry | C30/37-XF4+XD3+XC4 | `opery_ulozne_prahy` | |
| Úložné prahy, záv. zdi, křídla | C30/37-XF4+XD3+XC4 | `kridla_opery` | |
| **Nosná konstrukce** | **C35/45-XF2+XD1+XC4** | `mostovkova_deska` | primary exposure **XF2** (ne XF4!) |
| Římsy | C30/37-XF4+XD3+XC4 | `rimsa` | |

## 3. Technologie výstavby NK — Part B/C fact

- **PEVNÁ SKRUŽ ve TŘECH etapách** `[TZ §4.1.6, str. 11]`:
  > „Výstavba nosné konstrukce se předpokládá na pevné skruži ve třech etapách.
  > Výstavba je uvažována ve směru od O1 k O4. Postup výstavby může budoucí
  > zhotovitel upravit dle svých možností a potřeb."
- Odskružení taktu až po napnutí všech kabelů; injektáž po každém napínání `[TZ §4.1.6]`.
- **Regex-extrakce (Part C):** `extractConstructionTechnology()` → `fixed_scaffolding`
  + `pour_stages_count=3` (conf 1.0). Past „po etapách… dopravy" ošetřena.

## 4. Authoritative VV quantities (pod-strom `~SO 202~N`)

| OTSKP | Položka | MJ | Množství (oba) | Na 1 most | Provenance |
|---|---|---|---|---|---|
| 272325 | Základy ze ŽB C30/37 | m³ | 867.136 | **433.57** | `[VV 272325 ÷2]` |
| 272365 | Výztuž základů B500B | t | 129.877 | 64.94 | `[VV 272365 ÷2]` |
| 333325 | Mostní opěry+křídla C30/37 | m³ | 557.851 | **278.93** | `[VV 333325 ÷2]` |
| 333365 | Výztuž opěr+křídel B500B | t | 64.164 | 32.08 | `[VV 333365 ÷2]` |
| 334326 | Mostní pilíře C40/50¹ | m³ | 361.384 | **180.69** | `[VV 334326 ÷2]` ¹kód-pásmo; beton C35/45 `[TZ §2]` |
| 334365 | Výztuž pilířů B500B | t | 62.577 | 31.29 | `[VV 334365 ÷2]` |
| 422336 | NK trámová předpjatá C40/50¹ | m³ | 2697.941 | **1348.97** | `[VV 422336 ÷2]` ¹kód-pásmo; beton C35/45 `[TZ §2]` |
| 422365 | Výztuž NK B500B | t | 468.886 | 234.44 | `[VV 422365 ÷2]` |
| **422373** | **Výztuž NK PŘEDPÍNACÍ (lana)** | t | **82.84** | **41.42** | `[VV 422373 ÷2]` |
| 420324 | Přechodové desky C25/30 | m³ | 81.9 | **40.95** | `[VV 420324 ÷2]` |
| 420365 | Výztuž přech. desek | t | 12.348 | 6.17 | `[VV 420365 ÷2]` |
| 317325 | Římsy ŽB C30/37 | m³ | 266.328 | **133.16** | `[VV 317325 ÷2]` |
| 317365 | Výztuž říms B500B | t | 30.074 | 15.04 | `[VV 317365 ÷2]` |
| 461314 | Patky prostý beton C25/30 | m³ | 12.733 | 6.37 | `[VV 461314 ÷2]` |

> Kalotová ložiska 428741/2/763 = 16 ks (oba). Rozpad objemů per-podpěra
> (O1…O4) VV nedává → `[odhad z výkresů]`, kandidát na doplnění.

## 5. NK — golden inputs (1 most; 3 etapy pevná skruž)

```
element_type            = mostovkova_deska
volume_m3               = 1348.97          [VV 422336 ÷2]
concrete_class          = C35/45           [TZ §2 — NE C40/50; kód-pásmo Pattern 53]
exposure_class          = XF2              [TZ §2: NK C35/45-XF2+XD1+XC4, primary XF2]
curing_class            = 4                [konvence: NK = třída 4]
bridge_deck_subtype     = dvoutram         [výkres 202_17 příčný řez osou uložení]
nk_width_m              = 13.65            [výkres 202_17]
trám výška nad podporou = 2.40 m           [výkres 202_17] (profil v poli: PENDING — viz §STOP)
is_prestressed          = true             [VV 422336 „PŘEDPJ BET"]
construction_technology = fixed_scaffolding [TZ §4.1.6]
num_tacts_override      = 3                 [TZ §4.1.6 „ve třech etapách"]
tact_volumes            = [397.85, 553.26, 397.85]  [pro-rata délek 32/44.5/32; PENDING profil trámu]
rebar_mass_kg           = 234443           [VV 422365 ÷2 ×1000]  (~173.8 kg/m³)
prestress strands       = 41.42 t          [VV 422373 ÷2]
height_m (nad terénem)  = PENDING          [výkres pohled — nečitelný textem; STOP otázka]
temperature_c           = 15               [konvence]
num_bridges             = NEZADÁNO         [§5i: golden modeluje 1 podobjekt]
```

**End-to-end engine smoke (2026-06-13, NEfixováno jako assertion):**

| Pozice (1 most) | formwork | num_tacts | curing | total_days | pozn. |
|---|---|---|---|---|---|
| NK (height PENDING / test 8 m) | MULTIFLEX / **Top 50** | 3 | 9 | 185.9 | validation flag **NONE** (vstup ≡ TZ ✓); bez výšky → špatný systém (finding) |
| Základy plošné | Frami Xlife | 4 | 5 | 34.6 | |
| Opěry+křídla | TRIO | 3 | 7 | 16.1 | XF4 |
| Dříky pilířů | VARIO GT 24 | 2 | 5 | 14.1 | C35/45 |
| Přechodové desky | Frami Xlife | 1 | 5 | 7.1 | |
| Římsy | Římsové bednění T | 2 | 9 | 42.0 | bm |
| Podkladní/patky | — | — | — | — | engine throw `mass_t must be positive` (rebar=0) → finding |

- Σ tact_volumes = **1348.96** ≈ VV÷2 1348.97 ✓
- Pattern 52 sanity: přív. tloušťka 1348.97/(108.5×13.65)=**0.911 m**; pole 44.5 → **L/48.8** — v koridoru L/35–L/50 ✓
- **FINDING 1 (backlog):** bez `height_m` selektor → MULTIFLEX (pozemní); s výškou → Top 50 falsework. Selektor allow-list/fallback bez výšky = engine, mimo scope Part C.
- **FINDING 2 (backlog):** `podkladni_beton` (rebar=0) → `calculateRebar` throw `mass_t must be positive`; rebar-lite negarduje nulu.

## 6. num_bridges semantika (§5i)

VV ÷ 2 na podobjekt; harmonogram sekvenční se sdílenou sadou skruže.
Engine multi-bridge větev dělí volume jako součet OBOU → golden modeluje
1 most (`num_bridges` nezadáno). Rozpor engine vs MCP docstring = known
open item, řešen pravidlem etalonu, ne úpravou enginu.

## STOP-gate otázky pro Alexandra (PŘED fixací výstupů)

**RESOLVED v této iteraci** (z dokumentů Žalmanov, NE z KV):
- ✅ NK subtype = dvoutrám, š. 13.65, trám 2400 nad podporou `[výkres 202_17]`
- ✅ NK exposure = XF2 (C35/45-XF2+XD1+XC4) `[TZ §2]` — NE C40/50, NE XF4
- ✅ Předpínací lana = 41.42 t/most `[VV 422373 ÷2]` (nalezeno ve VV, ne odhad)

**OTEVŘENÉ (zdroj nečitelný textem → nehádám):**
1. **Profil výšky trámu** — výkres 202_04/202_17 bez textové vrstvy. 2400 je
   „nad podporou" (osou uložení). Je trám konstantní 2400 nebo náběhový
   (nižší v poli)? Ovlivní tact_volumes (střední takt 44.5 m): konstantní →
   pro-rata délek OK; náběhový → střední takt těžší. **Dej hodnotu nebo
   potvrď pro-rata.**
2. **height_m NK nad terénem** — výkres pohled, nečitelný textem. Bez něj
   selektor vrací MULTIFLEX. **Dej výšku** (pak engine → Top 50/Staxo).

Po odpovědích → snímek VŠECH pozic živým enginem → fix golden assertions +
náhrada dočasné Žalmanov fixtury v `validation-rules.test.ts`. PR po approve.
