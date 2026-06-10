# GCP Cost-аудит — 2026-06-10 (read-only recon)

**Статус:** 🛑 ОТЧЁТ. Никаких изменений не сделано. Каждый пункт плана = отдельная
gated-задача после ревью.

**Источники фактов:** кодовая база (cloudbuild/triggers = codified deploy-конфиг,
через который идут все деплои), git-история main (30 дней), `docs/soul.md` +
session handoffs (живые наблюдения), биллинг-числа из задания, публичный прайсинг
GCP. **В песочнице нет gcloud/ADC** — всё, что добирается только живым
`gcloud describe`, помечено `[GCLOUD]` и собрано в §7 (команды для Александра).
Оценки помечены `≈est`.

**Вход (биллинг, месяц):** actual ~3 735 Kč + forecast ~2 599 Kč ≈ **6.3k Kč/мес**.

---

## 1. Главная таблица

| Статья (Kč/мес, act+fcst) | Причина (факт) | Можно убрать/ужать? | Экономия ≈est | Риск / усилие |
|---|---|---|---|---|
| **Cloud Build 1 980** | Все 6 пайплайнов на `machineType: E2_HIGHCPU_8` ($0.0156/мин, вне free tier); живые триггеры без `includedFiles` → 5 билдов на каждый пуш в main (4 умирают как платные guard-FAILURE); manual `gcloud builds submit` во время сессий; concrete-билд тяжёлый (6Gi-образ, timeout 3600s) | ДА: (1) default-пул e2-standard-2 = 2 500 free мин/мес; (2) реимпорт триггеров (includedFiles УЖЕ в репо); (3) батчить мержи | **~1 200–1 700** | Низкий / низкое. Билды медленнее ~1.5–2× |
| **Cloud Run 1 956** | `cloudbuild-concrete.yaml`: **`--min-instances=1` + `--memory=6Gi`** зашиты в каждый деплой concrete-agent (PR3 IFC budget). Idle min-instance 2vCPU/6Gi ≈ $50–55/мес ≈est уже сам по себе; если на сервисе включён instance-based billing / no-cpu-throttling `[GCLOUD]` — до $160/мес. Остальные сервисы: MinerU min=0/4Gi/2cpu (по репо — **H3 про MinerU опровергнута**), monolit/portal/urs/registry без явных флагов (живые значения `[GCLOUD]`) | ДА: min-instances 1→0 (cold start ~10–30 s, прецедент v4.26 — уже принимали) ИЛИ оставить min=1, но гарантировать request-based billing; 6Gi трогать нельзя без потери IFC | **~900–1 600** | Средний / низкое. Cold start у MCP-коннектора + первый запрос после простоя |
| **Memorystore Redis 943** | Fixed-cost 24/7 (Basic ~1GB ≈est, `stavagent-redis`, 10.229.246.227). **Единственный fail-closed потребитель — DCR rate-limiter `/register`** (`app/mcp/rate_limit.py`, 10/IP/час, данные = счётчики байтового размера, TTL 1 ч). Redis-сессии (`app/core/session.py`) — 0 прод-вызовов (только тесты); Celery — мёртв (Dockerfile CMD = только uvicorn, ни воркера, ни `.delay()` из роутов); KB-кэш — 1 потребитель (`monolit_adapter`, cache-aside TTL 1 ч) | **ДА, целиком** — H1 ПОДТВЕРЖДЕНА кодом. Rate-limiter → Postgres (atomic UPSERT, 10 строк/час нагрузки); monolit-кэш → in-memory fallback | **943** | Низкий / среднее (≈1 PR). Детали §2 |
| **Compute Engine 406** | Инстансы VPC-коннектора `stavagent-vpc-connector` (мин. 2 × e2-micro 24/7 ≈est $15–18/мес — сходится с биллингом). Egress `private-ranges-only`; в deploy-конфигах коннектор есть ТОЛЬКО у concrete-agent; Cloud SQL ходит через `--set-cloudsql-instances` (auth-proxy socket, VPC не нужен) → **коннектор существует только ради Redis** | ДА — уходит вместе с Redis (после `[GCLOUD]`-подтверждения, что других потребителей нет) | **406** | Низкий / минимальное (после Redis) |
| **Cloud SQL 307** | `db-f1-micro` ZONAL (handoff 2026-04-29) — уже минимальный tier, биллингу соответствует | **НЕТ** — не трогаем; наоборот, кандидат на приём Redis-нагрузки (orchestrator-сессии уже здесь) | 0 | — |
| Прочее ~200 | Artifact Registry (cleanup-политика уже стоит, v4.26), Logging (retention 7d уже), Secret Manager | Нет действий | 0 | — |

**Бонус-фикс (0 Kč, но боль):** убийство Redis+коннектора закрывает навсегда класс
багов «деплой снёс REDIS_URL/--vpc-connector» (soul.md: revision 00372-bxh,
ручные восстановления, Part B #1327).

---

## 2. Redis — детальный разбор (задание §1)

### 2.1 Полная инвентаризация потребителей (grep всей кодовой базы)

| Потребитель | Что хранит | TTL | Объём | Критичность |
|---|---|---|---|---|
| `app/mcp/rate_limit.py` | Счётчик `rate:dcr_register:{ip}` для публичного DCR `/register` (Lua INCR+EXPIRE, fail-closed 503) | 3600 s | байты | **Единственный жёсткий**. Сами DCR-регистрации/токены — в Postgres (`mcp_oauth_clients/tokens/codes`, миграции 009/010) |
| `app/core/session.py` (SessionManager) | Юзер-сессии | 1 ч | — | **МЁРТВ**: 0 вызовов вне тестов. Orchestrator-сессии — Postgres (`stage_gating/session_repository.py`) |
| `app/core/cache.py` (CacheManager/KnowledgeBaseCache) | Кэш enrichment-результатов | 3600 s | KB-структуры | 1 потребитель: `integrations/monolit_adapter.py` (enrich-эндпоинт; при недоступном Redis уходит в error-response — НЕ graceful). `get_kb_cache` — 0 прод-вызовов |
| Celery broker/backend (`app/core/celery_app.py`, `app/tasks/*`) | Очередь задач | — | — | **МЁРТВ**: Dockerfile CMD = uvicorn only, воркер нигде не деплоится, ни один API-роут не зовёт `.delay()`/`apply_async` |
| URS_MATCHER (`cacheService.js`) | LLM/parse-кэш | 1–7 d | — | Имеет **in-memory fallback**; деплой URS не получает ни REDIS_URL, ни VPC-коннектор → в проде уже работает на fallback |
| Portal / Monolit / Registry | — | — | — | Redis не используют (grep чистый) |

### 2.2 Вердикт по переносимости

| Нагрузка | Куда | Обоснование |
|---|---|---|
| DCR rate-limit | **Postgres** (рекомендация) | Атомарность INCR достигается `INSERT … ON CONFLICT … DO UPDATE SET count=count+1 RETURNING` — тот же one-round-trip инвариант, что Lua-скрипт. Нагрузка 10 строк/IP/час — ничто для db-f1-micro. Fail-closed сохраняется (Postgres недоступен → 503 — и тогда сервису всё равно конец, т.к. вся MCP-auth на Postgres). Cross-instance атомарность (мотив выбора Redis) у Postgres есть |
| — альтернатива | Upstash serverless Redis (free tier, TLS, без VPC) | Работает, но новый вендор + секрет + внешняя зависимость auth-пути. Против ethos «determinism, минимум инфраструктуры». Не рекомендую |
| monolit_adapter кэш | in-memory per-instance LRU (или просто fail-open) | Cache-aside TTL 1 ч; потеря кэша = повторный enrichment, не ошибка. Заодно чинится текущий не-graceful путь |
| session.py, Celery | **удалить/заархивировать ничего не нужно** — код можно оставить, он не исполняется | Отдельная cleanup-задача по желанию, к деньгам отношения не имеет |
| Реально требует Memorystore | **ничего** | — |

### 2.3 Тариф `[GCLOUD]`

Размер/tier инстанса в репо не зафиксирован. Биллинг (943 Kč/мес ≈ $41) сходится с
Basic ~1 GB в europe-west3 ≈est. Подтвердить: §7 п.1.

### 2.4 VPC-коннектор

Подтверждено по репо: упоминания `--vpc-connector` есть только в
`cloudbuild-concrete.yaml` (+docs); живое имя `stavagent-vpc-connector`,
egress `private-ranges-only` (soul.md). Cloud SQL коннектор не использует.
Финальная проверка «никто другой не подключён» — §7 п.2. **Если Redis уходит —
коннектор уходит целиком**, вместе с substitutions `_REDIS_URL`/`_VPC_CONNECTOR`
в триггере (станут неактуальны — empty-safe bash-step уже корректно их опускает).

---

## 3. Cloud Run (задание §2)

Codified-конфиг (по репо; живые ревизии — §7 п.3):

| Сервис | CPU | Mem | min | max | Источник |
|---|---|---|---|---|---|
| concrete-agent | не задан (≥2 vCPU обязателен при 6Gi) | **6Gi** | **1** | 10 (runbook) | `cloudbuild-concrete.yaml` (каждый деплой) |
| mineru | 2 | 4Gi | **0** | 2, concurrency=1, timeout 200 | `cloudbuild-mineru.yaml` |
| monolit / portal / urs / registry | флаги не задаются → живые значения унаследованы от ручных настроек `[GCLOUD]` | | | | cloudbuild-*.yaml |

- **Виновник — concrete-agent**: idle min-instance 2vCPU/6Gi ≈ $50–55/мес ≈est
  (Tier-1 idle rates); если CPU always-allocated — кратно больше. Это
  консистентно объясняет львиную долю статьи 1 956 Kč.
- **MinerU (H3-подозрение) опровергнут по repo-конфигу**: min=0, узкие лимиты.
  Частота вызовов — §7 п.4 (request count из метрик).
- Keep-alive workflow (каждые 14 мин, concrete/monolit/urs): при request-based
  billing стоит ~0 (греет инстанс, но instance-time между запросами не
  биллится). Пинг concrete-agent при min=1 избыточен. НЕ статья расхода —
  не трогаем ради денег.
- Утилизация (request count / instance time за месяц) из песочницы недоступна — §7 п.4.

**Рекомендации:** (а) concrete-agent `min-instances` 1→0 — прецедент v4.26, цена
= cold start (in-memory KB-кэш прогревается заново; startup-миграции idempotent);
ИЛИ (б) если cold start неприемлем для MCP-коннектора — оставить min=1, но
`[GCLOUD]`-проверить billing mode (request-based, БЕЗ no-cpu-throttling) — разница
до ~$110/мес. 6Gi не ужимать (IFC streaming budget 1.5GB/job + RssAbortGuard);
вынос IFC в отдельный min-0 сервис — отдельная большая задача, не в этом пакете.

---

## 4. Cloud Build (задание §3)

**Факты из репо/истории:**
- 6 пайплайнов, все `machineType: E2_HIGHCPU_8` = $0.0156/мин, **вне free tier**
  (2 500 free мин/мес действуют только в default-пуле e2-standard-2).
- 58 коммитов в main за 30 дней; по путям: concrete-agent 19, Monolit 6,
  portal/urs/registry/mineru по 2.
- **Drift репо↔GCP:** `triggers/*.yaml` в репо УЖЕ содержат `includedFiles`,
  но живое поведение (5 билдов на каждый мерж, 4 guard-FAILURE по ~1 мин — handoff
  2026-06-10 §5) показывает, что живые триггеры созданы ДО добавления
  includedFiles и **не реимпортированы**. Фикс = `gcloud builds triggers import`
  существующих файлов — почти нулевое усилие.
- Guard-FAILURE-шум: ~58 × 4 × ~1 мин ≈ 240 мин ≈ $4/мес — дёшево, но 232
  красных билда/мес в истории. Дополнение к заданию: guard остаётся как
  defence-in-depth ПОСЛЕ переноса фильтрации на includedFiles — подтверждаю,
  guard-степ в yaml не трогать.
- **Арифметика не сходится только на триггерных билдах:** 1 980 Kč ≈ $86 ≈
  5 500 highcpu-мин/мес, а ~31 реальный триггерный билд × даже 40 мин ≈ 1 250 мин.
  Разрыв → manual `gcloud builds submit` / deploy-all (билдит все 6) во время
  сессий + возможно более длинные concrete-билды. Точный разрез — §7 п.5.

**Рекомендации (по убыванию эффекта):**
1. **Убрать `options.machineType` из всех 6 cloudbuild-yaml** → default-пул
   e2-standard-2 → 2 500 free мин/мес + остаток по ~2.6× меньшей цене. Билды
   медленнее ~1.5–2× (приемлемо: деплой не блокирует работу). ≈est экономия
   1 200–1 700 Kč/мес.
2. **Реимпорт триггеров** (includedFiles уже в репо) → guard-FAILUREs исчезают.
3. **Батчить мержи**: 19 concrete-пушей/мес → серия PR мержится пачкой, билдится
   последний HEAD (паттерн «per-phase PR» уже это почти даёт — мержить фазы
   подряд без пауз).
4. Не делать manual `submit` там, где хватает триггера.

---

## 5. Приоритизированный план (каждый пункт = gated-задача)

| # | Задача | Экономия ≈est Kč/мес | Усилие | Риск |
|---|---|---|---|---|
| 1 | **Триггеры: реимпорт с includedFiles** (файлы готовы) | ~90 + чистая история | ~минуты `[GCLOUD]` | ~0 |
| 2 | **Cloud Build → default-пул** (6 yaml, удалить machineType) | 1 200–1 700 | 1 маленький PR | низкий (медленнее билды) |
| 3 | **Убить Memorystore + VPC-коннектор**: rate-limiter → Postgres UPSERT (порт `rate_limit.py`, fail-closed сохранить), monolit-кэш → in-memory, удалить REDIS_URL/_VPC_CONNECTOR из триггера, снести инстанс+коннектор | **1 349** | 1 PR + 2 `[GCLOUD]`-операции | низкий-средний: единственный прод-путь — DCR `/register`; smoke-тест хэндшейка Claude.ai обязателен |
| 4 | **concrete-agent min-instances 1→0** (или billing-mode-фикс при сохранении min=1) | 900–1 600 | 1-строчный PR в cloudbuild | средний: cold start MCP/first-request |
| 5 | Батчинг мержей (дисциплина, не код) | ~200–400 | 0 | 0 |

**Целевая цифра:** 6 334 → **~1 500–2 200 Kč/мес**
(SQL 307 + Run ~400–900 + Build ~300–600 + прочее ~200; Redis 0, CE 0).
Консервативно: ≤2 500 Kč/мес после задач 1–4.

## 6. Что НЕ трогаем и почему

- **Cloud SQL db-f1-micro** — минимальный tier, на нём orchestrator-сессии +
  вся MCP-auth; станет приёмником Redis-нагрузки.
- **6Gi памяти concrete-agent** — IFC streaming budget (PR3); ужатие = потеря
  функциональности. Вынос IFC в отдельный сервис — отдельный спек, не cost-фикс.
- **Guard-степы в cloudbuild** — остаются как defence-in-depth под includedFiles.
- **MinerU** — уже right-sized (min=0, cpu=2, 4Gi, concurrency=1).
- **Keep-alive workflow** — бесплатен при request-based billing; убирать = ловить
  cold starts без выгоды. (Опционально снять пинг concrete-agent, пока min=1.)
- **Artifact Registry / Logging** — политики уже стоят (v4.26).
- **Мёртвый код Celery/session.py** — не исполняется и не стоит денег; чистка =
  отдельная hygiene-задача без приоритета.

## 7. Данные от Александра `[GCLOUD]` (не блокируют план, уточняют числа)

```bash
# 1. Redis tier/size (подтверждение 943 Kč)
gcloud redis instances describe stavagent-redis --region=europe-west3 \
  --format='value(tier,memorySizeGb,state)'

# 2. VPC-коннектор: spec + что-нибудь ещё на нём сидит?
gcloud compute networks vpc-access connectors describe stavagent-vpc-connector \
  --region=europe-west3
for s in concrete-agent monolit-planner-api stavagent-portal-backend \
         urs-matcher-service rozpocet-registry-backend mineru-service; do
  echo "== $s"; gcloud run services describe $s --region=europe-west3 \
    --format='value(spec.template.metadata.annotations)' | tr ',' '\n' | grep -i vpc
done

# 3. Живые ревизии всех сервисов: CPU/mem/min/max/billing-mode
for s in concrete-agent monolit-planner-api stavagent-portal-backend \
         urs-matcher-service rozpocet-registry-backend mineru-service; do
  echo "== $s"; gcloud run services describe $s --region=europe-west3 --format=yaml \
    | grep -E 'cpu|memory|minScale|maxScale|cpu-throttling|billing'
done

# 4. Утилизация: Console → Cloud Run → каждый сервис → Metrics (Request count,
#    Billable instance time, 30d). Особо MinerU request count.

# 5. Cloud Build за 30 дней: счётчик + длительности + триггер/manual
gcloud builds list --region=europe-west3 --limit=400 \
  --format='table(createTime.date(),status,buildTriggerId,timing.BUILD.duration)' \
  > builds_30d.txt

# 6. Биллинг-разрез Cloud Run по SKU (idle vs active vs memory) —
#    Console → Billing → Reports → Group by SKU, filter Cloud Run.
```

---

*Recon: сессия 2026-06-10. Подтверждённые гипотезы: H1 ✅ (Redis = только
DCR-limiter; CE = коннектор только-для-Redis), H2 ✅ (machineType + drift
триггеров + manual submits), H3 ✅/частично (виновник — concrete-agent
min=1/6Gi; MinerU чист по repo-конфигу).*
