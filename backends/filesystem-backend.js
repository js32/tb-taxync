/**
 * Filesystem Backend Adapter
 * Works with local filesystem paths (for SMB, Syncthing, NFS mounts, etc.)
 * Uses modern Thunderbird 128+ IOUtils API instead of deprecated nsIFile
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

      // Check if fileIO experiment API is available
      if (typeof browser === 'undefined' || typeof browser.fileIO === 'undefined') {
        console.error('[Filesystem] fileIO experiment API not available');
        return false;
      }

      console.log(`[Filesystem] fileIO API available, testing path`);

      // Check if file path is valid (not empty)
      if (!this.filePath || typeof this.filePath !== 'string') {
        console.error('[Filesystem] Invalid file path');
        return false;
      }

      // Extract parent directory from path
      const lastSlash = Math.max(
        this.filePath.lastIndexOf('/'),
        this.filePath.lastIndexOf('\\')
      );

      if (lastSlash === -1) {
        console.error(`[Filesystem] Invalid file path (no directory separator): ${this.filePath}`);
        return false;
      }

      const parentPath = this.filePath.substring(0, lastSlash);
      console.log(`[Filesystem] Parent path: ${parentPath}`);

      if (!parentPath || parentPath.length === 0) {
        console.error(`[Filesystem] Invalid parent path`);
        return false;
      }

      const parentExists = await browser.fileIO.exists(parentPath);
      console.log(`[Filesystem] Parent directory exists: ${parentExists}`);

      if (!parentExists) {
        // Try to create parent directory
        console.log(`[Filesystem] Parent directory does not exist, will create on first sync: ${parentPath}`);
      }

      // If file doesn't exist, that's okay - we'll create it on first sync
      const fileExists = await browser.fileIO.exists(this.filePath);
      if (fileExists) {
        console.log(`[Filesystem] Tags file exists: ${this.filePath}`);

        // Try to read to ensure we have permissions
        try {
          await browser.fileIO.readUTF8(this.filePath);
          console.log(`[Filesystem] Successfully read file (permissions OK)`);
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
      // Check if file exists
      const fileExists = await browser.fileIO.exists(this.filePath);

      if (!fileExists) {
        console.log(`[Filesystem] Tags file does not exist, returning empty tags`);
        return { tags: [] };
      }

      // Read file content as UTF-8
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
      // Convert to JSON string
      const content = JSON.stringify(tagsData, null, 2);

      // Write to file (creates if doesn't exist)
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

      // Get file info
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
