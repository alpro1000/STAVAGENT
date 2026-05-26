# D.1.4.2 VYTÁPĚNÍ DPS 05/2026 — source documents

Source documents from investor SOLAR DISPOREC for D.1.4.2 VYTÁPĚNÍ DPS
(05/2026). Originally TZB out-of-scope (Stage D scope-cut, 2026-05-22),
brought back IN bid by investor scope change 2026-05-26.

## Files referenced in items.json audit_trail

| Path | Status | Description |
|---|---|---|
| `inputs/vykresy_pdf/UT_HalaHK_TZ_DPS.doc` | **in repo** (uploaded 2026-05-26) | Full TZ, 8 sekcí, 11 kW tepelná ztráta, 60 kW příkon |
| `inputs/vykresy_pdf/UT_HalaHK_TZ_VM_DPS_E.pdf` | **in repo** (uploaded 2026-05-26) | TZ + výkaz materiálu, 5 stránek (p.5 = výkaz). Signed Ing. Stanislav Jirucha ČKAIT 0009051, 2026.05.25 19:56 |
| `inputs/vykresy_pdf/UT_HalaHK_PUDORYS_DPS_E.pdf` | **in repo** (uploaded 2026-05-26) | Půdorys vytápění, PDF |
| `inputs/vykresy_dxf/UT_HALAHK_DPS.dxf` | **in repo** | Půdorys DXF, integrated Stage C (2026-05-22) |

All source documents live in `inputs/vykresy_pdf/` per repo convention
for výkresy + drawing-attached TZ. The DXF půdorys is at
`inputs/vykresy_dxf/UT_HALAHK_DPS.dxf` from Stage C ÚT discovery.

> **Note:** PR #1226 audit_trail initially pointed at `inputs/dokumentace/`
> before the investor's actual upload landed. Repathed in follow-up commit
> 2026-05-26 — TZ §8 + výkaz p.5 fully verified, all 11 encoded facts match.

## Key authoritative facts (from TZ §8 + §9)

- Tepelná ztráta: 11 kW (EN 12831, -12 °C, B = 8)
- Celkový instalovaný příkon: 60 kW
  - 20× Fénix ECOSUN S+ 12 (1.2 kW/ks) = 24 kW
  - 4× Dalap E-HP 9 kW = 36 kW
- Vnitřní teplota: 18 °C
- Plocha haly: 495 m²
- Roční spotřeba: cca 46 MWh
- Montážní výška ECOSUN: 5 m (závěs na stropní OK)
- Dalap montáž: rohy haly (4×)

## OUT of scope (elektro profession)

Per items.json `_scope_exclusion.elektro_profession`:

- Napájecí kabeláž (panel + Dalap)
- Kabelové trasy + žlaby + lišty
- Jištění + jističe + proudové chrániče (3×400V/50Hz, 5×2.5 mm², jistič 20 A pro Dalap E-HP 9)
- Silové zapojení 400V
- Připojení v rozvaděči
- Revize elektro
- MaR kabeláž mezi termostatem + UET + topidlem (dohodu s elektro profession)

## Items added (12)

M-UT-001..012 — see
`outputs/phase_1_etap1/items_hk212_etap1.json` (kapitola `M-UT`, SO-12)
and `outputs/sequential_list/hk212_sequential_list.xlsx` (FÁZE 9.5).
