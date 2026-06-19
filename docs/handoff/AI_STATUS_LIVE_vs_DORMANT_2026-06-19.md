# AI v STAVAGENT — co je LIVE / co DORMANT / co MEČTA

**Datum:** 2026-06-19 · **Autor:** session t6ni7j (před Google call)
**Účel:** honest mapa — kde umělá inteligence reálně běží, kde je jen zadrátovaná, a kam ji chce Alexander dotáhnout.

> Metodika: trasováno přes kód (call-graf) + **3 živé testy** proti prod MCP serveru
> (= prod backend `concrete-agent` na Cloud Run). Přímý `curl` na Cloud Run je z dev-sandboxu
> blokován egress-allowlistem; MCP nástroje ale chodí do téhož prod backendu, takže živý
> MCP-call = živý důkaz, že prod žije.

---

## 0. Jedna věta

ИИ у тебя сходится в **одну точку** (`/api/v1/multi-role/ask`), Vertex Gemini там провайдер №1, и эту точку дёргают 4 сервиса. Решения про опалубку и дробление сейчас принимает **детерминированный движок** (regex/правила), а ИИ только **советует и проверяет**. «Мечта» = сшить их в один поток ТЗ→решение.

---

## 1. ✅ LIVE — проверено живым вызовом (2026-06-19)

| Что | Путь | Доказательство |
|---|---|---|
| **Детерминированный классификатор** | `classify_construction_element` (MCP) → `element-classifier.ts` | мгновенно вернул `mostovkova_deska`, bridge-context, conf 0.9. **НЕ ИИ** (regex) |
| **Поиск чешских норм (web-LLM)** | `search_czech_construction_norms` → **Perplexity** | conf 0.85, реальные источники `pjpk.rsd.cz`, извлёк коды TP 151 / TP 263 / TKP 18 |
| **Советник + калькулятор (fusion)** | `get_construction_advisor(volume)` → классификатор + движок | полный план: Top 50 DOKA, 4 záběry, 66.8 дней, арматура по матрице, нормы, warnings |
| **Прод MCP backend** | Cloud Run `concrete-agent` | 3 вызова отработали → инстанс живой |

**Вывод секции:** прод жив, Perplexity-путь работает, детерминированный движок работает, советник-fusion работает.

---

## 2. 🟡 LIVE-в-коде, но runtime НЕ проверен этой сессией

| Что | Где зашито | Кто зовёт (проверено в коде) | Чего не хватает |
|---|---|---|---|
| **Multi-Role оркестратор (5 ролей)** | `services/orchestrator.py` + `task_classifier.py` (Role enum) + 7 промптов в `prompts/roles/` | Portal `concreteAgentClient.js:80` · URS `multiRoleClient.js:59` · Registry `api/group.ts,search.ts,classify.ts` · Monolit `/api/planner-advisor` | **прямого живого вызова `/multi-role/ask` отсюда сделать нельзя** (egress блокирован + нет MCP-обёртки над этим эндпоинтом). Статус: зашито и подключено, **здоровье прода под нагрузкой не подтверждено** |
| **Vertex Gemini как LLM ролей** | `gemini_client.py` (VertexGeminiClient, ADC) | выбирается внутри `orchestrator.py` по `MULTI_ROLE_LLM` | то же — фактический LLM-ответ ролей живьём не дёрнут |

**5 ролей (факт из кода):** `DOCUMENT_VALIDATOR` (первый) → `STRUCTURAL_ENGINEER` + `CONCRETE_SPECIALIST` + `COST_ESTIMATOR` (параллельно) → `STANDARDS_CHECKER` (последний). Есть разрешение конфликтов между ролями (`Conflict.winner`).

⚠️ **Рассинхрон чисел:** `CLAUDE.md` = «4 roles», лендинг = «6 expert roles», код = **5 ролей** + 2 доп. промпта (`orchestrator.md`, `standards_researcher.md`). Источник путаницы «сколько их / работают ли». → поправить в отдельной сессии.

---

## 3. Где ИИ работает функционально (по сервисам, из кода)

**concrete-agent (CORE)** — главный потребитель:
- Multi-Role Expert · классификация документов (`document_classifier.py`) · извлечение работ из ТЗ (`section_extraction_engine.py`, `tz_work_extractor.py`) · аудит/противоречия (`audit_service.py`, `norm_audit_service.py`) · суммаризация (`document_summarizer.py`, `brief_summarizer.py`) · passport enrichment · нормы (`norm_ingestion_pipeline.py`, `norm_advisor.py`) · PDF reasoning (`pdf_extraction_reasoner.py`) · парсер цен (`price_parser/`) · RAG-эмбеддинги (pgvector)

**URS_MATCHER** (9 LLM): матчинг BOQ→ÚRS (`ursMatcher.js`, `universalMatcher.js`), `geminiBlockClassifier.js`, Perplexity/Brave web-search, batch-reranker

**rozpocet-registry:** AI-классификация строк `Cache→Rules→Memory→Gemini` (`AIPanel.tsx`, `api/agent/orchestrator.ts`)

**Monolit/Kalkulátor:** AI advisor `/api/planner-advisor` → CORE multi-role. ⚠️ классификатор элементов = **regex, НЕ ИИ**

**Portal:** своего ИИ нет, только прокси в CORE

**Провайдер-роутер** (`provider_router.py`): Vertex Gemini (free ADC) → Bedrock Haiku (AWS credits) → Gemini API → Claude API → Perplexity (web)

---

## 4. 🔵 МЕЧТА — «загрузил ТЗ → ИИ принимает решение»

Цель: модель после загрузки ТЗ оценивает вход, берёт знания из KB и **решает** — какую опалубку, как разбить элемент на подэлементы.

| Кусок мечты | Что уже есть | Чем сделано | Gap |
|---|---|---|---|
| оценить ТЗ | `tz-text-extractor.ts`, `section_extraction_engine.py` | regex + LLM | OCR для PDF (MinerU) |
| знания KB | 42 JSON + pgvector + `/api/v1/kb/research` | RAG | — |
| выбрать опалубку | `recommendFormwork()` | **детерминизм** | ИИ не «решает», движок решает |
| дробить элемент | `suggestPourStages()`, záběry | **детерминизм** | то же |
| ИИ «решает» | multi-role + advisor | LLM, но **только советует** | **шов advisor↔движок** |

**Инсайт:** опалубку и дробление решает движок по правилам (это AI-last философия — правильно, дёшево, предсказуемо). Мечта = достроить **мост**: ТЗ → извлечение → KB-контекст → ИИ предлагает/обосновывает → движок считает. Это не проект с нуля.

**Backlog-куски этого моста (из CLAUDE.md):**
- SmartInput PDF pipeline (MinerU OCR + chunked + cross-document fusion)
- `tz_facts` напойка (извлечённая технология → `planElement` + MCP)
- AI advisor prompt v2 live validation (цитаты норм)
- External LLM cross-validation как N-й слой (Pattern 27)

---

## 5. Для звонка с Google — формулировка

> *«Vertex Gemini je náš primární a nejlevnější LLM (free přes ADC na Cloud Run). Architektura je AI-last: regex + katalogy (OTSKP 17 904 / ÚRS 39 000+) běží první, LLM je fallback a poradce. Ověřeno živě: deterministický engine, Perplexity norms search i advisor-fusion běží v produkci. Další krok je sešít extrakci TZ → KB → LLM-doporučení → engine do jednoho toku — proto je migrace na google-genai v jádru (6 souborů + embeddings).»*
