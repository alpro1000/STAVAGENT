/**
 * Monolit Planner - Constants
 * Default values and configuration
 */

export const DEFAULT_CONFIG = {
  ROUNDING_STEP_KROS: 50,
  RHO_T_PER_M3: 2.4,
  LOCALE: 'cs-CZ',
  CURRENCY: 'CZK',
  DAYS_PER_MONTH_OPTIONS: [30, 22],
  DAYS_PER_MONTH_DEFAULT: 30,

  // Default position values
  DEFAULT_CREW_SIZE: 4,
  DEFAULT_WAGE_CZK_PH: 398,
  DEFAULT_SHIFT_HOURS: 10,
  DEFAULT_DAYS: 0
};

export const FEATURE_FLAGS = {
  FF_AI_DAYS_SUGGEST: true,  // ✅ AI-powered days estimation (Time Norms Automation)
  FF_PUMP_MODULE: false,
  FF_ADVANCED_METRICS: false,
  FF_DARK_MODE: false,
  FF_SPEED_ANALYSIS: false
};

export const COLORS = {
  // Concrete palette
  LIGHT_CONCRETE: '#F5F5F5',
  MEDIUM_CONCRETE: '#E8E8E8',
  DIVIDER_BORDER: '#D0D0D0',

  // Accent colors
  PRIMARY_ACTION: '#1E5A96',
  SECONDARY: '#F39C12',
  SUCCESS: '#27AE60',
  ERROR: '#E74C3C',
  INFO: '#3498DB',

  // Input cells (orange/apricot)
  INPUT_BG: '#FFA726',
  INPUT_BG_LIGHT: '#FFB74D',
  INPUT_BORDER: '#FF9800',
  INPUT_FOCUS: '#FF7043',

  // Text
  TEXT_PRIMARY: '#2C3E50',
  TEXT_SECONDARY: '#7F8C8D',
  TEXT_DISABLED: '#BDC3C7',

  // Backgrounds
  WHITE: '#FFFFFF',
  LIGHT_BG: '#FAFAFA',

  // Table
  COMPUTED_CELLS: '#F0F0F0',
  RFI_WARNING: '#FEE8E8',
  HIGHLIGHT_ROW: '#E3F2FD',
  KROS_SUCCESS_BG: '#F0FFF4'
};

export const SUBTYPE_ICONS = {
  'beton': '🪨',
  'bednění': '📦',
  'oboustranné (opěry)': '🏗️',
  'oboustranné (křídla)': '🪽',
  'oboustranné (závěrné zídky)': '🧱',
  'výztuž': '🛠️',
  'jiné': '📋'
};

/**
 * Human-readable labels for subtypes (what shows in UI)
 * Key: internal subtype value (used in data)
 * Value: display name for UI
 */
export const SUBTYPE_LABELS = {
  'beton': 'Betonování',
  'bednění': 'Bednění',
  'oboustranné (opěry)': 'Oboustranné (opěry)',
  'oboustranné (křídla)': 'Oboustranné (křídla)',
  'oboustranné (závěrné zídky)': 'Oboustranné (závěrné zídky)',
  'výztuž': 'Výztuž',
  'jiné': 'Jiné'
};

export const UNIT_LABELS = {
  'M3': 'm³',
  'm2': 'm²',
  'kg': 'kg',
  'ks': 'ks',
  't': 't',
  'other': ''
};
