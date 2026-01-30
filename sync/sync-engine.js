/**
 * Sync Engine
 * Handles synchronization between local tags and backend
 * Implements conflict resolution and merge logic
 */

class SyncEngine {
  constructor(backend, tagManager) {
    this.backend = backend;
    this.tagManager = tagManager;
    this.lastSyncTime = null;
  }

  /**
   * Perform full sync cycle
   * Pull from backend, merge with local, push back
   * @returns {Promise<Object>} Sync result { status, imported, exported, errors }
   */
  async sync() {
    const result = {
      status: 'pending',
      imported: 0,
      exported: 0,
      errors: [],
      conflictsResolved: 0,
      syncTime: new Date().toISOString(),
      duration: 0
    };

    const startTime = Date.now();

    try {
      if (typeof errorHandler === 'undefined') {
        console.warn('[SyncEngine] Error handler not available');
      } else {
        errorHandler.info('SyncEngine', 'Starting sync cycle');
      }

      // Step 1: Get local tags
      let localTags;
      try {
        localTags = await this.tagManager.getLocalTags();
      } catch (error) {
        throw new Error(`Failed to get local tags: ${error.message}`);
      }

      const localTagsData = {
        tags: localTags,
        exportedAt: Date.now(),
        version: '1.0'
      };

      // Step 2: Read from backend
      let remoteTagsData;
      try {
        remoteTagsData = await this.backend.readTags();
      } catch (error) {
        if (typeof errorHandler !== 'undefined') {
          errorHandler.warn('SyncEngine', `Backend read failed, treating as empty: ${error.message}`, error);
        } else {
          console.warn('[SyncEngine] Backend read failed:', error.message);
        }
        remoteTagsData = { tags: [] };
      }

      // Step 3: Merge tags
      const mergeResult = this._mergeTags(localTags, remoteTagsData.tags);

      // Step 4: Import new tags from backend
      if (mergeResult.tagsToImport.length > 0) {
        try {
          const importResult = await this.tagManager.importTags({
            tags: mergeResult.tagsToImport
          });
          result.imported = importResult.imported;
          if (importResult.errors.length > 0) {
            result.errors.push(...importResult.errors.map(e => `Import error: ${e.tagId} - ${e.error}`));
          }
        } catch (error) {
          throw new Error(`Failed to import tags: ${error.message}`);
        }
      }

      // Step 5: Export merged tags to backend
      const tagsToExport = [
        ...mergeResult.tagsToImport,
        ...mergeResult.localOnly,
        ...mergeResult.resolved
      ];

      if (tagsToExport.length > 0) {
        try {
          await this.backend.writeTags({
            tags: tagsToExport,
            syncedAt: Date.now(),
            version: '1.0'
          });
          result.exported = tagsToExport.length;
        } catch (error) {
          throw new Error(`Failed to write tags to backend: ${error.message}`);
        }
      }

      result.conflictsResolved = mergeResult.conflicts.length;
      if (mergeResult.conflicts.length > 0 && typeof errorHandler !== 'undefined') {
        errorHandler.info('SyncEngine', `Resolved ${mergeResult.conflicts.length} conflicts`);
      }

      result.status = 'success';
      this.lastSyncTime = Date.now();
      result.duration = Date.now() - startTime;

      if (typeof errorHandler !== 'undefined') {
        errorHandler.info('SyncEngine', `Sync complete in ${result.duration}ms - Imported: ${result.imported}, Exported: ${result.exported}`);
      } else {
        console.log('[SyncEngine] Sync complete:', result);
      }

      return result;
    } catch (error) {
      result.status = 'error';
      result.duration = Date.now() - startTime;
      result.errors.push(error.message);

      if (typeof errorHandler !== 'undefined') {
        const handled = errorHandler.handleSyncError(error, {
          backend: this.backend.getBackendType(),
          duration: result.duration
        });
        result.userMessage = handled.userMessage;
      } else {
        console.error('[SyncEngine] Sync failed:', error.message);
      }

      return result;
    }
  }

  /**
   * Merge local and remote tags
   * Resolution strategy: Newer wins (based on modified timestamp)
   * @private
   */
  _mergeTags(localTags, remoteTags) {
    const result = {
      tagsToImport: [],     // From remote, not in local
      localOnly: [],        // In local, not in remote
      resolved: [],         // Conflicts resolved
      conflicts: []         // Conflict info for logging
    };

    const localMap = new Map(localTags.map(t => [t.id, t]));
    const remoteMap = new Map(remoteTags.map(t => [t.id, t]));

    // Find remote-only and resolve conflicts
    for (const [tagId, remoteTag] of remoteMap) {
      const localTag = localMap.get(tagId);

      if (!localTag) {
        // Remote-only tag - import it
        result.tagsToImport.push(remoteTag);
      } else {
        // Tag exists in both - check for conflicts
        const localModified = localTag.modified || 0;
        const remoteModified = remoteTag.modified || 0;

        if (localModified !== remoteModified) {
          // Conflict! Use newer version
          const winner = localModified > remoteModified ? localTag : remoteTag;
          result.resolved.push(winner);
          result.conflicts.push({
            tagId,
            local: localTag,
            remote: remoteTag,
            resolution: winner
          });
        } else {
          // Same version
          result.resolved.push(localTag);
        }
      }
    }

    // Find local-only tags
    for (const [tagId, localTag] of localMap) {
      if (!remoteMap.has(tagId)) {
        result.localOnly.push(localTag);
      }
    }

    return result;
  }

  /**
   * Get last sync time
   * @returns {number|null} Unix timestamp or null
   */
  getLastSyncTime() {
    return this.lastSyncTime;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SyncEngine;
}
