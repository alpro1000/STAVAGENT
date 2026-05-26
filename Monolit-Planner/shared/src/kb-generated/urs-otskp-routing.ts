/**
 * AUTO-GENERATED FILE — DO NOT EDIT.
 * Source: kb/urs_otskp_routing.yaml
 * Regenerate: npm run gen:knowledge
 */

/** Catalog priority per project type (per soul.md memory rules). */
export type ProjectType = 'verejna' | 'privatni' | 'design_build';
export type CatalogName = 'OTSKP' | 'URS' | 'RTS' | 'own';

export interface RoutingEntry {
  catalog_priority: CatalogName[];
  notes: string;
  source_examples: string[];
}

export const URS_OTSKP_ROUTING: Record<ProjectType, RoutingEntry> = {"verejna":{"catalog_priority":["OTSKP","URS","RTS"],"notes":"Veřejná zakázka: OTSKP je primární (povinné per zadávací dokumentace\nveřejných zadavatelů typu SÚSPK, ŘSD, kraj/město). URS slouží jako\nback-fill pro položky neexistující v OTSKP. RTS pouze pro vendor\npricing cross-check.\n","source_examples":["Most ev.č. 2062-1 Žihle (SÚSPK D&B)"]},"privatni":{"catalog_priority":["URS","own"],"notes":"Privátní zakázka (RD, hala, soukromý investor): OTSKP je IRRELEVANTNÍ\n— vendor + projektant pracuje v URS. Own/firemní katalog se uplatní\npro položky bez URS code (atypické, speciální technologie).\n","source_examples":["RD Fibichova 733 Jáchymov (Karel Šmíd, 2026-05)","Hala hk212 (firma)"]},"design_build":{"catalog_priority":["URS","OTSKP"],"notes":"D&B (Design & Build) tender: soupis prací obsahuje OBĚ kódové\nsoustavy ve dvou paralelních sloupcích — URS pro projektantovu\ncenovou kalkulaci + OTSKP per zadávací dokumentace (povinné pro\nveřejného zadavatele jako SÚSPK/ŘSD). Engine musí vrátit oba\nkódy pro každou položku.\n","source_examples":["Most 2062-1 u obce Žihle D&B SÚSPK (2026-04 to 2026-05)"]}};

/** Return ordered catalog priority for a given project type. */
export function getCatalogPriority(projectType: ProjectType): CatalogName[] {
  return URS_OTSKP_ROUTING[projectType]?.catalog_priority ?? ['URS'];
}

export const SOURCE_CITATION = {"source":"STAVAGENT corpus rules from real-world pilots 2026-04 to 2026-05","pilots":{"verejna_examples":["Most ev.č. 2062-1 u obce Žihle (SÚSPK) — OTSKP per ZD §4.4.l"],"privatni_examples":["RD Fibichova 733 Jáchymov (Karel Šmíd) — URS primary, OTSKP not used","Hala hk212 — URS-only","RD Libuše"],"design_build_examples":["Most 2062-1 Žihle D&B — soupis contains both URS code + OTSKP code per row"]},"extraction_date":"2026-05-26"} as const;
