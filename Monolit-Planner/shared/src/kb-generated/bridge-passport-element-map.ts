/**
 * AUTO-GENERATED FILE — DO NOT EDIT.
 * Source: concrete-agent/packages/core-backend/app/classifiers/element_rules/passport_element_map.yaml
 * Regenerate: npm run gen:knowledge
 *
 * tz-bridge-passport element/use key → engine element_type + per-SO join
 * metadata (per_deck split, concretes[].use alias). Consumed by the half-A
 * mapper (bridge-passport.ts); the Python half-B assembler reads the YAML
 * source natively — one map, no drift (ADR-008).
 */

export const SOURCE_CITATION = {"source":"concrete-agent/packages/core-backend/app/classifiers/element_rules/passport_element_map.yaml","schema_version":1,"note":"Single source for the tz-bridge-passport element-key map (ADR-008 §2). The Python half-B assembler reads the YAML directly; this generated artifact keeps the TS half-A mapper in lockstep (gen:knowledge:check)."} as const;

export interface BridgePassportElementRule {
  /** Canonical engine StructuralElementType (consumer casts). */
  engine_type: string;
  /** Symmetric per-deck element (÷ decks, num_bridges = decks) vs whole-SO. */
  per_deck: boolean;
  /** materials_and_standards.concretes[].use key when it differs from the element key. */
  concrete_use?: string;
}

export const BRIDGE_PASSPORT_ELEMENT_MAP: Record<string, BridgePassportElementRule> =
  {"superstructure_deck":{"engine_type":"mostovkova_deska","per_deck":true},"pier_shafts":{"engine_type":"driky_piliru","per_deck":true},"abutments":{"engine_type":"opery_ulozne_prahy","per_deck":true},"foundations_piers":{"engine_type":"zaklady_piliru","per_deck":true,"concrete_use":"foundations"},"foundations_abutments":{"engine_type":"zaklady_oper","per_deck":true,"concrete_use":"foundations"},"transition_slabs":{"engine_type":"prechodova_deska","per_deck":true},"rims":{"engine_type":"rimsa","per_deck":true},"blinding_concrete":{"engine_type":"podkladni_beton","per_deck":false},"plain_footings":{"engine_type":"podkladni_beton","per_deck":false}};
