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
 * Motivation: three copies in two versions (CORE=2026/17 940, this service +
 * Portal=2025/17 904) meant one query through different doors returned
 * different codes — a reproducibility break. This module removes the drift
 * inside this service; the version is stamped into result provenance so a
 * record is never ambiguous about which catalog produced it.
 *
 * Everything is env-overridable so ops can pin a specific catalog (e.g. roll
 * back to the previous version while a matching-quality regression is
 * measured) without a code change.
 *
 * @module config/otskpCatalog
 */

// Canonical catalog filename in the concrete-agent knowledge base.
// Default tracks CORE (see concrete-agent config OTSKP_CATALOG_VERSION="OTSKP 2026").
export const OTSKP_CATALOG_FILENAME =
  process.env.OTSKP_CATALOG_FILENAME || '2026_otskp.xml';

// Human-readable catalog version stamped into result provenance.
// Must match CORE's OTSKP_CATALOG_VERSION so the same file carries the same label.
export const OTSKP_CATALOG_VERSION =
  process.env.OTSKP_CATALOG_VERSION || 'OTSKP 2026';

// Informational expected item count (2026 SFDI catalog). Not enforced — used
// only for sanity logging; the real count comes from the parsed XML.
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
