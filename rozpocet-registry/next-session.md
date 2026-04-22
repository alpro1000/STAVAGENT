# Next session — out-of-scope findings

Следующие пункты обнаружены во время аудита Registry flat layout (ветка `claude/audit-registry-flat-layout-cu8oA`, документ `AUDIT_Registry_FlatLayout.md`) и **НЕ входят в scope текущего аудита**. Требуют отдельных тасков с собственными audit / design / implementation циклами.

---

## 1. Document-navigation уровень (Conflicts § 3.4)

Конфликты выше row-level и skupina-level не адресованы Variant B (§ 4.3.10 п. 4).

- **Sheet tabs strip** между skupinами / проектами в `App.tsx:1187-1263` — `whitespace-nowrap` + counter `(N položek)` на каждой вкладке → горизонтальный overflow на mobile 375 px, навигационные кнопки `«« « » »»` занимают место и не показывают активный таб без скролла (§ 3.1 подробно).
- **Floating "корзина"** (BulkActionsBar из live-кейса пользователя — решается частично в PR 4 Rollout, но полная переработка floating geometry остаётся issue).
- **Floating "папка"** (скорее всего `FolderOpen`-trigger для ImportModal или project-level навигация — требует уточнения по скриншотам пользователя).
- **Navigator Stavba_Prodejna** — частный случай sheet tabs.
- **Взаимодействие этих панелей с bulk bar и detail panel на mobile** — z-index collision'ы, одновременное появление на одном экране.

**Почему out-of-scope текущего аудита**: task spec зафиксировал покрытие "skupiny + položky" — row-level и skupina-level. Document-level UX требует отдельного аудита с другим inventory scope (`App.tsx`, `<ProjectHeader>`, `<PortalLinkBadge>`, `<ImportModal>`, Navigator pattern Excel-like vs drawer vs tree).

**Рекомендуемый следующий шаг**: отдельная сессия "audit Registry document navigation" с фокусом на § 1.5 + § 1.6 элементы из текущего Inventory + screenshot walkthrough от пользователя с конкретными проблемными случаями.

---

## 2. Каталожная цена (OTSKP / ÚRS price comparison)

Новая функция, упомянутая в § 5.2.4 Recommendation как пример расширяемости Variant B — архитектура Variant B её поддерживает без структурных изменений, но **сам функционал требует отдельного таска**.

Scope нового таска:

- **Display-cells в row-level**: `cena jedn. katalog` (реф. цена из OTSKP / ÚRS каталога) + возможный `celkem katalog` + `odchylka %` или `odchylka Kč`. Решить — все три или только одна ячейка с комбинированным представлением.
- **Цветовая индикация variance**: паттерн `components/flat/FlatPositionsTable.tsx:489-491` из Part A — `color: 'var(--red-500)'` при `Výpočet > Katalog` (перерасход), `'var(--green-500)'` при ≤. Пороги нужно явно зафиксировать: > 0 % сразу красный или только после 5 % / 10 %?
- **3-уровневый apply**:
  - **Single** — в detail panel (§ 4.3.5) inline-поле "Cena jedn. katalog: 3 150,00 Kč · Odchylka: +2,9 %" + кнопка `[ Použít katalog. cenu → ]`.
  - **Bulk (filtered)** — новая кнопка в BulkActionsBar по шаблону существующего `Tag` → dropdown "Převést na katalogové ceny".
  - **All-document (filtered by category)** — новая кнопка в document-level toolbar "Aplikovat katalog na celý rozpočet" с фильтром по OTSKP / ÚRS и confirm dialog.
- **Edge cases**:
  - Позиция не имеет каталожного соответствия (невалидный / отсутствующий kod) — скрывать cell или показывать "—"?
  - Несколько каталожных цен для одного kod (старая vs новая редакция OTSKP) — какая версия priority?
  - Устаревший / impropoртированный каталог — показывать warning badge.
  - ÚRS vs OTSKP разные базы — указывать каталог в tooltip или рядом с ценой?
- **Preview отчёта** "Применено к N из M позиций" после bulk / all-document action — где отображать (modal / toast / в BulkActionsBar).

**Зависит от**: точности классификатора (п. 3 ниже) — apply-логика требует корректного `detectCatalog()` для filter'а "только OTSKP" / "только ÚRS".

---

## 3. Классификатор точность (false positives + false negatives)

В ходе сессии упомянуто: классификатор `detectCatalog()` в `src/utils/position-linking.ts` иногда:

- активирует интерфейс "Rozpočítat / бетонные работы" на не-бетонных позициях (false positive),
- и наоборот — не активирует на бетонных позициях (false negative).

Scope нового таска:

- Собрать **10–20 реальных примеров** из production Registry, где классификатор ошибся (нужен вход от пользователя — конкретные kod + popis + ожидаемая vs фактическая классификация).
- Определить **паттерн ошибки**: regex-miss, OTSKP keyword-miss, AI fallback ошибся, negative-context (стávajíci, odstranění) не отсёкся.
- Добавить **golden-тесты** на эти 10–20 кейсов в `test-data/` (если уже есть) или создать `test-data/classifier-golden.json`.
- **Fix по обнаруженному паттерну**: расширение regex / keyword-list / negative-context / threshold confidence'ов.

**Блокирующая для**: п. 2 (каталожная цена), п. 4 (фильтр на импорт в Monolit).

---

## 4. Стратегическое решение — множественные калькуляторы (Monolit / Pump / Formwork)

Обсуждалось в сессии: Monolit Planner получает **все** позиции из Registry, не только бетонные (current импорт pipeline). Это создаёт шум в Planner — 80 % позиций несоотносимы с бетонными расчётами.

**Принято решение — Путь 3**: фильтр на импорт "только бетонные позиции" (по результатам классификатора).

Scope нового таска:

- **Фильтр на выгрузке из Registry в Monolit Planner**: в `src/services/monolitExport.ts` (если существует — уточнить путь) или в backend-endpoint, который Monolit дёргает. Фильтр по `detectCatalog() === 'beton'` или аналогичному domain-specific predicate.
- **UI-переключатель**: "Exportovat všechny / jen betonové" — default ON для бетонных.
- **Backward compat**: существующие проекты, уже заимпортированные в Monolit с full-import'ом — мигрировать или оставить, требует решения.
- **Симметричная логика для URS Matcher / Rozpocet / других будущих киосков** — фильтр по category должен быть generic, не hardcode на beton.

**Зависит от**: точности классификатора (п. 3) — фильтр ломается при high false-negative rate (бетонные позиции не попадут в Monolit). Рекомендуется — сначала fix п. 3, потом имплементировать п. 4.

---

## Приоритизация

Если сессии ограничены по времени, рекомендуемый порядок:

1. **П. 3** (классификатор) — блокирующий для двух других.
2. **П. 4** (фильтр импорта в Monolit) — дешёвая победа после п. 3, решает production pain.
3. **П. 2** (каталожная цена) — новая feature, требует product-design обсуждения.
4. **П. 1** (document navigation) — UX improvement, важно, но не блокирует бизнес-логику.

Каждый пункт — отдельная сессия с собственным audit / design / implementation циклом, чтобы не раздувать scope одной ветки.

---

## 5. `text-text-muted` — undefined Tailwind class (~50 uses)

Обнаружено при диагностике cross-browser chevron'а. Класс `text-text-muted` используется в ~50 местах (`App.tsx`, `ItemsTable.tsx`, и другие), но **не определён** — нет ни записи в `tailwind.config.js`, ни hand-written `.text-text-muted` rule в `index.css` / `tokens.css`. Tailwind JIT не генерирует CSS для этого класса; он молчаливо игнорируется во всех браузерах. Color падает на `inherit` от родителя (обычно `.table td { color: var(--flat-text) }` = stone-900, работает), но класс бесполезен.

Scope cleanup-таска:

- **Grep по `text-text-muted`** → полный список 50+ мест.
- **Решение** (один из вариантов):
  - (a) Заменить на работающий эквивалент `text-[var(--text-muted)]` или `text-stone-500` (если введён stone-палитра в Tailwind config). Семантически точнее — использует задуманный "muted" оттенок.
  - (b) Удалить класс полностью, положиться на `color` инheritance от родителя. Быстрее, меньше шума в JSX.
  - (c) Добавить `.text-text-muted { color: var(--text-muted); }` в `@layer utilities`. Делает существующий код работающим без правок JSX.
- **Рекомендация — вариант (c)** если хочется сохранить "muted" оттенок в `Poř.` столбце, или **(a)** если начинаем миграцию на именованные stone-тон'ы. Вариант (b) теряет семантику.

**Не блокирует**: ничего — JSX работает, просто игнорируется класс. Но накапливает tech-debt и путает читающего код (выглядит как именованная Tailwind utility, которой нет).

---

## 6. PR 990 — cross-browser icons — Safari/Firefox validation pending

`fix/registry-icons-cross-browser` (PR #990) применил `w-[Npx] h-[Npx]` пары ко всем 19 lucide иконкам в `ItemsTable.tsx` + `RowActionsCell.tsx`. Root cause зафиксирован: lucide emit'ит SVG width/height как HTML-атрибуты, Safari/Firefox collapse flex-basis до 0 в virtualized row'е.

**Ждёт подтверждения на Vercel preview**:

- Chevron виден в main-row с `subCount > 0` в Safari + Firefox.
- Row ordinal number (`Poř.`) виден рядом с chevron.
- Role indicators (ClipboardList / FileText / CircleHelp) видны в actions-колонке.

**Conditional follow-ups (применить ТОЛЬКО если preview покажет что проблема не решена)**:

- **Step 2 — ordinal number clipping.** Если после фикса chevron'а номер всё ещё не виден — проблема в `Poř.` колонке: `size: 50` + overflow при переполнении контента `<button>` (chevron 11 + gap 2 + "001" ~22 + gap 2 + "+3" ~16 = 53px ≥ 50px). Решение: увеличить `size: 50 → 60` в `ItemsTable.tsx:592`, или перенести counter `+N` в отдельную колонку, или убрать counter на mobile.
- **Step 3 — `↳` character (`U+21B3`).** Если subordinate индикатор не виден — проверить font-fallback; не все sans-serif font'ы содержат глиф U+21B3. Решение: обернуть в `<span style={{ fontFamily: '"Apple Symbols","Segoe UI Symbol","Noto Sans Symbols","Symbola",sans-serif' }}>↳</span>` в `RowActionsCell.tsx:38`.

**Если preview работает — PR мержится, секция удаляется отсюда.**

---

## 7. Branch protection на main — пуши bypass'ятся

Последние 3 commit'а (accent unify, accentDark unify) пушились напрямую в `origin/main` и получали предупреждение от remote:

```
remote: Bypassed rule violations for refs/heads/main:
remote:   - Changes must be made through a pull request.
```

Это означает: правило "require PR" на main существует, но мой access bypass'ит его. Если хочется enforce'ить PR-flow для всех, включая меня — настроить rule в GitHub repo settings: **Settings → Branches → main → Restrict who can bypass required pull requests → снять все галочки**. После этого прямые пуши будут отклоняться; останется только PR → review → merge путь.

**Не cleanup-таск, а process decision**: решить, нужен ли такой enforce или текущий режим (user explicitly authorizes прямой push через чат) удобнее.

---

## 8. PR 2-B — per-group inline toolbars inside virtualized ItemsTable

PR 2 ship в ветке `claude/registry-toolbar-group-Qophc` реализовал **Variant B (single active-skupina toolbar above table)** из трёх рассмотренных в AskUserQuestion. AUDIT §4.3.4 идеально описывает **inline per-group toolbars** ("когда фильтр off — toolbar рендерится над КАЖДОЙ skupinой в скроллируемой таблице"), но это требует:

1. **Принудительная сортировка по `item.skupina`** — пересекается с существующим click-to-sort по колонкам (`ItemsTable.tsx:1056-1072`). Нужно решить: либо skupina-группировка перекрывает сортировку (как в Excel PivotTable), либо toolbars остаются sticky по скроллу + ручная сортировка оставляет visual несоответствие (item выпадает "не из своей секции").
2. **Variable-height virtualizer rows** — `useVirtualizer` сейчас с `estimateSize: () => ROW_HEIGHT` (32 px константа, `ItemsTable.tsx:980`). Для toolbar-рядов нужен `measureElement` + mixed row kinds (item vs toolbar). react-virtual это поддерживает, но требует переписывания `rowVirtualizer.getVirtualItems()` цикла — увеличенная поверхность риска регрессий в существующей таблице.
3. **Синтетические rows в data stream** — нужно выстроить derived list `[{ kind: 'toolbar', skupina, count, total }, { kind: 'item', ... }, …]` вместо плоского `visibleItems`.

**Scope PR 2-B** (когда брать):
- Ввести режим "group by skupina" с toggle в toolbar (по умолчанию off → текущее поведение, on → синтетические toolbar rows). Toggle разблокирует visual хаос при ручной сортировке.
- Переписать `rowVirtualizer` на variable heights + 2 row kinds.
- Скопировать action set из текущего `SkupinaToolbar` в inline вариант (per-row activeSkupina = the header's own skupina).
- Оставить текущий single-toolbar above-table surface как fallback при group-by-off.

**Estimate**: M-L, 2-4 дня. Не блокирует PR 3 (detail panel), PR 4 (extend bulk bar), PR 5 (click-cells) — те работают с текущим плоским рендерингом таблицы.

---

## 9. Floating panel geometry conflicts (Conflicts § 3.4) — Mobile 375 px

PR 2 single-toolbar above-table решает §4.3.4 но не трогает геометрию уже существующих floating overlays, которые на mobile 375 px могут накладываться друг на друга при одновременной активации:

- `<BulkActionsBar>` `fixed bottom-6 left-1/2 z-50` + `<TOVModal>` `fixed inset-0 z-50` + `<ImportModal>` + `AlertModal` + Role dropdown portal (`RowActionsCell.tsx:208-249`) + Attach-to-parent modal (`RowActionsCell.tsx:262-405`).
- z-index collisions когда 2+ overlays открыты одновременно (selection + TOV + import).
- "Корзина" / "папка" навигаторы проекта из live-кейса пользователя (out-of-scope PR 2 — упоминание в task spec).

**Scope**: отдельный UX-таск с скриншотами пользователя, audit z-index стека, возможно переход на bottom-sheet pattern на mobile вместо fixed pills.

**Estimate**: M, 1-2 дня. Не блокирует PR 3-5.

---

## Приоритизация — обновлённая после сессии 2026-04-22

1. **П. 6** (PR 990 validation) — блокирует Registry production UX для не-Chrome пользователей.
2. **П. 3** (классификатор) — блокирующий для п. 2 и п. 4.
3. **П. 4** (фильтр импорта в Monolit) — дешёвая победа после п. 3.
4. **П. 5** (`text-text-muted` cleanup) — tech-debt, не блокирует.
5. **П. 2** (каталожная цена) — новая feature.
6. **П. 1** (document navigation) — UX improvement.
7. **П. 7** (branch protection) — process decision, не код.

PR 2 Variant B (single active-skupina toolbar above table) отправлен в ветке `claude/registry-toolbar-group-Qophc`. PR 2-B (п. 8 выше — per-group inline rendering), PR 3 (detail panel), PR 4 (extend BulkActionsBar), PR 5 (click-cells) остаются в плане `AUDIT_Registry_FlatLayout.md` §5.3.1 и идут отдельными тасками.
