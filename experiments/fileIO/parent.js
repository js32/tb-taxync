/**
 * Experiment API to provide file I/O access to WebExtensions
 * Thunderbird 128+ (IOUtils only, no legacy nsIFile fallbacks)
 */

console.log('[fileIO] Parent script initializing...');

let IOUtils = null;

// Load IOUtils: try ESM import first, then the privileged global (TB 128+)
async function ensureIOUtils() {
  if (IOUtils) return;

  try {
    const ioModule = globalThis.ChromeUtils?.importESModule?.("resource://gre/modules/IOUtils.sys.mjs");
    if (ioModule?.IOUtils) {
      IOUtils = ioModule.IOUtils;
      console.log('[fileIO] IOUtils loaded via ESM');
      return;
    }
  } catch (error) {
    console.warn('[fileIO] ESM load failed:', error.message);
  }

  if (globalThis.IOUtils) {
    IOUtils = globalThis.IOUtils;
    console.log('[fileIO] IOUtils available globally');
    return;
  }

  throw new Error('IOUtils not available (Thunderbird 128+ required)');
}

/**
 * Reject relative paths and paths containing ".." segments before they
 * reach the privileged file APIs.
 */
function assertValidPath(path) {
  if (typeof path !== 'string' || path.length === 0) {
    throw new Error('Invalid path (empty or not a string)');
  }

  const isAbsolute =
    path.startsWith('/') ||            // Unix
    /^[A-Za-z]:[\\/]/.test(path) ||    // Windows drive letter
    path.startsWith('\\\\');           // UNC share

  if (!isAbsolute) {
    throw new Error(`Path must be absolute: ${path}`);
  }

  if (path.split(/[\\/]+/).includes('..')) {
    throw new Error(`Path must not contain ".." segments: ${path}`);
  }
}

function parentDir(path) {
  const lastSlash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  return lastSlash > 0 ? path.substring(0, lastSlash) : null;
}

// Initialize and get ExtensionCommon
let ExtensionCommon = null;
try {
  const imported = globalThis.ChromeUtils?.importESModule?.("resource://gre/modules/ExtensionCommon.sys.mjs");
  if (imported?.ExtensionCommon) {
    ExtensionCommon = imported.ExtensionCommon;
    console.log('[fileIO] ExtensionCommon loaded');
  }
} catch (error) {
  console.error('[fileIO] Failed to load ExtensionCommon:', error.message);
}

if (!ExtensionCommon) {
  console.error('[fileIO] ExtensionCommon not available - API will not work');
}

var fileIO = class extends (ExtensionCommon?.ExtensionAPI || class {}) {
  getAPI(context) {
    return {
      fileIO: {
        /**
         * Check if file or directory exists
         */
        async exists(path) {
          try {
            assertValidPath(path);
            await ensureIOUtils();
            return await IOUtils.exists(path);
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
            assertValidPath(path);
            await ensureIOUtils();
            return await IOUtils.readUTF8(path);
          } catch (error) {
            console.error('[fileIO] readUTF8 error:', error.message);
            throw error;
          }
        },

        /**
         * Write UTF-8 content to file.
         * Creates missing parent directories and writes atomically
         * (temp file + rename) so readers never see a half-written file.
         */
        async writeUTF8(path, content) {
          try {
            assertValidPath(path);
            await ensureIOUtils();

            const parent = parentDir(path);
            if (parent && !(await IOUtils.exists(parent))) {
              await IOUtils.makeDirectory(parent, { createAncestors: true, ignoreExisting: true });
            }

            await IOUtils.writeUTF8(path, content, { tmpPath: `${path}.tmp` });
          } catch (error) {
            console.error('[fileIO] writeUTF8 error:', error.message);
            throw error;
          }
        },

        /**
         * Get file stats
         */
        async stat(path) {
          try {
            assertValidPath(path);
            await ensureIOUtils();

            const info = await IOUtils.stat(path);
            return {
              type: info.type,
              size: info.size,
              lastModified: info.lastModified
            };
          } catch (error) {
            console.error('[fileIO] stat error:', error.message);
            throw error;
          }
        },

        /**
         * List the full paths of a directory's direct children.
         * Returns an empty array if the directory does not exist.
         */
        async listDir(path) {
          try {
            assertValidPath(path);
            await ensureIOUtils();

            const exists = await IOUtils.exists(path);
            if (!exists) return [];

            return await IOUtils.getChildren(path);
          } catch (error) {
            console.error('[fileIO] listDir error:', error.message);
            return [];
          }
        },

        /**
         * Delete a file. Missing files are treated as already-deleted.
         */
        async remove(path) {
          try {
            assertValidPath(path);
            await ensureIOUtils();

            await IOUtils.remove(path, { ignoreAbsent: true });
          } catch (error) {
            console.error('[fileIO] remove error:', error.message);
            throw error;
          }
        }
      }
    };
  }
};

console.log('[fileIO] Parent script ready');
