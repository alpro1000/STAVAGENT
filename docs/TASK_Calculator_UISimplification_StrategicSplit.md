# ZADÁNÍ: UI zjednodušení — expert logika do AI/MCP, ruční vstup jednoduchý

**Priorita:** CRITICAL (produktová strategie)
**Oblast:** Monolit Planner — kalkulátor UI + MCP tool schemas
**Strategický kontext:** Product split rozhodnutí 16.04.2026

---

## KONTEXT — STRATEGICKÉ ROZHODNUTÍ

Kalkulátor má dva režimy použití:

**Ruční vstup na webu (mainstream):**
- 90% uživatelů = rozpočtář "bjudžetník"
- Chce: výsledek rychle, bez doménové expertízy
- Vstup: typ + objem + beton → harmonogram + cena
- NESMÍ vidět: exposure_class, curing_class, num_cables dropdown s 8 možnostmi

**AI režim (expert):**
- ChatGPT/Claude přes MCP, nebo SmartInput na webu
- LLM má kompletní znalost TKP18, ČSN EN 206, všech parametrů
- Spočítá s expert-level parametry automaticky
- Uživatel jen nahraje TZ / popíše objekt

**Princip:** Složitost žije v AI prompt a MCP schemas, NE v UI formy.

---

## PROBLÉM

Aktuální UI kalkulátoru požaduje od uživatele rozhodnutí o:
- exposure_class (XC1, XC2, XC3, XC4, XD1, XD2, XD3, XF1, XF2, XF3, XF4, XA1, XA2, XA3)
- curing_class (2/3/4/auto) — po Section 1 fix
- num_cables (pro předpjaté)
- stressing_type
- bridge_deck_subtype
- construction_technology
- num_bridges
- span_m, num_spans, nk_width_m

Toto je **overengineering pro 90% použití**. Rozpočtář bez mostní expertízy:
- Nevybere správný exposure (není si jist XF2 vs XF4)
- Nevybere správný curing_class (neví o TKP18 §7.8.3)
- Pugá se dropdownů a odchází k Excelu

Zároveň v AI režimu přes MCP LLM potřebuje VŠECHNY tyto parametry s přesnými
pravidly — ale tam jsou ok, LLM to zvládne.

---

## ŘEŠENÍ — tři vrstvy UI

### Vrstva 1: Rychlý odhad (default, 90% uživatelů)

```
┌────────────────────────────────────────────┐
│ Typ konstrukce:   [Mostovková deska ▼]    │
│ Objem:            [605] m³                 │
│ Třída betonu:     [C35/45] (doporučeno)   │
│                                            │
│           [Spočítat harmonogram]           │
└────────────────────────────────────────────┘

Všechno ostatní = smart defaults:
- exposure_class: z element_type typical mapping
- curing_class: z element_type (mostovka=4, etc.)
- is_prestressed: false (ale warning při mostovka)
- temperature: 15°C default
```

### Vrstva 2: Standardní nastavení (collapsible)

```
▼ Standardní nastavení
  ┌────────────────────────────────────────┐
  │ Teplota betonáže:  [15]°C              │
  │ Výška prvku:       [—] m (vertical)    │
  │ Plocha bednění:    [auto] m²           │
  │ Předpjatý:         [☐]                 │
  └────────────────────────────────────────┘
```

### Vrstva 3: Expertní parametry (collapsible, default: skryté)

```
▼ Expertní parametry
  ┌────────────────────────────────────────┐
  │ Exposure class:   [XF2] (auto)         │
  │ Curing class:     [4] (auto dle TKP18) │
  │ Počet kabelů:     [—]                  │
  │ Typ napínání:     [jednostranné ▼]     │
  │ Rozpětí:          [—] m                │
  │ Počet polí:       [—]                  │
  │ Počet mostů:      [1]                  │
  │ Technologie:      [auto]               │
  └────────────────────────────────────────┘
```

---

## SMART DEFAULTS MAPPING

Pro každý element_type definovat typické hodnoty:

```
mostovkova_deska:
  exposure_class: XF2 (default)
  curing_class: 4
  typical_concrete: C35/45
  typical_height_above_terrain: 5-10m

rimsa:
  exposure_class: XF4
  curing_class: 4
  typical_concrete: C30/37

driky_piliru:
  exposure_class: XF4 (v zóně rozstřiku) — uživatel změní pokud P4 (XF2)
  curing_class: 3
  typical_concrete: C35/45

opery_ulozne_prahy:
  exposure_class: XF4
  curing_class: 3
  typical_concrete: C30/37

pilota:
  exposure_class: XA2 (pod HPV) nebo XC2 (nad HPV)
  curing_class: 3
  typical_concrete: C30/37
  rebar_index: 90 kg/m³ (mostní Ø≥800) / 40 kg/m³ (pozemní)

zaklady_piliru:
  exposure_class: XF1
  curing_class: 3
  typical_concrete: C25/30
  rebar_index: 120 kg/m³

stena:
  exposure_class: XC2 (vnitřní) / XC4 (venkovní)
  curing_class: 2
  typical_concrete: C25/30

deska:
  exposure_class: XC1 (vnitřní strop)
  curing_class: 2
  typical_concrete: C25/30

# ... pro všech 22 typů
```

**Pravidlo:** Uživatel vidí pouze default. Pokud je v projektu specifická
hodnota (např. pilíř P4 s XF2 místo XF4), uživatel ji nastaví v Expertním panelu.

---

## ARCHITEKTONICKÉ ROZHODNUTÍ

### Co zůstává v UI

Pouze parametry které uživatel **reálně musí zadat**:
- element_type (co to je)
- volume_m3 nebo dimensions (kolik toho je)
- concrete_class (může přebít default)
- temperature_c (default 15°C)
- height_m (pro vertical prvky)

**Vše ostatní** = smart defaults viditelné v "Expertní".

### Co jde do AI/MCP

Veškerá doménová logika:
- Pravidla TKP18 pro curing_class
- Mapping exposure_class per element_type + polohy
- Pravidla prestressingu (wait + stressing + grouting)
- Doporučení technologie (pevná/MSS/letmá)
- Edge cases (P4 bez rozstřiku, plovoucí piloty, atd.)

**MCP tool schemas** = kompletní expert knowledge base.
**AI prompt** = instructions jak aplikovat pravidla.
**UI** = minimální input.

---

## ACCEPTANCE CRITERIA

### UI simplification (8 kritérií)
1. Formulář kalkulátoru má 3 vrstvy: Rychlý / Standardní / Expertní
2. Default: zobrazena jen Rychlá vrstva
3. Rychlá vrstva má maximálně 5 polí
4. Standardní panel collapsible, default zavřený
5. Expertní panel collapsible, default zavřený
6. Smart defaults per element_type aplikovány automaticky
7. Badge "(auto)" vedle každého smart default pole
8. Uživatel může kliknout na (auto) a zadat vlastní hodnotu

### Zachování správnosti (5 kritérií)
9. Engine dostává VŠECHNY parametry správně (smart defaults + override)
10. Pro mostovku automaticky curing_class=4
11. Pro mostní prvky v zóně rozstřiku automaticky XF4
12. Pro pilotu automaticky rebar_index=90 kg/m³ pro Ø≥800mm
13. Harmonogram výsledků je identický jako by uživatel zadal vše ručně

### MCP enrichment (4 kritéria)
14. MCP tool schemas obsahují plná pravidla smart defaults
15. ChatGPT/Claude přes MCP dostává kompletní expert knowledge
16. AI režim: všechny parametry explicitní (ne skryté za defaulty)
17. UI režim: parametry skryté za collapsible, ale engine je dostává

### Regrese (3 kritéria)
18. 762+ testů zelené
19. Existující pozice (SO-202 golden test) vrací stejný výsledek
20. Backwards compatibility pro URL parametry (position prefill z Registry)

---

## CO NEPATŘÍ DO TOHOTO TASKU

- ❌ Odstranění Expert panelu — expert rozpočtáři ho potřebují
- ❌ Změna engine logiky — jen UI layer
- ❌ Nové element types
- ❌ Wizard krok 1b pro mostovku — UTĚKEJME od přidávání kroků!
- ❌ Bulk pilota input v UI — toto je pro MCP/SmartInput
- ❌ SmartInput pipeline (je to jiný task)

---

## DŮSLEDEK PRO BACKLOG

Tento task RUŠÍ nebo MĚNÍ scope následujících:

| Původní task | Nový stav |
|---|---|
| TASK_MostovkaCriticalBugs BUG 3 (Wizard krok 1b) | ZRUŠENO. Mostní parametry v Expert panelu bez kroku. |
| TASK_ExposureAndRebarDefaults BUG 7 (L/W/H pro dříky) | ZRUŠENO. Uživatel zadá objem v Rychlé vrstvě. |
| TASK_ExposureAndRebarDefaults BUG 8 (Bulk pilota) | PŘESUNUTO do SmartInput (AI režim). |
| TASK_ExposureAndRebarDefaults BUG 11 (Catalog gap) | ZRUŠENO pro podlozkovy_blok. Ponecháno pro podkladni_beton. |

Tyto taskem neovlivněné:
- TASK_MostovkaCriticalBugs BUG 1,2 (curing class) ✅ DONE
- TASK_MostovkaCriticalBugs BUG 4 (předpětí formula) — engine change, zůstává
- TASK_MostovkaCriticalBugs BUG 5,6,7 — quick fixes, zůstávají
- TASK_ExposureAndRebarDefaults BUG 1,2,3,4,5,9,10,12 — quick data fixes
- TASK_MCP_SchemaEnrichment_GoldenValidation — CRITICAL, expert logika
- TASK_SmartInput_DocumentBridge — CRITICAL, document extraction

---

## STRATEGICKÝ DŮSLEDEK

Kalkulátor se stává:

**PRO RUČNÍ VSTUP (web):**
- Jednoduchý, rychlý, 5-pole formulář
- 90% uživatelů spokojených
- Competitive vs. Excel

**PRO AI REŽIM (MCP + SmartInput):**
- Expert-level parametry k dispozici
- TKP18 compliance garantované
- Batch processing přes nahrání TZ
- Vhodný pro mostaře, projektanty, auditory

**Tato dualita = produktový moat.** Žádný konkurent nemá obojí.

---

Naming a strukturu souborů určuj dle existujících konvencí.
Expertní panel = rozšíření showAdvanced (existující) na víc parametrů.
Smart defaults = nová funkce getSmartDefaults(element_type) → partial FormState.
