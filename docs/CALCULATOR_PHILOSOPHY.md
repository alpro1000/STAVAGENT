# CALCULATOR_PHILOSOPHY — pozicování a hranice STAVAGENT kalkulátoru

**Verze:** 1.0
**Datum:** 2026-04-29
**Status:** Závazný document pro celý projekt — UI labels, demo videa, MCP responses, pitch decky, Gate 2/3/4 implementations.

---

## 1. Co tento kalkulátor JE

**STAVAGENT kalkulátor je nástroj pro přípraváře a rozpočtáře (přípravář / rozpočtář).** Pomáhá:

1. **Rychle se zorientovat** v projektu — jaký typ bednění, jaká podpěrná konstrukce, kolik měsíců pronájem
2. **Odhadnout náklady** s přesností **±10–15 %** pro tendrový rozpočet a předběžnou kalkulaci
3. **Identifikovat technologicky správný stack** — co půjde do poptávky u dodavatele
4. **Připravit se na rozhovor s dodavatelem** — kalkulátor řekne "potřebujete Top 50 + Staxo 100", přípravář pak jde k DOKA s konkrétní poptávkou

Kalkulátor pracuje **velkými mazy** — určí hlavní systémy, jejich pronájem, procento spotřebních materiálů. **Není to engineering tool.**

---

## 2. Co tento kalkulátor NENÍ

- **Není finální engineering software.** Pro detailní statický návrh, výpočet zatížení, schvalovací dokumentaci → DOKA / PERI / ULMA design teamy.
- **Není konkurent DOKA Software / PERI EngineeringPad.** Je to komplementární nástroj — připraví podklady pro discussion s engineering teamem, ne nahrazuje je.
- **Není inventory tool až na poslední šroub.** Kalkulátor počítá hlavní systémy a procenta spotřeb; konkrétní šrouby, anchory, custom adaptéry řeší dodavatel.
- **Není záruka přesné ceny.** Finální cena vychází ze statického návrhu výrobce + aktuálního ceníku + projektových podkladů. Kalkulátor poskytuje orientační odhad pro tendrovou fázi.

---

## 3. Co kalkulátor řeší a s jakou přesností

| Aspekt | Přesnost | Důvod |
|---|---|---|
| **Volba kategorie bednění** (rámové/nosníkové/stropní) | **Vysoká** (deterministicky podle element type + geometrie) | Technologická volba, jasné inženýrské pravidlo |
| **Volba konkrétního systému** (Top 50 vs Framax vs Frami) | **Střední** (doporučení + možnost ručního override) | Přípravář může mít preference dodavatele nebo dostupnost |
| **Plocha bednění** (m²) | **Vysoká** (±5 %) | Geometricky vypočtené z dimensions |
| **Pronájem v měsících** | **Střední** (±15 %) | Závisí na harmonogramu stavby, který se mění |
| **Měsíční sazba** (Kč/m²/měsíc) | **Střední** (±10 %) | Závisí na konkrétním ceníku dodavatele a regionu |
| **Práce na sestavení/demontáž** (Nh) | **Střední** (±15 %) | Závisí na zkušenosti party a místních podmínkách |
| **Spotřební materiály** (palba, šrouby, drobný materiál) | **Procentem z hlavního systému** | Nelze přesně předpovědět bez konkrétního projektu |
| **Statický výpočet** | **Neprovádí** | Doménová odpovědnost dodavatele |
| **Detailní seznam komponentů** | **Neprovádí** | Dodavatel sestavuje na základě finálního návrhu |

---

## 4. Filozofie spotřebních materiálů a percentilního přístupu

V opalubčím rozpočtu existují 3 typy nákladů:

### 4.1 Pronájemné systémy (vratitelné)

Hlavní bednící panely, podpěrné věže, nosné nosníky — **pronajímají se** a **vracejí** dodavateli po skončení projektu.

Příklad: Top 50 panely, Staxo 100 věže, VARIOKIT VST.

Cena: **měsíční sazba × m² × měsíců**.

### 4.2 Spotřební materiály (částečně vratitelné, % ztráta)

Palba (fanера), drobné spojovací prvky, distance, anchory — **opotřebovávají se**, část lze znovu použít, část je "ztráta".

Příklad:
- Fanера **se může použít 3–7×** v závislosti na péči, povrchové úpravě, povětrnostních podmínkách
- Drobné anchory typicky **8–15× použití**
- Distance "kostky" — typicky **jednorázové** na velkých projektech

**Kalkulátor s tím pracuje procentem** — typicky **5–15 % z pořizovací ceny systému** jako "spotřební část per cyklus", **per element type různé**:

| Element type | % spotřebních materiálů | Důvod |
|---|---|---|
| Stěny opěrné, ploché | **5–8 %** | Standardní, opakující se |
| Mostovka | **10–15 %** | Vyšší opotřebení od těžkých zatížení |
| Sloupy custom | **10–12 %** | Speciální adaptéry, vyšší ztráta |
| Demolice mostů | **15–20 %** | Extreme conditions, vyšší ztráta |
| Stropní (Dokaflex apod.) | **6–10 %** | Standardní stropní cyklus |

**Tento procent NEJSOU exact engineering numbers.** Je to **engineering rule-of-thumb** který dodavatel ve své finální nabídce upřesní.

### 4.3 Nákupní materiály (jednorázové)

Některé položky se **kupují**, ne pronajímají — typicky:
- Speciální custom adaptéry pro projektově navržené detaily
- Konstrukční prvky pro permanentní zabudování
- Některé typy spojovacích prvků pro specifické aplikace

Tato kategorie je **velmi proměnlivá** a kalkulátor ji řeší jako **paušál** v % z hlavního systému (typicky **2–5 %**).

---

## 5. Co tato filosofie znamená pro UI

### 5.1 V kalkulátoru se musí zobrazit disclaimer

Někde v UI (typicky v results sekci nebo v info panelu) musí být **viditelný text**:

> ℹ️ **Tento kalkulátor poskytuje orientační odhad pro přípravu rozpočtu** s přesností typicky ±10–15 %. Finální detailní návrh, statický výpočet a přesnou specifikaci komponentů provádí vždy dodavatel opalubky (DOKA / PERI / ULMA / další) na základě konkrétních projektových podkladů. Pro tendrovou fázi a předběžnou kalkulaci je tato přesnost dostatečná.

### 5.2 V results sekci procentní odhady musí být explicitní

Místo:
```
Spotřební materiály: 12 500 Kč
```

Lépe:
```
Spotřební materiály (palba, drobný materiál):    12 500 Kč
   └─ Odhad: ~10 % z pořizovací ceny bednění
   └─ Konkrétní spotřebu upřesní dodavatel
```

### 5.3 Doporučení vs požadavek

UI nemá vyžadovat absolutní přesnost. Výrazy:

❌ "Nutno použít Top 50"
✅ "Doporučený systém: Top 50 (alternativa VARIO GT 24 — PERI ekvivalent)"

❌ "Stojky NEJSOU přípustné pro mostovku"
✅ "Pro mostovku se v běžné praxi používá skruž (Staxo 100, VARIOKIT VST). Stojky jsou určené pro stropy budov."

---

## 6. Co tato filosofie znamená pro Gate 2/3/4 implementation

### 6.1 Acceptance criteria nemají žádat absolutní přesnost

Acceptance criterium typu *"Kalkulátor musí vrátit přesně 12 500 Kč pro spotřební materiály"* je špatné — vázalo by kód na konkrétní procent který se může změnit.

Lépe: *"Kalkulátor musí vrátit spotřební materiály v rozmezí 8–12 % z pořizovací ceny bednění pro stěny opěrné, s konkrétní hodnotou nastavitelnou v tech card per element type."*

### 6.2 Tech cards (Phase 2) mají obsahovat percentile parameters

Každý tech card per element type má pole:

```
spotrebni_material_pct_min: <number>
spotrebni_material_pct_max: <number>
spotrebni_material_pct_default: <number>
spotrebni_material_pct_note: "explanation v češtině"
```

Konkrétní hodnoty pocházejí z DOKA katalogů, akademických učebnic, a engineering rule-of-thumb. **Nejsou exact**, jsou **calibrated estimates**.

### 6.3 Golden tests verifikují technologickou správnost, ne precision

Golden test SO-202 nemá tvrdit *"přesně 4 280 hodin práce"*. Místo toho:

- ✅ "formwork system pro mostovku = nosníkové (Top 50 nebo VARIO GT 24)"
- ✅ "podpěra = skruž (Staxo 100 nebo VARIOKIT VST), ne stojky"
- ✅ "plocha bednění m² ≈ délka × výška ± 10 %"
- ✅ "pronájem ≈ harmonogramem stanovené měsíce"
- ✅ "spotřební materiály v rozmezí 10–15 % z hlavního systému"

Tyto **technologicky správné výsledky** jsou cíl. Konkrétní čísla jsou **konzistentní s rule-of-thumb**, ne **engineering precision**.

---

## 7. Co tato filosofie znamená pro pitch / demo / MCP

### 7.1 V demo videu

> "Tento kalkulátor odhadne projekt mostu s přesností ±15 % během několika minut. To je dostatečné pro tendrovou kalkulaci. Pro finální detail jdete k dodavateli s konkrétní poptávkou — kalkulátor vám připraví podklady."

### 7.2 V pitch decku

| Náš nástroj | Engineering software (DOKA Software, PERI EngineeringPad) |
|---|---|
| Rychlý odhad pro přípravu | Detailní statický návrh |
| Univerzální (DOKA + PERI + ULMA + …) | Vendor-locked |
| ±15 % přesnost | ±2 % přesnost |
| Minutový workflow | Dny / týdny |
| Pro **přípraváře** | Pro **engineering team** |

Naše hodnota = **rychlost + technologická správnost + vendor-neutralita** v fázi předtendrové kalkulace.

### 7.3 V MCP responses

MCP tool výstupy musí obsahovat **disclaimer field**:

```json
{
  "result": { ... },
  "accuracy_note": "Estimate ±10-15% for tender preparation. Detailed design and exact component specification by formwork supplier (DOKA/PERI/ULMA) based on project documentation."
}
```

---

## 8. Vztah k ostatním dokumentům projektu

- **`SKRUZ_TERMINOLOGIE_KANONICKA.md`** — kanonická terminologie (skruž / stojky / podpěrná konstrukce / sub-taxonomie bednění)
- **`SKRUZ_TERMINOLOGIE_KANONICKA_Section9.md`** — rozšíření canonical doc o 3-vrstvý stack a sub-taxonomii
- **`docs/audits/knowledge_audit/`** — inventář znalostí
- **`docs/normy/navody/`** — normy a navody (TKP, ČSN, DOKA katalogy)
- **`test-data/tz/`** — golden test reference projekty (SO-202, SO-203, SO-207)
- **`CALCULATOR_PHILOSOPHY.md`** *(tento dokument)* — pozicování a hranice kalkulátoru

Tento dokument je **závazný pro:**
- Veškerý UI text (CalculatorResult, HelpPanel, FormworkSelector)
- Acceptance criteria pro všechny Gate 2/3/4 tasky
- Demo videa a pitch decky
- MCP tool descriptions a responses
- Externí komunikaci (DOKA / PERI / klienti)

---

## 9. Verze a změny

| Verze | Datum | Co se změnilo |
|---|---|---|
| 1.0 | 2026-04-29 | Initial draft založený na uživatelské domain expertise (přípravář perspective) a engineering rule-of-thumb pro spotřební materiály per element type |

---

**Tento dokument je živý. Pokud se mění pozicování, přesnost, percentile parameters per element, nebo philosophy approach — verze se zvyšuje a změny se zaznamenávají do tabulky výše.**
