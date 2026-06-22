# Отчёт сессии — 2026-06-12: Part B + сервис «как часы» (MCP / фронт / ИИ-помощник)

**Сессия:** Claude Code, ветка `claude/bold-hawking-v2e7b4`
**Статус:** Part B смержен (PR #1347 → main `187f7c0`); полировочный раунд — коммит `49b59b2`, PR создаётся после зелёного CI.

---

## 1. Что сделано — хронология

### 1.1 Part B — правило валидации «вход калькулятора vs технология из TZ» (PR #1347, MERGED)

- **Интервью закрыто до кода** (3 вопроса): носитель факта = additive `PlannerInput.tz_facts` (экстрактор не тронут, regex = Part C); поверхность = ⚠️-строка в `warnings[]` + структурный сиблинг `validation_flags[]` (зеркало `resource_violations`); реестр = минимальный список, не фреймворк.
- **Новый модуль** `Monolit-Planner/shared/src/calculators/validation-rules.ts`: `ValidationFlag` {rule_id, severity, message, tz_value, tz_quote, tz_anchor, input_value}, `VALIDATION_RULES`, `runValidationRules(ctx)`. Батч физических правил (Patterns 51–55) после Part C просто push'ится в этот же список.
- **Правило `tz_construction_consistency`** (generic): фасет технологии (pevná skruž / MSS / letmá) + фасет числа тактов (против engine-resolved `pour_decision.num_tacts`). Противоречие = **видимый флаг, не гейт** — сам Žalmanov TZ §4.1.6: «Postup výstavby může budoucí zhotovitel upravit dle svých možností a potřeb». Сообщение одной строкой проговаривает последствия (статика стадий, spojky kabelů, новый TePř). Совпадение / неизвестная документация = тишина.
- **Проведено в обоих путях сборки** (main §8c + pile-зеркало). Расписание и все расчёты движка не тронуты.
- **TZ-facts digesty** (дополнение Алекс.): дословные цитаты с якорями секция+страница, извлечены pdftotext из обоих TZ и сохранены рядом с PDF:
  - `test-data/SO_202_D6_KV_OV/D-01-02-01_01_tz_facts.md` — §7.2 стр. 34 «Předpokládá se betonáž NK na pevné skruži v jednom taktu.» (+ §6.11.3 стр. 32); отдельно отмечена ловушка: «po etapách» в §7.2 = дорожные этапы, не такты.
  - `test-data/SO_202_D6_OV_Z/202_01_TechnickaZprava_tz_facts.md` — §4.1.6 стр. 11 «…na pevné skruži ve třech etapách» (O1→O4) + §5.1 стр. 15.
  - Оба с provenance-шапкой; источник фикстур Part B + целевые фразы regex Part C. Большие PDF остаются за deny-правилами — md читаемы всегда.
- **12 hermetic-тестов**: unit-реестр; KV обе стороны (1 takt чисто / 6 taktů → флаг §7.2 в обеих поверхностях, план создаётся = не гейт); Žalmanov ВРЕМЕННАЯ фикстура обе стороны; негатив-тишина. **1294 shared tests** (было 1282).

### 1.2 MCP `calculate_concrete_works` — 3 молча терявшихся параметра (коммит `49b59b2`)

Аудит показал: `width_m`, `formwork_length_bm`, `cycle_length_bm` есть в сигнатуре и docstring, но `_build_planner_payload` их **не пересылал** (регрессия SSOT-делегации #1304 против pre-SSOT локального движка). Теперь — точный перевод в канонические поля:

| MCP-параметр | Куда уходит | Семантика |
|---|---|---|
| `width_m` | `nk_width_m` (mostovka) / оценка `formwork_area_m2` | V/tl. horizontal; V/š×2 vertical — формула идентична pre-SSOT |
| `formwork_length_bm` | `formwork_area_m2` | bm-системы потребляют area-вход как количество в юните системы |
| `+cycle_length_bm` | `num_tacts_override` | римса: ceil(L/cyklus); 156 bm / 26 → **6 záběrů** (было: дефолт 1) |

Replay-фикстуры перегенерированы локальным `planElement` (тот же SSOT-код, что на Cloud Run); +2 теста. **MCP compat 27/27.**

Цепочка подтверждена: MCP → `POST /api/calculate` → `planElement` (shared) → полный `PlannerOutput` **verbatim**, включая `warnings[]` и новые `validation_flags[]` — Part B-флаги автоматически видны и в MCP, и во фронте (Varování card), без доп. работ.

### 1.3 ИИ-помощник = зеркало оркестратора (коммит `49b59b2`)

- **Корневой баг найден аудитом:** фронт шлёт обогащённые поля (exposure/curing/span/`computed_results`…) **внутри** `calculator_context`, а backend деструктурировал их с **верхнего уровня** body → секции промпта «MOSTNÍ NK / PŘEDPĚTÍ / JIŽ SPOČÍTÁNO ENGINE» никогда не срабатывали с реального фронта; LLM не видел результатов движка и мог их противоречить. **Фикс:** merge `{...calculator_context, ...req.body}` (верхний уровень выигрывает, старые вызыватели не ломаются).
- **computed_results расширены:** pour_mode, pour_hours_per_tact, pumps_required, имя системы бednění, top-6 варований движка (включая Part B validation-флаги) — уходят и в промпт, и в context multi-role.
- **Промпт:** секция «JIŽ SPOČÍTÁNO» печатает все engine-факты + новая секция «VAROVÁNÍ ENGINE»; правило «nastav recommended_tacts a pour_mode na STEJNÉ hodnoty — твоя добавленная ценность = key_points / risks / normy».
- **Защита от противоречия (фронт):** если AI вернул `recommended_tacts ≠ engine num_tacts` → значение перезаписывается engine-числом + видимая пометка в warnings («platí engine»). Никогда тихого override.
- **Робастный JSON-парс** ответа LLM (прямой parse → outermost-brace slice), null-гарды, fallback-рендер больше не мрзачит запятые в прозе.
- **Backend Jest 58 → 60.**

### 1.4 Проверки

| Поверхность | Результат |
|---|---|
| Shared vitest | **1294/1294** ✓ |
| Backend Jest (Monolit) | **60/60** ✓ |
| MCP compat (Python) | **27/27** ✓ |
| tsc shared + frontend | clean ✓ |
| vite build frontend | clean ✓ |
| CI на Part B `811624b` | Shared Package Tests ✓ + Monolit Planner CI ✓ |
| **Security review диффа** | **0 находок** — оба top-кандидата (body merge и LLM JSON parse) трассированы end-to-end: все user-данные оканчиваются в LLM-промпте / JSON-POST на фиксированный внутренний URL / React-экранированном рендере / чистой арифметике с floor-гардами. Ни SQL, ни fs, ни exec, ни user-controlled URL, ни `dangerouslySetInnerHTML` |

---

## 2. Как теперь течёт «один результат везде»

```
                planElement (shared, SSOT — 7 движков + validation rules)
                        │  PlannerOutput (вкл. warnings[] + validation_flags[])
        ┌───────────────┼──────────────────────┐
   Frontend          /api/calculate          MCP calculate_concrete_works
   useCalculator     (verbatim res.json)     (verbatim + source, поля больше
        │                                     не теряются)
   CalculatorResult — таблица/карточки,       Claude.ai / ChatGPT видят
   Varování card рендерит ⚠️ флаги            полный план + флаги
        │
   AI advisor — получает computed_results (вкл. флаги),
   промпт зеркалит движок, противоречие = перезапись + пометка
```

---

## 3. Не сделано / дальше (по приоритету)

1. **Part C** — regex-экстракция технологии из TZ (целевые фразы уже в `*_tz_facts.md`), полный Žalmanov golden, замена ВРЕМЕННОЙ фикстуры.
2. **Деплой**: merge тригерит Cloud Build (concrete-agent + monolit) и Vercel — проверить живой `/mcp` + kalkulator.stavagent.cz после раскатки (advisor live-валидация = существующий P0 в backlog).
3. P1 backlog без изменений (warnings_structured Phase 2 UI-рендер по severity, NEÚPLNÉ label, и т.д.).

---

## 4. Git-след

- PR **#1347** (Part B) — merged → main `187f7c0` (merge commit, Pattern 12).
- Полировка: коммит `49b59b2` на `claude/bold-hawking-v2e7b4`, PR после зелёного CI (этот же отчёт прилагается).
- soul.md §9: запись Part B + dodatek polish-раунда; CLAUDE.md v4.37.0 → v4.37.1.
