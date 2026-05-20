# STAVAGENT — Conventions Steering

> **Účel dokumentu:** Pravidla práce s Claude Code, communication style, session workflow.
> Před každou Claude Code session — referenced odsud.
>
> **Verze:** 1.0 — 19.05.2026

---

## 1. Claude Code session mantra

> Před napsáním jediného řádku kódu Claude Code musí:

### 1.1 Прочитать репо

```
Прочитай структуру всего репозитория alpro1000/STAVAGENT.
Найди все файлы которые относятся к текущей задаче.
Не начинай писать пока не понимаешь что уже существует.
```

### 1.2 Определить naming

```
Все имена (переменные, функции, классы, файлы, таблицы, endpoint'ы) — 
ТОЛЬКО из существующих конвенций в репо.

Если в репо snake_case — пиши snake_case.
Если файлы называются xlsx_komplet — не называй свой xlsx-komplet-parser.
Если таблица называется project_documents — не создавай portal_documents.
```

### 1.3 Не дублировать

```
Перед созданием ЛЮБОГО нового:
- парсера → проверь существующие парсеры
- утилиты → проверь utils/helpers
- модели/схемы → проверь models/schemas
- endpoint'а → проверь существующие роуты
- таблицы → проверь текущую схему БД

Если нашёл существующий код который делает 70% того что нужно — 
расширь его. Не пиши параллельный.
```

### 1.4 Встраиваться

```
Новый код должен выглядеть так, будто его написал тот же 
разработчик что писал весь остальной репо.
Не создавай новую архитектуру рядом со старой.
Core↔Kiosk паттерн — не менять без обсуждения.
```

---

## 2. Co konkrétně проверить před začátkem

| Co | Proč |
|---|---|
| `xlsx_komplet` parser | Jak parsuje Excel, jaká pole, jaký output format |
| `xlsx_rtsrozp` parser | To samé pro druhý format |
| `URS_MATCHER_SERVICE` | API endpoint, format request/response, kde se volá |
| `otskp.db` | Struktura SQLite, jak se dělá lookup, jaká pole |
| `detect_document_type()` | Regex markery pro filename a content |
| `NormIngestionPipeline` | Vrstvy (regex → Gemini → Perplexity), pořadí, confidence |
| `RegexNormExtractor` | Existující regex patterns — přepoužít |
| `DocumentSummary` | Pydantic schéma, jaká pole, jak se naplňuje |
| `project.json` | Aktuální struktura — kam přidávat nová data |
| Tabulky PostgreSQL | Nevytvářet duplikáty existujících tabulek |
| `app/api/` routy | Konvence endpointů, middleware, auth |
| Confidence scoring | Regex=1.0, OTSKP db=1.0, URS matcher=0.80, AI=0.70 |

---

## 3. STAVAGENT principy (nesmíš porušit)

1. **Determinismus před AI** — pokud lze regex, nepoužívej LLM
2. **Core oddělen od UI** — Core API neví o frontendu
3. **Confidence scoring obligatorní** — каждый výstup má confidence
4. **Vysoký confidence se nepřepisuje nízkým**
5. **Multi-provider AI** — Gemini Flash (rychle) → Claude Sonnet (přesně) → Perplexity (normy)
6. **Render se NEPOUŽÍVÁ** — vše na Cloud Run + Vercel

---

## 4. Format práce Claude Code

```
1. AskUserQuestion — položit 5-7 otázek PŘED napsáním kódu
2. Ukázat plán s gates — nedělej další etapu bez potvrzení
3. Psát testy — unit testy s moky, bez reálných HTTP/DB
4. Po každé etapě — stručný report co uděláno a co dál
```

---

## 5. Pokud pochybuješ

```
Lépe se zeptej, než hádej.
Lépe rozšiř existující, než vytvoř nové.
Lépe přeskočit krok, než ho udělat se špatným namingem.
```

---

## 6. Audit-first discipline

> **Перед изменениями всегда инвентаризация.**

Před implementací — audit:

1. Co už v repu existuje?
2. Co lze přepoužít?
3. Co je v konfliktu s plánem?
4. Co se musí refaktorovat předem?

Audit výstup = `analyze.md` v case bug, nebo sekce v `design.md` při spec.

---

## 7. Gates & PRs

- **Один Gate per commit** — granulární práce
- **PR review checkpoint** между Gates
- Branch protection **enabled** на `main` — bez výjimky
- **No-PR-unless-asked policy** — commits push do origin, PR neotevírá se dokud user explicitně nepožádá

---

## 8. Communication style

### 8.1 Jazyk

- **Russian** конверсация с пользователем
- **Czech** доменная terminológia (ČSN, OTSKP, TKP, přípravář, statik)
- **English** code, commits, PR titles (může быть CS u domain-specific)

### 8.2 Voice-to-text artifacts

- **Normální** — например, "срок вранья опалубки" = "срок снятия опалубки"
- Nedělat z toho problém, rozluštit z kontextu

### 8.3 Signály

- **ALL CAPS** = раздражение, акцент
- **Numbered options** → rychlé rozhodnutí
- **Sequential PRs** preferovány (ne parallel)
- **Minimalní hirurgické změny** > velké rerites
- **Scope creep** → user opravuje kurz okamžitě

---

## 9. Task structure pro Claude Code

> **CRITICAL RULE:** Nikdy не specifikuj jména proměnných, souborů, tříd, tabulek v taskách.

### 9.1 Structure

```
Mantra (read entire repo first → derive naming → then write)
  │
  ▼
PRE-IMPLEMENTATION INTERVIEW (5-7 otázek через AskUserQuestion)
  │
  ▼
Business logic (co se má stát)
  │
  ▼
Domain rules (konkrétní pravidla z domain.md)
  │
  ▼
Numbered acceptance criteria (EARS-style)
  │
  ▼
What is NOT included (out of scope)
```

### 9.2 Co NESMÍŠ napsat v tasku

```
❌ "Vytvoř soubor app/services/cross_validator.py"
❌ "Tabulka portal_documents s poli id UUID, project_id UUID..."
❌ "Třída SaveDocumentRequest(BaseModel) s poli..."
❌ "Funkce def extract_facts_from_summary(summary: dict) -> list"
❌ "Proměnná CONFIDENCE_MAP = {regex: 1.0, gemini: 0.7}"
❌ "Endpoint @router.post('/project/{id}/save-document')"
```

### 9.3 Co MÁŠ napsat v tasku

```
✅ "Výsledek analýzy se má ukládat v PostgreSQL přivázaný k projektu"
✅ "Při opakovaném nahrání téhož souboru — ukázat co se změnilo"
✅ "Porovnat extrahované fakty nového dokumentu se všemi existujícími"
✅ "Vybavení se porovnává podle kódu (prvních 6+ znaků) a množství"
✅ "Matice pokrytí: jaké typy dokumentů jsou, jaké chybí"
✅ "Zmíněné, ale nenahrané dokumenty → seznam chybějících"
```

---

## 10. Universalita po profesí

Každý task musí počítat s tím, že systém funguje pro **VŠECHNY** typy stavební dokumentace, ne jen pro jeden obor:

| Obor | Klíčové parametry |
|---|---|
| **Silnoproud** (D.1.4) | kW, kVA, kabely, rozvaděče, IP, střídače |
| **Slaboproud** (D.1.4) | EPS, kamery, UTP/FTP, detektory |
| **ZTI** (D.1.4) | DN potrubí, průtoky l/s, tlaky, čerpadla |
| **VZT** (D.1.4) | průtoky m³/h, Pa, teplota, VZT jednotky |
| **ÚT** (D.1.4) | tepelné výkony kW, kotle, radiátory |
| **Plynovod** (D.1.4) | DN, tlak kPa, HUP, spotřebiče |
| **MaR** (D.1.4) | čidla, regulátory, BMS |
| **Statika** (D.1.2) | beton C../.., výztuž B500, zatížení kN/m² |
| **PBŘS** (D.1.3) | požární úseky, SPB, EPS, SHZ, ZOKT |
| **Geologie** (C) | vrstvy, HPV, Rdt kPa, radon, XA |
| **Geodézie** (C) | souřadnice, výšky, parcely |

---

## 11. Session workflow (claude.ai online + Claude Code home)

> Александр работает на работе через claude.ai (firewall blokuje terminal), doma v Claude Code v terminálu. Workflow gibridní.

### 11.1 Na práci (claude.ai online)

**Slouží pro:**
- Spec creation (requirements.md, design.md, tasks.md)
- Bug report (report.md)
- Strategic planning, brainstorming
- Reviews

**Output formát:** Markdown soubory které se commitují přes GitHub web UI do `docs/specs/{name}/` nebo `docs/bugs/{id}/`.

### 11.2 Doma (Claude Code v terminálu)

**Slouží pro:**
- Implementation podle tasks.md
- Bug analyze.md → fix.md → verify.md
- Tests, golden test runs
- Refactoring

**Vstup:** Git pull → přečte `docs/steering/*` + `docs/soul.md` + `docs/specs/{aktivní}/`.

### 11.3 Handoff

Po každé session — **update** `docs/soul.md` se sekcí:

```markdown
## YYYY-MM-DD — Session: {topic}
- Rozhodnuto: ...
- Odmítnuto: ...
- Otevřené otázky: ...
- Co dál: ...
```

Commit s message: `docs(soul): session YYYY-MM-DD — {topic}`.

---

## 12. Když Claude Code timeout na velkém souboru

> **Pattern:** Split na sub-tasky <170 řádků každý.

- Split podle gates (Gate 0 scan-only → Gate 1 format findings)
- Output findings as plain chat text jako fallback
- Sub-tasky postupně, ne paralelně

---

## 13. Scope expansion pattern

> Александр consistently overrides scope reduction recommendations.

**Pravidlo Claude:**
1. Nazvi pattern explicitně ("Vidím že se scope rozšiřuje od původního X na Y...")
2. Pokud user potvrdí → vyhov
3. Nepokoušet se silně přesvědčovat o redukci

---

## 14. GCS hybrid architecture

- **GCS** drží **raw** PDFs
- **Git** drží **synthesized** files:
  - `METADATA.md`
  - `extracted.yaml`
  - `citations.md`
  - `source_pointer.md` s `gs://` paths

---

## 15. Task file audit structure

Four-category klasifikace pro audit existujících tasků:

| Category | Status |
|---|---|
| **A** | Production-ready |
| **B** | Implemented but untested |
| **C** | Scaffolded but not implemented |
| **D** | Vision only |

Audit task name conventions: `TASK_[DOMAIN]_[Scope].md`, nested under `docs/audit/` (deprecated v této verzi — now `docs/specs/` and `docs/bugs/`).

---

## 16. Document versioning

| Date | Version | Notes |
|---|---|---|
| 19.05.2026 | 1.0 | Initial conventions steering. Synthesized from STAVAGENT_ClaudeCode_Session_Mantra.md + Project_Knowledge_Snapshot.md §11 (Conventions). |
