export const QUICK_ACTIONS = [
  {
    id: 'audit',
    label: '✅ Audit pozice',
    description: 'Zkontroluj všechny pozice podle norem a katalogů',
    apiAction: 'audit_positions',
    color: 'bg-blue-100 text-blue-700 hover:bg-blue-200',
    icon: '✅',
  },
  {
    id: 'materials',
    label: '🧱 Materiály',
    description: 'Shrnutí použitých materiálů a dodavatelů',
    apiAction: 'materials_summary',
    color: 'bg-orange-100 text-orange-700 hover:bg-orange-200',
    icon: '🧱',
  },
  {
    id: 'resources',
    label: '⚙️ Zdroje',
    description: 'Výpočet lidských i strojních kapacit',
    apiAction: 'calculate_resources',
    color: 'bg-green-100 text-green-700 hover:bg-green-200',
    icon: '⚙️',
  },
  {
    id: 'breakdown',
    label: '📊 Rozebrat',
    description: 'Rozpad pozic a struktur projektu',
    apiAction: 'position_breakdown',
    color: 'bg-purple-100 text-purple-700 hover:bg-purple-200',
    icon: '📊',
  },
];

export const ARTIFACT_TYPES = {
  AUDIT_RESULT: 'audit_result',
  MATERIALS_SUMMARY: 'materials_summary',
  MATERIALS_DETAILED: 'materials_detailed',
  RESOURCES_CALC: 'resources_calc',
  RESOURCE_SHEET: 'resource_sheet',
  POSITION_BREAKDOWN: 'position_breakdown',
  VYKAZ_VYMER: 'vykaz_vymer',
  MATERIALS_DETAILED_LEGACY: 'materials_detailed',
  PROJECT_SUMMARY: 'project_summary',
  TECH_CARD: 'tech_card',
};

export const STATUS_COLORS = {
  GREEN: 'bg-green-50 text-green-700 border-green-300',
  AMBER: 'bg-yellow-50 text-yellow-700 border-yellow-300',
  RED: 'bg-red-50 text-red-700 border-red-300',
};

export const MESSAGE_TYPES = {
  USER: 'user',
  AI: 'ai',
  SYSTEM: 'system',
};

export const THEMES = {
  LIGHT: 'light',
  DARK: 'dark',
};

export const PROJECT_STATUSES = {
  UPLOADED: 'UPLOADED',
  AUDITED: 'AUDITED',
  EXPORTED: 'EXPORTED',
  ERROR: 'ERROR',
};
