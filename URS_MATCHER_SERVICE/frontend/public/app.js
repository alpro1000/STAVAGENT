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
const processFileBtn = document.getElementById('processFileBtn');
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
const exportToRegistryBtn = document.getElementById('exportToRegistryBtn');

// Theme Toggle Elements
const themeToggle = document.getElementById('themeToggle');
const themeIcon = document.getElementById('themeIcon');
const themeText = document.getElementById('themeText');

// Processing Mode Elements
const fastModeRadio = document.getElementById('fastModeRadio');
const advancedModeRadio = document.getElementById('advancedModeRadio');

// ============================================================================
// THEME TOGGLE (Digital Concrete Design System v2.0)
// ============================================================================

function initTheme() {
  // Load saved theme or use system preference
  const savedTheme = localStorage.getItem('urs-matcher-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const initialTheme = savedTheme || (prefersDark ? 'dark' : 'light');

  setTheme(initialTheme);
  debugLog(`🎨 Theme initialized: ${initialTheme}`);
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('urs-matcher-theme', theme);

  // Update button UI
  if (theme === 'dark') {
    themeIcon.textContent = '☀️';
    themeText.textContent = 'Světlý režim';
  } else {
    themeIcon.textContent = '🌙';
    themeText.textContent = 'Tmavý režim';
  }

  debugLog(`🎨 Theme switched to: ${theme}`);
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  setTheme(newTheme);
}

// Theme Toggle Event Listener
if (themeToggle) {
  themeToggle.addEventListener('click', toggleTheme);
  debugLog('✅ Theme toggle button initialized');
} else {
  debugError('⚠️ Theme toggle button not found!');
}

// Initialize theme on load
initTheme();

// ============================================================================
// MODEL SELECTOR
// ============================================================================

const modelSelect = document.getElementById('modelSelect');
const modelStatus = document.getElementById('modelStatus');

/**
 * Load available models from the API
 */
async function loadModels() {
  debugLog('🤖 Loading models...');

  try {
    const response = await fetch(`${API_URL}/settings/models`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    debugLog('🤖 Models loaded:', data);

    if (!data.success || !data.models) {
      throw new Error('Invalid response format');
    }

    // Populate the select dropdown
    modelSelect.innerHTML = '';

    // Group models by provider
    const modelsByProvider = {};
    data.models.forEach(model => {
      const provider = model.provider || 'other';
      if (!modelsByProvider[provider]) {
        modelsByProvider[provider] = [];
      }
      modelsByProvider[provider].push(model);
    });

    // Add models to select, grouped by provider
    Object.entries(modelsByProvider).forEach(([provider, models]) => {
      const optgroup = document.createElement('optgroup');
      optgroup.label = formatProviderName(provider);

      models.forEach(model => {
        const option = document.createElement('option');
        option.value = model.id;
        option.textContent = model.name;
        option.disabled = !model.available;

        // Mark current model as selected
        if (data.currentModel && model.id === data.currentModel.model) {
          option.selected = true;
        }

        // Add pricing info as data attribute
        if (model.pricing) {
          option.dataset.pricing = model.pricing.tier || 'standard';
        }

        optgroup.appendChild(option);
      });

      modelSelect.appendChild(optgroup);
    });

    // Update status badge
    updateModelStatus(data.currentModel);

    debugLog('🤖 Model selector populated with', data.models.length, 'models');

  } catch (error) {
    debugError('🤖 Failed to load models:', error);
    modelSelect.innerHTML = '<option value="">Chyba načítání</option>';
    updateModelStatus({ error: true });
  }
}

/**
 * Format provider name for display
 */
function formatProviderName(provider) {
  const names = {
    'claude': 'Anthropic Claude',
    'openai': 'OpenAI',
    'gemini': 'Google Gemini',
    'deepseek': 'DeepSeek',
    'grok': 'xAI Grok',
    'qwen': 'Alibaba Qwen',
    'glm': 'Zhipu GLM'
  };
  return names[provider] || provider.charAt(0).toUpperCase() + provider.slice(1);
}

/**
 * Update the model status badge
 */
function updateModelStatus(currentModel) {
  if (!modelStatus) return;

  if (currentModel?.error) {
    modelStatus.textContent = 'Chyba';
    modelStatus.className = 'model-status error';
    return;
  }

  if (!currentModel) {
    modelStatus.textContent = '';
    return;
  }

  // Determine pricing tier based on model
  const modelId = currentModel.model || '';
  let tier = 'standard';
  let label = '';

  // Free tier models
  if (modelId.includes('glm-4-flash') || modelId.includes('glm-4-free')) {
    tier = 'free';
    label = 'ZDARMA';
  }
  // Cheap tier models
  else if (modelId.includes('deepseek') || modelId.includes('qwen') || modelId.includes('gemini-flash')) {
    tier = 'cheap';
    label = 'Levný';
  }
  // Premium tier models
  else if (modelId.includes('claude') || modelId.includes('gpt-4') || modelId.includes('opus')) {
    tier = 'premium';
    label = 'Premium';
  }
  else {
    tier = 'cheap';
    label = 'Aktivní';
  }

  modelStatus.textContent = label;
  modelStatus.className = `model-status ${tier}`;
}

/**
 * Handle model selection change
 */
async function handleModelChange(event) {
  const selectedModel = event.target.value;

  if (!selectedModel) return;

  debugLog('🤖 Changing model to:', selectedModel);

  // Disable select during update
  modelSelect.disabled = true;

  try {
    const response = await fetch(`${API_URL}/settings/model`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ model: selectedModel })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Failed to set model');
    }

    debugLog('🤖 Model changed successfully:', data);

    // Update status badge
    updateModelStatus(data);

    // Save preference to localStorage
    localStorage.setItem('urs-matcher-model', selectedModel);

  } catch (error) {
    debugError('🤖 Failed to change model:', error);

    // Revert to previous selection
    const savedModel = localStorage.getItem('urs-matcher-model');
    if (savedModel && savedModel !== selectedModel) {
      modelSelect.value = savedModel;
    }

    // Show error briefly
    modelStatus.textContent = 'Chyba!';
    modelStatus.className = 'model-status error';

    setTimeout(() => {
      loadModels(); // Reload to get correct state
    }, 2000);

  } finally {
    modelSelect.disabled = false;
  }
}

// Initialize model selector
if (modelSelect) {
  modelSelect.addEventListener('change', handleModelChange);
  loadModels();
  debugLog('✅ Model selector initialized');
} else {
  debugError('⚠️ Model selector element not found!');
}

// ============================================================================
// PROCESSING MODE TOGGLE
// ============================================================================

function initProcessingMode() {
  // Load saved mode preference
  const savedMode = localStorage.getItem('urs-matcher-advanced-mode');
  const isAdvanced = savedMode === 'true';

  if (fastModeRadio && advancedModeRadio) {
    if (isAdvanced) {
      advancedModeRadio.checked = true;
    } else {
      fastModeRadio.checked = true;
    }
    debugLog(`🔧 Processing mode initialized: ${isAdvanced ? 'Advanced' : 'Fast'}`);
  }
}

// Processing Mode Change Event Listeners
if (fastModeRadio) {
  fastModeRadio.addEventListener('change', (e) => {
    if (e.target.checked) {
      localStorage.setItem('urs-matcher-advanced-mode', 'false');
      debugLog('🔧 Processing mode changed to: Fast');
    }
  });
}

if (advancedModeRadio) {
  advancedModeRadio.addEventListener('change', (e) => {
    if (e.target.checked) {
      localStorage.setItem('urs-matcher-advanced-mode', 'true');
      debugLog('🔧 Processing mode changed to: Advanced');
    }
  });
}

if (fastModeRadio && advancedModeRadio) {
  debugLog('✅ Processing mode toggle initialized');
} else {
  debugError('⚠️ Processing mode radio buttons not found!');
}

// Initialize processing mode on load
initProcessingMode();

let currentJobId = null;
let currentResults = null;

// Verify all DOM elements exist
debugLog('✓ DOM Elements found:', {
  fileInput: !!fileInput,
  fileDropZone: !!fileDropZone,
  processFileBtn: !!processFileBtn,
  fastModeRadio: !!fastModeRadio,
  advancedModeRadio: !!advancedModeRadio,
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
  processFileBtn.disabled = !hasFile;
  debugLog('📁 Process button state:', { disabled: processFileBtn.disabled });
}

processFileBtn.addEventListener('click', () => {
  debugLog('🔵 Process file button clicked');
  processFile();
});

async function processFile() {
  debugLog('📊 processFile() called');

  if (!fileInput.files || !fileInput.files[0]) {
    debugError('No file selected');
    showError('Prosím, vyberte soubor');
    return;
  }

  processFileBtn.disabled = true;
  processFileBtn.textContent = 'Zpracování...';
  debugLog('📊 Starting block-match with file:', { name: fileInput.files[0].name, size: fileInput.files[0].size });

  try {
    const formData = new FormData();
    formData.append('file', fileInput.files[0]);

    // Choose endpoint based on processing mode
    const isAdvancedMode = advancedModeRadio && advancedModeRadio.checked;
    const endpoint = isAdvancedMode ? '/jobs/block-match' : '/jobs/block-match-fast';

    debugLog(`📊 Processing mode: ${isAdvancedMode ? 'Advanced (Multi-Role)' : 'Fast (Optimized)'}`);
    debugLog('📊 Sending POST to:', `${API_URL}${endpoint}`);

    const response = await fetch(`${API_URL}${endpoint}`, {
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
    resultsTitle.textContent = 'Výsledky zpracování';
    showResults();
    displayBlockMatchResults(data);

  } catch (error) {
    debugError('📊 Process file error:', error);
    showError(`Chyba zpracování: ${error.message}`);
  } finally {
    processFileBtn.disabled = false;
    processFileBtn.textContent = '📊 Zpracovat soubor';
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
    // Dual search: text-match (local DB + OTSKP + Perplexity) + pipeline (OTSKP + TSKP classification)
    const textMatchUrl = `${API_URL}/jobs/text-match`;
    const pipelineUrl = `${API_URL}/pipeline/match`;
    debugLog('🔍 Sending dual search to:', textMatchUrl, 'and', pipelineUrl);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);

    const [textMatchRes, pipelineRes] = await Promise.allSettled([
      fetch(textMatchUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      }),
      fetch(pipelineUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, catalog: 'both', topN: 5, minConfidence: 0.25 }),
        signal: controller.signal
      })
    ]);

    clearTimeout(timeoutId);

    // Parse text-match response
    let data = { candidates: [], related_items: [] };
    if (textMatchRes.status === 'fulfilled' && textMatchRes.value.ok) {
      data = await textMatchRes.value.json();
    }

    // Parse pipeline response and merge OTSKP candidates
    if (pipelineRes.status === 'fulfilled' && pipelineRes.value.ok) {
      const pipelineData = await pipelineRes.value.json();
      const pipelineCandidates = (pipelineData.data?.candidates || []).map(c => ({
        urs_code: c.code,
        urs_name: c.name,
        unit: c.unit || '',
        confidence: c.confidence,
        price: c.price || null,
        source: c.source || 'otskp'
      }));

      // Merge: add pipeline candidates not already in text-match results
      const existingCodes = new Set(data.candidates.map(c => c.urs_code));
      for (const pc of pipelineCandidates) {
        if (!existingCodes.has(pc.urs_code)) {
          data.candidates.push(pc);
          existingCodes.add(pc.urs_code);
        }
      }
      // Re-sort by confidence
      data.candidates.sort((a, b) => b.confidence - a.confidence);
      // Add TSKP classification info
      if (pipelineData.data?.classification) {
        data.tskp_classification = pipelineData.data.classification;
      }
    }

    debugLog('🔍 ✓ Merged candidates count:', data.candidates?.length || 0);

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

  // TSKP classification badge
  const tskp = data.tskp_classification;
  if (tskp && tskp.sectionCode) {
    html += `<div class="tskp-badge" style="margin-bottom:12px;padding:8px 12px;background:rgba(255,159,28,0.1);border-left:3px solid #FF9F1C;border-radius:4px;">
      <strong>TSKP:</strong> ${tskp.sectionCode} — ${tskp.sectionName || ''}
      <span style="color:#888;margin-left:8px;">(${(tskp.confidence * 100).toFixed(0)}%)</span>
    </div>`;
  }

  if (candidates.length > 0) {
    debugLog('📋 Building table for', candidates.length, 'candidates');
    html += '<h3>🎯 Doporučené pozice:</h3>';
    html += '<table class="results-table"><thead><tr>';
    html += '<th>Kód</th><th>Název</th><th>MJ</th><th>Cena</th><th>Zdroj</th><th>Jistota</th>';
    html += '</tr></thead><tbody>';

    candidates.forEach((item, idx) => {
      debugLog(`📋 Building row ${idx + 1}:`, item);
      const confidenceClass = item.confidence > 0.8
        ? 'confidence-high'
        : 'confidence-medium';
      const priceStr = item.price ? `${Number(item.price).toLocaleString('cs-CZ')} Kč` : '—';
      const sourceLabel = item.source === 'otskp' ? 'OTSKP' : (item.source === 'perplexity' ? 'Perplexity' : (item.source || 'local'));

      html += `
        <tr>
          <td><strong>${item.urs_code}</strong></td>
          <td>${item.urs_name}</td>
          <td>${item.unit}</td>
          <td>${priceStr}</td>
          <td><span class="source-badge">${sourceLabel}</span></td>
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

  // LLM info
  const llmInfo = job.llm_info || {};
  const llmStatus = llmInfo.enabled
    ? `✅ ${llmInfo.provider?.toUpperCase() || 'N/A'} / ${llmInfo.model || 'N/A'}`
    : '❌ Vypnuto (chybí API klíč)';

  // Summary section
  html += `<div class="results-summary">
    <p><strong>Job ID:</strong> ${jobId}</p>
    <p><strong>Bloku nalezeno:</strong> ${blocksCount}</p>
    <p><strong>🤖 LLM Model:</strong> ${llmStatus}</p>
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
    const analysis = block.analysis || {};
    const items = analysis.items || block.items || [];
    const validation = analysis.multi_role_validation || block.multi_role_validation || {};
    const completenessScore = validation.completeness_score || 0;
    const missingItems = validation.missing_items || [];
    const phase3 = analysis.phase3_advanced || null;

    // Block header
    html += `<h3 class="group-header">📂 ${blockName} <span class="group-count">(${items.length} položek, kompletnost ${completenessScore}%)</span></h3>`;

    // Phase 3 Advanced section (if available)
    if (phase3) {
      debugLog(`📊 Phase 3 data found for block ${blockIdx + 1}:`, phase3);

      const complexity = phase3.complexity_classification || {};
      const roles = phase3.selected_roles || [];
      const conflicts = phase3.conflicts || [];

      // Complexity badge
      const complexityEmoji = {
        'SIMPLE': '🟢',
        'STANDARD': '🟡',
        'COMPLEX': '🟠',
        'CREATIVE': '🔴'
      };

      html += '<div class="phase3-panel">';
      html += `<div class="phase3-header">🤖 <strong>Multi-Role Analýza</strong></div>`;

      // Complexity
      if (complexity.classification) {
        html += `<div class="phase3-complexity">
          <span class="complexity-badge">${complexityEmoji[complexity.classification] || '⚪'} ${complexity.classification}</span>
          <span class="execution-time">⏱️ ${phase3.execution_time_ms || 0}ms</span>
          ${phase3.cache_status?.from_cache ? '<span class="cache-hit">📦 z cache</span>' : ''}
        </div>`;
      }

      // Roles consulted
      if (roles.length > 0) {
        const roleNames = {
          'document_validator': '📋 Validátor',
          'structural_engineer': '🏗️ Statik',
          'concrete_specialist': '🧪 Betonář',
          'standards_checker': '📏 Normy',
          'tech_rules_engine': '⚙️ Tech.pravidla',
          'cost_estimator': '💰 Rozpočtář'
        };
        html += `<div class="phase3-roles">👥 Role: ${roles.map(r => roleNames[r] || r).join(', ')}</div>`;
      }

      // Conflicts (if any)
      if (conflicts.length > 0) {
        html += `<div class="phase3-conflicts">`;
        html += `<strong>⚠️ Konflikty (${conflicts.length}):</strong>`;
        conflicts.forEach((conflict, cIdx) => {
          const severityClass = (conflict.severity || 'MEDIUM').toLowerCase();
          html += `<div class="conflict-item conflict-${severityClass}">
            <span class="conflict-severity">${conflict.severity || 'MEDIUM'}</span>
            <span class="conflict-type">${conflict.type || 'Neznámý'}</span>
            <p class="conflict-desc">${conflict.description || ''}</p>
            ${conflict.resolution ? `<p class="conflict-resolution">💡 ${conflict.resolution}</p>` : ''}
          </div>`;
        });
        html += `</div>`;
      }

      html += '</div>';
    }

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

    // Helper: escape CSV field with semicolon separator
    const esc = (val) => {
      if (val === null || val === undefined) return '';
      const s = String(val);
      if (s.includes('"') || s.includes(';') || s.includes('\n')) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    };

    let csv = 'sep=;\n';
    let items = currentResults.items || [];
    const candidates = currentResults.candidates || [];
    const relatedItems = currentResults.related_items || [];

    // Handle text-match results (manual input)
    if (candidates.length > 0) {
      csv += 'Typ;Kód ÚRS;Název;MJ;Jistota (%);Důvod\n';

      candidates.forEach((item) => {
        const confidence = ((item.confidence || 0) * 100).toFixed(0);
        csv += [esc('Hlavní'), esc(item.urs_code), esc(item.urs_name), esc(item.unit), confidence, esc(item.reason)].join(';') + '\n';
      });

      if (relatedItems.length > 0) {
        relatedItems.forEach((item) => {
          csv += [esc('Doplňková'), esc(item.urs_code), esc(item.urs_name), esc(item.unit), '', esc(item.reason)].join(';') + '\n';
        });
      }
    }
    // Handle block-match results
    else if (!items.length && currentResults.blocks) {
      csv += 'Blok;Řádek;Vstupní text;Kód ÚRS;Název;MJ\n';
      currentResults.blocks.forEach((block) => {
        const blockName = block.block_name || '';
        (block.items || []).forEach((item) => {
          csv += [esc(blockName), esc(item.row_id), esc(item.input_text), esc(item.selected_urs?.urs_code), esc(item.selected_urs?.urs_name), esc(item.selected_urs?.unit)].join(';') + '\n';
        });
      });
    } else {
      // Handle regular file upload results
      csv += 'Řádek;Vstupní text;Kód ÚRS;Název;MJ;Množství;Jistota;Typ\n';
      items.forEach((item) => {
        const type = item.extra_generated ? 'Doplňková' : 'Přímá';
        csv += [esc(item.input_row_id), esc(item.input_text), esc(item.urs_code), esc(item.urs_name), esc(item.unit), item.quantity || '', item.confidence?.toFixed(2) || '', type].join(';') + '\n';
      });
    }

    // Download with UTF-8 BOM for Excel compatibility
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.setAttribute('href', URL.createObjectURL(blob));
    link.setAttribute('download', `urs_vysledky_${new Date().getTime()}.csv`);
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
    let text = 'Výsledky hledání ÚRS\n';
    text += '═'.repeat(60) + '\n\n';

    const items = currentResults.items || [];
    const candidates = currentResults.candidates || [];
    const relatedItems = currentResults.related_items || [];

    // Handle text-match results (manual input)
    if (candidates.length > 0) {
      text += '🎯 DOPORUČENÉ POZICE ÚRS:\n';
      text += '─'.repeat(60) + '\n';

      candidates.forEach((item, idx) => {
        const confidence = ((item.confidence || 0) * 100).toFixed(0);
        text += `${idx + 1}. ${item.urs_code || ''} | ${item.urs_name || ''}\n`;
        text += `   MJ: ${item.unit || ''} | Jistota: ${confidence}%\n`;
        if (item.reason) {
          text += `   Důvod: ${item.reason}\n`;
        }
        text += '\n';
      });

      if (relatedItems.length > 0) {
        text += '\n⚙️ DOPORUČENÉ DOPLŇKOVÉ PRÁCE:\n';
        text += '─'.repeat(60) + '\n';

        relatedItems.forEach((item, idx) => {
          text += `${idx + 1}. ${item.urs_code || ''} | ${item.urs_name || ''}\n`;
          text += `   MJ: ${item.unit || ''}\n`;
          if (item.reason) {
            text += `   Důvod: ${item.reason}\n`;
          }
          text += '\n';
        });
      }
    }
    // Handle block-match results (blocks instead of items)
    else if (!items.length && currentResults.blocks) {
      currentResults.blocks.forEach((block) => {
        text += `📂 ${block.block_name}\n`;
        text += '─'.repeat(60) + '\n';
        (block.items || []).forEach((item) => {
          const ursCode = item.selected_urs?.urs_code || '';
          const ursName = item.selected_urs?.urs_name || '';
          const unit = item.selected_urs?.unit || '';
          text += `  • ${ursCode} | ${ursName} | ${unit}\n`;
        });
        text += '\n';
      });
    } else {
      // Handle regular file upload results
      items.forEach((item, idx) => {
        text += `${idx + 1}. ${item.urs_code} | ${item.urs_name}\n`;
        text += `   MJ: ${item.unit} | Množství: ${item.quantity}\n\n`;
      });
    }

    text += '─'.repeat(60) + '\n';
    text += `Vygenerováno: ${new Date().toLocaleString('cs-CZ')}\n`;

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
// EXPORT TO REGISTRY
// ============================================================================

exportToRegistryBtn?.addEventListener('click', async () => {
  if (!currentResults) {
    alert('Žádné výsledky k exportu');
    return;
  }

  try {
    exportToRegistryBtn.disabled = true;
    exportToRegistryBtn.textContent = 'Odesílání...';
    debugLog('📤 Starting export to Registry');

    // Map results to unified format
    const positions = [];

    // Handle block-match results
    if (currentResults.blocks && currentResults.blocks.length > 0) {
      currentResults.blocks.forEach((block, blockIdx) => {
        const items = block.analysis?.items || block.items || [];
        items.forEach((item, itemIdx) => {
          const ursCode = item.selected_urs?.urs_code || '';
          const ursName = item.selected_urs?.urs_name || '';
          const unit = item.selected_urs?.unit || '';

          if (ursCode) {
            positions.push({
              id: `urs-${blockIdx}-${itemIdx}-${Date.now()}`,
              sourceKiosk: 'urs-matcher',
              code: ursCode,
              description: ursName || item.input_text || '',
              quantity: item.quantity || null,
              unit: unit,
              unitPrice: null,
              totalPrice: null,
              workGroup: null,
              metadata: {
                inputText: item.input_text || '',
                blockName: block.block_name || '',
                confidence: item.confidence || null,
                rowId: item.row_id || null
              }
            });
          }
        });
      });
    }

    // Handle text-match results (candidates)
    if (currentResults.candidates && currentResults.candidates.length > 0) {
      currentResults.candidates.forEach((candidate, idx) => {
        positions.push({
          id: `urs-cand-${idx}-${Date.now()}`,
          sourceKiosk: 'urs-matcher',
          code: candidate.urs_code || '',
          description: candidate.urs_name || '',
          quantity: currentResults.quantity || null,
          unit: candidate.unit || currentResults.unit || '',
          unitPrice: null,
          totalPrice: null,
          workGroup: null,
          metadata: {
            confidence: candidate.confidence || null,
            reason: candidate.reason || ''
          }
        });
      });
    }

    // Handle file upload results (items array)
    if (currentResults.items && currentResults.items.length > 0) {
      currentResults.items.forEach((item, idx) => {
        positions.push({
          id: `urs-item-${idx}-${Date.now()}`,
          sourceKiosk: 'urs-matcher',
          code: item.urs_code || '',
          description: item.urs_name || '',
          quantity: item.quantity || null,
          unit: item.unit || '',
          unitPrice: null,
          totalPrice: null,
          workGroup: null,
          metadata: {
            inputText: item.input_text || '',
            inputRowId: item.input_row_id || null,
            confidence: item.confidence || null,
            extraGenerated: item.extra_generated || false
          }
        });
      });
    }

    if (positions.length === 0) {
      alert('Žádné pozice k exportu');
      return;
    }

    debugLog(`📤 Exporting ${positions.length} positions to Registry`);

    // Send to Registry
    const response = await fetch('https://stavagent-backend-ktwx.vercel.app/api/sync?action=import-positions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        positions,
        sourceKiosk: 'urs-matcher',
        projectName: `URS Import ${new Date().toLocaleDateString('cs-CZ')}`,
        metadata: {
          jobId: currentJobId || null,
          exportedAt: new Date().toISOString()
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    const result = await response.json();
    debugLog('📤 ✓ Export to Registry successful:', result);

    // Show success
    exportToRegistryBtn.textContent = '✓ Exportováno!';
    setTimeout(() => {
      exportToRegistryBtn.textContent = '📤 Export do Registry';
      exportToRegistryBtn.disabled = false;
    }, 2000);

    // Optionally open Registry in new tab
    if (result.projectId) {
      const openRegistry = confirm(`Export úspěšný! Otevřít Registry s ${positions.length} položkami?`);
      if (openRegistry) {
        window.open(`https://stavagent-backend-ktwx.vercel.app/?project=${result.projectId}`, '_blank');
      }
    }

  } catch (error) {
    debugError('📤 Export to Registry error:', error);
    alert(`Chyba při exportu do Registry: ${error.message}`);
    exportToRegistryBtn.disabled = false;
    exportToRegistryBtn.textContent = '📤 Export do Registry';
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

    // Attach event handlers for document upload
    attachDocumentUploadHandlers();

    debugLog('📄 ✓ DocumentUpload component loaded with handlers');
  } catch (error) {
    debugError('📄 Failed to load DocumentUpload:', error);
    showError(`Chyba při načítání komponenty: ${error.message}`);
  }
}

/**
 * Attach event handlers for document upload functionality
 * Handles: drag-drop, file selection, upload, validation display
 */
function attachDocumentUploadHandlers() {
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  const uploadBtn = document.getElementById('upload-btn');
  const clearFilesBtn = document.getElementById('clear-files-btn');
  const filesList = document.getElementById('files-list');
  const validationResults = document.getElementById('validation-results');

  let selectedFiles = [];

  // Click to select files
  if (dropZone) {
    dropZone.addEventListener('click', () => fileInput?.click());
  }

  // Drag and drop handlers
  if (dropZone) {
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      const files = Array.from(e.dataTransfer.files);
      handleFilesSelected(files);
    });
  }

  // File input change
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const files = Array.from(e.target.files);
      handleFilesSelected(files);
    });
  }

  // Handle selected files
  function handleFilesSelected(files) {
    selectedFiles = files;
    displayFilesList(files);
    uploadBtn.disabled = files.length === 0;
    debugLog(`📄 Selected ${files.length} files for upload`);
  }

  // Display files in list
  function displayFilesList(files) {
    const emptyState = filesList?.querySelector('.empty-state');

    if (emptyState && files.length > 0) {
      emptyState.remove();
    }

    const fileItemsHtml = files.map((file, idx) => `
      <div class="file-item">
        <div class="file-info">
          <div class="file-icon">${getFileIcon(file.name)}</div>
          <div class="file-details">
            <div class="file-name">${file.name}</div>
            <div class="file-size">${formatFileSize(file.size)}</div>
          </div>
        </div>
        <button class="file-remove" data-index="${idx}">Smazat</button>
      </div>
    `).join('');

    if (filesList) {
      filesList.innerHTML = fileItemsHtml;

      // Add remove handlers
      filesList.querySelectorAll('.file-remove').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.getAttribute('data-index'));
          selectedFiles.splice(idx, 1);
          displayFilesList(selectedFiles);
          uploadBtn.disabled = selectedFiles.length === 0;
        });
      });
    }
  }

  // Clear all files
  if (clearFilesBtn) {
    clearFilesBtn.addEventListener('click', () => {
      selectedFiles = [];
      filesList.innerHTML = '<p class="empty-state">Zatím žádné soubory</p>';
      uploadBtn.disabled = true;
      validationResults.style.display = 'none';
      if (fileInput) fileInput.value = '';
      debugLog('📄 All files cleared');
    });
  }

  // Upload files
  if (uploadBtn) {
    uploadBtn.addEventListener('click', async () => {
      if (selectedFiles.length === 0) return;

      await uploadDocuments(selectedFiles);
    });
  }

  // Helper: Get file icon based on extension
  function getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const icons = {
      'pdf': '📕',
      'xlsx': '📊',
      'xls': '📊',
      'docx': '📝',
      'txt': '📄',
      'dwg': '🏗️',
      'jpg': '🖼️',
      'png': '🖼️'
    };
    return icons[ext] || '📄';
  }

  // Helper: Format file size
  function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  // Upload documents to backend
  async function uploadDocuments(files) {
    const uploadBtn = document.getElementById('upload-btn');
    const uploadSpinner = document.getElementById('upload-spinner');
    const progressContainer = document.getElementById('upload-progress');
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');

    try {
      uploadBtn.disabled = true;
      if (uploadSpinner) uploadSpinner.style.display = 'inline-block';
      if (progressContainer) progressContainer.style.display = 'block';

      const formData = new FormData();
      files.forEach(file => formData.append('files', file));

      // Add project context if available
      if (currentResults?.project_context) {
        formData.append('project_context', JSON.stringify(currentResults.project_context));
      }

      const response = await fetch('/api/jobs/document-upload', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status}`);
      }

      const result = await response.json();
      debugLog('✓ Document upload successful:', result);

      // Display validation results
      displayDocumentValidation(result.document_validation);

      // Update progress
      if (progressFill) progressFill.style.width = '100%';
      if (progressText) progressText.innerHTML = 'Nahrávání: <span>100</span>%';

    } catch (error) {
      debugError('📄 Document upload error:', error);
      showError(`Chyba při nahrávání dokumentů: ${error.message}`);
    } finally {
      uploadBtn.disabled = false;
      if (uploadSpinner) uploadSpinner.style.display = 'none';
      setTimeout(() => {
        if (progressContainer) progressContainer.style.display = 'none';
      }, 2000);
    }
  }

  // Display validation results
  function displayDocumentValidation(validation) {
    const validationResults = document.getElementById('validation-results');
    const completenessText = document.getElementById('completeness-text');
    const completenesFill = document.getElementById('completeness-fill');
    const uploadedDocsList = document.getElementById('uploaded-docs-list');
    const missingDocsSection = document.getElementById('missing-docs-section');
    const missingDocsList = document.getElementById('missing-docs-list');
    const rfiSection = document.getElementById('rfi-section');
    const rfiList = document.getElementById('rfi-list');
    const recommendationsSection = document.getElementById('recommendations-section');
    const recommendationsList = document.getElementById('recommendations-list');

    // Update completeness score
    if (completenessText) {
      completenessText.innerHTML = `Úplnost: <span>${validation.completeness_score}</span>%`;
    }
    if (completenesFill) {
      completenesFill.style.width = `${validation.completeness_score}%`;
    }

    // Display uploaded documents
    if (uploadedDocsList && validation.uploaded_documents) {
      uploadedDocsList.innerHTML = validation.uploaded_documents.map(doc => `
        <div class="doc-card">
          <div class="doc-icon">✓</div>
          <div class="doc-name">${doc.name}</div>
          <div class="doc-count">${doc.count} soubor(y)</div>
        </div>
      `).join('');
    }

    // Display missing documents
    if (validation.missing_documents && validation.missing_documents.length > 0) {
      if (missingDocsSection) missingDocsSection.style.display = 'block';
      if (missingDocsList) {
        missingDocsList.innerHTML = validation.missing_documents.map(doc => `
          <div>❌ ${doc.name} (${doc.priority})</div>
        `).join('');
      }
    }

    // Display RFI items
    if (validation.rfi_items && validation.rfi_items.length > 0) {
      if (rfiSection) rfiSection.style.display = 'block';
      if (rfiList) {
        rfiList.innerHTML = validation.rfi_items.map(rfi => `
          <div class="rfi-item">
            <div class="rfi-severity">${rfi.severity}</div>
            <div class="rfi-question">❓ ${rfi.question}</div>
            <div class="rfi-description">${rfi.description}</div>
          </div>
        `).join('');
      }
    }

    // Display recommendations
    if (validation.recommendations && validation.recommendations.length > 0) {
      if (recommendationsSection) recommendationsSection.style.display = 'block';
      if (recommendationsList) {
        recommendationsList.innerHTML = validation.recommendations.map(rec => `
          <div class="recommendation ${rec.priority === 'high' ? 'warning' : ''}">
            💡 ${rec.message}<br>
            <strong>Akce:</strong> ${rec.action}
          </div>
        `).join('');
      }
    }

    // Show results section
    if (validationResults) {
      validationResults.style.display = 'block';
    }

    // Show extraction button if documents were uploaded successfully
    const extractionActions = document.getElementById('extraction-actions');
    if (extractionActions && validation.uploaded_documents && validation.uploaded_documents.length > 0) {
      extractionActions.style.display = 'block';

      // Store uploaded files for extraction (from selectedFiles closure)
      window.uploadedDocumentFiles = selectedFiles;

      // Attach extraction handler
      const extractWorksBtn = document.getElementById('extract-works-btn');
      if (extractWorksBtn) {
        extractWorksBtn.onclick = handleDocumentExtraction;
      }
    }

    debugLog('📄 ✓ Document validation results displayed');
  }

  // Handle document extraction
  async function handleDocumentExtraction() {
    const extractWorksBtn = document.getElementById('extract-works-btn');
    const extractSpinner = document.getElementById('extract-spinner');

    if (!window.uploadedDocumentFiles || window.uploadedDocumentFiles.length === 0) {
      showError('Nejprve nahrajte dokumenty');
      return;
    }

    try {
      // Use first PDF/DOCX file for extraction
      const documentFile = window.uploadedDocumentFiles.find(f =>
        f.name.match(/\.(pdf|docx|doc)$/i)
      );

      if (!documentFile) {
        showError('Nenalezen žádný PDF nebo DOCX dokument pro extrakci');
        return;
      }

      extractWorksBtn.disabled = true;
      if (extractSpinner) extractSpinner.style.display = 'inline-block';

      debugLog(`🔬 Starting extraction for: ${documentFile.name}`);

      // Create FormData with file
      const formData = new FormData();
      formData.append('file', documentFile);

      // Call extraction API
      const response = await fetch('/api/jobs/document-extract', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        // Build structured error with pipeline stage info
        const stageLabel = errorData.stageLabel || '';
        const suggestion = errorData.suggestion || '';
        const detail = errorData.details || errorData.error || 'Extraction failed';
        let errorMsg = detail;
        if (stageLabel) {
          errorMsg = `${detail}\n\nFáze: ${stageLabel}`;
        }
        if (suggestion) {
          errorMsg += `\nDoporučení: ${suggestion}`;
        }
        throw new Error(errorMsg);
      }

      const result = await response.json();
      debugLog('✓ Document extraction successful:', result);

      // Display extracted works
      displayExtractedWorks(result.extraction);

    } catch (error) {
      debugError('🔬 Document extraction error:', error);
      showError(`Chyba při extrakci prací:\n${error.message}`);
    } finally {
      extractWorksBtn.disabled = false;
      if (extractSpinner) extractSpinner.style.display = 'none';
    }
  }

  // Display extracted works
  function displayExtractedWorks(extraction) {
    const extractionResults = document.getElementById('extraction-results');
    const worksCount = document.getElementById('works-count');
    const sectionsCount = document.getElementById('sections-count');
    const tskpMatched = document.getElementById('tskp-matched');
    const worksBySection = document.getElementById('works-by-section');

    // Update stats
    if (worksCount) worksCount.textContent = extraction.stats.after_deduplication || 0;
    if (sectionsCount) sectionsCount.textContent = extraction.stats.sections_count || 0;
    if (tskpMatched) tskpMatched.textContent = extraction.stats.tskp_matched || 0;

    // Display works by section
    if (worksBySection && extraction.sections) {
      worksBySection.innerHTML = extraction.sections.map(section => {
        const confidenceBadge = (confidence) => {
          if (confidence >= 0.7) return '<span class="confidence-badge confidence-high">VYSOKÁ</span>';
          if (confidence >= 0.4) return '<span class="confidence-badge confidence-medium">STŘEDNÍ</span>';
          return '<span class="confidence-badge confidence-low">NÍZKÁ</span>';
        };

        return `
          <div class="work-section">
            <div class="section-header">
              <span>${section.name}</span>
              <span class="section-count">${section.count} prací</span>
            </div>
            <table class="works-table">
              <thead>
                <tr>
                  <th>Název Práce</th>
                  <th>TSKP Kód</th>
                  <th>Kategorie</th>
                  <th>Jednotka</th>
                  <th>Množství</th>
                  <th>Jistota</th>
                </tr>
              </thead>
              <tbody>
                ${section.works.map(work => `
                  <tr>
                    <td>${work.name || ''}</td>
                    <td>
                      ${work.tskp_code
                        ? `<span class="tskp-code">${work.tskp_code}</span>`
                        : '<span class="tskp-missing">—</span>'
                      }
                    </td>
                    <td>${work.category || '—'}</td>
                    <td>${work.unit || '—'}</td>
                    <td>${work.quantity !== null ? work.quantity : '—'}</td>
                    <td>${work.tskp_code ? confidenceBadge(work.tskp_confidence) : '—'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      }).join('');
    }

    // Show results section
    if (extractionResults) {
      extractionResults.style.display = 'block';
    }

    // Store extraction results globally for export
    window.extractedWorks = extraction;

    // Attach export handlers
    const exportExcelBtn = document.getElementById('export-works-excel');
    const sendToBatchBtn = document.getElementById('send-to-batch');

    if (exportExcelBtn) {
      exportExcelBtn.onclick = exportWorksToExcel;
    }

    if (sendToBatchBtn) {
      sendToBatchBtn.onclick = sendWorksToBatch;
    }

    debugLog('🔬 ✓ Extracted works displayed');
  }

  // Export works to Excel (CSV with semicolon separator for European Excel)
  function exportWorksToExcel() {
    if (!window.extractedWorks) {
      showError('Nejsou k dispozici žádná data pro export');
      return;
    }

    // Helper: escape CSV field (handle quotes, newlines)
    const esc = (val) => {
      if (val === null || val === undefined) return '';
      const s = String(val);
      if (s.includes('"') || s.includes(';') || s.includes('\n')) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    };

    // Create CSV with semicolon separator (Czech Excel default)
    // sep=; tells Excel which delimiter to use
    let csv = 'sep=;\n';
    csv += 'Sekce;Název práce;TSKP kód;TSKP název;Kategorie;Jednotka;Množství;Jistota\n';

    window.extractedWorks.sections.forEach(section => {
      section.works.forEach(work => {
        const confidence = work.tskp_confidence
          ? (work.tskp_confidence * 100).toFixed(0) + '%'
          : '';

        csv += [
          esc(section.name),
          esc(work.name),
          esc(work.tskp_code),
          esc(work.tskp_name),
          esc(work.category),
          esc(work.unit),
          work.quantity !== null && work.quantity !== undefined ? work.quantity : '',
          confidence
        ].join(';') + '\n';
      });
    });

    // Download CSV with UTF-8 BOM for Excel compatibility
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `extrakce_praci_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    debugLog('📥 ✓ Works exported to CSV');
  }

  // Send works to batch processor
  function sendWorksToBatch() {
    if (!window.extractedWorks) {
      showError('Nejsou k dispozici žádná data');
      return;
    }

    // Prepare batch input text
    const batchText = window.extractedWorks.works.map(work => {
      return `${work.name} ${work.unit ? `[${work.unit}]` : ''}`;
    }).join('\n');

    // Store in sessionStorage
    sessionStorage.setItem('batchInputText', batchText);

    // Switch to batch section
    const batchTextInput = document.getElementById('batchTextInput');
    if (batchTextInput) {
      batchTextInput.value = batchText;
    }

    // Navigate to batch section
    const openBatchBtn = document.getElementById('openBatchBtn');
    if (openBatchBtn) {
      openBatchBtn.click();
      debugLog('📋 ✓ Works sent to batch processor');
    } else {
      showError('Batch procesor není k dispozici');
    }
  }

  // Add back button handler for document upload section
  const backFromDocUploadBtn = document.getElementById('backFromDocUploadBtn');
  if (backFromDocUploadBtn) {
    backFromDocUploadBtn.addEventListener('click', () => {
      debugLog('📄 Back button clicked - returning to main menu');
      showUpload();  // Show main upload section
      documentUploadContainer.innerHTML = '';  // Clear the component
    });
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
    conflictDiv.setAttribute('data-conflict-id', `conflict-${idx}`);
    conflictDiv.innerHTML = `
      <div class="conflict-header">
        <span class="severity-badge">${severityEmoji[conflict.severity] || '?'} ${conflict.severity}</span>
        <span class="conflict-type">${conflict.type}</span>
      </div>
      <p class="conflict-description">${conflict.description || 'Žádný popis'}</p>

      <div class="conflict-body">
        <div class="resolution-section">
          <strong>🎯 Automatické řešení:</strong>
          <p class="conflict-resolution">${conflict.resolution || 'Čeká na řešení'}</p>
        </div>

        ${conflict.reasoning ? `
          <div class="reasoning-section">
            <strong>📝 Zdůvodnění:</strong>
            <p class="conflict-reasoning">${conflict.reasoning}</p>
          </div>
        ` : ''}

        ${conflict.alternatives && conflict.alternatives.length > 0 ? `
          <div class="alternatives-section">
            <strong>🔄 Alternativy:</strong>
            <ul class="alternatives-list">
              ${conflict.alternatives.map(alt => `<li>${alt}</li>`).join('')}
            </ul>
          </div>
        ` : ''}
      </div>

      <div class="conflict-actions">
        <button class="conflict-btn accept-btn" data-conflict-id="conflict-${idx}" title="Přijmout automatické řešení">
          ✓ Přijmout
        </button>
        <button class="conflict-btn edit-btn" data-conflict-id="conflict-${idx}" title="Upravit řešení">
          ✎ Upravit
        </button>
        <button class="conflict-btn reject-btn" data-conflict-id="conflict-${idx}" title="Odmítnout a označit ke kontrole">
          ✗ Odmítnout
        </button>
      </div>
    `;
    conflictsList.appendChild(conflictDiv);
  });

  // Attach event listeners to conflict buttons
  attachConflictButtonListeners();

  debugLog('🤖 Enhanced conflicts displayed:', conflicts.length);
}

/**
 * Attach event listeners to conflict resolution buttons
 */
function attachConflictButtonListeners() {
  // Accept conflict resolution
  document.querySelectorAll('.conflict-btn.accept-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const conflictId = this.getAttribute('data-conflict-id');
      acceptConflictResolution(conflictId);
    });
  });

  // Edit conflict resolution
  document.querySelectorAll('.conflict-btn.edit-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const conflictId = this.getAttribute('data-conflict-id');
      editConflictResolution(conflictId);
    });
  });

  // Reject conflict resolution
  document.querySelectorAll('.conflict-btn.reject-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const conflictId = this.getAttribute('data-conflict-id');
      rejectConflictResolution(conflictId);
    });
  });
}

/**
 * Accept automatic conflict resolution
 */
function acceptConflictResolution(conflictId) {
  const conflictDiv = document.querySelector(`[data-conflict-id="${conflictId}"]`);
  if (conflictDiv) {
    conflictDiv.classList.add('conflict-accepted');
    conflictDiv.classList.remove('conflict-critical', 'conflict-high', 'conflict-medium', 'conflict-low');

    // Update button state
    const buttons = conflictDiv.querySelectorAll('.conflict-btn');
    buttons.forEach(btn => btn.disabled = true);

    const acceptBtn = conflictDiv.querySelector('.accept-btn');
    if (acceptBtn) {
      acceptBtn.textContent = '✓ Přijato';
      acceptBtn.style.backgroundColor = '#27ae60';
    }

    debugLog(`✓ Conflict ${conflictId} accepted`);
  }
}

/**
 * Edit conflict resolution
 */
function editConflictResolution(conflictId) {
  const conflictDiv = document.querySelector(`[data-conflict-id="${conflictId}"]`);
  if (conflictDiv) {
    const resolutionDiv = conflictDiv.querySelector('.resolution-section');
    const resolutionText = conflictDiv.querySelector('.conflict-resolution');

    if (resolutionDiv && resolutionText) {
      // Create edit form
      const editForm = document.createElement('div');
      editForm.className = 'conflict-edit-form';
      editForm.innerHTML = `
        <textarea class="edit-resolution-textarea" rows="3">${resolutionText.textContent}</textarea>
        <div class="edit-actions">
          <button class="edit-save-btn">💾 Uložit</button>
          <button class="edit-cancel-btn">✕ Zrušit</button>
        </div>
      `;

      resolutionDiv.appendChild(editForm);

      // Attach listeners to edit buttons
      editForm.querySelector('.edit-save-btn').addEventListener('click', function() {
        const newResolution = editForm.querySelector('.edit-resolution-textarea').value;
        resolutionText.textContent = newResolution;
        editForm.remove();
        conflictDiv.classList.add('conflict-edited');
        debugLog(`✎ Conflict ${conflictId} edited: ${newResolution}`);
      });

      editForm.querySelector('.edit-cancel-btn').addEventListener('click', function() {
        editForm.remove();
      });
    }
  }
}

/**
 * Reject conflict resolution and flag for manual review
 */
function rejectConflictResolution(conflictId) {
  const conflictDiv = document.querySelector(`[data-conflict-id="${conflictId}"]`);
  if (conflictDiv) {
    conflictDiv.classList.add('conflict-rejected');
    conflictDiv.classList.remove('conflict-critical', 'conflict-high', 'conflict-medium', 'conflict-low');

    // Add manual review flag
    const flagDiv = document.createElement('div');
    flagDiv.className = 'conflict-flag';
    flagDiv.innerHTML = '⚠️ Označeno ke kontrole';
    conflictDiv.insertBefore(flagDiv, conflictDiv.querySelector('.conflict-actions'));

    // Update button state
    const buttons = conflictDiv.querySelectorAll('.conflict-btn');
    buttons.forEach(btn => btn.disabled = true);

    const rejectBtn = conflictDiv.querySelector('.reject-btn');
    if (rejectBtn) {
      rejectBtn.textContent = '✗ Odmítnuto';
      rejectBtn.style.backgroundColor = '#e74c3c';
    }

    debugLog(`✗ Conflict ${conflictId} rejected and flagged for review`);
  }
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

  // Portal import: check for ?portal_file_id=&portal_api= URL params
  const urlParams = new URLSearchParams(window.location.search);
  const portalFileId = urlParams.get('portal_file_id');
  const portalApi = urlParams.get('portal_api');

  if (portalFileId && portalApi) {
    // Clean URL params immediately
    window.history.replaceState({}, '', window.location.pathname);
    debugLog('🌐 Portal import detected, fetching data...');

    fetch(`${portalApi}/api/portal-files/${portalFileId}/parsed-data/for-kiosk/urs_matcher`)
      .then(resp => {
        if (!resp.ok) throw new Error(`Portal fetch failed: ${resp.status}`);
        return resp.json();
      })
      .then(data => {
        if (!data.success || !data.sheets?.length) {
          showError('Portal vrátil prázdná data. Ujistěte se, že soubor byl nejdříve zparsován.');
          return;
        }

        // Collect all item descriptions for batch matching
        const lines = [];
        for (const sheet of data.sheets) {
          for (const item of sheet.items) {
            const desc = item.popis || item.kod;
            if (desc && desc.trim().length > 3) {
              lines.push(desc.trim());
            }
          }
        }

        if (lines.length === 0) {
          showError('V souboru nebyly nalezeny žádné popisky pro URS Matcher.');
          return;
        }

        const batchText = lines.join('\n');
        sessionStorage.setItem('batchInputText', batchText);

        // Navigate to batch section and pre-fill input
        const openBatchBtn = document.getElementById('openBatchBtn');
        if (openBatchBtn) {
          openBatchBtn.click();
          // Fill textarea after section is visible
          setTimeout(() => {
            const batchTextInput = document.getElementById('batchTextInput');
            if (batchTextInput) {
              batchTextInput.value = batchText;
            }
          }, 100);
          debugLog(`🌐 ✓ Portal import: ${lines.length} položek načteno z Portal (${data.file_name || portalFileId})`);
        } else {
          showError('Batch procesor není k dispozici.');
        }
      })
      .catch(err => {
        debugError('❌ Portal import failed:', err.message);
        showError(`Import z Portal selhal: ${err.message}`);
      });
  }

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

// ============================================================================
// HARVEST ADMIN PANEL
// ============================================================================

let harvestPollTimer = null;

function renderHarvestStatus(state) {
  const el = document.getElementById('harvestStatusContent');
  const wrap = document.getElementById('harvestStatus');
  const progressWrap = document.getElementById('harvestProgressWrap');
  const progressBar = document.getElementById('harvestProgressBar');
  if (!el || !wrap) return;

  wrap.style.display = 'block';

  if (!state || state.status === 'idle') {
    el.innerHTML = '<p>Žádný harvest nebyl spuštěn.</p>';
    progressWrap.style.display = 'none';
    return;
  }

  const pct = state.total_categories > 0
    ? Math.round((state.current_index / state.total_categories) * 100) : 0;

  let statusIcon = '⏳';
  if (state.status === 'completed') statusIcon = '✅';
  else if (state.status === 'cancelled') statusIcon = '⏹';
  else if (state.status === 'error') statusIcon = '❌';

  let html = `<p><strong>${statusIcon} Stav:</strong> ${state.status}</p>`;
  html += `<p><strong>Model:</strong> ${state.model || 'sonar'}</p>`;
  html += `<p><strong>Kategorie:</strong> ${state.current_index || 0} / ${state.total_categories || 0}</p>`;
  if (state.current_category) html += `<p><strong>Aktuální:</strong> ${state.current_category}</p>`;
  html += `<p><strong>Nalezeno:</strong> ${state.total_found || 0} | <strong>Uloženo:</strong> ${state.total_saved || 0}</p>`;
  if (state.db_total) html += `<p><strong>Celkem v DB:</strong> ${state.db_total}</p>`;
  if (state.started_at) html += `<p><strong>Začátek:</strong> ${new Date(state.started_at).toLocaleString('cs')}</p>`;
  if (state.finished_at) html += `<p><strong>Konec:</strong> ${new Date(state.finished_at).toLocaleString('cs')}</p>`;

  if (state.errors && state.errors.length > 0) {
    html += `<p style="color:#e74c3c;"><strong>Chyby (${state.errors.length}):</strong></p><ul>`;
    state.errors.slice(-5).forEach(e => {
      html += `<li>${e.category}: ${e.error}</li>`;
    });
    html += '</ul>';
  }

  if (state.completed_categories && state.completed_categories.length > 0) {
    html += `<details style="margin-top:0.5rem;"><summary>Dokončené kategorie (${state.completed_categories.length})</summary><ul>`;
    state.completed_categories.forEach(c => {
      html += `<li>${c.code} ${c.name}: ${c.found} nalezeno, ${c.saved} uloženo</li>`;
    });
    html += '</ul></details>';
  }

  el.innerHTML = html;

  // Progress bar
  if (state.status === 'running') {
    progressWrap.style.display = 'block';
    progressBar.style.width = `${pct}%`;
    progressBar.textContent = `${pct}%`;
  } else {
    progressWrap.style.display = pct > 0 ? 'block' : 'none';
    progressBar.style.width = `${pct}%`;
    progressBar.textContent = `${pct}%`;
  }

  // Auto-poll while running
  if (state.status === 'running' && !harvestPollTimer) {
    harvestPollTimer = setInterval(checkHarvestStatus, 5000);
  } else if (state.status !== 'running' && harvestPollTimer) {
    clearInterval(harvestPollTimer);
    harvestPollTimer = null;
  }
}

async function startHarvest(resume = false) {
  try {
    const res = await fetch(`${API_URL}/urs-catalog/harvest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(resume ? { resume: true } : {}),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Chyba při spuštění harvestu');
      renderHarvestStatus(data.state || null);
      return;
    }
    renderHarvestStatus(data.state);
  } catch (err) {
    alert('Chyba: ' + err.message);
  }
}

async function checkHarvestStatus() {
  try {
    const res = await fetch(`${API_URL}/urs-catalog/harvest/status`);
    const data = await res.json();
    renderHarvestStatus(data);
  } catch (err) {
    debugError('Harvest status check failed', err);
  }
}

async function cancelHarvest() {
  try {
    const res = await fetch(`${API_URL}/urs-catalog/harvest/cancel`, { method: 'POST' });
    const data = await res.json();
    if (data.state) renderHarvestStatus(data.state);
    else checkHarvestStatus();
  } catch (err) {
    alert('Chyba: ' + err.message);
  }
}

// Show harvest panel only for admins (?admin=1 in URL)
if (new URLSearchParams(window.location.search).get('admin') === '1') {
  const harvestSection = document.getElementById('harvestSection');
  if (harvestSection) harvestSection.style.display = '';
  checkHarvestStatus();
}
