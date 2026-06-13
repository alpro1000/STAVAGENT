# SO-202 D6 OV–Žalmanov (most přes Lomnický potok, km 1,600) — Golden Test Data

**Source:** TZ DSP + soupis XC4 DI-009, SO 202.
**Source documents in repo:** `test-data/SO_202_D6_OV_Z/` (TZ `202_01_TechnickaZprava.pdf`
+ výkresy 202_03…202_23 + soupis `E_Soupis praci_XC4_DI-009.xml`).
**TZ technology digest:** `test-data/SO_202_D6_OV_Z/202_01_TechnickaZprava_tz_facts.md`.
**Audit date:** 2026-06-13 (Part C — finál Fáze 1).
**Sister golden (template):** `test-data/tz/SO-202_D6_most_golden_test.md` (KV–OV).

> **⚠️ STOP-GATE STATUS:** INPUTY níže nesou plný provenance a jsou
> authoritative (VV ÷ 2 per most). VÝSTUPY enginu (num_tacts kromě, schedule,
> formwork, náklady, Nh) **NEJSOU zafixovány jako golden assertions** — per
> task se snímají až po ruční verifikaci Alexandra. Tento soubor je
> STOP-gate artefakt, ne hotový golden test. Replacement dočasné Žalmanov
> fixtury v `validation-rules.test.ts` čeká na approve.

---

## Provenance convention (Part A → C)

Každé číslo nese status: `[TZ §X]` / `[VV pos. NNNNNN]` (soupis XC4 DI-009,
SO-202 pod-strom) / `[CN]` / `[odhad]` (NOT authoritative) / `[task]`
(zadáno v task spec, čeká na výkres-confirmation).

---

## 0. Klíčový rozdíl od sesterského KV goldenu

| Aspekt | KV–OV (SO-202 KV) | OV–Ž (SO-202 Žalmanov) |
|---|---|---|
| Založení | **piloty** Ø900 (122 ks) | **plošné** — ZÁKLADY ŽB C30/37 `[VV 272325]` (žádné piloty v pod-stromu) |
| NK technologie | pevná skruž **1 takt** `[TZ §7.2]` | pevná skruž **3 etapy** `[TZ §4.1.6]` |
| NK beton | C35/45 dvoutrám | C40/50 trámová předpjatá `[VV 422336]` |
| Most | LM + PM (2 mosty) | LM + PM (2 mosty); pořadí LM → snos ev.č. 6-049 → PM `[TZ §5.1]` |

---

## 1. Stavba

- D6 OV–Žalmanov, SO 202 — **Most na D6 přes Lomnický potok v km 1,600** `[VV объект ~SO 202]`
- 2 samostatné mosty (LM + PM); VV-množství jsou pro OBA → **na 1 most = VV ÷ 2** `[§5i princip, STOP gate A]`
- Sekvence: výstavba LM → snos starého mostu ev.č. 6-049 → výstavba PM `[TZ §5.1]` (v etapách, ne v objemech)

## 2. Technologie výstavby NK — Part B/C fact

- **Technologie: PEVNÁ SKRUŽ ve TŘECH etapách** `[TZ §4.1.6, str. 11]`
  > „Výstavba nosné konstrukce se předpokládá na pevné skruži ve třech etapách.
  > Výstavba je uvažována ve směru od O1 k O4. Postup výstavby může budoucí
  > zhotovitel upravit dle svých možností a potřeb."
- Odskružení taktu až po napnutí všech kabelů v daném taktu `[TZ §4.1.6]`;
  injektáž po každém napínání `[TZ §4.1.6]`.
- **Regex-extrakce (Part C):** `extractConstructionTechnology()` čte z této
  věty `technology='fixed_scaffolding'` + `pour_stages_count=3` (confidence 1.0).
  Past „Most bude budován po etapách… dopravy" = dopravní etapy, NE takty —
  ošetřeno guardem (test `tz-text-extractor.test.ts`).

## 3. Authoritative VV quantities (soupis XC4 DI-009, pod-strom `~SO 202~*`)

> Extrahováno z `<stavDil id_stavdil="~SO 202~N">` → `<polozka>`. Množství
> jsou pro OBA mosty; per 1 most = ÷ 2 (`[§5i]`).

| OTSKP | Položka | MJ | Množství (oba) | Na 1 most | element_type |
|---|---|---|---|---|---|
| 272325 | Základy ze železobetonu C30/37 | m³ | 867.136 | **433.57** | `zaklady_piliru` |
| 272365 | Výztuž základů B500B | t | 129.877 | 64.94 | — |
| 333325 | Mostní opěry a křídla C30/37 | m³ | 557.851 | **278.93** | `opery_ulozne_prahy` / `kridla_opery` |
| 333365 | Výztuž opěr a křídel B500B | t | 64.164 | 32.08 | — |
| 334326 | Mostní pilíře a stativa C40/50 | m³ | 361.384 | **180.69** | `driky_piliru` (dva dříky/podpora) |
| 334365 | Výztuž pilířů B500B | t | 62.577 | 31.29 | — |
| 422336 | Mostní nosná **trámová** konstr. předpjatý beton C40/50 | m³ | 2697.941 | **1348.97** | `mostovkova_deska` |
| 422365 | Výztuž NK B500B | t | 468.886 | 234.44 | — |
| 420324 | Přechodové desky opěr C25/30 | m³ | 81.9 | **40.95** | `prechodova_deska` |
| 420365 | Výztuž přechodových desek | t | 12.348 | 6.17 | — |
| 317325 | Římsy ze železobetonu C30/37 | m³ | 266.328 | **133.16** | `rimsa` |
| 317365 | Výztuž říms B500B | t | 30.074 | 15.04 | — |
| 461314 | Patky z prostého betonu C25/30 | m³ | 12.733 | 6.37 | `podkladni_beton` |

> Pozn.: VV nerozpadá objemy na jednotlivé podpěry (O1…O4) — rozpad per-podpěra
> = `[odhad]` z výkresů (202_09 TvarOP1 / 202_11 TvarPiliru / 202_13 TvarOP4),
> kandidát na doplnění po ruční verifikaci. Kalotová ložiska 428741/2/763
> (16 ks oba mosty) + ev. lana Y1860 — předpínací výztuž samostatná položka
> (čeká na dohledání kódu v pod-stromu, viz §STOP-gate otázky).

## 4. NK — golden inputs (1 most; 3 etapy pevná skruž)

```
element_type            = mostovkova_deska
volume_m3               = 1348.97          [VV 422336 ÷ 2]
concrete_class          = C40/50           [VV 422336 "DO C40/50"]
exposure_class          = XF2              [TZ — pending §2 confirmation]
curing_class            = 4                [konvence: NK = třída 4]
bridge_deck_subtype     = dvoutram         [VV "TRÁM"; pending výkres 17 confirmation]
is_prestressed          = true             [VV 422336 "PŘEDPJ BET"]
construction_technology = fixed_scaffolding [TZ §4.1.6]
num_tacts_override      = 3                 [TZ §4.1.6 "ve třech etapách"]
tact_volumes            = [397.85, 553.26, 397.85]  [task 32/44.5/32 m × V/108.5; pending výkres confirmation]
rebar_mass_kg           = 234443           [VV 422365 ÷ 2 × 1000]
temperature_c           = 15               [konvence goldenů]
num_bridges             = NEZADÁNO         [§5i: golden modeluje 1 podobjekt; multi-bridge agregace úroveň výš]
```

**End-to-end engine smoke (2026-06-13, NEfixováno jako assertion):**
`tact_volumes` přijaty, `num_tacts=3`, technologie `fixed_scaffolding` =
3 etapy → validation rule **bez flagu** (vstup ≡ TZ, čisto ✓). `curing_days=9`
(třída 4). **FINDING (STOP gate):** bez `height_m` selektor vrátil
`MULTIFLEX` (pozemní stropní systém), ne falsework `Top 50` jako u KV —
mostovka potřebuje `height_m` pro správný výběr skruže; chování selektoru
(allow-list / fallback bez výšky) je engine-záležitost mimo scope Part C
(scheduler/selektor v exclusions), zaznamenáno k řešení.

## 5. num_bridges semantika (§5i)

VV ÷ 2 na podobjekt; harmonogram sekvenční se **sdílenou sadou skruže**
(zdroj se sdílí, objemy se dělí). Engine multi-bridge větev
(`num_bridges≥2`) dělí volume jako součet OBOU mostů → golden modeluje
JEDEN most (`num_bridges` nezadáno). Rozpor engine vs MCP docstring
(per-bridge) zůstává **known open item** — řešen pravidlem etalonu, ne
úpravou enginu v tomto PR.

## STOP-gate otázky pro Alexandra (před fixací výstupů)

1. **NK subtype:** VV říká „TRÁMOVÁ" (422336) — dvoutrám / vícetrám?
   (KV byl dvoutrám). Pending výkres 202_17 TvarNK.
2. **tact_volumes 32/44.5/32:** z task spec — potvrdit proti výkresu 202_04
   PodelnyRez / 202_17 (rozpětí polí).
3. **NK exposure:** XF2 převzato z KV konvence — potvrdit z TZ §2 Žalmanov.
4. **Předpínací lana:** položka Y1860 nebyla v pod-stromu `~SO 202~*`
   identifikována pod 422xxx — dohledat kód (jinde namespace?) nebo odhad
   z počtu kabelů.
5. **height_m NK** (pro správný výběr skruže) — z výkresu (výška nad terénem).
6. Po odpovědích → snímek VŠECH pozic živým enginem → fix golden assertions
   + nahrazení dočasné Žalmanov fixtury v `validation-rules.test.ts`.
