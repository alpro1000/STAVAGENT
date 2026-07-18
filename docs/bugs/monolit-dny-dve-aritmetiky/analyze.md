# Analyze — dvě nezávislé aritmetiky dní

**Method:** 8-anglová recon mapa (Explore agent, 2026-07-17) + verifikace čtením.
Čísla řádků jsou k datu reconu — před implementací re-grep (soubory se od té
doby dotkly PR #1523/#1524 v KPI-panelu).

## Dvě cesty zápisu do TÝCHŽ pozic

### Cesta A — «Aplikovat» (kalkulátor → pozice)
- `useCalculator.ts` volá `applyPlanToPositions({… monolitDataMeta …})`;
  `monolit_data.schedule_info = buildScheduleProjection(plan)`.
- `applyPlanToPositions.ts`: work-drafty z JEDINÉHO zdroje `buildLaborProjection(plan)`
  (`labor-projection.ts`); každá operace = `TOVLaborEntry` s `hours=presence_hours`,
  `normHours=norm_hours`, `totalCost=round(presence×wage)`, `source:'calculator'`.
- Per-bucket persistence: cílová pozice dostane `days=bucket.days`, `crew_size`,
  `wage`, `shift`. Hlavní beton-bucket navíc `curing_days=round(plan.formwork.curing_days)`.
- Bohatý blob JEN na hlavní beton-pozici: `costs`/`resources`/`formwork_info`/
  `schedule_info` (= projekce) + `tov_entries`.
- Backend `positions.js` PUT = hloupý zápis whitelistovaných sloupců
  (`ALLOWED_UPDATE_FIELDS` ⊃ days, curing_days, metadata, cost_czk, concrete_m3);
  ŽÁDNÝ přepočet dní ani projekce.
- **Zrání pod A:** `labor-projection.ts` emituje ošetřování betonu jako VLASTNÍ
  operaci (1 os. × CURING_SHIFT_H=5h, `curingBase = max(agg.zrani, curing_days)`) —
  je to řádek osobo-hodin, NE addend harmonogramu. Harmonogram je oddělený:
  `buildScheduleProjection` emituje zrání jako fázi s reálnými intervaly
  `[start_day, end_day]`, které PŘEKRÝVAJÍ práci dalšího taktu; `aggregateScheduleDays`
  bere zrání jako kalendářní rozpětí `max(end) − min(start)`, výslovně NE jako
  součet práce (`formulas.ts`). `total_days` = kritická cesta RCPSP (overlap-aware).

### Cesta B — ruční editace v tabulce
- `FlatPositionsTable.tsx` `handleFieldChange`: jeden PUT surového pole,
  BEZ přepočtu metadata/schedule; buňka `days` pro řádek zrání JE editovatelná.
- Per-řádek: `calculatePositionFields` (klient + backend): `labor_hours=crew×shift×days`,
  `cost=labor_hours×wage`. Pro `subtype='zrání'` short-circuit `labor_hours=0,
  cost=0` — zrání nikdy nepřispívá penězi, jen svými `days`.

## Divergenční body (kde se dvě aritmetiky rozcházejí)

| # | Místo | Cesta A (projekce) | Cesta B (ruční/fallback) |
|---|---|---|---|
| 1 | Element «Celkem dní» (`FlatPositionsTable`) | `schedule_info.total_days` (kritická cesta) | `Σ p.days` (sekvenčně, zrání lineárně) |
| 2 | KPI «Čas» (`FlatKPIPanel`) | čte JEN `schedule_total_days`; jinak NEPOČÍTÁNO | ruční editace neviditelná |
| 3 | KPI peníze vs čas (`formulas.ts`) | `schedule_total_days`/`wage_coverage` z projekce | `sum_kros`/`estimated_months` z `cost=crew×shift×days` |
| 4 | FlatGantt | fáze projekce (překryv zrání) | per-řádek sekvenčně end-to-end |
| 5 | Exporter fallback | `schedule_info.total_days` | sečte `days` JEN `subtype='beton'` (jiná množina než ElementBlock, který sčítá všechny) |
| 6 | «Celk.hod» buňka | `tov_entries` normHours (×0.8) | `crew×shift×days` (presence) |

## Root-cause kandidáti

1. **Zmražený projekční blob se při ruční editaci NIKDY neinvaliduje.**
   `schedule_info`/`tov_entries` píše jen «Aplikovat»; žádná ruční cesta je
   nepřepočítá ani nesmaže. Každý čtenář, co preferuje `schedule_info.total_days`,
   tak ukazuje zastaralá kalkulátorová čísla, tiše přebíjející ruční editaci —
   nebo (kde projekce není) spadne na naivní lineární `Σ p.days`.
2. **Dvě pravidla skládání dní pro tentýž pojem.** Kalkulátor: overlap-aware
   kritická cesta se zráním jako kalendářní překryv. Ruční/fallback: prostý
   `Σ p.days` addend. Zrání se proto chová dvojace — překryv v A, sekvenční
   addend v B (přesně «přičte dny přímo k dnům prací»).
3. **Zrání má TŘI odpojené nositele:** řádek `subtype='zrání'` (`days`, nula
   peněz), skalár `curing_days` na beton-pozici (čte ho jen nezapojený
   `calculateElementTotalDays`), a fáze `schedule_info`. Ruční editace mění
   první; čtenáři konzultují třetí (nebo SUM); nikdy se nesmíří.
4. **Peníze a harmonogram mají nezávislé čitatele** → cena/KPI se při ruční
   editaci dní přepočítá, «Čas»/Gantt ne (dokud projekce existuje).

## Verdikt Alexandra (2026-07-18) — vstup do interview

- SDD-tiket s interview, **kód se nepíše** dokud neodpoví.
- Ruční editace = **invalidace, ne tiché slévání** — badge «ručně upraveno —
  přepočítat?», projekce se označí stale, peníze/Gantt/KPI čtou stale-flag VIDITELNĚ.
- Editace zrání — otázka v interview; předběžná pozice Alexandra: je to editace
  **KALENDÁŘE** (technologické čekání), NE osobo-hodin — peníze se od ní hýbat nemají.
- «Tři nositelé zrání» — samostatný bod tiketu: nositel je JEDEN, ostatní jsou
  projekce.
