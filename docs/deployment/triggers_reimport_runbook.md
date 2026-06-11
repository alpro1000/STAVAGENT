# Runbook — реимпорт Cloud Build триггеров с includedFiles `[GCLOUD]`

**Дата:** 2026-06-10 · **Исполнитель:** Александр (Cloud Shell)
**Источник:** cost-аудит `docs/audits/cost_audit/2026-06-10_gcp_cost_audit.md` §4–5, задача №1.
**Эффект:** docs-пуши перестают стартовать билды вообще (~80 % из ~2 400 билдов/мес
— платные guard-cancel'ы на E2_HIGHCPU_8) ≈ **1 200–1 600 Kč/мес** + чистая
build-история.

---

## 🔴 POST-MORTEM первого прогона (2026-06-11)

Первый прогон v1 этого runbook'а упал и частично сломал CI/CD:

1. **Все 6 import'ов упали** с `ERROR: .location: unused` — поле `location:` в
   `triggers/*.yaml` команда `import` не принимает (локацию задаёт `--region`).
   Поле удалено из всех репо-yaml этим же фиксом.
2. **Шаг удаления (§5) был выполнен ПОСЛЕ упавших import'ов** → 5 сервисов
   остались без деплой-триггеров до восстановления. Дефект runbook v1: удаление
   стояло до верификации, без STOP-гейта. **Исправлено: §4.1 — жёсткий гейт.**
3. Восстановление: re-import без `location:` (бэкапы §1 не понадобились, но
   обязательны). §7 при этом отработал чисто — substitution-хвост handoff §3
   закрыт: `✅ WARN нет` + `REDIS_URL` присутствует на ревизии 00399-hd9.

**Урок (универсальный для destructive-runbook'ов):** между мутирующим шагом и
удалением старого — ВСЕГДА верификационный гейт; любой ERROR = STOP, удаление
не выполнять.

## 🔴 POST-MORTEM, инцидент №2 (2026-06-11, та же болезнь — вторая итерация)

Первый билд через реимпортированный триггер (mineru, мерж #1333) отброшен ДО
старта (0 steps): `invalid value for build.service_account: provide a
user-managed service account or leave unset`. Репо-yaml несли явный
`serviceAccount: …@cloudbuild.gserviceaccount.com` (легаси-SA Cloud Build) —
новая валидация отвергает его при явном указании; старые триггеры жили без
поля (дефолтный выбор SA, билды проходили). Поле удалено из всех репо-yaml.

**Корень обоих инцидентов один: поля describe-экспорта ≠ схема import.**
Канонический strip-список при любом «describe → правка → import» цикле:

```bash
grep -vE '^(createTime|updateTime|resourceName|location|serviceAccount):'
# id ОСТАВЛЯТЬ — он гарантирует update-in-place вместо
# неподтверждённого матчинга по имени.
```

Фикс живых триггеров: describe каждого → strip по списку (id сохранить) →
import → гейт «ровно 6, serviceAccount пуст, includedFiles/substitutions на
месте».

---

## ⚠️ Два факта, из-за которых runbook не сводится к одному import

1. **Имена в репо ≠ живым у 5 из 6 триггеров.** `triggers import` матчится по
   `name` — наивный импорт всех `triggers/*.yaml` СОЗДАСТ ДУБЛИКАТЫ рядом со
   старыми (станет хуже: 2× билдов). Поэтому: импорт новых имён → удаление старых.

   | Живой триггер (удалить после импорта) | Репо-файл → новое имя |
   |---|---|
   | `concrete-agent-deploy` (имя совпадает — обновится in-place) | `triggers/concrete-agent.yaml` → `concrete-agent-deploy` |
   | `monolit-planner-deploy` | `triggers/monolit.yaml` → `monolit-deploy` |
   | `stavagent-portal-deploy` | `triggers/portal.yaml` → `portal-deploy` |
   | `urs-matcher-deploy` | `triggers/urs.yaml` → `urs-deploy` |
   | `rozpocet-registry-deploy` | `triggers/registry.yaml` → `registry-backend-deploy` |
   | `build-mineru-service` (уже с includedFiles, работает) | `triggers/mineru.yaml` → `mineru-service-deploy` |

2. **Import ЗАМЕНЯЕТ конфиг целиком**, а значения `_REDIS_URL`/`_VPC_CONNECTOR`
   живут только в живом `concrete-agent-deploy` (в репо их нет **намеренно** —
   секрет-значения не коммитим). Прямой импорт репо-файла их сотрёт → деплой без
   Redis/VPC. Поэтому concrete импортируется из **локально пропатченной копии**
   (§3) — окна без значений не возникает вообще.

---

## 1. Backup (rollback-страховка)

```bash
cd ~/STAVAGENT && git pull origin main
mkdir -p /tmp/trigger_backups
for t in concrete-agent-deploy monolit-planner-deploy stavagent-portal-deploy \
         urs-matcher-deploy rozpocet-registry-deploy build-mineru-service; do
  gcloud builds triggers describe "$t" --region=europe-west3 \
    --format=yaml > "/tmp/trigger_backups/$t.yaml" && echo "backup OK: $t"
done
```

**Rollback в любой момент:** `gcloud builds triggers import --region=europe-west3 --source=/tmp/trigger_backups/<имя>.yaml` (+ удалить созданные новые имена).

## 2. Снять секрет-значения с живого concrete-триггера

```bash
REDIS_VAL=$(gcloud builds triggers describe concrete-agent-deploy \
  --region=europe-west3 --format='value(substitutions._REDIS_URL)')
VPC_VAL=$(gcloud builds triggers describe concrete-agent-deploy \
  --region=europe-west3 --format='value(substitutions._VPC_CONNECTOR)')
echo "REDIS=$REDIS_VAL  VPC=$VPC_VAL"
# Обе должны быть НЕпустыми (verified 2026-06-10). Пустые → STOP, не импортировать.
```

## 3. Пропатченная копия concrete-триггера (репо-yaml + значения)

```bash
sed "/_TAG: \$SHORT_SHA/a\\  _REDIS_URL: '$REDIS_VAL'\\n  _VPC_CONNECTOR: '$VPC_VAL'" \
  triggers/concrete-agent.yaml > /tmp/concrete-agent-deploy-patched.yaml
grep -A4 "^substitutions:" /tmp/concrete-agent-deploy-patched.yaml
# Ожидание: _REGION, _TAG, _REDIS_URL=<значение>, _VPC_CONNECTOR=<значение>
```

## 4. Импорт (concrete — из патченной копии, остальные — из репо)

> Репо-yaml после фикса 2026-06-11 уже БЕЗ поля `location:` (import его не
> принимает). Если работаешь со старым checkout'ом — `git pull` сначала.

```bash
gcloud builds triggers import --region=europe-west3 \
  --source=/tmp/concrete-agent-deploy-patched.yaml
for f in triggers/monolit.yaml triggers/portal.yaml triggers/urs.yaml \
         triggers/registry.yaml triggers/mineru.yaml; do
  gcloud builds triggers import --region=europe-west3 --source="$f"
done
```

### 4.1 🛑 ГЕЙТ перед удалением — НЕ пропускать

```bash
gcloud builds triggers list --region=europe-west3 \
  --format='table(name,includedFiles)'
```

**Условие прохода:** ни один import выше не вернул ERROR, И в списке видны ВСЕ
новые имена (`concrete-agent-deploy`, `monolit-deploy`, `portal-deploy`,
`urs-deploy`, `registry-backend-deploy`, `mineru-service-deploy`) с непустым
`includedFiles`. **Любой ERROR или отсутствующее имя → STOP. §5 НЕ выполнять**
— иначе сервисы останутся без деплой-триггеров (инцидент 2026-06-11).

## 5. Удалить старые имена (теперь это дубликаты БЕЗ includedFiles)

```bash
for t in monolit-planner-deploy stavagent-portal-deploy urs-matcher-deploy \
         rozpocet-registry-deploy build-mineru-service; do
  gcloud builds triggers delete "$t" --region=europe-west3 --quiet
done
```

> `concrete-agent-deploy` НЕ удалять — он обновлён in-place в §4.

## 6. Верификация

```bash
# 6.1 Ровно 6 триггеров, у каждого includedFiles:
gcloud builds triggers list --region=europe-west3 \
  --format='table(name,github.push.branch,includedFiles)'
# Ожидание: 6 строк, колонка includedFiles непустая у всех.

# 6.2 Substitutions на concrete уцелели:
gcloud builds triggers describe concrete-agent-deploy --region=europe-west3 \
  --format='value(substitutions._REDIS_URL,substitutions._VPC_CONNECTOR)'
# Ожидание: оба значения на месте.
```

**Поведенческий тест:** следующий docs-only мерж в main → в
`gcloud builds list --region=europe-west3 --limit=5` НЕ появляется ни одного
нового билда. (До фикса появлялось 5 красных.)

## 7. Досрочное закрытие substitution-хвоста (handoff §3) — WARN-grep по билду 00399

Независимо от реимпорта: успешный триггерный билд, задеплоивший revision
`concrete-agent-00399-hd9`, уже прогнал новый bash-deploy-step (#1327). Если в его
логе НЕТ WARN-строк — механизм отработал живым билдом, хвост закрыт:

```bash
BUILD_ID=$(gcloud builds list --region=europe-west3 --limit=10 \
  --filter='buildTriggerId="c5efd974-52f4-4bd6-a086-ac6670337540" AND status=SUCCESS' \
  --format='value(id)' | head -1)
echo "build: $BUILD_ID"
gcloud builds log "$BUILD_ID" --region=europe-west3 | grep -E 'WARN: _(REDIS_URL|VPC_CONNECTOR)' \
  && echo "🔴 WARN найден — substitutions НЕ применились (регрессия значений в триггере)" \
  || echo "✅ WARN нет — substitutions применились, хвост handoff §3 закрыт"

# Контрольный (env на самой ревизии):
gcloud run revisions describe concrete-agent-00399-hd9 --region=europe-west3 \
  --format='value(spec.containers[0].env)' | tr ';' '\n' | grep -c REDIS_URL
# Ожидание: 1
```

## Примечания

- **Имена 5 триггеров меняются** на репо-конвенцию (`monolit-deploy` и т.д.) —
  намеренно: репо становится единственным источником правды конфига триггеров.
- `triggers/deploy-all.yaml` (ручной, branch `^$`, approvalRequired) живым не
  числится — НЕ импортируем в этом runbook'е (отдельное решение, не cost-фикс).
- Guard-степы в cloudbuild-yaml остаются как defence-in-depth (аудит §4).
- После задачи №3 (убийство Redis) substitutions `_REDIS_URL`/`_VPC_CONNECTOR`
  станут неактуальны — empty-safe bash-step корректно их опустит.
