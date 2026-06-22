# STAVAGENT — КАНОН Phase 5 (единый источник)

> Заменяет `PLAN_Phase5_LIVE.md` (stale 2026-06-15) **и** `STATUS_HANDOFF`.
> **Одна** нумерация (Q#). **Одна** ветка в полёте. Старые имена (T# / session-TODO# / Шаг#) — в `alias` для трассируемости.
> Cemex снят как блокер: порядок = **ценность + deps + risk**, без demo-дедлайна.
> _Обновлено: 2026-06-21. Активная сессия: C (выживает). A и B закрыты — их знание захвачено здесь (§8)._

---

## 0. Дисциплина (неизменно)
- Одна ветка в полёте. **audit-first → STOP-до-кода → no-auto-merge.** Merge-gate = Александр (diff + зелёный CI лично).
- Merge в `main` = мгновенный прод-rollout (Vercel авто-деплой main; preview `claude/*` выкл). **merge-gate = rollout-gate.** Живая проверка на kalkulator.stavagent.cz — не «done» до прогона на сайте.
- Задания в бизнес-терминах; naming — по конвенциям репо; без параллельных структур.
- Goldens hermetic (без AI/network); KV+Žalmanov+нормы держатся; no re-snapshot без объяснения каждого сдвига.
- Свобода времени = переупорядочить по ценности, **НЕ** расширять скоуп, **НЕ** рвануть в миграцию явочным порядком. Миграция = свой выделенный цикл.
- soul.md §9 post-merge.

---

## 1. DONE (на main, live)
- **#6** — деривация плоской площади опалубки (ODHAD) → tesaři срабатывает на всех призматических. PR #1399, live-verified (Test 1 + pilota), sided_factor **1.0** (калибр VP4/SO-250/Žihle двусторонние), soul §9 #1400. Non-prismatic + pilota → honest-blank.
- **T1** — atomizer-общестрой adapter MVP. PR #1403 (squash `083b6f0`), независимо переверифицирован на слитом состоянии (**UWO 8/8, MCP-compat 29/29**), ребейз подобрал #6 + T8, чистый merge.
- **T8** — doc-counters (9→20 tools, 4→5 ról). Merged.
- **Gate C** — структура цен опалубки. PR #1388 (структура есть; ingest цен 2025 → Q8).
- _(ранее)_ Шаги 1–3: project-carrier `planProject`, geom↔takty в shared, чистка legacy — на main.

---

## 2. НА ГЕЙТЕ — recon verified по коду, ждут имплементации (сессия C)

### Fix 3 — ранжирование OTSKP (Core/retrieval) · `alias: T3 / [C] Fix3 / A-banked`
Recon verified file:line. **A-спека = C-recon сходятся.**
- **A.** Штамповать реальный `catalog_version` результата (снять хардкод `"OTSKP 1/2025"` на `otskp.py:191` и `:237`; fallback `settings.OTSKP_CATALOG_VERSION`). Намеренно обнажает раскол 2025/2026, не прячет.
- **B.** Убрать ценовой tie-break: `ORDER BY cena` (`otskp_engine.py:104`) + `unit_price_czk` как 3-й ключ ранкера → **price-free** (code asc).
- **Golden.** C30/37 без «předpjatý» → обычный ŽB **334325** выше předpjatý **334335**. Залочить.
- **Watch-1 (важно).** Если ниже есть `LIMIT` — `ORDER BY cena` мог решать *какие кандидаты выживают* (ценовой прунинг пула ДО ранкера), а не только порядок. Нужен нейтральный `ORDER BY` (code) перед `LIMIT`, иначе баг останется выше ранкера.
- **Watch-2.** Code-asc третичный = нейтрально-детерминирован, ставит базовый вариант выше специализированного → golden ок. Relevance-aware третичный = follow-up, не блокер. Главная победа — убрать цену как решающий фактор.
- **После Fix 3:** BUGS#6 — проверить, всплывает ли ещё prefab `33311` над монолитом `333326`. **Не** чинить заранее.
- MCP-compat safe (тест проверяет code/desc/unit/unit_price_czk/confidence, **не** source).

### T2 — chunk-extract → Kalkulátor · `alias: T2`
Recon verified file:line. **Ключевая находка:** `soupis_quantity_join.py` УЖЕ = ядро «document→quantified-elements» (honest-blank `quantity_status='missing'`, ambiguous-обработка, keyed на element_type).
- Поэтому: **НЕ** портировать сломанный `_deduplicate_facts:530` (склейка фактов по строке-значению в плоские списки, нет контейнера элементов); **НЕ** оживлять киоск. Свести готовое.
- **План:** (1) chunked full-text → существующий join (не плоский merge); (2) укрепить chunker (границы / overlap 500 рвущий `C30/|37` / truncation `text[:30000]`); (3) `elements[]` → Kalkulátor-шов (форма `extract_tz_fields` совпадает field-for-field).
- **Watch:** контракт входа chunker→join (join ждёт собранные факты или сырые чанки?) — проверить при имплементации.
- Разблокирует Q-итем «спрятать киоск Analýza» (Tier 2 §7.3).

---

## 3. ОЧЕРЕДЬ Phase 5 — порядок **ПРЕДЛОЖЕН** (подтвердить); одна ветка за раз
Порядок = readiness → ценность → deps → risk. Готовые к коду (Q1/Q2) впереди; [K]-итемы ниже сначала идут через recon.

| Q | Итем | alias | Заметка |
|---|------|-------|---------|
| **Q1** | Fix 3 (OTSKP ranking) | T3 / [C]Fix3 | готово к коду — §2 |
| **Q2** | T2 chunk→Kalkulátor | T2 | готово к коду — §2 |
| **Q3** | honor `element_type` в `create_work_breakdown` | TODO#1b / BUGS#5(1) | серилизуется с T1 (оба в `create_work_breakdown`); T1 merged → строится поверх. Закрывает BUGS#5(1). *Можно поднять выше Q2, если хочешь добить всю работу в `create_work_breakdown` пока свежо.* |
| **Q4** | `find_urs_code` carrier-shape | T5 | счётчики → 17940 + docstring (поля T1 уже добавил). Малый Core-cleanup, слот гибкий. |
| **Q5** | wizardHint3 parity | session-TODO#2 | быстрый, green-lit. Рек A — первый [K] после Fix 3. **Сюда же ride-along** (ниже). |
| **Q6** | multiplicity / composite-декомпозиция (опора/pilíř) | TODO#7 / «multiplicity-редизайн» | большой гейт, своё pre-impl interview, step-1 jsx↔yaml single-source. PIN: removed/refactored контрол «ручной выбор подтипа». |
| **Q7** | mostovka — фильтр производителя | TODO#8 | показывать только изделия выбранного производителя. |
| **Q8** | Gate C — ingest цен опалубки 2025 | TODO#5 / GCS `gs://stavagent-cenik-norms` PERI/DOKA | структура есть (#1388); advisor использует бакет или захардкожено (parity). |
| **Q9** | mostovka — редизайн | пробелы 06-15 | полная компоновка моста (2/1, профиль/тип NK); разнести nosníky ↔ podpěrná konstrukce (skruž); полный список опалубки из каталога. |
| **Q10** | TZ persistence в `project.json` | Шаг 4 / seam #9 | читается раз, переживает reload; `tz_facts` из persistent. **Предшествует шву.** |
| **Q11** | студия TZ + шов `tz_facts→split` | Шаг 5 / seam #10 / V1 | текст → regex-extract → AI предлагает → движок/validation → поля с provenance. **Спека шва = §4.** |

**Слот-между (гигиена; в соседнюю ветку, не отдельной docs-PR):**
- **Ride-along (из A):** stale TODO#6 + запись Fix-3-в-PLAN → В ветку **Q5** (первый [K]-итем).
- **husky pre-push сломан** (4× `--no-verify`) — починить; предохранитель сейчас выкл.
- дочек **H** (флаг «vstup ≠ TZ») · `alias: session-TODO#3` — короткий Chrome-прогон.
- **T9** — URS Perplexity.
- **Этот канон** заменяет `PLAN_Phase5_LIVE` + `STATUS_HANDOFF` → архивировать/удалить оба после принятия.

---

## 4. Спека шва (Q11) — из seam-интервью сессии B
**Рек: Option 1 ×4** (подтвердить при достижении Q11). Каждый ложится на принятую доктрину:
- **Q1 TZ vs физика → TZ = пол, физика делит дальше.** engine НИКОГДА < TZ; если этап не влезает в pour-window — делит на под-такты (>); флаг только когда вынужден превысить TZ. _(Option 2 strict дал бы документации переопределять физику — отвергнуто.)_
- **Q2 приоритет входа → ручной > TZ > авто** (confidence 0.99 > dokumentace > default).
- **Q3 охват → универсально, без регрессий; реально цель — мостовая NK** (типы без TZ-факта = как раньше).
- **Q4 UI → авто-применение + видимый badge «Záběry z TZ: N etap (§…)» + редактируемо** (как badge ODHAD в #6).
- **⚠ Разрешение дыры Q1↔Q2** (иначе имплементатор упрётся): ручной **пробивает** пол TZ (ручной выигрывает), НО ручной-ниже-TZ → видимый warning **«odchylka od PD (TZ: N etap)»**. Пол TZ связывает auto/engine-путь, не явный ручной.

---

## 5. BLOCKED
- **Fix 4 / раскол версий каталога** · `alias: T4` — нужен доступ к БД (egress закрыт). Складывается в цикл миграции (один re-embed вместе с ней). Fix 3 (Q1) намеренно обнажает раскол — это сигнал к Fix 4.

---

## 6. ОТЛОЖЕНО (parked, не в очереди)
- UI-badge, потребляющий `contact_area_source` (#6).
- MCP-проброс `contact_area_source`.
- **FORMWORK_SIDEDNESS** — односторонние семейства (gravity/tížná vs скала); появится по реальному кейсу. Принцип: живёт в `ELEMENT_CATALOG` рядом с `recommended_formwork` (свойство опалубки, не геометрии).

---

## 7. TIER 2 — post-Phase-5 (отдельные циклы, свои аудиты; разблокировано ≠ срочно)
1. **Embedding-развилка — ADR** (РЕШЕНИЕ, не билд; **ПРЕДШЕСТВУЕТ любому embedding-билду**). Свести OTSKP-миграцию (gemini-embedding-001 / 3072 / halfvec / pgvector ≥0.7) и KB-RAG (BGE-m3): один стек на оба или явно два. Без этого «одна модель на оба» невозможна.
2. **Миграция genai** · `alias: T6` + **Fix 4** одним re-embed (~17 940 векторов). Своя рекалибровка порогов под 3072. Пин `google-cloud-aiplatform==1.154.0` держит прод (vertexai removal 24.06 — только из новых релизов).
3. **Чистка киосков / спрятать Analýza** · `alias: T7 / Phase 3` — после спасения логики в T2 (Q2).
4. **KB-RAG grounded decision layer** · `alias: V2 / Session-B` — Class-1 numeric=codegen vs Class-2 prose=RAG; пилот на учебнике B6. **После ADR (п.1).**
5. **zvec / Lift** — revisit только если решённые пути недотягивают. zvec (Alibaba embedded hybrid VDB) = кандидат-генератор под детерминированный re-rank для OTSKP-матчинга. Lift (Datalab schema-constrained, 9B/GPU) = eval-on-Czech-golden, fallback для тяжёлых сканов.

---

## 8. Консолидация сессий (что закрываем, что захвачено)
- **C — выживает** как единственная сессия. Несёт §2 (Fix 3 + T2 на гейте), идёт по §3, одна ветка за раз.
- **A — закрыть.** Захвачено: Fix-3-спека (= §2, сходится с C-recon), ride-along (§3 слот, в ветку Q5), порядок [K] (§3). → soul §9.
- **B — закрыть.** Захвачено: seam-спека (§4), анализ zvec/Lift/KB-RAG (§7 п.4–5), embedding-развилка (§7 п.1). → soul §9.
