/**
 * Document Validator Service
 * Фаза 2: Проверка полноты загруженных документов
 *
 * Определяет, какие документы необходимы для анализа и какие отсутствуют
 * Генерирует RFI (Request For Information) для недостающих данных
 */

import { logger } from '../utils/logger.js';

/**
 * Document types that can be uploaded
 */
const DOCUMENT_TYPES = {
  TECH_SPEC: {
    id: 'tech_spec',
    name: 'Техническое задание',
    extensions: ['.pdf', '.docx', '.txt'],
    required: true,
    priority: 'critical',
    description: 'Основной документ с описанием объекта и требованиями'
  },
  DRAWINGS: {
    id: 'drawings',
    name: 'Чертежи',
    extensions: ['.pdf', '.dwg', '.jpg', '.png'],
    required: false,
    priority: 'high',
    description: 'Архитектурные или конструктивные чертежи'
  },
  MATERIALS: {
    id: 'materials',
    name: 'Спецификация материалов',
    extensions: ['.xlsx', '.xls', '.pdf'],
    required: false,
    priority: 'high',
    description: 'Список материалов и их характеристик'
  },
  GEOLOGICAL: {
    id: 'geological',
    name: 'Геологический отчет',
    extensions: ['.pdf', '.txt'],
    required: false,
    priority: 'medium',
    description: 'Информация о почвенных условиях и грунтах'
  },
  STANDARDS: {
    id: 'standards',
    name: 'Применяемые стандарты',
    extensions: ['.pdf', '.docx', '.txt'],
    required: false,
    priority: 'medium',
    description: 'ЧСН, ГОСТ, ТСН применяемые к проекту'
  }
};

/**
 * Validation rules for project context completeness
 */
const VALIDATION_RULES = {
  basic_info: {
    required_fields: ['building_type', 'storeys'],
    missing_fields: [],
    description: 'Базовая информация о проекте'
  },
  structure_info: {
    required_fields: ['main_system'],
    conditional: {
      condition: (ctx) => ctx.main_system && ctx.main_system.includes('железобетон'),
      required_then: ['foundation_concrete'],
      description: 'Для проектов ЖБ нужна информация о классе бетона'
    }
  },
  geological_info: {
    conditional: {
      condition: (ctx) => ctx.building_type === 'most' || ctx.building_type.includes('подземный'),
      required_then: ['soil_class', 'groundwater_level'],
      description: 'Для мостов и подземных объектов нужны геологические данные'
    }
  }
};

/**
 * Validate document completeness based on file list and project context
 *
 * @param {Array} uploadedFiles - List of uploaded files with metadata
 * @param {Object} projectContext - Current project context
 * @returns {Promise<Object>} Validation result with completeness score and RFI
 */
export async function validateDocumentCompleteness(uploadedFiles, projectContext) {
  logger.info('[DocValidator] Starting document completeness validation...');

  const validation = {
    completeness_score: 0,
    uploaded_documents: [],
    missing_documents: [],
    context_validation: {
      complete: false,
      missing_fields: [],
      conditional_missing: []
    },
    rfi_items: [],
    recommendations: [],
    severity: 'ok' // ok, warning, critical
  };

  // 1. Validate uploaded documents
  validateUploadedDocuments(uploadedFiles, validation);

  // 2. Validate project context
  validateProjectContext(projectContext, validation);

  // 3. Generate RFI for missing critical information
  generateRFI(projectContext, validation);

  // 4. Calculate completeness score
  calculateCompletenessScore(validation);

  // 5. Generate recommendations
  generateRecommendations(projectContext, validation);

  logger.info(
    `[DocValidator] Validation complete: ${validation.completeness_score}% completeness, ` +
    `${validation.missing_documents.length} docs missing, ` +
    `${validation.rfi_items.length} RFI items`
  );

  return validation;
}

/**
 * Validate uploaded documents
 */
function validateUploadedDocuments(files, validation) {
  if (!Array.isArray(files)) {
    files = [];
  }

  // Group uploaded files by document type
  const uploadedByType = {};
  Object.values(DOCUMENT_TYPES).forEach(docType => {
    uploadedByType[docType.id] = [];
  });

  // Classify uploaded files
  files.forEach((file) => {
    const ext = file.filename ? '.' + file.filename.split('.').pop() : '';
    let matched = false;

    Object.values(DOCUMENT_TYPES).forEach((docType) => {
      if (docType.extensions.includes(ext.toLowerCase())) {
        uploadedByType[docType.id].push(file);
        matched = true;
      }
    });

    if (!matched) {
      logger.warn(`[DocValidator] Unknown file type: ${file.filename}`);
    }
  });

  // Build validation results
  Object.entries(uploadedByType).forEach(([docId, uploadedFiles]) => {
    const docType = DOCUMENT_TYPES[docId.toUpperCase()] || Object.values(DOCUMENT_TYPES).find(d => d.id === docId);

    if (!docType) {return;}

    if (uploadedFiles.length > 0) {
      validation.uploaded_documents.push({
        id: docType.id,
        name: docType.name,
        count: uploadedFiles.length,
        files: uploadedFiles.map(f => ({ name: f.filename, size: f.size }))
      });
    } else if (docType.required) {
      validation.missing_documents.push({
        id: docType.id,
        name: docType.name,
        required: true,
        priority: docType.priority,
        description: docType.description
      });
    }
  });
}

/**
 * Validate project context completeness
 */
function validateProjectContext(context, validation) {
  if (!context || typeof context !== 'object') {
    validation.context_validation.complete = false;
    validation.context_validation.missing_fields = Object.keys(VALIDATION_RULES.basic_info.required_fields);
    return;
  }

  const missingFields = [];

  // Check basic required fields
  VALIDATION_RULES.basic_info.required_fields.forEach((field) => {
    if (!context[field] || context[field] === 'neurčeno' || (Array.isArray(context[field]) && context[field].length === 0)) {
      missingFields.push(field);
    }
  });

  // Check conditional requirements
  if (context.main_system && Array.isArray(context.main_system)) {
    if (context.main_system.includes('železobeton') && !context.foundation_concrete) {
      validation.context_validation.conditional_missing.push({
        field: 'foundation_concrete',
        reason: 'Vyžadováno pro projekty s železobetonem'
      });
    }
  }

  // Check geological requirements
  if (
    context.building_type === 'most' ||
    context.building_type?.includes('podzemný') ||
    context.building_type?.includes('subway')
  ) {
    ['soil_class', 'groundwater_level'].forEach((field) => {
      if (!context[field]) {
        validation.context_validation.conditional_missing.push({
          field,
          reason: 'Vyžadováno pro stavby tohoto typu'
        });
      }
    });
  }

  validation.context_validation.missing_fields = missingFields;
  validation.context_validation.complete = missingFields.length === 0 && validation.context_validation.conditional_missing.length === 0;
}

/**
 * Generate RFI (Request for Information) for missing data
 */
function generateRFI(context, validation) {
  // Critical RFI - prevents analysis
  const criticalRFI = [];

  if (validation.context_validation.missing_fields.includes('building_type')) {
    criticalRFI.push({
      id: 'rfi_building_type',
      severity: 'critical',
      question: 'Jaký je typ stavby?',
      description: 'Typ stavby je esenciální pro správný výběr URS kódů',
      documentation: 'Uveďte v technickém zadání nebo v popisu projektu'
    });
  }

  if (validation.context_validation.missing_fields.includes('main_system')) {
    criticalRFI.push({
      id: 'rfi_main_system',
      severity: 'critical',
      question: 'Jaké jsou hlavní konstrukční systémy?',
      description: 'Konstrukční systém (zdivo, ŽB, ocel) určuje typ prací',
      documentation: 'Najdete v čertězích nebo technickém zadání'
    });
  }

  // High priority RFI
  const highPriorityRFI = [];

  if (
    context?.main_system?.includes('železobeton') &&
    validation.context_validation.conditional_missing.some(c => c.field === 'foundation_concrete')
  ) {
    highPriorityRFI.push({
      id: 'rfi_concrete_class',
      severity: 'high',
      question: 'Jaká je třída betonu pro základy?',
      description: 'Potřebná pro správné oceňování beton prací',
      suggestion: 'Hledejte v technickém zadání nebo výkresech (např. C25/30)'
    });
  }

  // Medium priority RFI - for geological info if mosts
  if (context?.building_type === 'most') {
    if (validation.missing_documents.some(d => d.id === 'geological')) {
      highPriorityRFI.push({
        id: 'rfi_geological',
        severity: 'high',
        question: 'Je dostupný geolog report?',
        description: 'Pro mosty je vyžadován geolog report pro správné projektování základů',
        suggestion: 'Požádejte stavbyvedoucího o geologický prizkum'
      });
    }
  }

  validation.rfi_items = [...criticalRFI, ...highPriorityRFI];
  validation.has_critical_rfi = criticalRFI.length > 0;
}

/**
 * Calculate overall completeness score
 * FIXED: Handle zero-division, include conditional fields in calculation
 */
function calculateCompletenessScore(validation) {
  // Documents: 40% weight
  const requiredDocTypes = Object.values(DOCUMENT_TYPES).filter(d => d.required).length;
  const uploadedDocTypes = validation.uploaded_documents.length;

  // FIXED: Prevent division by zero and cap at 40%
  const documentRatio = requiredDocTypes > 0 ? Math.min(uploadedDocTypes / requiredDocTypes, 1) : 1;
  const documentScore = documentRatio * 40;

  // Context: 60% weight
  // FIXED: Include both required AND conditional fields in calculation
  const requiredContextFields = VALIDATION_RULES.basic_info.required_fields || ['building_type', 'storeys'];
  const conditionalFieldCount = validation.context_validation.conditional_missing.length;
  const totalContextFields = requiredContextFields.length + conditionalFieldCount;

  // Count missing fields: required missing + conditional missing
  const requiredMissingCount = validation.context_validation.missing_fields.length;
  const totalMissingCount = requiredMissingCount + conditionalFieldCount;
  const completedContextFields = totalContextFields - totalMissingCount;

  // FIXED: Prevent division by zero and cap at 60%
  const contextRatio = totalContextFields > 0
    ? Math.min(completedContextFields / totalContextFields, 1)
    : 1;
  const contextScore = contextRatio * 60;

  // FIXED: Cap total score at 100
  validation.completeness_score = Math.min(100, Math.round(documentScore + contextScore));

  // Set severity
  if (validation.completeness_score >= 80) {
    validation.severity = 'ok';
  } else if (validation.completeness_score >= 50) {
    validation.severity = 'warning';
  } else {
    validation.severity = 'critical';
  }
}

/**
 * Generate recommendations for user
 */
function generateRecommendations(context, validation) {
  validation.recommendations = [];

  if (validation.missing_documents.length > 0) {
    const criticalDocs = validation.missing_documents.filter(d => d.required);
    if (criticalDocs.length > 0) {
      validation.recommendations.push({
        priority: 'high',
        type: 'missing_documents',
        message: `Chybí kritické dokumenty: ${criticalDocs.map(d => d.name).join(', ')}`,
        action: `Prosím, nahrajte ${criticalDocs.map(d => d.name).join(', ')} pro pokračování v analýze`
      });
    }
  }

  if (validation.context_validation.missing_fields.length > 0) {
    validation.recommendations.push({
      priority: 'high',
      type: 'missing_context',
      message: `V kontextu projektu chybí: ${validation.context_validation.missing_fields.join(', ')}`,
      action: 'Vyplňte chybějící informace v diskusích nebo dokumentech'
    });
  }

  if (validation.rfi_items.length > 0) {
    const criticalRFI = validation.rfi_items.filter(r => r.severity === 'critical');
    if (criticalRFI.length > 0) {
      validation.recommendations.push({
        priority: 'critical',
        type: 'rfi_critical',
        message: `Kritické informace chybí: ${criticalRFI.map(r => r.question).join('; ')}`,
        action: 'Odpovězte na kritické otázky, aby byla analýza možná'
      });
    }
  }

  // Suggestions for improvement
  if (validation.completeness_score < 100) {
    if (!validation.uploaded_documents.some(d => d.id === 'drawings')) {
      validation.recommendations.push({
        priority: 'medium',
        type: 'suggestion',
        message: 'Nahrání výkresů by zlepšilo přesnost analýzy',
        action: 'Zvažte nahrání architektonických nebo konstrukčních výkresů'
      });
    }

    if (!validation.uploaded_documents.some(d => d.id === 'materials')) {
      validation.recommendations.push({
        priority: 'medium',
        type: 'suggestion',
        message: 'Specifikace materiálů by pomohla upřesnit analýzu',
        action: 'Pokud máte dostupné, nahrajte seznam materiálů'
      });
    }
  }
}

/**
 * Get document requirements for project type
 * Helps user know what to upload
 */
export function getDocumentRequirements(projectType) {
  const requirements = {
    base: [DOCUMENT_TYPES.TECH_SPEC],
    byProjectType: {}
  };

  // Different document requirements for different project types
  if (projectType === 'most' || projectType?.includes('most')) {
    requirements.byProjectType = [
      DOCUMENT_TYPES.TECH_SPEC,
      DOCUMENT_TYPES.DRAWINGS,
      DOCUMENT_TYPES.GEOLOGICAL,
      DOCUMENT_TYPES.STANDARDS
    ];
  } else if (projectType === 'bytový dům' || projectType?.includes('bytový')) {
    requirements.byProjectType = [
      DOCUMENT_TYPES.TECH_SPEC,
      DOCUMENT_TYPES.DRAWINGS,
      DOCUMENT_TYPES.MATERIALS
    ];
  } else {
    requirements.byProjectType = [
      DOCUMENT_TYPES.TECH_SPEC,
      DOCUMENT_TYPES.DRAWINGS
    ];
  }

  return {
    total_requirements: requirements.byProjectType.length,
    documents: requirements.byProjectType.map(d => ({
      id: d.id,
      name: d.name,
      required: d.required,
      description: d.description
    }))
  };
}

/**
 * Export all document types for frontend
 */
export function getDocumentTypes() {
  return Object.values(DOCUMENT_TYPES).map(doc => ({
    id: doc.id,
    name: doc.name,
    extensions: doc.extensions.join(', '),
    required: doc.required,
    priority: doc.priority,
    description: doc.description
  }));
}
