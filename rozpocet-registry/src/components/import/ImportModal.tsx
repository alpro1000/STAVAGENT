/**
 * ImportModal Component
 * Modal pro import Excel souborů
 */

import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Modal } from '../ui/Modal';
import { FileUploader } from './FileUploader';
import { TemplateSelector } from '../templates/TemplateSelector';
import { ConfigEditor } from '../config/ConfigEditor';
import { readExcelFile, getSheetNames, parseExcelSheet } from '../../services/parser/excelParser';
import { useRegistryStore } from '../../stores/registryStore';
import { getDefaultTemplate } from '../../config/templates';
import { defaultImportConfig } from '../../config/defaultConfig';
import type { Project } from '../../types';
import type { ImportTemplate } from '../../types/template';
import type { ImportConfig } from '../../types/config';
import { AlertCircle, Loader2, CheckCircle } from 'lucide-react';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Step = 'upload' | 'template' | 'custom-config' | 'sheet' | 'parsing' | 'success';

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

  // Custom template creation state
  const [customTemplateName, setCustomTemplateName] = useState('');
  const [customTemplateDescription, setCustomTemplateDescription] = useState('');
  const [customConfig, setCustomConfig] = useState<Partial<ImportConfig>>({
    ...defaultImportConfig,
    sheetName: sheetNames[0] || '',
    sheetIndex: 0,
  });

  const handleFileSelect = async (selectedFile: File) => {
    setError(null);
    setIsLoading(true);

    try {
      const wb = await readExcelFile(selectedFile);
      const sheets = getSheetNames(wb);

      if (sheets.length === 0) {
        throw new Error('Soubor neobsahuje žádné listy.');
      }

      setFile(selectedFile);
      setWorkbook(wb);
      setSheetNames(sheets);
      setSelectedSheet(sheets[0]);
      setStep('template'); // Changed from 'sheet' to add template selection step
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chyba při čtení souboru');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTemplateSelect = (template: ImportTemplate) => {
    setSelectedTemplate(template);
  };

  const handleTemplateConfirm = () => {
    setStep('sheet');
  };

  const handleCreateCustomTemplate = () => {
    // Initialize custom config with default values
    setCustomConfig({
      ...defaultImportConfig,
      sheetName: sheetNames[0] || '',
      sheetIndex: 0,
    });
    setCustomTemplateName('');
    setCustomTemplateDescription('');
    setStep('custom-config');
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

  const handleImport = async () => {
    if (!file || !workbook || !selectedSheet || !selectedTemplate) return;

    setError(null);
    setIsLoading(true);

    try {
      const projectId = uuidv4();

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

      // Vytvoříme projekt
      const project: Project = {
        id: projectId,
        fileName: file.name,
        filePath: '', // Browser-only, path nebude použit
        importedAt: new Date(),
        metadata: result.metadata,
        config: {
          ...selectedTemplate.config,
          sheetName: selectedSheet,
        },
        items: result.items,
        stats: {
          totalItems: result.items.length,
          classifiedItems: 0,
          totalCena: result.items.reduce((sum, item) => sum + (item.cenaCelkem || 0), 0),
        },
      };

      addProject(project);
      setStep('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chyba při parsování');
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
    <Modal isOpen={isOpen} onClose={handleClose} title="Import rozpočtu" size="lg">
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
            </div>

            <TemplateSelector
              selectedTemplate={selectedTemplate}
              onSelectTemplate={handleTemplateSelect}
              showCreateButton={true}
              onCreateCustom={handleCreateCustomTemplate}
            />

            <div className="flex gap-3 justify-end">
              <button onClick={() => setStep('upload')} className="btn btn-secondary">
                Zpět
              </button>
              <button
                onClick={handleTemplateConfirm}
                className="btn btn-primary"
              >
                Pokračovat
              </button>
            </div>
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
                Nalezeno {sheetNames.length} listů. Vyberte list pro import:
              </p>
            </div>

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

            <div className="card bg-bg-tertiary">
              <p className="text-sm text-text-secondary">
                <strong>Šablona:</strong> {selectedTemplate.metadata.icon} {selectedTemplate.metadata.name}
              </p>
              <p className="text-xs text-text-muted mt-1">
                {selectedTemplate.metadata.description}
              </p>
            </div>

            <div className="flex gap-3 justify-end">
              <button onClick={() => setStep('template')} className="btn btn-secondary">
                Zpět
              </button>
              <button
                onClick={handleImport}
                disabled={isLoading}
                className="btn btn-primary flex items-center gap-2"
              >
                {isLoading && <Loader2 size={16} className="animate-spin" />}
                Importovat
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
    </Modal>
  );
}
