/**
 * Popup script for TB-TaXync
 */

document.addEventListener('DOMContentLoaded', async () => {
  await updateStatus();
  setupEventListeners();
});

/**
 * Setup popup event listeners
 */
function setupEventListeners() {
  const settingsLink = document.getElementById('settingsLink');
  if (settingsLink) {
    settingsLink.addEventListener('click', (e) => {
      e.preventDefault();
      browser.runtime.openOptionsPage?.();
    });
  }

  const syncButton = document.getElementById('syncButton');
  if (syncButton) {
    syncButton.addEventListener('click', performSync);
  }
}

/**
 * Update popup with current extension status
 */
async function updateStatus() {
  try {
    const storage = await browser.storage.local.get(['lastSync', 'lastSyncResult', 'backendConfig']);

    const statusContainer = document.getElementById('statusContainer');
    const lastSyncTime = document.getElementById('lastSyncTime');
    const syncStatus = document.getElementById('syncStatus');
    const syncDetails = document.getElementById('syncDetails');
    const syncButton = document.getElementById('syncButton');

    // Backend not configured yet: point the user to the settings
    if (!storage.backendConfig?.filePath) {
      statusContainer.className = 'status';
      lastSyncTime.textContent = 'Not configured';
      syncStatus.textContent = '';
      syncDetails.textContent = 'Set a sync file path in the settings first.';
      syncButton.disabled = true;
      return;
    }
    syncButton.disabled = false;

    if (storage.lastSync) {
      const date = new Date(storage.lastSync);
      lastSyncTime.textContent = date.toLocaleString();
    } else {
      lastSyncTime.textContent = 'Not yet synced';
    }

    if (storage.lastSyncResult?.status === 'success') {
      const result = storage.lastSyncResult;
      const hasTagErrors = result.errors?.length > 0;

      // A sync can report "success" (it ran to completion and wrote the
      // backend file) while still failing to apply individual tags - e.g.
      // a tag that already exists locally under a different key. Surface
      // that instead of silently showing a plain checkmark.
      statusContainer.className = hasTagErrors ? 'status warning' : 'status success';
      syncStatus.textContent = hasTagErrors ? '⚠ Success with errors' : '✓ Success';

      // Show sync details (imported, exported, deleted)
      const details = [];
      if (result.imported > 0) details.push(`${result.imported} imported`);
      if (result.exported > 0) details.push(`${result.exported} exported`);
      if (result.deleted > 0) details.push(`${result.deleted} deleted`);

      let detailsText = details.length > 0 ? details.join(', ') : 'No changes';
      if (hasTagErrors) {
        const suffix = result.errors.length === 1
          ? result.errors[0]
          : `${result.errors.length} tags failed - see Settings → Logs for details`;
        detailsText += ` (${suffix})`;
      }
      syncDetails.textContent = detailsText;
    } else if (storage.lastSyncResult?.status === 'error') {
      statusContainer.className = 'status error';
      syncStatus.textContent = '✗ Error';
      syncDetails.textContent = storage.lastSyncResult.userMessage
        || storage.lastSyncResult.errors?.[0]
        || 'Unknown error';
    } else {
      statusContainer.className = 'status';
      syncStatus.textContent = '';
      syncDetails.textContent = '';
    }
  } catch (error) {
    console.error('Failed to get status:', error);
  }
}

/**
 * Perform sync
 */
async function performSync() {
  const syncButton = document.getElementById('syncButton');
  const syncingMessage = document.getElementById('syncingMessage');

  syncButton.disabled = true;
  syncingMessage.style.display = 'block';

  try {
    await browser.runtime.sendMessage({ action: 'performSync' });
  } catch (error) {
    console.error('Sync error:', error);
  } finally {
    // The background script stores the outcome (success or error) in
    // lastSyncResult, so refreshing the status shows it either way.
    syncingMessage.style.display = 'none';
    syncButton.disabled = false;
    await updateStatus();
  }
}
