/* eslint-disable object-shorthand */
/* global ExtensionCommon, Services, ChromeUtils, Ci */

/**
 * Experiment API to provide file I/O access to WebExtensions
 * Uses IOUtils and PathUtils which are not available in regular WebExtension context
 * For Thunderbird 140+
 */

// Import ExtensionCommon from the new ESM location
var ExtensionCommon;
try {
  const imported = ChromeUtils.importESModule("resource://gre/modules/ExtensionCommon.sys.mjs");
  ExtensionCommon = imported.ExtensionCommon;
  console.log('[fileIO] ExtensionCommon loaded via ESM');
} catch (error) {
  console.error('[fileIO] Failed to load ExtensionCommon via ESM:', error.message);
  throw error;
}

// Import Services - use ESM if available, fallback to legacy
var Services;
try {
  const servicesModule = ChromeUtils.importESModule("resource://gre/modules/Services.sys.mjs");
  Services = servicesModule.Services;
  console.log('[fileIO] Services loaded via ESM');
} catch (error) {
  console.warn('[fileIO] Services ESM not available, trying legacy import');
  try {
    const legacy = ChromeUtils.importESModule("resource://gre/modules/Services.jsm");
    Services = legacy.Services;
    console.log('[fileIO] Services loaded via legacy ESM');
  } catch (legacyError) {
    console.error('[fileIO] Failed to load Services:', legacyError.message);
    Services = null;
  }
}

console.log('[fileIO] ExtensionCommon and Services loaded');

// Ci is available globally in chrome contexts
var Ci = (typeof Ci !== 'undefined') ? Ci : Components?.interfaces;

// Import IOUtils and PathUtils - these are ESM modules
let IOUtils, PathUtils;

try {
  const ioModule = ChromeUtils.importESModule("resource://gre/modules/IOUtils.sys.mjs");
  IOUtils = ioModule.IOUtils;
  console.log('[fileIO] IOUtils loaded successfully');
} catch (error) {
  console.error('[fileIO] Failed to load IOUtils:', error.message);
}

try {
  const pathModule = ChromeUtils.importESModule("resource://gre/modules/PathUtils.sys.mjs");
  PathUtils = pathModule.PathUtils;
  console.log('[fileIO] PathUtils loaded successfully');
} catch (error) {
  console.error('[fileIO] Failed to load PathUtils:', error.message);
}

var fileIO = class extends ExtensionCommon.ExtensionAPI {
  getAPI(context) {
    return {
      fileIO: {
        /**
         * Check if file or directory exists
         */
        async exists(path) {
          try {
            if (!IOUtils) {
              console.error('[fileIO] IOUtils not available');
              return false;
            }
            console.log('[fileIO] exists checking:', path);
            const result = await IOUtils.exists(path);
            console.log('[fileIO] exists result:', result);
            return result;
          } catch (error) {
            console.error('[fileIO] exists error:', error.message);
            return false;
          }
        },

        /**
         * Read file as UTF-8
         */
        async readUTF8(path) {
          try {
            if (!IOUtils) {
              throw new Error('IOUtils not available');
            }
            console.log('[fileIO] readUTF8:', path);
            const result = await IOUtils.readUTF8(path);
            console.log('[fileIO] readUTF8 success, length:', result.length);
            return result;
          } catch (error) {
            console.error('[fileIO] readUTF8 error:', error.message);
            throw new Error(`Failed to read file: ${error.message}`);
          }
        },

        /**
         * Write UTF-8 content to file
         */
        async writeUTF8(path, content) {
          try {
            if (!IOUtils) {
              throw new Error('IOUtils not available');
            }
            console.log('[fileIO] writeUTF8:', path);
            await IOUtils.writeUTF8(path, content, {
              tmpPath: `${path}.tmp`
            });
            console.log('[fileIO] writeUTF8 success');
          } catch (error) {
            console.error('[fileIO] writeUTF8 error:', error.message);
            throw new Error(`Failed to write file: ${error.message}`);
          }
        },

        /**
         * Get file stats
         */
        async stat(path) {
          try {
            if (!IOUtils) {
              throw new Error('IOUtils not available');
            }
            console.log('[fileIO] stat:', path);
            const info = await IOUtils.stat(path);
            console.log('[fileIO] stat success, type:', info.type);
            return {
              type: info.type,
              size: info.size,
              lastModified: info.lastModified
            };
          } catch (error) {
            console.error('[fileIO] stat error:', error.message);
            throw new Error(`Failed to stat file: ${error.message}`);
          }
        },

        /**
         * Get parent directory
         */
        getParent(path) {
          try {
            if (!PathUtils) {
              console.error('[fileIO] PathUtils not available');
              return null;
            }
            console.log('[fileIO] getParent:', path);
            const parent = PathUtils.parent(path);
            console.log('[fileIO] getParent result:', parent);
            return parent;
          } catch (error) {
            console.error('[fileIO] getParent error:', error.message);
            return null;
          }
        },

        /**
         * Join path components
         */
        join(base, component) {
          try {
            if (!PathUtils) {
              console.error('[fileIO] PathUtils not available');
              return null;
            }
            console.log('[fileIO] join:', base, component);
            const result = PathUtils.join(base, component);
            console.log('[fileIO] join result:', result);
            return result;
          } catch (error) {
            console.error('[fileIO] join error:', error.message);
            return null;
          }
        },

        /**
         * Get profile directory
         */
        getProfileDir() {
          try {
            if (!PathUtils) {
              console.error('[fileIO] PathUtils not available');
              return null;
            }
            const profileDir = PathUtils.profileDir;
            console.log('[fileIO] Profile directory:', profileDir);
            return profileDir;
          } catch (error) {
            console.error('[fileIO] getProfileDir error:', error.message);

            // Fallback: try to get from Services
            try {
              const dirSvc = Services.dirsvc;
              const profilePath = dirSvc.get("ProfD", Ci.nsIFile).path;
              console.log('[fileIO] Fallback profile directory:', profilePath);
              return profilePath;
            } catch (fallbackError) {
              console.error('[fileIO] Fallback getProfileDir also failed:', fallbackError.message);
              return null;
            }
          }
        }
      }
    };
  }
};
