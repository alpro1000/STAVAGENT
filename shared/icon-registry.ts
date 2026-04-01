/**
 * STAVAGENT Icon Registry (Lucide React)
 *
 * Unified icon reference for all kiosks.
 * Library: lucide-react@latest (v1+).
 *
 * Usage:
 *   import { ICONS } from '@/shared/icon-registry'
 *   import * as LucideIcons from 'lucide-react'
 *
 *   const Icon = LucideIcons[ICONS.nav.dashboard]
 *   <Icon size={20} />
 */

// ─── 2. Navigation ────────────────────────────────────────────────────────────

export const NAV_ICONS = {
  dashboard: 'LayoutDashboard',
  projects: 'FolderOpen',
  upload: 'Upload',
  documents: 'FileText',
  drawings: 'Ruler',
  boq: 'TableProperties',
  categories: 'Layers',
  search: 'Search',
  filter: 'Filter',
  history: 'History',
  logs: 'ScrollText',
  export: 'Download',
  settings: 'Settings',
  users: 'Users',
  knowledgeBase: 'BookOpen',
} as const;

// ─── 3. System Modules ───────────────────────────────────────────────────────

export const MODULE_ICONS = {
  documentAudit: 'FileSearch2',
  classifier: 'Tag',
  rozpocetRegistry: 'ListOrdered',
  projectSummary: 'FileBarChart',
  techCard: 'Workflow',
  tovResourceSheet: 'Package',
  materialLookup: 'Layers2',
  whatIf: 'GitBranch',
  normVsFirm: 'Scale',
  changesDiff: 'Diff',
  rfi: 'MessageCircleQuestion',
  auditTriage: 'FlagTriangleRight',
} as const;

// ─── 4. Monolith Planner ─────────────────────────────────────────────────────

export const PLANNER_ICONS = {
  main: 'Building2',
  concreteCalc: 'Calculator',
  elementPlanner: 'Grid3x3',
  segments: 'LayoutPanelLeft',
  workPackages: 'Package2',
  gantt: 'GanttChart',
  dependencyGraph: 'Network',
  crewPlanning: 'HardHat',
  equipmentPlanning: 'Forklift',
  concreteMaturity: 'Timer',
} as const;

// ─── 5a. Monolith (concrete works) ──────────────────────────────────────────

export const MONOLITH_ICONS = {
  concrete: 'Hexagon',
  rebar: 'GripHorizontal',
  formwork: 'SquareDashed',
  concretePump: 'GitMerge',
  crane: 'ArrowUpFromLine',
  constructionJoint: 'SeparatorHorizontal',
  pour: 'Droplet',
  compaction: 'Activity',
  curing: 'Hourglass',
  stripping: 'SquareX',
} as const;

// ─── 5b. General Construction ────────────────────────────────────────────────

export const GENERAL_CONSTRUCTION_ICONS = {
  earthworks: 'Shovel',
  excavation: 'ArrowDownToLine',
  backfill: 'ArrowUpToLine',
  demolition: 'Pickaxe',
  masonry: 'BrickWall',
  steelWorks: 'Wrench',
  insulation: 'Shield',
  waterproofing: 'Waves',
  thermalInsulation: 'ThermometerSnowflake',
} as const;

// ─── 5c. MEP (Engineering) ──────────────────────────────────────────────────

export const MEP_ICONS = {
  hvac: 'AirVent',
  electrical: 'Zap',
  plumbing: 'GitCommitVertical',
  fireProtection: 'FlameKindling',
  cctv: 'Camera',
} as const;

// ─── 5d. Infrastructure ─────────────────────────────────────────────────────

export const INFRA_ICONS = {
  railway: 'TrainTrack',
  bridge: 'Waypoints',
  railTrack: 'Milestone',
  cableRoutes: 'Cable',
  drainage: 'Funnel',
  gabion: 'Grid2x2',
  finishing: 'PaintRoller',
} as const;

// ─── 6. Files ───────────────────────────────────────────────────────────────

export const FILE_ICONS = {
  excel: 'FileSpreadsheet',
  pdf: 'FileType2',
  xml: 'FileCode',
  dwg: 'PenTool',
  ifc: 'Box',
  zip: 'FileArchive',
  uploadComplete: 'CheckCircle',
  parsedOk: 'ScanCheck',
  ocrUsed: 'ScanText',
  ocrLowConfidence: 'ScanSearch',
  scaleVerified: 'Move3d',
  catalogLinked: 'Database',
  catalogMissing: 'DatabaseOff',
} as const;

// ─── 7. Statuses ────────────────────────────────────────────────────────────

export const STATUS_ICONS = {
  verified: 'CircleCheckBig',
  inProgress: 'LoaderCircle',
  draft: 'Pencil',
  needsAttention: 'TriangleAlert',
  error: 'OctagonX',
  insufficientData: 'CircleDashed',
  manualReview: 'UserCheck',
  autoCalc: 'Sparkles',
  manualOverride: 'Hand',
  locked: 'Lock',
  archived: 'Archive',
} as const;

// ─── 8. Triage Markers ─────────────────────────────────────────────────────

export const TRIAGE_ICONS = {
  green: 'CircleCheck',
  amber: 'TriangleAlert',
  red: 'CircleX',
  exactMatch: 'Crosshair',
  partialMatch: 'Target',
  noMatch: 'CircleMinus',
  priceMissing: 'BadgeDollarSign',
  unitMismatch: 'Ruler',
  ocrLow: 'ScanSearch',
  catalogMissing: 'DatabaseOff',
  methodMismatch: 'Shuffle',
  missingDims: 'BetweenHorizontalEnd',
} as const;

// ─── 9. Actions ─────────────────────────────────────────────────────────────

export const ACTION_ICONS = {
  add: 'PlusCircle',
  edit: 'Pencil',
  delete: 'Trash2',
  duplicate: 'Copy',
  linkToPosition: 'Link',
  deepLink: 'ExternalLink',
  recalculate: 'RefreshCw',
  updateFromFile: 'FileSync',
  compareVersions: 'GitCompare',
  exportXlsx: 'FileSpreadsheet',
  exportPdf: 'FileDown',
  downloadJson: 'Braces',
  share: 'Send',
} as const;

// ─── 10. Roles ──────────────────────────────────────────────────────────────

export const ROLE_ICONS = {
  sme: 'Coins',
  architect: 'Compass',
  engineer: 'Cpu',
  supervisor: 'ClipboardList',
  consensus: 'Handshake',
  disagreement: 'GitPullRequestClosed',
  hitlRequired: 'UserRoundCog',
} as const;

// ─── 11. Misc ───────────────────────────────────────────────────────────────

export const MISC_ICONS = {
  supplier: 'Factory',
  priceSource: 'Banknote',
  region: 'MapPin',
  calendarRange: 'CalendarRange',
  nightShift: 'Moon',
  weatherRisk: 'CloudRainWind',
  safety: 'ShieldAlert',
  qaQc: 'ClipboardCheck',
  certificate: 'BadgeCheck',
  version: 'GitCommitVertical',
  benchmark: 'ChartNoAxesCombined',
  optimization: 'Zap',
  costDelta: 'TrendingUp',
  timeDelta: 'ClockArrowUp',
} as const;

// ─── Unified Export ─────────────────────────────────────────────────────────

export const ICONS = {
  nav: NAV_ICONS,
  module: MODULE_ICONS,
  planner: PLANNER_ICONS,
  monolith: MONOLITH_ICONS,
  generalConstruction: GENERAL_CONSTRUCTION_ICONS,
  mep: MEP_ICONS,
  infra: INFRA_ICONS,
  file: FILE_ICONS,
  status: STATUS_ICONS,
  triage: TRIAGE_ICONS,
  action: ACTION_ICONS,
  role: ROLE_ICONS,
  misc: MISC_ICONS,
} as const;

// ─── Type Helpers ───────────────────────────────────────────────────────────

/** All valid Lucide component names used in this registry */
type IconMap = typeof ICONS;
export type IconName = {
  [C in keyof IconMap]: IconMap[C][keyof IconMap[C]];
}[keyof IconMap];

/** Category keys */
export type IconCategory = keyof typeof ICONS;
