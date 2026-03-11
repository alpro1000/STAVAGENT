export const QUICK_ACTIONS = [
  {
    id: 'audit',
    label: 'Audit pozice',
    description: 'Zkontroluj všechny pozice podle norem a katalogů',
    type: 'prompt',
    promptMessage: 'Mohu provést audit pozic. Co chcete zkontrolovat?',
    examples: [
      'Audit všech pozic v projektu',
      'Zkontroluj pozici 123 podle ÚRS',
      'Ověř soulad s normami ČSN'
    ],
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
      'Výkaz výměr pro celý projekt',
      'Detailní popis pozice 45.3'
    ],
    color: 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200',
    icon: '📋',
  },
  {
    id: 'materials',
    label: 'Materiály',
    description: 'Analýza materiálů a spotřeby',
    type: 'prompt',
    promptMessage: 'Mohu analyzovat materiály. Co chcete vědět?',
    examples: [
      'Materiály pro pozici 123',
      'Celkový přehled materiálů projektu',
      'Spotřeba betonu C30/37 pro sloupy'
    ],
    color: 'bg-orange-100 text-orange-700 hover:bg-orange-200',
    icon: '🧱',
  },
  {
    id: 'resources',
    label: 'Přehled zdrojů',
    description: 'Analýza pracovních zdrojů po pozicích',
    type: 'prompt',
    promptMessage: 'Mohu vypracovat přehled zdrojů. Uveďte prosím:',
    examples: [
      'Přehled zdrojů pro pozici 123',
      'Zdroje práce pro všechny sloupy',
      'Časový odhad pro pozici 45.3'
    ],
    color: 'bg-green-100 text-green-700 hover:bg-green-200',
    icon: '⚙️',
  },
  {
    id: 'summary',
    label: 'Souhrn projektu',
    description: 'Souhrnná zpráva projektu',
    type: 'prompt',
    promptMessage: 'Mohu vytvořit souhrn projektu. Co zahrnout?',
    examples: [
      'Kompletní souhrn projektu',
      'KPI a statistiky projektu',
      'Rekapitulace nákladů a zdrojů'
    ],
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
