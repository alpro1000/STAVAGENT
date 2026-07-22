/**
 * OTSKP Catalog — single canonical source (facade).
 *
 * One door to the OTSKP price catalog. Every consumer in this service
 * (runtime in-memory service, SQLite importers, KROS+ÚRS merge, provenance
 * labels) resolves the catalog filename + version THROUGH this module instead
 * of hardcoding it. The physical XML lives in the concrete-agent knowledge base
 * (bundled into the container at build time) so CORE and this service read the
 * SAME file — a query through either door then yields the SAME codes.
 *
 * DEFAULT = OTSKP 2026 (2026_otskp.xml, ~17 940 items) — the SAME catalog CORE
 * serves, closing the CORE↔kiosk version drift for this service. The flip from
 * the 2025 default was a MEASURED step (SO-250 projektant corpus, two runs on
 * identical code, only env+DB differed): top1/recall 0.9231 → 1.0000 (+7.7 pp),
 * zero metric regressions; on 2025 data the matcher answered ZÁKLADY C25/30
 * lines with ŘÍMSY codes (317324/317365), on 2026 correctly (272324/272365).
 * Numbers recorded in docs/soul.md §9 2026-07-22 (e).
 *
 * Rollback valve: the env overrides below pin any catalog without a code
 * change (OTSKP_CATALOG_FILENAME=2025_03_otskp.xml +
 * OTSKP_CATALOG_VERSION="OTSKP 2025" restores the previous behaviour
 * instantly). Filename and version MUST move together.
 *
 * @module config/otskpCatalog
 */

// OTSKP catalog filename in the concrete-agent knowledge base.
export const OTSKP_CATALOG_FILENAME =
  process.env.OTSKP_CATALOG_FILENAME || '2026_otskp.xml';

// Human-readable catalog version stamped into provenance. Must move together
// with OTSKP_CATALOG_FILENAME (matches CORE's OTSKP_CATALOG_VERSION).
export const OTSKP_CATALOG_VERSION =
  process.env.OTSKP_CATALOG_VERSION || 'OTSKP 2026';

// Informational expected item count for the DEFAULT (2026 SFDI) catalog. Not
// enforced — only sanity logging; the real count comes from the parsed XML.
// (2025_03 was 17 904.)
export const OTSKP_CATALOG_EXPECTED_ITEMS = Number(
  process.env.OTSKP_CATALOG_EXPECTED_ITEMS || 17940
);

// Path of the catalog XML inside the concrete-agent knowledge base, relative to
// the monorepo root. Consumers join this onto their own known root (Docker /app
// or a repo-root computed from __dirname) — the depth differs per caller, only
// the sub-path + filename are shared.
export const OTSKP_KB_SUBPATH =
  'concrete-agent/packages/core-backend/app/knowledge_base/B1_otkskp_codes/' +
  OTSKP_CATALOG_FILENAME;

// Absolute path inside the production container (Dockerfile.backend copies the
// KB to /app/concrete-agent/...).
export const OTSKP_DOCKER_XML_PATH = `/app/${OTSKP_KB_SUBPATH}`;
