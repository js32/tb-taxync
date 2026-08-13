/**
 * Filesystem Backend Adapter
 * Works with local filesystem paths (for SMB, Syncthing, NFS mounts, etc.)
 * Uses the fileIO experiment API (IOUtils, Thunderbird 128+)
 */

// Rotating backups guard against a bad merge silently losing tags: without
// them, a single overwrite-in-place write destroys the only remaining copy
// of the previous state, and the loss may not be noticed until several
// syncs later.
const MAX_BACKUPS = 30;

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
      // Snapshot the version we're about to overwrite before touching it.
      // A failed backup must not block the actual sync write.
      await this._backupBeforeWrite();

      const content = JSON.stringify(tagsData, null, 2);

      // fileIO.writeUTF8 creates parent directories and writes atomically
      await browser.fileIO.writeUTF8(this.filePath, content);

      console.log(`[Filesystem] Wrote ${tagsData.tags?.length || 0} tags to ${this.filePath}`);
    } catch (error) {
      console.error(`[Filesystem] Failed to write tags: ${error.message}`);
      throw error;
    }
  }

  /**
   * Separator style ('/' or '\') matching the configured file path, so
   * backup paths stay consistent with whatever the user configured.
   * @private
   */
  _pathSep() {
    return this.filePath.includes('\\') ? '\\' : '/';
  }

  /** @private */
  _splitPath() {
    const lastSlash = Math.max(this.filePath.lastIndexOf('/'), this.filePath.lastIndexOf('\\'));
    return {
      dir: this.filePath.substring(0, lastSlash),
      base: this.filePath.substring(lastSlash + 1)
    };
  }

  /** @private */
  _backupDir() {
    const { dir } = this._splitPath();
    return `${dir}${this._pathSep()}.tb-taxync-backups`;
  }

  /**
   * Copy the current backend file into the rotating backup folder, then
   * prune old generations beyond MAX_BACKUPS. Filenames use a
   * colon-free ISO timestamp so lexical sort order equals chronological
   * order (needed for rotation).
   * @private
   */
  async _backupBeforeWrite() {
    try {
      const exists = await browser.fileIO.exists(this.filePath);
      if (!exists) return; // Nothing to back up on the very first write

      const content = await browser.fileIO.readUTF8(this.filePath);
      const { base } = this._splitPath();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = `${this._backupDir()}${this._pathSep()}${base}.${timestamp}.bak`;

      await browser.fileIO.writeUTF8(backupPath, content);
      await this._rotateBackups();
    } catch (error) {
      const message = `Backup before write failed (continuing without backup): ${error.message}`;
      if (typeof errorHandler !== 'undefined') {
        errorHandler.warn('Filesystem', message);
      } else {
        console.warn(`[Filesystem] ${message}`);
      }
    }
  }

  /**
   * Delete the oldest backups beyond MAX_BACKUPS.
   * @private
   */
  async _rotateBackups() {
    const backupDir = this._backupDir();
    const entries = await browser.fileIO.listDir(backupDir);
    const backups = entries
      .filter(path => path.endsWith('.bak'))
      .sort();

    const excess = backups.length - MAX_BACKUPS;
    for (let i = 0; i < excess; i++) {
      await browser.fileIO.remove(backups[i]);
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
