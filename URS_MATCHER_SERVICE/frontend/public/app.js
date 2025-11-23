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
  debugLog('📁 Upload button state:', { disabled: uploadBtn.disabled });
}

uploadBtn.addEventListener('click', () => {
  debugLog('🔵 Upload button clicked');
  uploadFile();
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
 * Group items by work type based on URS name keywords
 */
function groupItemsByWorkType(items) {
  const categories = {
    'Zdivo a konstrukce': ['zdivo', 'zdi', 'konstrukce', 'svislé'],
    'Základy': ['základ', 'základov'],
    'Bednění': ['bednění', 'bedněn'],
    'Výztuž a armatura': ['výztuž', 'armatur', 'betonář'],
    'Betony': ['beton', 'žb', 'železobeton'],
    'Překlady': ['překlad'],
    'Prostupy': ['prostup'],
    'Sloupy a pilíře': ['sloup', 'pilíř'],
    'Stropy': ['strop'],
    'Izolace': ['izolac', 'hydroizolac'],
    'Lešení': ['lešen', 'lešení'],
    'Ostatní': []  // catch-all
  };

  const grouped = {};

  items.forEach(item => {
    const nameLC = (item.urs_name || item.input_text || '').toLowerCase();

    let matched = false;
    for (const [category, keywords] of Object.entries(categories)) {
      if (category === 'Ostatní') continue;

      if (keywords.some(kw => nameLC.includes(kw))) {
        if (!grouped[category]) grouped[category] = [];
        grouped[category].push(item);
        matched = true;
        break;
      }
    }

    // If no match, add to Ostatní
    if (!matched) {
      if (!grouped['Ostatní']) grouped['Ostatní'] = [];
      grouped['Ostatní'].push(item);
    }
  });

  // Remove empty categories
  Object.keys(grouped).forEach(key => {
    if (grouped[key].length === 0) {
      delete grouped[key];
    }
  });

  return grouped;
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

    // Simple CSV export for now
    const items = currentResults.items || [];
    let csv = 'Řádek,Vstupní text,Kód ÚRS,Název,MJ,Množství,Jistota,Typ\n';

    items.forEach((item) => {
      const type = item.extra_generated ? 'Doplňková' : 'Přímá';
      csv += `"${item.input_row_id}","${item.input_text}","${item.urs_code}","${item.urs_name}","${item.unit}","${item.quantity}","${item.confidence.toFixed(2)}","${type}"\n`;
    });

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
    const items = currentResults.items || [];
    let text = 'Výsledky hledání ÚRS\n\n';

    items.forEach((item) => {
      text += `${item.urs_code} | ${item.urs_name} | ${item.unit} | ${item.quantity}\n`;
    });

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
