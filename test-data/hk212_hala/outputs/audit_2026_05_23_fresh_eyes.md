# HK212 Fresh-Eyes Audit — 2026-05-23

**Auditor:** Fresh session (read-only, no mutations except this doc)
**Branch:** `claude/hk212-dilenska-ok-ut-dps-integration` (last commit `258377f3`)
**Scope:** Verify items.json coverage, geometric consistency, ABMV closures, P0/P1/P2 for Stage E readiness
**Sources read:** TZ ARS D.1.1 (5 pp), PBR §1-8 (table 10), items.json (127 items), abmv_email_queue.json (20 items), area_aggregates.json (Step 3), kapitola_coverage_audit.md, STAVAGENT_PATTERNS.md

---

## 0. Verdict TL;DR

🟡 **YELLOW** — Phase 2.1 NOT ready. P0 Kingspan resolved, but 5 new findings surfaced:

| # | Severity | Finding |
|---|---|---|
| F-1 | **P0** | Fasada_netto NOT recalculated after ABMV_2 vrata 3500 closure → PSV-OPL-001/002 mnozstvi 536.4 m² should be **528.5 m²** (drift −1.5 %, but vrata otvory drift +9.2 % unflagged) |
| F-2 | **P1** | ABMV_1 (energy bilance) closure premature: PBR says 21 ks stropní (61.2 kW total), DXF said 40 ks (84 kW). 19 ks ghost reading from DXF needs review |
| F-3 | **P1** | Patky count drift: HSV-2-001/004 imply 7 rámových + 8 štítových; ABMV_17 evidence cites **14 rámových + 10 štítových** → 50 % drift on rámové |
| F-4 | **P1** | ABMV_18 unresolved beton-class conflict: TZ ARS D.1.1 → patky C16/20 XC0 (items.json follows TZ ARS); TZ statika D.1.2 → C25/30 XC4. Two TZ documents disagree, items.json picks one without resolution. |
| F-5 | **P2** | Pattern 8 numbering DUPLICATE in `STAVAGENT_PATTERNS.md` — both "Door-vs-Gate" (line 294) AND new "Re-read TZ" (line 436). Should be Pattern 9. Placement also wrong (after Anti-patterns section). |

Plus 3 verifications carrying forward from previous session: HSV-3 mass reconciliation, HSV-1 výkop default, klempíř lemy detail.

---

## 1. Items.json coverage verdict per kapitola

**Total: 127 items (HSV-1: 27, HSV-2: 18, HSV-3: 14, HSV-9: 4, PSV-71x: 4, PSV-76x: 12, PSV-77x: 6, PSV-78x: 12, PSV-OPL: 8, VRN: 22)**

### HSV-1 Zemní práce (27 items) — ✅ COMPLETE, but P1 drift

| Match vs TZ ARS / PBR | Status |
|---|---|
| Hloubení figury, dohloubky patek, ruční výkopy u sítí, štěrkové lože, zhutnění | ✅ Present (HSV-1-001..018) |
| Vodovod přípojka výkop | ✅ HSV-1-011 (TZ ARS D.1.1 says "vodovod – ano") |
| Kanalizace přípojka výkop | ✅ HSV-1-012 |
| Kácení stromů + frézování pařezů + náhradní výsadba | ✅ HSV-1-020..024 |
| Odstranění asfaltu + odvoz suti | ✅ HSV-1-025..027 |

**Discrepancies:**
- **HSV-1-001 výkop figura = 222.75 m³** (formula `495 × 0.45 m`). Step 3 zastavěná = **538.5 m²**, drift +8.6 % (`538.5 × 0.45 = 242 m³`). ABMV_17 working_assumption is **530 m³** (uses h=1.2 m for patky, 16.6× drift factor vs TZ B claim 32 m³). Three different baselines, no single source-of-truth.
- **HSV-1-013 štěrkové lože = 123.75 m³** (`495 × 0.25 = 123.75`). TZ ARS D.1.1 confirms tl. 250 mm ✅ formula correct, but area base 495 m² consistent with figura base.
- **HSV-1-014 zhutnění podloží = 495 m²** (TZ ARS Edef,2 ≥ 45 MPa) ✅ MATCH.

### HSV-2 Základy + deska (18 items) — ✅ COMPLETE, but P1 patky count drift

| Match vs TZ ARS D.1.1 | Status |
|---|---|
| Patky rámové C16/20 XC0 dvoustupňové 1,5×1,5×(2×0,6) | ✅ HSV-2-001..003 (matches TZ ARS D.1.1 p3) |
| Patky štítové C16/20 XC0 dvoustupňové 0,8×0,8×(0,2×0,6) | ✅ HSV-2-004..006 |
| Krátké pasy mezi patkami | ✅ HSV-2-007..008 |
| Pilota Ø800 L=8 m C25/30 XC4 varianta | ✅ HSV-2-010..012 (ABMV_11 — IGP pending) |
| Beton podlahové desky C25/30 XC4 tl. 200 mm | ✅ HSV-2-013 (`495 × 0.20 = 99.0` ✅) |
| Bednění obvodové desky 95 bm | ✅ HSV-2-014 |
| Výztuž KARI Ø8 100/100 B500B horní + dolní | ✅ HSV-2-015..016 (1955.25 kg × 2 = 3910.5 kg; `495 × 3.95 kg/m² × 2 = 3910 kg` ✅) |
| Distanční podložky 2475 ks (≈ 5/m²) | ✅ HSV-2-017 |
| Hydroizolace SBS pod desku | ✅ HSV-2-018 |

**Discrepancies (P1):**
- **HSV-2-001 patky rámové beton = 18.9 m³** → 7 patek (`18.9 / 2.7`). ABMV_17 evidence: 14 patek rámových. **50 % count drift**.
- **HSV-2-004 patky štítové = 4.096 m³** → 8 patek (`4.096 / 0.512`). ABMV_17 evidence: 10 patek. **20 % count drift**.
- **Beton class conflict (ABMV_18):** TZ ARS D.1.1 p3 says C16/20 XC0 (prostý beton, patky); TZ statika D.1.2 p29+p32 says C25/30 XC4 (deska, pilota). Items.json uses C16/20 XC0 for patky + C25/30 XC4 for deska/pilota — matches **TZ ARS** for patky. ABMV_18 working_assumption says "statika wins". **Items.json contradicts the ABMV working_assumption** for patky. Resolution needed.

### HSV-3 Ocelová konstrukce (14 items) — ✅ COMPLETE, P1 mass reconciliation pending

| Match vs TZ ARS D.1.1 p3-4 | Status |
|---|---|
| IPE 400 sloupy S235 (10263.24 kg) | ✅ HSV-3-001 — matches statika citation |
| HEA 200 štítové sloupy (1455.12 kg) | ✅ HSV-3-002 |
| IPE 450 příčle s náběhem sklon 5.25° (9474.96 kg) | ✅ HSV-3-003 |
| IPE 160 vaznice osová vzd. 1500 mm (5195.04 kg) | ✅ HSV-3-004 |
| UPE 160 krajní vaznice (1030.24 kg) | ✅ HSV-3-005 (ABMV_15 resolved) |
| L 70/70/6 ztužidla stěnová | ✅ HSV-3-006 |
| R20 střešní ondřejské kříže | ✅ HSV-3-007 |
| Styčníkové plechy + spojovací 6 % paušál | ✅ HSV-3-008 |
| Kotvení sloupů — chemická kotva M20 | ✅ HSV-3-009 |
| Montáž OK 28 t EXC2 | ✅ HSV-3-010 (`sum_profiles ≈ 27.4 t` ✅) |
| Doprava 50 km default | ✅ HSV-3-011 |
| Antikorozní + protipožární nátěr R 15 DP1 + revize | ✅ HSV-3-012..014 |

**Discrepancies:** All 14 items have `_length_source` ladder 3 fallback (B5 default × INSERT count, conf 0.70). PROFILY layer geometry extraction (ladder 1, conf 0.90) NOT implemented in Step 2. **Defer to Step 4** (PROFILY-geom + DIMENSION-spatial implementation).

### HSV-9 Ostatní stavební (4 items) — ✅ ADEQUATE

| Match | Status |
|---|---|
| Přesun hmot HSV vodorovně | ✅ HSV-9-001 |
| Pomocné lešení OK + demont. | ✅ HSV-9-002..003 |
| Lešení Kingspan opláštění pojízdné | ✅ HSV-9-004 (cross-ref to PSV-OPL ✅) |

### PSV-71x Izolace (4 items) — ⚠️ PARTIAL (intentional)

| Match | Status |
|---|---|
| Penetrace + hydroizolace soklu SBS | ✅ PSV-71x-001..002 |
| Lišty rohové + ochranná folie | ✅ PSV-71x-003..004 |

**Note:** TZ ARS D.1.1 p4 "Tepelná izolace je součástí sendwchových střešních a stropních panelů Kingspan" — tepelka v panelu, samostatná kapitola netřeba ✅ correctly partial.

### PSV-76x Výplně otvorů (12 items) — ✅ COMPLETE

| Match vs TZ ARS D.1.1 p4 | Status |
|---|---|
| Okna hliníková šedá plastový rám dvojsklo (21 ks) | ✅ PSV-76x-001..004 |
| Sekční vrata 3500 × 4000 mm motorická (4 ks) | ✅ PSV-76x-005..008 — **post Stage E patch** |
| Vnější 2-křídlé dveře 1050×2100 (2 ks) | ✅ PSV-76x-009..012 |

**Discrepancies:**
- **DXF count 21 ks oken vs A104 estimate ~30** — ABMV deferred reconciliation. Currently 21 ks (Step 2 INSERT count).
- TZ ARS says "**Na kratších stranách** budou osazeny **dvojice** sekčních vrat" = 2 strany × 2 vrata = 4 ks ✅ matches PSV-76x-005.
- Step 3 `area_aggregates.json otvory_breakdown.vrata_sekcni.size_m: [3.0, 4.0]` was **NOT updated** after Stage E patch — see Finding F-1.

### PSV-77x Podlahy průmyslové (6 items) — ✅ COMPLETE

| Match vs TZ ARS D.1.1 p4 | Status |
|---|---|
| Penetrace + epoxidová/PU stěrka 4–5 mm 1600 kg/m² | ✅ PSV-77x-001..002 (ABMV_10 working_assumption) |
| Lokální zesílení anchorage zóny + dilatace + lemy + protiskluz | ✅ PSV-77x-003..006 |

### PSV-78x Klempířské konstrukce (12 items) — ✅ COMPLETE, possible overlap with PSV-OPL-005

| Match vs TZ ARS D.1.1 p4-5 | Status |
|---|---|
| Lindab Round Downpipe 150/100 Antique White (4 ks per TZ; DXF=3) | ✅ PSV-78x-001..002 (ABMV_20 working_assumption: 4 wins) |
| Wavin Tegra střešní vpust + montáž | ✅ PSV-78x-003..004 |
| MEA Mearin Plus 3000 NW300 liniový žlab SZ+JZ | ✅ PSV-78x-005..006 |
| Atikové oplechování (titanzinek 95 bm) | ✅ PSV-78x-007 |
| Úžlabí + nároží + tmely | ✅ PSV-78x-008..010 |
| Ostatní oplechování + doprava | ✅ PSV-78x-011..012 |

**Discrepancy (P2):**
- **Overlap risk PSV-78x-007 (atikové oplechování) vs PSV-OPL-005 (lemy + atika + nároží)** — both mention "atika". PSV-78x-007 mj=bm × 95 bm, PSV-OPL-005 mj=bm × 207 bm. Quantitatively distinct, but description overlap risks double-count at tendr stage. Need clear delineation (PSV-78x = standalone klempíř; PSV-OPL = systémové lemy ke Kingspan panelu).

### PSV-OPL Sendvičové opláštění (8 items, NEW Stage E) — see §6 below for detailed cross-check

### VRN (22 items) — ✅ COMPLETE (above typical)

ZS buňky × 3 + oplocení + sítě + WC + BOZP + plán BOZP + pojištění + 2× likvidace + 2× geodézie + 5× revize + DSPS + kolaudace. **Nothing in TZ ARS D.1.1 or PBR contradicts.**

---

## 2. Geometric consistency check (items.json vs area_aggregates.json)

| Item | items.json mn. | area_aggregates ref | Δ % | Verdict |
|---|---:|---|---:|---|
| HSV-1-014 zhutnění podloží | 495 m² | podlahová 495 m² (TZ ARS) | 0 % | ✅ |
| HSV-1-013 štěrkové lože | 123.75 m³ | `495 × 0.25` | 0 % | ✅ |
| HSV-1-001 výkop figura | 222.75 m³ | `495 × 0.45`; Step 3 zast. 538.5 → 242 m³ | **+8.6 %** | ⚠️ P1 |
| HSV-1-025 odstranění asfaltu | 540 m² | step3 zast. 538.5 m² | −0.3 % | ✅ |
| HSV-2-013 deska beton | 99.0 m³ | `495 × 0.20` | 0 % | ✅ |
| HSV-2-014 bednění desky obvodu | 95.0 bm | obvod 103.5 m (Step 3) | **−8.2 %** | ⚠️ P2 (495 m² → obvod = `sqrt(495×4×π)≈79` or `4×√495≈89`; 95 bm seems Step-pre-3) |
| HSV-2-015/016 KARI Ø8 | 1955.25 kg × 2 | `495 × 3.95 kg/m²` | 0 % | ✅ |
| HSV-2-018 hydroizolace pod desku | 495 m² | podlahová | 0 % | ✅ |
| HSV-3-010 montáž OK | 28 t | sum profiles ≈ 27.4 t | +2.1 % | ✅ |
| HSV-3-012/013 OK nátěr | 850 m² | profile surface area | n/a | (informational — not Step 3 derivable) |
| PSV-71x-001/002 sokl HI | 28.5 m² | `obvod 95 × 0.3 m sokl výška` | n/a | ✅ rough |
| PSV-77x-001/002/006 stěrka | 495 m² | podlahová | 0 % | ✅ |
| PSV-78x-007 atika oplechování | 95 bm | obvod 103.5 m | −8.2 % | ⚠️ P2 (same Step-pre-3 95 bm) |
| **PSV-OPL-001/002 obvodový panel** | **536.4 m²** | fasada_netto with vrata 3.0 | 0 % | ⚠️ **F-1: should be 528.5 m² with vrata 3.5** |
| **PSV-OPL-003/004 střešní panel** | **558.8 m²** | strecha_netto | 0 % | ✅ MATCH |
| PSV-OPL-005 klempíř lemy | 207 bm | 2 × obvod 103.5 m | 0 % | ⚠️ flag `_review_qty: true` ✅ acknowledged |

### Critical >10% finding

**PSV-OPL-001/002 quantity NOT updated for vrata 3500 mm.**
- `area_aggregates.json` line 53: `vrata_sekcni.size_m: [3.0, 4.0]` — Step 3 frozen at pre-ABMV_2 closure value.
- Otvory_old (vrata 3.0×4.0) = 86.8 m² → fasada_netto = 536.4 m²
- Otvory_new (vrata 3.5×4.0 per TZ ARS) = 94.8 m² → fasada_netto = **528.5 m²**
- Delta on otvory: **+9.2 %** (within flag threshold)
- Delta on fasada_netto: −1.5 % (below 10 % threshold for outer metric, but root cause uncorrected)
- **Cure (P0):** update `area_aggregates.json otvory_breakdown.vrata_sekcni.size_m`, recompute `fasada_netto`, update PSV-OPL-001 + PSV-OPL-002 mnozstvi 536.4 → 528.5.

### Geometric drift summary

| Drift class | Count | Items |
|---|---:|---|
| **>10 %** | 0 | (PSV-OPL-001 root cause +9.2 %, hits 9.2 % on otvory but propagates as 1.5 % on netto) |
| **5–10 %** | 3 | HSV-1-001 výkop (+8.6 %), HSV-2-014 bednění desky (−8.2 %), PSV-78x-007 atika (−8.2 %) |
| **<5 %** | rest | OK |

---

## 3. ABMV queue status review

| ABMV | Status | Closure correctness | Audit verdict |
|---|---|---|---|
| **ABMV_1** energy bilance 60.5 vs 84 kW | resolved_with_caveats (DXF 84 kW) | **PBR explicitly says 21 ks × 1.2 kW + 4 ks × 9 kW = 61.2 kW** (page 5). DXF said 40 ks FENIX ECOSUN_S+ → 48 kW + 4 ks DALAP 36 kW = 84 kW. **19 ks ghost difference** (PBR 21 vs DXF 40) | 🟡 **F-2 P1 — REOPEN or document further conflict.** Resolution_note uses DXF over PBR without justification. PBR is newer document (09/2025) than likely DXF revision. |
| **ABMV_2** vrata 3500 vs 3000 | resolved (TZ ARS wins 3500 mm) | TZ ARS D.1.1 p4 verbatim: "dvojice sekčních vrat o rozměrech 3500 × 4000 mm" ✅. PSV-76x-005 popis updated ✅. Resolution note cites TZ ARS DPZ D.1.1 + PBŘ p.18 (2:1 vs DXF) ✅ | ✅ **CORRECT** but **F-1 side-effect**: area_aggregates.json vrata size NOT updated → PSV-OPL-001/002 mn. stale. |
| **ABMV_3** stroje DRIFT/DEFRAME/FILTRACE specs | open | Still open. External `2966-1` confirmed via ABMV_16 — same external xref would close both. | ⏳ Awaiting external doc |
| **ABMV_4** stupeň PD DPS/DPZ/DSP | open | TZ ARS D.1.1 title says **"Dokumentace pro povolení záměru — DPZ"** ✅ matches working assumption. Statika D.1.2 is DSP. ARS = DPZ, statika = DSP confirmed. | ✅ Working_assumption holds; can be closed. |
| **ABMV_5** beton třídy desky | working_assumption (C25/30 XC4) | TZ ARS D.1.1 p3 ✅ "Základová deska C25/30 XC4". Statika D.1.2 same. A101 legend C30/37-XC2 is the outlier. | ✅ CORRECT (TZ ARS + statika 2:1 vs A101) |
| **ABMV_6** EW 15 DP1 obvod | working_assumption | PBR table 10 (II. SPB) confirms `15+` for obvodové stěny v posledním NP. EW vs REI distinction: PBR řeší konstrukci obvodu jako "obvodová stěna" (Pol. 3a3 nebo 3b), NE jako "požární uzávěr" (Pol. 2c). **Notation "EW 15 DP1" je technically nesprávná** — should be "REI 15 DP1" or "EI 15 DP1" pro samonosný obvodový plášť. EW je notation pro fire-resistant glass/door assembly. | 🟡 **P2** — verify notation with požárník. Likely cosmetic — všechny references používají "EW 15 DP1" konzistentně. |
| **ABMV_7** plochy 540/520/541 | open | TZ ARS 541 / TZ B 520 / D.1.1 541. **PBR (page 4-5) uses Sz = 520 m²** (third independent source for 520). Working assumption (520) is **2:2** now (TZ B + PBR vs TZ A + D.1.1). Step 3 measured **538.5 m²** (closer to 541 cluster). | 🟡 still open, more data |
| **ABMV_8** oplocení strojů | open | Stage D dropped M-kapitola items as concept-only. Strictly out of scope per current items.json. | ⏳ Per scope decision |
| **ABMV_9** umyvadlo v hale ZTI | open | A101 has umyvadlo INSERT; TZ ARS D.1.1 p2 says "Zázemí... je umístěno v sousední hale, jedná se o stávající zázemí zaměstnanců". **Sousední hala = zázemí**, ale umyvadlo v hale samé není v scope ZTI vnitřní. Možná legacy DXF block. | ⏳ Defer; ZTI D.1.4 missing anyway |
| **ABMV_10** stěrka epoxid/PU | working_assumption | PSV-77x-002/006 carry both variants. ✅ holds. | ✅ |
| **ABMV_11** IGP pending | blocking | Real external dependency. | ⏳ Out of items.json scope |
| **ABMV_12** TZB D.1.4 missing | working_assumption_partial | PBR explicitly lists vodovod+kanalizace+elektro+VZT s rekuperací+chlazení. **PBR confirms VZT EXISTS** — Stage D drop of 15 VZT items as "concept-only" may be **premature**. | 🟡 **P2** — VZT scope re-evaluation needed; PBR confirms not concept-only |
| **ABMV_13** Kingspan IPN vs K-roc | closed_fabricated | TZ ARS D.1.1 ALL Kingspan references = "minerální vata" (MW). PBR §3 confirms "sendvičové desky (Kingspan)". 0 IPN/PIR mentions ✅ | ✅ CORRECT |
| **ABMV_14** svody 3 vs 4 | working_assumption (3 — DXF) | TZ ARS D.1.1 doesn't specify count (only "žlaby a svody dle ČSN 75 6760"). ABMV_20 separately addresses (4 per A104 + TZ B; PSV-78x-001 carries 4). **Two ABMV items same topic** — ABMV_14 redundant with ABMV_20. | 🟡 ABMV_14 should be closed_superseded by ABMV_20 |
| **ABMV_15** UPE160 vs C150 | resolved | ✅ CORRECT (22:2 ratio) |
| **ABMV_16** 2966-1 external xref | resolved_external_xref_confirmed | ✅ CORRECT |
| **ABMV_17** výkopy 32 vs 530 m³ | open | items.json HSV-1-001 uses 222.75 m³ (RE-RUN formula, neither matches TZ B 32 ani DXF 530). **3-way drift**. | 🟡 P1 unresolved |
| **ABMV_18** patky C16/20 vs C25/30 | open | **TZ ARS D.1.1 p3 explicitly says C16/20 XC0** for patky rámové + štítové (prostý beton). Statika D.1.2 says C25/30 XC4 for desku + pilotu (NOT patky per current evidence). **ABMV_18 mis-cites statika** as saying C25/30 for patky — needs statika D.1.2 p31 verification. items.json HSV-2-001/004/007 correctly uses C16/20 XC0 per TZ ARS. | 🟡 **F-4 P1** — re-verify ABMV_18 evidence; items.json may be correct |
| **ABMV_19** Sz inconsistency | open | PBR confirms 520 m² (third independent). Step 3 measured 538.5 m². Still 3-source drift. | ⏳ |
| **ABMV_20** Lindab 3 vs 4 | open | TZ ARS doesn't specify; TZ B + A104 say 4; A101 has 3 INSERTs. PSV-78x-001 mn=4 (working assumption). | ⏳ |

**Closure correctness summary:**
- ✅ Correct: ABMV_2, _4, _5, _10, _13, _15, _16
- 🟡 Questionable / new conflict: ABMV_1 (PBR 21 vs DXF 40), ABMV_12 (VZT not concept-only), ABMV_14 (duplicate of _20)
- 🟡 Items.json may contradict working_assumption: ABMV_18 (items use TZ ARS, ABMV says statika)

---

## 4. Stage E P0/P1/P2 readiness blockers

### P0 (MUST resolve before Stage E benchmark)

1. **F-1: Recompute fasada_netto with vrata 3500 × 4000 mm** (Step 3 stale)
   - Update `area_aggregates.json otvory_breakdown.vrata_sekcni.size_m → [3.5, 4.0]`
   - Recompute `otvory_plocha_m2: 86.8 → 94.8`
   - Recompute `fasada_netto.value_m2: 536.4 → 528.5`
   - Update PSV-OPL-001 + PSV-OPL-002 `mnozstvi: 536.4 → 528.5`
   - Add audit_trail note linking to ABMV_2 closure date
   - Trivial 30-min fix; Stage E numbers depend on this.

### P1 (resolve before Stage E benchmark for clean comparison)

2. **F-3: Reconcile patky count** — HSV-2-001/004 derive **7 + 8 patek** (count from beton volume); ABMV_17 evidence cites **14 + 10 patek**.
   - Check A105 ZÁKLADY DIM 1500 mm × N + DIM 800 mm × M from Step 2 INSERTs.
   - If 14 + 10 confirmed, HSV-2-001 beton patky rámové = 14 × 2.7 = **37.8 m³** (not 18.9), HSV-2-002/003 bednění = 14 × 7.2 = **100.8 m²** (already 100.8 — bednění OK!), HSV-2-004 patky štítové beton = 10 × 0.512 = **5.12 m³** (not 4.096). Quantity drift on rámové = **+100 %**.
   - **Smells like beton vs bednění count inconsistency** within HSV-2 (bednění 100.8 m² implies 14 patek; beton 18.9 m³ implies 7 patek). Bednění is correct.

3. **F-2: ABMV_1 energy bilance — PBR 61.2 kW vs DXF 84 kW**
   - Re-open ABMV_1 with new PBR evidence row.
   - PBR is **newer** PD document (09/2025) than typical DXF rev.
   - Possible explanations: DXF FENIX count 40 ks includes redundancy / future expansion / different mode; PBR 21 ks is design installed.
   - Update resolution_note: cite PBR conflict, leave _status_flag: needs_design_verification.

4. **F-4: ABMV_18 evidence verification** — check `04_statika_d12_TZ_uplna.pdf` p29 + p32 directly:
   - p29: deska C25/30 XC4 — confirmed in TZ ARS too ✅
   - p32: pilota C25/30 XC4 + 8×R25 B500B — confirmed in items.json HSV-2-010..012 ✅
   - **But does statika ALSO say C25/30 for PATKY?** TZ ARS says patky = prostý beton C16/20 XC0. If statika doesn't address patky explicitly, ABMV_18 working_assumption "C25/30 for patky" is unsupported. Items.json (C16/20 for patky) may be correct already.

5. **HSV-3 mass reconciliation (carry-forward P1):**
   - Implement PROFILY layer geometry extraction (Step 2 backlog).
   - Compare ladder 1 (PROFILY geom) vs ladder 3 (B5 default × INSERT). If close → ladder 3 confidence can upgrade.
   - HSV-3-001 IPE 400 = 10263.24 kg already matches statika citation — primary risk is on smaller profiles (HSV-3-005 UPE 160 etc.).

6. **HSV-1 výkop figura final (carry-forward P1):**
   - Three baselines (222.75 / 242 / 530 m³). Pick one + add ABMV closure. Recommended: use Step 3 zastavěná 538.5 m² × 0.45 m hloubka = **242 m³** (consistent with TZ ARS dimensions + Step 3 measurement). Drop the 495 m² fallback. Document under ABMV_17 closure.

### P2 (verify, not blocking)

7. **F-5: Pattern 8 numbering duplicate** in `docs/STAVAGENT_PATTERNS.md`:
   - Line 294: "Pattern 8: Door-vs-Gate Classification Hazard" (pre-existing)
   - Line 436: "Pattern 8: Re-read TZ Before Generating New Položky" (added last session)
   - Also placed AFTER "Anti-patterns" section instead of before.
   - **Fix:** rename second one to "Pattern 9: Re-read TZ Before Generating New Položky" + move before "Anti-patterns" section.

8. **EW vs REI notation** for Kingspan plášť (ABMV_6) — verify with požárník if `EW 15 DP1` is correct or should be `REI 15 DP1` for self-supporting envelope. Likely cosmetic.

9. **PSV-78x-007 atikové oplechování vs PSV-OPL-005 lemy + atika overlap** — clarify delineation in popis to prevent double-count at tendr.

10. **ABMV_12 VZT scope re-evaluation** — PBR explicitly describes VZT rekuperace + chlazení; Stage D drop of 15 VZT items may be premature. Reconsider scope decision (concept-only vs design-stage).

---

## 5. Phase 2.1 readiness verdict

🟡 **YELLOW — NOT READY for Phase 2.1 / Stage E benchmark.**

**Blockers (in order):**
1. ⛔ **F-1 fasada_netto stale** (P0, ~30 min fix) — must resolve before Stage E benchmark
2. ⚠️ **F-3 patky count drift** (P1, ~1 h fix) — would skew HSV-2 beton vs example_vv comparison
3. ⚠️ **F-2 ABMV_1 PBR conflict** (P1, ~30 min docs) — re-open or document
4. ⚠️ **F-4 ABMV_18 evidence verify** (P1, ~30 min read statika p29-p32)
5. ⚠️ **Pattern 8 numbering** (P2, ~5 min docs hygiene)

**Estimated time to GREEN:** 2.5 – 3 h for P0 + P1 fixes. P2 can ship as separate housekeeping commit.

**Once GREEN:** Stage E benchmark vs example_vv corpus (7 výkazů + 6 PDF výkresů) is meaningful — items.json 127 items covers all expected kapitoly with quantities derived from explicit TZ ARS + PBR specs.

---

## 6. PSV-OPL items verification (8 ks added in session 2026-05-22)

### Specs cross-check vs TZ ARS D.1.1

| OPL | items.json popis | TZ ARS D.1.1 quote | Match |
|---|---|---|---|
| 001 | Kingspan KS1000 AWP obvodový tl. **200 mm** (alt. 150) MW bílá+modrá EW 15 DP1 | p4 "Fasáda... Kingspan tl. 200 mm s výplní z minerální vaty"; p2 "Plášť... tl. 200 mm alternativně tl. 150 mm, s výplní z minerální vaty, bílé a modré barvy" | ✅ MATCH (alt. 150 mm correct) |
| 002 | Montáž obvodového — samořezné šrouby + EPDM podložka | p4 "kotveny... systémových samořezných šroubů s těsnicí podložkou EPDM v počtu a rozmístění dle statického návrhu" | ✅ MATCH |
| 003 | Kingspan střešní pro šikmé střechy MW EW 15 DP1 sklon 5.25° `_review_thickness: true` | p4 "Střecha... střešní krytinou ze sendwichových panelů Kingspan s nehořlavou vložkou z minerální vaty" — **NO TLOUŠŤKA SPECIFIED** | ✅ MATCH; `_review_thickness` flag JUSTIFIED |
| 004 | Montáž střešního — kotvení k OK | (implied by p4 fasáda kotvení) | ✅ MATCH |
| 005 | Klempíř lemy + přechody pozink — atika, úžlabí, nároží `_review_qty: true` | p5 "oplechování atik, lemování střechy, parapetní plechy, krycí lišty, úžlabí, nároží a okapové systémy" | ✅ all 6 keywords match; qty 207 bm flagged for review ✅ |
| 006 | Spojovací materiál + EPDM kpl | ✅ implied |
| 007 | Doprava paušál | ✅ logical |
| 008 | Statické posouzení + revize paušál | ✅ implied (TZ says "rozmístění dle statického návrhu") |

### Cross-check vs Step 3 area_aggregates.json

| OPL | items.json mn. | Step 3 metric | Match |
|---|---:|---|---|
| 001/002 obvodový | 536.4 m² | fasada_netto 536.4 m² | ✅ NUMERICALLY MATCH, but **vrata size stale** (vrata 3.0 vs TZ 3.5) → should be **528.5 m²** — see F-1 |
| 003/004 střešní | 558.8 m² | strecha_netto 558.8 m² | ✅ MATCH |
| 005 lemy | 207 bm | 2 × obvod 103.5 m | ✅ MATCH (rough estimate, flagged) |

### Cross-check vs PBR

- **EW 15 DP1**: PBR table 10 (II. SPB) for obvodové stěny posledního NP = "15+" with DP1 requirement (Pol. 3a3 + 3b). **Notation "EW 15 DP1" cosmetically off** (EW is for fire closures/doors; obvod is REI or EI for samonosný plášť). Functionally OK, cosmetically verify with požárník.
- **MW core**: PBR §3 confirms "sendvičové desky (Kingspan)" without disputing fill. TZ ARS says MW consistently. ✅
- **Sklon 5.25°**: PBR §3 confirms 5.25° ✅

### Verdict on PSV-OPL items

**Substantively correct** — TZ ARS specs accurately captured. **Quantity stale** on OPL-001/002 due to Step 3 not being updated post-ABMV_2 closure (F-1). All other items ✅.

---

## 7. ABMV_2 closure correctness — verified

| Check | Status |
|---|---|
| PSV-76x-005 popis "3500 × 4000" (was 3000) | ✅ confirmed in items.json |
| PSV-76x-005 mnozstvi 4 ks | ✅ (TZ ARS "**dvojice** sekčních vrat" × 2 strany = 4 ks) |
| PSV-76x-005 confidence 0.90 (was 0.5) | ✅ |
| PSV-76x-005 _vyjasneni_ref removed ABMV_2 | ✅ (now empty list) |
| ABMV_2 status: open → resolved | ✅ |
| Resolution_note cites TZ ARS DPZ D.1.1 + PBŘ p.18 (2:1 vs DXF) | ✅ "TZ ARS DPZ D.1.1 p.4 + PBŘ p.18 confirm 4× vrata 3500 × 4000 mm. DXF block name... is legacy block library template" |
| Resolution_date: 2026-05-22 | ✅ |
| **Side effect: area_aggregates.json vrata size updated** | ❌ **F-1 — NOT updated, still [3.0, 4.0]** |
| **Side effect: PSV-OPL-001/002 mn recomputed** | ❌ **F-1 — still 536.4, should be 528.5** |

**Verdict:** ABMV_2 closure itself correct, but the **downstream area_aggregates + OPL quantities were not propagated** — classic side-effect drift.

---

## 8. Pattern 8 verification in `docs/STAVAGENT_PATTERNS.md`

| Check | Status |
|---|---|
| Pattern "Re-read TZ Before Generating New Položky" present | ✅ (line 436) |
| Contains HK212 before/after JSON example | ✅ (lines ~454–475 — "Kingspan KS1000 AWP... tl. 200 mm... MW... bílá+modrá") |
| Lists TZ details captured by re-read (200mm, MW, RAL, EW 15 DP1, EPDM) | ✅ |
| `confidence: 0.90` + `_price_source: "user_skipped_pricing"` invariant documented | ✅ |
| Cross-ref ABMV_13 + script | ✅ |
| **Correct sequential numbering** | ❌ **F-5 — DUPLICATE "Pattern 8". Pre-existing Pattern 8 at line 294 is "Door-vs-Gate Classification Hazard". New one should be "Pattern 9".** |
| **Placement before "Anti-patterns" section** | ❌ **F-5 — placed AFTER Anti-patterns (line 375), breaking doc flow.** |

**Verdict:** Pattern content correct + valuable. Numbering + placement need fix (P2 housekeeping).

---

## 9. Recommended action plan to reach GREEN

| # | Action | Effort | Outcome |
|---|---|---|---|
| 1 | Update `area_aggregates.json otvory_breakdown.vrata_sekcni.size_m → [3.5, 4.0]` + recompute otvory + fasada_netto | 10 min | Step 3 consistent with ABMV_2 |
| 2 | Update PSV-OPL-001 + PSV-OPL-002 mnozstvi 536.4 → 528.5 + audit_trail note | 10 min | F-1 resolved |
| 3 | Verify A105 ZÁKLADY DIM count (14 rámových + 10 štítových?). Update HSV-2-001 beton 18.9→37.8 m³ + HSV-2-004 4.096→5.12 m³ | 30 min | F-3 resolved |
| 4 | Re-open ABMV_1 with PBR evidence row; document 21 vs 40 ks FENIX conflict | 20 min | F-2 documented |
| 5 | Read statika D.1.2 p29-32 + verify ABMV_18 patky beton class claim | 30 min | F-4 resolved |
| 6 | Rename Pattern 8 (new) → Pattern 9; move before Anti-patterns section | 5 min | F-5 resolved |
| 7 | Optional: close ABMV_4 (DPS/DPZ/DSP) + ABMV_14 (duplicate of _20) | 10 min | ABMV queue tidier |

**Total:** ~2 h work + commit + push → Phase 2.1 GREEN, Stage E benchmark ready.

---

## 10. Audit metadata

| Field | Value |
|---|---|
| Audit date | 2026-05-23 |
| Auditor | Fresh session (read-only) |
| Branch reviewed | `claude/hk212-dilenska-ok-ut-dps-integration` @ `258377f3` |
| Files read | TZ ARS D.1.1 (5pp), PBR §1-8 (8pp), items.json (127 items, ~8K lines), abmv_email_queue.json (20 items), area_aggregates.json, kapitola_coverage_audit.md, STAVAGENT_PATTERNS.md |
| Mutations made | **None** (this audit doc only) |
| Findings | 5 (F-1 P0, F-2/F-3/F-4 P1, F-5 P2) + 3 carry-forward (HSV-3 mass, HSV-1 výkop, klempíř lemy) |
| Phase 2.1 verdict | 🟡 YELLOW |
