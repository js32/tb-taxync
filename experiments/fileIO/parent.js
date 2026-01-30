/* eslint-disable object-shorthand */
/* global ExtensionCommon */

/**
 * Experiment API to provide file I/O access to WebExtensions
 * Uses IOUtils which is available in Thunderbird 120+
 * For Thunderbird 128+
 */

console.log('[fileIO] Parent script loading...');

// Get the global scope (chrome context)
const { ExtensionCommon } = globalThis.ChromeUtils.importESModule("resource://gre/modules/ExtensionCommon.sys.mjs");

// Lazy-load IOUtils and PathUtils in the API methods
let IOUtils = null;
let PathUtils = null;

async function loadIOUtils() {
  if (!IOUtils) {
    try {
      const ioModule = globalThis.ChromeUtils.importESModule("resource://gre/modules/IOUtils.sys.mjs");
      IOUtils = ioModule.IOUtils;
      console.log('[fileIO] IOUtils loaded');
    } catch (error) {
      console.error('[fileIO] Failed to load IOUtils:', error.message);
      throw new Error('IOUtils not available');
    }
  }
  return IOUtils;
}

async function loadPathUtils() {
  if (!PathUtils) {
    try {
      const pathModule = globalThis.ChromeUtils.importESModule("resource://gre/modules/PathUtils.sys.mjs");
      PathUtils = pathModule.PathUtils;
      console.log('[fileIO] PathUtils loaded');
    } catch (error) {
      console.error('[fileIO] Failed to load PathUtils:', error.message);
      throw new Error('PathUtils not available');
    }
  }
  return PathUtils;
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
            const io = await loadIOUtils();
            console.log('[fileIO] exists:', path);
            const result = await io.exists(path);
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
            const io = await loadIOUtils();
            console.log('[fileIO] readUTF8:', path);
            const result = await io.readUTF8(path);
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
            const io = await loadIOUtils();
            console.log('[fileIO] writeUTF8:', path);
            await io.writeUTF8(path, content, {
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
            const io = await loadIOUtils();
            console.log('[fileIO] stat:', path);
            const info = await io.stat(path);
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
            const pu = globalThis.ChromeUtils.importESModule("resource://gre/modules/PathUtils.sys.mjs").PathUtils;
            console.log('[fileIO] getParent:', path);
            const parent = pu.parent(path);
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
            const pu = globalThis.ChromeUtils.importESModule("resource://gre/modules/PathUtils.sys.mjs").PathUtils;
            console.log('[fileIO] join:', base, component);
            const result = pu.join(base, component);
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
            const pu = globalThis.ChromeUtils.importESModule("resource://gre/modules/PathUtils.sys.mjs").PathUtils;
            const profileDir = pu.profileDir;
            console.log('[fileIO] Profile directory:', profileDir);
            return profileDir;
          } catch (error) {
            console.error('[fileIO] getProfileDir error:', error.message);
            return null;
          }
        }
      }
    };
  }
};

console.log('[fileIO] Parent script loaded');
