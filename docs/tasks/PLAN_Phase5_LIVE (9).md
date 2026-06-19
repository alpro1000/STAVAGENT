# PLAN_Phase5_LIVE — живой трекер Фазы 5 (калькулятор: элемент → проект)

**Принцип:** дедлайнов нет. Конкурс ≠ дедлайн. Делаем всё и до конца.
Этот файл обновляем КАЖДЫЙ цикл: DONE / ADDED / BUGS / TODO.
Порядок работ — по зависимости, не по спешке.

_Обновлено: 2026-06-17_

---

## DONE (на main, live)
- [x] Шаг 1 — project-carrier `planProject()` поверх one-element ядра; агрегация объём/Nh/деньги/расписание (#1353)
- [x] Шаг 2 — геометрия↔такты на уровне элемента; общий geom-rule в shared (#1357)
- [x] Шаг 3 — чистка legacy/мёртвых полей (PR #1363, merge `fc45bc6`; фронт раскатан READY; CI зелёный)
- [x] Live-подтверждено: A (объём=120 из геометрии), B (advisor реагирует на членение)
- [x] Live: apply-путь PR2 verified — «Přijmout doporučení» доносит рекомендованное (A0=3 → A1=R=2), C1/C3 PASS, идемпотентность по UI-гарду (кнопка исчезает) → **PR2 = done**
- [x] **PR3 #1365** — dedup redundant smart-defaults effect (merge `33c421b8`; фронт раскатан READY). _Length-field physical dedup отложен в multiplicity-редизайн (Step-2 связал поведенчески; физический merge сцеплен с geometry↔tacts)._
- [x] **БАГ ВЫСОТЫ — ИСПРАВЛЕН (PR #1372, `88d7e8a`).** Корень: `NumInput` (общий числовой компонент, ui.tsx) коммитил на BLUR, не onChange → набранное показывалось в поле, но объём/формула/boční tlak читали старое committed-значение до blur. Фикс (Option A): commit live на onChange, clamp min/max перенесён на onBlur, draft для стабильности курсора. + первый фронт DOM-тест-раннер (vitest+jsdom+@testing-library/react), 6 тестов timing'а. soul §9 = PR #1373. Verified фронт 9/9, goldens+parity 37/37, tsc 0.
- [x] **§4 parity Гейт A (PR #1384, `4d3ce41`)** — карточка бетонщиков читает engine `pour_crew_breakdown.total` вместо inline `max(3,ceil(V/20))`. Чинит реальный 6→5.
- [x] **§4 parity Гейт B (PR #1385, `1647295`)** — рекомендация tesařů из движка (`buildLaborProjection.formwork_recommended_crew`), из ТОГО ЖЕ `totalFwNh` что labor-расчёт; `0.6 Nh/m²` убран; honest-blank без `contact_area`. soul §9 A+B = PR #1386 (`fca8239`, текущий прод READY).

## ADDED по ходу (вне исходного плана)
- N-инвариант вынесен в shared-хелпер + vitest (фронт не имел тест-раннера)
- Двухуровневая модель зафиксирована как форма редизайна (позиция → элементы → záběry)
- Chrome-протокол аудита с критериями A–I, порезан на 3 независимых прогона

## BUGS / FINDINGS (по порядку)
1. [ ] **«C» ПЕРЕКЛАССИФИЦИРОВАН — это НЕ silent loss.** Hermetic-repro через реальный движок: монолит-стена 4 м → num_tacts=1 (физически верно), 8 м → 2 (pressure-staging срабатывает). Auto/Ručně ничего не подавляет; apply-путь PR2 НЕ виноват. Реальный дефект мелкий и advisory: `wizardHint3` (wizard-only) считает staging по ВСЕМ системам опалубки, а движок — по pressure-отфильтрованным → хинт показал 2, движок дал 1. **Фикс = one-line: хинт фильтрует как движок (advisory = authority).** Носитель не трогает. (Файл `TASK_Fix_ApplyRucne_LostRecommended.md` устарел — premise опровергнут.)
2. [x] **apply-путь PR2 — ПРОВЕРЕН live, ЧИСТ.** «Přijmout doporučení» доносит рекомендованное в носитель (A0=3 → A1=R=2); C1 PASS (A1=S×tps=2), C3 PASS (A1≥R); идемпотентность — UI-гард (кнопка исчезает «✓ už použito», повторно применить нельзя). **PR2 = done.**
3. [x] **H — RESOLVED, НЕ баг.** Hermetic end-to-end на main: regex `pevn\w*\s+skruz` уже ловит склонения (pevné skruži / pevnou skruží / pevná skruž — все → pevná skruž); цепочка tz_facts подключена (useCalculator → planElement → runValidationRules); правило срабатывает на реальном противоречии (form=letmá vs TZ=pevná skruž ✓; form=pevná vs TZ=letmá ✓). В аудите форма И TZ совпадали (pevná skruž) → правило корректно молчало = **H был незавершён** (Chrome не создал mismatch; letmá была disabled на 30 м). Re-тест: TZ с одной технологией + вручную переключить radio на ДРУГУЮ на НЕзаблокированном элементе. Кода НЕ меняли.
4. [x] **БАГ ВЫСОТЫ — RESOLVED (PR #1372).** Был не «смена типа сбрасывает V», а `NumInput` commit-on-blur: расчёт читал старое committed-значение пока не уйдёшь из поля. Фикс = commit live onChange, clamp на blur. Прежний «все числа врут» — артефакт browser-агента, печатавшего без blur, НЕ порча данных. Подробности в DONE.
5. [ ] **CATALOG-BINDING БАГ — воспроизведён на боевом SO 206 (`create_work_breakdown`, 2026-06-17).** Композитная агрегация структурно работает (10 элементов → 50 работ, HSV2/3/4-группировка верная, объёмы протянулись точно), но code-binding слой выдаёт мусор:
   - **(1) Игнор явного `element_type`.** Передал `driky_piliru`/`kridla_opery` явно → тул переклассифицировал ВСЁ по keywords (`classification_source:"keywords"`) в `opery_ulozne_prahy` (имена содержат «opěry/křídlo»). Непоследовательно: «Základ opěry pod **dříky**»→`opery_ulozne_prahy`, «…pod **křídly**»→`zaklady_piliru`. Keyword-классификация перебивает явный тип.
   - **(2) Template→code binding для `opery_ulozne_prahy` = мусор.** bednění→`18481 OCHRANA STROMŮ`, beton C35/45→`91791 ZPOMALOVACÍ PRAHY` (асфальт!), výztuž→`382365 VÝZTUŽ NÁDRŽÍ`, один код 91791 на 3 разные работы. `zaklady_piliru`-путь дал ПОЧТИ верное (272315, 334365) → сломана binding-таблица именно семьи опор.
   - **Контраст:** прямой `find_otskp_code` верно дал 333326 (11128,99 Kč/m³, conf 0.83). Retrieval работает; template-binding сломан. → чинить как §4c / Pattern 15 (Work-First, Catalog-Last) путь; seed композита валиден.
   - **(3) Keyword-gap классификатора — подтверждён ВТОРЫМ независимым прогоном (внешний Opus 4.8 через MCP, 2026-06-17).** `zárubní zeď` / `opěrná zeď` не матчатся по ключевым словам → падают в `jine` (conf 0.3); `operne_zdi` локается только при явном `element_type`. Тот же класс бага, что (1). Registry-фикс (добавить `zárubní/opěrná zeď` в реестр ключевых слов), НЕ rename. _Заметка: это доктрина в действии — система не угадала, а честно показала conf 0.3 и блокнулась (honest-blank). Отдельный таск: audit → один тип реестра → hermetic-тест «zárubní zeď → operne_zdi conf≥0.8»._

## TODO по плану (порядок = зависимости)
1. [x] **БАГ ВЫСОТЫ — фикс смержен (PR #1372).** См. DONE/BUGS#4.
2. [ ] One-line фикс `wizardHint3` (`filtered`, не `allSystems`) — свежая ветка, hermetic-guard «hint ≡ engine» (4 м→1 / 8 м→2), STOP до ревью. _Зелёный свет дан; ждём дифф. Таск-файл `TASK_Fix_WizardHint3_Parity.md` готов, НЕ диспатчен._
3. [ ] H re-тест (НЕ фикс): TZ с одной технологией + ручной mismatch radio на незаблокированном элементе → флаг «Vstup se odchyluje od dokumentace» должен появиться. Плюс soul §9-заметка, чтобы не перезаводить как баг.
4. [~] **§4 parity — A+B СМЕРЖЕНЫ (см. DONE). Остаётся (c) каталог опалубки = Гейт C (см. #5).** Advisor = зеркало Core. (a) бетонщики ✓ читают engine, (b) tesaři ✓ из движка single-source.
5. [ ] **§4 Гейт C — каталог опалубки, Variant 1 (ВЫБРАН).** Ingest-скрипт читает бакет `gs://stavagent-cenik-norms/` (PERI/DOKA 2025) → генерит каталог-данные В РЕПО → коммит; advisor НИКОГДА не читает бакет в рантайме (детерминизм, replay-safe, goldens hermetic, дифф цен 2024→2025 ревьюится). Подтверждено: бакет не читается нигде (grep=0); каталог = хардкод `formwork-systems.ts` (DOKA 2024) + `doka-frami-catalog.ts`. Audit-before-code, STOP до merge.
6. [ ] **НОВЫЙ ГЕЙТ — деривация площади опалубки из геометрии (рядом с Гейтом C).** Движок деривит `contact_area` из `formwork_area = 2(L+Š)×V` когда не введена, с пометкой **ODHAD**. Тогда норма-часы И рекомендация бригады tesařů (Гейт B) работают на ВСЕХ элементах, не только где руками вбита `contact_area`. Сдвинет labor-basis → goldens пересниматься. Своё audit + pre-implementation interview.
7. [ ] **ОБЪЕДИНЁННЫЙ ГЕЙТ — композитная декомпозиция opora/pilíř (свод #7+#9+#11, правка Александра 2026-06-17).** Родитель-композит раскладывается на под-элементы; родитель держит коммерческую идентичность (catalog code + billed qty), дети — конструктивную деталь. Двойное имя «Dřík opěry/pilíře» НЕ нужно — родитель задаёт контекст, `drik_opora`≠`drik_pilir` это разные дети разных родителей.
   - **УЖЕ СПРОЕКТИРОВАНО — не с нуля:** `TASK_Phase_PositionDecomposition_SubElements_UI.md` (архитектура master-detail: rollup Σ детей, lowest-child-confidence → parent, two-mode geom exact/approximate, záběr из шаблона) + `GeometryCalculator.jsx` (`ELEMENT_CATALOG` уже кодирует opora→[zaklad, drik_opora, zavrsenni_zidka, kridla]; pilir→[zaklad, drik_pilir, hlavice]; mostovka→[deska, tram, rimsa]).
   - **ПЕРВЫЙ ШАГ ГЕЙТА — устранить jsx↔yaml рассинхрон:** онтология opora→дети живёт в `GeometryCalculator.jsx`, но НЕ в shared `element_types.yaml` (там плоские `opery_ulozne_prahy`/`driky_piliru`/`mostni_zavirne_zidky` без parent→child). Перенести декомпозицию в `element_types.yaml` (single-source) → фронт И MCP читают ОДНУ структуру = «один путь расчёта фронт↔MCP» (паритет composite = Σ elements, на уровень выше advisor=Core).
   - **Таксономия (из `STAVAGENT_Complete_Element_Catalog.md`):** OPĚRA = základ opěry + dřík opěry (V, 80–120 kg/m³, stěnové, záběry 1.5–3m) + závěrná zídka + 2× křídlo. PILÍŘ = základ pilíře + dřík pilíře (V, **120–180 kg/m³**, šplhací >6m, geodézie/záběr) + hlavice (если не просто столб). Различие dřík opěry↔pilíře: арматура (80–120 vs 120–180), bednění (stěnové vs šplhací/kruhové), технология — родитель разводит автоматически.
   - **Římsa — ОСТАВИТЬ ОТДЕЛЬНО (правка Александра):** часто делается самостоятельно (не как под-элемент мостовки) — отдельная позиция, не тащить в композит NK.
   - **gap-типы добавить:** `úložný práh` (сейчас слит в `opery_ulozne_prahy`; для опор с ложисками — анкеры ±2мм), `dřík opěry` в `element_types.yaml` (есть в jsx как `drik_opora`, нет в yaml — источник путаницы), `hlavice pilíře`.
   - **multiplicity-seed:** тоггл «Zahrnout křídla opěr (samostatná sada bednění)» = наполовину готовый композит → обобщить в список под-элементов. `create_work_breakdown(elements=[...])` массив = готовый MCP-seed агрегации (структурно работает на SO 206; binding чинится отдельно, BUGS#5).
   - Поставщик мыслит «sada на дилатацию» (DOKA-набор) — комплект переставляется по дилатационным секциям.
   - Своё audit + interview. ПОСЛЕ catalog-binding (BUGS#5) + деривации площади (#6).
8. [ ] **Выбор производителя — два цельных варианта по поставщику (правка Александра 2026-06-17).** НЕ смешанный. Advisor предлагает по ОДНОМУ цельному комплекту на производителя:
   - **A: всё DOKA** / **B: всё PERI** / (опц. **C: всё ULMA**…) — единая система внутри варианта по всему объекту.
   - Смешанный (поэлементно-оптимальный) — только справочно «inženýrské minimum», НЕ дефолт, НЕ один из выборов (на стройке два проката не держат: двойная логистика/склад/приёмка).
   - `preferred_manufacturer` должен РЕАЛЬНО фильтровать рекомендацию (сейчас проходит в параметрах, но advisor его игнорирует → выдал VARIO GT 24 PERI на dřík + Frami DOKA на křídlo).
   - Подтверждено DOKA-набором: Framax Xlife единым поставщиком на dřík+křídlo, Frami на základ.
9. [ ] Шаг 4 — TZ persistence в project.json (читается раз, держит, переживает reload; tz_facts из persistent)
10. [ ] Шаг 5 — студия TZ (текст → regex-extract → AI предлагает → движок/validation проверяют → поля с provenance)

## Продуктовые пробелы мостовки (находки 2026-06-15 → в редизайн/каталог)
- [ ] Нет полной компоновки моста (2 моста рядом / один; профиль/тип NK)
- [ ] Нет разнесения nosníky ↔ podpěrná konstrukce (skruž) в форме
- [ ] Список опалубки неполный — нельзя выбрать всё из каталога
- [ ] (= TODO#8) Выбор производителя не фильтрует чужие изделия (должны показываться только его)
- [ ] (= TODO#5) GCS-каталог опалубки — используется ли advisor'ом

## Гейты дисциплины (каждый расчётный PR)
- audit before code; STOP gate перед merge; additive, без параллельных структур
- hermetic-тесты (без AI/network); goldens KV+Žalmanov+нормы держатся
- паритет one-element пути; verbatim CI на финальном HEAD; soul.md §9 post-merge
- ЖИВАЯ проверка на kalkulator.stavagent.cz после деплоя — не «done», пока не прогнано на сайте
- naming по конвенциям репо

---

### Двухуровневая модель (вход в multiplicity-интервью)
```
позиция (одна строка сметы, один итог)
  └─ список элементов (внутр. разбивка: základy-piliře, základy-opory…)
        каждый: тип + количество + геометрия → объём
        └─ záběry/takty этого элемента (наибольший = bottleneck)
```
- Ручной фронт: одна позиция, вернуть ручной выбор подтипа + внутренний «расчёт
  элементов»; в таблицу уходит общая сумма.
- MCP/агент: считает каждый элемент раздельно и складывает (детальный план).
- project-carrier (Шаг 1) обслуживает ОБА surface — редизайн в основном
  переэкспрессия на фронте, не новая модель в движке.
- PIN: найти точный removed/refactored контрол «ручной выбор подтипа как было раньше».

### SEED: композит-опора O1 (worked example для multiplicity-интервью)
Боевой кейс (D6 Olšová Vrata–Žalmanov, SO-202, opěra O1) доказал двухуровневую
модель на проде. Одна позиция «Opěra O1» = композит под-элементов:
```
Opěra O1 (позиция)
  ├─ základ opěry        13,65 × 4,15 × 1,1   C30/37  XC2+XF1+XA2
  ├─ dřík opěry          11,7  × 2,0  × 1,75  C30/37  XC4+XD3+XF4   (большой → неск. тактов)
  ├─ úložný práh         11,7  × 2,0  × 0,8   C30/37  XC4+XD3+XF4
  ├─ závěrná zídka       (геом. TBD)          C30/37  XC4+XD3+XF4
  └─ křídla 2×           5,0   × 0,75 × 3,0   C30/37  XC4+XD3+XF4
  → агрегат объём/Nh/деньги; наибольший такт = bottleneck (в O1 — dřík)
```
Точка обобщения УЖЕ в коде: тип «Opěry, úložné prahy» имеет тоггл
**«Zahrnout křídla opěr (samostatná sada bednění)» + «Výška křídel»** — это
наполовину готовый композит (крыло = доп. под-элемент со своей опалубкой, но
захардкожено и непрозрачно). Редизайн: вместо одного тоггла «крылья» — позиция
держит СПИСОК под-элементов, каждый: тип + геометрия + свои такты. dřík с
большим объёмом → несколько тактов внутри своего под-элемента.

Live-находки O1 (в каталог/редизайн):
- O2 FAIL — нельзя ввести опору как одну позицию (подтверждено на боевом кейсе).
- O1 FAIL — нет типов «Základ opěry», «Dřík opěry»; «Sloup» даёт ложное warning высоты.
- O4/O5 PASS — bednění стеновое (MEGALITE/DUO, не skruž), předpětí на опору не лезет.
- O3 — XC4+XD3+XF4 + C30/37 принимается; проверить: smart-default не понижает класс
  ниже expozice-минимума (видели C30/37→C25/30 на «Sloup»).

### SEED-2: композит-опора SO 206 (боевой PDPS, прогнан через MCP 2026-06-17)
D6 Olšová Vrata–Žalmanov, SO 206 — přesypaná ŽB rámová konstrukce, 1 pole 13,4 m,
šířka 35,54 m, 2 dilatační celky, plně integrovaný most (TP 261, bez ložisek/závěrů).
Позиция VV: **«MOSTNÍ OPĚRY A KŘÍDLA ZE ŽB DO C40/50» = 600,243 m³** (OTSKP 333326,
11128,99 Kč/m³ → beton-строка ≈ 6 680 098 Kč, conf 0.83, OTSKP 1/2025).
Объём проектанта (подтверждён арифметикой):
```
Opěra SO 206 (позиция, beton C35/45 XF4 XD3)
  ├─ dřík opěry × 4 (рамовые стойки)  0,9 × Σploch(119,819+110,456+124,898+115,231) = 423,364 m³
  │     výztuž ФАКТ из чертежей ≈ 131,8 t (≈310 kg/m³ — рамовые рога интегрального, проверить)
  ├─ křídla × 4                       0,8 × Σploch(58,810+51,526+52,852+60,243)   = 178,745 m³
  │     výztuž ФАКТ ≈ 19,5 t (~100 kg/m³, сходится с движком 90)
  └─ zkosení křídel (вычесть)         0,045 × 41,460                              = −1,866 m³
  → ИТОГО 600,243 m³ ✓
```
Per-element production (calculate_concrete_works, поэлементно):
- dřík (112,41 m³, h6,8, tl.0,9): VARIO GT 24, boční tlak 136 kN/m², 1 záběr (column
  exemption h≤8m) — НО как 18-м СТЕНА при 136 kN/m² нужны 2 záběry; type-fit пробел
  (нет «stěnová opěra/dřík opěry», я взял driky_piliru). ~13 дней/ks.
- křídlo (48,19 m³, h6,0, tl.0,8): Frami Xlife НА ГРАНИ (120,1 kN/m²) → 2 záběry по 3м;
  движок советует Framax Xlife. ~8 дней/ks.

Структура поставщика (DOKA Nabídka 540045359 — единый поставщик на объект):
```
Opěra:    Základ → Frami Xlife 57,3 m² (sada 1×základ/1 dilatace)
          Dřík opěry → Framax Xlife h6,6m 237 m² (sada 1×opěra/1 dilatace)
          Křídlo → Framax Xlife h7,65m 163 m² (sada 1×křídlo)
Mostovka: Vrchní WS10+H20 / Podpěrná Staxo 100 / boky Římsové bednění T
Římsy:    Římsové bednění T
```
→ подтверждает гейты #7 (тип «Dřík opěry»), #8 (единый поставщик Framax), #9 (опора =
список под-элементов со sada на дилатацию).

MCP create_work_breakdown (composite, 10 элементов): структура ✓ (50 работ, HSV2/3/4,
объёмы точны), но catalog-binding = мусор (BUGS#5). Итог 18,5М Kč доверять нельзя;
доверять beton 600,243 × 11128,99 из find_otskp_code.
