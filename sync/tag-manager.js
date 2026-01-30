/**
 * Tag Manager
 * Handles reading and writing tags from Thunderbird's tag system
 * Uses browser.messages.tags API (Thunderbird built-in)
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
    try {
      console.log('[TagManager] Initialized with messages.tags API');
    } catch (error) {
      console.error('[TagManager] Failed to initialize:', error.message);
      throw error;
    }
  }

  /**
   * Get all tags currently defined in Thunderbird
   * @returns {Promise<Array>} Array of tag objects {id, name, color, modified}
   */
  async getLocalTags() {
    try {
      console.log('[TagManager] Getting local tags via messages.tags.list()...');

      // Use the official messages.tags.list() API
      const tags = await browser.messages.tags.list();
      console.log('[TagManager] Raw tags from API:', JSON.stringify(tags, null, 2));

      if (!Array.isArray(tags)) {
        console.warn('[TagManager] Tags API did not return an array:', typeof tags);
        return [];
      }

      const tagList = tags.map(tag => {
        const mappedTag = {
          id: tag.key || tag.id,
          name: tag.tag || tag.name,
          color: tag.color || '#000000',
          modified: Date.now() // We don't have real modification time, use current time
        };
        console.log('[TagManager] Mapped tag:', mappedTag);
        return mappedTag;
      });

      console.log(`[TagManager] Successfully retrieved ${tagList.length} local tags`);
      return tagList;
    } catch (error) {
      console.error('[TagManager] Failed to get local tags:', error.message, error.stack);
      return [];
    }
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
      // Check if tag already exists
      const existingTags = await browser.messages.tags.list();
      const existingTag = existingTags.find(t => t.key === tagId);

      if (existingTag) {
        // Update existing tag
        console.log(`[TagManager] Updating tag: ${tagId} -> ${name} (${color})`);
        await browser.messages.tags.update(tagId, {
          tag: name,
          color: color
        });
      } else {
        // Create new tag
        console.log(`[TagManager] Creating tag: ${tagId} -> ${name} (${color})`);
        await browser.messages.tags.create(tagId, name, color);
      }
    } catch (error) {
      console.error(`[TagManager] Failed to create/update tag ${tagId}:`, error.message);
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
   * Import tags from standard format
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
    const localTagIds = new Set(localTags.map(t => t.id));

    for (const tag of tagsData.tags) {
      try {
        // Check if tag already exists locally
        if (localTagIds.has(tag.id)) {
          result.skipped++;
          console.log(`[TagManager] Tag already exists locally: ${tag.id}`);
          continue;
        }

        // Create/update the tag
        await this.createOrUpdateTag(tag.id, tag.name, tag.color);
        result.imported++;
      } catch (error) {
        result.errors.push({
          tagId: tag.id,
          error: error.message
        });
      }
    }

    console.log(`[TagManager] Import complete: ${result.imported} imported, ${result.skipped} skipped, ${result.errors.length} errors`);
    return result;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = TagManager;
}
