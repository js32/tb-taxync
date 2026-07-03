/**
 * Filesystem Backend Adapter
 * Works with local filesystem paths (for SMB, Syncthing, NFS mounts, etc.)
 * Uses the fileIO experiment API (IOUtils, Thunderbird 128+)
 */

class FilesystemBackend {
  constructor(config) {
    /**
     * config expected:
     * {
     *   filePath: "/path/to/tags.json"
     * }
     */
    this.config = config;
    this.name = 'filesystem';
    this.filePath = config.filePath;
  }

  async testConnection() {
    try {
      console.log(`[Filesystem] Testing connection for path: ${this.filePath}`);

      if (typeof browser === 'undefined' || typeof browser.fileIO === 'undefined') {
        console.warn('[Filesystem] fileIO experiment API not available - filesystem backend cannot be used');
        return false;
      }

      if (!this.filePath || typeof this.filePath !== 'string') {
        console.error('[Filesystem] Invalid file path');
        return false;
      }

      const lastSlash = Math.max(
        this.filePath.lastIndexOf('/'),
        this.filePath.lastIndexOf('\\')
      );

      if (lastSlash === -1) {
        console.error(`[Filesystem] Invalid file path (no directory separator): ${this.filePath}`);
        return false;
      }

      // File not existing yet is fine - it will be created on first sync.
      // If it exists, verify we can actually read it.
      const fileExists = await browser.fileIO.exists(this.filePath);
      if (fileExists) {
        try {
          await browser.fileIO.readUTF8(this.filePath);
        } catch (error) {
          console.error(`[Filesystem] Cannot read file (permission denied?): ${error.message}`);
          return false;
        }
      } else {
        console.log(`[Filesystem] Tags file does not exist (will be created on first sync): ${this.filePath}`);
      }

      return true;
    } catch (error) {
      console.error(`[Filesystem] Connection test failed: ${error.message}`);
      return false;
    }
  }

  async readTags() {
    try {
      const fileExists = await browser.fileIO.exists(this.filePath);

      if (!fileExists) {
        console.log(`[Filesystem] Tags file does not exist, returning empty tags`);
        return { tags: [] };
      }

      const content = await browser.fileIO.readUTF8(this.filePath);
      const tagsData = JSON.parse(content);

      console.log(`[Filesystem] Read ${tagsData.tags?.length || 0} tags from ${this.filePath}`);
      return tagsData;
    } catch (error) {
      console.error(`[Filesystem] Failed to read tags: ${error.message}`);
      throw error;
    }
  }

  async writeTags(tagsData) {
    try {
      const content = JSON.stringify(tagsData, null, 2);

      // fileIO.writeUTF8 creates parent directories and writes atomically
      await browser.fileIO.writeUTF8(this.filePath, content);

      console.log(`[Filesystem] Wrote ${tagsData.tags?.length || 0} tags to ${this.filePath}`);
    } catch (error) {
      console.error(`[Filesystem] Failed to write tags: ${error.message}`);
      throw error;
    }
  }

  async getModificationTime() {
    try {
      const fileExists = await browser.fileIO.exists(this.filePath);

      if (!fileExists) {
        return 0;
      }

      const info = await browser.fileIO.stat(this.filePath);
      return info.lastModified;
    } catch (error) {
      console.error(`[Filesystem] Failed to get modification time: ${error.message}`);
      return 0;
    }
  }

  getBackendType() {
    return this.name;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = FilesystemBackend;
}
