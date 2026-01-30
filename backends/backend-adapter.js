/**
 * Abstract Backend Adapter
 * Base class for all backend implementations (Dropbox, Syncthing, SMB, etc.)
 */

class BackendAdapter {
  constructor(config) {
    this.config = config;
    this.name = 'abstract';
  }

  /**
   * Test connection to backend
   * @returns {Promise<boolean>} true if connected successfully
   */
  async testConnection() {
    throw new Error('testConnection() not implemented');
  }

  /**
   * Read tags file from backend
   * @returns {Promise<Object>} tags object with structure { tags: [...] }
   */
  async readTags() {
    throw new Error('readTags() not implemented');
  }

  /**
   * Write tags file to backend
   * @param {Object} tagsData - tags object with structure { tags: [...] }
   * @returns {Promise<void>}
   */
  async writeTags(tagsData) {
    throw new Error('writeTags() not implemented');
  }

  /**
   * Get modification time of tags file on backend
   * @returns {Promise<number>} Unix timestamp
   */
  async getModificationTime() {
    throw new Error('getModificationTime() not implemented');
  }

  /**
   * Get backend type name (for logging and identification)
   * @returns {string}
   */
  getBackendType() {
    return this.name;
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BackendAdapter;
}
