# DXF segment-tag inventory — Phase 2 step 1

Scans `*-IDEN` layers in two DXF files to find where skladba codes (WF/FF/CF/RF/F + opening codes W/D) live and whether they're single TEXT entities or split letter+digit pieces.

## Půdorys 1.NP
`185-01_DPS_D_SO01_140_4410_00-OBJEKT D - Půdorys 1 .NP.dxf`

IDEN-suffixed layers found: **8**  

### `A-AREA-____-IDEN` — 21 TEXT/MTEXT

- Single-token codes (`^[A-Z]+\d+$`): **0** — prefixes: {}
- Lone prefixes (`^[A-Z]+$`): **1** — texts: {'DV': 1}
- Lone digits (`^\d+$`): **0**
- Reconstructed split codes (prefix + digits, Δy ≤ 250 mm, Δx ≤ 80 mm): **0** — prefixes: {}
- Other (free text): **20**

Sample free-text on this layer (first 8):

```
  'D.1.S.02'  pos=(2253, 67795)
  'D.1.S.01'  pos=(7034, 65065)
  'D.1.1.01'  pos=(-642, 64985)
  'D.1.1.02'  pos=(-2659, 59351)
  'D.1.1.03'  pos=(-3591, 61689)
  'D.1.1.04'  pos=(-3482, 64915)
  'D.1.2.01'  pos=(3481, 63503)
  'D.1.2.02'  pos=(5758, 59351)
```

### `A-DOOR-____-IDEN` — 100 TEXT/MTEXT

- Single-token codes (`^[A-Z]+\d+$`): **22** — prefixes: {'D': 22}
- Lone prefixes (`^[A-Z]+$`): **0** — texts: {}
- Lone digits (`^\d+$`): **37**
- Reconstructed split codes (prefix + digits, Δy ≤ 250 mm, Δx ≤ 80 mm): **0** — prefixes: {}
- Other (free text): **41**

Sample single codes (sorted unique):

```
  D10
  D11
  D20
  D21
  D31
  D33
  D34
  D42
```

Sample free-text on this layer (first 8):

```
  '2100'  pos=(4995, 63508)
  '1200'  pos=(4726, 61411)
  '2100'  pos=(4845, 61411)
  '2100'  pos=(2840, 61411)
  '2100'  pos=(1753, 62539)
  '2100'  pos=(11545, 63598)
  '1200'  pos=(11611, 61441)
  '2100'  pos=(11730, 61441)
```

### `A-FLOR-HRAL-IDEN` — 6 TEXT/MTEXT

- Single-token codes (`^[A-Z]+\d+$`): **0** — prefixes: {}
- Lone prefixes (`^[A-Z]+$`): **3** — texts: {'LP': 3}
- Lone digits (`^\d+$`): **3**
- Reconstructed split codes (prefix + digits, Δy ≤ 250 mm, Δx ≤ 80 mm): **3** — prefixes: {'LP': 3}
- Other (free text): **0**

Sample reconstructed split codes (unique):

```
  LP20
  LP21
```

### `A-GENM-____-IDEN` — 169 TEXT/MTEXT

- Single-token codes (`^[A-Z]+\d+$`): **0** — prefixes: {}
- Lone prefixes (`^[A-Z]+$`): **80** — texts: {'OP': 48, 'LI': 32}
- Lone digits (`^\d+$`): **80**
- Reconstructed split codes (prefix + digits, Δy ≤ 250 mm, Δx ≤ 80 mm): **80** — prefixes: {'OP': 48, 'LI': 32}
- Other (free text): **9**

Sample reconstructed split codes (unique):

```
  LI01
  LI02
  LI03
  LI04
  LI05
  LI11
  LI12
  LI16
  LI22
  OP03
  OP04
  OP08
  OP10
  OP12
  OP15
  OP19
  OP20
  OP21
  OP24
  OP25
  OP26
  OP27
  OP87
  OP89
  OP90
  OP96
  OP98
```

Sample free-text on this layer (first 8):

```
  '(2400)'  pos=(-3764, 61079)
  '(2300)'  pos=(1068, 61242)
  '(2300)'  pos=(15121, 61258)
  '(2300)'  pos=(18492, 62783)
  '(2400)'  pos=(19951, 65641)
  '950 (1300)'  pos=(-1782, 61600)
  '950 (1300)'  pos=(4605, 63332)
  '950 (1300)'  pos=(11976, 63355)
```

### `A-GLAZ-____-IDEN` — 33 TEXT/MTEXT

- Single-token codes (`^[A-Z]+\d+$`): **0** — prefixes: {}
- Lone prefixes (`^[A-Z]+$`): **11** — texts: {'W': 11}
- Lone digits (`^\d+$`): **11**
- Reconstructed split codes (prefix + digits, Δy ≤ 250 mm, Δx ≤ 80 mm): **11** — prefixes: {'W': 11}
- Other (free text): **11**

Sample reconstructed split codes (unique):

```
  W01
  W03
  W04
  W05
```

Sample free-text on this layer (first 8):

```
  '2400'  pos=(2982, 70148)
  '1500 (900)'  pos=(13157, 70148)
  '1500 (900)'  pos=(15532, 70148)
  '1500 (900)'  pos=(18032, 70148)
  '1500 (900)'  pos=(23013, 66128)
  '1000 (1400)'  pos=(23013, 64536)
  '1000 (1400)'  pos=(23013, 61936)
  '1500 (900)'  pos=(23013, 59028)
```

### `A-WALL-____-IDEN` — 64 TEXT/MTEXT

- Single-token codes (`^[A-Z]+\d+$`): **0** — prefixes: {}
- Lone prefixes (`^[A-Z]+$`): **29** — texts: {'WF': 18, 'CW': 6, 'F': 5}
- Lone digits (`^\d+$`): **23**
- Reconstructed split codes (prefix + digits, Δy ≤ 250 mm, Δx ≤ 80 mm): **14** — prefixes: {'WF': 11, 'F': 3}
- Other (free text): **12**

Sample reconstructed split codes (unique):

```
  F08
  WF10
  WF32
  WF40
  WF41
  WF51
```

Sample free-text on this layer (first 8):

```
  '2500'  pos=(-2674, 55984)
  '2400'  pos=(1933, 55984)
  '2400'  pos=(5951, 55984)
  '2400'  pos=(10334, 55984)
  '2400'  pos=(14329, 55984)
  '2400'  pos=(18955, 55984)
  '04b'  pos=(-2475, 56602)
  '04b'  pos=(1105, 56627)
```

### `A-____-____-IDEN` — 10 TEXT/MTEXT

- Single-token codes (`^[A-Z]+\d+$`): **0** — prefixes: {}
- Lone prefixes (`^[A-Z]+$`): **0** — texts: {}
- Lone digits (`^\d+$`): **0**
- Reconstructed split codes (prefix + digits, Δy ≤ 250 mm, Δx ≤ 80 mm): **0** — prefixes: {}
- Other (free text): **10**

Sample free-text on this layer (first 8):

```
  'OTVOR PRO ROZVAD'  pos=(16866, 64149)
  '\U+011A\U+010C'  pos=(17968, 64149)
  'OTVOR PRO'  pos=(11669, 62856)
  'ROZVAD'  pos=(11669, 62737)
  '\U+011A\U+010C'  pos=(12109, 62737)
  'OTVOR PRO ROZVAD'  pos=(3508, 62977)
  '\U+011A\U+010C'  pos=(4609, 62977)
  'OTVOR PRO'  pos=(-816, 62154)
```

### `S-GRID-____-IDEN` — 16 TEXT/MTEXT

- Single-token codes (`^[A-Z]+\d+$`): **0** — prefixes: {}
- Lone prefixes (`^[A-Z]+$`): **6** — texts: {'DC': 2, 'DB': 2, 'DA': 2}
- Lone digits (`^\d+$`): **0**
- Reconstructed split codes (prefix + digits, Δy ≤ 250 mm, Δx ≤ 80 mm): **0** — prefixes: {}
- Other (free text): **10**

Sample free-text on this layer (first 8):

```
  'D1'  pos=(-5493, 53585)
  'D1'  pos=(-5493, 72163)
  'D2'  pos=(57, 53585)
  'D2'  pos=(57, 72163)
  'D3'  pos=(8157, 53585)
  'D3'  pos=(8157, 72163)
  'D4'  pos=(16257, 53585)
  'D4'  pos=(16257, 72163)
```

## Podhledy 1.NP
`185-01_DPS_D_SO01_140_7410_00-OBJEKT D - Výkres podhledů 1. NP.dxf`

IDEN-suffixed layers found: **5**  

### `A-AREA-____-IDEN` — 20 TEXT/MTEXT

- Single-token codes (`^[A-Z]+\d+$`): **0** — prefixes: {}
- Lone prefixes (`^[A-Z]+$`): **0** — texts: {}
- Lone digits (`^\d+$`): **0**
- Reconstructed split codes (prefix + digits, Δy ≤ 250 mm, Δx ≤ 80 mm): **0** — prefixes: {}
- Other (free text): **20**

Sample free-text on this layer (first 8):

```
  'D.1.S.02'  pos=(2953, 67127)
  'D.1.S.01'  pos=(7483, 66024)
  'D.1.1.01'  pos=(-593, 63831)
  'D.1.1.02'  pos=(-2947, 59963)
  'D.1.1.03'  pos=(-3187, 62290)
  'D.1.1.04'  pos=(-3645, 65164)
  'D.1.2.01'  pos=(3684, 63559)
  'D.1.2.02'  pos=(5707, 60141)
```

### `A-CLNG-____-IDEN` — 32 TEXT/MTEXT

- Single-token codes (`^[A-Z]+\d+$`): **0** — prefixes: {}
- Lone prefixes (`^[A-Z]+$`): **16** — texts: {'CF': 16}
- Lone digits (`^\d+$`): **16**
- Reconstructed split codes (prefix + digits, Δy ≤ 250 mm, Δx ≤ 80 mm): **16** — prefixes: {'CF': 16}
- Other (free text): **0**

Sample reconstructed split codes (unique):

```
  CF10
  CF20
  CF21
```

### `A-GENM-____-IDEN` — 16 TEXT/MTEXT

- Single-token codes (`^[A-Z]+\d+$`): **0** — prefixes: {}
- Lone prefixes (`^[A-Z]+$`): **8** — texts: {'OP': 8}
- Lone digits (`^\d+$`): **8**
- Reconstructed split codes (prefix + digits, Δy ≤ 250 mm, Δx ≤ 80 mm): **8** — prefixes: {'OP': 8}
- Other (free text): **0**

Sample reconstructed split codes (unique):

```
  OP18
```

### `E-LITE-EQPM-IDEN` — 44 TEXT/MTEXT

- Single-token codes (`^[A-Z]+\d+$`): **30** — prefixes: {'OS': 30}
- Lone prefixes (`^[A-Z]+$`): **1** — texts: {'NVO': 1}
- Lone digits (`^\d+$`): **0**
- Reconstructed split codes (prefix + digits, Δy ≤ 250 mm, Δx ≤ 80 mm): **0** — prefixes: {}
- Other (free text): **13**

Sample single codes (sorted unique):

```
  OS04
  OS20
  OS21
  OS23
```

Sample free-text on this layer (first 8):

```
  'A1'  pos=(2287, 67621)
  'A2'  pos=(3070, 64771)
  'A2'  pos=(6720, 64771)
  'A1'  pos=(7527, 67113)
  'A2'  pos=(10370, 64771)
  'B1'  pos=(11531, 67452)
  'N4'  pos=(10967, 67346)
  'N2'  pos=(7563, 67346)
```

### `S-GRID-____-IDEN` — 16 TEXT/MTEXT

- Single-token codes (`^[A-Z]+\d+$`): **0** — prefixes: {}
- Lone prefixes (`^[A-Z]+$`): **6** — texts: {'DC': 2, 'DB': 2, 'DA': 2}
- Lone digits (`^\d+$`): **0**
- Reconstructed split codes (prefix + digits, Δy ≤ 250 mm, Δx ≤ 80 mm): **0** — prefixes: {}
- Other (free text): **10**

Sample free-text on this layer (first 8):

```
  'D1'  pos=(-5493, 52586)
  'D1'  pos=(-5493, 72279)
  'D2'  pos=(57, 52586)
  'D2'  pos=(57, 72279)
  'D3'  pos=(8157, 52586)
  'D3'  pos=(8157, 72279)
  'D4'  pos=(16257, 52586)
  'D4'  pos=(16257, 72279)
```

## Cross-layer summary

Goal: confirm which prefix family lives on which IDEN layer so the parser can target each segment-tag category by layer name.
