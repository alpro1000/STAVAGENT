# ROW CLASSIFICATION — current state (baseline)

> **Purpose.** Snapshot of how `rowRole` / `parentItemId` / `boqLineNumber`
> are assigned in Registry today (2026-04-22). This is a *descriptive* audit,
> not a plan. It exists to anchor discussion of what should be improved —
> don't edit it when changing the classifier; write a follow-up doc instead.

## 1. Where `rowRole` is set

Single canonical source:

| File | Function | Invocation sites |
|------|----------|------------------|
| `src/services/classification/rowClassificationService.ts` | `classifyRows(items: ParsedItem[])` | `src/components/import/ImportModal.tsx:327` (single-sheet import) and `:472` (multi-sheet import) |

No backend classifier. No PDF parser. No AI call during classification. Pure
synchronous regex + heuristic pass over the items array returned by the Excel
parser. Classifier is **template-agnostic** — the same logic runs whether the
user picked ÚRS, OTSKP, RTS, Flexible or Svodný.

Manual mutations after import:

| Mutation | Store action | UI trigger |
|----------|--------------|------------|
| Change role of one item | `registryStore.updateItemRole(projectId, sheetId, itemId, role)` (`registryStore.ts:772`) | Role-trigger dropdown in `RowActionsCell.tsx:180-205` |
| Reassign parent of a subordinate | `registryStore.updateItemParent(projectId, sheetId, itemId, parentId)` (`registryStore.ts:793`) | `Link2` parent-picker modal in `RowActionsCell.tsx:252-405` |

Manual mutations are per-item — they don't re-run `classifyRows` on the sheet,
and subsequent items' `parentItemId` is **not** recalculated.

## 2. Parser vs classifier — where the split is

The Excel parser (`src/services/parser/excelParser.ts`) produces
`ParsedItem[]`. It does **not** assign `rowRole`, `parentItemId` or
`boqLineNumber`. Its job is to group raw Excel rows into item records:

- **Standard mode** (templates `urs-standard`, `otskp`, `rts`): a row becomes
  a new `ParsedItem` only if its kod cell matches `isItemCode()` (6+ digits,
  dotted ÚRS, OTSKP, RTS, or any 3+ digit generic). Rows without a code are
  appended to the previous item's `popisDetail[]` (continuation text), not
  emitted as separate items.
- **Flexible mode** (templates `flexible`, `svodny`, with `flexibleMode: true`
  in `ImportConfig`): every row with any content in kod or popis becomes a
  new `ParsedItem`. No continuation merging.

Then `classifyRows(items)` runs and assigns `rowRole` / `parentItemId` /
`boqLineNumber` by walking the already-grouped item list in source order.

**Consequence.** In standard mode, description continuations are invisible to
`classifyRows` — they've been folded into `popisDetail[]`. Most
"subordinate" outputs arise only in flexible mode, or when a code-shaped row
in standard mode is not recognised as a main code pattern.

## 3. Input signals `classifyRows` reads

Per item:
- `kod: string | null` (trimmed)
- `popis: string | null` (trimmed)
- `mj: string | null`
- `mnozstvi: number | null`
- `cenaJednotkova: number | null`
- `cenaCelkem: number | null`
- `source.rowStart: number` — used only for the pre-sort, not for decisions

Cross-item state (iterated in source order):
- `currentMainId: string | null` — id of the last row classified as `main`;
  reset to `null` when a `section` row is seen
- `boqCounter: number` — 1-based counter, incremented on every `main`

## 4. Regex + heuristic patterns

Defined at top of `rowClassificationService.ts`:

```
URS_CODE             ^\d{6,}$
URS_DOTTED           ^\d{2,3}\.\d{2,3}\.\d{2,3}$
OTSKP_CODE           ^[A-Z]\d{4,}[A-Z]{0,2}$        // A12345, R42194B
RTS_CODE             ^\d{3,4}-\d{3,4}$              // 123-456
GENERIC_CODE         ^\d{3,}                         // anything starting with 3+ digits
SUB_INDEX            ^[A-Z]\d{1,3}$                  // A195, B5, C12
VV_MARKERS           ^(VV|PP|PSC|VRN)$   (case-ins.)
DECIMAL_MULTIPLICATION   \d+[,\.]\d+\s*\*\s*\d+[,\.]\d+
SUMMARY_KEYWORDS     celkov[éá]\s+množstv[ií]        (case-ins.)
DIL_ORDINAL          ^\d{1,2}$                       // 0..99

SECTION_PATTERNS[]   díl:, oddíl:, HSV, PSV, MON, VRN, ON,
                     práce HSV, práce PSV, I./II./IV. (roman numerals)
NUMBERED_SECTION     ^\d{1,2}\s*[\.\)]\s+[A-Z-ČJ-capitals]
SECTION_KEYWORDS     práce|díl|část|oddíl|konstrukce|výztuž|beton|izolace|
                     základy|zemní                   (case-ins.)

CALC_INDICATORS[]    \d+[\*×x]\d+, \d+\s*[\+\-]\s*\d+, \(\d+,
                     \d+\.\d+\s*\*, =\s*\d+,
                     celkem, mezisoučet, součet      (case-ins.)
```

Three derived predicates:
- `hasCompleteData(item)` — MJ present && mnozstvi > 0 && (cenaJednotkova > 0
  OR cenaCelkem > 0)
- `isCalculationRow(item)` — popis matches CALC_INDICATORS, **or** has
  mnozstvi without kod
- `isNoteRow(item)` — popis non-empty && all numeric fields zero/null
- `isDilSection(item)` — 1-2 digit kod && popis present && no quantity && no
  unit price

## 5. Branch order in `classifyRows`

Evaluated as an `if / else if` ladder per item — **first match wins**:

| # | Condition | Result | Parent link |
|---|-----------|--------|-------------|
| 0  | `VV_MARKERS.test(kod)` | `subordinate` / `other` | `currentMainId` |
| 0b | `!kod && currentMainId && (DECIMAL_MULTIPLICATION or SUMMARY_KEYWORDS in popis)` | `subordinate` / `calculation` | `currentMainId` |
| 1a | `kod && hasCompleteData(item)` | `main`, `boqCounter++`, `currentMainId = item.id` | — |
| 1b | `isMainCode(kod)` (URS / dotted / OTSKP / RTS / GENERIC) | `main`, `boqCounter++`, `currentMainId = item.id` | — |
| 2  | `isSubIndex(kod)` (A195, B5) | `subordinate` / `repeat` | `currentMainId` — warns if null |
| 3  | `!kod && isSectionHeader(popis)` | `section`, `currentMainId = null` | — |
| 3b | `isDilSection(item)` | `section`, `currentMainId = null` | — |
| 4  | `!kod && currentMainId` | `subordinate` with subtype from isCalculationRow / isNoteRow (else `other`) | `currentMainId` |
| 5  | `kod && !isMainCode(kod) && currentMainId` | `subordinate` / `other`, warning `Unrecognized code format` | `currentMainId` |
| 6  | else | `unknown`, warning `Empty row` if both kod and popis empty | — |

A section row (branch 3 or 3b) clears `currentMainId`, so any subordinates
that follow before the next main will hit branch 6 (`unknown`) instead.

## 6. Confidence + warnings

`classificationConfidence: 'high' | 'medium' | 'low'` per item:

- `main` high: URS / OTSKP / RTS pattern
- `main` medium: URS dotted, GENERIC 3+ digits, `hasCompleteData` only
- `main` low: none of the above (unreachable from current branches — main is
  only assigned via 1a or 1b, both set medium+)
- `section`: always high
- `subordinate` high: VV_MARKERS, SUB_INDEX, DECIMAL_MULTIPLICATION,
  SUMMARY_KEYWORDS, isNoteRow match
- `subordinate` medium: CALC_INDICATORS or any other subordinate path
- `unknown`: always low

`classificationWarnings?: string[]` populated on:

- Branch 2 when `currentMainId === null` — `Sub-index row without preceding main item`
- Branch 5 always — `` Unrecognized code format: "<kod>" ``
- Branch 6 when kod and popis both empty — `Empty row (no code and no description)`

## 7. Cascade (skupina) — separate pass, reads rowRole

`src/services/classification/classificationService.ts:178`
`applyClassificationsWithCascade(items, classifications)`:

1. Sort by `source.rowStart`
2. Walk items. For each item decide `isMain` / `isSubordinate` using
   `item.rowRole` when set, falling back to `kod present or not` heuristic.
3. When a `main` gets an AI-suggested skupina, store it as
   `lastMainItemSkupina`.
4. Every following `subordinate` inherits `lastMainItemSkupina` (if set).
5. A `main` **without** AI suggestion **resets** `lastMainItemSkupina = null`
   — subsequent subordinates do not inherit, even if the previous chain had
   a skupina.
6. Section and unknown rows don't cascade and don't reset.

This cascade runs only at import time, inside `ImportModal.tsx`, after
`classifyRows`.

## 8. Runtime fallback in the UI (not a classifier change)

`src/components/items/ItemsTable.tsx:252` — `effectiveParentMap`:

```ts
// Falls back to proximity (nearest 'main' above) when parentItemId is null.
items.forEach(item => {
  if (item.rowRole === 'main') currentMainId = item.id;
  else if (item.rowRole === 'subordinate') {
    const parent = item.parentItemId || currentMainId;
    if (parent) map.set(item.id, parent);
  }
});
```

Both `subordinateCounts` and the collapse/hide filter in `visibleItems` read
through this map. This means the chevron + collapse behaviour is robust to
classifier-emitted `parentItemId === null`, but the underlying data on disk
still has null — re-export or backend sync carries the null through.

## 9. Templates — what the classifier sees per template

All templates in `src/config/templates.ts`:

| Template | `flexibleMode` | Typical `kod` column | What reaches `classifyRows` |
|---|---|---|---|
| `urs-standard` | false | A (6+ digit ÚRS) | one item per code row; continuations folded into `popisDetail` |
| `otskp` | false | A (letter + digits) | same as above, OTSKP kod format |
| `rts` | false | A (`XXX-YYY`) | same, RTS format |
| `flexible` | **true** | A | every row with any content becomes a separate item — subordinates and sections emerge from classifier |
| `svodny` | **true** | A | same as flexible, 2-row header skip |

Auto-detection of template lives in `src/components/import/RawExcelViewer.tsx`
and `src/services/autoDetect/structureDetector.ts` — they pick the template
before classification runs; they do not themselves touch `rowRole`.

## 10. Known failure modes

Observed or reasoned from the code, not exhaustive.

1. **Subordinate without parent** — branch 2 can set
   `parentItemId = currentMainId = null` if the file starts with a sub-index
   before any recognised main. Branch 5 same story. The classifier emits the
   row with `rowRole = 'subordinate'` and `parentItemId = null`; until the UI
   fallback from §8 lands on disk, the chevron + collapse wouldn't work.

2. **Section header false reset** — if `isSectionHeader` fires on a row that
   is actually a subordinate note (e.g. popis starts with "1. " followed by
   section keyword), `currentMainId` clears. The following subordinates go
   to branch 6 (`unknown`). Guard: 100-char length limit + `SECTION_KEYWORDS`
   regex. Still tunable.

3. **"Položka obsahuje…" rows** matching `NUMBERED_SECTION` regex — if the
   sentence happens to contain one of the SECTION_KEYWORDS (`beton`,
   `výztuž`, etc.), it can be mis-detected as section. Not observed in code
   evidence but the logical possibility is there; the 100-char cap helps.

4. **Sub-index vs truncated code ambiguity** — `A12` matches
   `^[A-Z]\d{1,3}$` → branch 2 classifies it as `subordinate repeat`. If
   the code was actually a 5+ digit OTSKP truncated by the import, it
   should be `main`. No disambiguation signal available.

5. **Non-standard main code without full data** — `Pol1` would only become
   `main` via branch 1a if MJ + quantity + price > 0 are all present. If
   any are missing it falls to branch 5 (subordinate) or 6 (unknown),
   emitting a warning.

6. **Section vs díl heuristic ambiguity** — `isDilSection` (branch 3b)
   requires kod to be 1-2 digits **and** no quantity **and** no unit price.
   A row with `kod='12'` and a cenaCelkem but no mnozstvi passes — becomes
   section. A row with `kod='12'` and only popis (no prices) still passes
   branch 3b. Edge case untested.

7. **Cross-sheet isolation** — `classifyRows` runs per sheet in the
   multi-sheet import loop (`ImportModal.tsx:472`). A main row in sheet A
   cannot be parent to a subordinate in sheet B. `currentMainId` resets
   between sheets.

8. **No re-classification on manual edit** — `updateItemRole` changes one
   item's role in store; it does not recompute `parentItemId` of anything
   else. If the user changes a `main` row to `section`, subordinates that
   followed it still point to the now-section-role item.

9. **Re-import loses manual overrides** — `applyClassificationsWithCascade`
   preserves skupina through the cascade but the `classifyRows` output
   overwrites `rowRole` + `parentItemId` on every re-import. Manual
   role/parent edits from the previous import are lost.

10. **Empty `popisDetail` merge in standard mode** — a genuinely
    standalone description row between two main rows in standard mode is
    merged into the *preceding* main's `popisDetail[]` even when the text
    logically belongs to the *next* main. `classifyRows` never sees it as
    a separate row.

11. **`next-session.md §3` note (for reference).** That note mentions
    classifier errors in a **different** classifier — `detectCatalog()`
    in `src/utils/position-linking.ts` — which decides OTSKP vs ÚRS vs
    "no catalog" for position linking. It's orthogonal to `rowRole` and
    not part of this audit.

## 11. Unit test coverage

Zero test files in `rozpocet-registry/src/` match `*.test.*`. The classifier
has no unit tests. `next-session.md §3` proposes a `test-data/classifier-golden.json`
corpus; it hasn't been created.

---

## Open questions for user / domain expert

1. **What "standard" Czech BOQ structures should classify correctly?**
   Specifically — can you share 5-10 real Excel sheets (or screenshots)
   where rowRole detection fails in a way you can point to? ODPADY from
   the latest screenshot is one. A small corpus would let us add golden
   tests and tune the regex without guesswork.

2. **"Položka obsahuje…" rows — how should they be stored?** In standard
   mode they are folded into `popisDetail[]` of the parent (invisible
   in the table). In flexible mode they become separate `subordinate
   note` rows. The user-facing effect is very different. Is either
   intended to be the canonical behaviour, or should it be a per-template
   choice surfaced in the UI?

3. **Manual overrides vs re-import.** If a user manually reassigns a
   row's role or parent and then re-imports the same file (edit mapping,
   reimport flow), the override is discarded. Should we preserve manual
   overrides across re-imports keyed by (kod, popis) identity, or is
   "re-import resets" the intended behaviour?

4. **Cascade reset on un-classified main.** When a main row has no AI
   skupina suggestion, `lastMainItemSkupina` resets to null. Following
   subordinates then don't inherit anything, even if they would have
   inherited a previously-set skupina. Is the reset intentional (every
   main row is an independent skupina context) or a bug (cascade should
   continue from whatever the last classified main had)?

5. **Section detection thresholds.** `NUMBERED_SECTION` (`^\d{1,2}\.\s+…`)
   + `SECTION_KEYWORDS` keyword filter + 100-char length cap. The 100 is
   an arbitrary number. Do you have examples where 100 is wrong either
   way (100-char section title, 50-char note misdetected as section)?

6. **Sub-index vs truncated code disambiguation.** `A12` is currently
   `subordinate repeat`. Do you know real cases where `A12` is the full
   code of a main item? If yes, we need another signal (MJ present?
   hasCompleteData override?).

7. **Cross-sheet subordinates.** Is there a real case where a
   subordinate in sheet B logically belongs to a main in sheet A? If
   yes, per-sheet classification is wrong and we'd need a post-pass.

8. **`updateItemRole` re-link.** If the user flips a main row to
   `section` via the UI dropdown, the subordinates immediately below
   are orphaned (still pointing at a now-section row). Should the store
   mutation re-link them to the previous main? Should changing a
   subordinate to main promote its followers?

9. **Template-driven rules.** Right now the classifier is
   template-agnostic. Should OTSKP-template imports use a stricter
   OTSKP-only main pattern (reject `\d{6,}` that aren't OTSKP-shaped)?
   Should RTS-template imports treat `\d{3}-\d{3}` as the only main
   pattern? Current behaviour mixes all five regex patterns regardless
   of which template the user picked.
