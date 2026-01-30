/**
 * Settings page script
 */

// DOM Elements
const syncTypeSelect = document.getElementById('syncType');
const filesystemPath = document.getElementById('filesystemPath');
const testFilesystemButton = document.getElementById('testFilesystemButton');
const syncIntervalInput = document.getElementById('syncInterval');
const enableAutoSyncCheckbox = document.getElementById('enableAutoSync');
const saveButton = document.getElementById('saveButton');
const cancelButton = document.getElementById('cancelButton');
const statusMessage = document.getElementById('statusMessage');

// Load settings on page load
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  setupEventListeners();
});

/**
 * Load current settings from storage
 */
async function loadSettings() {
  try {
    const storage = await browser.storage.local.get([
      'backendConfig',
      'syncInterval',
      'syncEnabled',
      'syncType'
    ]);

    const backendConfig = storage.backendConfig || {};

    // Load sync type
    if (storage.syncType) {
      syncTypeSelect.value = storage.syncType;
    }

    // Load filesystem path
    if (backendConfig.filePath) {
      filesystemPath.value = backendConfig.filePath;
    }

    // Load sync settings
    if (storage.syncInterval) {
      syncIntervalInput.value = storage.syncInterval / 60000; // Convert ms to minutes
    }

    enableAutoSyncCheckbox.checked = storage.syncEnabled || false;
  } catch (error) {
    console.error('Failed to load settings:', error);
    showStatus('Failed to load settings', 'error');
  }
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  syncTypeSelect.addEventListener('change', updatePathSuggestion);
  testFilesystemButton.addEventListener('click', testFilesystemConnection);
  saveButton.addEventListener('click', saveSettings);
  cancelButton.addEventListener('click', closeSettings);
}

/**
 * Update path suggestion based on sync type
 */
function updatePathSuggestion() {
  const syncType = syncTypeSelect.value;

  if (syncType === 'syncthing') {
    filesystemPath.value = '/home/jens/Sync/thunderbird-tags.json';
    filesystemPath.placeholder = '/home/jens/Sync/thunderbird-tags.json';
    console.log('[Settings] Set Syncthing path');
  } else if (syncType === 'smb') {
    filesystemPath.value = '/mnt/smb/thunderbird-tags.json';
    filesystemPath.placeholder = '/mnt/smb/thunderbird-tags.json';
    console.log('[Settings] Set SMB path');
  } else {
    filesystemPath.value = '';
    filesystemPath.placeholder = 'Select sync method above first';
  }
}


/**
 * Test filesystem connection
 */
async function testFilesystemConnection() {
  const path = filesystemPath.value.trim();

  if (!path) {
    showStatus('Please enter a file path', 'error');
    return;
  }

  testFilesystemButton.disabled = true;
  showStatus('Testing connection...', 'info');

  try {
    // Send test request to background script
    const response = await browser.runtime.sendMessage({
      action: 'testPath',
      path: path
    });

    const testResult = document.getElementById('testResult');
    if (response.success) {
      testResult.innerHTML = '<span style="color: green;">✓ Path is accessible and writable</span>';
      showStatus('Connection test successful', 'success');
    } else {
      testResult.innerHTML = `<span style="color: red;">✗ ${response.message || response.error}</span>`;
      showStatus(`Connection test failed: ${response.message || response.error}`, 'error');
    }
  } catch (error) {
    const testResult = document.getElementById('testResult');
    testResult.innerHTML = `<span style="color: red;">✗ Error: ${error.message}</span>`;
    showStatus(`Connection test failed: ${error.message}`, 'error');
  } finally {
    testFilesystemButton.disabled = false;
  }
}

/**
 * Save all settings
 */
async function saveSettings() {
  const syncType = syncTypeSelect.value;

  saveButton.disabled = true;
  showStatus('Saving settings...', 'info');

  try {
    // Use Storage backend by default (more reliable)
    // But allow filesystem if path is specified
    let backendConfig;

    if (syncType === 'storage' || !syncType) {
      // Use modern storage backend
      backendConfig = {
        type: 'storage',
        storageKey: 'thunderbird-sync-labels-tags'
      };
      console.log('[Settings] Using Storage Backend');
    } else {
      // User wants filesystem backend
      const path = filesystemPath.value.trim();
      if (!path) {
        showStatus('Please enter a file path for filesystem backend', 'error');
        saveButton.disabled = false;
        return;
      }
      backendConfig = {
        type: 'filesystem',
        filePath: path
      };
      console.log('[Settings] Using Filesystem Backend:', path);
    }

    // Convert interval from minutes to milliseconds
    const syncIntervalMs = parseInt(syncIntervalInput.value) * 60 * 1000;

    await browser.storage.local.set({
      backendConfig: backendConfig,
      syncInterval: syncIntervalMs,
      syncEnabled: enableAutoSyncCheckbox.checked,
      syncType: syncType
    });

    // Notify background script of config change
    await browser.runtime.sendMessage({
      action: 'updateBackendConfig',
      config: backendConfig
    });

    showStatus('Settings saved successfully!', 'success');

    // Close after a brief delay
    setTimeout(() => {
      closeSettings();
    }, 1500);
  } catch (error) {
    console.error('Failed to save settings:', error);
    showStatus(`Failed to save settings: ${error.message}`, 'error');
  } finally {
    saveButton.disabled = false;
  }
}

/**
 * Show status message
 */
function showStatus(message, type) {
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${type}`;
}

/**
 * Close settings page/window
 */
function closeSettings() {
  // If opened as a popup, close the window
  if (window.opener) {
    window.close();
  } else {
    // Otherwise navigate back to home or previous page
    window.location.href = 'popup.html';
  }
}
