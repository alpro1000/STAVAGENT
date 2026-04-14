/**
 * Batch URS Matcher - Frontend
 * Handles batch processing UI and API communication
 */

(function() {
'use strict';

// ============================================================================
// DOM ELEMENTS
// ============================================================================

const openBatchBtn = document.getElementById('openBatchBtn');
const backFromBatchBtn = document.getElementById('backFromBatchBtn');
const batchSection = document.getElementById('batchSection');
const uploadSection = document.getElementById('uploadSection');

const batchTextInput = document.getElementById('batchTextInput');
const batchCandidatesPerWork = document.getElementById('batchCandidatesPerWork');
const batchSearchDepth = document.getElementById('batchSearchDepth');
const batchCatalog = document.getElementById('batchCatalog');
const batchStartBtn = document.getElementById('batchStartBtn');
const batchPauseBtn = document.getElementById('batchPauseBtn');
const batchExportBtn = document.getElementById('batchExportBtn');

const batchProgressArea = document.getElementById('batchProgressArea');
const batchProgressBar = document.getElementById('batchProgressBar');
const batchProgressText = document.getElementById('batchProgressText');
const batchNeedsReview = document.getElementById('batchNeedsReview');
const batchErrors = document.getElementById('batchErrors');

const batchResultsArea = document.getElementById('batchResultsArea');
const batchResultsBody = document.getElementById('batchResultsBody');

// ============================================================================
// STATE
// ============================================================================

let currentBatchId = null;
let pollInterval = null;
// Polling backoff state — keeps the UI alive even if the server briefly
// rate-limits us. Base 3s, exponential doubling on 429 up to 30s, reset
// on success. After too many consecutive failures we stop polling and
// let the user retry manually.
const POLL_BASE_MS = 3000;
const POLL_MAX_MS = 30000;
const POLL_MAX_CONSECUTIVE_ERRORS = 10;
let pollCurrentMs = POLL_BASE_MS;
let pollConsecutiveErrors = 0;

// ============================================================================
// NAVIGATION
// ============================================================================

function openBatchSection() {
  // Hide all other sections
  uploadSection.classList.add('hidden');
  uploadSection.classList.remove('active');

  const resultsSection = document.getElementById('resultsSection');
  const errorSection = document.getElementById('errorSection');
  const docUploadSection = document.getElementById('docUploadSection');
  const contextEditorSection = document.getElementById('contextEditorSection');
  const phase3ResultsSection = document.getElementById('phase3ResultsSection');

  if (resultsSection) resultsSection.classList.add('hidden');
  if (errorSection) errorSection.classList.add('hidden');
  if (docUploadSection) docUploadSection.classList.add('hidden');
  if (contextEditorSection) contextEditorSection.classList.add('hidden');
  if (phase3ResultsSection) phase3ResultsSection.classList.add('hidden');

  // Show batch section
  batchSection.classList.remove('hidden');
  batchSection.classList.add('active');
  debugLog('📋 Opened Batch section');
}

function closeBatchSection() {
  batchSection.classList.remove('active');
  batchSection.classList.add('hidden');
  uploadSection.classList.remove('hidden');
  uploadSection.classList.add('active');

  // Reset state
  stopPolling();
  currentBatchId = null;
  resetBatchUI();

  debugLog('📋 Closed Batch section');
}

function resetBatchUI() {
  batchProgressArea.style.display = 'none';
  batchResultsArea.style.display = 'none';
  batchStartBtn.disabled = false;
  batchPauseBtn.disabled = true;
  batchProgressBar.style.width = '0%';
  batchProgressText.textContent = '0 / 0 (0%)';
  batchNeedsReview.textContent = '⚠️ Kontrola: 0';
  batchErrors.textContent = '❌ Chyby: 0';
  batchResultsBody.innerHTML = '';
}

// ============================================================================
// BATCH PROCESSING
// ============================================================================

async function startBatch() {
  try {
    const inputText = batchTextInput.value.trim();

    if (!inputText) {
      alert('Zadejte alespoň jednu pozici!');
      return;
    }

    // Parse input (each line = one position)
    const lines = inputText.split('\n').filter(line => line.trim().length > 0);

    if (lines.length === 0) {
      alert('Žádné platné pozice!');
      return;
    }

    // Build items array
    const items = lines.map((text, index) => ({
      lineNo: index + 1,
      text: text.trim()
    }));

    // Build settings
    const settings = {
      candidatesPerWork: parseInt(batchCandidatesPerWork.value),
      maxSubWorks: 5,
      searchDepth: batchSearchDepth.value,
      catalog: batchCatalog ? batchCatalog.value : 'urs',
      language: 'cs'
    };

    debugLog(`📋 Starting batch: ${items.length} items`, { items, settings });

    // Disable start button
    batchStartBtn.disabled = true;
    batchStartBtn.textContent = '⏳ Vytváření...';

    // Create batch job
    const createResponse = await fetch('/api/batch/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `Batch ${new Date().toLocaleString('cs-CZ')}`,
        items: items,
        settings: settings
      })
    });

    if (!createResponse.ok) {
      throw new Error('Failed to create batch job');
    }

    const createResult = await createResponse.json();
    currentBatchId = createResult.data.batchId;

    debugLog(`✅ Batch created: ${currentBatchId}`);

    // Start processing
    const startResponse = await fetch(`/api/batch/${currentBatchId}/start`, {
      method: 'POST'
    });

    if (!startResponse.ok) {
      throw new Error('Failed to start batch');
    }

    debugLog(`🚀 Batch started: ${currentBatchId}`);

    // Show progress area
    batchProgressArea.style.display = 'block';
    batchStartBtn.textContent = '⏳ Zpracovává se...';
    batchPauseBtn.disabled = false;

    // Start polling status
    startPolling();

  } catch (error) {
    debugError('Batch start error', error);
    alert(`Chyba při spuštění: ${error.message}`);
    batchStartBtn.disabled = false;
    batchStartBtn.textContent = '🚀 Spustit zpracování';
  }
}

async function pauseBatch() {
  if (!currentBatchId) return;

  try {
    debugLog(`⏸️ Pausing batch: ${currentBatchId}`);

    const response = await fetch(`/api/batch/${currentBatchId}/pause`, {
      method: 'POST'
    });

    if (!response.ok) {
      throw new Error('Failed to pause batch');
    }

    debugLog(`✅ Batch paused: ${currentBatchId}`);
    stopPolling();
    batchPauseBtn.disabled = true;
    batchStartBtn.textContent = '▶️ Pokračovat';
    batchStartBtn.disabled = false;
    batchStartBtn.onclick = resumeBatch;

  } catch (error) {
    debugError('Batch pause error', error);
    alert(`Chyba při pozastavení: ${error.message}`);
  }
}

async function resumeBatch() {
  if (!currentBatchId) return;

  try {
    debugLog(`▶️ Resuming batch: ${currentBatchId}`);

    batchStartBtn.disabled = true;
    batchStartBtn.textContent = '⏳ Obnovování...';

    const response = await fetch(`/api/batch/${currentBatchId}/resume`, {
      method: 'POST'
    });

    if (!response.ok) {
      throw new Error('Failed to resume batch');
    }

    debugLog(`✅ Batch resumed: ${currentBatchId}`);
    batchPauseBtn.disabled = false;
    batchStartBtn.textContent = '⏳ Zpracovává se...';
    batchStartBtn.onclick = startBatch;

    // Resume polling
    startPolling();

  } catch (error) {
    debugError('Batch resume error', error);
    alert(`Chyba při obnovení: ${error.message}`);
    batchStartBtn.disabled = false;
    batchStartBtn.textContent = '▶️ Pokračovat';
  }
}

// ============================================================================
// STATUS POLLING
// ============================================================================

function startPolling() {
  stopPolling();
  // Reset backoff state on every new batch so previous errors don't
  // carry over.
  pollCurrentMs = POLL_BASE_MS;
  pollConsecutiveErrors = 0;
  schedulePoll();
  checkBatchStatus();  // Check immediately
}

function stopPolling() {
  if (pollInterval) {
    clearTimeout(pollInterval);
    pollInterval = null;
  }
}

// Schedule the next poll based on the current backoff delay. Using
// setTimeout (re-armed on each run) instead of setInterval lets us bump
// the delay mid-stream without racing the timer.
function schedulePoll() {
  if (pollInterval) clearTimeout(pollInterval);
  pollInterval = setTimeout(checkBatchStatus, pollCurrentMs);
}

async function checkBatchStatus() {
  if (!currentBatchId) return;

  try {
    const response = await fetch(`/api/batch/${currentBatchId}/status`);

    if (!response.ok) {
      // Rate-limited? Back off exponentially up to POLL_MAX_MS.
      if (response.status === 429) {
        pollCurrentMs = Math.min(pollCurrentMs * 2, POLL_MAX_MS);
        pollConsecutiveErrors++;
        debugLog(`⏳ 429 on status poll — backing off to ${pollCurrentMs}ms (${pollConsecutiveErrors} consecutive errors)`);
      } else {
        pollConsecutiveErrors++;
      }
      if (pollConsecutiveErrors >= POLL_MAX_CONSECUTIVE_ERRORS) {
        stopPolling();
        alert('Nepodařilo se načíst stav zpracování po opakovaných pokusech. Obnovte stránku pro pokračování.');
        return;
      }
      schedulePoll();
      throw new Error(`Failed to get batch status (HTTP ${response.status})`);
    }

    // Success — reset backoff to the base interval.
    pollCurrentMs = POLL_BASE_MS;
    pollConsecutiveErrors = 0;

    const result = await response.json();
    const status = result.data;

    debugLog(`📊 Batch status: ${status.status} (${status.processedItems}/${status.totalItems})`);

    // Update progress
    updateProgressUI(status);

    // If completed, stop polling and load results
    if (status.status === 'completed' || status.status === 'failed') {
      stopPolling();
      batchStartBtn.textContent = '✅ Dokončeno';
      batchStartBtn.disabled = true;
      batchPauseBtn.disabled = true;

      if (status.status === 'completed') {
        await loadBatchResults();
      } else {
        alert(`Zpracování selhalo: ${status.errorMessage || 'Neznámá chyba'}`);
      }
      return;
    }

    // Still running — schedule the next poll.
    schedulePoll();

  } catch (error) {
    debugError('Status check error', error);
  }
}

function updateProgressUI(status) {
  const progress = status.progress || 0;
  batchProgressBar.style.width = `${progress}%`;
  batchProgressText.textContent = `${status.processedItems} / ${status.totalItems} (${progress}%)`;
  batchNeedsReview.textContent = `⚠️ Kontrola: ${status.needsReviewCount || 0}`;
  batchErrors.textContent = `❌ Chyby: ${status.errorCount || 0}`;
}

// ============================================================================
// RESULTS
// ============================================================================

async function loadBatchResults() {
  if (!currentBatchId) return;

  try {
    debugLog(`📥 Loading results: ${currentBatchId}`);

    const response = await fetch(`/api/batch/${currentBatchId}/results`);

    if (!response.ok) {
      throw new Error('Failed to load results');
    }

    const result = await response.json();
    const batchData = result.data;

    debugLog(`✅ Results loaded: ${batchData.results.length} items`);

    // Display results
    displayResults(batchData.results);

    // Show results area
    batchResultsArea.style.display = 'block';

  } catch (error) {
    debugError('Load results error', error);
    alert(`Chyba při načítání výsledků: ${error.message}`);
  }
}

function displayResults(results) {
  batchResultsBody.innerHTML = '';

  for (const item of results) {
    const lineNo = item.lineNo || '';
    const originalText = item.originalText || '';
    const detectedType = item.detectedType || 'UNKNOWN';

    // Get results
    const itemResults = item.results || [];

    // Extract TSKP classification from first result
    const tskp = (itemResults[0] && itemResults[0].tskpClassification) || null;
    const tskpLabel = tskp && tskp.sectionCode
      ? `<span class="tskp-badge" title="${escapeHtml(tskp.sectionName || '')}">${tskp.sectionCode}</span>`
      : '<span class="tskp-missing">—</span>';

    if (itemResults.length === 0) {
      // No results - show error row
      const row = document.createElement('tr');
      row.className = 'error-row';
      row.innerHTML = `
        <td>${lineNo}</td>
        <td>${escapeHtml(originalText)}</td>
        <td>${tskpLabel}</td>
        <td>${detectedType}</td>
        <td colspan="5">${item.errorMessage || 'Žádné výsledky'}</td>
      `;
      batchResultsBody.appendChild(row);
    } else {
      // Show candidates
      let isFirstRow = true;
      for (const result of itemResults) {
        const subWork = result.subWork || {};
        const candidates = result.candidates || [];

        for (const candidate of candidates) {
          const row = document.createElement('tr');

          // Color code by confidence
          let rowClass = '';
          if (candidate.confidence === 'high') {
            rowClass = 'high-confidence';
          } else if (candidate.confidence === 'low' || candidate.needsReview) {
            rowClass = 'low-confidence';
          }

          const sourceLabel = candidate.source
            ? `<span class="source-badge source-${candidate.source}">${candidate.source}</span>`
            : '';

          row.className = rowClass;
          row.innerHTML = `
            <td>${lineNo}</td>
            <td>${escapeHtml(originalText)}</td>
            <td>${isFirstRow ? tskpLabel : ''}</td>
            <td>${detectedType}</td>
            <td>${candidate.code || ''} ${sourceLabel}</td>
            <td>${escapeHtml(candidate.name || '')}</td>
            <td>${candidate.score || 0}</td>
            <td>
              <span class="confidence-badge ${candidate.confidence}">${candidate.confidence}</span>
            </td>
            <td>${candidate.needsReview ? '⚠️' : '✓'}</td>
          `;

          batchResultsBody.appendChild(row);
          isFirstRow = false;
        }
      }
    }
  }
}

// ============================================================================
// EXPORT
// ============================================================================

async function exportBatchResults() {
  if (!currentBatchId) return;

  try {
    debugLog(`📥 Exporting results: ${currentBatchId}`);

    // Download file
    window.location.href = `/api/batch/${currentBatchId}/export/xlsx`;

  } catch (error) {
    debugError('Export error', error);
    alert(`Chyba při exportu: ${error.message}`);
  }
}

// ============================================================================
// UTILITIES
// ============================================================================

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

if (openBatchBtn) {
  openBatchBtn.addEventListener('click', openBatchSection);
}

if (backFromBatchBtn) {
  backFromBatchBtn.addEventListener('click', closeBatchSection);
}

if (batchStartBtn) {
  batchStartBtn.addEventListener('click', startBatch);
}

if (batchPauseBtn) {
  batchPauseBtn.addEventListener('click', pauseBatch);
}

if (batchExportBtn) {
  batchExportBtn.addEventListener('click', exportBatchResults);
}

debugLog('✅ Batch module loaded');

})();
