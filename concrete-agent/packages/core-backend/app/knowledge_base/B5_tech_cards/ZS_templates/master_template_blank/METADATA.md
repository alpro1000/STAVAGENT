# ZS vzor blank (2022) — Canonical structure reference

**Source file:** `ZS_-_vzor_rev22_02_23.xls`
**Status:** XLS file NOT in this directory (uploaded by user during Session 3 retrofit;
kept in user's archive).

## Purpose

Generic 100 M / 10-měsíční project ZS template, **qty=1 across všech položek**. Used
by projektant as starting point that gets customized per real project. For STAVAGENT
KB: reference for **canonical structure** + položka taxonomy.

| Field | Value |
|---|---|
| Project size (placeholder) | 100 M Kč |
| Duration (placeholder) | 10 měs |
| Quantity per item | 1 |
| Sheet count | 4 (ZS + Jeřáb + Zábory + Vybavení buněk) |
| Total položek (3 sekce) | ~70 (across ZS + PH + VRN) |
| ZS poměr (placeholder) | n/a (qty=1 per item is structural placeholder) |

## Canonical 3-section structure

The blank vzor codifies the layout used across all 4 reference templates:

1. **Sekce 1 — Zařízení staveniště** (~20-25 položek)
   Buňky, oplocení, přípojky, BOZP, dopravní značení, zimní opatření, atd.

2. **Sekce 2 — Přesun hmot** (~3-8 položek)
   Pomocné stroje (Kramer/Merlo), pomocní pracovníci, autojeřáb, případně věžové
   jeřáby J1/J2/J3 + stavební výtahy GEDA pro výškové stavby.

3. **Sekce 3 — VRN** (~10-15 položek)
   Polír, pojištění, dokumentace (RDS/DSPS/dílenská), poplatky, doprava materiálu,
   koordinátor BOZP, geodet, fotodokumentace, atd.

## Žihle application

Žihle Session 3 retrofit adopted this 3-section structure verbatim:
- `master_soupis_SO_801.yaml` = Sekce 1 (25 položek)
- `master_soupis_PRESUN_HMOT.yaml` = Sekce 2 (3 položek — Kramer + pomocní + autojeřáb only,
  věžové jeřáby + výtahy excluded per mostovy scope)
- `master_soupis_VRN.yaml` = Sekce 3 (13 položek, RDS/DSPS removed per no-work-duplication
  with SO 201 t0)

The blank vzor remains the **structural skeleton** to copy when starting a new pilot.
Real numbers come from peer-template benchmarks (D6 highway / Kfely mostovy / future
templates).

## When to update

When a 5th+ template is added to KB and reveals a structural addition (e.g., new
required sekce 4 for environmental permits), update PATTERNS.md and re-evaluate
whether blank vzor needs schema extension.
