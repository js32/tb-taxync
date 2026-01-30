/**
 * Popup script for Thunderbird Sync Labels extension
 */

// Load saved settings on popup open
document.addEventListener('DOMContentLoaded', async () => {
  await updateStatus();
  setupEventListeners();
});

/**
 * Setup popup event listeners
 */
function setupEventListeners() {
  const settingsButton = document.getElementById('settingsButton');
  if (settingsButton) {
    settingsButton.addEventListener('click', () => {
      browser.runtime.openOptionsPage?.() || window.open('settings.html');
    });
  }

  const logsButton = document.getElementById('logsButton');
  if (logsButton) {
    logsButton.addEventListener('click', async () => {
      try {
        // Open settings page with logs tab parameter
        const settingsUrl = browser.runtime.getURL('settings.html?tab=logs');
        window.open(settingsUrl, 'settings', 'width=700,height=800');
      } catch (error) {
        console.error('Failed to open settings:', error);
        browser.runtime.openOptionsPage?.();
      }
    });
  }
}

/**
 * Update popup with current extension status
 */
async function updateStatus() {
  try {
    const response = await browser.runtime.sendMessage({
      action: 'getStatus'
    });

    if (response.success) {
      const status = response.status;
      document.getElementById('syncToggle').checked = status.syncEnabled;

      // Update status display
      let statusText = '';
      if (!status.backendConfigured) {
        statusText = '⚠️ Auto-configuration in progress...';
        showStatus(statusText, 'error');
      } else if (status.lastSync) {
        const lastSyncDate = new Date(status.lastSync);
        statusText = `✓ Last sync: ${lastSyncDate.toLocaleString()}`;
        showStatus(statusText, 'success');
      } else {
        statusText = '✓ Ready to sync (auto-configured)';
        showStatus(statusText, 'success');
      }

      // Show backend info only if user wants to see settings
      // Don't clutter UI for zero-config experience
    }
  } catch (error) {
    console.error('Failed to get status:', error);
    showStatus('Failed to load status', 'error');
  }
}

// Handle sync toggle
document.getElementById('syncToggle').addEventListener('change', async (e) => {
  const enabled = e.target.checked;
  try {
    await browser.storage.local.set({ syncEnabled: enabled });
    showStatus(`Sync ${enabled ? 'enabled' : 'disabled'}`, 'success');
  } catch (error) {
    console.error('Failed to update sync setting:', error);
    showStatus('Failed to update setting', 'error');
  }
});

// Handle sync button click
document.getElementById('syncNow').addEventListener('click', async () => {
  const button = document.getElementById('syncNow');
  button.disabled = true;
  const originalText = button.textContent;
  button.textContent = 'Syncing...';

  try {
    // Send sync request to background script
    const response = await browser.runtime.sendMessage({
      action: 'performSync'
    });

    if (response.success) {
      const result = response.result;

      if (result.status === 'success') {
        let message = `✓ Sync successful! (${result.duration}ms)`;
        if (result.imported > 0 || result.exported > 0) {
          message += `\nImported: ${result.imported}, Exported: ${result.exported}`;
        }
        if (result.conflictsResolved > 0) {
          message += `\nConflicts resolved: ${result.conflictsResolved}`;
        }
        showStatus(message, 'success');
      } else if (result.status === 'error') {
        let message = result.userMessage || 'Sync failed';
        if (result.errors && result.errors.length > 0) {
          message += `\nError: ${result.errors[0]}`;
        }
        showStatus(`✗ ${message}`, 'error');
      }

      // Refresh status
      setTimeout(() => updateStatus(), 1000);
    } else {
      showStatus(`✗ Sync failed: ${response.error}`, 'error');
    }
  } catch (error) {
    console.error('Sync error:', error);
    showStatus(`✗ Sync failed: ${error.message}`, 'error');
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
});

/**
 * Show status message to user
 */
function showStatus(message, type) {
  const statusDiv = document.getElementById('status');
  statusDiv.textContent = message;
  statusDiv.className = 'status ' + type;
  statusDiv.style.display = 'block';

  setTimeout(() => {
    statusDiv.style.display = 'none';
  }, 4000);
}
