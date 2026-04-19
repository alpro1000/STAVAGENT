# STAVAGENT Backlog

**Last Updated:** 2026-03-28 (Session 8)

---

## 🔴 Ожидает действий пользователя

### 1. Stripe — настройка платежей
**Блокирует:** Pay-as-you-go (код полностью готов)
```bash
# 1. Создать аккаунт dashboard.stripe.com
# 2. Получить ключи
# 3. Добавить в Secret Manager:
echo -n "sk_live_..." | gcloud secrets create STRIPE_SECRET_KEY --data-file=- --project=project-947a512a-481d-49b5-81c
echo -n "whsec_..." | gcloud secrets create STRIPE_WEBHOOK_SECRET --data-file=- --project=project-947a512a-481d-49b5-81c
# 4. Добавить в cloudbuild-portal.yaml
```

### 2. MASTER_ENCRYPTION_KEY
**Блокирует:** Service Connections (AES-256-GCM)
```bash
openssl rand -hex 32
# → GCP Secret Manager → MASTER_ENCRYPTION_KEY
```

### 3. AWS Bedrock RPM квота
**Влияет:** ThrottlingException при текущих лимитах
- AWS Console → Bedrock → Model access → Request quota increase

### 4. VPC connector для Cloud SQL
**Влияет:** Безопасность (БД на публичном IP)
```bash
gcloud compute networks vpc-access connectors create stavagent-vpc \
  --region=europe-west3 --range=10.8.0.0/28
```

---

## 🟠 Высокий приоритет

### 5. Verify deploy (субдомены + registration)
- [ ] www.stavagent.cz — landing + auth
- [ ] kalkulator.stavagent.cz — Monolit
- [ ] klasifikator.stavagent.cz — URS Matcher
- [ ] rozpocet.stavagent.cz — Registry
- [ ] Registration 3-step flow + resend email
- [ ] Welcome bonus 200 credits

### 6. Node.js 20.x / 22.x
- Node.js 18.x EOL
- `.nvmrc`, Dockerfiles, CI

### 7. CORE persistence → PostgreSQL
- project_store (in-memory dict) теряется при рестарте
- Migrating: project state, audit results, passport cache
- PostgreSQL schema already created (Phase 4), not used

---

## 🟡 Средний приоритет

### 8. Integration auth
- /api/integration/* endpoints — публичные (нет auth)
- Добавить X-Service-Key проверку
- URS Matcher auth middleware

### 9. Pump Calculator — TOVModal
- `handlePumpRentalChange` в TOVModal
- `pumpCost` в footer breakdown

### 10. Document Accumulator → persistent storage
- In-memory → Cloud SQL or GCS
- File size validation + temp file cleanup

### 11. npm Security Vulnerabilities
- 4 vulnerabilities (2 moderate, 2 high)
- `npm audit fix` across all services

---

## 🟢 Низкий приоритет / Future

### 12. D.1.4 frontend renderers
- SilnoproudCard, SlaboproudCard, VZTCard, etc.

### 13. IFC/BIM support
- Needs binaries (IfcOpenShell)

### 14. Vitest migration
- Jest → Vitest (better ESM support)

### 15. Landing — screenshot/demo
- Add real analysis result preview to landing page

### 16. reCAPTCHA
- Add when traffic grows

### 17. Full URS catalog import
- OTSKP done (17,904 items)
- Perplexity harvest ready: `POST /api/urs-catalog/harvest`

---

## ✅ Завершено (Sessions 1-8)

| Session | Что |
|---------|-----|
| 1-3 | Cloud Build, Auth, Admin panel, Organizations, Sprint 1 |
| 4 | Universal Parser v3-v5, MinerU, OTSKP engine |
| 5 | Add-Document, NKB v1.0, NormIngestion, Security fixes |
| 6 | Bedrock integration, Portal cleanup, 40+ bug fixes, batch INSERT |
| 7 | Project persistence, NKB frontend, Image OCR, DXF, E2E tests, NKB admin |
| 8 (s5) | Pay-as-you-go credits, Landing redesign, Anti-fraud (6 layers) |
| 8 (s6) | DA→URS integration, URS Matcher dual search fix, rate limiting |
| 8 (s7) | Registration UX, subdomains, kiosk navigation, trust proxy |
| 8 (s8) | Cleanup ~54 stale .md files, deep architecture audit, docs update |
