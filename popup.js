/**
 * Popup script for Thunderbird Sync Labels extension
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
    const storage = await browser.storage.local.get(['lastSync', 'lastSyncResult']);

    const lastSyncTime = document.getElementById('lastSyncTime');
    const syncStatus = document.getElementById('syncStatus');

    if (storage.lastSync) {
      const date = new Date(storage.lastSync);
      lastSyncTime.textContent = date.toLocaleString('en-US');

      if (storage.lastSyncResult?.status === 'success') {
        syncStatus.textContent = '✓ Success';
        syncStatus.style.color = '#155724';
      } else if (storage.lastSyncResult?.status === 'error') {
        syncStatus.textContent = '✗ Error';
        syncStatus.style.color = '#721c24';
      }
    } else {
      lastSyncTime.textContent = 'Not yet synced';
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
    const response = await browser.runtime.sendMessage({
      action: 'performSync'
    });

    if (response.success) {
      const result = response.result;

      if (result.status === 'success') {
        console.log('Sync successful!', result);
      } else {
        console.error('Sync failed:', result);
      }
    } else {
      console.error('Sync error:', response.error);
    }

    // Update status after sync
    setTimeout(() => {
      updateStatus();
      syncingMessage.style.display = 'none';
    }, 1000);
  } catch (error) {
    console.error('Sync error:', error);
    syncingMessage.style.display = 'none';
  } finally {
    syncButton.disabled = false;
  }
}
