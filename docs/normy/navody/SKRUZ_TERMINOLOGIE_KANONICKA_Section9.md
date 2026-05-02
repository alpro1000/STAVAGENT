# Sekce 9 — Sub-taxonomie bednění a 3-vrstvý stack pro mostovky

**Tato sekce je doplnění SKRUZ_TERMINOLOGIE_KANONICKA.md.**
**Přidána: 2026-04-29 na základě DOKA Xpress 2/2020, asb-portal references, DOKA User Information Top 50, PERI VARIOKIT katalogy a uživatelské domain expertise.**

V sekci 7 TL;DR jsme řekli „Top 50 je bednění, ne skruž". To je správně, ale neúplné. Reálná taxonomie bednění má 3 sub-kategorie, a v mostním stavebnictví funguje 3-vrstvý stack který je nutno správně klasifikovat v kódu.

---

## 9.1 Sub-taxonomie bednění (formwork)

DOKA, PERI a ostatní výrobci rozdělují svá bednění do 3 hlavních sub-kategorií:

```
BEDNĚNÍ (formwork) — kontaktní povrch betonu
│
├── RÁMOVÉ (panel-based, fixed grid)
│   │   Charakteristika: rychlé, sériové, raster 15 cm,
│   │   plug-and-play, pro typové stěny a opěry,
│   │   ekonomické při sériové aplikaci.
│   │
│   ├── DOKA: Frami Xlife    → základy, malé stěny <3 m
│   ├── DOKA: Framax Xlife   → typové stěny, opěry, podpěrné zdi
│   ├── DOKA: Alu-Framax     → Framax z hliníku, lehčí varianta
│   ├── DOKA: Domino         → speciální geometrie (kruhové, rohové)
│   ├── PERI:  TRIO          → ekvivalent Framax Xlife
│   └── PERI:  DUO            → lehká rámová, ekvivalent Frami
│
├── NOSNÍKOVÉ (beam-supported, custom)
│   │   Charakteristika: tailor-made, projektově navrhované,
│   │   nosníky H20 + ocelové ригели + palba (fanера/ocel),
│   │   pro custom geometrie, mostovky, vysoké stěny,
│   │   integrace s těžkou skruží.
│   │
│   ├── DOKA: Top 50              → velkoplošné, mostovka, vysoké stěny
│   ├── DOKA: Top 50 Cornice      → římsy mostů (specializace Top 50)
│   ├── DOKA: Top 50 RS           → ronde stěny (kruhové)
│   └── PERI:  VARIO GT 24        → ekvivalent Top 50, GT 24 nosníky
│
└── STROPNÍ / TABLOVACÍ (slab/table)
    │   Charakteristika: pro vodorovné stropy budov,
    │   ne pro mostovky (mostovky používají Top 50 + skruž!),
    │   integruje stojky jako součást systému.
    │
    ├── DOKA: Dokaflex 20         → stropní desky budov, h ≤ 5 m
    ├── DOKA: Dokaflex Tablex     → stropní tablovací (přesouvané)
    ├── DOKA: Skydeck             → modulární panel stropní
    ├── PERI:  MULTIFLEX          → ekvivalent Dokaflex
    └── PERI:  SKYDECK            → modulární panel
```

### Kdy které sub-kategorie použít

| Situace | Volba | Důvod |
|---|---|---|
| Typová stěna, rovná, opakující se | Rámové (Framax/TRIO) | Rychlost, ekonomika sériové aplikace |
| Mostovka, sloupy custom, vysoké stěny | Nosníkové (Top 50/VARIO) | Custom geometrie, integrace se skruží |
| Strop budovy | Stropní (Dokaflex/MULTIFLEX) | Stojky integrované, h ≤ 5 m |
| Mostovka stropní systém | **NIKDY** | Stropní systémy nezvládnou mostní zatížení |

**Důležité:** Mostovka NEPOUŽÍVÁ stropní systémy (Dokaflex, MULTIFLEX, Skydeck). Mostovka používá **nosníkové bednění** (Top 50) **na skruži** (Staxo 100). Toto rozlišení je kritické a v kódu kalkulátoru je již implementováno přes `applicable_element_types` allow-list (verified ve v4.21.0 Re-Snapshot SO-202/SO-203 golden specs).

---

## 9.2 3-vrstvý stack pro mostovku (canonical)

Mostovka v praxi je sestava 3 vrstev. **Calculator musí klasifikovat KAŽDOU vrstvu zvlášť**, ne sloučit do jedné položky.

```
┌─────────────────────────────────────────────────┐
│ VRSTVA 1: BEDNĚNÍ (kontaktní povrch betonu)     │
│   Top 50 / VARIO GT 24                          │
│   pour_role: 'formwork'                         │
│   formwork_subtype: 'nosnikove'                 │
│   Funkce: tvar betonu, povrch                   │
└─────────────────────────────────────────────────┘
                       ▲
                       │ vynesené na
                       ▼
┌─────────────────────────────────────────────────┐
│ VRSTVA 2: NOSNÉ NOSNÍKY (horizontální)          │
│   Top 50 H20 + ocelové ригели                   │
│   VARIOKIT HD 200 / VRB                         │
│   pour_role: 'formwork_beam' (nový enum)        │
│      NEBO součást Vrstvy 1 (DOKA accessory)     │
│   Funkce: rozložení zatížení z bednění          │
│           do skruže                             │
└─────────────────────────────────────────────────┘
                       ▲
                       │ vynesené na
                       ▼
┌─────────────────────────────────────────────────┐
│ VRSTVA 3: PODPĚRNÁ KONSTRUKCE (svislá)          │
│                                                 │
│   STOJKY (lehké, <50 kN/noha):                  │
│     Staxo 40 / MULTIPROP                        │
│     pour_role: 'props'                          │
│     Použití: stropy budov, NE mostovky          │
│                                                 │
│   SKRUŽ (těžké, 50-100+ kN/noha):               │
│     Staxo 100 / UniKit / VARIOKIT VST           │
│     pour_role: 'falsework' (skruž)              │
│     Statický návrh od výrobce nutný             │
│     Použití: mostovky, demolice, těžké          │
│                                                 │
└─────────────────────────────────────────────────┘
                       ▲
                       │ stojící na
                       ▼
                  Pevný terén / podloží
                  (statický posudek únosnosti)
```

### Klíčové pravidlo: Top 50 patří do Vrstvy 1, ne do Vrstvy 2 nebo 3

V současném kódu (commit `ff47400` před opravou Gap #8) je Top 50 klasifikován jako `pour_role: 'falsework'`. **To je špatně** — stejně jako kdyby fasádní omítka byla klasifikována jako nosná zeď. Top 50 je **kontaktní povrch betonu** (Vrstva 1), ne **nosný systém** (Vrstva 3).

VARIOKIT HD 200 je trochu složitější — je to horizontální nosník (Vrstva 2), který se používá NAD skruží VST jako přemostění. V terminologii canonical doc je to spíš `formwork_beam` než `formwork` per se. V kódu by se to mohlo vyřešit buď:

- **Variant A**: pour_role: 'formwork' + accessory_type: 'beam'
- **Variant B**: nový enum value pour_role: 'formwork_beam'
- **Variant C**: nový atribut layer: 1 | 2 | 3 + pour_role role-specific

Konkrétní volba je rozhodnutí pro Gate 2 implementation. Tato sekce jen fixuje **kanonický fakt že Top 50 a VARIOKIT HD 200 jsou různé vrstvy** a obě jsou různé od `falsework` (Vrstva 3).

---

## 9.3 Přesný DOKA / PERI mapping per vrstva

| Vrstva | DOKA (mostovka) | PERI (mostovka) | Funkce |
|---|---|---|---|
| **1: Bednění** | Top 50 (rovné), Top 50 Cornice (římsy), Top 50 RS (ronde) | VARIO GT 24 | Kontaktní povrch betonu |
| **2: Nosníky horizontální** | Top 50 H20 + ocelové ригели (jako accessory Top 50) | VARIOKIT HD 200 / VRB | Rozložení zatížení do skruže |
| **3a: Stojky (lehké)** | Staxo 40 + Dokaflex 20 (NE pro mostovku) | MULTIPROP + MRK rám (NE pro mostovku) | Stropy budov, lehké stěny |
| **3b: Skruž (těžké)** | Staxo 100, UniKit, MSS (DOKA + Berd) | VARIOKIT VST, VARIOKIT MSS | Mostovky, demolice |

### Reference projekty z DOKA Xpress

- **D6 Karlovy Vary SO-202** (golden test): Top 50 + Staxo 100 (pevná skruž) — kanonický stack
- **Obchvat Krnova** (DOKA Xpress): UniKit + Top 50 — heavy-duty stack
- **3 mostní stavby** (DOKA Xpress 2/2020): Staxo 100 + Top 50 — typický stack

### Reference projekty z PERI

- VARIOKIT VST + VRB nosníky + VARIO GT 24 bednění — typická PERI mostovka
- VARIOKIT MSS — výsuvná skruž pro dlouhé mosty

---

## 9.4 Výhody a nevýhody Top 50 vs Framax v mostech

Tato sekce je důležitá pro **calculator decision logic** — kdy doporučit které.

### Top 50 (nosníkové) — výhody v mostech

1. **Custom geometrie** — tailor-made pod konkrétní projekt, sloupy a opěry s nestandardním tvarem
2. **Integrace se skruží** — DOKA Xpress doporučuje Top 50 + Staxo 100 jako standardní mostní stack
3. **Velkoplošné** — pro mostovky a velké stěny je efektivnější než typové panely
4. **Kombinovatelné s Framax** — v jedné stavbě lze používat Framax pro typové stěny + Top 50 pro custom části

### Top 50 — nevýhody

1. **Pomalejší montáž** než Framax (custom assembly vs plug-and-play)
2. **Více projektové přípravy** (pre-assembly, custom design)
3. **Méně výhodné pro malé typové prvky** (malé opěry, podpěrné zdi)
4. **Vyšší trudoemkost** na typových stěnách

### Framax Xlife (rámové) — výhody v mostech

1. **Rychlost** — „lightning-fast assembly" (DOKA), úspora ~33% času na montáž/demontáž
2. **Jednoduchá logistika** — málo různých panelů, jasná raster grid
3. **Plug-and-play** — méně inženýrské přípravy
4. **Ekonomické na typových stěnách** — opěry, podpěrné zdi, parapety

### Framax — nevýhody pro mostovku

1. **NEPOUŽITELNÉ pro mostovku** — fixed grid 15 cm nezvládne custom geometrie
2. **Limitovaná výška** — typicky <6 m bez zvláštních opatření
3. **Nemůže se kombinovat se skruží** — Framax je samostatný stěnový systém

### Calculator decision rule

```
if element_type in [mostovkova_deska, mostovka_nosnik]:
    formwork = Top 50 (nosníkové)  # always
elif element_type in [opery_ulozne_prahy, podporne_zdi] and complexity == 'typical':
    formwork = Framax Xlife (rámové)  # economic
elif element_type in [opery_ulozne_prahy, podporne_zdi] and complexity == 'custom':
    formwork = Top 50 (nosníkové)  # custom geometry needs
elif element_type in [zaklady_piliru, zakladove_pasy]:
    formwork = Frami Xlife (rámové, lehké)  # small horizontal
elif element_type in [stropy_pozemnich_staveb]:
    formwork = Dokaflex 20 (stropní)  # NOT mostovka!
else:
    fallback = Framax Xlife (default for typical)
```

Tato decision logika je **draft pro Gate 2 implementation** a bude detailně rozpracována v tech cards Phase 2.

---

## 9.5 Konsekvence pro Gap #8 fix v Gate 2

S touto rozšířenou taxonomií se Gate 2 fix Gap #8 stává multi-layer refactor:

### Pour_role enum migrace

**Před fix-em (současný stav, buggy):**
```typescript
type PourRole = 'formwork' | 'falsework' | 'props' | 'formwork_props' | 'mss_integrated';

// Současné assignmenty (buggy):
Top 50:           pour_role: 'falsework'         // BUG — má být formwork
VARIOKIT HD 200:  pour_role: 'falsework'         // BUG — má být formwork_beam
Staxo 100:        pour_role: 'props'             // částečně OK, ale lépe falsework
Staxo 40:         pour_role: 'props'             // OK pro stojky
Framax:           pour_role: 'formwork'          // OK
Frami:            pour_role: 'formwork'          // OK
Dokaflex:         pour_role: 'formwork_props'    // OK pro stropy
DOKA MSS:         pour_role: 'mss_integrated'    // OK
```

**Po fix-u (canonical correct):**
```typescript
type PourRole = 
  | 'formwork'         // Vrstva 1: bednění (Top 50, Framax, Frami, VARIO)
  | 'formwork_beam'    // Vrstva 2: horizontální nosníky (NEW: VARIOKIT HD)
  | 'props'            // Vrstva 3a: stojky (Staxo 40, MULTIPROP)
  | 'falsework'        // Vrstva 3b: skruž (Staxo 100, UniKit, VARIOKIT VST)
  | 'formwork_props'   // Vrstva 1+3a integrované (Dokaflex stropní)
  | 'mss_integrated';  // Speciální: MSS (vše integrované)

// Nové attribute pro sub-classification:
type FormworkSubtype = 'ramove' | 'nosnikove' | 'stropni';

// Po fix:
Top 50:           pour_role: 'formwork',         formwork_subtype: 'nosnikove'
VARIOKIT HD 200:  pour_role: 'formwork_beam'    (or accessory of Top 50/VARIO)
Staxo 100:        pour_role: 'falsework'        // CHANGE from 'props'
Staxo 40:         pour_role: 'props'             // unchanged
Framax:           pour_role: 'formwork',         formwork_subtype: 'ramove'
Frami:            pour_role: 'formwork',         formwork_subtype: 'ramove'
Dokaflex:         pour_role: 'formwork_props',   formwork_subtype: 'stropni'
DOKA MSS:         pour_role: 'mss_integrated'    // unchanged
```

### Test fixtures migrace (3 golden specs)

**SO-202 + SO-203** (mostovka path):
- v4.21.0 Re-Snapshot section L18-30 codifies `Top 50 pour_role='falsework'` (BUG)
- **Fix v Gate 2**: přidat v4.22.0 Re-Snapshot section dokumentující terminology correction
- Old assertion: `expect(sys.pour_role).toBe('falsework')` → New: `expect(sys.pour_role).toBe('formwork')`
- Add new assertion: `expect(sys.formwork_subtype).toBe('nosnikove')`
- Staxo 100 (real falsework): nová assertion `expect(staxo100.pour_role).toBe('falsework')` (was `'props'`)

**SO-207** (MSS path):
- Nezasaženo — MSS path nepoužívá Top 50/VARIOKIT HD samostatně
- Pour_role 'mss_integrated' je canonical-correct, OVERWRITE OK

### CalculatorResult.tsx UI labels

```typescript
// PŘED:
'falsework': 'Skruž (nosníky)' 🏗️

// PO (canonical correct):
'formwork' + subtype 'nosnikove': 'Bednění nosníkové (Top 50)' 📦🔧
'formwork' + subtype 'ramove': 'Bednění rámové (Framax)' 📦
'formwork_beam': 'Nosníky (Top 50 H20 / VARIOKIT HD)' 🔗
'falsework': 'Skruž (Staxo 100 / VARIOKIT VST)' 🏗️
'props': 'Stojky (Staxo 40 / MULTIPROP)' 🔩
'formwork_props': 'Stropní bednění + integrované stojky' 📦🔩
'mss_integrated': 'Posuvná skruž (MSS)' 🌉
```

### Migration plan dependency graph

```
Phase 0: Section 9 v canonical doc (TENTO DOKUMENT)
   ↓
Phase 1: Gate 1 audit s expanded taxonomy
   (Section G + F.3 + Section 9 reference)
   ↓
Phase 2: Gate 2.0a — golden test framework
   (převod 3 .md goldens na automated Vitest fixtures)
   ↓
Phase 3: Gate 2.0b — pour_role enum expansion
   (přidat formwork_beam, formwork_subtype attribute)
   ↓
Phase 4: Gate 2.0c — Gap #8 fix
   (Top 50/VARIOKIT/Staxo classification correction)
   verifikováno proti golden specs
   ↓
Phase 5: Gate 2a + 2b — mostní + budovní (původní plán)
```

---

## 9.6 Reference materials

Zdroje použité při tvorbě této sekce:

1. **DOKA Xpress 2/2020** — mostní reference projekty Top 50 + Staxo 100
2. **DOKA User Information Top 50** — official assembly manual, layer integration
3. **DOKA Frami Xlife brochure** — rámové bednění specifications
4. **DOKA Framax Xlife brochure** — rámové bednění, „lightning-fast assembly"
5. **PERI VARIOKIT VST katalog** — heavy-duty shoring tower specifications
6. **PERI VARIOKIT HD 200 katalog** — horizontal beam systems
7. **asb-portal.cz** — D6 most reference: Top 50 + Staxo 100
8. **D6 Karlovy Vary SO-202/203** — golden test data (test-data/tz/)
9. **Uživatelská domain expertise** — Top 50 vs Framax v mostech, výhody/nevýhody

---

**Tato sekce 9 je integrální součást SKRUZ_TERMINOLOGIE_KANONICKA.md. Doporučuji uložit v repu jako extension/dodatek do stejné složky `docs/normy/navody/`.**

**Datum vzniku:** 2026-04-29
**Status:** Draft pro review uživatelem před integrací do canonical doc.
