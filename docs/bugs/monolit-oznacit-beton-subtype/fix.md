# Fix — varianta (а): promote vždy staví beton-řádek

**PR:** #1524 (2026-07-18)

## Change

- Nový čistý helper `frontend/src/components/flat/monolithOverride.ts` —
  `buildMonolithOverridePatch(rep, override)`: metadata override (set/clear)
  + při `override===true` VŽDY `subtype='beton'` na rep-řádku (m³-gate
  odstraněn). `qty` se nedotýká — reálný objem betonu zadá uživatel přes
  PartHeader / kalkulátor (sanity-warningy engine chytí nesmysl).
- `handleSetMonolithOverride` deleguje na helper (logika beze změny pro
  demote/reset — veto řeší sdílený predikát `isMonolithGroup` z bugu
  monolit-jen-monolity-predicate).

## Tests

`monolithOverride.test.ts` (5): JMENOVITÝ ne-m³ case («t» rep → subtype=beton),
already-beton bez redundantního write, demote nikdy nepřepisuje subtype,
reset maže klíč a drží ostatní metadata, broken-JSON + missing-id.
