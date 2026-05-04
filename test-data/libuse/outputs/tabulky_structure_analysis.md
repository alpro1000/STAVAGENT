# Tabulky structure analysis — per-objekt count investigation

Phase 6.1 bug fix — find which Tabulky carry per-objekt data we can exploit instead of uniform 0.25 D-share.

## Tabulka dveří

**Structure**: tab dvere sheet has FROM-room (col C) + TO-room (col D) per door instance!
Each row = ONE door with explicit room mapping → exact per-objekt count.

Total D## doors across komplex (rows 8+): **290**
Doors in objekt D (from_room or to_room is D.* / S.D.*): **102**

| D-code | Komplex | Objekt D | D-share |
|---|---:|---:|---:|
| `D31` | 56 | 17 | 30.36% |
| `D34` | 54 | 16 | 29.63% |
| `D04` | 51 | 35 | 68.63% |
| `D21` | 37 | 11 | 29.73% |
| `D33` | 34 | 10 | 29.41% |
| `D02` | 9 | 4 | 44.44% |
| `D35` | 8 | 3 | 37.50% |
| `D23` | 7 | 0 | 0.00% |
| `D03` | 5 | 3 | 60.00% |
| `D01` | 4 | 1 | 25.00% |
| `D20` | 4 | 1 | 25.00% |
| `D42` | 4 | 1 | 25.00% |
| `D22` | 3 | 0 | 0.00% |
| `D25` | 3 | 0 | 0.00% |
| `D11` | 3 | 0 | 0.00% |
| `D10` | 2 | 0 | 0.00% |
| `D32` | 2 | 0 | 0.00% |
| `D24` | 1 | 0 | 0.00% |
| `D36` | 1 | 0 | 0.00% |
| `D06` | 1 | 0 | 0.00% |
| `D05` | 1 | 0 | 0.00% |

## Tabulka oken

**Structure**: tabulka sheet col 20 (T) = 'Počet' komplex total. NO per-objekt column.
**Solution**: use DXF spatial counts from objekt D drawings (Phase 1 aggregate `windows_by_type_code`).

Total W## komplex: **189**

| W-code | Komplex | DXF objekt D count (Phase 1) |
|---|---:|---:|
| `W03` | 49 | 17 |
| `W81` | 34 | 0 |
| `W05` | 28 | 9 |
| `W82` | 19 | 0 |
| `W01` | 16 | 3 |
| `W04` | 12 | 4 |
| `W83` | 8 | 2 |
| `W84` | 6 | 0 |
| `W85` | 4 | 0 |
| `W91` | 4 | 0 |
| `W02` | 3 | 0 |
| `W06` | 1 | 0 |
| `W07` | 1 | 0 |
| `W18` | 1 | 0 |
| `W19` | 1 | 0 |
| `W20` | 1 | 0 |
| `W86` | 1 | 0 |

## Tabulka klempířských TP##

**Structure**: cols A=code, B=Název, C=Umístění (location text only — not per-objekt).
Total TP## codes: **24**

Per-objekt data: ❌ not in Tabulka. Possible derivation:
- Some TP items are roof-located (TP01 zaatikové žlaby) → split by per-objekt roof obvod
- Some are facade (TP25 dešťový svod) → 4 svody / 4 objekty = 1/objekt heuristic
- Most are uniform 0.25 D-share fallback

## Tabulka zámečnických LP##

**Structure**: same as klempířské. Cols A=code, C=Umístění (text), H=Množství komplex.
Total LP## codes: **14**

Per-objekt data: ❌ not in Tabulka. **DXF segment tag spatial counts** recoverable from Phase 1 + Phase 2 inventory.

## Tabulka ostatních OP##

Total OP## codes: **63**
**Structure**: cols A=code, B=Název, C=Umístění (text), F=MJ, G=Množství komplex.

Per-objekt data: ❌ not in Tabulka. **DXF segment tag spatial counts** recoverable from Phase 1 + Phase 2 inventory (A-GENM-____-IDEN with 48 OP## split codes per 1.NP D půdorys).

## Tabulka překladů LI##

Total LI## codes: **17**
Per-objekt data: ❌ not in Tabulka. DXF spatial count per A-GENM-____-IDEN LI## tags (Phase 1 inventory: 32 LI tags in 1.NP D).
