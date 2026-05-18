# Pattern 03 — Multi-view items.json (single source, multiple Excel projections)

**Source pilot:** RD Jáchymov (Part 2 + Part 5 Excel)
**Pipeline phase:** Phase 2 generator (`tools/phase2_excel_generator.py`)
**Status:** validated

## Problem

Investor (Mgr. Volný) chce **aggregated overview** ("kolik mě to bude stát celkově"). Zhotovitel (Karel Šmíd) chce **per-položkový soupis** s formula audit trail. Statik chce **per-skladba layer view** s tloušťkami. Projektant chce **per-podlaží / per-místnost** view pro coordination.

Naivní approach = 4× duplicate spreadsheets → drift jakmile někdo opraví hodnotu v jednom listu.

## Solution

**Single source = `items.json`. N projections = N sheets.** Generator readonly reads `items.json`, computes derived sheets in-memory.

RD Jáchymov Excel has 8 sheets na jednom items.json:

| Sheet | Variant | Aggregation level | Audience |
|---|---|---|---|
| Souhrn | — | kapitola_group totals | Investor overview |
| Var_A_Agregovany_Dum | A | kapitola level | Investor (dům) |
| Var_A_Agregovany_Sklad | A | kapitola level | Investor (sklad) |
| Var_C_Hybrid | C | subkapitola level | Zhotovitel mid-level |
| Var_B_Polozkovy_Dum | B | per-item | Zhotovitel detailed |
| Var_B_Polozkovy_Sklad | B | per-item | Zhotovitel detailed |
| Var_D_PerPodlazi_Mistnost | D | per-podlaží × per-místnost | Projektant coordination |
| Var_E_Skladby_Vrstev | E | per-skladba × per-vrstva | Statik / TI design |

## Critical rules

- ❌ Generator NEVER mutates items.json. Read-only.
- ✅ Každý sheet má `_source: items.json @ <sha>` v cell A1 nebo TXT footer
- ✅ Aggregations stejnou logikou per sheet — `df.groupby([level]).agg(sum)` ne ad-hoc loops
- ✅ Conditional formatting (`mnozstvi_confidence < 0.80` → amber) consistent napříč všech sheets

## Forbidden

- ❌ Hand-edit Excelu → injection of values back into items.json. **items.json je upstream, Excel je downstream.**
- ❌ Generating "Souhrn" from Var_A přes spreadsheet formulas — recompute from items.json each rebuild
