/**
 * Parent-linking pass — ROW_CLASSIFICATION_ALGORITHM v1.1 §4 + §7.
 *
 * Single pass over classified rows in source order that populates
 * `parentItemId` and `sectionId` by tracking two running pointers:
 *
 *   currentMainId    — id of the most recent 'main' row; subordinates
 *                      attach to this. Reset to null when a 'section'
 *                      row appears (so a subordinate cannot leak across
 *                      a section boundary, edge §6.2).
 *   currentSectionId — id of the most recent 'section' row; used to tag
 *                      every non-section row's sectionId for future
 *                      skupina inheritance (see interview Q1 answer).
 *
 * Edge cases handled here:
 *   §6.1  Orphan subordinate at file start — downgrade to 'unknown',
 *         push warning, leave parentItemId=null
 *   §6.2  Section-row mid-chain — reset currentMainId before processing
 *         the section itself, so the next subordinates attach correctly
 *   §6.3  Two main rows in a row — second main just updates currentMainId
 *
 * The pass does NOT re-classify rows. It takes ClassifiedRowBase[] (output
 * of typColumn or contentHeuristic classifiers) and returns
 * ClassifiedItem[] with linking fields populated.
 */

import type { ClassifiedItem, ClassifiedRowBase } from './classifierTypes';

export interface ParentLinkingResult {
  items: ClassifiedItem[];
  orphanCount: number;           // subordinates downgraded to unknown (§6.1)
  warnings: string[];            // aggregated warnings across all rows
}

/**
 * Walk classified rows in source order and fill parentItemId + sectionId.
 * Input is mutated-by-copy: we produce a fresh ClassifiedItem per input
 * row so callers can freely hold references to the old array.
 */
export function assignParentLinks(rows: ClassifiedRowBase[]): ParentLinkingResult {
  let currentMainId: string | null = null;
  let currentSectionId: string | null = null;
  const items: ClassifiedItem[] = [];
  const aggregatedWarnings: string[] = [];
  let orphanCount = 0;

  for (const row of rows) {
    const warnings: string[] = [];
    // Default — overwritten per branch below.
    let parentItemId: string | null = null;
    let sectionId: string | null = currentSectionId;
    let rowRole = row.rowRole;

    if (rowRole === 'section') {
      // §6.2 — new section resets current main pointer. Section's own
      // sectionId is null (a section does not belong to another section).
      currentSectionId = row.id;
      currentMainId = null;
      parentItemId = null;
      sectionId = null;
    } else if (rowRole === 'main') {
      // main anchors to the active section (possibly null at file start)
      // and becomes the new currentMainId for subsequent subordinates.
      parentItemId = null;
      sectionId = currentSectionId;
      currentMainId = row.id;
    } else if (rowRole === 'subordinate') {
      if (currentMainId === null) {
        // §6.1 orphan — downgrade to unknown so UI doesn't render a
        // disconnected sub-row. Keep the content (popis etc.) so the
        // user can still see it and promote manually if needed.
        rowRole = 'unknown';
        parentItemId = null;
        sectionId = currentSectionId;
        const msg = `Orphan subordinate at row ${row.sourceRowIndex} (sheet "${row.sourceSheetName}") — downgraded to unknown`;
        warnings.push(msg);
        aggregatedWarnings.push(msg);
        orphanCount++;
      } else {
        parentItemId = currentMainId;
        sectionId = currentSectionId;
      }
    } else {
      // unknown — tag with section context but no parent.
      parentItemId = null;
      sectionId = currentSectionId;
    }

    items.push({
      ...row,
      rowRole,
      parentItemId,
      sectionId,
      warnings,
    });
  }

  return { items, orphanCount, warnings: aggregatedWarnings };
}
