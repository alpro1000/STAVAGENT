# §3.5 — Otvory (okna, dveře, vrata)

| Element | Rozměr | Počet (DXF A101 INSERT) | Source TZ |
|---|---|---:|---|
| Okna | 1000 × 1000 mm (sklopná, fix? — block library `OKNO_1k - Okno Hala 1000x1000-V{N}-1NP`) | **35** INSERT instances, **21 unique V-tags** (V1..V21) | TZ B/D.1.1 nepřesné množství — PBŘ p18 "okna 18 1,000 1,000 18,00" + "okna 18 ... 36 36,00" (různá fasáda) |
| Vrata sekční | **TZ: 3500 × 4000 mm** vs **DXF block: 3000 × 4000 mm** (drift, viz §9.6) | **4** (4 instances) | TZ D.1.1 p04 "dvojice sekčních vrat o rozměrech 3500 × 4000 mm"; A101 4× block 3000X4000 |
| Vnější dveře | **1050 × 2100 mm** (z block name `Vnější jednoduché dvoukřídlé dveře - 1050 x 2100mm`) | **2** (2 instances) | A101 block names |
| Dveřní clony VZT (nad vraty) | šířka 2 m | **8 ks** (4 vrata × 2 horizontální clony) | TZ B p10: "pro každá ze 4 vrat jsou navrženy 2 horizontální clony, celkem tedy 8 ks. Clony mají šířku 2 m" |

**Note on okna count discrepancy:**
- A101 INSERT count = 35 (multiple per V-tag = duplicate symbols across views)
- PBŘ p18 lists 18 oken on JV fasáda + 18 oken na SZ fasádě = 36 oken (matches max V-tag 21 + duplicates for opposite-fasáda symmetry?)
- TZ B does not give an explicit overall count
- **Action: ABMV-style query — exact okna count and per-fasáda breakdown.**
