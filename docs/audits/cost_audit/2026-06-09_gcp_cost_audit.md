# GCP Cost Audit — STAVAGENT (read-only recon)

**Дата:** 2026-06-09
**Автор:** Claude Code (read-only аудит, по запросу Alexandra)
**Статус:** 🛑 RECON ONLY — ничего не менялось. Каждое изменение ниже = отдельная gated-задача после ревью.

---

## 0. Метод и ограничение доступа

- **`gcloud` в окружении сессии НЕ доступен** (`command not found`). Поэтому живые числа (точный tier Memorystore, история билд-минут, утилизация Cloud Run, identity Compute-Engine-инстансов, tier Cloud SQL) **вытянуть нельзя**. Они помечены ⚠️ **ОЦЕНКА — нужно подтвердить** и собраны в §9 как готовые команды для Александра.
- Всё остальное — **факты из кода и деплой-конфигов репозитория** (cloudbuild-*.yaml, app-код, requirements, soul.md). Источники указаны как `файл:строка`.
- Биллинг (вход): actual ~3 735 Kč + forecast ~2 599 Kč ≈ **~6 300 Kč/мес** run-rate.

| Сервис | Actual | Forecast | Σ ≈ |
|---|---|---|---|
| Cloud Build | 1 322 | 658 | **1 980** |
| Cloud Run | 1 232 | 724 | **1 956** |
| Memorystore (Redis) | 534 | 409 | **943** |
| Compute Engine | 228 | 178 | **406** |
| Cloud SQL | 225 | 82 | **307** |
| (прочее: сеть/логи/AR/secrets) | — | — | ~700 |

---

## 1. Гипотезы — вердикт

### ✅ H1 — Redis + VPC-коннектор = чистый кандидат на убийство. **ПОДТВЕРЖДЕНО (жёстко).**

**Что реально сидит на Redis в проде:** ровно **одна** функция — rate-limit публичного DCR-эндпоинта `/oauth/register`.

- Единственный прод-call-site: `app/mcp/rate_limit.py` — `check_register_rate_limit(client_ip)`, atomic INCR sliding-window (~10/60s на IP). Импортирует `from app.core.redis_client import get_redis` (`rate_limit.py:159`). Если Redis недоступен → `/register` отдаёт **503** (намеренно, без тихого fallback — `rate_limit.py:26`). Это и есть источник post-deploy 503 из `soul.md:1063`.
- Вызывается из `app/mcp/routes.py:831` (`/oauth/register`). Это **редкий** эндпоинт (регистрация OAuth-клиента), не горячий путь.
- **Всё остальное про Redis — НЕ в проде:** `redis[hiredis]==5.0.1` + `celery[redis]==5.4.0` в `requirements.txt:142,148`, но в `app/**/*.py` Redis встречается только в `app/core/redis_client.py` (обёртка) + `app/mcp/rate_limit.py` (единственный потребитель) + тесты (`tests/test_redis_integration.py`, `test_celery_integration.py` — скипаются если Redis нет). Сессии/кэш/Celery/KB-cache из `DOCKER_SETUP.md`, `TECH_SPECS/*`, `ARCHITECTURE.md` — это **дизайн-доки и local docker-compose, не прод-код.** Celery-воркера в деплое нет (нет worker-сервиса в cloudbuild).

**VPC-коннектор существует только ради Redis:**
- Все 5 бэкендов ходят в Cloud SQL через сокет `--add-cloudsql-instances` (`cloudbuild.yaml:55,92,129,203` + `cloudbuild-concrete.yaml:89`), **НЕ через VPC**. Cloud SQL не требует коннектора.
- `--vpc-connector` / `REDIS_URL` **отсутствуют в cloudbuild-concrete.yaml** (deploy-шаг, строки 67–99) — применяются вручную out-of-band. Поэтому каждый force-rebuild их затирает → 503 → ручной `gcloud run services update` (`soul.md:1080,1089,1099`). Это та самая «боль».
- ⚠️ **ОЦЕНКА:** строка **Compute Engine (406 Kč)** = инстансы Serverless VPC Access коннектора `stavagent-vpc-connector` (коннекторы биллятся как e2-micro под Compute Engine, минимум 2 инстанса 24/7). Подтвердить §9.

**Вывод H1:** Redis уходит → коннектор уходит целиком → **~1 350 Kč/мес** (943 Memorystore + 406 Compute Engine) **+ исчезает 503-регрессия на каждом деплое.** Перенос rate-limit в Postgres тривиален (OAuth-стейт уже там: `mcp_oauth_codes`, `mcp_api_keys`).

### ✅ H2 — Cloud Build дорог из-за machine type. **ПОДТВЕРЖДЕНО (частично; нужны числа).**

- **Все 7 cloudbuild-конфигов используют `machineType: E2_HIGHCPU_8`** (`cloudbuild-concrete.yaml:135`, `cloudbuild.yaml:216`, `-portal:78`, `-monolit:81`, `-urs:76`, `-registry:76`, `-mineru:82`). Это самая дорогая стандартная машина (8 vCPU) и она **выводит билды из free-tier** (free 2 500 build-min/мес действует на default-машине).
- Частота **уже ограничена** guard-шагами (билд только при изменениях в папке сервиса — `cloudbuild-concrete.yaml:13-33`) — это хорошо, лишних билдов нет.
- concrete-agent уже использует layer-cache `--cache-from` (`cloudbuild-concrete.yaml:49-50`); у остальных сервисов `--cache-from` нет.
- ⚠️ **ОЦЕНКА:** сколько билд-минут/мес и средняя длительность — нужны (§9). Без этого точную экономию не посчитать.

**Вывод H2:** сменить `E2_HIGHCPU_8` → default-машину (вернёт free-tier + дешевле/мин, хоть и медленнее) + добавить `--cache-from` остальным. Потенциал — большой, но **число надо подтвердить.**

### ⚠️ H3 — Cloud Run: min-instances/память. **ЧАСТИЧНО — да у concrete-agent, НЕТ у MinerU.**

- **concrete-agent:** `--min-instances=1` (всегда тёплый!) + `--memory=6Gi` (`cloudbuild-concrete.yaml:79,94`). Это **концентрация Cloud Run-расходов** — 1 инстанс × 6 GiB × 24/7 idle. ⚠️ **Расхождение:** CLAUDE.md v4.26 заявлял min-instances 1→0 ради экономии, но в деплой-yaml сейчас **=1** → изменение откатано или не доехало до IaC.
- **MinerU — H3 ОПРОВЕРГНУТ:** `--min-instances=0 --max-instances=2 --memory=4Gi --cpu=2 --concurrency=1` (`cloudbuild-mineru.yaml:68-73`). **Scale-to-zero**, платит только во время вызова. Не «висит тёплым». ⚠️ частоту вызовов подтвердить (§9), но конфиг уже бережливый.
- **Остальные (portal, monolit, urs, registry):** в cloudbuild нет `--min-instances`/`--memory` → дефолты (min=0, 512 MiB). **Уже scale-to-zero**, не трогаем.

**Вывод H3:** единственный тёплый сервис — concrete-agent (min=1, 6Gi). Рычаг — min-instances→0 (как пытались в v4.26). **Средний риск** (cold start 6Gi Python + перезагрузка KB-кэша; уже откатывали — выяснить почему).

---

## 2. Cloud Run — по каждому сервису (из деплой-конфигов)

| Сервис | min | max | mem | cpu | conc | регион | scale-to-zero? | вердикт |
|---|---|---|---|---|---|---|---|---|
| **concrete-agent** | **1** | default | **6Gi** | default | default | ew3 | ❌ всегда тёплый | min→0 (ср. риск); 6Gi оправдан IFC — не резать вслепую |
| mineru-service | 0 | 2 | 4Gi | 2 | 1 | ew1 | ✅ | OK, проверить частоту вызовов |
| stavagent-portal-backend | 0* | default | 512Mi* | default | default | ew3 | ✅ | OK |
| monolit-planner-api | 0* | default | 512Mi* | default | default | ew3 | ✅ | OK |
| urs-matcher-service | 0* | default | 512Mi* | default | default | ew3 | ✅ | OK |
| rozpocet-registry-backend | 0* | default | 512Mi* | default | default | ew3 | ✅ | OK |

`*` = дефолт Cloud Run (в cloudbuild не задано явно). ⚠️ Подтвердить фактические ревизии (§9) — кто-то мог задать min>0 руками вне IaC, как с VPC-коннектором.

---

## 3. Cloud Build

- Машина: `E2_HIGHCPU_8` на всех 7 конфигах (премиум, вне free-tier).
- Guard-шаги по диффу — хорошо (лишних билдов нет).
- Layer-cache только у concrete-agent.
- Рекомендации: (1) `machineType` → default (`E2_MEDIUM`/без указания) — вернёт 2 500 free build-min/мес; (2) `--cache-from` остальным сервисам; (3) батчинг (несколько мержей подряд → один деплой) — но guard-шаги уже снижают эффект, это вторично.
- ⚠️ **Без числа билд-минут/мес точная экономия = оценка.** См. §9.

---

## 4. Cloud SQL (быстро) — НЕ трогать

- `stavagent-db` (PostgreSQL 15), один инстанс, держит все БД (portal/monolit/registry/concrete + MCP-таблицы), доступ через сокет.
- 307 Kč/мес — терпимо. v4.26 уже перевёл REGIONAL→ZONAL (сэкономлено ранее).
- **Это цель приёма Redis-нагрузки** (rate-limit) и хранилище сессий оркестратора → **не убирать, не ужимать.**
- ⚠️ Проверить tier (§9) — если завышен, отдельно; но приоритет низкий.

---

## 5. Сводная таблица расходов → план

| # | Статья | Σ Kč/мес | Причина | Действие | Экономия Kč/мес | Риск / усилие |
|---|---|---|---|---|---|---|
| 1 | Memorystore | 943 | держит ТОЛЬКО rate-limit `/register` | перенести лимит в Postgres → убить инстанс | **~943** (факт) | низкий / низко-средн. |
| 2 | Compute Engine | 406 | ⚠️ VPC-коннектор, нужен только для Redis | убить вместе с Redis | **~406** (⚠️оц.) | низкий / низкое |
| 3 | Cloud Build | 1 980 | `E2_HIGHCPU_8` на всех, мимо free-tier | machine type → default + `--cache-from` | **~1 000–1 700** (⚠️оц.) | низкий / низкое |
| 4 | Cloud Run (concrete) | часть 1 956 | min-instances=1 + 6Gi всегда тёплый | min→0 (вернуть v4.26) | **~500–900** (⚠️оц.) | средний / низкое |
| 5 | Cloud Run (прочие) | — | уже scale-to-zero | — | 0 | — |
| 6 | MinerU | в Cloud Run | уже min=0 | проверить частоту вызовов | 0 | — |
| 7 | Cloud SQL | 307 | данные + цель миграции Redis | НЕ трогать | 0 | — |

### Приоритизированный план (экономия/усилие), каждый пункт = отдельная gated-задача

**🥇 Задача 1 — Убить Memorystore + VPC-коннектор (H1).** Самая верная и безопасная.
- Шаг A: перенести `check_register_rate_limit` с Redis на Postgres (новая таблица `mcp_dcr_rate_limit`, atomic sliding-window через SQL; пул psycopg2 уже есть). Один модуль `app/mcp/rate_limit.py` + одна миграция. Сохранить strict-503 семантику (если БД недоступна).
- Шаг B (после деплоя без Redis-зависимости): снести Memorystore-инстанс + `stavagent-vpc-connector`; убрать ручные `--vpc-connector`/`REDIS_URL` из рантайма; убрать `redis`/`celery` из requirements (опц.).
- **Экономия: ~1 350 Kč/мес + конец 503-регрессии на деплоях.** Риск: низкий (один редкий эндпоинт).

**🥈 Задача 2 — Cloud Build machine type → default (H2).** Самое дешёвое усилие.
- Сменить `machineType: E2_HIGHCPU_8` → default во всех 7 yaml; добавить `--cache-from` portal/monolit/urs/registry.
- Сначала собрать билд-минуты (§9), чтобы подтвердить попадание в free-tier.
- **Экономия: ~1 000–1 700 Kč/мес (оценка).** Риск: низкий (билды медленнее, но реже и не на проде).

**🥉 Задача 3 — concrete-agent min-instances 1→0 (H3).** Сначала выяснить, почему откатили.
- Вернуть `--min-instances=0` в cloudbuild-concrete.yaml (как декларировал v4.26). Митигировать cold-start (lazy KB-load / меньший warm-набор).
- **Экономия: ~500–900 Kč/мес (оценка).** Риск: средний (cold start 6Gi; ранее откатывали — спросить Александра ПОЧЕМУ до повтора).

---

## 6. Целевая цифра

| Этап | Burn Kč/мес |
|---|---|
| Сейчас | ~6 300 |
| + Задача 1 (Redis/VPC, верно) | **~4 950** |
| + Задача 2 (Cloud Build, оценка) | **~3 500** |
| + Задача 3 (concrete min→0, оценка) | **~3 000** |

**Реалистичная цель: ~3 000–3 800 Kč/мес** (минус ~40–50 %). Гарантированная часть (Задача 1) = **~1 350 Kč/мес** с нулевым риском для функциональности.

---

## 7. Что НЕ трогаем (и почему)

- **Cloud SQL `stavagent-db`** — хранит все БД + сессии оркестратора + станет приёмником rate-limit. Уже ZONAL.
- **concrete-agent `--memory=6Gi`** — оправдан IFC-стримингом (1.5 GB jobs, `cloudbuild-concrete.yaml:91-94`). Резать память = риск OOM на больших IFC/DWG. Рычаг — min-instances, не память.
- **MinerU-конфиг** — уже scale-to-zero, бережлив.
- **Guard-шаги в cloudbuild** — экономят билды, оставить.
- **Семантику strict-503** rate-limit при миграции в Postgres сохранить (безопасность DCR).

---

## 8. Резюме гипотез

| | Вердикт | Доказательство |
|---|---|---|
| **H1** Redis+коннектор killable, ~1.7k | ✅ **ПОДТВЕРЖДЕНО** (факт ~1.35k) | Redis = только rate-limit `/register` (`app/mcp/rate_limit.py`); коннектор только для Redis (все БД через сокет) |
| **H2** Cloud Build дорог | ✅ **ПОДТВЕРЖДЕНО** (machine type) | `E2_HIGHCPU_8` × 7 конфигов; число билд-минут ⚠️ нужно |
| **H3** Cloud Run min>0/раздут, MinerU тёплый | ⚠️ **ЧАСТИЧНО** | concrete-agent min=1+6Gi — да; **MinerU min=0 — H3 опровергнут** |

---

## 9. Что нужно от Александра (gcloud для живых чисел)

Read-only команды для заполнения ⚠️-пробелов:

```bash
# Memorystore: tier + размер + точная цена
gcloud redis instances list --region=europe-west3
gcloud redis instances describe <INSTANCE> --region=europe-west3 \
  --format="value(tier,memorySizeGb,host)"

# VPC-коннектор: подтвердить, что Compute-Engine-строка = он, и нет др. потребителей
gcloud compute networks vpc-access connectors describe stavagent-vpc-connector \
  --region=europe-west3
gcloud compute instances list   # есть ли ДРУГИЕ VM кроме коннектора?

# Cloud Run: фактические ревизии (вдруг min>0 задан руками вне IaC)
for s in concrete-agent mineru-service stavagent-portal-backend \
         monolit-planner-api urs-matcher-service rozpocet-registry-backend; do
  echo "== $s =="; gcloud run services describe $s --region=europe-west3 \
   --format="value(spec.template.metadata.annotations,spec.template.spec.containers[0].resources.limits)"
done

# Cloud Run утилизация (instance time, requests) — Monitoring
#   metric: run.googleapis.com/container/instance_count, request_count (за 30 дн)

# Cloud Build: число билдов и длительность за месяц
gcloud builds list --limit=200 \
  --format="table(id,createTime,duration,status,options.machineType)"

# Cloud SQL: tier
gcloud sql instances describe stavagent-db \
  --format="value(settings.tier,settings.availabilityType,settings.dataDiskSizeGb)"

# Точный биллинг по SKU (если включён BigQuery export)
#   bq query по billing_export ... GROUP BY service.description, sku.description
```

---

🛑 **STOP на отчёте.** Изменения — Задачи 1→2→3 отдельными gated-PR после ревью Александра. Гарантированный быстрый выигрыш = **Задача 1 (~1 350 Kč/мес, нулевой функциональный риск, + конец деплой-503)**.
