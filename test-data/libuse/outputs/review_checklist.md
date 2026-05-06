# Libuše Objekt D — Full Excel Review Checklist

Companion artifact for the next-session per-item walk-through of
`Vykaz_vymer_Libuse_objekt_D_dokoncovaci_prace.xlsx` (12 sheets, 3 021
items, ~762 KB) on PR #1066. Use **List 12 `12_Filter_view`** as the
working surface — Excel Table `VykazFilter` (range A2:M3023) gives ▼
multi-select filters on every column.

> Numbers below come from a fresh openpyxl scan of the deliverable on
> commit `c970d2f` — they match the actual data, not the round figures
> sketched in `next-session-libuse.md`.

---

## How to use List 12 Filter_view

1. Open `Vykaz_vymer_Libuse_objekt_D_dokoncovaci_prace.xlsx` → switch to
   sheet **12_Filter_view**.
2. Header row 1 has metadata (`Total items: 3021`); data starts row 3.
   Freeze pane is at **A3**, so the header band stays visible while you
   scroll.
3. Click **▼** on any column header in row 2 to open Excel's native
   filter dialog → multi-select checkboxes per value.
4. Status column has conditional formatting:
   green = matched, yellow = needs_review, red = VYNECHANE_KRITICKE,
   grey = VYNECHANE_DETAIL.
5. Confidence column has a 0–1 data bar.
6. Source column is fixed read-only ("'1_Vykaz_vymer' read-only");
   to **edit** values, do it on List 1 — List 12 mirrors it.

---

## ⛳ Pre-flagged finding before review starts — PROBE 7 candidate

User reported a TABL vs FAKT door-count mismatch
(D10/D11/D20/D21/D42). Verification done in this session:

| Code | TABL (Tabulka 0041, D-room filter, raw) | FAKT (DXF segment_counts authoritative) | Δ | User-reported |
|------|---:|---:|---:|---|
| D10 | 0  | 1  | +1 | ✓ matches |
| D11 | 0  | 1  | +1 | ✓ matches |
| D20 | 1  | 1  | **0** | user said TABL=2 (+1 over actual) |
| D21 | 11 | 11 | **0** | user said TABL=10 (–1 vs actual; cislo=128 has D rooms but B-range numbering — likely user-excluded) |
| D42 | 1  | 1  | **0** | user said TABL=2 (+1 over actual) |
| **Net** | **13** | **15** | **+2** | user-net +1 |

### What is real

1. **D10 (1.NP fasádní hlavní vstup, 1600×2350)** is in DWG (block
   `HA_DR_Double_Swing_Solid_FrameButt - In_FAS_1600x2350` in
   `4410_Půdorys 1.NP`) but **absent from Tabulka 0041** for objekt D.
   Other buildings (A, B) have D10 listed as RC3/ESG bezpečnostní s
   EMZ + ACS + samozavírač SN2.
2. **D11 (1.NP fasádní únikový, 900×2350)** is in DWG (block
   `..._In_FAS_900x2350_Unik`) but **absent from Tabulka 0041** for
   objekt D. Other buildings have D11 spec as RC3/ESG + 34 dB +
   bezpečnostní cylindr.
3. **D20, D21, D42 counts match perfectly** between Tabulka and DWG —
   no real discrepancy on these. User-reported Δ on those three was
   likely a counting artifact (e.g. cislo=128 has D rooms in
   Tabulka 0041 but a B-range cislo, easy to mis-bucket).

### Items affected

- **D10 dveřní položky** (rows 1920–1923, 2187–2194): **11 items**, qty=1
  each (work) or qty=4.2/6 m. **STD interior treatment** — missing the
  RC3 bezpečnostní rám + bezpečnostní křídlo + EMZ elektromechanický
  zámek + ACS access-control wiring + samozavírač SN2 that Tabulka 0041
  spec for D10 (in A/B buildings) requires. Estimated under-spec impact
  **~60–105k Kč**.
- **D11 dveřní položky** (rows 1926–1931, 2203–2215): **19 items**, full
  bezpečnostní pack present (RC3 rám + křídlo + cylindr + 5 klíčů + pant
  pojistka + dodatečné kotvení + rektifikační šrouby). **Looks
  complete.**
- **Špalety v rooms hosting D10/D11** (D.1.S.01 + D.1.S.02 entrance
  hall + utility): Phase 6.5 v2 ownership-driven calc relies on Tabulka
  0041 → these doors aren't in ownership.json → ~7 m² špalet × ~600
  Kč/m² ≈ ~4k Kč under-counted.

### Why "Net +1 door FAKT vs TABL" matters less than under-spec

Material/work items for both doors **are in the Excel** (extracted from
DXF segment counts, not from Tabulka). The financial gap isn't 2 missing
doors — it's:

- D10 spec underspecified vs Tabulka 0041 reference: ~60–105k Kč
- Špalety m² in 2 rooms not counted: ~4k Kč

**Stop threshold** (>50k Kč Δ): potentially **breached** by D10 spec
gap. Need user confirmation before generating Phase 0.21 fix script —
either:
- (a) regenerate D10 items with bezpečnostní pack to mirror D11 + spec
  ACS wiring + EMZ zámek, OR
- (b) confirm with ABMV that objekt-D D10 is a **different door type**
  than A/B (perhaps a downgraded variant) and we keep current STD spec.

This becomes ABMV email item #7. Keep `documentation_inconsistencies.json`
update for the moment user approves direction.

---

## Pre-flight health check (clean ✅)

| Check | Result |
|-------|--------|
| Git: 21 commits on PR #1066 incl. `48f45fb` + 1 doc-bump `c970d2f` | ✅ |
| Working tree | ✅ clean |
| Excel sheets | ✅ 12 (incl. 12_Filter_view) |
| Excel Table `VykazFilter` on List 12 | ✅ range A2:M3023 |
| Items count | ✅ 3 021 (matches metadata) |
| List 11 master rows (Sumarizace_dle_kódu) | ✅ 579 |
| Phase markers (0.11–0.19, 6.5 v1+v2, 7a) | ✅ all `True` |
| `carry_forward_findings` JSON populated | ⚠️ **only PROBE 1 + 2**; PROBE 3 in Excel only; PROBE 4–6 = empty INFO rows in Excel sheet 8 (rows 5–7) |

The carry-forward gap means the structured handoff to A/B/C runs is
slightly thin. Recommendation: backfill PROBE 3–6 into both
`items_objekt_D_complete.json` `carry_forward_findings[]` AND Excel
sheet 8 before merge. Low cost, ~15 min script. Track as separate
sub-task; not blocking review.

---

## Axis A — per Podlaží (5+ řezů)

Filter column **Podlaží** (col 13). Real distribution:

| Podlaží | Items | Notes |
|---------|------:|-------|
| 1.PP | 795 | sklepní kóje + chodby + komplex 1.PP |
| 2.NP | 566 | byty 2.NP |
| 3.NP | 565 | byty 3.NP + sedlová střecha |
| 1.NP | 555 | byty 1.NP + obchodní jednotky + entry hall |
| ALL | 359 | dveře/okna pohyblivé per-typ items, rozpočtené napříč |
| fasáda | 123 | vnější obklady, fasádní povrch |
| střecha | 34 | RF11/RF13 střecha hlavní |
| VRN | 11 | vedlejší rozpočtové náklady |
| 1.PP střecha | 6 | nad-1.PP terasy |
| staveniště | 5 | zařízení staveniště |
| ALL — schodiště | 2 | schodišťové prvky napříč |

**Total**: 3 021 items (deprecated 11 D05 included).

Per-podlaží checks:

- 1.PP: are S.D.16 (7.62 m²) + S.D.42 (2.99 m²) sklepní kóje represented? Phase 0.11 manually injected — verify rows present.
- 1.NP: D.1.S.01 + D.1.S.02 entrance rooms — D10/D11 dveřní items there?
  (Per PROBE 7: yes, qty=1 each, but D10 underspec.)
- 2.NP: 9 koupelen with WF32 podezdívka van — F06 keramický obklad qty
  reasonable per Tabulka 0030?
- 3.NP: 8 POKOJ rooms with `F povrch stěn = "F05, F20"` (typo per
  Phase 0.10 audit, F20 = podlahový kód) — verify Excel uses F05 only
  or has both?
- fasáda: ETICS sokl XPS 100 + main ETICS EPS 200 — vedení spojených
  drobných položek complete?

---

## Axis B — per Kapitola (top 21 by item count)

Filter column **Kapitola** (col 3). 50 distinct values total.

| Kapitola | Items | Description |
|----------|------:|-------------|
| HSV-631 | 503 | Cementové potěry / mazaniny |
| PSV-784 | 491 | Malby vnitřní |
| PSV-763.2 | 215 | Sádrokarton příčky |
| PSV-771 | 202 | Podlahy z dlažeb |
| PSV-781 | 172 | Obklady keramické (vč. F06 koupelen) |
| HSV-612 | 170 | Omítky vnitřní sádrové |
| PSV-776 | 168 | Podlahy vinyl + Gerflor |
| HSV-611 | 142 | Omítky vnitřní vápenocementové |
| PSV-763.1 | 136 | SDK podhled |
| HSV-642 | 99 | Osazení zárubní (vč. 11 D10 + 19 D11 items) |
| PSV-767 | 97 | Kování + zámky dveří |
| PSV-783 | 93 | Nátěry konstrukcí |
| PSV-766 | 91 | Konstrukce truhlářské (dveře dodávka) |
| HSV-713 | 86 | Zateplení obvodových konstrukcí |
| PSV-713 | 75 | Tepelná izolace stropů (incl. F15 PROBE 4) |
| OP-detail | 63 | Ostatní detaily |
| PSV-764 | 41 | Konstrukce klempířské |
| PSV-763 | 35 | Sádrokarton (mix) |
| PSV-712 | 19 | Hydroizolace |
| LI-detail | 14 | Ledger detaily |
| PSV-952 | 13 | Úklid stavby + závěrečný úklid |

Per-kapitola checks:

- HSV-611 + HSV-612 (špalety) — Phase 6.5 v2 cross-check fixed Bug #4
  fallback 50→115 mm. Sample 5 koupelen (D.1.2.01, D.1.3.01, D.2.1.01)
  → vnitřní špalety should now be 7.560 m² s tl. 150 mm SDK.
- HSV-631 cementové potěr → 503 items; PROBE 1 says komplex VV missed
  ~2000 m² (~50 % gap). D-side per Phase 0.18 PSB beton 40mm covered.
- PSV-781 obklady → 172 items; PROBE 2 says komplex hydroizolace pod
  obklad 240 m² gap; D-side 71 m² koupelen F06 should be present.
- PSV-783 nátěry → check F14 bezprašný nátěr ŽB stěn coverage
  (Phase 0.13, 80 items per 39 1.PP rooms × 2).
- HSV-642 osazení zárubní → 99 items; verify per-D## door counts
  match Tabulka 0041 (D31/D33/D34 etc. + the PROBE 7 D10/D11/D42
  inconsistencies above).

---

## Axis C — per F-kód (skladby) — 154 distinct codes detected

Filter column **Skladba/povrch** (col 8). Codes are embedded as
`F_povrch_sten=F19; vrstva=...` or `FF=FF20; vrstva=...` so use the
filter's "contains" mode or pin a specific code via row autocomplete.

Top groups:

| Code group | Count | Description |
|------------|------:|-------------|
| F01–F19 (povrch stěn) | various | F04/F05 sádrová, F06 obklad, F08 cihelné pásky Terca, F11 epoxid (PROBE 5), F13 silikonová omítka, F14 bezprašný nátěr ŽB, F15 tepelná izolace stropů 1PP (PROBE 4), F19 vápenocementová |
| FF20/21/30/31 | 75–205 | NP podlahové skladby (potěr + kročejová + PSB beton 40mm — Phase 0.16/0.17/0.18) |
| CF20/CF21 | 306 | Stropní podhled chodeb / koupelny SDK D112 (Phase 0.15, +227k) |
| WF40/41/50/51 | 100+115 | Vnitřní stěny + SDK předstěny |
| RF11/13/20 | 14+5+? | Plochá střecha + balkóny terasová dlažba |
| TP01–TP29 | varies | Terasové prvky (parapets, oplechování) |
| OP01–OP99 | varies | Otvorové prvky (parapets, klempířské) |
| LI/LP | varies | Lišty, profilové prvky |
| W01/03/04/05/83 | varies | Okenní bloky, parapets |
| D01–D42 | varies | Dveře dle Tabulka 0041 |

Per F-code checks:

- **F11 epoxidový nátěr** podlahy 1.PP → 129 items (Phase 0.13, 43 ×
  3 layer-vrstvy). Verify all 43 1.PP rooms covered.
- **F14 bezprašný nátěr ŽB** stěn 1.PP → 80 items (Phase 0.13, 39
  rooms × 2 stěny+strop sady). Verify.
- **F15 tepelná izolace stropů 1.PP** → 86 items (Phase 0.12 PROBE 4
  fix, 43 D-rooms × 2). 278.61 m² × ~480 Kč/m² ≈ 134k Kč.
- **CF20/CF21 SDK podhled D112** → 34 items (Phase 0.15, +227k Kč).
- **FF20/21/30/31 PSB beton 40mm m³** → 56 items (Phase 0.18, +141k Kč).
- **F06 keramický obklad** → 32 + 12 gap-fill items (Phase 0.17, +9k).
- **D05 (rolovací brána Hoermann)** → 11 items DEPRECATED with qty=0
  (Phase 0.19 PROBE 6, scope C, not D).
- **D10/D11** → see PROBE 7 callout above.

---

## Axis D — per Status (audit triage)

Filter column **Status** (col 10). Real distribution:

| Status | Items | Action |
|--------|------:|--------|
| no_match | **1 769** | needs KROS ÚRS pricing (List 11 master rows = 579) |
| needs_review | **611** | manual qty/price verify |
| matched_high | 149 | OK, low priority spot-check |
| VYNECHANE_DETAIL | 148 | Phase 5 audit — old VV missed details |
| VYNECHANE_KRITICKE | 136 | Phase 5 audit — old VV missed critical (PROBE 1+2+3) |
| matched_medium | 124 | review confidence < 0.85 → spot-check |
| OPRAVENO_POPIS | 73 | track our description corrections |
| OPRAVENO_OBJEM | 11 | track our quantity corrections |

Total: 3 021 items. (D05 deprecated 11 items have status `to_audit` but
qty=0; they're in the 3021 count.)

Per-status checks:

- **no_match**: target = move to matched_high/medium via List 11 master
  + KROS lookup. 1 769 → 579 master rows = ~3× compression ratio (each
  ÚRS code covers ~3 sub-items on average).
- **needs_review** (611): sample 5–10 across kapitoly, confirm quantity
  matches Tabulka 0020 plocha_m2.
- **VYNECHANE_KRITICKE** (136): cross-reference PROBE 1+2+3 entries.
- **OPRAVENO_OBJEM** (11): verify our 11 quantity corrections include
  D05 → qty=0 deprecate, FF01 → qty=0 mismap fix, and the 9 Phase 6.5 v2
  špalety reductions (D.1.1.01 chodba 1.24 → 0 m², etc.).

---

## Per-item control points

Run these for each row your filter narrows to:

- [ ] **Popis** přesný + odpovídá master Tabulce 0030 / 0041 / 0050?
- [ ] **Mnozstvi** sedí proti Tabulce 0020 sloupec `plocha_m2` × správný
  faktor (1× fasádní špalety, 2× vnitřní, etc.)?
- [ ] **Skladba_ref** matches Tabulku 0020 sloupce `FF` / `F povrch *` /
  `D povrch *`?
- [ ] **Místo_kód** v platném D-scope (D.* / S.D.*)? Ne A/B/C zbytky?
- [ ] **Status** logical? `deprecated` = D05 only; `OPRAVENO_*` = naše
  fix, ne přílepek; `VYNECHANE_*` = real Phase 5 finding?
- [ ] **Confidence**: < 0.7 → expected for `no_match`; ≥ 0.85 →
  expected `matched_high`. Nesoulad = wrong status assigned?

---

## Findings to look for (new PROBE candidates)

1. **Wrong-template items** — typu D05 case: door code in DWG is
   actually rolovací brána / specialty + Phase 0.x classifier picked
   default door treatment. Look at HSV-642 + PSV-766 outliers (qty very
   low or popis doesn't match block_name in DXF).
2. **Out-of-scope items** — items v `D.* / S.D.*` které ve skutečnosti
   patří A/B/C (jako D05 z=S.C.02). Filter Místo_kód → look for `S.C.*`,
   `S.B.*`, `S.A.*` mistaken as D.
3. **Missing categories** — filter Kapitola → identify F-kódy v
   Tabulce 0030 with 0 items in PR. Compare against
   `coverage_audit.json`.
4. **Quantity mismatches** vs Tabulka 0020 — sample 5 random rooms
   per podlaží, sum špalety + povrch + podlaha qty, compare against
   `plocha_m2` from 0020. Tolerance ±5 % per Phase 5 audit rules.
5. **Duplicate pairs** — Phase 6 montáž+materiál pairing flag. Two
   items with identical `kapitola + popis + místo` but different
   confidence.
6. **D10 underspec follow-through** — see PROBE 7 callout. If approved,
   regenerate 11 D10 items with bezpečnostní pack mirroring D11.
7. **Document inconsistency hits** in 6 ABMV email items — F20 misuse
   in 8 POKOJ 3.NP, F30 in 4 WC, F20 in D.1.4.03 WC, D.1.3.01 misfile
   in printed legenda, S.D.16+S.D.42 missing in DXF (Phase 0.11 fixed).

---

## Output of next session

Per finding the user confirms:

- User decision per finding (DEPRECATE / FIX / KEEP / NO_CHANGE)
- PROBE 7+ row appended to `carry_forward_findings[]` (both JSON +
  Excel sheet 8)
- Phase 0.21+ fix scripts per finding
- Updated Excel + 1 commit per PROBE
- ABMV email item appended to `documentation_inconsistencies.json` →
  `abmv_email_required[]`

After review pass complete: PR #1066 ready for merge → ABMV email send →
KROS manual ÚRS pricing on List 11 → VELTON delivery.

---

_Generated by Claude Code session 2026-05-06 from `c970d2f` baseline._
