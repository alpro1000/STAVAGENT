/**
 * RibbonLayout — full 5-row composition for the ribbon-style main
 * content area. Host (App.tsx) gates rendering behind the
 * `useRibbonFlag()` flag from `ribbonFeatureFlag.ts`; when the flag is
 * on this component replaces the legacy layout end-to-end.
 *
 *   Row 1:  AppRibbon        — brand + search + global actions
 *   Row 2:  ProjectTabsBar   — project tab strip + add/delete
 *   Row 3:  SheetTabsBar     — sheet tab strip (for active project)
 *   Row 4:  ContextBar       — breadcrumb + chip actions + popovers
 *   Row 5+: children          — the ItemsTable, rendered by the host
 *
 * Each row is `flex-shrink-0`; the `children` slot is `flex-1 min-h-0`
 * so the table fills remaining viewport height. Unlike the earlier
 * flex-chain attempt (#1016), no parent attempts to cap the outer
 * height — the host page still scrolls if the children overflow,
 * consistent with the quick-fix #1020 behavior.
 */

import { type ReactNode } from 'react';
import type { Project, Sheet, ParsedItem } from '../types';
import type { SearchFilters } from '../services/search/searchService';
import { AppRibbon } from './AppRibbon';
import { ProjectTabsBar } from './ProjectTabsBar';
import { SheetTabsBar } from './SheetTabsBar';
import { ContextBar } from './ContextBar';

export interface RibbonLayoutProps {
  projects: Project[];
  activeProject: Project | null;
  activeSheet: Sheet | null;
  items: ParsedItem[];
  selectedItemIds: Set<string>;
  onSelectProject: (projectId: string) => void;
  onRemoveProject: (projectId: string) => void;
  onRemoveAllProjects: () => void;
  onAddProject: () => void;
  onSelectSheet: (sheetId: string) => void;
  onSearch: (query: string, filters: SearchFilters) => void;
  onClearSearch: () => void;
  onOpenPriceRequest: () => void;
  onExport: () => void;
  onImport: () => void;
  onEditMapping: () => void;
  /** The ItemsTable (or any other body content) rendered below the ribbon. */
  children: ReactNode;
}

export function RibbonLayout({
  projects,
  activeProject,
  activeSheet,
  items,
  selectedItemIds,
  onSelectProject,
  onRemoveProject,
  onRemoveAllProjects,
  onAddProject,
  onSelectSheet,
  onSearch,
  onClearSearch,
  onOpenPriceRequest,
  onExport,
  onImport,
  onEditMapping,
  children,
}: RibbonLayoutProps) {
  const hasProjects = projects.length > 0;

  return (
    <div className="flex flex-col min-h-0">
      <AppRibbon
        onSearch={onSearch}
        onClearSearch={onClearSearch}
        onOpenPriceRequest={onOpenPriceRequest}
        onExport={onExport}
        onImport={onImport}
        hasProjects={hasProjects}
      />
      {hasProjects && (
        <ProjectTabsBar
          projects={projects}
          activeProjectId={activeProject?.id ?? null}
          onSelect={onSelectProject}
          onRemove={onRemoveProject}
          onAdd={onAddProject}
          onRemoveAll={onRemoveAllProjects}
        />
      )}
      {activeProject && (
        <SheetTabsBar
          sheets={activeProject.sheets}
          activeSheetId={activeSheet?.id ?? null}
          onSelect={onSelectSheet}
        />
      )}
      {activeProject && activeSheet && (
        <ContextBar
          project={activeProject}
          sheet={activeSheet}
          items={items}
          selectedItemIds={selectedItemIds}
          onEditMapping={onEditMapping}
        />
      )}

      {/* Body — ItemsTable (or empty-state) rendered by the host. */}
      <div className="flex-1 min-h-0 flex flex-col p-3 gap-3">
        {children}
      </div>
    </div>
  );
}
