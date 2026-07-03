/**
 * Tag Manager
 * Handles reading and writing tags from Thunderbird's tag system
 * Uses browser.messages.tags API (Thunderbird built-in)
 *
 * Modification tracking: Thunderbird's API provides no modification times,
 * so we store a signature (name, color, modified) per tag in
 * browser.storage.local under `tagModificationTimes`. When a tag's name or
 * color differs from the stored signature, the modification time is bumped.
 */

class TagManager {
  constructor() {
    this.tagService = null;
  }

  /**
   * Initialize tag manager
   * @returns {Promise<void>}
   */
  async init() {
    console.log('[TagManager] Initialized with messages.tags API');
  }

  /**
   * Load the stored tag signatures, migrating legacy bare-timestamp entries
   * (pre-v2.2.0 stored just a number per tag) to the signature format.
   * @private
   */
  async _getStoredSignatures() {
    const storage = await browser.storage.local.get('tagModificationTimes');
    return storage.tagModificationTimes || {};
  }

  async _saveStoredSignatures(signatures) {
    await browser.storage.local.set({ tagModificationTimes: signatures });
  }

  /**
   * Get all tags currently defined in Thunderbird
   * @returns {Promise<Array>} Array of tag objects {id, name, color, modified}
   * @throws {Error} If the tags API fails - callers must NOT treat this as
   *                 "no tags", that would be interpreted as mass deletion.
   */
  async getLocalTags() {
    const tags = await browser.messages.tags.list();

    if (!Array.isArray(tags)) {
      throw new Error(`Tags API did not return an array: ${typeof tags}`);
    }

    const signatures = await this._getStoredSignatures();
    let dirty = false;
    const now = Date.now();

    const tagList = tags.map(tag => {
      const tagId = tag.key || tag.id;
      const name = tag.tag || tag.name;
      const color = (tag.color || '#000000').toLowerCase();

      let entry = signatures[tagId];

      // Legacy format (bare timestamp): adopt current name/color without bumping
      if (typeof entry === 'number') {
        entry = { name, color, modified: entry };
        signatures[tagId] = entry;
        dirty = true;
      }

      if (!entry) {
        // New tag - first time we see it
        entry = { name, color, modified: now };
        signatures[tagId] = entry;
        dirty = true;
      } else if (entry.name !== name || entry.color !== color) {
        // Tag was modified in Thunderbird since we last saw it
        entry.name = name;
        entry.color = color;
        entry.modified = now;
        dirty = true;
      }

      return { id: tagId, name, color, modified: entry.modified };
    });

    if (dirty) {
      await this._saveStoredSignatures(signatures);
    }

    console.log(`[TagManager] Retrieved ${tagList.length} local tags`);
    return tagList;
  }

  /**
   * Create or update a tag in Thunderbird
   * @param {string} tagId - Tag identifier/key
   * @param {string} name - Display name
   * @param {string} color - Hex color code
   * @returns {Promise<void>}
   */
  async createOrUpdateTag(tagId, name, color) {
    try {
      const existingTags = await browser.messages.tags.list();
      const existingTag = existingTags.find(t => (t.key || t.id) === tagId);

      if (existingTag) {
        console.log(`[TagManager] Updating tag: ${tagId} -> ${name} (${color})`);
        await browser.messages.tags.update(tagId, {
          tag: name,
          color: color
        });
      } else {
        console.log(`[TagManager] Creating tag: ${tagId} -> ${name} (${color})`);
        await browser.messages.tags.create(tagId, name, color);
      }
    } catch (error) {
      console.error(`[TagManager] Failed to create/update tag ${tagId}:`, error.message);
      throw error;
    }
  }

  /**
   * Delete a tag from Thunderbird
   * @param {string} tagId - Tag identifier/key to delete
   * @returns {Promise<void>}
   */
  async deleteTag(tagId) {
    try {
      console.log(`[TagManager] Deleting tag: ${tagId}`);
      await browser.messages.tags.delete(tagId);

      // Clean up stored signature
      const signatures = await this._getStoredSignatures();
      delete signatures[tagId];
      await this._saveStoredSignatures(signatures);
    } catch (error) {
      console.error(`[TagManager] Failed to delete tag ${tagId}:`, error.message);
      throw error;
    }
  }

  /**
   * Export current tags to standard format
   * @returns {Promise<Object>} { tags: [...] }
   */
  async exportTags() {
    const localTags = await this.getLocalTags();
    const result = {
      tags: localTags,
      exportedAt: Date.now(),
      version: '1.0'
    };

    console.log(`[TagManager] Exported ${localTags.length} tags`);
    return result;
  }

  /**
   * Import tags from standard format.
   * Existing tags are UPDATED (name/color), not skipped - the sync engine
   * only sends tags that actually need to be applied locally.
   *
   * @param {Object} tagsData - { tags: [...] }
   * @returns {Promise<Object>} { imported: number, skipped: number, errors: [] }
   */
  async importTags(tagsData) {
    const result = {
      imported: 0,
      skipped: 0,
      errors: []
    };

    if (!tagsData.tags || !Array.isArray(tagsData.tags)) {
      console.warn('[TagManager] Invalid tags data format');
      return result;
    }

    const localTags = await this.getLocalTags();
    const localTagsById = new Map(localTags.map(t => [t.id, t]));

    const signatures = await this._getStoredSignatures();
    let signaturesDirty = false;

    for (const tag of tagsData.tags) {
      try {
        const color = (tag.color || '#000000').toLowerCase();
        const existing = localTagsById.get(tag.id);

        // Skip only if the local tag is already identical
        if (existing && existing.name === tag.name && existing.color === color) {
          result.skipped++;
          continue;
        }

        await this.createOrUpdateTag(tag.id, tag.name, tag.color || '#000000');

        // Store the remote signature so the next getLocalTags() does not
        // misinterpret the import as a fresh local modification
        signatures[tag.id] = {
          name: tag.name,
          color: color,
          modified: tag.modified || Date.now()
        };
        signaturesDirty = true;

        result.imported++;
      } catch (error) {
        result.errors.push({
          tagId: tag.id,
          error: error.message
        });
      }
    }

    if (signaturesDirty) {
      await this._saveStoredSignatures(signatures);
    }

    console.log(`[TagManager] Import complete: ${result.imported} imported, ${result.skipped} skipped, ${result.errors.length} errors`);
    return result;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = TagManager;
}
