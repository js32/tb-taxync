/**
 * Error Handler & Logger
 * Centralized error handling and logging for the extension
 */

class ErrorHandler {
  constructor() {
    this.errorHistory = [];
    this.maxHistorySize = 100;
    this.logLevels = {
      DEBUG: 0,
      INFO: 1,
      WARN: 2,
      ERROR: 3
    };
    this.currentLogLevel = this.logLevels.INFO;
    this._persistTimer = null;
  }

  /**
   * Initialize error handler with config and restore persisted history.
   * The MV3 event page gets terminated regularly - without persistence the
   * log history would be lost on every restart.
   */
  async init() {
    const storage = await browser.storage.local.get(['extensionConfig', 'logHistory']);
    const config = storage.extensionConfig || {};
    this.currentLogLevel = this.logLevels[config.logLevel] ?? this.logLevels.INFO;

    if (Array.isArray(storage.logHistory)) {
      this.errorHistory = storage.logHistory;
    }

    console.log('[ErrorHandler] Initialized with log level:', Object.keys(this.logLevels).find(k => this.logLevels[k] === this.currentLogLevel));
  }

  /**
   * Persist history to storage (debounced to avoid a write per log line)
   * @private
   */
  _persist() {
    if (this._persistTimer !== null) return;
    this._persistTimer = setTimeout(() => {
      this._persistTimer = null;
      browser.storage.local.set({ logHistory: this.errorHistory }).catch(() => {});
    }, 1000);
  }

  /**
   * Format log message with prefix and timestamp
   */
  _formatMessage(level, prefix, message) {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level}] ${prefix}: ${message}`;
  }

  /**
   * Add error to history
   */
  _addToHistory(level, message, error) {
    this.errorHistory.push({
      timestamp: Date.now(),
      level,
      message,
      error: error ? error.toString() : null,
      stack: error?.stack || null
    });

    // Keep history bounded
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory.shift();
    }

    this._persist();
  }

  /**
   * Debug level logging
   */
  debug(prefix, message, error = null) {
    if (this.currentLogLevel <= this.logLevels.DEBUG) {
      const formatted = this._formatMessage('DEBUG', prefix, message);
      console.debug(formatted, error || '');
      this._addToHistory('DEBUG', message, error);
    }
  }

  /**
   * Info level logging
   */
  info(prefix, message) {
    if (this.currentLogLevel <= this.logLevels.INFO) {
      const formatted = this._formatMessage('INFO', prefix, message);
      console.log(formatted);
      this._addToHistory('INFO', message, null);
    }
  }

  /**
   * Warning level logging
   */
  warn(prefix, message, error = null) {
    if (this.currentLogLevel <= this.logLevels.WARN) {
      const formatted = this._formatMessage('WARN', prefix, message);
      console.warn(formatted, error || '');
      this._addToHistory('WARN', message, error);
    }
  }

  /**
   * Error level logging
   */
  error(prefix, message, error = null) {
    const formatted = this._formatMessage('ERROR', prefix, message);
    console.error(formatted, error || '');
    this._addToHistory('ERROR', message, error);
  }

  /**
   * Wrap async function with error handling
   */
  async wrapAsync(prefix, fn) {
    try {
      return await fn();
    } catch (error) {
      this.error(prefix, `Operation failed: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Handle sync-specific errors with context
   */
  handleSyncError(error, context = {}) {
    const errorMsg = error.message || error.toString();
    const contextStr = Object.entries(context)
      .map(([k, v]) => `${k}=${v}`)
      .join(', ');

    let userMessage = 'Sync failed';

    // Provide user-friendly error messages
    if (errorMsg.includes('Backend not initialized')) {
      userMessage = 'Backend not configured. Please check settings.';
    } else if (errorMsg.includes('ENOENT') || errorMsg.includes('not found')) {
      userMessage = 'File path not found. Check filesystem path in settings.';
    } else if (errorMsg.includes('EACCES') || errorMsg.includes('Permission')) {
      userMessage = 'Permission denied. Check file permissions.';
    } else if (errorMsg.includes('Dropbox')) {
      userMessage = 'Dropbox connection failed. Check authentication.';
    } else if (errorMsg.includes('timeout')) {
      userMessage = 'Sync timed out. Try again later.';
    }

    this.error('SyncError', `${userMessage} (${errorMsg}) - Context: ${contextStr}`, error);

    return {
      userMessage,
      technicalMessage: errorMsg,
      context
    };
  }

  /**
   * Get error history for debugging
   */
  getHistory(limit = 20) {
    return this.errorHistory.slice(-limit);
  }

  /**
   * Clear error history
   */
  clearHistory() {
    this.errorHistory = [];
    browser.storage.local.set({ logHistory: [] }).catch(() => {});
    this.info('ErrorHandler', 'History cleared');
  }

  /**
   * Export error history as JSON
   */
  exportHistory() {
    return JSON.stringify(this.errorHistory, null, 2);
  }
}

// Create global instance
const errorHandler = new ErrorHandler();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ErrorHandler;
}
