/**
 * Storage Backend Adapter
 * Uses browser.storage.local to persist tags data
 * Perfect for Thunderbird WebExtension where file I/O APIs are limited
 * Works as fallback or primary backend
 */

class StorageBackend {
  constructor(config) {
    /**
     * config expected:
     * {
     *   storageKey: "thunderbird-sync-labels-tags" (optional)
     * }
     */
    this.config = config || {};
    this.name = 'storage';
    this.storageKey = this.config.storageKey || 'thunderbird-sync-labels-tags';
  }

  /**
   * Test connection to storage backend
   * Storage is always available in WebExtensions
   * @returns {Promise<boolean>}
   */
  async testConnection() {
    try {
      console.log(`[StorageBackend] Testing storage access...`);

      // Try reading from storage
      const data = await browser.storage.local.get(this.storageKey);
      console.log(`[StorageBackend] Storage accessible`);
      return true;
    } catch (error) {
      console.error(`[StorageBackend] Storage access failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Read tags from storage
   * @returns {Promise<Object>} { tags: [...], syncedAt: timestamp, version: "1.0" }
   */
  async readTags() {
    try {
      console.log(`[StorageBackend] Reading tags from storage key: ${this.storageKey}`);

      const data = await browser.storage.local.get(this.storageKey);
      const tagsData = data[this.storageKey];

      if (!tagsData) {
        console.log(`[StorageBackend] No tags found in storage, returning empty`);
        return { tags: [], version: '1.0', syncedAt: 0 };
      }

      // Parse if stored as JSON string
      if (typeof tagsData === 'string') {
        const parsed = JSON.parse(tagsData);
        console.log(`[StorageBackend] Read ${parsed.tags?.length || 0} tags from storage`);
        return parsed;
      }

      console.log(`[StorageBackend] Read ${tagsData.tags?.length || 0} tags from storage`);
      return tagsData;
    } catch (error) {
      console.error(`[StorageBackend] Failed to read tags: ${error.message}`);
      throw error;
    }
  }

  /**
   * Write tags to storage
   * @param {Object} tagsData - { tags: [...], syncedAt: timestamp, version: "1.0" }
   * @returns {Promise<void>}
   */
  async writeTags(tagsData) {
    try {
      console.log(`[StorageBackend] Writing ${tagsData.tags?.length || 0} tags to storage`);

      // Ensure syncedAt is set
      const dataToStore = {
        ...tagsData,
        syncedAt: tagsData.syncedAt || Date.now(),
        version: tagsData.version || '1.0'
      };

      await browser.storage.local.set({
        [this.storageKey]: dataToStore
      });

      console.log(`[StorageBackend] Successfully wrote tags to storage`);
    } catch (error) {
      console.error(`[StorageBackend] Failed to write tags: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get modification time
   * @returns {Promise<number>} Unix timestamp
   */
  async getModificationTime() {
    try {
      const data = await browser.storage.local.get(this.storageKey);
      const tagsData = data[this.storageKey];

      if (!tagsData || !tagsData.syncedAt) {
        return 0;
      }

      return tagsData.syncedAt;
    } catch (error) {
      console.error(`[StorageBackend] Failed to get modification time: ${error.message}`);
      return 0;
    }
  }

  /**
   * Get backend type
   * @returns {string}
   */
  getBackendType() {
    return this.name;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = StorageBackend;
}
