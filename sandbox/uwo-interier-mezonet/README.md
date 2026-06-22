# UWO sandbox — Rekonstrukce mezonetu (interiér / PSV)

Samodostatečný **offline** sandbox dokazující tok **Work-First → Catalog-Last** na
interiér/PSV doméně (rekonstrukce bytu), na reálném kejsu mezonetu. Groundwork +
golden fixture pro budoucí Universal Work Ontology — viz
`docs/specs/universal-work-decomposer/`. **Production se nemění** (AC10).

> ⚠️ Sandbox-local. Šablony interiér-větve žijí ZDE (ne v production KB). Migrace do
> `B5_tech_cards/technological_postupy/` = samostatná pozdější úloha.

## Jak spustit (bez sítě / DB / AI)

```bash
node run.mjs            # čitelný report (work list + binding + cost)
node run.mjs --json     # strojové totály (freeze baseline)
node --test harness.test.mjs   # acceptance harnes (9 testů)
```

Vyžaduje jen Node ≥18 (testováno na v22). Zero npm deps.

## Co to dokazuje

1. **Scope-Router** (`src/scope-router.mjs`) — scope → větev. Monolit se **nikdy**
   neaplikuje na interiér; neznámý scope → honest-blank (ne monolitní m7smetí).
2. **Work-First dekompozice** (`src/decomposer.mjs`) — sekce → **balík** work-atomů,
   codeless + priceless. `renovace koupelny` = 7 atomů, **nikdy jeden kód**.
3. **Catalog-Last adapter** (`src/catalog-adapter.mjs`) — atom → kandidát se
   **status-enum** `exact | candidate | group_only | not_verified` + confidence +
   sanity-flagy. Katalog dle režimu zakázky (privátní → ÚRS). Žádný falešný „kód nalezen".
4. **Orientační cost** (`src/cost.mjs`) — vždy „ORIENTAČNÍ ±10–15 %". `not_verified`
   se reportuje zvlášť, ne jako přesná cifra.

## Reálný proba katalogu

`data/catalog-findings.json` = **jednorázový skutečný proba** živého STAVAGENT MCP
`find_urs_code`, zmražený pro offline replay. Sanity-flagy chytají REÁLNĚ pozorované
false-plausible kódy (kotel „Podmínky použití", štuk „sloupů", perlinka „Příplatek").

## Headline výsledek

| | Kč |
|---|---:|
| Nabídka mistra (xlsx) | 1 127 350 |
| **UWO grand ORIENTAČNÍ** | **1 435 990** |
| Δ (co mistr podhodnotil) | **+308 640 (+27,4 %)** |

Mistr vynechal: **malba** (stěny + podhledy), **hydroizolace** (jen „bude upřesněno"),
**montáž ZP**, **samonivelační stěrka**, **celá výměna kotle** (demontáž+montáž+spalinová+revize),
**ochrana schodiště před pracemi**, **odvoz suti**, **administrativa**, **hodinové práce**.

## DPH

NENÍ zašito v logice. Rekonstrukce bytu v ČR obvykle **snížená sazba (12 %)** — uplatnit
až po ověření podmínek. Flag, ne data.

## Soubory

```
data/corpus.json            frozen vstup: plochy + scope sekce + baseline mistra
data/catalog-findings.json  zmražený reálný ÚRS proba
data/baseline.json          frozen regression etalon (±15 %)
src/scope-router.mjs        [1] scope → větev (+ monolit guard / honest-blank)
src/templates.mjs           interiér/PSV šablony (§5 knihovna, sandbox-local)
src/decomposer.mjs          [2] Work-First (codeless/priceless)
src/catalog-adapter.mjs     [3] Catalog-Last (status-enum + sanity)
src/cost.mjs                [4] orientační cost
src/pipeline.mjs            orchestrace
run.mjs                     report
harness.test.mjs            acceptance harnes (node --test)
RECON.md                    recon poznámka (AC9)
```

## Hranice (co NENÍ)

- Není production ontologie — je to fixture/groundwork.
- Nemění production dekompozici ani catalog-search.
- Jen větev **interiér/PSV**. Elektro/ZTI/VZT/ÚT = další větve šablon, příští úlohy.
- Gate 3 / SO202 Ingest se netýká.
