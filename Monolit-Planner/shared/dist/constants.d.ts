/**
 * Monolit Planner - Constants
 * Default values and configuration
 */
export declare const DEFAULT_CONFIG: {
    ROUNDING_STEP_KROS: number;
    RHO_T_PER_M3: number;
    LOCALE: string;
    CURRENCY: string;
    DAYS_PER_MONTH_OPTIONS: number[];
    DAYS_PER_MONTH_DEFAULT: number;
    DEFAULT_CREW_SIZE: number;
    DEFAULT_WAGE_CZK_PH: number;
    DEFAULT_SHIFT_HOURS: number;
    DEFAULT_DAYS: number;
};
export declare const FEATURE_FLAGS: {
    FF_AI_DAYS_SUGGEST: boolean;
    FF_PUMP_MODULE: boolean;
    FF_ADVANCED_METRICS: boolean;
    FF_DARK_MODE: boolean;
    FF_SPEED_ANALYSIS: boolean;
};
export declare const COLORS: {
    LIGHT_CONCRETE: string;
    MEDIUM_CONCRETE: string;
    DIVIDER_BORDER: string;
    PRIMARY_ACTION: string;
    SECONDARY: string;
    SUCCESS: string;
    ERROR: string;
    INFO: string;
    INPUT_BG: string;
    INPUT_BG_LIGHT: string;
    INPUT_BORDER: string;
    INPUT_FOCUS: string;
    TEXT_PRIMARY: string;
    TEXT_SECONDARY: string;
    TEXT_DISABLED: string;
    WHITE: string;
    LIGHT_BG: string;
    COMPUTED_CELLS: string;
    RFI_WARNING: string;
    HIGHLIGHT_ROW: string;
    KROS_SUCCESS_BG: string;
};
export declare const SUBTYPE_ICONS: {
    beton: string;
    bednění: string;
    odbednění: string;
    výztuž: string;
    zrání: string;
    jiné: string;
};
/**
 * Human-readable labels for subtypes (what shows in UI)
 * Key: internal subtype value (used in data)
 * Value: display name for UI
 */
export declare const SUBTYPE_LABELS: {
    beton: string;
    bednění: string;
    odbednění: string;
    výztuž: string;
    zrání: string;
    jiné: string;
};
export declare const UNIT_LABELS: {
    M3: string;
    m2: string;
    kg: string;
    ks: string;
    t: string;
    other: string;
};
