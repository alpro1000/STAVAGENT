/**
 * Classification codec — packs/unpacks ParsedItem classification fields
 * into the registry-backend `registry_items.sync_metadata` TEXT column.
 *
 * Why a JSON blob instead of dedicated columns:
 *   The backend already has an unused `sync_metadata TEXT` column on
 *   `registry_items` (see rozpocet-registry-backend/schema.sql), accepted
 *   by the bulk INSERT and returned by GET /sheets/:id/items. Re-using it
 *   avoids a schema migration for fields that the backend never queries
 *   (only the frontend reads/writes them) and keeps the round-trip
 *   forward-compatible: future fields appear inside the JSON and old
 *   clients ignore unknown keys.
 *
 * Round-trip without this codec was lossy — the eight columns kept by
 * `RegistryItem` cover only the BOQ basics (kod/popis/množství/MJ/ceny/
 * skupina). Everything the row classifier produces (rowRole, parentItemId,
 * sectionId, _rawCells, originalTyp, popisDetail, …) was dropped on push
 * and never reconstructed on pull, so a project that survived a localStorage
 * wipe lost all hierarchy + raw cells (no "Překlasifikovat" possible).
 *
 * Schema versioning: the blob carries `v: 1`. On read, anything with a
 * different version is treated as if no metadata existed (defensive — a
 * future v2 will likely add fields, not remove them, so v1 readers can
 * still surface kod/popis/skupina from the dedicated columns).
 */

import type { ParsedItem } from '../types';

export const CLASSIFICATION_BLOB_VERSION = 1 as const;

export interface ClassificationBlob {
  v: typeof CLASSIFICATION_BLOB_VERSION;
  popisDetail?: string[];
  rowRole?: ParsedItem['rowRole'];
  subordinateType?: ParsedItem['subordinateType'];
  parentItemId?: string | null;
  boqLineNumber?: number | null;
  classificationConfidence?: ParsedItem['classificationConfidence'];
  classificationWarnings?: string[];
  sectionId?: string | null;
  source_format?: ParsedItem['source_format'];
  source_row_index?: number;
  originalTyp?: string | null;
  por?: number | null;
  cenovaSoustava?: string | null;
  varianta?: string | null;
  classificationSource?: ParsedItem['classificationSource'];
  _rawCells?: unknown[];
}

const PACKED_KEYS: ReadonlyArray<keyof ClassificationBlob> = [
  'popisDetail',
  'rowRole',
  'subordinateType',
  'parentItemId',
  'boqLineNumber',
  'classificationConfidence',
  'classificationWarnings',
  'sectionId',
  'source_format',
  'source_row_index',
  'originalTyp',
  'por',
  'cenovaSoustava',
  'varianta',
  'classificationSource',
  '_rawCells',
];

function isMeaningful(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'string') return value.length > 0;
  return true;
}

/**
 * Pack a ParsedItem's classification fields into a typed blob suitable for
 * the `sync_metadata` column. Returns the OBJECT (not a JSON string) — the
 * registry-backend already runs `JSON.stringify(item.sync_metadata)` on
 * insert (rozpocet-registry-backend/server.js:390), so passing the raw
 * object keeps a single round of encoding (vs. double-escape if we
 * pre-stringified). Returns `null` when the item carries nothing worth
 * persisting beyond the dedicated columns — keeps DB rows compact for
 * legacy items that pre-date the classifier rewrite.
 */
export function serializeClassification(item: ParsedItem): ClassificationBlob | null {
  const blob: ClassificationBlob = { v: CLASSIFICATION_BLOB_VERSION };
  let hasAny = false;

  for (const key of PACKED_KEYS) {
    const value = (item as unknown as Record<string, unknown>)[key];
    if (isMeaningful(value)) {
      (blob as unknown as Record<string, unknown>)[key] = value;
      hasAny = true;
    }
  }

  if (!hasAny) return null;
  return blob;
}

/**
 * Decode a `sync_metadata` cell back into a typed blob. Accepts either the
 * raw TEXT/JSON string (current schema) or a pre-parsed object (some PG
 * drivers auto-parse JSONB — defensive in case the column is migrated).
 * Returns `null` for missing, malformed, or future-versioned blobs.
 */
export function deserializeClassification(
  raw: string | object | null | undefined
): ClassificationBlob | null {
  if (raw === null || raw === undefined) return null;

  let parsed: unknown;
  if (typeof raw === 'object') {
    parsed = raw;
  } else if (typeof raw === 'string') {
    if (raw.length === 0) return null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }
  } else {
    return null;
  }

  if (!parsed || typeof parsed !== 'object') return null;
  const obj = parsed as Record<string, unknown>;
  if (obj.v !== CLASSIFICATION_BLOB_VERSION) return null;

  return obj as unknown as ClassificationBlob;
}

/**
 * Apply a decoded blob to a partial ParsedItem under construction. Skips
 * fields the blob did not carry so callers' defaults stay in place.
 */
export function applyClassificationBlob(
  target: Partial<ParsedItem>,
  blob: ClassificationBlob | null
): void {
  if (!blob) return;
  for (const key of PACKED_KEYS) {
    const value = blob[key];
    if (value !== undefined) {
      (target as unknown as Record<string, unknown>)[key] = value;
    }
  }
}
