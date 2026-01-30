/* eslint-disable object-shorthand */

/**
 * Experiment API to provide file I/O access to WebExtensions
 * Fallback-based approach for Thunderbird 128+
 * Tries multiple methods to access file I/O
 */

console.log('[fileIO] Parent script initializing...');

// Try to get the APIs we need
let IOUtils = null;
let PathUtils = null;
let isESM = false;

// First, try to load via ESM (Thunderbird 128+)
async function loadIOUtilsESM() {
  try {
    const ioModule = globalThis.ChromeUtils?.importESModule?.("resource://gre/modules/IOUtils.sys.mjs");
    if (ioModule?.IOUtils) {
      IOUtils = ioModule.IOUtils;
      isESM = true;
      console.log('[fileIO] IOUtils loaded via ESM');
      return true;
    }
  } catch (error) {
    console.warn('[fileIO] ESM load failed:', error.message);
  }
  return false;
}

// Try legacy loading method
async function loadIOUtilsLegacy() {
  try {
    // In Thunderbird, we can sometimes access these directly
    if (globalThis.IOUtils) {
      IOUtils = globalThis.IOUtils;
      console.log('[fileIO] IOUtils available globally');
      return true;
    }
  } catch (error) {
    console.warn('[fileIO] Legacy load failed:', error.message);
  }
  return false;
}

// Fallback: Use Services to write files
async function writeViaServices(path, content) {
  try {
    const Services = globalThis.Services ||
      (globalThis.ChromeUtils?.importESModule?.("resource://gre/modules/Services.sys.mjs")?.Services);

    if (!Services) {
      throw new Error('Services not available');
    }

    // Create file object using nsIFile
    const file = Components.classes["@mozilla.org/file/local;1"]
      .createInstance(Components.interfaces.nsIFile);
    file.initWithPath(path);

    // Create parent directories if needed
    const parent = file.parent;
    if (!parent.exists()) {
      parent.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, 0o755);
    }

    // Write file using nsIFileOutputStream
    const foStream = Components.classes["@mozilla.org/network/file-output-stream;1"]
      .createInstance(Components.interfaces.nsIFileOutputStream);
    foStream.init(file, 0x02 | 0x08 | 0x20, 0o644, 0); // write, create, truncate

    // Write content
    const converter = Components.classes["@mozilla.org/intl/converter-output-stream;1"]
      .createInstance(Components.interfaces.nsIConverterOutputStream);
    converter.init(foStream, "UTF-8", 0, 0);
    converter.writeString(content);
    converter.close();
    foStream.close();

    console.log('[fileIO] Wrote via Services:', path);
    return true;
  } catch (error) {
    console.error('[fileIO] Services write failed:', error.message);
    return false;
  }
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
            // Try IOUtils first
            if (!IOUtils) {
              await loadIOUtilsESM();
              if (!IOUtils) await loadIOUtilsLegacy();
            }

            if (IOUtils?.exists) {
              const result = await IOUtils.exists(path);
              console.log('[fileIO] exists:', path, '=', result);
              return result;
            }

            // Fallback: try nsIFile
            const file = Components.classes["@mozilla.org/file/local;1"]
              .createInstance(Components.interfaces.nsIFile);
            file.initWithPath(path);
            return file.exists();
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
              await loadIOUtilsESM();
              if (!IOUtils) await loadIOUtilsLegacy();
            }

            if (IOUtils?.readUTF8) {
              const result = await IOUtils.readUTF8(path);
              console.log('[fileIO] readUTF8 success, length:', result.length);
              return result;
            }

            throw new Error('IOUtils.readUTF8 not available');
          } catch (error) {
            console.error('[fileIO] readUTF8 error:', error.message);
            throw error;
          }
        },

        /**
         * Write UTF-8 content to file
         */
        async writeUTF8(path, content) {
          try {
            console.log('[fileIO] writeUTF8 called for:', path);

            if (!IOUtils) {
              const loaded = await loadIOUtilsESM();
              if (!loaded) await loadIOUtilsLegacy();
            }

            // Try IOUtils first
            if (IOUtils?.writeUTF8) {
              console.log('[fileIO] Using IOUtils.writeUTF8');
              // IOUtils.writeUTF8 options: don't use backupFile=false, it needs a path or should be omitted
              await IOUtils.writeUTF8(path, content);
              console.log('[fileIO] writeUTF8 success via IOUtils');
              return;
            }

            // Fallback to Services
            console.log('[fileIO] Falling back to Services.writeUTF8');
            const success = await writeViaServices(path, content);
            if (!success) {
              throw new Error('All write methods failed');
            }
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
            if (!IOUtils) {
              await loadIOUtilsESM();
              if (!IOUtils) await loadIOUtilsLegacy();
            }

            if (IOUtils?.stat) {
              const info = await IOUtils.stat(path);
              return {
                type: info.type,
                size: info.size,
                lastModified: info.lastModified
              };
            }

            throw new Error('IOUtils.stat not available');
          } catch (error) {
            console.error('[fileIO] stat error:', error.message);
            throw error;
          }
        }
      }
    };
  }
};

console.log('[fileIO] Parent script ready');
