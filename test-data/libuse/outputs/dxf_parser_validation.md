# DXF parser validation — Phase 2 step 4

Cross-checks the parser's room-area output against Tabulka místností with tolerance ±2.0 %.

**Source DXF:** `185-01_DPS_D_SO01_140_4410_00-OBJEKT D - Půdorys 1 .NP.dxf`  
**Tabulka:** `185-01_DPS_D_SO01_100_0020_R01_TABULKA MISTNOSTI.xlsx`  
**Tabulka entries:** 246 (68 D-codes)  
**DXF rooms parsed:** 20  

## Sample comparison (5 rooms)

| Code | Tabulka název | Tabulka m² | DXF m² | Δ % | Tolerance ±2 % | Verdict |
|------|------|-----:|-----:|-----:|---|---|
| `D.1.S.01` | SPOLEČNÁ CHODBA | 22.21 | 22.21 | +0.01 % | within | ✅ |
| `D.1.S.02` | ZÁDVEŘÍ | 9.97 | 9.97 | -0.05 % | within | ✅ |
| `D.1.1.01` | CHODBA | 10.73 | 10.73 | -0.04 % | within | ✅ |
| `D.1.4.02` | OBÝVACÍ POKOJ + KK | 27.25 | 27.25 | -0.02 % | within | ✅ |
| `D.1.3.01` | CHODBA | 6.35 | 6.35 | -0.03 % | within | ✅ |

**Sample verdict:** 5/5 within ±2 %

## Full 1.NP coverage (D.1.* codes)

- Tabulka D.1.* codes: **20**
- DXF parsed D.1.* rooms: **20**
- Codes in BOTH (matched): **20** (100.0 %)
- Codes in Tabulka but NOT in DXF: **0**

- Codes in DXF but NOT in Tabulka: **0**

## Per-room comparison (all D.1.* with both sources)

| Code | Název | Tabulka m² | DXF m² | Δ % | ±2 % |
|------|------|-----:|-----:|-----:|---|
| `D.1.1.01` | CHODBA | 10.73 | 10.73 | -0.04 % | ✅ |
| `D.1.1.02` | OBÝVACÍ POKOJ + KK | 19.31 | 19.31 | +0.01 % | ✅ |
| `D.1.1.03` | KOUPELNA | 5.96 | 5.96 | -0.00 % | ✅ |
| `D.1.1.04` | POKOJ | 13.34 | 13.34 | +0.01 % | ✅ |
| `D.1.2.01` | CHODBA | 6.35 | 6.35 | -0.03 % | ✅ |
| `D.1.2.02` | OBÝVACÍ POKOJ + KK | 23.67 | 23.67 | -0.00 % | ✅ |
| `D.1.2.03` | POKOJ | 15.24 | 15.24 | +0.02 % | ✅ |
| `D.1.2.04` | KOUPELNA | 4.33 | 4.33 | +0.02 % | ✅ |
| `D.1.3.01` | CHODBA | 6.35 | 6.35 | -0.03 % | ✅ |
| `D.1.3.02` | OBÝVACÍ POKOJ + KK | 23.83 | 23.83 | -0.01 % | ✅ |
| `D.1.3.03` | POKOJ | 15.08 | 15.08 | +0.03 % | ✅ |
| `D.1.3.04` | KOUPELNA | 4.33 | 4.33 | +0.02 % | ✅ |
| `D.1.4.01` | CHODBA | 14.06 | 14.06 | +0.00 % | ✅ |
| `D.1.4.02` | OBÝVACÍ POKOJ + KK | 27.25 | 27.25 | -0.02 % | ✅ |
| `D.1.4.03` | WC | 1.51 | 1.51 | +0.31 % | ✅ |
| `D.1.4.05` | KOUPELNA | 6.60 | 6.60 | +0.01 % | ✅ |
| `D.1.4.06` | POKOJ | 13.70 | 13.70 | +0.03 % | ✅ |
| `D.1.4.07` | POKOJ | 12.33 | 12.33 | +0.02 % | ✅ |
| `D.1.S.01` | SPOLEČNÁ CHODBA | 22.21 | 22.21 | +0.01 % | ✅ |
| `D.1.S.02` | ZÁDVEŘÍ | 9.97 | 9.97 | -0.05 % | ✅ |

**Per-room verdict:** 20/20 rooms within ±2 % (100.0 %)