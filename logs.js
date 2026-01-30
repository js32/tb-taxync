/**
 * Debug Logs Page Script
 * Displays extension logs and debugging information
 */

let allLogs = [];
let filteredLogs = [];
const maxLogsToDisplay = 1000;

// Load logs on page open
document.addEventListener('DOMContentLoaded', async () => {
  await refreshLogs();
});

/**
 * Refresh logs from extension storage
 */
async function refreshLogs() {
  try {
    const storage = await browser.storage.local.get([
      'lastSyncResult',
      'lastSync',
      'extensionLogs'
    ]);

    // In a real implementation, logs would be stored in browser.storage
    // For now, we'll fetch from background script
    const response = await browser.runtime.sendMessage({
      action: 'getLogs'
    });

    if (response && response.logs) {
      allLogs = response.logs;
      filteredLogs = allLogs;
      applyFilter();
      updateStats(storage);
    }
  } catch (error) {
    console.error('Failed to load logs:', error);
    displayEmptyState('Failed to load logs');
  }
}

/**
 * Apply log level filter
 */
function applyFilter() {
  const filterLevel = document.getElementById('filterLevel').value;

  if (filterLevel) {
    filteredLogs = allLogs.filter(log => log.level === filterLevel);
  } else {
    filteredLogs = allLogs;
  }

  renderLogs();
}

/**
 * Render logs in the container
 */
function renderLogs() {
  const container = document.getElementById('logContainer');

  if (filteredLogs.length === 0) {
    displayEmptyState('No logs match the current filter');
    return;
  }

  const logsToShow = filteredLogs.slice(-maxLogsToDisplay);
  let html = '';

  for (const log of logsToShow) {
    const timestamp = new Date(log.timestamp).toISOString();
    html += `
      <div class="log-entry ${log.level}">
        <span class="log-timestamp">${timestamp}</span>
        <span class="log-level">[${log.level}]</span>
        <span class="log-message">${escapeHtml(log.message)}</span>
        ${log.stack ? `<div class="log-stack">${escapeHtml(log.stack)}</div>` : ''}
      </div>
    `;
  }

  container.innerHTML = html;
  container.scrollTop = container.scrollHeight;
}

/**
 * Display empty state message
 */
function displayEmptyState(message) {
  const container = document.getElementById('logContainer');
  container.innerHTML = `<div class="empty-state">${message}</div>`;
}

/**
 * Update statistics
 */
function updateStats(storage) {
  const errorCount = allLogs.filter(l => l.level === 'ERROR').length;
  const warningCount = allLogs.filter(l => l.level === 'WARN').length;

  document.getElementById('totalLogs').textContent = allLogs.length;
  document.getElementById('errorCount').textContent = errorCount;
  document.getElementById('warningCount').textContent = warningCount;

  if (storage.lastSync) {
    const lastSyncDate = new Date(storage.lastSync);
    const now = new Date();
    const diff = now - lastSyncDate;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      document.getElementById('lastSync').textContent = `${hours}h ago`;
    } else if (minutes > 0) {
      document.getElementById('lastSync').textContent = `${minutes}m ago`;
    } else {
      document.getElementById('lastSync').textContent = 'Now';
    }
  }
}

/**
 * Clear all logs
 */
async function clearLogs() {
  if (!confirm('Are you sure you want to clear all logs?')) {
    return;
  }

  try {
    await browser.runtime.sendMessage({
      action: 'clearLogs'
    });

    allLogs = [];
    filteredLogs = [];
    renderLogs();
    updateStats({});
  } catch (error) {
    console.error('Failed to clear logs:', error);
    alert('Failed to clear logs');
  }
}

/**
 * Download logs as JSON file
 */
function downloadLogs() {
  const dataStr = JSON.stringify(allLogs, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `thunderbird-sync-labels-logs-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Toggle JSON export preview
 */
function toggleExportPreview() {
  const preview = document.getElementById('exportPreview');

  if (preview.style.display === 'none') {
    preview.textContent = JSON.stringify(allLogs, null, 2);
    preview.style.display = 'block';
  } else {
    preview.style.display = 'none';
  }
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
  if (!text) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}
