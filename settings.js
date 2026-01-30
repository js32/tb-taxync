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
    showMessage('Hinweis: Die Dateiauswahl ist derzeit nur manuell über Texteingabe möglich.', 'error');
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
        logContainer.innerHTML = '<div class="empty-state">Keine Logs vorhanden. Führe einen Sync durch, um Logs zu generieren.</div>';
        updateLogStats(logs);
        return;
      }

      // Display logs
      logContainer.innerHTML = '';
      logs.forEach(log => {
        const entry = document.createElement('div');
        entry.className = `log-entry ${log.level || 'INFO'}`;

        const timestamp = new Date(log.timestamp).toLocaleString('de-DE');
        entry.innerHTML = `<span class="log-timestamp">${timestamp}</span><span class="log-level">${log.level || 'INFO'}</span><span class="log-message">${escapeHtml(log.message)}</span>`;

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
    showMessage('Fehler beim Download der Logs', 'error');
  }
}

/**
 * Clear all logs
 */
async function clearLogs() {
  if (!confirm('Möchtest du alle Logs löschen?')) {
    return;
  }

  try {
    await browser.runtime.sendMessage({ action: 'clearLogs' });
    showMessage('Logs gelöscht', 'success');
    loadAndDisplayLogs();
  } catch (error) {
    console.error('Error clearing logs:', error);
    showMessage('Fehler beim Löschen der Logs', 'error');
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
    syncFilePath: '/home/jens/Sync/thunderbird-tags.json',
    autoSync: true,
    syncOnChange: true,
    manualSync: true,
    syncInterval: 5
  };

  const settings = await browser.storage.local.get(defaults);

  document.getElementById('syncFilePath').value = settings.syncFilePath || '';
  document.getElementById('autoSync').checked = settings.autoSync;
  document.getElementById('syncOnChange').checked = settings.syncOnChange;
  document.getElementById('manualSync').checked = settings.manualSync;

  // Convert milliseconds back to minutes for display
  const syncIntervalMinutes = settings.syncInterval ? Math.round(settings.syncInterval / (60 * 1000)) : 5;
  document.getElementById('syncInterval').value = syncIntervalMinutes;
}

async function saveSettings() {
  const syncInterval = parseInt(document.getElementById('syncInterval').value) || 5;

  const settings = {
    syncFilePath: document.getElementById('syncFilePath').value.trim(),
    autoSync: document.getElementById('autoSync').checked,
    syncOnChange: document.getElementById('syncOnChange').checked,
    manualSync: document.getElementById('manualSync').checked,
    syncInterval: syncInterval * 60 * 1000 // Convert minutes to milliseconds
  };

  try {
    await browser.storage.local.set(settings);
    showMessage('Einstellungen erfolgreich gespeichert!', 'success');

    // Notify background script to reload settings
    await browser.runtime.sendMessage({ action: 'reloadSettings' });
  } catch (error) {
    showMessage(`Fehler beim Speichern: ${error.message}`, 'error');
  }
}

async function testSync() {
  showMessage('Teste Synchronisierung...', 'success');

  try {
    const response = await browser.runtime.sendMessage({ action: 'performSync' });

    if (response.success) {
      showMessage('Sync-Test erfolgreich!', 'success');
    } else {
      showMessage(`Sync-Test fehlgeschlagen: ${response.error}`, 'error');
    }
  } catch (error) {
    showMessage(`Fehler beim Sync-Test: ${error.message}`, 'error');
  }
}

async function detectSyncthingFolders() {
  const detectedPaths = document.getElementById('detectedPaths');
  const pathList = document.getElementById('pathList');

  pathList.innerHTML = '<div style="text-align: center; padding: 10px;">Suche nach Syncthing-Ordnern...</div>';
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
        pathDiv.innerHTML = `<strong>${folder.path}</strong><br><small>${folder.suggestedFile}</small>`;
        pathDiv.addEventListener('click', () => {
          document.getElementById('syncFilePath').value = folder.suggestedFile;
          detectedPaths.style.display = 'none';
        });
        pathList.appendChild(pathDiv);
      });
      showMessage(`${response.folders.length} Syncthing-Ordner gefunden!`, 'success');
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

      showMessage('Syncthing-Ordner-Erkennung nicht verfügbar. Empfohlener Pfad wird angezeigt:', 'success');
    }
  } catch (error) {
    console.error('Error detecting Syncthing folders:', error);
    showMessage('Fehler bei der Ordner-Erkennung. Bitte gib den Pfad manuell ein.', 'error');
  }
}

function showMessage(message, type) {
  const statusMessage = document.getElementById('statusMessage');
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${type}`;
  statusMessage.style.display = 'block';

  setTimeout(() => {
    statusMessage.style.display = 'none';
  }, 5000);
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
