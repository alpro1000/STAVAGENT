# Pre-Hackathon Demo Verification Checklist

**Run this BEFORE Apr 21, 2026.**
**Time needed:** 30–45 minutes of manual work in a browser.

This checklist mirrors the 5 user flows a hackathon judge is likely to exercise. If any step fails, fix it before the demo or have a fallback ready.

---

## 1. Subdomain availability

Open each URL in a fresh incognito window (no cached auth). Each should load without 404 / 500 / certificate warning.

- [ ] https://www.stavagent.cz — landing page renders, hero + CTA visible
- [ ] https://kalkulator.stavagent.cz — Monolit Planner shell loads
- [ ] https://klasifikator.stavagent.cz — URS Matcher shell loads
- [ ] https://rozpocet.stavagent.cz — Registry shell loads

**If any fails:**
- Vercel: check `vercel.com/dashboard` deployment status for the affected frontend.
- Cloud Run: `gcloud run services describe <name> --region=europe-west3` — confirm latest revision is `READY`.
- DNS: `dig <subdomain> +short` — should resolve to the expected target (Vercel CNAME or Cloud Run hostname).

---

## 2. Registration flow

On https://www.stavagent.cz:

- [ ] Step 1: enter `email + password` — form accepts and advances
- [ ] Step 2: enter `organization name` — form accepts and advances
- [ ] Step 3: confirmation email arrives (check Spam / Promo folders)
- [ ] Click confirmation link → account marked active
- [ ] Welcome bonus: 200 credits visible in account header / dashboard
- [ ] Logout → login again with same credentials → credits persisted

**If fails:**
- Portal backend logs: `gcloud run services logs read stavagent-portal-backend --region=europe-west3 --limit=50`
- Check `JWT_SECRET` consistency between Portal and Monolit (Secret Manager).
- Email delivery: confirm SMTP / SendGrid creds in Secret Manager.

---

## 3. Core demo flow (the one judges will care about)

On https://kalkulator.stavagent.cz (after login):

- [ ] Upload a test Excel (rozpočet or výkaz výměr — keep one ready in `~/test-data/`)
- [ ] Parsing completes without timeout, positions appear in the table
- [ ] Click into a position → calculator page loads
- [ ] OTSKP / ÚRS codes render with confidence scores
- [ ] "Vypočítat plán" produces a result with KPIs, no error toast

**If fails:**
- concrete-agent logs: `gcloud run services logs read concrete-agent --region=europe-west3 --limit=50`
- URS Matcher logs: `gcloud run services logs read urs-matcher-service --region=europe-west3 --limit=50`
- Check Vertex AI / Bedrock quotas — `ThrottlingException` was a known BACKLOG item.

---

## 4. MCP server health

```bash
# Replace <mcp-url> with actual concrete-agent Cloud Run hostname
curl -s https://<mcp-url>/mcp/v1/manifest | jq '.tools | length'
```

- [ ] Returns `9` (the 9 tools listed in CLAUDE.md)
- [ ] Cloud Run revision matches the latest commit on main:
      `gcloud run revisions list --service=concrete-agent --region=europe-west3 --limit=1`

---

## 5. State persistence (the reason min-instances=1 was added)

This validates Phase 1 of the pre-demo fix actually works:

- [ ] Upload a document on concrete-agent
- [ ] Note the project ID from the URL
- [ ] Wait 15 minutes (let Cloud Run try to scale to zero)
- [ ] Open a new incognito tab, navigate to the same project URL
- [ ] Project state, parsed positions, and intermediate results are still there

**If fails:**
- Confirm min-instances was applied:
  ```bash
  gcloud run services describe concrete-agent \
    --region=europe-west3 \
    --format="value(spec.template.metadata.annotations.'autoscaling.knative.dev/minScale')"
  ```
  Expected: `1` (not empty, not `0`).
- If empty: the latest deploy didn't apply the YAML change. Re-trigger via push or:
  `gcloud run services update concrete-agent --region=europe-west3 --min-instances=1`

---

## 6. Smoke test: write something to the DB

Confirms Cloud SQL is reachable from Cloud Run after the authorized-networks cleanup (Phase 2):

- [ ] Register a brand-new test user via the Portal
- [ ] Verify the user shows up in the DB:
  ```bash
  gcloud sql connect stavagent-db --user=postgres --database=stavagent_portal
  # then:  SELECT email, created_at FROM users ORDER BY created_at DESC LIMIT 3;
  ```

If the SELECT returns the new email → Cloud SQL Auth Proxy works fine without authorized networks. ✅

---

## Results

```
Date of verification:  ________________
Subdomains OK:          [ ] All 4   [ ] Some failed (list: ______________)
Registration OK:        [ ] Yes     [ ] No (issue: _____________________)
Core demo OK:           [ ] Yes     [ ] No (issue: _____________________)
MCP OK:                 [ ] Yes     [ ] No (issue: _____________________)
State persistence OK:   [ ] Yes     [ ] No (issue: _____________________)
DB smoke OK:            [ ] Yes     [ ] No (issue: _____________________)

Critical issues fixed:  [ ] Yes     [ ] Deferred to BACKLOG
Ready for hackathon:    [ ] YES     [ ] NO — blockers: ___________________
```

If anything fails, fix or document immediately. Don't go into the hackathon with unverified flows.
