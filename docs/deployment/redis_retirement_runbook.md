# Runbook — вывод Memorystore Redis + VPC-коннектора (cost task №3) `[GCLOUD]`

**Источник:** cost-аудит `docs/audits/cost_audit/2026-06-10_gcp_cost_audit.md` §2.
**Экономия:** Redis 943 + Compute Engine (коннектор) 406 = **1 349 Kč/мес** +
навсегда исчезает класс багов «деплой снёс REDIS_URL/--vpc-connector».

**Жёсткая последовательность (каждый шаг = гейт, 🛑 STOP при любом красном):**

| Шаг | Что | Откат |
|---|---|---|
| 1 | PR порта (limiter → Postgres UPSERT, monolit-кэш → fallback) — мержится и деплоится **при живом Redis**; код перестаёт читать Redis, env не трогаем | `git revert` PR + редеплой |
| 2 | Smoke #1 (Redis ещё жив, но кодом не используется) | — |
| 3 | Снять REDIS_URL/_REDIS_URL/_VPC_CONNECTOR из env сервиса + substitutions триггера, редеплой | одна команда, §Откат |
| 4 | Smoke #2 — тот же набор | §Откат |
| 5 | **Только после двух зелёных:** снос Redis-инстанса + коннектора | ❌ необратимо (но к шагу 5 на них уже ничто не указывает) |

---

## Шаг 2 / Шаг 4 — Smoke-набор (идентичный)

### 2.1 DCR /register: limiter жив (200/400/429 — НЕ 503)

Гейт rate-limit'а срабатывает ДО парсинга JSON, поэтому smoke шлёт пустой
payload — лимитер инкрементится, но мусорные client-записи не создаются:

```bash
URL=https://concrete-agent-1086027517695.europe-west3.run.app/api/v1/mcp/oauth/register
for i in $(seq 1 11); do
  code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$URL" \
    -H 'Content-Type: application/json' -d '{}')
  echo "hit $i → $code"
done
```

**Ожидание:** hits 1–10 → `400` (limiter пропустил, payload отвергнут),
hit 11 → `429`. **Любой `503` = limiter недоступен → 🛑 STOP** (смотреть
Cloud Run логи: `[MCP/RateLimit] Postgres unavailable`).

Сброс квоты IP после smoke (иначе следующий smoke/реальная регистрация с
этого IP ждёт час):

```bash
gcloud sql connect stavagent-db --user=postgres --database=<mcp-db> <<'SQL'
DELETE FROM mcp_rate_limit_buckets WHERE bucket_key LIKE 'rate:dcr_register:%';
SQL
```

### 2.2 Claude.ai-коннектор: хэндшейк + тулзы (ручной чек)

- claude.ai → Settings → Connectors → STAVAGENT → reconnect: OAuth-флоу
  доходит до consent и обратно (PKCE-цепочка живая).
- В чате вызвать `find_otskp_code` (бесплатный) — возвращает результат.
- В чате вызвать платный тул (например `calculate_concrete_works`) —
  кредиты списываются (Postgres-цепочка auth жива).

### 2.3 Контроль логов

```bash
gcloud run services logs read concrete-agent --region=europe-west3 --limit=50 \
  | grep -iE 'redis|rate.?limit' || echo "тихо — ок"
```

Smoke #1: допустим WARN `Redis cache unavailable, using in-memory fallback`
ТОЛЬКО от monolit-enrich пути (и его не должно быть, пока REDIS_URL жив).
Любая ошибка limiter'а → 🛑 STOP.

## Шаг 3 — снятие env + substitutions

```bash
# 3.1 Сервис: убрать REDIS_URL и коннектор (создаёт новую ревизию = редеплой)
gcloud run services update concrete-agent --region=europe-west3 \
  --remove-env-vars=REDIS_URL --clear-vpc-connector

# 3.2 Триггер: substitutions _REDIS_URL/_VPC_CONNECTOR убрать = реимпорт
#     ЧИСТОГО репо-yaml (в нём этих ключей нет). Помним инцидент 2026-06-11:
#     import по занятому имени → delete+import, гейт между ними.
cd ~/STAVAGENT && git pull origin main
gcloud builds triggers delete concrete-agent-deploy --region=europe-west3 --quiet
gcloud builds triggers import --region=europe-west3 --source=triggers/concrete-agent.yaml
gcloud builds triggers describe concrete-agent-deploy --region=europe-west3 \
  --format='value(name,includedFiles)'   # гейт: триггер существует, includedFiles на месте

# 3.3 Верификация ревизии: REDIS_URL исчез, коннектора нет
gcloud run services describe concrete-agent --region=europe-west3 --format=yaml \
  | grep -E 'REDIS_URL|vpc-access' || echo "чисто — ок"
```

→ **Шаг 4 = Smoke #2** (набор §2.1–2.3 целиком; в логах теперь ДОПУСТИМ
WARN in-memory-fallback от monolit-enrich — это спроектированный режим).

## Откат (работает до шага 5)

```bash
# Вернуть env + коннектор на сервис (одна команда):
gcloud run services update concrete-agent --region=europe-west3 \
  --vpc-connector=stavagent-vpc-connector --vpc-egress=private-ranges-only \
  --update-env-vars=REDIS_URL=redis://10.229.246.227:6379
# Код после шага 1 Redis всё равно не читает — полный откат поведения =
# git revert PR порта + мерж (редеплой триггером).
```

## Шаг 5 — снос `[GCLOUD]`, только после ДВУХ зелёных smoke

```bash
gcloud redis instances delete stavagent-mcp-rate-limit --region=europe-west3
gcloud compute networks vpc-access connectors delete stavagent-vpc-connector \
  --region=europe-west3
```

Необратимо (содержимое — только rate-счётчики, терять нечего). После сноса
строка Compute Engine в биллинге уходит в 0 в течение суток.

## Шаг 6 (опционально, отдельный PR) — гигиена cloudbuild

`cloudbuild-concrete.yaml` сохраняет empty-safe логику `_REDIS_URL`/
`_VPC_CONNECTOR` + WARN-строки «fill it in the trigger» — после шага 5 они
вводят в заблуждение. Отдельный маленький PR: удалить оба блока + WARN'ы.
Не блокирует ничего.
