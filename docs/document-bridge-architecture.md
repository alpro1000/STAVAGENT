# STAVAGENT — Document Bridge Architecture

**Verze:** 1.0
**Datum:** 16.04.2026
**Stav:** Architektonická vize, fáze 1 v backlogu (TASK_SmartInput_DocumentBridge)
**Umístění v repo:** `docs/architecture/document-bridge.md`

---

## Shrnutí

Tento dokument popisuje jak kalkulátor betonáže STAVAGENT zpracovává vstup
z technických zpráv (TZ) projektové dokumentace. Existují **tři scénáře
použití**, každý s odlišnou architekturou pro extrakci parametrů.

---

## Tři scénáře použití

### Scénář 1: MCP přes ChatGPT / Claude (AKTIVNÍ)

Uživatel v ChatGPT nebo Claude nahraje TZ PDF a požádá o výpočet.
LLM samo přečte PDF, extrahuje parametry a zavolá STAVAGENT MCP tool.

```
Uživatel v ChatGPT: "zde je moje TZ [PDF SO-202]. Spočítej betonáž"
        ↓
ChatGPT čte PDF, extrahuje parametry, volá STAVAGENT MCP tool
        ↓
MCP tool "calculator" obdrží: element_type, volume, exposure, curing_class...
        ↓
STAVAGENT engine spočítá
        ↓
ChatGPT formátuje odpověď uživateli
```

**Klíčový bod:** Extrakci parametrů dělá **LLM uživatele** (ChatGPT/Claude).
STAVAGENT role = poskytnout správně strukturovaný MCP tool s jasnými parametry.

**Co je potřeba dodělat:**
- MCP tool schema musí požadovat všechny kritické parametry (curing_class,
  exposure_class, is_prestressed, span_m, num_cables, construction_technology)
- V description každého parametru — příklady a pravidla
  (`curing_class: 4 pro mostní NK dle TKP18 §7.8.3`)
- LLM přečte description a extrahuje správně

**Stav:** MCP v1.0 merged (10.04.2026). Obohacení schemas z golden test
zbývá udělat.

---

### Scénář 2A: SaaS ruční zadání (AKTIVNÍ)

Rozpočtář otevře kalkulátor, vybere element_type, zadá parametry ručně,
klikne Vypočítat.

```
Otevřít kalkulátor → vybrat element_type → zadat volume, beton, teplotu
→ Vypočítat → výsledek
```

**Funguje, ale pomalé.** Rozpočtář ví co zadávat, ale dělá to 14× pro
14 skupin pilot v SO-202.

---

### Scénář 2B: SaaS Document Bridge (V BACKLOGU — TASK_SmartInput_DocumentBridge)

Rozpočtář nahraje TZ PDF do Monolit Planneru. Backend extrahuje parametry,
vytvoří seznam pozic, jedním klikem spočítá vše.

```
Upload TZ PDF do Monolit Planner
        ↓
Backend: MinerU OCR → text
        ↓
Backend: extrakce faktů (3 JSON architektura):
  - project_facts.json: všechna čísla z TZ s provenance
  - work_candidates.json: seznam pozic k výpočtu
  - catalog_matches.json: ÚRS/OTSKP kódy
        ↓
Backend: pro každou pozici → parametry pro kalkulátor
        ↓
Frontend: seznam pozic "připraveno k výpočtu" (14 pilot + 5 opěr + 2 NK...)
        ↓
User: jeden klik "Vypočítat vše" → batch výpočet všech pozic
        ↓
Výsledek: harmonogram, náklady, rozpočet
```

---

## Klíčová otázka: JAK extrahovat parametry z TZ?

Dva přístupy, oba potřebné:

### Přístup A: Deterministický parser + rules engine

```
TZ text → regex → structured facts
```

Příklady pravidel:

| Vzor v TZ | Extrakce | Confidence |
|---|---|---|
| `"třída ošetřování 4"` | `curing_class: 4` | 1.0 |
| `"C35/45 XF2"` | `concrete_class: C35/45`, `exposure_class: XF2` | 1.0 |
| `"Ø900"` nebo `"průměr 900 mm"` | `diameter_mm: 900` | 1.0 |
| `"6 polí × 20m"` nebo `"6 polí max 20.000 m"` | `num_spans: 6`, `span_m: 20` | 1.0 |
| `"předpjatá"` nebo `"dodatečně předpjatý"` | `is_prestressed: true` | 1.0 |
| `"pevná skruž"` nebo `"betonáž na pevné skruži"` | `construction_technology: fixed_scaffolding` | 1.0 |
| `"12 kabelů × 13 lan"` | `num_cables: 12`, `lanes_per_cable: 13` | 1.0 |

**Plusy:** deterministické, confidence=1.0, zdarma, rychlé.
**Mínusy:** přehlédne formulace mimo šablony.

### Přístup B: LLM fallback s golden test jako reference

```
TZ text + golden test template → Claude/Gemini → JSON parameters
```

Pokud deterministický parser našel < 80% parametrů → LLM doplní zbytek.
Golden test SO-202 funguje jako **few-shot example** v promptu:

```
Prompt:
"Zde je příklad jak správně extrahovat parametry z TZ mostu:
[SO-202 golden test JSON]

Teď extrahuj parametry z tohoto TZ:
[nové TZ]

Vrať JSON ve stejném formátu."
```

**Plusy:** handles ambiguity, učí se z golden test.
**Mínusy:** confidence=0.7, stojí peníze.

---

## Architektura Document Bridge

```
┌────────────────────────────────────────────┐
│  Document Upload (PDF TZ)                  │
└─────────────────┬──────────────────────────┘
                  ↓
┌────────────────────────────────────────────┐
│  1. MinerU OCR                             │
│     → clean text + zones + tables          │
└─────────────────┬──────────────────────────┘
                  ↓
┌────────────────────────────────────────────┐
│  2. Deterministic Extractor (conf=1.0)     │
│     regex patterns:                        │
│     - concrete_class, exposure_class       │
│     - curing_class (z TKP18 tabulek)       │
│     - dimensions (L×W×H, Ø×L×count)        │
│     - work decomposition (dle TZ §)        │
└─────────────────┬──────────────────────────┘
                  ↓
┌────────────────────────────────────────────┐
│  3. Structure builder                      │
│     - SO-xxx → objects                     │
│     - objects → positions                  │
│     - positions → calculator inputs        │
└─────────────────┬──────────────────────────┘
                  ↓
┌────────────────────────────────────────────┐
│  4. LLM fallback (conf=0.7)                │
│     Jen pro přehlédnuté parametry          │
│     Golden test SO-202 jako few-shot       │
└─────────────────┬──────────────────────────┘
                  ↓
┌────────────────────────────────────────────┐
│  5. Validation                             │
│     - cross-check s golden test rules      │
│     - flag contradictions                  │
│     - request user confirmation            │
└─────────────────┬──────────────────────────┘
                  ↓
┌────────────────────────────────────────────┐
│  6. Calculator batch input                 │
│     → seznam pozic připravených k výpočtu  │
└─────────────────┬──────────────────────────┘
                  ↓
┌────────────────────────────────────────────┐
│  7. Calculator engine (existující)         │
│     → harmonogram, náklady, PERT, Gantt    │
└────────────────────────────────────────────┘
```

---

## Role golden tests v této architektuře

Golden tests v `test-data/tz/` fungují na **4 úrovních**:

| Úroveň | Použití | Příklad |
|---|---|---|
| **1. Regression tests** | Validace kalkulátoru | "SO-202 musí vrátit curing ≥ 9 dní" |
| **2. Few-shot examples** | LLM extraction prompt | "Zde je příklad správného JSON formátu" |
| **3. Validation rules** | Post-extraction checks | "Pro most NK curing_class musí být 4" |
| **4. Training data** | Regex pattern source | Jaké formulace jsou v reálných TZ |

**Čím více golden tests → tím přesnější extraction → tím méně ruční práce.**

Aktuálně v repo:
- `test-data/tz/SO-202_D6_most_golden_test.md` — dvoutrámový předpjatý most
- (plán) SO-207 D6 estakáda — MSS technologie
- (plán) FORESTINA bílá vana + šachta — pozemní objekt
- (plán) Přeložka vodovodu/kanalizace — liniové stavby

---

## Znalostní úrovně v STAVAGENT

```
Úroveň           | Kde                                    | Co
-----------------|----------------------------------------|--------------------------
TKP normy        | STAVAGENT/extracted_data/ (36 párů)    | Primární zdroj — ŘSD normativy
KB engine        | concrete-agent/.../knowledge_base/B1-B9| Agregovaná data pro CORE API
Katalogy         | data/peri-pdfs/                        | DOKA/PERI bednění specs
Golden tests     | test-data/tz/ (3+ mosty)               | Etalony pro verifikaci kalkulátoru
```

**Řetězec:** TKP → extracted.json → KB JSON → engine logic → golden test verifikace.

---

## Praktický plán implementace

### Fáze 0 — AKTIVNÍ (MCP scénář funguje)

- [x] MCP v1.0 merged (9 tools, auth, billing)
- [ ] Obohacení MCP tool schemas pravidly z golden test
- [ ] Příklady v description každého parametru
- **Výsledek:** Uživatel v ChatGPT pracuje už teď

### Fáze 1 — SmartInput v1 (deterministic only, 2-3 týdny)

- [x] PDF upload v Monolit Planner (existuje)
- [x] MinerU OCR (existuje)
- [ ] Regex extractor pro 80% parametrů TZ mostů
- [ ] Form auto-fill na frontend
- [ ] User review před výpočtem
- **Výsledek:** Rozpočtář nahraje TZ → parametry se doplní → review → spočítá

### Fáze 2 — SmartInput v2 (+ LLM fallback, 1-2 týdny)

- [ ] LLM (Gemini Flash → Bedrock Claude) zpracuje co regex nenašel
- [ ] Golden tests jako few-shot v prompt
- [ ] Confidence scoring v UI (zelené = regex, žluté = LLM, červené = manual)
- **Výsledek:** pokrytí > 95% parametrů pro standardní mostní TZ

### Fáze 3 — Batch processing (1 týden)

- [ ] "Vypočítat vše" pro seznam pozic
- [ ] Paralelní výpočet všech pozic
- [ ] Agregovaný rozpočet + harmonogram
- **Výsledek:** kompletní rozpočet jedním kliknutím

---

## Klíčové architektonické rozhodnutí

**MCP scénář ≠ SaaS scénář.**

| Aspekt | MCP | SaaS Document Bridge |
|---|---|---|
| Kdo extrahuje parametry | LLM uživatele (ChatGPT/Claude) | Backend STAVAGENT |
| Infrastruktura | MCP server + engine | + MinerU + regex + LLM fallback |
| Cena provozu | Nízká (bez LLM v našem stacku) | Vyšší (Bedrock/Gemini calls) |
| Cílový uživatel | AI-literate developer/rozpočtář | Mainstream rozpočtář bez AI |
| Závislost | Uživatel má ChatGPT/Claude subscription | Pouze STAVAGENT účet |
| Stav | AKTIVNÍ (v1.0) | BACKLOG (TASK_SmartInput_DocumentBridge) |

**Proč oba scénáře:**
- MCP je levný a rychlý pro early adopters
- SaaS Document Bridge je nutný pro mainstream produkt — rozpočtář bez AI nemá kde
  LLM pustit. Backend musí dělat extraction sám.

**Oba scénáře se opírají o golden tests jako source of truth.**
Každé přidané TZ v `test-data/tz/` dělá oba systémy chytřejšími.

---

## Odpověď na klíčové otázky

### "V režimu MCP aplikace uživatel nahraje TZ do ChatGPT/Claude a můj kalkulátor dá výsledek? Tak?"

**Ano, přesně tak.** A už to funguje (MCP v1.0). Zbývá obohatit tool schemas
příklady z golden test — pak LLM bude extrahovat parametry přesněji.

### "A jak v režimu běžné práce na webu to může probíhat?"

**Dvě varianty:**

1. **Ručně (teď)** — rozpočtář vybírá element_type, zadává volume, atd.
2. **Přes Document Bridge (SmartInput task v backlogu)** — nahrál TZ →
   systém extrahoval parametry → jedním kliknutím spočítal vše

**Klíčový rozdíl:** V MCP scénáři LLM (ChatGPT/Claude) dělá práci extrakce.
V SaaS scénáři to musí dělat **tvůj backend** — protože nemůžeš spoléhat na
LLM uživatele, on ho nemusí mít.

**Proto SmartInput = deterministický extractor + LLM fallback v tvém backendu,
ne LLM uživatele.**
