/**
 * Background script for Thunderbird Sync Labels extension
 */

// Import modules (loaded in manifest)
// Note: In real setup, use proper module loading

let syncEngine = null;
const SYNC_ALARM_NAME = 'periodic-sync';
const SYNC_TIMEOUT = 30000; // 30 seconds timeout for sync operations

// MV3 event pages get terminated after ~30s idle, and Thunderbird 128 does NOT
// wake a terminated page when browser.alarms fire. To make auto-sync reliable we
// keep the page alive with a lightweight API ping while sync is enabled.
const KEEPALIVE_INTERVAL_MS = 20000;
let keepAliveTimer = null;

// Default to filesystem backend for actual file syncing
const DEFAULT_BACKEND_TYPE = 'filesystem';

// Listen for extension installation or update
browser.runtime.onInstalled.addListener(async (details) => {
  console.log("Extension installed:", details);

  if (details.reason === "install") {
    console.log("First time installation - initializing default settings...");

    // No default path: the user must configure it in settings.
    await browser.storage.local.set({
      syncEnabled: false, // Disabled until user configures
      lastSync: null,
      syncInterval: 3600000, // 1 hour default
      backendConfig: {
        type: 'filesystem',
        filePath: ''
      },
      tagDefinitions: {},
      lastSyncedTags: null, // Snapshot for three-way merge (deletion tracking)
      tagModificationTimes: {} // Track tag modification timestamps
    });

    console.log('[Install] Configure path in settings to enable syncing');
  } else if (details.reason === "update") {
    console.log("Extension updated to version:", browser.runtime.getManifest().version);

    // Ensure a backendConfig object exists (path stays empty until configured)
    const storage = await browser.storage.local.get(['backendConfig', 'lastSyncedTags', 'tagModificationTimes']);
    if (!storage.backendConfig) {
      await browser.storage.local.set({
        syncEnabled: false,
        syncInterval: 3600000,
        backendConfig: {
          type: 'filesystem',
          filePath: ''
        }
      });
    }

    // Migration: Add deletion tracking support for existing users
    if (storage.lastSyncedTags === undefined || storage.tagModificationTimes === undefined) {
      console.log("[Migration] Adding deletion tracking support (three-way merge)");
      await browser.storage.local.set({
        lastSyncedTags: null,
        tagModificationTimes: {}
      });
      console.log("[Migration] Next sync will establish baseline snapshot");
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
    let requestedType = backendConfig.type;

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
      console.warn(`[Background] Backend connection test failed for type: ${requestedType}`);

      // Fallback to StorageBackend if filesystem fails
      if (requestedType === 'filesystem' && typeof StorageBackend !== 'undefined') {
        console.warn('[Background] Falling back to StorageBackend (filesystem not available)');
        backend = new StorageBackend({});
        const storageConnected = await backend.testConnection();
        if (!storageConnected) {
          console.error('[Background] Even StorageBackend failed');
          return;
        }
      } else {
        return;
      }
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

      else if (request.action === 'detectSyncthing') {
        try {
          const discovery = new PathDiscovery();
          const accessible = await discovery.discoverPaths();
          const folders = accessible.map(entry => ({
            path: entry.path,
            label: entry.label,
            type: entry.type,
            suggestedFile: discovery.suggestTagsPath(entry.path)
          }));
          sendResponse({ success: true, folders });
        } catch (err) {
          sendResponse({ success: false, folders: [], error: err.message });
        }
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

    // Lazy init: when an alarm wakes a suspended event page, the startup
    // IIFE that sets syncEngine may not have finished yet. Ensure it's ready.
    if (!syncEngine) {
      console.log('[Background] Sync engine not ready, initializing on demand...');
      await initializeSyncEngine();
    }

    if (!syncEngine) {
      throw new Error('Sync engine not initialized. Please configure backend in settings.');
    }

    // Perform actual sync
    const result = await syncEngine.sync();

    // Always store the result; only update lastSync on success so the
    // popup's "Last Sync" reflects the last SUCCESSFUL sync.
    const update = { lastSyncResult: result };
    if (result.status === 'success') {
      update.lastSync = Date.now();
    }
    await browser.storage.local.set(update);

    return result;
  } catch (error) {
    console.error('[Background] Sync failed:', error.message);

    // Persist the failure so the popup does not keep showing a stale success
    await browser.storage.local.set({
      lastSyncResult: {
        status: 'error',
        imported: 0,
        exported: 0,
        deleted: 0,
        errors: [error.message]
      }
    });

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
 * Start periodic sync scheduler using browser.alarms (survives background script restarts)
 */
async function startSyncScheduler() {
  try {
    stopSyncScheduler();

    const storage = await browser.storage.local.get(['syncInterval', 'syncEnabled']);
    const syncInterval = storage.syncInterval || 3600000; // Default 1 hour
    const syncEnabled = storage.syncEnabled;

    if (!syncEnabled || syncInterval === 0) {
      console.log('[Background] Sync scheduler disabled');
      return;
    }

    const periodInMinutes = syncInterval / 60000;
    console.log(`[Background] Sync scheduler starting with interval: ${periodInMinutes} minutes`);

    // Keep the event page awake so the alarm actually fires (see KEEPALIVE note)
    startKeepAlive();

    // Perform initial sync immediately
    await performSync().catch(err => {
      console.error('[Background] Initial sync failed:', err.message);
    });

    // Schedule periodic syncs via alarms (persists across background script restarts)
    browser.alarms.create(SYNC_ALARM_NAME, { periodInMinutes });

    console.log('[Background] Sync scheduler started (alarms)');
  } catch (error) {
    console.error('[Background] Failed to start sync scheduler:', error.message);
  }
}

/**
 * Stop periodic sync scheduler
 */
function stopSyncScheduler() {
  browser.alarms.clear(SYNC_ALARM_NAME);
  stopKeepAlive();
  console.log('[Background] Sync scheduler stopped');
}

/**
 * Keep the MV3 event page alive so alarms fire reliably.
 * A trivial API call every KEEPALIVE_INTERVAL_MS resets the idle-shutdown timer.
 */
function startKeepAlive() {
  if (keepAliveTimer !== null) return;
  keepAliveTimer = setInterval(() => {
    browser.runtime.getPlatformInfo().catch(() => {});
  }, KEEPALIVE_INTERVAL_MS);
  console.log('[Background] Keep-alive started (event page kept awake)');
}

function stopKeepAlive() {
  if (keepAliveTimer !== null) {
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
    console.log('[Background] Keep-alive stopped');
  }
}

// Handle alarm firing
browser.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === SYNC_ALARM_NAME) {
    console.log('[Background] Running scheduled sync (alarm)...');
    try {
      await performSync();
    } catch (error) {
      console.error('[Background] Scheduled sync failed:', error.message);
    }
  }
});

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
  if (typeof errorHandler !== 'undefined') {
    await errorHandler.init();
  }

  await initializeSyncEngine();

  // Start scheduler if enabled
  const storage = await browser.storage.local.get('syncEnabled');
  if (storage.syncEnabled) {
    await startSyncScheduler();
  }
})();
