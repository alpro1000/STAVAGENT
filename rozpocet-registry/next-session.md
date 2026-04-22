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
