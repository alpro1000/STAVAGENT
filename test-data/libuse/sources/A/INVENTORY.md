# `sources/A/` — INVENTORY

**Status: AWAITING ABMV upload**

This bucket is empty. ABMV must supply the following before Phase Π.1+
komplex pricing can run for objekt A:

## Required DWG (architectural section 140)

| Code | Description |
|------|-------------|
| `_140_4410` | Půdorys 1.NP |
| `_140_4420` | Půdorys 2.NP |
| `_140_4430` | Půdorys 3.NP |
| `_140_4440` | Půdorys střecha |
| `_140_5400` | Řezy |
| `_140_6400` | Pohledy |
| `_140_7410` | Podhledy 1.NP |
| `_140_7420` | Podhledy 2.NP |
| `_140_7430` | Podhledy 3.NP |
| `_140_9410` | Koordinace 1.NP |
| `_140_9420` | Koordinace 2.NP |
| `_140_9430` | Koordinace 3.NP |
| `_140_ARS` | ARS desky |

## Required PDF

Equivalent PDF rendering of all DWG drawings above + any additional
PDF-only references (koor. výkresy, kniha detailů, etc.).

## NOT required from ABMV

Tabulky 0020 (mistnosti), 0030 (skladby), 0041 (dveře), 0042 (okna),
0043 (prosklené příčky), 0050 (zámečnické), 0060 (klempířské), 0070
(překlady), 0080 (ostatní) are **komplex-wide** — already in
`sources/shared/xlsx/`. Pipeline will filter to `A` scope at parse
time using the same `is_objekt_X(room_kod)` switch (currently hardcoded
to D, will be parametrized in Π.0a).

## Drop-in upload target

```
sources/A/dwg/  # *.dwg here
sources/A/pdf/  # *.pdf here
sources/A/xlsx/ # *.xlsx (rare, only if A-specific)
```

Upon upload, re-run sources_manifest classifier to verify naming
convention before Π.0a extraction.