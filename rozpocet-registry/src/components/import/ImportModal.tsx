/**
 * ImportModal Component
 * Modal pro import Excel souborů
 */

import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ResizableModal } from '../ui/ResizableModal';
import { FileUploader } from './FileUploader';
import { ConfigEditor } from '../config/ConfigEditor';
import { readExcelFile, getSheetNames, parseExcelSheet } from '../../services/parser/excelParser';
import { detectExcelStructure, type DetectionResult } from '../../services/autoDetect/structureDetector';
import { classifyItems, applyClassificationsWithCascade } from '../../services/classification/classificationService';
import { classifyRows } from '../../services/classification/rowClassificationService';
import { useRegistryStore } from '../../stores/registryStore';
import { getDefaultTemplate } from '../../config/templates';
import { defaultImportConfig } from '../../config/defaultConfig';
import type { Project, Sheet } from '../../types';
import type { ImportTemplate } from '../../types/template';
import type { ImportConfig } from '../../types/config';
import { AlertCircle, Loader2, CheckCircle } from 'lucide-react';
import { RawExcelViewer } from './RawExcelViewer';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Step = 'upload' | 'template' | 'custom-config' | 'sheet' | 'parsing' | 'raw-view' | 'success';

export function ImportModal({ isOpen, onClose }: ImportModalProps) {
  const { addProject, addTemplate } = useRegistryStore();

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

  const handleFileSelect = async (selectedFile: File) => {
    setError(null);
    setIsLoading(true);

    try {
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
    // Select the detected template
    setSelectedTemplate(result.template);
    setDetectionResults(null); // Close detection results
  };

  const handleImport = async () => {
    if (!file || !workbook || !selectedSheet || !selectedTemplate) return;

    setError(null);
    setIsLoading(true);

    try {
      const projectId = uuidv4();
      const sheetId = uuidv4();

      const result = await parseExcelSheet(workbook, {
        config: {
          ...selectedTemplate.config,
          sheetName: selectedSheet,
        },
        fileName: file.name,
        projectId,
      });

      if (result.warnings.length > 0) {
        setWarnings(result.warnings);
      }

      // Row classification FIRST: assign rowRole, parentItemId, boqLineNumber
      // (must run before cascade so cascade can use rowRole)
      const rowClassification = classifyRows(result.items);
      const classifiedRowItems = rowClassification.items;

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
      };

      // Create project with single sheet
      const projectName = file.name.replace(/\.(xlsx?|xls)$/i, '');
      const project: Project = {
        id: projectId,
        fileName: file.name,
        projectName,
        filePath: '', // Browser-only, path nebude použit
        importedAt: new Date(),
        sheets: [sheet],
      };

      addProject(project);
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
      const projectId = uuidv4(); // ONE project for all sheets
      const sheets: Sheet[] = [];
      const allWarnings: string[] = [];
      let errorCount = 0;

      // Process each sheet
      for (const sheetName of selectedSheets) {
        try {
          const sheetId = uuidv4();

          const result = await parseExcelSheet(workbook, {
            config: {
              ...selectedTemplate.config,
              sheetName,
            },
            fileName: file.name,
            projectId,
          });

          if (result.warnings.length > 0) {
            allWarnings.push(...result.warnings.map(w => `[${sheetName}] ${w}`));
          }

          // Row classification FIRST (so cascade can use rowRole)
          const rowClassification = classifyRows(result.items);
          const classifiedRowItems = rowClassification.items;

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
            config: {
              ...selectedTemplate.config,
              sheetName,
            },
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
      const project: Project = {
        id: projectId,
        fileName: file.name,
        projectName,
        filePath: '',
        importedAt: new Date(),
        sheets,
      };

      addProject(project); // Single call
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
      title="Import rozpočtu"
      defaultWidth={1200}
      defaultHeight={800}
      minWidth={800}
      minHeight={600}
    >
      <div className="space-y-6">
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
                        {result.reasoning.slice(0, 3).map((reason, idx) => (
                          <div key={idx}>{reason}</div>
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

        {/* Raw Excel View */}
        {step === 'raw-view' && workbook && (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-text-secondary mb-2">
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
            />

            <button
              onClick={() => setStep('template')}
              className="btn btn-secondary"
            >
              Zpět k šablonám
            </button>
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
                {importMode === 'single'
                  ? 'Importovat'
                  : `Importovat ${selectedSheets.length} listů`}
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
