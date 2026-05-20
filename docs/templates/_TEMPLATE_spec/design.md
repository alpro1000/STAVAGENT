# {Feature Name} — Design

> **Spec ID:** `{feature-name-kebab-case}`
> **Datum:** {YYYY-MM-DD}
> **Status:** draft | review | approved | implementing | done
> **Owner:** Alexander Prokopov / {Claude Code session}
> **Prerequisites:** `requirements.md` approved

---

## 1. Přehled řešení

[2-4 věty: jak se to bude řešit na vysoké úrovni. Ne implementační detaily — concept.]

---

## 2. Architectural fit

### 2.1 Které služby jsou dotčené

| Služba | Role v tomto designu |
|---|---|
| concrete-agent | [Co dělá / jaká nová endpoint / parser / KB layer] |
| stavagent-portal | [Co dělá] |
| Monolit-Planner | [Co dělá] |
| URS_MATCHER_SERVICE | [Co dělá] |
| rozpocet-registry | [Co dělá] |

### 2.2 Vztah ke stávajícím subsystémům

[Jaké existující subsystémy se rozšiřují nebo refactorují. Reference do `docs/steering/structure.md`.]

- {Subsystém 1 — co se mění}
- {Subsystém 2 — co se mění}

### 2.3 Tier strategy (LLM / determinism)

[Per `docs/steering/tech.md` AI tier strategy: regex → catalog → LLM fallback.]

- **Deterministický layer:** {Co se řeší regexem / catalog lookupem}
- **LLM fallback:** {Kdy a jaký provider — Vertex AI Gemini / Bedrock / Perplexity}
- **Confidence scoring:** {Jaké zdroje, jaké hodnoty, jaký merge rule}

---

## 3. Data flow

[Step-by-step toku dat. Diagram OK (mermaid / ASCII), ne povinný.]

```
User input → {Service A} → {Service B} → {DB / KB / cache} → Response
```

### 3.1 Klíčové datové struktury

- {DTO 1 — pole}
- {DTO 2 — pole}

### 3.2 Persistence

- **Tabulky / schemata:** {Které DB tabulky se přidávají / mění}
- **Migrace:** {Stručně co dělá nová migrace}
- **Cache:** {Co se cache-uje, TTL}

---

## 4. API contracts

> **High-level only.** OpenAPI / JSON Schema patří do kódu, ne sem.

### 4.1 Nové endpointy

| Method | Path | Účel |
|---|---|---|
| POST | `/api/{...}` | {Co dělá} |
| GET | `/api/{...}` | {Co dělá} |

### 4.2 Změny existujících endpointů

- {Endpoint X — co se mění a backward-compatibility status}

### 4.3 MCP wrapper (pokud relevant)

[Pokud feature dodává nový MCP tool nebo mění existující — reference na `concrete-agent/app/mcp/tools/` + compatibility check.]

---

## 5. Decisions & trade-offs

### 5.1 Decision 1: {Název}

- **Volba:** {Co se vybralo}
- **Alternativy:** {Co se zvažovalo}
- **Důvod:** {Proč právě tato}
- **Trade-off:** {Co se obětuje}

### 5.2 Decision 2: {Název}

- **Volba:** ...
- **Alternativy:** ...
- **Důvod:** ...
- **Trade-off:** ...

---

## 6. Failure modes

[Co se pokazí když některá komponenta selže. Pro každý: behavior + recovery + user-facing message.]

| Komponenta | Failure | Behavior | Recovery |
|---|---|---|---|
| {LLM provider 1} | Timeout 90s | Fallback na {provider 2} | Auto retry |
| {Cloud SQL} | Connection drop | Retry 3× exponential | Surface 503 |

---

## 7. Security & privacy

- **Auth:** {Jaký auth mechanism — JWT, OAuth, API key}
- **Authorization:** {Cross-user isolation rule, scope rules}
- **PII / GDPR:** {Co je PII v tomto feature, retention, jak se loguje}
- **Audit trail:** {Co se loguje pro audit}

---

## 8. Performance & scaling

- **Expected load:** {Requests/min, data volume}
- **Latency budget:** {p50, p95, p99}
- **Cost estimate:** {LLM call cost per operation, GCP infra delta}
- **Cold start impact:** {Cloud Run min-instances důsledek}

---

## 9. Testing strategy

[Jaké testy se přidají. Bez konkrétních file paths — to je v `tasks.md`.]

- **Unit:** {Co pokrývá unit layer}
- **Integration:** {Service ↔ service edges}
- **Golden tests:** {Které golden test fixtures se přidávají / mění}
- **MCP compatibility check:** {Yes / No — pokud feature mění modul wrapped MCP toolem, MUSÍ se ověřit přes `tests/test_mcp_compatibility.py`}

---

## 10. Rollout plan

- [ ] Feature flag {název / žádný}
- [ ] Local dev
- [ ] Staging deploy
- [ ] Canary (pokud high-risk)
- [ ] Production deploy
- [ ] Monitor for {N} dní
- [ ] Sign-off do `verify.md`-style follow-up

---

## 11. Open design questions

[Co je v designu neúplné a vyžaduje rozhodnutí Alexandra nebo další investigation.]

- [ ] {Otázka 1}
- [ ] {Otázka 2}

---

## 12. References

- Requirements: `docs/specs/{name}/requirements.md`
- Steering: `docs/steering/{relevant}.md`
- Related specs / bugs: `docs/{specs,bugs}/{...}/`
- Source norms / TZ: [Cesta]
- Existující kód: [Stručně co prozkoumat — moduly, nepředkládat full file paths]

---

<!-- ============================================== -->
<!-- PRAVIDLA PRO DESIGN.md:                          -->
<!--                                                  -->
<!-- 1. CONCEPT, ne implementace                      -->
<!--    - "Jak to vyřešíme" na úrovni architektury    -->
<!--    - Konkrétní soubory / SHA / API signatury     -->
<!--      patří do tasks.md nebo do PR diff, ne sem.  -->
<!--                                                  -->
<!-- 2. DECISIONS a TRADE-OFFS jsou hlavní hodnota    -->
<!--    Sekce 5 je nejdůležitější. Bez ní design.md   -->
<!--    je jenom popis, ne návrh.                     -->
<!--                                                  -->
<!-- 3. FAILURE MODES jsou povinné                    -->
<!--    STAVAGENT je multi-provider (Vertex/Bedrock/  -->
<!--    Perplexity/Claude/OpenAI) + multi-service —   -->
<!--    bez failure-mode analýzy je design ne-prod-   -->
<!--    ready.                                        -->
<!--                                                  -->
<!-- 4. Vztah ke STEERING                             -->
<!--    Sekce 2.3 (tier strategy) musí cite           -->
<!--    `tech.md`. Sekce 7 musí cite `domain.md` /    -->
<!--    `conventions.md` security policies.           -->
<!--                                                  -->
<!-- 5. MCP COMPATIBILITY                             -->
<!--    Pokud feature dotkne se modulu wrapped MCP    -->
<!--    toolem (otskp_engine, perplexity_client,      -->
<!--    parsers, pdf_parser, kb_loader) — sekce 9     -->
<!--    MUSÍ obsahovat "MCP compatibility check: Yes" -->
<!-- ============================================== -->

---

## 13. Versioning

| Date | Version | Changes |
|---|---|---|
| {YYYY-MM-DD} | 0.1 | Initial design |
