/**
 * ImportModal Component
 * Modal pro import Excel souborů
 */

import { useState, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ResizableModal } from '../ui/ResizableModal';
import { FileUploader } from './FileUploader';
import { ConfigEditor } from '../config/ConfigEditor';
import { readExcelFile, getSheetNames, parseExcelSheet } from '../../services/parser/excelParser';
import { detectExcelStructure, detectAllSheetsStartRows, type DetectionResult } from '../../services/autoDetect/structureDetector';
import { classifyItems, applyClassificationsWithCascade } from '../../services/classification/classificationService';
import { classifyRows } from '../../services/classification/rowClassificationService';
import { classifySheet } from '../../services/classification/rowClassifierV2';
import {
  extractRawRows,
  getTemplateHint,
  mergeV2IntoParsedItems,
  appendMissingSubordinates,
  summarizeV2Result,
} from '../../services/classification/importAdapter';
import { useRegistryStore } from '../../stores/registryStore';
import { getDefaultTemplate } from '../../config/templates';
import { defaultImportConfig } from '../../config/defaultConfig';
import { storeOriginalFile, getOriginalFile } from '../../services/originalFileStore';
import { saveProjectMapping } from '../../services/excel/mappingStore';
import { createProjectMapping } from '../../services/excel/excelMapper';
import type { Project, Sheet } from '../../types';
import type { ImportTemplate } from '../../types/template';
import type { ImportConfig } from '../../types/config';
import { AlertCircle, Loader2, CheckCircle } from 'lucide-react';
import { RawExcelViewer } from './RawExcelViewer';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Reimport mode: pre-fill with existing project data */
  reimportProject?: Project;
}

type Step = 'upload' | 'template' | 'custom-config' | 'sheet' | 'parsing' | 'raw-view' | 'success';

export function ImportModal({ isOpen, onClose, reimportProject }: ImportModalProps) {
  const { addProject, addTemplate, replaceProjectSheets } = useRegistryStore();
  const existingProjects = useRegistryStore(s => s.projects);

  /**
   * P2.2 (2026-04-15): dedupe on import. When a project with the same
   * name already exists, prompt the user to either UPDATE it (reuse
   * the id and call replaceProjectSheets) or create a fresh one. This
   * fixes the "39 duplicate D6 projects" issue where every re-import
   * of the same Excel spawned a new project because addProject() had
   * no deduplication.
   *
   * Returns { action, projectId }:
   *   - 'create': user picked "Nový" → use the fresh projectId
   *   - 'update': user picked "Aktualizovat" → use the existing id
   *   - 'cancel': user dismissed the dialog
   */
  const resolveDuplicate = (newProjectName: string, newProjectId: string):
    { action: 'create' | 'update' | 'cancel'; projectId: string } => {
    const dupe = existingProjects.find(
      p => p.projectName.trim().toLowerCase() === newProjectName.trim().toLowerCase()
    );
    if (!dupe) return { action: 'create', projectId: newProjectId };
    const label = `Projekt "${dupe.projectName}" už existuje ` +
      `(${dupe.sheets.length} listů, importovaný ${new Date(dupe.importedAt).toLocaleDateString('cs-CZ')}).\n\n` +
      `OK = AKTUALIZOVAT existující (přepíše obsah)\n` +
      `Zrušit = VYTVOŘIT NOVÝ (duplikát)`;
    const updateExisting = window.confirm(label);
    if (updateExisting) return { action: 'update', projectId: dupe.id };
    // User dismissed → create a fresh project with the random id
    return { action: 'create', projectId: newProjectId };
  };

  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [workbook, setWorkbook] = useState<any>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState<ImportTemplate>(getDefaultTemplate());
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Multiple sheets import
  const [importMode, setImportMode] = useState<'single' | 'multiple'>('single');
  const [selectedSheets, setSelectedSheets] = useState<string[]>([]);
  const [applyTemplateToAll, setApplyTemplateToAll] = useState(true); // Apply same template to all sheets

  // Custom template creation state
  const [customTemplateName, setCustomTemplateName] = useState('');
  const [customTemplateDescription, setCustomTemplateDescription] = useState('');
  const [customConfig, setCustomConfig] = useState<Partial<ImportConfig>>({
    ...defaultImportConfig,
    sheetName: sheetNames[0] || '',
    sheetIndex: 0,
  });

  // Auto-detection state
  const [detectionResults, setDetectionResults] = useState<DetectionResult[] | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);

  // Auto-classification state
  const [autoClassify, setAutoClassify] = useState(true); // enabled by default

  // Per-sheet dataStartRow overrides: sheetName → { row, confidence, reason }
  const [perSheetStartRows, setPerSheetStartRows] = useState<
    Record<string, { dataStartRow: number; confidence: 'high' | 'medium' | 'low'; reason: string }>
  >({});

  // Store original file data for "return to original" export
  const originalFileData = useRef<ArrayBuffer | null>(null);

  // Auto-detect per-sheet start rows when workbook & sheet selection changes
  const runPerSheetDetection = (wb: any, sheets: string[]) => {
    if (!wb || sheets.length === 0) return;
    const detected = detectAllSheetsStartRows(wb, sheets);
    setPerSheetStartRows(detected);
  };

  // Reimport mode: load original file and pre-fill config
  const isReimport = !!reimportProject;

  useEffect(() => {
    if (!reimportProject || !isOpen) return;

    (async () => {
      try {
        const originalFile = await getOriginalFile(reimportProject.id);
        if (!originalFile) {
          setError('Originální soubor nenalezen. Reimport není možný.');
          return;
        }

        originalFileData.current = originalFile.fileData;
        const wb = await readExcelFile(new File(
          [originalFile.fileData],
          originalFile.fileName,
          { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
        ));
        const sheets = getSheetNames(wb);

        setFile(new File([originalFile.fileData], originalFile.fileName));
        setWorkbook(wb);
        setSheetNames(sheets);

        // Pre-fill from existing project config
        const existingSheetNames = reimportProject.sheets.map(s => s.name);
        const availableSheets = sheets.filter(s => existingSheetNames.includes(s));
        const sheetsToSelect = availableSheets.length > 0 ? availableSheets : sheets;

        if (sheetsToSelect.length > 1) {
          setImportMode('multiple');
          setSelectedSheets(sheetsToSelect);
        } else {
          setImportMode('single');
          setSelectedSheet(sheetsToSelect[0] || sheets[0]);
        }

        // Pre-fill per-sheet start rows from existing configs
        const existingStartRows: Record<string, { dataStartRow: number; confidence: 'high' | 'medium' | 'low'; reason: string }> = {};
        for (const sheet of reimportProject.sheets) {
          existingStartRows[sheet.name] = {
            dataStartRow: sheet.config?.dataStartRow || 2,
            confidence: 'high',
            reason: 'Z předchozího importu',
          };
        }
        // Detect for any new sheets not in existing config
        const detected = detectAllSheetsStartRows(wb, sheets);
        setPerSheetStartRows({ ...detected, ...existingStartRows });

        // Use config from first sheet as template
        if (reimportProject.sheets[0]?.config) {
          const existingConfig = reimportProject.sheets[0].config;
          setSelectedTemplate({
            ...getDefaultTemplate(),
            config: existingConfig,
          });
        }

        setStep('sheet');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Chyba při načítání souboru pro reimport');
      }
    })();
  }, [reimportProject, isOpen]);

  const handleFileSelect = async (selectedFile: File) => {
    setError(null);
    setIsLoading(true);

    try {
      // Store original file data for "return to original" export
      const fileBuffer = await selectedFile.arrayBuffer();
      originalFileData.current = fileBuffer;

      const wb = await readExcelFile(selectedFile);
      const sheets = getSheetNames(wb);

      if (sheets.length === 0) {
        throw new Error('Soubor neobsahuje žádné listy.');
      }

      // Фильтруем ненужные листы (Рекапитуляция и др.)
      const filteredSheets = sheets.filter(sheetName => {
        const normalized = sheetName.toLowerCase().trim();
        // Исключаем листы с рекапитуляцией, титульным листом и др.
        return !normalized.includes('рекапитуляц') &&
               !normalized.includes('rekapitulac') &&
               !normalized.includes('титул') &&
               !normalized.includes('titul') &&
               !normalized.includes('obsah') &&
               !normalized.includes('содержани');
      });

      if (filteredSheets.length === 0) {
        throw new Error('После фильтрации не осталось ни одного подходящего листа.');
      }

      setFile(selectedFile);
      setWorkbook(wb);
      setSheetNames(filteredSheets);
      setSelectedSheet(filteredSheets[0]);
      setStep('template'); // Changed from 'sheet' to add template selection step
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chyba při čtení souboru');
    } finally {
      setIsLoading(false);
    }
  };


  const handleSaveCustomTemplate = () => {
    // Validate
    if (!customTemplateName.trim()) {
      setError('Zadejte název šablony');
      return;
    }

    // Create new template
    const newTemplate: ImportTemplate = {
      metadata: {
        id: `custom-${uuidv4()}`,
        name: customTemplateName.trim(),
        type: 'custom',
        description: customTemplateDescription.trim() || 'Vlastní šablona',
        icon: '✏️',
        createdAt: new Date(),
      },
      config: customConfig as ImportConfig,
      isBuiltIn: false,
      canEdit: true,
      canDelete: true,
    };

    // Add to store
    addTemplate(newTemplate);

    // Select this template and go to sheet selection
    setSelectedTemplate(newTemplate);
    setStep('sheet');
  };

  const handleCancelCustomTemplate = () => {
    setStep('template');
  };

  const handleAutoDetect = async () => {
    if (!workbook) return;

    setIsDetecting(true);
    setError(null);

    try {
      const results = await detectExcelStructure(workbook, selectedSheet || sheetNames[0]);
      setDetectionResults(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chyba při auto-detekci');
    } finally {
      setIsDetecting(false);
    }
  };

  const handleApplyDetectedTemplate = (result: DetectionResult) => {
    // Apply detected columns and startRow to the template config
    const updatedTemplate = {
      ...result.template,
      config: {
        ...result.template.config,
        columns: {
          ...result.template.config.columns,
          ...result.detectedColumns,
        },
        dataStartRow: result.detectedStartRow,
      },
    };
    setSelectedTemplate(updatedTemplate);
    setDetectionResults(null);
  };

  const handleImport = async () => {
    if (!file || !workbook || !selectedSheet || !selectedTemplate) return;

    setError(null);
    setIsLoading(true);

    try {
      // P2.2: new imports get a fresh uuid; reimports keep existing id.
      let projectId = isReimport ? reimportProject!.id : uuidv4();
      let isUpdate = isReimport;
      const sheetId = uuidv4();

      // Use per-sheet start row if available
      const sheetStartRow = perSheetStartRows[selectedSheet]?.dataStartRow;

      const result = await parseExcelSheet(workbook, {
        config: {
          ...selectedTemplate.config,
          sheetName: selectedSheet,
          ...(sheetStartRow ? { dataStartRow: sheetStartRow } : {}),
        },
        fileName: file.name,
        projectId,
      });

      if (result.warnings.length > 0) {
        setWarnings(result.warnings);
      }

      // Row classification FIRST: assign rowRole, parentItemId, boqLineNumber
      // (must run before cascade so cascade can use rowRole).
      // Legacy classifier runs to seed all fields; v1.1 classifier then
      // upgrades in place using raw rows from the workbook so rowRole /
      // parentItemId / sectionId / originalTyp / _rawCells are populated
      // deterministically for fresh imports. Any parser items without a
      // v2 match (alignment edge cases) keep the legacy classification.
      const rowClassification = classifyRows(result.items);
      const classifiedRowItems = rowClassification.items;

      const v2RawRows = extractRawRows(workbook, selectedSheet);
      const templateHint = getTemplateHint(selectedTemplate.metadata.type);
      const v2Result = classifySheet(v2RawRows, {
        sheetName: selectedSheet,
        templateHint,
        preserveRawCells: true,
      });
      mergeV2IntoParsedItems(classifiedRowItems, v2Result);
      // Append synthetic rows for v2 subordinates / sections / unknown
      // items without a matching parsed row. Parser's standard mode only
      // creates items for main-code rows; PP / VV / TS were absorbed
      // into popisDetail[]. This pass moves them into the store as
      // first-class rows so ItemsTable can render the parent/child tree.
      appendMissingSubordinates(classifiedRowItems, v2Result, {
        projectId,
        fileName: file.name,
        sheetName: selectedSheet,
      });
      const v2Summary = summarizeV2Result(v2Result, selectedSheet);
      if (v2Summary) {
        setWarnings(prev => [...prev, v2Summary]);
      }

      // Auto-classification (if enabled)
      if (autoClassify) {
        // Classify ONLY main items (with kod), not description rows
        const mainItems = classifiedRowItems.filter(item =>
          item.kod && item.kod.trim().length > 0
        );

        const classificationResult = classifyItems(mainItems, {
          overwrite: false,
          minConfidence: 50,
        });

        const classifications = new Map<string, any>();
        for (const res of classificationResult.results) {
          if (res.suggestedSkupina && res.confidence >= 50) {
            classifications.set(res.itemId, res.suggestedSkupina);
          }
        }

        // Cascade uses rowRole to propagate skupina to ALL subordinates
        applyClassificationsWithCascade(classifiedRowItems, classifications);
      }

      // Create sheet with items
      const classifiedItems = autoClassify
        ? classifiedRowItems.filter(item => item.skupina !== null).length
        : 0;

      const sheet: Sheet = {
        id: sheetId,
        name: selectedSheet,
        projectId,
        items: classifiedRowItems,
        stats: {
          totalItems: classifiedRowItems.length,
          classifiedItems,
          totalCena: classifiedRowItems.reduce((sum, item) => sum + (item.cenaCelkem || 0), 0),
        },
        metadata: result.metadata,
        config: {
          ...selectedTemplate.config,
          sheetName: selectedSheet,
        },
        classifierMapping: v2Result.mapping,
        classifierTemplateHint: templateHint,
      };

      // Create project with single sheet
      const projectName = file.name.replace(/\.(xlsx?|xls)$/i, '');

      // P2.2: before creating a fresh project, check for an existing
      // project with the same name and let the user pick update vs new.
      if (!isReimport) {
        const r = resolveDuplicate(projectName, projectId);
        if (r.action === 'cancel') {
          setIsLoading(false);
          return;
        }
        if (r.action === 'update') {
          projectId = r.projectId;
          isUpdate = true;
        }
      }
      // Rebuild the sheet with the (possibly-updated) projectId.
      const finalSheet: Sheet = { ...sheet, projectId };
      const project: Project = {
        id: projectId,
        fileName: file.name,
        projectName,
        filePath: '', // Browser-only, path nebude použit
        importedAt: new Date(),
        sheets: [finalSheet],
      };

      if (isUpdate) {
        replaceProjectSheets(projectId, [finalSheet]);
      } else {
        addProject(project);
      }

      // Store original file in IndexedDB for "return to original" export
      if (originalFileData.current) {
        storeOriginalFile(projectId, file.name, originalFileData.current).catch(err => {
          console.error('Failed to store original file:', err);
        });

        // Save project mapping for patch-based export
        try {
          const mapping = createProjectMapping(originalFileData.current, projectId, selectedSheet);
          await saveProjectMapping(mapping);
          console.log(`[Import] Saved mapping for project ${projectId}`);
        } catch (mappingErr) {
          console.error('Failed to save project mapping:', mappingErr);
          // Non-critical, continue
        }
      }

      setStep('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chyba při parsování');
    } finally {
      setIsLoading(false);
    }
  };

  // Import multiple sheets at once
  const handleImportMultiple = async () => {
    if (!file || !workbook || selectedSheets.length === 0 || !selectedTemplate) return;

    setError(null);
    setIsLoading(true);

    try {
      // P2.2: new imports get a fresh uuid; reimports keep existing id.
      let projectId = isReimport ? reimportProject!.id : uuidv4();
      let isUpdate = isReimport;
      const sheets: Sheet[] = [];
      const allWarnings: string[] = [];
      let errorCount = 0;

      // Process each sheet
      for (const sheetName of selectedSheets) {
        try {
          const sheetId = uuidv4();

          // Use per-sheet dataStartRow if available
          const sheetStartRow = perSheetStartRows[sheetName]?.dataStartRow;
          const sheetConfig = {
            ...selectedTemplate.config,
            sheetName,
            ...(sheetStartRow ? { dataStartRow: sheetStartRow } : {}),
          };

          const result = await parseExcelSheet(workbook, {
            config: sheetConfig,
            fileName: file.name,
            projectId,
          });

          if (result.warnings.length > 0) {
            allWarnings.push(...result.warnings.map(w => `[${sheetName}] ${w}`));
          }

          // Row classification FIRST (so cascade can use rowRole).
          // Legacy first, v1.1 upgrade in place — same pattern as
          // single-sheet branch above.
          const rowClassification = classifyRows(result.items);
          const classifiedRowItems = rowClassification.items;

          const v2RawRows = extractRawRows(workbook, sheetName);
          const templateHint = getTemplateHint(selectedTemplate.metadata.type);
          const v2Result = classifySheet(v2RawRows, {
            sheetName,
            templateHint,
            preserveRawCells: true,
          });
          mergeV2IntoParsedItems(classifiedRowItems, v2Result);
          // Append synthetic rows for v2 subordinates / sections / unknown
          // items without a matching parsed row — mirrors the single-sheet
          // branch above. See importAdapter.ts for rationale.
          appendMissingSubordinates(classifiedRowItems, v2Result, {
            projectId,
            fileName: file.name,
            sheetName,
          });
          const v2Summary = summarizeV2Result(v2Result, sheetName);
          if (v2Summary) {
            allWarnings.push(v2Summary);
          }

          // Auto-classification (if enabled)
          if (autoClassify) {
            const mainItems = classifiedRowItems.filter(item =>
              item.kod && item.kod.trim().length > 0
            );

            const classificationResult = classifyItems(mainItems, {
              overwrite: false,
              minConfidence: 50,
            });

            const classifications = new Map<string, any>();
            for (const res of classificationResult.results) {
              if (res.suggestedSkupina && res.confidence >= 50) {
                classifications.set(res.itemId, res.suggestedSkupina);
              }
            }

            applyClassificationsWithCascade(classifiedRowItems, classifications);
          }

          const classifiedItems = autoClassify
            ? classifiedRowItems.filter(item => item.skupina !== null).length
            : 0;

          // Create sheet object
          const sheet: Sheet = {
            id: sheetId,
            name: sheetName,
            projectId,
            items: classifiedRowItems,
            stats: {
              totalItems: classifiedRowItems.length,
              classifiedItems,
              totalCena: classifiedRowItems.reduce((sum, item) => sum + (item.cenaCelkem || 0), 0),
            },
            metadata: {
              ...result.metadata,
              sheetName, // Store sheet name in metadata
            },
            config: sheetConfig,
            classifierMapping: v2Result.mapping,
            classifierTemplateHint: templateHint,
          };

          sheets.push(sheet);
        } catch (sheetErr) {
          errorCount++;
          allWarnings.push(`[${sheetName}] Chyba: ${sheetErr instanceof Error ? sheetErr.message : 'Neznámá chyba'}`);
        }
      }

      if (allWarnings.length > 0) {
        setWarnings(allWarnings);
      }

      if (errorCount > 0) {
        setError(`Importováno ${sheets.length} listů, ${errorCount} selhalo. Zkontrolujte varování níže.`);
      }

      // Create ONE project with all sheets
      const projectName = file.name.replace(/\.(xlsx?|xls)$/i, '');

      // P2.2: dedupe prompt before creating a fresh project.
      if (!isReimport) {
        const r = resolveDuplicate(projectName, projectId);
        if (r.action === 'cancel') {
          setIsLoading(false);
          return;
        }
        if (r.action === 'update') {
          projectId = r.projectId;
          isUpdate = true;
        }
      }
      // Rebuild sheets with the (possibly-updated) projectId.
      const finalSheets = sheets.map(s => ({ ...s, projectId }));
      const project: Project = {
        id: projectId,
        fileName: file.name,
        projectName,
        filePath: '',
        importedAt: new Date(),
        sheets: finalSheets,
      };

      if (isUpdate) {
        // Update: replace sheets, preserve manual skupiny
        replaceProjectSheets(projectId, finalSheets);
      } else {
        addProject(project);
      }

      // Store original file in IndexedDB for "return to original" export
      if (originalFileData.current) {
        storeOriginalFile(projectId, file.name, originalFileData.current).catch(err => {
          console.error('Failed to store original file:', err);
        });

        // Save project mapping for patch-based export (use first sheet for column detection)
        try {
          const mapping = createProjectMapping(originalFileData.current, projectId, selectedSheets[0]);
          await saveProjectMapping(mapping);
          console.log(`[Import] Saved mapping for project ${projectId} (multi-sheet)`);
        } catch (mappingErr) {
          console.error('Failed to save project mapping:', mappingErr);
          // Non-critical, continue
        }
      }

      setStep('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chyba při hromadném importu');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setStep('upload');
    setFile(null);
    setWorkbook(null);
    setSheetNames([]);
    setSelectedSheet('');
    setSelectedTemplate(getDefaultTemplate());
    setError(null);
    setWarnings([]);
    onClose();
  };

  return (
    <ResizableModal
      isOpen={isOpen}
      onClose={handleClose}
      title={isReimport ? 'Reimport rozpočtu' : 'Import rozpočtu'}
      defaultWidth={1200}
      defaultHeight={800}
      minWidth={800}
      minHeight={600}
    >
      {/* Root wrapper — for most steps `space-y-6` gives a stacked body
          that can scroll in the outer ResizableModal. For `raw-view` we
          switch to a flex column that fills the modal body height so the
          preview table inside RawExcelViewer becomes the single scroll
          context (see `fix/flat-import-modal` PR). */}
      <div className={step === 'raw-view' ? 'h-full flex flex-col overflow-hidden' : 'space-y-6'}>
        {/* Upload step */}
        {step === 'upload' && (
          <div>
            <p className="text-sm text-text-secondary mb-4">
              Nahrajte Excel soubor (.xlsx nebo .xls) s rozpočtem nebo výkazem výměr.
            </p>
            <FileUploader onFileSelect={handleFileSelect} />
            {isLoading && (
              <div className="mt-4 flex items-center gap-2 text-text-secondary">
                <Loader2 size={20} className="animate-spin" />
                <span>Načítání souboru...</span>
              </div>
            )}
          </div>
        )}

        {/* Template selection */}
        {step === 'template' && (
          <div className="space-y-6">
            <div>
              <p className="text-sm text-[var(--text-secondary)] mb-2">
                Soubor: <span className="font-semibold text-[var(--text-primary)]">{file?.name}</span>
              </p>
              <p className="text-base text-[var(--text-primary)] font-semibold mt-4">
                Vyberte způsob mapování sloupců:
              </p>
            </div>

            {/* Primary Action: Raw Data Mapping */}
            <button
              onClick={() => setStep('raw-view')}
              className="w-full py-6 px-6 bg-[var(--accent-orange)] hover:bg-[var(--accent-orange)]/90
                       text-white rounded-lg transition-all
                       flex items-center justify-between group"
            >
              <div className="flex items-center gap-4">
                <div className="text-4xl">📊</div>
                <div className="text-left">
                  <div className="text-lg font-bold mb-1">
                    Raw Data - Namapovat ručně
                  </div>
                  <div className="text-sm text-white/90">
                    Zobrazit tabulku a určit sloupce ručně (doporučeno pro nestandardní soubory)
                  </div>
                </div>
              </div>
              <div className="text-2xl group-hover:translate-x-1 transition-transform">
                →
              </div>
            </button>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[var(--divider)]"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-[var(--bg-primary)] text-[var(--text-muted)]">
                  nebo
                </span>
              </div>
            </div>

            {/* Auto-Detect Button */}
            <button
              onClick={handleAutoDetect}
              disabled={isDetecting}
              className="w-full py-5 px-6 bg-[var(--data-surface)] hover:bg-[var(--panel-clean)]
                       border-2 border-[var(--divider)] hover:border-[var(--accent-orange)]
                       rounded-lg transition-all
                       disabled:opacity-50 disabled:cursor-not-allowed
                       flex items-center justify-between group"
            >
              <div className="flex items-center gap-4">
                <div className="text-3xl">
                  {isDetecting ? '⏳' : '🔍'}
                </div>
                <div className="text-left">
                  <div className="text-base font-bold text-[var(--text-primary)] mb-1">
                    {isDetecting ? 'Analyzuji strukturu...' : 'Automaticky určit šablonu'}
                  </div>
                  <div className="text-sm text-[var(--text-secondary)]">
                    AI detekce struktury Excel souboru
                  </div>
                </div>
              </div>
              {isDetecting && <Loader2 size={24} className="animate-spin text-[var(--accent-orange)]" />}
            </button>

            {/* Detection Results */}
            {detectionResults && detectionResults.length > 0 && (
              <div className="space-y-4 p-4 bg-[var(--data-surface)] rounded-lg border-2 border-[var(--accent-orange)]">
                <div>
                  <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-2">
                    Výsledky auto-detekce
                  </h4>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Klikněte na šablonu pro výběr
                  </p>
                </div>

                <div className="space-y-2">
                  {detectionResults.slice(0, 3).map((result) => (
                    <button
                      key={result.template.metadata.id}
                      onClick={() => handleApplyDetectedTemplate(result)}
                      className={`w-full p-3 rounded-lg border-2 transition-all text-left
                        ${
                          result.confidence === 'high'
                            ? 'border-green-500 bg-green-50 hover:bg-green-100'
                            : result.confidence === 'medium'
                            ? 'border-yellow-500 bg-yellow-50 hover:bg-yellow-100'
                            : 'border-gray-400 bg-gray-50 hover:bg-gray-100'
                        }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{result.template.metadata.icon}</span>
                          <span className="font-semibold text-[var(--text-primary)]">
                            {result.template.metadata.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-sm font-bold ${
                              result.confidence === 'high'
                                ? 'text-green-600'
                                : result.confidence === 'medium'
                                ? 'text-yellow-600'
                                : 'text-gray-600'
                            }`}
                          >
                            {result.matchScore}%
                          </span>
                          <span
                            className={`text-xs px-2 py-1 rounded ${
                              result.confidence === 'high'
                                ? 'bg-green-200 text-green-800'
                                : result.confidence === 'medium'
                                ? 'bg-yellow-200 text-yellow-800'
                                : 'bg-gray-200 text-gray-800'
                            }`}
                          >
                            {result.confidence === 'high'
                              ? 'Vysoká shoda'
                              : result.confidence === 'medium'
                              ? 'Střední shoda'
                              : 'Nízká shoda'}
                          </span>
                        </div>
                      </div>
                      <div className="text-xs text-[var(--text-secondary)] space-y-1">
                        {result.reasoning.map((reason, idx) => (
                          <div key={idx} className={reason.startsWith('✓') ? 'text-green-700' : reason.startsWith('✗') ? 'text-red-600' : ''}>
                            {reason}
                          </div>
                        ))}
                      </div>
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setDetectionResults(null)}
                  className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  Zavřít výsledky
                </button>
              </div>
            )}

            <div className="flex gap-3 justify-end pt-4 border-t border-[var(--divider)]">
              <button onClick={() => setStep('upload')} className="btn btn-secondary">
                ← Zpět
              </button>
            </div>
          </div>
        )}

        {/* Raw Excel View — flat layout: single scroll context lives
            inside RawExcelViewer's preview table. Header info, mapping
            form, badges, and action buttons are all fixed surfaces that
            stay visible while the user scrolls through preview rows. */}
        {step === 'raw-view' && workbook && (
          <div className="flex flex-col flex-1 min-h-0 gap-3">
            <div className="flex-shrink-0">
              <p className="text-sm text-text-secondary mb-1">
                Soubor: <span className="font-semibold text-text-primary">{file?.name}</span>
              </p>
              <p className="text-xs text-text-muted">
                Prohlédněte si data a namapujte sloupce ručně
              </p>
            </div>

            <RawExcelViewer
              workbook={workbook}
              onColumnMapping={(mapping) => {
                // Create a flexible template with the mapping
                const flexibleConfig: ImportConfig = {
                  templateName: 'Raw Import',
                  sheetName: selectedSheet || sheetNames[0],
                  sheetIndex: 0,
                  dataStartRow: mapping.dataStartRow,
                  columns: {
                    kod: mapping.kod,
                    popis: mapping.popis,
                    mj: mapping.mj,
                    mnozstvi: mapping.mnozstvi,
                    cenaJednotkova: mapping.cenaJednotkova,
                    cenaCelkem: mapping.cenaCelkem,
                  },
                  metadataCells: {},
                  flexibleMode: true,
                };
                setSelectedTemplate({
                  metadata: {
                    id: 'raw-import',
                    name: 'Raw Import',
                    type: 'raw',
                    description: 'Manuální mapování',
                    icon: '📊',
                  },
                  config: flexibleConfig,
                  isBuiltIn: false,
                  canEdit: false,
                  canDelete: false,
                });
                setStep('sheet');
              }}
              onDetectedType={(detected) => {
                console.log('Detected file type:', detected);
              }}
              onBack={() => setStep('template')}
            />
          </div>
        )}

        {/* Custom template configuration */}
        {step === 'custom-config' && (
          <div className="space-y-6">
            <div>
              <p className="text-sm text-[var(--text-secondary)] mb-2">
                Soubor: <span className="font-semibold text-[var(--text-primary)]">{file?.name}</span>
              </p>
            </div>

            {/* Template Name & Description */}
            <div className="space-y-4 p-4 bg-[var(--data-surface)] rounded-lg border border-[var(--divider)]">
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                  Název šablony <span className="text-[var(--accent-orange)]">*</span>
                </label>
                <input
                  type="text"
                  value={customTemplateName}
                  onChange={(e) => setCustomTemplateName(e.target.value)}
                  placeholder="Např. Můj vlastní formát"
                  className="w-full px-3 py-2 bg-[var(--panel-clean)] border border-[var(--divider)]
                           rounded text-[var(--text-primary)]
                           focus:outline-none focus:ring-2 focus:ring-[var(--accent-orange)]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                  Popis (volitelné)
                </label>
                <input
                  type="text"
                  value={customTemplateDescription}
                  onChange={(e) => setCustomTemplateDescription(e.target.value)}
                  placeholder="Krátký popis šablony"
                  className="w-full px-3 py-2 bg-[var(--panel-clean)] border border-[var(--divider)]
                           rounded text-[var(--text-primary)]
                           focus:outline-none focus:ring-2 focus:ring-[var(--accent-orange)]"
                />
              </div>
            </div>

            {/* Config Editor */}
            <ConfigEditor
              config={customConfig}
              onChange={setCustomConfig}
              showMetadata={true}
              sheetNames={sheetNames}
            />

            {/* Actions */}
            <div className="flex gap-3 justify-end">
              <button onClick={handleCancelCustomTemplate} className="btn btn-secondary">
                Zrušit
              </button>
              <button
                onClick={handleSaveCustomTemplate}
                disabled={!customTemplateName.trim()}
                className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Uložit a použít
              </button>
            </div>
          </div>
        )}

        {/* Sheet selection */}
        {step === 'sheet' && (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-text-secondary mb-2">
                Soubor: <span className="font-semibold text-text-primary">{file?.name}</span>
              </p>
              <p className="text-sm text-text-secondary">
                Nalezeno {sheetNames.length} listů.
              </p>
            </div>

            {/* Import mode selection */}
            <div className="p-4 bg-[var(--data-surface)] rounded-lg border border-[var(--divider)]">
              <label className="block text-sm font-medium mb-3">Režim importu:</label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={importMode === 'single'}
                    onChange={() => {
                      setImportMode('single');
                      setSelectedSheets([]);
                    }}
                    className="w-4 h-4 text-[var(--accent-orange)]"
                  />
                  <span className="text-sm text-[var(--text-primary)]">
                    📄 Importovat jeden list
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={importMode === 'multiple'}
                    onChange={() => {
                      setImportMode('multiple');
                      setSelectedSheet('');
                      setSelectedSheets(sheetNames); // Select all by default
                      runPerSheetDetection(workbook, sheetNames);
                    }}
                    className="w-4 h-4 text-[var(--accent-orange)]"
                  />
                  <span className="text-sm text-[var(--text-primary)]">
                    📚 Importovat více listů najednou ({sheetNames.length})
                  </span>
                </label>
              </div>
            </div>

            {/* Single sheet selection */}
            {importMode === 'single' && (
              <div>
                <label className="block text-sm font-medium mb-2">Vyberte list:</label>
                <select
                  value={selectedSheet}
                  onChange={(e) => setSelectedSheet(e.target.value)}
                  className="input"
                >
                  {sheetNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Multiple sheets selection */}
            {importMode === 'multiple' && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium">
                    Vyberte listy ({selectedSheets.length}/{sheetNames.length}):
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedSheets(sheetNames)}
                      className="text-xs text-[var(--accent-orange)] hover:underline"
                    >
                      Vybrat vše
                    </button>
                    <button
                      onClick={() => setSelectedSheets([])}
                      className="text-xs text-[var(--text-muted)] hover:underline"
                    >
                      Zrušit výběr
                    </button>
                  </div>
                </div>
                <div className="max-h-64 overflow-y-auto p-4 bg-[var(--panel-clean)] rounded border border-[var(--divider)] space-y-2">
                  {sheetNames.map((name) => (
                    <label key={name} className="flex items-center gap-2 cursor-pointer hover:bg-[var(--bg-secondary)] p-2 rounded">
                      <input
                        type="checkbox"
                        checked={selectedSheets.includes(name)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedSheets([...selectedSheets, name]);
                          } else {
                            setSelectedSheets(selectedSheets.filter(s => s !== name));
                          }
                        }}
                        className="w-4 h-4 text-[var(--accent-orange)]"
                      />
                      <span className="text-sm text-[var(--text-primary)]">{name}</span>
                    </label>
                  ))}
                </div>

                {/* Per-sheet dataStartRow controls */}
                {Object.keys(perSheetStartRows).length > 0 && selectedSheets.length > 0 && (
                  <div className="mt-3 p-3 bg-[var(--data-surface)] rounded border border-[var(--divider)]">
                    <label className="block text-xs font-semibold mb-2 text-[var(--text-secondary)]">
                      Řádek začátku dat (per-sheet):
                    </label>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {selectedSheets.map(name => {
                        const info = perSheetStartRows[name];
                        if (!info) return null;
                        return (
                          <div key={name} className="flex items-center gap-2 text-sm">
                            <span className="flex-1 truncate text-[var(--text-primary)]" title={name}>{name}</span>
                            <input
                              type="number"
                              min={1}
                              value={info.dataStartRow}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10);
                                if (val >= 1) {
                                  setPerSheetStartRows(prev => ({
                                    ...prev,
                                    [name]: { ...prev[name], dataStartRow: val, confidence: 'high', reason: 'Ručně nastaveno' },
                                  }));
                                }
                              }}
                              className="w-16 px-2 py-1 text-xs bg-[var(--panel-clean)] border border-[var(--divider)] rounded text-center focus:border-[var(--accent-orange)] focus:outline-none"
                            />
                            <span className={`text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap ${
                              info.confidence === 'high' ? 'bg-green-100 text-green-700' :
                              info.confidence === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {info.confidence === 'high' ? '✓' : info.confidence === 'medium' ? '⚠' : '✗'}
                            </span>
                            <span className="text-[10px] text-[var(--text-muted)] hidden sm:inline" title={info.reason}>
                              {info.reason.length > 30 ? info.reason.slice(0, 30) + '…' : info.reason}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Apply template to all sheets */}
                <div className="flex items-start gap-3 p-3 bg-blue-500/10 rounded border border-blue-500/30">
                  <input
                    type="checkbox"
                    id="apply-template-all"
                    checked={applyTemplateToAll}
                    onChange={(e) => setApplyTemplateToAll(e.target.checked)}
                    className="mt-1 w-4 h-4 text-blue-500"
                  />
                  <label htmlFor="apply-template-all" className="flex-1 cursor-pointer">
                    <div className="text-sm font-medium text-blue-300">
                      ⚙️ Použít tuto konfiguraci pro všechny vybrané listy
                    </div>
                    <div className="text-xs text-blue-200 mt-1">
                      Šablona "{selectedTemplate.metadata.name}" bude použita pro všech {selectedSheets.length} listů
                    </div>
                  </label>
                </div>
              </div>
            )}

            <div className="card bg-bg-tertiary">
              <p className="text-sm text-text-secondary">
                <strong>Šablona:</strong> {selectedTemplate.metadata.icon} {selectedTemplate.metadata.name}
              </p>
              <p className="text-xs text-text-muted mt-1">
                {selectedTemplate.metadata.description}
              </p>
            </div>

            {/* Auto-classification option */}
            <div className="flex items-start gap-3 p-4 bg-[var(--data-surface)] rounded-lg border border-[var(--divider)]">
              <input
                type="checkbox"
                id="auto-classify"
                checked={autoClassify}
                onChange={(e) => setAutoClassify(e.target.checked)}
                className="mt-1 w-4 h-4 text-[var(--accent-orange)] bg-[var(--panel-clean)]
                         border-[var(--divider)] rounded focus:ring-2 focus:ring-[var(--accent-orange)]"
              />
              <label htmlFor="auto-classify" className="flex-1 cursor-pointer">
                <div className="text-sm font-medium text-[var(--text-primary)] mb-1">
                  ✨ Automaticky klasifikovat položky
                </div>
                <div className="text-xs text-[var(--text-secondary)]">
                  Použije regex pravidla pro automatické přiřazení skupin podle popisu položek
                </div>
              </label>
            </div>

            <div className="flex gap-3 justify-end">
              <button onClick={() => setStep('template')} className="btn btn-secondary">
                Zpět
              </button>
              <button
                onClick={importMode === 'single' ? handleImport : handleImportMultiple}
                disabled={
                  isLoading ||
                  (importMode === 'single' && !selectedSheet) ||
                  (importMode === 'multiple' && selectedSheets.length === 0)
                }
                className="btn btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading && <Loader2 size={16} className="animate-spin" />}
                {isReimport
                  ? (importMode === 'single' ? 'Reimportovat' : `Reimportovat ${selectedSheets.length} listů`)
                  : (importMode === 'single' ? 'Importovat' : `Importovat ${selectedSheets.length} listů`)}
              </button>
            </div>
          </div>
        )}

        {/* Success */}
        {step === 'success' && (
          <div className="text-center py-8 space-y-4">
            <div className="flex justify-center">
              <div className="p-4 bg-accent-success/10 rounded-full">
                <CheckCircle size={48} className="text-accent-success" />
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-2">Import dokončen!</h3>
              <p className="text-text-secondary">
                Projekt byl úspěšně importován.
              </p>
            </div>

            {warnings.length > 0 && (
              <div className="card bg-accent-primary/10 border-accent-primary text-left">
                <div className="flex items-start gap-2">
                  <AlertCircle size={20} className="text-accent-primary flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-semibold mb-1">Upozornění:</p>
                    <ul className="list-disc list-inside space-y-1">
                      {warnings.map((warning, idx) => (
                        <li key={idx}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            <button onClick={handleClose} className="btn btn-primary">
              Zavřít
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="card bg-accent-warning/10 border-accent-warning">
            <div className="flex items-start gap-2">
              <AlertCircle size={20} className="text-accent-warning flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold mb-1">Chyba:</p>
                <p>{error}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </ResizableModal>
  );
}
