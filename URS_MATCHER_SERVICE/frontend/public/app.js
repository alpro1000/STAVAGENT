/**
 * URS Matcher Kiosk Frontend
 * Main application logic
 */

const API_URL = '/api';

// ============================================================================
// DEBUG LOGGING
// ============================================================================

const DEBUG = true;

function debugLog(msg, data = null) {
  if (DEBUG) {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] ${msg}`, data || '');
  }
}

function debugError(msg, error = null) {
  const timestamp = new Date().toLocaleTimeString();
  console.error(`[${timestamp}] ❌ ${msg}`, error || '');
}

// Log page load
debugLog('🚀 App.js loaded');
debugLog(`API_URL: ${API_URL}`);

// DOM Elements
const fileInput = document.getElementById('fileInput');
const fileDropZone = document.getElementById('fileDropZone');
const uploadBtn = document.getElementById('uploadBtn');
const projectContextInput = document.getElementById('projectContextInput');
const blockMatchBtn = document.getElementById('blockMatchBtn');
const textInput = document.getElementById('textInput');
const quantityInput = document.getElementById('quantityInput');
const unitInput = document.getElementById('unitInput');
const matchBtn = document.getElementById('matchBtn');

const uploadSection = document.getElementById('uploadSection');
const resultsSection = document.getElementById('resultsSection');
const errorSection = document.getElementById('errorSection');
const resultsContainer = document.getElementById('resultsContainer');
const resultsTitle = document.getElementById('resultsTitle');
const errorMessage = document.getElementById('errorMessage');

const backBtn = document.getElementById('backBtn');
const errorBackBtn = document.getElementById('errorBackBtn');
const exportBtn = document.getElementById('exportBtn');
const copyBtn = document.getElementById('copyBtn');

let currentJobId = null;
let currentResults = null;

// Verify all DOM elements exist
debugLog('✓ DOM Elements found:', {
  fileInput: !!fileInput,
  fileDropZone: !!fileDropZone,
  uploadBtn: !!uploadBtn,
  projectContextInput: !!projectContextInput,
  blockMatchBtn: !!blockMatchBtn,
  textInput: !!textInput,
  quantityInput: !!quantityInput,
  unitInput: !!unitInput,
  matchBtn: !!matchBtn,
  uploadSection: !!uploadSection,
  resultsSection: !!resultsSection,
  errorSection: !!errorSection,
  resultsContainer: !!resultsContainer,
  resultsTitle: !!resultsTitle,
  errorMessage: !!errorMessage,
  backBtn: !!backBtn,
  errorBackBtn: !!errorBackBtn,
  exportBtn: !!exportBtn,
  copyBtn: !!copyBtn
});

// ============================================================================
// FILE UPLOAD HANDLING
// ============================================================================

// File drop zone
fileDropZone.addEventListener('click', () => {
  debugLog('📁 Drop zone clicked');
  fileInput.click();
});

fileDropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  fileDropZone.classList.add('dragover');
  debugLog('📁 Drag over');
});

fileDropZone.addEventListener('dragleave', () => {
  fileDropZone.classList.remove('dragover');
});

fileDropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  fileDropZone.classList.remove('dragover');
  const files = e.dataTransfer.files;
  debugLog('📁 Files dropped:', { count: files.length });
  if (files.length > 0) {
    fileInput.files = files;
    updateUploadButton();
  }
});

fileInput.addEventListener('change', () => {
  debugLog('📁 File selected:', { name: fileInput.files[0]?.name });
  updateUploadButton();
});

function updateUploadButton() {
  const hasFile = fileInput.files && fileInput.files.length > 0;
  uploadBtn.disabled = !hasFile;
  blockMatchBtn.disabled = !hasFile;
  debugLog('📁 Upload button state:', { uploadDisabled: uploadBtn.disabled, blockMatchDisabled: blockMatchBtn.disabled });
}

uploadBtn.addEventListener('click', () => {
  debugLog('🔵 Upload button clicked');
  uploadFile();
});

blockMatchBtn.addEventListener('click', () => {
  debugLog('🔵 BlockMatch button clicked');
  runBlockMatch();
});

async function uploadFile() {
  debugLog('📤 uploadFile() called');

  if (!fileInput.files || !fileInput.files[0]) {
    debugError('No file selected');
    showError('Prosím, vyберите soubor');
    return;
  }

  uploadBtn.disabled = true;
  uploadBtn.textContent = 'Načítání...';
  debugLog('📤 Uploading file:', { name: fileInput.files[0].name, size: fileInput.files[0].size });

  try {
    const formData = new FormData();
    formData.append('file', fileInput.files[0]);

    debugLog('📤 Sending POST to:', `${API_URL}/jobs/file-upload`);
    const response = await fetch(`${API_URL}/jobs/file-upload`, {
      method: 'POST',
      body: formData
    });

    debugLog('📤 Response status:', { status: response.status, ok: response.ok });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Chyba při nahrávání souboru');
    }

    const data = await response.json();
    currentJobId = data.job_id;
    debugLog('📤 Upload successful, job_id:', currentJobId);

    showResults();

    // Fetch and display results
    await fetchAndDisplayResults(currentJobId);

  } catch (error) {
    debugError('📤 Upload error:', error);
    showError(`Chyba nahrávání: ${error.message}`);
  } finally {
    uploadBtn.disabled = false;
    uploadBtn.textContent = 'Nahrát a zpracovat';
  }
}

async function runBlockMatch() {
  debugLog('📊 runBlockMatch() called');

  if (!fileInput.files || !fileInput.files[0]) {
    debugError('No file selected');
    showError('Prosím, vyberите soubor');
    return;
  }

  blockMatchBtn.disabled = true;
  blockMatchBtn.textContent = 'Analýza...';
  debugLog('📊 Starting block-match with file:', { name: fileInput.files[0].name, size: fileInput.files[0].size });

  try {
    const formData = new FormData();
    formData.append('file', fileInput.files[0]);

    if (projectContextInput.value.trim()) {
      formData.append('project_context', projectContextInput.value.trim());
      debugLog('📊 Project context provided:', projectContextInput.value.trim());
    } else {
      debugLog('📊 No project context provided');
    }

    debugLog('📊 Sending POST to:', `${API_URL}/jobs/block-match`);
    const response = await fetch(`${API_URL}/jobs/block-match`, {
      method: 'POST',
      body: formData
    });

    debugLog('📊 Response status:', { status: response.status, ok: response.ok });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Chyba při analýze bloků');
    }

    const data = await response.json();
    currentJobId = data.job_id;
    debugLog('📊 Block-match successful, job_id:', currentJobId);
    debugLog('📊 Response data:', data);

    currentResults = data;
    resultsTitle.textContent = 'Analýza bloků (block-match)';
    showResults();
    displayBlockMatchResults(data);

  } catch (error) {
    debugError('📊 Block-match error:', error);
    showError(`Chyba analýzy: ${error.message}`);
  } finally {
    blockMatchBtn.disabled = false;
    blockMatchBtn.textContent = '📊 Analyzovat bloky';
  }
}

// ============================================================================
// TEXT MATCHING
// ============================================================================

matchBtn.addEventListener('click', () => {
  debugLog('🔵 Match button clicked');
  matchText();
});

async function matchText() {
  debugLog('🔍 matchText() called');

  const text = textInput.value.trim();
  if (!text) {
    debugError('No text entered');
    showError('Prosím, vložte text');
    return;
  }

  matchBtn.disabled = true;
  matchBtn.textContent = 'Hledání...';

  const payload = {
    text,
    quantity: parseFloat(quantityInput.value) || 0,
    unit: unitInput.value || 'ks'
  };

  debugLog('🔍 Searching for:', payload);

  try {
    const url = `${API_URL}/jobs/text-match`;
    debugLog('🔍 Sending POST to:', url);

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    debugLog('🔍 Response status:', { status: response.status, ok: response.ok });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Chyba při hledání');
    }

    const data = await response.json();
    debugLog('🔍 ✓ Raw response data:', data);
    debugLog('🔍 ✓ Candidates count:', data.candidates?.length || 0);
    debugLog('🔍 ✓ Related items count:', data.related_items?.length || 0);

    if (data.candidates && data.candidates.length > 0) {
      debugLog('🔍 ✓ First candidate:', data.candidates[0]);
    }

    currentResults = data;

    resultsTitle.textContent = 'Výsledky vyhledávání';
    showResults();
    displayTextMatchResults(data);

  } catch (error) {
    if (error.name === 'AbortError') {
      debugError('🔍 Request timeout after 30 seconds');
      showError('Časový limit vypršel (30s). Zkuste to prosím znovu.');
    } else {
      debugError('🔍 Search error:', error);
      showError(`Chyba hledání: ${error.message}`);
    }
  } finally {
    matchBtn.disabled = false;
    matchBtn.textContent = 'Vyhledat pozice';
  }
}

// ============================================================================
// RESULTS DISPLAY
// ============================================================================

async function fetchAndDisplayResults(jobId) {
  try {
    const response = await fetch(`${API_URL}/jobs/${jobId}`);
    if (!response.ok) {
      throw new Error('Nepodařilo se načíst výsledky');
    }

    const data = await response.json();
    currentResults = data;
    displayFileUploadResults(data);

  } catch (error) {
    showError(`Chyba při načítání výsledků: ${error.message}`);
  }
}

function displayFileUploadResults(job) {
  const items = job.items || [];

  if (items.length === 0) {
    resultsContainer.innerHTML = '<p class="loading">Žádné pozice nebyly nalezeny</p>';
    return;
  }

  // Group items by work type
  const grouped = groupItemsByWorkType(items);

  resultsContainer.innerHTML = '';

  // Display each group
  Object.entries(grouped).forEach(([category, groupItems]) => {
    // Group header
    const groupHeader = document.createElement('h3');
    groupHeader.className = 'group-header';
    groupHeader.innerHTML = `📂 ${category} <span class="group-count">(${groupItems.length} pozic)</span>`;
    resultsContainer.appendChild(groupHeader);

    // Group table
    const table = document.createElement('table');
    table.className = 'results-table grouped-table';

    // Header
    const thead = document.createElement('thead');
    thead.innerHTML = `
      <tr>
        <th>Řádek</th>
        <th>Vstupní text</th>
        <th>Kód ÚRS</th>
        <th>Název</th>
        <th>MJ</th>
        <th>Množství</th>
        <th>Jistota</th>
        <th>Typ</th>
      </tr>
    `;
    table.appendChild(thead);

    // Body
    const tbody = document.createElement('tbody');
    groupItems.forEach((item) => {
      const row = document.createElement('tr');

      const confidenceClass = item.confidence > 0.8
        ? 'confidence-high'
        : item.confidence > 0.5
          ? 'confidence-medium'
          : 'confidence-low';

      const typeLabel = item.extra_generated ? '⚠️ Doplňková' : 'Přímá shoda';
      const typeBadge = item.extra_generated
        ? `<span class="badge-extra">${typeLabel}</span>`
        : typeLabel;

      row.innerHTML = `
        <td>${item.input_row_id}</td>
        <td><small>${item.input_text.substring(0, 50)}...</small></td>
        <td><strong>${item.urs_code}</strong></td>
        <td>${item.urs_name}</td>
        <td>${item.unit}</td>
        <td>${item.quantity}</td>
        <td><span class="confidence-badge ${confidenceClass}">${(item.confidence * 100).toFixed(0)}%</span></td>
        <td>${typeBadge}</td>
      `;

      tbody.appendChild(row);
    });
    table.appendChild(tbody);

    resultsContainer.appendChild(table);
  });

  // Summary
  const summary = document.createElement('div');
  summary.className = 'results-summary';
  summary.innerHTML = `
    <p><strong>Součet:</strong> ${items.length} pozic zpracováno ve ${Object.keys(grouped).length} kategoriích
    (${items.filter(i => !i.extra_generated).length} přímých, ${items.filter(i => i.extra_generated).length} doplňkových)</p>
  `;
  resultsContainer.appendChild(summary);
}

/**
 * Group items by TŘÍDNÍK classification code
 * Uses first 2-3 digits of URS code to determine category
 */
function groupItemsByWorkType(items) {
  const grouped = {};

  items.forEach(item => {
    const ursCode = item.urs_code || '';

    // Extract prefix (first 2 digits for main category)
    const prefix = ursCode.substring(0, 2);

    // Get category name from first occurrence
    let categoryName = `${prefix} - ${item.urs_name || 'Ostatní'}`;

    // Try to extract general category from URS name
    // Use first 20 characters as category identifier
    const shortName = (item.urs_name || item.input_text || 'Ostatní').substring(0, 30);

    // Group by prefix + general category name
    const category = `${prefix} - ${getCategoryNameFromCode(prefix)}`;

    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(item);
  });

  // Sort categories by code prefix
  const sorted = Object.keys(grouped).sort().reduce((obj, key) => {
    obj[key] = grouped[key];
    return obj;
  }, {});

  return sorted;
}

/**
 * Get general category name from TŘÍDNÍK code prefix
 * Basic mapping for common categories - will be enhanced with API call later
 */
function getCategoryNameFromCode(prefix) {
  const commonCategories = {
    '0': 'Vedlejší náklady',
    '1': 'Přípravné práce',
    '2': 'Zakládání',
    '27': 'Betonové základy',
    '28': 'Ostatní základy',
    '3': 'Svislé konstrukce',
    '31': 'Zdivo',
    '32': 'Betonové svislé konstrukce',
    '33': 'Svislé konstrukce',
    '34': 'Sloupy a pilíře',
    '4': 'Vodorovné konstrukce',
    '41': 'Stropy',
    '42': 'Vodorovné konstrukce',
    '5': 'Komunikace',
    '6': 'Úpravy povrchů',
    '7': 'Klenby a troubý',
    '8': 'Trubní vedení',
    '82': 'Kanalizace',
    '83': 'Vodovod',
    '9': 'Ostatní konstrukce'
  };

  return commonCategories[prefix] || 'Ostatní práce';
}

function displayTextMatchResults(data) {
  debugLog('📋 displayTextMatchResults() called with data:', data);

  const candidates = data.candidates || [];
  const relatedItems = data.related_items || [];

  debugLog('📋 Processing candidates:', candidates.length);
  debugLog('📋 Processing related items:', relatedItems.length);

  let html = '<div class="text-match-results">';

  if (candidates.length > 0) {
    debugLog('📋 Building table for', candidates.length, 'candidates');
    html += '<h3>🎯 Doporučené pozice ÚRS:</h3>';
    html += '<table class="results-table"><thead><tr>';
    html += '<th>Kód</th><th>Název</th><th>MJ</th><th>Jistota</th>';
    html += '</tr></thead><tbody>';

    candidates.forEach((item, idx) => {
      debugLog(`📋 Building row ${idx + 1}:`, item);
      const confidenceClass = item.confidence > 0.8
        ? 'confidence-high'
        : 'confidence-medium';

      html += `
        <tr>
          <td><strong>${item.urs_code}</strong></td>
          <td>${item.urs_name}</td>
          <td>${item.unit}</td>
          <td><span class="confidence-badge ${confidenceClass}">${(item.confidence * 100).toFixed(0)}%</span></td>
        </tr>
      `;
    });

    html += '</tbody></table>';
  }

  if (relatedItems.length > 0) {
    debugLog('📋 Adding related items section');
    html += '<h3>⚙️ Doporučené doplňkové práce:</h3>';
    html += '<ul>';
    relatedItems.forEach((item) => {
      html += `<li>${item.urs_code} - ${item.reason}</li>`;
    });
    html += '</ul>';
  }

  if (candidates.length === 0) {
    debugLog('📋 No candidates found, showing empty message');
    html += '<p class="loading">Nebyly nalezeny žádné pozice</p>';
  }

  html += '</div>';

  debugLog('📋 Setting resultsContainer.innerHTML, container exists:', !!resultsContainer);
  debugLog('📋 HTML length:', html.length);

  resultsContainer.innerHTML = html;
  debugLog('📋 ✓ Results displayed successfully');
}

function displayBlockMatchResults(job) {
  debugLog('📊 displayBlockMatchResults() called with job:', job);

  const blocks = job.blocks || [];
  const jobId = job.job_id || '';
  const blocksCount = job.blocks_count || 0;

  debugLog('📊 Processing blocks:', { blocksCount, actualLength: blocks.length });

  let html = '<div class="block-match-results">';

  // Summary section
  html += `<div class="results-summary">
    <p><strong>Job ID:</strong> ${jobId}</p>
    <p><strong>Bloku nalezeno:</strong> ${blocksCount}</p>
  </div>`;

  if (blocks.length === 0) {
    html += '<p class="loading">Nebyl nalezen žádný blok</p>';
    resultsContainer.innerHTML = html + '</div>';
    return;
  }

  // Process each block
  blocks.forEach((block, blockIdx) => {
    debugLog(`📊 Processing block ${blockIdx + 1}:`, block);

    const blockName = block.block_name || `Blok ${blockIdx + 1}`;
    const items = block.items || [];
    const validation = block.multi_role_validation || {};
    const completenessScore = validation.completeness_score || 0;
    const missingItems = validation.missing_items || [];

    // Block header
    html += `<h3 class="group-header">📂 ${blockName} <span class="group-count">(${items.length} položek, kompletnost ${completenessScore}%)</span></h3>`;

    // Items table
    if (items.length > 0) {
      html += '<table class="results-table grouped-table"><thead><tr>';
      html += '<th>Řádek</th><th>Vstupní text</th><th>Kód ÚRS</th><th>Název</th><th>MJ</th>';
      html += '</tr></thead><tbody>';

      items.forEach((item) => {
        const rowId = item.row_id || '';
        const inputText = item.input_text || '';
        const ursCode = item.selected_urs?.urs_code || '';
        const ursName = item.selected_urs?.urs_name || '';
        const unit = item.selected_urs?.unit || '';

        html += `
          <tr>
            <td>${rowId}</td>
            <td><small>${inputText.substring(0, 50)}${inputText.length > 50 ? '...' : ''}</small></td>
            <td><strong>${ursCode}</strong></td>
            <td>${ursName}</td>
            <td>${unit}</td>
          </tr>
        `;
      });

      html += '</tbody></table>';
    } else {
      html += '<p class="loading">Žádné položky v tomto bloku</p>';
    }

    // Missing items section
    if (missingItems.length > 0) {
      html += '<div class="missing-items"><strong>⚠️ Chybějící položky:</strong><ul>';
      missingItems.forEach((item) => {
        html += `<li>${item}</li>`;
      });
      html += '</ul></div>';
    }
  });

  html += '</div>';

  debugLog('📊 Setting resultsContainer.innerHTML');
  resultsContainer.innerHTML = html;
  debugLog('📊 ✓ Block match results displayed successfully');
}

// ============================================================================
// NAVIGATION
// ============================================================================

function showUpload() {
  debugLog('📄 Showing upload section');
  uploadSection.classList.add('active');
  uploadSection.classList.remove('hidden');
  resultsSection.classList.remove('active');
  resultsSection.classList.add('hidden');
  errorSection.classList.remove('active');
  errorSection.classList.add('hidden');
}

function showResults() {
  debugLog('📋 Showing results section');
  uploadSection.classList.remove('active');
  uploadSection.classList.add('hidden');
  resultsSection.classList.add('active');
  resultsSection.classList.remove('hidden');
  errorSection.classList.remove('active');
  errorSection.classList.add('hidden');
}

function showError(message) {
  debugError('⚠️ Showing error:', message);
  uploadSection.classList.remove('active');
  uploadSection.classList.add('hidden');
  resultsSection.classList.remove('active');
  resultsSection.classList.add('hidden');
  errorSection.classList.add('active');
  errorSection.classList.remove('hidden');
  errorMessage.textContent = message;
}

backBtn.addEventListener('click', () => {
  debugLog('🔙 Back button clicked');
  showUpload();
});

errorBackBtn.addEventListener('click', () => {
  debugLog('🔙 Error back button clicked');
  showUpload();
});

// ============================================================================
// EXPORT FUNCTIONS
// ============================================================================

exportBtn.addEventListener('click', async () => {
  if (!currentResults) return;

  try {
    exportBtn.disabled = true;
    exportBtn.textContent = 'Příprava...';

    let csv = '';
    let items = currentResults.items || [];

    // Handle block-match results (blocks instead of items)
    if (!items.length && currentResults.blocks) {
      csv = 'Blok,Řádek,Vstupní text,Kód ÚRS,Název,MJ\n';
      currentResults.blocks.forEach((block) => {
        const blockName = block.block_name || '';
        (block.items || []).forEach((item) => {
          const rowId = item.row_id || '';
          const inputText = item.input_text || '';
          const ursCode = item.selected_urs?.urs_code || '';
          const ursName = item.selected_urs?.urs_name || '';
          const unit = item.selected_urs?.unit || '';
          csv += `"${blockName}","${rowId}","${inputText}","${ursCode}","${ursName}","${unit}"\n`;
        });
      });
    } else {
      // Handle text-match results (regular items)
      csv = 'Řádek,Vstupní text,Kód ÚRS,Název,MJ,Množství,Jistota,Typ\n';
      items.forEach((item) => {
        const type = item.extra_generated ? 'Doplňková' : 'Přímá';
        csv += `"${item.input_row_id}","${item.input_text}","${item.urs_code}","${item.urs_name}","${item.unit}","${item.quantity}","${item.confidence.toFixed(2)}","${type}"\n`;
      });
    }

    // Create download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.setAttribute('href', URL.createObjectURL(blob));
    link.setAttribute('download', `urs_results_${new Date().getTime()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

  } catch (error) {
    alert(`Chyba při exportu: ${error.message}`);
  } finally {
    exportBtn.disabled = false;
    exportBtn.textContent = '📥 Stáhnout Excel';
  }
});

copyBtn.addEventListener('click', () => {
  if (!currentResults) return;

  try {
    let text = 'Výsledky hledání ÚRS\n\n';
    const items = currentResults.items || [];

    // Handle block-match results (blocks instead of items)
    if (!items.length && currentResults.blocks) {
      currentResults.blocks.forEach((block) => {
        text += `📂 ${block.block_name}\n`;
        (block.items || []).forEach((item) => {
          const ursCode = item.selected_urs?.urs_code || '';
          const ursName = item.selected_urs?.urs_name || '';
          const unit = item.selected_urs?.unit || '';
          text += `  ${ursCode} | ${ursName} | ${unit}\n`;
        });
        text += '\n';
      });
    } else {
      // Handle text-match results (regular items)
      items.forEach((item) => {
        text += `${item.urs_code} | ${item.urs_name} | ${item.unit} | ${item.quantity}\n`;
      });
    }

    navigator.clipboard.writeText(text).then(() => {
      copyBtn.textContent = '✓ Zkopírováno';
      setTimeout(() => {
        copyBtn.textContent = '📋 Kopírovat do schránky';
      }, 2000);
    });
  } catch (error) {
    alert(`Chyba: ${error.message}`);
  }
});

// ============================================================================
// PHASE 2: DOCUMENT UPLOAD & CONTEXT EDITOR
// ============================================================================

// Get Phase 2 DOM elements
const openDocUploadBtn = document.getElementById('openDocUploadBtn');
const docUploadSection = document.getElementById('docUploadSection');
const contextEditorSection = document.getElementById('contextEditorSection');
const documentUploadContainer = document.getElementById('documentUploadContainer');
const contextEditorContainer = document.getElementById('contextEditorContainer');

// Open document upload
openDocUploadBtn?.addEventListener('click', () => {
  debugLog('📄 Document upload button clicked');
  loadDocumentUploadComponent();
});

async function loadDocumentUploadComponent() {
  try {
    debugLog('📄 Loading DocumentUpload.html');
    const response = await fetch('/components/DocumentUpload.html');
    if (!response.ok) throw new Error('Failed to load component');
    const html = await response.text();
    documentUploadContainer.innerHTML = html;
    showDocUploadSection();
    debugLog('📄 ✓ DocumentUpload component loaded');
  } catch (error) {
    debugError('📄 Failed to load DocumentUpload:', error);
    showError(`Chyba při načítání komponenty: ${error.message}`);
  }
}

async function loadContextEditorComponent() {
  try {
    debugLog('🔧 Loading ContextEditor.html');
    const response = await fetch('/components/ContextEditor.html');
    if (!response.ok) throw new Error('Failed to load component');
    const html = await response.text();
    contextEditorContainer.innerHTML = html;
    showContextEditorSection();
    debugLog('🔧 ✓ ContextEditor component loaded');
  } catch (error) {
    debugError('🔧 Failed to load ContextEditor:', error);
    showError(`Chyba při načítání editory: ${error.message}`);
  }
}

function showDocUploadSection() {
  debugLog('📄 Showing document upload section');
  uploadSection.classList.add('hidden');
  uploadSection.classList.remove('active');
  docUploadSection.classList.remove('hidden');
  docUploadSection.classList.add('active');
  resultsSection.classList.add('hidden');
  resultsSection.classList.remove('active');
  errorSection.classList.add('hidden');
  errorSection.classList.remove('active');
}

function showContextEditorSection() {
  debugLog('🔧 Showing context editor section');
  uploadSection.classList.add('hidden');
  uploadSection.classList.remove('active');
  contextEditorSection.classList.remove('hidden');
  contextEditorSection.classList.add('active');
  resultsSection.classList.add('hidden');
  resultsSection.classList.remove('active');
  errorSection.classList.add('hidden');
  errorSection.classList.remove('active');
}

// ============================================================================
// PHASE 3: ADVANCED MULTI-ROLE ANALYSIS
// ============================================================================

const phase3ResultsSection = document.getElementById('phase3ResultsSection');
const backFromPhase3Btn = document.getElementById('backFromPhase3Btn');

backFromPhase3Btn?.addEventListener('click', () => {
  debugLog('🔙 Back from Phase 3 Advanced');
  showUpload();
});

function showPhase3Results() {
  debugLog('🤖 Showing Phase 3 Advanced results');
  uploadSection.classList.add('hidden');
  uploadSection.classList.remove('active');
  docUploadSection.classList.add('hidden');
  docUploadSection.classList.remove('active');
  contextEditorSection.classList.add('hidden');
  contextEditorSection.classList.remove('active');
  resultsSection.classList.add('hidden');
  resultsSection.classList.remove('active');
  phase3ResultsSection.classList.remove('hidden');
  phase3ResultsSection.classList.add('active');
  errorSection.classList.add('hidden');
  errorSection.classList.remove('active');
}

function displayPhase3Results(data) {
  debugLog('🤖 displayPhase3Results() called with data:', data);

  // Display complexity classification
  if (data.complexity_classification) {
    displayComplexityClassification(data.complexity_classification);
  }

  // Display selected roles
  if (data.selected_roles) {
    displaySelectedRoles(data.selected_roles);
  }

  // Display conflicts if present
  if (data.conflicts && data.conflicts.length > 0) {
    displayConflicts(data.conflicts);
  }

  // Display analysis results
  if (data.analysis_results) {
    displayAnalysisResults(data.analysis_results);
  }

  // Display audit trail if available
  if (data.audit_trail) {
    displayAuditTrail(data.audit_trail);
  }

  showPhase3Results();
}

function displayComplexityClassification(complexity) {
  const complexityLevel = document.getElementById('complexityLevel');
  const complexityDescription = document.getElementById('complexityDescription');
  const rowCount = document.getElementById('rowCount');
  const completenessScore = document.getElementById('completenessScore');
  const specialKeywords = document.getElementById('specialKeywords');

  const levelEmoji = {
    'SIMPLE': '🟢',
    'STANDARD': '🟡',
    'COMPLEX': '🟠',
    'CREATIVE': '🔴'
  };

  const levelDescription = {
    'SIMPLE': 'Jednoduchá - základní párování',
    'STANDARD': 'Standardní - 3 specialisté',
    'COMPLEX': 'Složitá - 5 specialistů',
    'CREATIVE': 'Tvůrčí - všech 6 specialistů'
  };

  complexityLevel.textContent = `${levelEmoji[complexity.classification] || '?'} ${complexity.classification}`;
  complexityDescription.textContent = levelDescription[complexity.classification] || 'Neznámá úroveň';
  rowCount.textContent = complexity.row_count || 0;
  completenessScore.textContent = (complexity.completeness_score || 0).toFixed(0);
  specialKeywords.textContent = (complexity.special_keywords || []).join(', ') || 'žádná';

  debugLog('🤖 Complexity classification displayed');
}

function displaySelectedRoles(roles) {
  const rolesGrid = document.getElementById('rolesGrid');
  rolesGrid.innerHTML = '';

  const roleEmojis = {
    'document_validator': '📋',
    'structural_engineer': '🏗️',
    'concrete_specialist': '🧪',
    'standards_checker': '📏',
    'tech_rules_engine': '⚙️',
    'cost_estimator': '💰'
  };

  const roleNames = {
    'document_validator': 'Validátor Dokumentů',
    'structural_engineer': 'Stavbyvedoucí',
    'concrete_specialist': 'Specialista Betonu',
    'standards_checker': 'Kontrola Norem',
    'tech_rules_engine': 'Technologické Pravidla',
    'cost_estimator': 'Odhad Nákladů'
  };

  roles.forEach(role => {
    const roleCard = document.createElement('div');
    roleCard.className = 'role-card';
    roleCard.innerHTML = `
      <div class="role-icon">${roleEmojis[role] || '👤'}</div>
      <div class="role-name">${roleNames[role] || role}</div>
      <div class="role-status">✓ Vybráno</div>
    `;
    rolesGrid.appendChild(roleCard);
  });

  debugLog('🤖 Selected roles displayed:', roles);
}

function displayConflicts(conflicts) {
  const conflictSection = document.getElementById('conflictSection');
  const conflictsList = document.getElementById('conflictsList');

  if (!conflicts || conflicts.length === 0) {
    conflictSection.style.display = 'none';
    return;
  }

  conflictSection.style.display = 'block';
  conflictsList.innerHTML = '';

  const severityEmoji = {
    'CRITICAL': '🔴',
    'HIGH': '🟠',
    'MEDIUM': '🟡',
    'LOW': '🟢'
  };

  conflicts.forEach((conflict, idx) => {
    const conflictDiv = document.createElement('div');
    conflictDiv.className = `conflict-item conflict-${(conflict.severity || 'MEDIUM').toLowerCase()}`;
    conflictDiv.innerHTML = `
      <div class="conflict-header">
        <span class="severity-badge">${severityEmoji[conflict.severity] || '?'} ${conflict.severity}</span>
        <span class="conflict-type">${conflict.type}</span>
      </div>
      <p class="conflict-description">${conflict.description || 'Žádný popis'}</p>
      <p class="conflict-resolution"><strong>Řešení:</strong> ${conflict.resolution || 'Čeká na řešení'}</p>
    `;
    conflictsList.appendChild(conflictDiv);
  });

  debugLog('🤖 Conflicts displayed:', conflicts.length);
}

function displayAnalysisResults(results) {
  const analysisResults = document.getElementById('analysisResults');
  analysisResults.innerHTML = '';

  if (!results) return;

  const resultDiv = document.createElement('div');
  resultDiv.className = 'analysis-content';
  resultDiv.innerHTML = `
    <pre>${JSON.stringify(results, null, 2)}</pre>
  `;
  analysisResults.appendChild(resultDiv);

  debugLog('🤖 Analysis results displayed');
}

function displayAuditTrail(auditTrail) {
  const auditSection = document.getElementById('auditSection');
  const auditTrailDiv = document.getElementById('auditTrail');

  if (!auditTrail || auditTrail.length === 0) {
    auditSection.style.display = 'none';
    return;
  }

  auditSection.style.display = 'block';
  auditTrailDiv.innerHTML = '';

  auditTrail.forEach((entry) => {
    const entryDiv = document.createElement('div');
    entryDiv.className = 'audit-entry';
    const timestamp = new Date(entry.timestamp).toLocaleString('cs-CZ');
    entryDiv.innerHTML = `
      <div class="audit-time">${timestamp}</div>
      <div class="audit-action">${entry.action}</div>
      <div class="audit-details">${entry.details || ''}</div>
    `;
    auditTrailDiv.appendChild(entryDiv);
  });

  debugLog('🤖 Audit trail displayed:', auditTrail.length);
}

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  debugLog('✅ DOMContentLoaded event fired');
  debugLog('📄 Document ready, showing upload section');
  showUpload();
  debugLog('✅ Initialization complete');
});

// Also log when window loads (redundancy check)
window.addEventListener('load', () => {
  debugLog('✅ Window load event fired');
});

// Global error handler
window.addEventListener('error', (event) => {
  debugError('⚠️ Global JS error:', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error?.toString()
  });
});

// Global unhandled promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
  debugError('⚠️ Unhandled promise rejection:', {
    reason: event.reason?.toString()
  });
});
