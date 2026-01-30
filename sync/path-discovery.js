/**
 * Path Discovery Module
 * Auto-discovers common Syncthing and SMB mount paths
 */

class PathDiscovery {
  constructor() {
    this.commonPaths = [];
  }

  /**
   * Get all common sync paths for the current platform
   */
  getCommonPaths() {
    const platform = this._detectPlatform();
    const username = this._getUsername();

    switch (platform) {
      case 'linux':
        return this._getLinuxPaths(username);
      case 'macos':
        return this._getMacOSPaths(username);
      case 'windows':
        return this._getWindowsPaths(username);
      default:
        return [];
    }
  }

  /**
   * Discover accessible paths from common locations
   */
  async discoverPaths() {
    const commonPaths = this.getCommonPaths();
    const accessible = [];

    for (const path of commonPaths) {
      try {
        const exists = await this._testPath(path);
        if (exists) {
          accessible.push({
            path: path,
            type: this._inferType(path),
            label: this._generateLabel(path)
          });
        }
      } catch (error) {
        // Path not accessible, skip
        continue;
      }
    }

    return accessible;
  }

  /**
   * Test if a path exists and is accessible
   */
  async _testPath(path) {
    try {
      // Only run if fileIO API is available (in WebExtension context)
      if (typeof browser === 'undefined' || typeof browser.fileIO === 'undefined') {
        return false;
      }

      // Check if directory exists
      const exists = await browser.fileIO.exists(path);
      if (!exists) {
        return false;
      }

      // Check if we have read permission
      const info = await browser.fileIO.stat(path);
      return info.type === 'directory';
    } catch (error) {
      console.error(`[PathDiscovery] Error testing path ${path}: ${error.message}`);
      return false;
    }
  }

  /**
   * Get common Linux paths for Syncthing and SMB
   */
  _getLinuxPaths(username) {
    return [
      // Syncthing default locations
      `/home/${username}/Sync`,
      `/home/${username}/Syncthing`,
      `/home/${username}/.config/syncthing`,
      `/home/${username}/.local/share/Syncthing`,

      // SMB/CIFS mounts
      '/mnt/smb',
      '/mnt/cifs',
      '/mnt/share',
      '/mnt/network',
      `/mnt/${username}`,

      // NFS mounts
      '/mnt/nfs',
      '/mnt/nas',

      // Common server names
      '/mnt/server',
      '/mnt/fileserver',

      // User-specific mounts
      `/media/${username}`,
      `/run/user/1000/gvfs`, // GNOME VFS
    ];
  }

  /**
   * Get common macOS paths
   */
  _getMacOSPaths(username) {
    return [
      // Syncthing
      `/Users/${username}/Sync`,
      `/Users/${username}/Syncthing`,
      `/Users/${username}/Library/Application Support/Syncthing`,

      // SMB mounts
      '/Volumes/Share',
      '/Volumes/Network',
      '/Volumes/SMB',
      `/Volumes/${username}`,

      // iCloud (might be used for sync)
      `/Users/${username}/Library/Mobile Documents`,
    ];
  }

  /**
   * Get common Windows paths
   */
  _getWindowsPaths(username) {
    return [
      // Syncthing
      `C:\\Users\\${username}\\Sync`,
      `C:\\Users\\${username}\\Syncthing`,
      `C:\\Users\\${username}\\AppData\\Local\\Syncthing`,

      // SMB network drives (common drive letters)
      'Z:\\',
      'Y:\\',
      'X:\\',
      'S:\\', // S for Share
      'N:\\', // N for Network

      // UNC paths
      '\\\\server\\share',
      '\\\\nas\\share',
      `\\\\server\\${username}`,
    ];
  }

  /**
   * Detect current platform
   */
  _detectPlatform() {
    // Use navigator.platform or userAgent to detect
    const platform = navigator.platform.toLowerCase();

    if (platform.includes('linux')) {
      return 'linux';
    } else if (platform.includes('mac')) {
      return 'macos';
    } else if (platform.includes('win')) {
      return 'windows';
    }

    // Fallback: try to detect from paths
    if (typeof PathUtils !== 'undefined') {
      try {
        // On Unix-like systems, this will work
        const home = PathUtils.profileDir;
        if (home.startsWith('/home/') || home.startsWith('/Users/')) {
          return home.startsWith('/home/') ? 'linux' : 'macos';
        } else if (home.includes(':\\')) {
          return 'windows';
        }
      } catch (error) {
        // Ignore
      }
    }

    return 'linux'; // Default fallback
  }

  /**
   * Get current username from environment
   */
  _getUsername() {
    // Try to extract username from profile path
    try {
      if (typeof PathUtils !== 'undefined') {
        const profile = PathUtils.profileDir;

        // Linux: /home/username/...
        let match = profile.match(/\/home\/([^\/]+)/);
        if (match) return match[1];

        // macOS: /Users/username/...
        match = profile.match(/\/Users\/([^\/]+)/);
        if (match) return match[1];

        // Windows: C:\Users\username\...
        match = profile.match(/Users\\([^\\]+)/);
        if (match) return match[1];
      }
    } catch (error) {
      // Ignore
    }

    return 'user'; // Default fallback
  }

  /**
   * Infer path type (syncthing, smb, nfs, etc.)
   */
  _inferType(path) {
    const lowerPath = path.toLowerCase();

    if (lowerPath.includes('syncthing') || lowerPath.includes('sync')) {
      return 'syncthing';
    } else if (lowerPath.includes('smb') || lowerPath.includes('cifs')) {
      return 'smb';
    } else if (lowerPath.includes('nfs')) {
      return 'nfs';
    } else if (lowerPath.includes('mnt') || lowerPath.includes('volumes')) {
      return 'network';
    }

    return 'unknown';
  }

  /**
   * Generate human-readable label for path
   */
  _generateLabel(path) {
    const type = this._inferType(path);
    const basename = path.split(/[\/\\]/).pop() || path;

    const typeLabels = {
      'syncthing': 'Syncthing',
      'smb': 'SMB Share',
      'nfs': 'NFS Mount',
      'network': 'Network Drive'
    };

    const typeLabel = typeLabels[type] || 'Directory';
    return `${typeLabel}: ${path}`;
  }

  /**
   * Suggest a tags.json path for a given directory
   */
  suggestTagsPath(directory) {
    // Ensure directory ends without separator
    const cleanDir = directory.replace(/[\/\\]$/, '');
    return `${cleanDir}/thunderbird-tags.json`;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PathDiscovery;
}
