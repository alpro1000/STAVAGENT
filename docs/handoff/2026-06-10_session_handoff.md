# Session handoff — 2026-06-10 (front-half sealed live)

**Session arc:** calc-passthrough gate → doc→quantified-elements design → P1/P2/P3 →
scoped real-data validation → Gap A → live-seal blockers → **живая печать PASSED**.
Per-phase PR model (each phase = own PR off fresh main, CI-proof on final HEAD,
Alexander merges). Read together with `docs/soul.md §9` entries 2026-06-08…06-10.

---

## 1. Состояние main — что смержено этой сессией

| PR | Одной строкой |
|---|---|
| **#1319** | Calc-output + confidence passthrough: PlannerOutput subset + warnings доезжают до work-items и deliverable (`calc_summary`/`calc_warnings`, honest-blank `NEPOČÍTÁNO`). |
| **#1320** | docs: §9 запись для #1319 (post-merge docs-проход — стандарт с этой сессии). |
| **#1321** | P1: чистый soupis→element join (`map_soupis_to_elements`) + TS-зеркало volume-geometry c **parity drift-guard** (парсит `element-classifier.ts`; TS-файл в CI trigger-paths). |
| **#1322** | P2: DOCUMENT_ANALYSIS вызывает `extract_tz_fields`+`parse_construction_budget` → join → quantified `elements[]` + `quantification_summary`; divergence до deliverable с ingest-identity (`origin: "ingest:soupis_vs_geometry"`, НЕ calc-warning); fallback на `options['elements']`. |
| **#1323** | P3: env-gated live e2e (`STAGEGATING_LIVE_E2E=1`, skip-by-default, НЕ CI-gate) + runbook `docs/specs/doc_to_quantified_elements/e2e_runbook.md`. |
| **#1324** | Gap A: budget-тул content-sniff'ит формат → KROS XML в KROS-парсер (3373 позиции вместо тихого 0); honest-error на неизвестном формате; corpus-gated golden на реальном SO-202 XML до join'а. |
| **#1325** | docs: §9 Gap A post-merge + runbook на XML (xlsx-caveat снят; one-liner извлечения TZ-текста). |
| **#1327** | Live-seal blockers: **б-zero** (миграция `012_orchestrator_tables.sql` — sessions+audit+trigger, plain UUID БЕЗ FK; provisioning УДАЛЁН — ноль записей в Portal-таблицы) + deploy-env кодифицирован (JWT_SECRET secret-ref; `_REDIS_URL`/`_VPC_CONNECTOR` substitutions, empty-safe bash-step) + drift-guard на orchestrator-таблицы (`SchemaDriftError` fail-fast на старте). |
| **#1328** | docs: §9 closeout (#1327 + печать PASSED + vestigial-ALTER note). |

**Задеплоено в прод:** ревизия с Gap A (#1324) + миграцией 012 (применена startup-runner'ом)
+ кодифицированным env (JWT_SECRET из Secret Manager переживает деплой). Это ревизия,
против которой прошла печать.

## 2. Живая печать: PASSED ✅

`pytest tests/test_p3_live_e2e_orchestrate.py` против **deployed стека**
(Cloud Run + Cloud SQL + Portal JWT + живой Monolit): **1 passed, 19.32 s**.
Вход: реальный `E_Soupis praci_XC4_DI-009.xml` + TZ-текст из
`202_01_TechnickaZprava.pdf`, **без caller-supplied `elements`**. Ассерты: DA
вызвал оба document-тула, extracted+joined объёмы дали verified work items,
resume → EXPORTED + `export_soupis`. **P3-residual закрыт** — front-half
(документы → join → quantified elements → калькуляция → deliverable) запечатан
end-to-end живьём.

## 3. Открытые хвосты

- **Substitution-механизм НЕ исполнялся реальным билдом.** Новый bash-deploy-step
  (`_REDIS_URL`/`_VPC_CONNECTOR` empty-safe + JWT_SECRET) лежит в
  `cloudbuild-concrete.yaml`, но после мержа #1327 все билды отменялись guard'ом
  (docs-коммиты не трогают `concrete-agent/`). **Проверится первым мержем,
  трогающим `concrete-agent/`** — следить за шагом `deploy-concrete` (WARN-строки
  по пустым substitutions ожидаемы, пока Александр не заполнит значения в триггере).
- **REDIS_URL восстановлен на сервисе вручную** (после деплоя, который его снёс).
  Постоянная защита заработает только когда `_REDIS_URL` будет заполнен в триггере —
  до тех пор каждый деплой снова его снесёт (теперь с громким WARN в build-логе).
- `_VPC_CONNECTOR` — то же самое: значение в триггер не внесено.
- Env-var `STAGEGATING_E2E_SOUPIS_XLSX` — имя историческое, принимает XML
  (задокументировано в runbook); переименование = правка теста, не делалось сознательно.

## 4. Очередь (по приоритету)

1. **Cost-аудит** — спек у Александра; ждать вход.
2. **Разбор аудита → задачи экономии.**
3. **Gap B** — шум element-list в `extract_tz_fields` на реальной TZ: 6 чистых
   bullets (`• Základy`, `• Dříky pilířů`, `• Opěry`, `• Úložné prahy…`,
   `• Nosná konstrukce`, `• Římsy`) + ~31 prose-фрагмент. **Geometry-path чистая —
   не трогать.** Печать прошла и с шумом, но качество quantification поднимется
   существенно. Формат: gated-задача, recon → pre-impl interview → goldens на
   реальной TZ.
4. **Sanity-gate + rebar-from-soupis** (из scoped-валидации: мусорный match
   «geotextilie → 548 m³» — нужен sanity-фильтр на join-входе; выztуž t-строки
   soupis'а → rebar-поля).

## 5. Известные факты для cost-аудита

- **5 deploy-триггеров стреляют на КАЖДЫЙ мерж в main** (concrete/monolit/portal/
  urs/registry); 4 нерелевантных умирают через guard-степ **как FAILED build**
  (`exit 1`) — каждый ~1 мин оплачиваемого Cloud Build VM-времени + красный шум
  в билд-истории. Наблюдалось всю сессию на каждом из ~10 мержей.
- **Правильный фикс — `included-files` на уровне триггера** (`triggers/*.yaml`),
  чтобы билд вообще не стартовал; guard-степ оставить как defence-in-depth.
  Это кандидат №1 в задачи экономии из аудита.
- Прочие известные стоимостные точки из истории репо: `--min-instances=1` у
  concrete-agent (v4.24, сознательное), memory 6Gi + timeout 1800s (PR3 IFC),
  Artifact Registry cleanup-политика уже стоит (v4.26).

## 6. Инфраструктурные заметки следующей сессии

- **Локальный Postgres 16 поднимается в песочнице** (binaries в
  `/usr/lib/postgresql/16/`, запуск от пользователя `postgres`, см. §9 запись
  2026-06-10) — DB-gated тесты (pr3b, live_seal_portal_schema) можно гонять
  локально, не вслепую через CI. Доустановка deps: `uvicorn aiofiles pandas
  anthropic openai google-generativeai redis ezdxf google-auth*` (pip-имя
  `google` ≠ модуль!).
- MCP-коннектор STAVAGENT отдаёт только тулзы — `/orchestrate` через него не
  дёрнуть; живые прогоны только runbook'ом.
- `send_later` в сессии недоступен; Monitor не ходит в GitHub (MCP-only) —
  merge-транзишены PR'ов не будят, просить ping.
