/**
 * @stavagent/zeleznice-shared — public surface.
 */
export * from './types.js';
export { planRailSection, RAIL_ENGINE_VERSION } from './calculators/rail-orchestrator.js';
export { calculateTrackQuantities } from './calculators/track-quantities.js';
export { calculateBallast } from './calculators/ballast.js';
export { calculateTurnoutWorks, findTurnoutForm } from './calculators/turnout-works.js';
export { buildTechnologySequence } from './calculators/sequence.js';
export { computeDeployment, assignMachineToPhase, resolveMachineRate } from './calculators/machine-plan.js';
export { buildCrewPlan } from './calculators/crew-plan.js';
export { bindCatalog } from './calculators/catalog-binding.js';
export { resolveAssembly, resolveSectionLength } from './calculators/resolve.js';
export { qOk, qBlank, round } from './calculators/quantity.js';

// KB-generated data (single-source: kb/zeleznicni_*.yaml → codegen).
// SOURCE_CITATION se jmenuje ve všech třech modulech stejně → jmenné exporty
// + namespaced re-export (viz kb-generated/index.ts pattern Monolitu).
export {
  RAIL_PROFILES,
  SLEEPER_TYPES,
  FASTENING_SYSTEMS,
  SLEEPER_SPACING_TABLE,
  SPACING_TABLE_SOURCE,
  SPACING_TABLE_CONFIDENCE,
  TRACK_ASSEMBLIES,
  BALLAST_PROFILE_PRESETS,
  BK_PARAMS,
  TECHNOLOGY_PARAMS,
  type RailProfileSpec,
  type SleeperTypeSpec,
  type FasteningSystemSpec,
  type SleeperSpacingRow,
  type TrackAssemblySpec,
  type BallastProfilePreset,
  type RailSourceRef,
} from './kb-generated/zeleznice-svrsek.js';
export { TURNOUT_FORMS, type TurnoutFormSpec } from './kb-generated/zeleznice-vyhybky.js';
export {
  RAIL_MACHINES,
  TRACK_GANG,
  SAFETY_ROLES,
  type RailMachineSpec,
  type MachineModeSpec,
  type MachineRestrictions,
  type SafetyRoleSpec,
} from './kb-generated/zeleznice-mechanizace.js';
export * as ZELEZNICE_KB from './kb-generated/index.js';
