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
 * Motivation: the "description → code" catalog filename + version were
 * hardcoded in four places in this service, so a version bump touched four
 * files and could drift between them. This module makes them ONE value.
 *
 * DEFAULT = the catalog this service serves in production TODAY (2025_03 /
 * 17 904). This keeps the facade a pure, behaviour-NEUTRAL refactor: it emits
 * the exact same codes as before, so it carries no matching change and needs
 * no corpus measurement to ship.
 *
 * Moving to CORE's 2026 SFDI catalog (17 940) is then a single env-var flip
 * (OTSKP_CATALOG_FILENAME=2026_otskp.xml + OTSKP_CATALOG_VERSION="OTSKP 2026"),
 * i.e. a fully measurable, instantly reversible matching change — run the
 * corpus on 17 904 and on 17 940 with the SAME code, compare, then flip. Until
 * that measured step lands, the CORE↔kiosk version drift is NARROWED (one door
 * now has a single knob) but NOT closed (this service + Portal + Monolit still
 * serve 2025). Do not call it "fixed".
 *
 * @module config/otskpCatalog
 */

// OTSKP catalog filename in the concrete-agent knowledge base.
// Default = current production catalog (2025). Flip to '2026_otskp.xml' via env
// as a corpus-measured step (see module doc).
export const OTSKP_CATALOG_FILENAME =
  process.env.OTSKP_CATALOG_FILENAME || '2025_03_otskp.xml';

// Human-readable catalog version stamped into provenance. Must move together
// with OTSKP_CATALOG_FILENAME (2026 file → "OTSKP 2026", matching CORE).
export const OTSKP_CATALOG_VERSION =
  process.env.OTSKP_CATALOG_VERSION || 'OTSKP 2025';

// Informational expected item count for the DEFAULT (2025) catalog. Not
// enforced — only sanity logging; the real count comes from the parsed XML.
// (2026 SFDI is ~17 940.)
export const OTSKP_CATALOG_EXPECTED_ITEMS = Number(
  process.env.OTSKP_CATALOG_EXPECTED_ITEMS || 17904
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
