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
   * @returns {Promise<Object>} Sync result { status, imported, exported, deleted, errors }
   */
  async sync() {
    const result = {
      status: 'pending',
      imported: 0,
      exported: 0,
      deleted: 0,
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

      // Step 1: Get local tags (current state)
      let localTags;
      try {
        localTags = await this.tagManager.getLocalTags();
      } catch (error) {
        throw new Error(`Failed to get local tags: ${error.message}`);
      }

      // Step 2: Read from backend (remote state)
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

      // Step 3: Get last synced state from storage
      const storage = await browser.storage.local.get('lastSyncedTags');
      const lastSyncedState = storage.lastSyncedTags || null;

      // Step 4: Three-way merge
      const mergeResult = this._threeWayMerge(
        localTags,
        remoteTagsData.tags,
        lastSyncedState ? lastSyncedState.tags : []
      );

      // Step 5: Apply local changes (import new/updated tags)
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

      // Step 6: Delete tags that were deleted remotely
      if (mergeResult.tagsToDeleteLocally.length > 0) {
        for (const tagId of mergeResult.tagsToDeleteLocally) {
          try {
            await this.tagManager.deleteTag(tagId);
            result.deleted++;
          } catch (error) {
            result.errors.push(`Failed to delete tag ${tagId}: ${error.message}`);
          }
        }
      }

      // Step 7: Export merged tags to backend
      const tagsToExport = mergeResult.finalTagSet;

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

      // Step 8: Save the new synchronized state as the snapshot
      await browser.storage.local.set({
        lastSyncedTags: {
          tags: tagsToExport,
          timestamp: Date.now()
        }
      });

      result.conflictsResolved = mergeResult.conflicts.length;
      if (mergeResult.conflicts.length > 0 && typeof errorHandler !== 'undefined') {
        errorHandler.info('SyncEngine', `Resolved ${mergeResult.conflicts.length} conflicts`);
        mergeResult.conflicts.forEach(conflict => {
          errorHandler.debug('SyncEngine', `Conflict: ${conflict.type} for tag ${conflict.tagId} - ${conflict.reason || 'Newer wins'}`);
        });
      }

      result.status = 'success';
      this.lastSyncTime = Date.now();
      result.duration = Date.now() - startTime;

      if (typeof errorHandler !== 'undefined') {
        errorHandler.info('SyncEngine', `Sync complete in ${result.duration}ms - Imported: ${result.imported}, Exported: ${result.exported}, Deleted: ${result.deleted}`);
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
   * Three-way merge algorithm
   * Compares local, remote, and last synced state to detect all changes
   *
   * @param {Array} localTags - Current local tags from Thunderbird
   * @param {Array} remoteTags - Current remote tags from backend
   * @param {Array} baseTags - Last synced state (snapshot from previous sync)
   * @returns {Object} Merge result with actions to take
   * @private
   */
  _threeWayMerge(localTags, remoteTags, baseTags) {
    const result = {
      tagsToImport: [],           // Import to local Thunderbird
      tagsToDeleteLocally: [],    // Delete from local Thunderbird
      finalTagSet: [],            // Final merged set to write to backend
      conflicts: []               // Conflict information
    };

    // Create maps for efficient lookup
    const localMap = new Map(localTags.map(t => [t.id, t]));
    const remoteMap = new Map(remoteTags.map(t => [t.id, t]));
    const baseMap = new Map(baseTags.map(t => [t.id, t]));

    // Get all unique tag IDs across all three states
    const allTagIds = new Set([
      ...localMap.keys(),
      ...remoteMap.keys(),
      ...baseMap.keys()
    ]);

    for (const tagId of allTagIds) {
      const local = localMap.get(tagId);
      const remote = remoteMap.get(tagId);
      const base = baseMap.get(tagId);

      // Case 1: Tag exists in all three states
      if (local && remote && base) {
        const localChanged = this._tagsAreDifferent(local, base);
        const remoteChanged = this._tagsAreDifferent(remote, base);

        if (!localChanged && !remoteChanged) {
          // No changes - keep current version
          result.finalTagSet.push(local);
        } else if (localChanged && !remoteChanged) {
          // Only local changed - use local
          result.finalTagSet.push(local);
        } else if (!localChanged && remoteChanged) {
          // Only remote changed - import remote
          result.tagsToImport.push(remote);
          result.finalTagSet.push(remote);
        } else {
          // Both changed - CONFLICT! Use newer timestamp
          const winner = local.modified > remote.modified ? local : remote;
          if (winner === remote) {
            result.tagsToImport.push(remote);
          }
          result.finalTagSet.push(winner);
          result.conflicts.push({
            tagId,
            type: 'modify-modify',
            local,
            remote,
            base,
            resolution: winner
          });
        }
      }
      // Case 2: Tag exists locally and in base, but NOT remotely
      else if (local && base && !remote) {
        const localChanged = this._tagsAreDifferent(local, base);

        if (localChanged) {
          // CONFLICT: Deleted remotely but modified locally
          // Resolution: Local wins (keep the tag)
          result.finalTagSet.push(local);
          result.conflicts.push({
            tagId,
            type: 'modify-delete',
            local,
            remote: null,
            base,
            resolution: local,
            reason: 'Local modification wins over remote deletion'
          });
        } else {
          // Deleted remotely, unchanged locally - respect deletion
          result.tagsToDeleteLocally.push(tagId);
          // Don't include in final set (deleted)
        }
      }
      // Case 3: Tag exists remotely and in base, but NOT locally
      else if (remote && base && !local) {
        const remoteChanged = this._tagsAreDifferent(remote, base);

        if (remoteChanged) {
          // CONFLICT: Deleted locally but modified remotely
          // Resolution: Remote wins (restore the tag)
          result.tagsToImport.push(remote);
          result.finalTagSet.push(remote);
          result.conflicts.push({
            tagId,
            type: 'delete-modify',
            local: null,
            remote,
            base,
            resolution: remote,
            reason: 'Remote modification wins over local deletion'
          });
        } else {
          // Deleted locally, unchanged remotely - respect deletion
          // Don't include in final set (deleted)
        }
      }
      // Case 4: Tag exists locally and remotely, but NOT in base
      else if (local && remote && !base) {
        // Added on both sides - check if they're identical
        if (!this._tagsAreDifferent(local, remote)) {
          // Same tag created on both sides - no conflict
          result.finalTagSet.push(local);
        } else {
          // Different tags with same ID - use newer
          const winner = local.modified > remote.modified ? local : remote;
          if (winner === remote) {
            result.tagsToImport.push(remote);
          }
          result.finalTagSet.push(winner);
          result.conflicts.push({
            tagId,
            type: 'add-add',
            local,
            remote,
            resolution: winner
          });
        }
      }
      // Case 5: Tag exists ONLY locally (new local tag)
      else if (local && !remote && !base) {
        // New local tag - add to final set
        result.finalTagSet.push(local);
      }
      // Case 6: Tag exists ONLY remotely (new remote tag)
      else if (remote && !local && !base) {
        // New remote tag - import it
        result.tagsToImport.push(remote);
        result.finalTagSet.push(remote);
      }
      // Case 7: Tag exists ONLY in base (deleted on both sides)
      else if (base && !local && !remote) {
        // Deleted on both sides - no action needed
        // Don't include in final set
      }
    }

    return result;
  }

  /**
   * Check if two tags are different
   * @private
   */
  _tagsAreDifferent(tag1, tag2) {
    return tag1.name !== tag2.name || tag1.color !== tag2.color;
    // Note: Don't compare modified timestamp here, as it's used for conflict resolution
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
