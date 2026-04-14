/**
 * Pour Decision Tree v2.0
 *
 * Core principle: The ONLY parameter determining pour mode is the presence
 * of dilatační spáry (dilation joints). NOT element type, NOT volume alone.
 *
 * Terminology:
 *   - Spára (dilatační spára) = physical joint in the structure (permanent, designed by architect)
 *   - Záběr (capture/tact)    = construction pour unit (temporary, decided by builder)
 *   - Sekce (section)         = portion of structure between two adjacent spáry
 *
 * Relationship: num_sections = structure divided by spáry.
 *               num_tacts ≤ num_sections (can combine small sections into one tact).
 *
 * Decision flow:
 *   has_spary? ──YES──→ sectional (can interrupt)
 *              │         ├─ adjacent? → chess order (odd→cure→even)
 *              │         ├─ independent? → any order
 *              │         └─ vertical? → bottom-to-top
 *              │
 *              └──NO───→ monolithic (must complete in one pass)
 *                        ├─ fits 1 pump? → simple pour
 *                        ├─ needs N pumps? → multi-pump
 *                        └─ mega pour (>500m³)? → backup pump required
 */
/** Pour mode — determined by has_dilatacni_spary */
export type PourMode = 'sectional' | 'monolithic';
/** Sub-mode for sectional pouring.
 *  `manual_override` is set by the orchestrator when the user provides
 *  `num_tacts_override` — derived fields (pumps, t_window, pour_hours_per_tact)
 *  get recomputed for the smaller per-tact volume (Block D). */
export type SectionalSubMode = 'independent' | 'adjacent_chess' | 'vertical_layers' | 'manual_override';
/** Sub-mode for monolithic pouring */
export type MonolithicSubMode = 'single_pump' | 'multi_pump' | 'mega_pour';
/** Temperature/season affecting t_window */
export type SeasonMode = 'hot' | 'normal' | 'cold';
/** Element type — used ONLY for default suggestions, NOT for mode determination */
export type StructuralElementType = 'zaklady_piliru' | 'driky_piliru' | 'rimsa' | 'operne_zdi' | 'mostovkova_deska' | 'rigel' | 'opery_ulozne_prahy' | 'kridla_opery' | 'mostni_zavirne_zidky' | 'prechodova_deska' | 'zakladova_deska' | 'zakladovy_pas' | 'zakladova_patka' | 'stropni_deska' | 'stena' | 'sloup' | 'pruvlak' | 'schodiste' | 'nadrz' | 'podzemni_stena' | 'pilota' | 'other';
export interface PourDecisionInput {
    element_type: StructuralElementType;
    volume_m3: number;
    has_dilatacni_spary: boolean;
    spara_spacing_m?: number;
    total_length_m?: number;
    adjacent_sections?: boolean;
    /**
     * BUG-4: Are pracovní (working) joints allowed when the element has NO
     * dilatační spáry?
     *   - undefined / 'no'  → strictly monolithic (1 záběr) — backward compatible default
     *   - 'yes'             → working joints allowed, sectioning by capacity
     *   - 'unknown'         → same as 'yes', but emits an "ověřte v RDS" warning
     *
     * Pracovní spára ≠ dilatační spára: the latter is permanent and designed by
     * the architect, the former is a temporary construction joint decided by the
     * builder. They can exist independently.
     */
    working_joints_allowed?: 'yes' | 'no' | 'unknown';
    q_eff_m3_h?: number;
    setup_hours?: number;
    washout_hours?: number;
    season?: SeasonMode;
    use_retarder?: boolean;
}
export interface PourDecisionOutput {
    pour_mode: PourMode;
    sub_mode: SectionalSubMode | MonolithicSubMode;
    num_sections: number;
    section_volume_m3: number;
    max_sections_per_tact: number;
    num_tacts: number;
    tact_volume_m3: number;
    t_window_hours: number;
    pumps_required: number;
    retarder_required: boolean;
    backup_pump: boolean;
    pour_hours_per_tact: number;
    total_pour_hours: number;
    scheduling_mode: 'linear' | 'chess';
    cure_between_neighbors_h: number;
    warnings: string[];
    decision_log: string[];
}
/** Maximum continuous pour window (hours) by season and retarder */
export declare const T_WINDOW_HOURS: Record<SeasonMode, {
    no_retarder: number;
    with_retarder: number;
}>;
export interface ElementDefaults {
    typical_has_spary: boolean | 'depends';
    typical_sub_mode: SectionalSubMode | null;
    typical_spara_spacing_m: number | null;
    description_cs: string;
}
export declare const ELEMENT_DEFAULTS: Record<StructuralElementType, ElementDefaults>;
export declare function decidePourMode(input: PourDecisionInput): PourDecisionOutput;
