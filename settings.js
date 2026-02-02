// TB Labels Sync - Settings Script

document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  setupTabs();
  setupLogHandlers();

  // Save button handler
  document.getElementById('saveBtn').addEventListener('click', saveSettings);

  // Test sync button handler
  document.getElementById('testSyncBtn').addEventListener('click', testSync);

  // Detect Syncthing folders button handler
  document.getElementById('detectSyncthingBtn').addEventListener('click', detectSyncthingFolders);

  // Browse button handler (placeholder)
  document.getElementById('browseBtn').addEventListener('click', () => {
    showMessage('Note: File selection is currently only possible manually via text input.', 'error');
  });
});

/**
 * Setup tab navigation
 */
function setupTabs() {
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabName = button.getAttribute('data-tab');

      // Remove active class from all buttons and contents
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));

      // Add active class to clicked button and corresponding content
      button.classList.add('active');
      document.getElementById(`${tabName}-tab`).classList.add('active');

      // Load logs when switching to logs tab
      if (tabName === 'logs') {
        loadAndDisplayLogs();
      }
    });
  });
}

/**
 * Setup log handlers
 */
function setupLogHandlers() {
  const refreshLogsBtn = document.getElementById('refreshLogsBtn');
  const downloadLogsBtn = document.getElementById('downloadLogsBtn');
  const clearLogsBtn = document.getElementById('clearLogsBtn');

  if (refreshLogsBtn) {
    refreshLogsBtn.addEventListener('click', loadAndDisplayLogs);
  }

  if (downloadLogsBtn) {
    downloadLogsBtn.addEventListener('click', downloadLogs);
  }

  if (clearLogsBtn) {
    clearLogsBtn.addEventListener('click', clearLogs);
  }
}

/**
 * Load and display logs from error handler
 */
async function loadAndDisplayLogs() {
  try {
    const response = await browser.runtime.sendMessage({ action: 'getLogs' });

    if (response.success && response.logs) {
      const logs = response.logs;
      const logContainer = document.getElementById('logContainer');

      if (logs.length === 0) {
        logContainer.innerHTML = '<div class="empty-state">No logs available. Perform a sync to generate logs.</div>';
        updateLogStats(logs);
        return;
      }

      // Display logs
      logContainer.innerHTML = '';
      logs.forEach(log => {
        const entry = document.createElement('div');
        entry.className = `log-entry ${log.level || 'INFO'}`;

        const timestamp = new Date(log.timestamp).toLocaleString('en-US');

        const timestampSpan = document.createElement('span');
        timestampSpan.className = 'log-timestamp';
        timestampSpan.textContent = timestamp;
        entry.appendChild(timestampSpan);

        const levelSpan = document.createElement('span');
        levelSpan.className = 'log-level';
        levelSpan.textContent = log.level || 'INFO';
        entry.appendChild(levelSpan);

        const messageSpan = document.createElement('span');
        messageSpan.className = 'log-message';
        messageSpan.textContent = log.message;
        entry.appendChild(messageSpan);

        logContainer.appendChild(entry);
      });

      updateLogStats(logs);
    }
  } catch (error) {
    console.error('Error loading logs:', error);
  }
}

/**
 * Update log statistics
 */
function updateLogStats(logs) {
  const totalLogs = logs.length;
  const errorCount = logs.filter(l => l.level === 'ERROR').length;
  const warningCount = logs.filter(l => l.level === 'WARN').length;

  document.getElementById('totalLogs').textContent = totalLogs;
  document.getElementById('errorCount').textContent = errorCount;
  document.getElementById('warningCount').textContent = warningCount;

  // Get last sync time from logs
  const lastSyncLog = logs.find(l => l.message.includes('sync complete') || l.message.includes('Sync complete'));
  if (lastSyncLog) {
    const date = new Date(lastSyncLog.timestamp);
    document.getElementById('lastSync').textContent = date.toLocaleString('de-DE');
  }
}

/**
 * Download logs as JSON
 */
async function downloadLogs() {
  try {
    const response = await browser.runtime.sendMessage({ action: 'getLogs' });

    if (response.success && response.logs) {
      const logsJson = JSON.stringify(response.logs, null, 2);
      const blob = new Blob([logsJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tb-labels-sync-logs-${new Date().toISOString()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  } catch (error) {
    console.error('Error downloading logs:', error);
    showMessage('Error downloading logs', 'error');
  }
}

/**
 * Clear all logs
 */
async function clearLogs() {
  if (!confirm('Do you want to delete all logs?')) {
    return;
  }

  try {
    await browser.runtime.sendMessage({ action: 'clearLogs' });
    showMessage('Logs deleted', 'success');
    loadAndDisplayLogs();
  } catch (error) {
    console.error('Error clearing logs:', error);
    showMessage('Error clearing logs', 'error');
  }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function loadSettings() {
  const defaults = {
    syncEnabled: true,
    syncOnChange: true,
    manualSync: true,
    syncInterval: 5 * 60 * 1000, // Store as milliseconds
    backendConfig: {
      type: 'filesystem',
      filePath: '/home/jens/Sync/thunderbird-tags.json'
    }
  };

  const settings = await browser.storage.local.get(defaults);

  // Load file path from backendConfig
  const filePath = settings.backendConfig?.filePath || defaults.backendConfig.filePath;
  document.getElementById('syncFilePath').value = filePath;

  document.getElementById('autoSync').checked = settings.syncEnabled;
  document.getElementById('syncOnChange').checked = settings.syncOnChange;
  document.getElementById('manualSync').checked = settings.manualSync;

  // Convert milliseconds back to minutes for display
  const syncIntervalMinutes = settings.syncInterval ? Math.round(settings.syncInterval / (60 * 1000)) : 5;
  document.getElementById('syncInterval').value = syncIntervalMinutes;
}

async function saveSettings() {
  const syncInterval = parseInt(document.getElementById('syncInterval').value) || 5;
  const filePath = document.getElementById('syncFilePath').value.trim();

  const settings = {
    syncEnabled: document.getElementById('autoSync').checked,
    syncOnChange: document.getElementById('syncOnChange').checked,
    manualSync: document.getElementById('manualSync').checked,
    syncInterval: syncInterval * 60 * 1000, // Convert minutes to milliseconds
    backendConfig: {
      type: 'filesystem',
      filePath: filePath
    }
  };

  try {
    await browser.storage.local.set(settings);
    showMessage('Settings saved successfully!', 'success');

    // Notify background script to reload settings
    await browser.runtime.sendMessage({ action: 'reloadSettings' });
  } catch (error) {
    showMessage(`Error saving settings: ${error.message}`, 'error');
  }
}

async function testSync() {
  showMessage('Testing synchronization...', 'success');

  try {
    const response = await browser.runtime.sendMessage({ action: 'performSync' });

    if (response.success) {
      showMessage('Sync test successful!', 'success');
    } else {
      showMessage(`Sync test failed: ${response.error}`, 'error');
    }
  } catch (error) {
    showMessage(`Error during sync test: ${error.message}`, 'error');
  }
}

async function detectSyncthingFolders() {
  const detectedPaths = document.getElementById('detectedPaths');
  const pathList = document.getElementById('pathList');

  pathList.innerHTML = '<div style="text-align: center; padding: 10px;">Searching for Syncthing folders...</div>';
  detectedPaths.style.display = 'block';

  try {
    // Try to use native messaging to detect actual folders
    const response = await browser.runtime.sendMessage({
      action: 'detectSyncthing'
    });

    pathList.innerHTML = '';

    if (response.success && response.folders && response.folders.length > 0) {
      response.folders.forEach(folder => {
        const pathDiv = document.createElement('div');
        pathDiv.className = 'path-option';

        const strongTag = document.createElement('strong');
        strongTag.textContent = folder.path;
        pathDiv.appendChild(strongTag);

        const brTag = document.createElement('br');
        pathDiv.appendChild(brTag);

        const smallTag = document.createElement('small');
        smallTag.textContent = folder.suggestedFile;
        pathDiv.appendChild(smallTag);

        pathDiv.addEventListener('click', () => {
          document.getElementById('syncFilePath').value = folder.suggestedFile;
          detectedPaths.style.display = 'none';
        });
        pathList.appendChild(pathDiv);
      });
      showMessage(`${response.folders.length} Syncthing folders found!`, 'success');
    } else {
      // Fallback to common paths - test which ones exist
      const possiblePaths = [
        '/home/jens/Sync/thunderbird-tags.json',
        '/home/jens/Dokumente/thunderbird-tags.json',
        '/home/jens/.config/thunderbird-tags.json',
        '/tmp/thunderbird-tags.json'
      ];

      // Just suggest the main path we use
      const pathDiv = document.createElement('div');
      pathDiv.className = 'path-option';
      pathDiv.textContent = '/home/jens/Sync/thunderbird-tags.json';
      pathDiv.addEventListener('click', () => {
        document.getElementById('syncFilePath').value = '/home/jens/Sync/thunderbird-tags.json';
        detectedPaths.style.display = 'none';
      });
      pathList.appendChild(pathDiv);

      showMessage('Syncthing folder detection not available. Recommended path is shown:', 'success');
    }
  } catch (error) {
    console.error('Error detecting Syncthing folders:', error);
    showMessage('Error detecting folders. Please enter the path manually.', 'error');
  }
}

function showMessage(message, type) {
  const toast = document.getElementById('statusMessage');
  toast.textContent = message;
  toast.className = `toast-notification ${type}`;
  toast.classList.remove('hide');
  toast.style.display = 'block';

  // Auto-hide after 5 seconds
  setTimeout(() => {
    toast.classList.add('hide');
    setTimeout(() => {
      toast.style.display = 'none';
    }, 300); // Wait for animation to finish
  }, 5000);
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
