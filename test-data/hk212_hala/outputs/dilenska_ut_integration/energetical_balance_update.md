# HK212 — Energetická bilance ÚT vs TZ B

_Extracted: 2026-05-21T19:30:24.080610+00:00_

_Source: UT_HALAHK_DPS.dxf (DXF INSERT counting via ezdxf), no AI_


## Zařízení ÚT (z DXF entity count)

| Zařízení | Vendor | Kategorie | Počet ks | Topný výkon/ks (kW) | Topný výkon celkem (kW) |
|---|---|---|---:|---:|---:|
| Dalap_E-HP_9kW | DALAP | tepelné čerpadlo vzduch-vzduch | 4 | 9.0 | 36.0 |
| ECOSUN_S+_12 | FENIX (ECOSUN) | sálavý infrapanel | 40 | 1.2 | 48.0 |
| PT_Vents_UET-15D | PT Ventilation | VZT rekuperační jednotka | 4 | 0.0 | 0.0 |
| LENS_ARENA_60x120_W | LENS | LED svítidlo (reference podklad pro EL D.1.4) | 36 | 0.0 | 0.0 |
| **CELKEM topný výkon** | | | | | **84.00** |

## Srovnání s TZ B

- TZ B P_inst (instalovaný příkon): **83.0 kW**
- DXF P_topný celkem: **84.00 kW**
- Δ = +1.00 kW  (+1.2 %)

- COP default = 3.5 (vzduch-vzduch HP — assumption)
- Odhadovaný P_příkon = P_topný / COP = **24.00 kW**

## Verdikt + ABMV #1 update

✓ Bilance v rozsahu 50–200 % TZ B P_inst — věrohodné. ABMV #1 lze posunout na `resolved_with_caveats`.
