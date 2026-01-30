/**
 * Background script for Thunderbird Sync Labels extension
 */

// Import modules (loaded in manifest)
// Note: In real setup, use proper module loading

let syncEngine = null;
let syncScheduler = null;
const SYNC_TIMEOUT = 30000; // 30 seconds timeout for sync operations

// Default to storage backend instead of filesystem
const DEFAULT_BACKEND_TYPE = 'storage';

// Listen for extension installation or update
browser.runtime.onInstalled.addListener(async (details) => {
  console.log("Extension installed:", details);

  if (details.reason === "install") {
    console.log("First time installation - setting default backend...");

    // Initialize default settings with storage backend
    await browser.storage.local.set({
      syncEnabled: false, // Disabled until user configures
      lastSync: null,
      syncInterval: 3600000, // 1 hour default
      backendConfig: {
        type: 'storage',
        storageKey: 'thunderbird-sync-labels-tags'
      },
      tagDefinitions: {}
    });

    console.log(`[Install] Default backend set to: storage`);
    console.log('[Install] Extension is ready to use with storage backend');
  } else if (details.reason === "update") {
    console.log("Extension updated to version:", browser.runtime.getManifest().version);

    // Check if backend is configured, if not, set default
    const storage = await browser.storage.local.get('backendConfig');
    if (!storage.backendConfig || (!storage.backendConfig.storageKey && !storage.backendConfig.filePath)) {
      console.log("[Update] No backend configured, setting default to storage...");
      await browser.storage.local.set({
        syncEnabled: false,
        syncInterval: 3600000,
        backendConfig: {
          type: 'storage',
          storageKey: 'thunderbird-sync-labels-tags'
        }
      });
      console.log(`[Update] Default backend set to: storage`);
    }
  }

  // Initialize sync engine
  await initializeSyncEngine();

  // Auto-start sync if enabled
  const storage = await browser.storage.local.get('syncEnabled');
  if (storage.syncEnabled) {
    await startSyncScheduler();
  }
});

/**
 * Get default tags path for first install
 */
async function getDefaultTagsPath() {
  const platform = navigator.platform.toLowerCase();

  // Get username from profile path
  let username = null;

  try {
    if (typeof browser.fileIO !== 'undefined' && browser.fileIO.getProfileDir) {
      const profileDir = browser.fileIO.getProfileDir();
      console.log('[AutoConfig] Profile directory:', profileDir);

      if (profileDir) {
        // Extract username from profile path
        const match = profileDir.match(/\/home\/([^\/]+)/) || profileDir.match(/\/Users\/([^\/]+)/) || profileDir.match(/Users\\([^\\]+)/);
        if (match && match[1]) {
          username = match[1];
          console.log('[AutoConfig] Detected username from profile:', username);
        }
      }
    }
  } catch (error) {
    console.warn('[AutoConfig] Could not get profile directory:', error.message);
  }

  // Fallback: try to read environment or use common usernames
  if (!username) {
    console.log('[AutoConfig] Falling back to manual username detection');

    // For Linux, check if /home/jens exists (common development setup)
    if (platform.includes('linux')) {
      try {
        // Try common Linux usernames in order
        const commonUsers = ['jens', 'user', 'ubuntu', 'debian'];
        for (const testUser of commonUsers) {
          const testPath = `/home/${testUser}`;
          const exists = await browser.fileIO.exists(testPath);
          if (exists) {
            username = testUser;
            console.log('[AutoConfig] Found existing home directory:', testPath);
            break;
          }
        }
      } catch (error) {
        console.warn('[AutoConfig] Could not check home directories:', error.message);
      }
    }
  }

  // Final fallback
  if (!username) {
    username = 'user';
    console.log('[AutoConfig] Using fallback username: user');
  }

  // Return platform-specific home directory path
  let defaultPath;
  if (platform.includes('linux')) {
    defaultPath = `/home/${username}/Sync/thunderbird-tags.json`;
  } else if (platform.includes('mac')) {
    defaultPath = `/Users/${username}/Sync/thunderbird-tags.json`;
  } else {
    defaultPath = `C:\\Users\\${username}\\Sync\\thunderbird-tags.json`;
  }

  console.log('[AutoConfig] Default tags path:', defaultPath);
  return defaultPath;
}

/**
 * Initialize the sync engine with configured backend
 */
async function initializeSyncEngine() {
  try {
    const storage = await browser.storage.local.get(['backendConfig']);
    const backendConfig = storage.backendConfig;

    if (!backendConfig || !backendConfig.type) {
      console.warn('[Background] Backend not configured');
      return;
    }

    console.log('[Background] Initializing sync engine with backend:', backendConfig.type);
    console.log('[Background] Backend config:', JSON.stringify(backendConfig));

    // Create appropriate backend adapter
    let backend;
    switch (backendConfig.type) {
      case 'storage':
        if (typeof StorageBackend !== 'undefined') {
          backend = new StorageBackend(backendConfig);
          console.log('[Background] Using StorageBackend');
        } else {
          console.error('[Background] StorageBackend not loaded');
          return;
        }
        break;

      case 'filesystem':
        if (typeof FilesystemBackend !== 'undefined') {
          backend = new FilesystemBackend(backendConfig);
          console.log('[Background] Using FilesystemBackend');
        } else {
          console.error('[Background] FilesystemBackend not loaded');
          return;
        }
        break;

      default:
        console.error('[Background] Unknown backend type:', backendConfig.type);
        return;
    }

    // Test backend connection
    const connected = await backend.testConnection();
    if (!connected) {
      console.warn('[Background] Backend connection test failed');
      return;
    }

    // Initialize tag manager and sync engine
    if (typeof TagManager === 'undefined' || typeof SyncEngine === 'undefined') {
      console.error('[Background] Tag manager or sync engine not loaded');
      return;
    }

    const tagManager = new TagManager();
    await tagManager.init();

    syncEngine = new SyncEngine(backend, tagManager);
    console.log('[Background] Sync engine initialized and ready');
  } catch (error) {
    console.error('[Background] Failed to initialize sync engine:', error.message);
  }
}

/**
 * Handle messages from popup or other parts of the extension
 * IMPORTANT: Must return true to indicate async response
 */
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Background] Message received:', request.action);

  // Handle async operations
  (async () => {
    try {
      if (request.action === 'performSync') {
        const result = await performSync();
        sendResponse({ success: true, result });
      }

      else if (request.action === 'getStatus') {
        const status = await getExtensionStatus();
        sendResponse({ success: true, status });
      }

      else if (request.action === 'updateBackendConfig') {
        await browser.storage.local.set({
          backendConfig: request.config
        });
        await initializeSyncEngine();
        sendResponse({ success: true });
      }

      else if (request.action === 'getLogs') {
        if (typeof errorHandler !== 'undefined') {
          const logs = errorHandler.getHistory(200);
          sendResponse({ success: true, logs });
        } else {
          sendResponse({ success: true, logs: [] });
        }
      }

      else if (request.action === 'clearLogs') {
        if (typeof errorHandler !== 'undefined') {
          errorHandler.clearHistory();
        }
        sendResponse({ success: true });
      }

      else if (request.action === 'testPath') {
        const testBackend = new FilesystemBackend({ filePath: request.path });
        const connected = await testBackend.testConnection();
        sendResponse({ success: connected, message: connected ? 'Path is accessible' : 'Path not accessible' });
      }

      else {
        sendResponse({ success: false, error: 'Unknown action: ' + request.action });
      }
    } catch (error) {
      console.error('[Background] Message handler error:', error);
      sendResponse({ success: false, error: error.message });
    }
  })();

  // Return true to indicate we will respond asynchronously
  return true;
});

/**
 * Perform sync with backend
 */
async function performSync() {
  try {
    console.log('[Background] Starting sync...');

    if (!syncEngine) {
      throw new Error('Sync engine not initialized. Please configure backend in settings.');
    }

    // Perform actual sync
    const result = await syncEngine.sync();

    // Update last sync time and result
    await browser.storage.local.set({
      lastSync: Date.now(),
      lastSyncResult: result
    });

    return result;
  } catch (error) {
    console.error('[Background] Sync failed:', error.message);
    throw error;
  }
}

/**
 * Get current extension status
 */
async function getExtensionStatus() {
  const storage = await browser.storage.local.get([
    'syncEnabled',
    'lastSync',
    'backendConfig',
    'lastSyncResult'
  ]);

  return {
    syncEnabled: storage.syncEnabled || false,
    lastSync: storage.lastSync || null,
    backendConfigured: !!(storage.backendConfig?.filePath),
    backendType: storage.backendConfig?.type || 'none',
    lastSyncResult: storage.lastSyncResult || null
  };
}

/**
 * Start periodic sync scheduler
 */
async function startSyncScheduler() {
  try {
    // Stop existing scheduler if running
    stopSyncScheduler();

    const storage = await browser.storage.local.get(['syncInterval', 'syncEnabled']);
    const syncInterval = storage.syncInterval || 3600000; // Default 1 hour
    const syncEnabled = storage.syncEnabled;

    if (!syncEnabled || syncInterval === 0) {
      console.log('[Background] Sync scheduler disabled');
      return;
    }

    console.log(`[Background] Sync scheduler starting with interval: ${syncInterval}ms`);

    // Perform initial sync
    await performSync().catch(err => {
      console.error('[Background] Initial sync failed:', err.message);
    });

    // Schedule periodic syncs
    syncScheduler = setInterval(async () => {
      console.log('[Background] Running scheduled sync...');
      try {
        await performSync();
      } catch (error) {
        console.error('[Background] Scheduled sync failed:', error.message);
        // Continue with next interval even if sync fails
      }
    }, syncInterval);

    console.log('[Background] Sync scheduler started');
  } catch (error) {
    console.error('[Background] Failed to start sync scheduler:', error.message);
  }
}

/**
 * Stop periodic sync scheduler
 */
function stopSyncScheduler() {
  if (syncScheduler) {
    clearInterval(syncScheduler);
    syncScheduler = null;
    console.log('[Background] Sync scheduler stopped');
  }
}

/**
 * Listen for storage changes to trigger actions
 */
browser.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName === 'local') {
    let needsSchedulerRestart = false;

    if (changes.syncEnabled) {
      console.log('[Background] Sync enabled changed to:', changes.syncEnabled.newValue);
      needsSchedulerRestart = true;
    }

    if (changes.syncInterval) {
      console.log('[Background] Sync interval changed to:', changes.syncInterval.newValue);
      needsSchedulerRestart = true;
    }

    if (changes.backendConfig) {
      console.log('[Background] Backend config changed');
      await initializeSyncEngine();
      // Don't restart scheduler, let current interval continue
    }

    if (needsSchedulerRestart) {
      if (changes.syncEnabled?.newValue === false) {
        stopSyncScheduler();
      } else {
        await startSyncScheduler();
      }
    }
  }
});

// Initialize on load
console.log("Background script loaded");
(async () => {
  await initializeSyncEngine();

  // Start scheduler if enabled
  const storage = await browser.storage.local.get('syncEnabled');
  if (storage.syncEnabled) {
    await startSyncScheduler();
  }
})();
