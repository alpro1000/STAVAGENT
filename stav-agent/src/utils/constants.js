export const QUICK_ACTIONS = [
  {
    id: 'audit',
    label: 'Audit pozice',
    description: 'Zkontroluj všechny pozice podle norem a katalogů',
    type: 'action',
    apiAction: 'audit_positions',
    color: 'bg-blue-100 text-blue-700 hover:bg-blue-200',
    icon: '✅',
  },
  {
    id: 'vykaz',
    label: 'Výkaz výměr',
    description: 'Analýza pozic z výkazu',
    type: 'prompt',
    promptMessage: 'Mohu analyzovat výkaz výměr. Co potřebujete?',
    examples: [
      'Technická karta pro pozici 123',
      'Výkaz pro celý projekt',
      'Detail pozice 45.3'
    ],
    color: 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200',
    icon: '📋',
  },
  {
    id: 'materials',
    label: 'Materiály',
    description: 'Analýza materiálů a spotřeby',
    type: 'prompt',
    promptMessage: 'Mohu analyzovat materiály. Příklady dotazů:',
    examples: [
      'Materiály pro pozici 123',
      'Celkový přehled materiálů',
      'Spotřeba betonu C30/37'
    ],
    color: 'bg-orange-100 text-orange-700 hover:bg-orange-200',
    icon: '🧱',
  },
  {
    id: 'resources',
    label: 'Zdroje',
    description: 'Analýza pracovních zdrojů',
    type: 'prompt',
    promptMessage: 'Mohu analyzovat pracovní zdroje. Co chcete vědět?',
    examples: [
      'Zdroje pro pozici 123',
      'Celkové hodiny práce',
      'Potřeba pracovníků'
    ],
    color: 'bg-green-100 text-green-700 hover:bg-green-200',
    icon: '⚙️',
  },
  {
    id: 'summary',
    label: 'Souhrn projektu',
    description: 'Souhrn projektu a KPI',
    type: 'action',
    apiAction: 'project_summary',
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
