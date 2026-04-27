/**
 * ContextBar — Row 4 of the ribbon layout.
 *
 * Breadcrumb on the left ("Project · Sheet · N položek") + 4 chip
 * actions on the right: Portal link, Upravit mapování (re-import),
 * AI Klasifikace (chip → popover), Skupiny (chip → popover).
 *
 * Owns which chip's popover is currently open. Only one popover at a
 * time — clicking a different chip closes the previous one. Clicking
 * the open chip closes it. Click-outside / Escape / scroll-outside
 * all route through `ChipPopover`'s own dismiss wiring.
 *
 * The AI + Groups popovers render the existing AIPanel / GroupManager
 * components in `variant='popover'` mode — no new business logic in
 * this file, just composition.
 */

import { useRef, useState } from 'react';
import { ChevronRight, FolderOpen, Link as LinkIcon, Settings, Sparkles } from 'lucide-react';
import type { Project, Sheet, ParsedItem } from '../types';
import { ChipButton } from './ChipButton';
import { ChipPopover } from './ChipPopover';
import { AIPanel } from '../components/ai/AIPanel';
import { GroupManager } from '../components/groups/GroupManager';

type PopoverName = 'ai' | 'groups' | null;

export interface ContextBarProps {
  project: Project;
  sheet: Sheet;
  items: ParsedItem[];
  selectedItemIds: Set<string>;
  onEditMapping: () => void;
}

export function ContextBar({
  project,
  sheet,
  items,
  selectedItemIds,
  onEditMapping,
}: ContextBarProps) {
  const [openPopover, setOpenPopover] = useState<PopoverName>(null);
  const aiChipRef = useRef<HTMLButtonElement>(null);
  const groupsChipRef = useRef<HTMLButtonElement>(null);

  // Derived stats shown as chip badges. Kept inline (cheap) rather
  // than memoized because the parent re-renders on every items
  // change anyway, so a ~405-element filter twice wouldn't move the
  // needle on a 60 Hz budget.
  const mainItemsCount = items.filter((i) => !!i.kod && i.kod.trim().length > 0).length;
  const classifiedMainCount = items.filter(
    (i) => !!i.kod && i.kod.trim().length > 0 && !!i.skupina,
  ).length;
  const groupsInItems = new Set<string>();
  for (const it of items) {
    if (it.skupina) groupsInItems.add(it.skupina);
  }
  const itemsWithGroup = items.filter((i) => !!i.skupina).length;

  const isPortalLinked = !!project.portalLink?.portalProjectId;

  const toggle = (name: PopoverName) => {
    setOpenPopover((curr) => (curr === name ? null : name));
  };
  const close = () => setOpenPopover(null);

  return (
    <div
      className="h-10 flex items-center px-4 gap-4 border-b flex-shrink-0"
      style={{
        background: 'var(--flat-surface)',
        borderColor: 'var(--flat-border)',
      }}
    >
      {/* Left: breadcrumb */}
      <div
        className="flex items-center gap-2 text-[13px] min-w-0"
        style={{ fontFamily: 'var(--font-body)' }}
      >
        <span
          className="font-semibold truncate max-w-[300px]"
          style={{ color: 'var(--flat-text)' }}
          title={project.projectName}
        >
          {project.projectName}
        </span>
        <ChevronRight
          size={12}
          className="w-[12px] h-[12px] flex-shrink-0"
          style={{ color: 'var(--flat-text-label)' }}
        />
        <span
          className="truncate max-w-[200px]"
          style={{ color: 'var(--flat-text)' }}
          title={sheet.name}
        >
          {sheet.name}
        </span>
        <span
          className="text-[11px] tabular-nums whitespace-nowrap hidden md:inline"
          style={{ color: 'var(--flat-text-label)' }}
        >
          · {items.length} položek
        </span>
      </div>

      {/* Right: chip actions */}
      <div className="flex items-center gap-2 ml-auto flex-shrink-0">
        <ChipButton
          icon={LinkIcon}
          label="Portal"
          variant={isPortalLinked ? 'active-green' : 'muted'}
          title={isPortalLinked ? 'Projekt je propojený se Stavagent Portalem' : 'Projekt není propojen s Portalem'}
        />
        <ChipButton
          icon={Settings}
          label="Upravit mapování"
          onClick={onEditMapping}
          title="Upravit mapování sloupců a reimportovat"
        />
        <ChipButton
          ref={aiChipRef}
          icon={Sparkles}
          label="AI Klasifikace"
          badge={selectedItemIds.size > 0 ? `${selectedItemIds.size} vybráno` : `${classifiedMainCount}/${mainItemsCount}`}
          hasDropdown
          pressed={openPopover === 'ai'}
          onClick={() => toggle('ai')}
        />
        <ChipButton
          ref={groupsChipRef}
          icon={FolderOpen}
          label="Skupiny"
          badge={`${groupsInItems.size} · ${itemsWithGroup}`}
          hasDropdown
          pressed={openPopover === 'groups'}
          onClick={() => toggle('groups')}
        />
      </div>

      {/* Popovers — portaled to document.body; only one open at a time. */}
      <ChipPopover
        anchorRef={aiChipRef}
        open={openPopover === 'ai'}
        onClose={close}
        width={520}
        maxHeight={600}
        resizable
      >
        <AIPanel
          items={items}
          projectId={project.id}
          sheetId={sheet.id}
          selectedItemIds={Array.from(selectedItemIds)}
          variant="popover"
        />
      </ChipPopover>
      <ChipPopover
        anchorRef={groupsChipRef}
        open={openPopover === 'groups'}
        onClose={close}
        // Wider default + drag-resize so long skupina names (e.g.
        // "BEDNĚNÍ PILÍŘŮ HORNÍ STAVBY") are readable. User can
        // drag the bottom-right corner up to ~viewport size; min
        // stays at the configured 640 px.
        width={640}
        maxHeight={600}
        resizable
      >
        <GroupManager variant="popover" />
      </ChipPopover>
    </div>
  );
}
