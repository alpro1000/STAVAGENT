# Audit Part B — OP## edge cases (komplex_qty ≤ 4)

Small-komplex OP items where uniform 0.25 D-share may misallocate.

| OP code | Popis | Umístění | Komplex | DXF D | Current D qty | Needs review? |
|---|---|---|---:|---:|---:|---|
| `OP06` | Přenosný hasicí přístroj | Garáže | 4.0 | 0 | 1.0 | ⚠️ YES |
| `OP07` | Přenosný hasicí přístroj | Technické místnosti | 2.0 | 0 | 1 | ⚠️ YES |
| `OP100` | Žaluziový kastlík pro venkovní horizontální žaluzi | byty | 4.0 | 0 | 1.0 | ⚠️ YES |
| `OP101` | Žaluziový kastlík pro venkovní horizontální žaluzi | byty | 2.0 | 0 | 1 | ⚠️ YES |
| `OP102` | Žaluziový kastlík pro venkovní horizontální žaluzi | byty | 2.0 | 0 | 1 | ⚠️ YES |
| `OP103` | Žaluzie venkovní horizontální | byty | 1.0 | 0 | 1 | ⚠️ YES |
| `OP13` | Revizní dvířka KAN 200 x 300 |  | 1.0 | 0 | 1 | ⚠️ YES |
| `OP16` | Revizní dvířka VOD 300 x 300 |  | 2.0 | 1 | 1 | ✅ |
| `OP20` | Vnitřní čistící zóna | 1.NP | 4.0 | 1 | 1.0 | ✅ |
| `OP21` | Poštovní schránky | 1.NP | 4.0 | 1 | 1.0 | ✅ |
| `OP22` | Zinkovaný rošt | 1.PP | 2.0 | 0 | 1 | ⚠️ YES |
| `OP23` | Zinkovaný rošt | 1.PP | 1.0 | 0 | 1 | ⚠️ YES |
| `OP30` | Stavební pouzdro posuvných dveří | byty | 1.0 | 0 | 1 | ⚠️ YES |
| `OP32` | Stavební pouzdro posuvných dveří | byty | 1.0 | 0 | 1 | ⚠️ YES |
| `OP43` | Pryžové rozpínací těsnění | 1.PP | 3.0 | 1 | 1 | ✅ |
| `OP44` | Pryžové rozpínací těsnění | 1.PP | 1.0 | 0 | 1 | ⚠️ YES |
| `OP47` | Pryžové rozpínací těsnění | 1.PP | 1.0 | 0 | 1 | ⚠️ YES |
| `OP51` | Průchodka, oplechování a keramický solární komplet | Střecha výtahu | 4.0 | 0 | 1.0 | ⚠️ YES |
| `OP52` | Chrlič | Střecha výtahu | 3.0 | 1 | 1 | ✅ |
| `OP53` | Bezpečnostní přepad | Střecha výtahu | 1.0 | 1 | 1.0 | ✅ |
| `OP80` | Žaluzie venkovní horizontální | byty | 2.0 | 0 | 1 | ⚠️ YES |
| `OP81` | Žaluzie venkovní horizontální | byty | 1.0 | 0 | 1 | ⚠️ YES |
| `OP82` | Žaluzie venkovní horizontální | byty | 1.0 | 0 | 1 | ⚠️ YES |
| `OP83` | Žaluzie venkovní horizontální | byty | 1.0 | 0 | 1 | ⚠️ YES |
| `OP84` | Žaluzie venkovní horizontální | byty | 3.0 | 0 | 1 | ⚠️ YES |
| `OP85` | Žaluzie venkovní horizontální | byty | 4.0 | 0 | 1.0 | ⚠️ YES |
| `OP88` | Žaluzie venkovní horizontální | byty | 1.0 | 0 | 1 | ⚠️ YES |
| `OP90` | Žaluzie venkovní horizontální | byty | 1.0 | 1 | 1.0 | ✅ |
| `OP91` | Žaluziový kastlík pro venkovní horizontální žaluzi | byty | 1.0 | 0 | 1 | ⚠️ YES |
| `OP92` | Žaluziový kastlík pro venkovní horizontální žaluzi | byty | 1.0 | 0 | 1 | ⚠️ YES |
| `OP93` | Žaluziový kastlík pro venkovní horizontální žaluzi | byty | 1.0 | 0 | 1 | ⚠️ YES |
| `OP94` | Žaluziový kastlík pro venkovní horizontální žaluzi | byty | 1.0 | 0 | 1 | ⚠️ YES |
| `OP95` | Žaluziový kastlík pro venkovní horizontální žaluzi | byty | 4.0 | 0 | 1.0 | ⚠️ YES |
| `OP97` | Žaluziový kastlík pro venkovní horizontální žaluzi | byty | 2.0 | 0 | 1 | ⚠️ YES |
| `OP99` | Žaluziový kastlík pro venkovní horizontální žaluzi | byty | 2.0 | 0 | 1 | ⚠️ YES |

**Edge cases needing review**: 28 of 35

## Pattern interpretation

- **DXF D = 0 + komplex > 0**: item exists in komplex but no DXF tag found in objekt-D drawings → likely on objekt A/B/C only. Current D qty = 0.25 × komplex (uniform fallback) overstates D.
- **DXF D > 0**: spatially confirmed on objekt-D drawings → current Phase 6.1 update should have applied DXF count.

## Recommendation

⚠️ **MEDIUM priority** — review 28 items: if DXF confirms zero on objekt D, set qty=0 (remove from D výkaz). Otherwise keep DXF count.