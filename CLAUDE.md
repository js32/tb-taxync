# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Version & Compatibility

- **Current Version:** 2.2.0
- **Manifest Version:** 3 (modern Thunderbird 128+)
- **Min Thunderbird:** 128.0 ESR
- **APIs Used:** IOUtils, PathUtils, messages.tags.delete() (Thunderbird 115+ APIs)
- **Backend Support:** Filesystem only (SMB, NFS, Syncthing)

## Development Workflow

### Loading Extension in Thunderbird
1. Open Thunderbird 128+ (required for Manifest v3)
2. `Tools` → `Add-ons and Themes` (or `Ctrl+Shift+A`)
3. Click gear icon ⚙️ → `Debug Add-ons`
4. `Load Temporary Add-on` → select `manifest.json`

### Debugging
- **Background script logs**: `Tools` → `Developer Tools` → `Browser Console` (`Ctrl+Shift+J`)
- **Popup inspection**: Right-click extension icon → `Inspect`

### Building XPI Package
```bash
zip -r TB-TaXync.xpi \
  manifest.json background.js popup.html popup.js \
  settings.html settings.js \
  backends/*.js sync/*.js icons/*.png experiments/**/*
```

### Icon Generation
Icons are generated from SVG using ImageMagick:
```bash
cd icons && convert icon.svg -resize 16x16 icon-16.png && convert icon.svg -resize 32x32 icon-32.png && convert icon.svg -resize 48x48 icon-48.png && convert icon.svg -resize 96x96 icon-96.png
```

## Architecture

### Extension Structure
- **manifest.json**: Defines permissions (`messagesRead`, `accountsRead`, `storage`), browser action, and entry points
- **background.js**: Persistent script that runs independently of UI, handles extension lifecycle events and mail monitoring
- **popup.html/popup.js**: Browser action popup for user interaction, communicates with background via storage API

### Thunderbird WebExtension APIs
This extension uses Thunderbird-specific APIs accessed via `browser.*`:
- `browser.messages.*`: Access and monitor email messages
- `browser.accounts.*`: Query mail accounts
- `browser.storage.local.*`: Persist extension data (not synced across devices)
- `browser.runtime.*`: Extension lifecycle management

### Communication Pattern
Background script and popup communicate asynchronously through `browser.storage.local`:
- Popup reads/writes settings
- Background script can listen to storage changes if needed
- No direct messaging between contexts currently implemented

## Code Style

- Use 2-space indentation
- Async/await syntax preferred over promise chains
- JSDoc comments for public functions
- Console logging for debugging (visible in Browser Console)

## Sync Architecture

### Component Structure
- **Backend Adapters** (`backends/`): Abstract interface + implementations for different sync targets
  - `backend-adapter.js`: Base class with testConnection(), readTags(), writeTags(), getModificationTime()
  - `filesystem-backend.js`: Modern implementation using IOUtils API (Thunderbird 128+)
    - Replaces deprecated nsIFile/Components.classes APIs
    - Direct file I/O via IOUtils.readUTF8(), IOUtils.writeUTF8()
    - Path validation via PathUtils.parent() and IOUtils.exists()

- **Path Discovery** (`sync/path-discovery.js`): Auto-detects common sync locations
  - Platform-aware (Linux, macOS, Windows)
  - Scans for Syncthing default directories
  - Checks common SMB/NFS mount points
  - Returns accessible paths only

- **Sync Engine** (`sync/sync-engine.js`): Orchestrates the sync process
  - **Three-Way Merge Algorithm**: Compares local, remote, and last synced state
  - Detects additions, modifications, and deletions on both sides
  - Conflict resolution: "modification wins over deletion" (conservative)
  - Stores snapshot of synced state for deletion tracking
  - Returns result: { status, imported, exported, deleted, conflictsResolved, errors }

- **Tag Manager** (`sync/tag-manager.js`): Interface to Thunderbird's tag system
  - getLocalTags(): Reads from browser.messages.tags.list() with timestamp preservation
  - importTags(): Creates/updates tags via browser.messages.tags API
  - deleteTag(): Deletes tags via browser.messages.tags.delete()
  - exportTags(): Converts local tags to JSON format
  - Preserves modification timestamps in browser.storage.local

- **Background Script** (`background.js`): Lifecycle & message routing
  - Loads backend config on startup
  - Handles messages from popup: performSync, getStatus, updateBackendConfig
  - Manages sync scheduling (periodic sync trigger)

- **UI** (`popup.html/js`, `settings.html/js`):
  - popup.js: Quick access to sync button, status display
  - settings.js: Backend configuration, sync interval setup

### Tag Data Format
JSON structure synced between backends:
```json
{
  "tags": [
    {
      "id": "important",
      "name": "Wichtig",
      "color": "#ff0000",
      "modified": 1706441234
    }
  ],
  "version": "1.0",
  "syncedAt": 1706441290
}
```

### Storage Schema
- `syncEnabled`: boolean - auto-sync toggle
- `lastSync`: timestamp - last successful sync
- `lastSyncResult`: object - result of last sync (status, imported, exported, deleted, errors)
- `syncInterval`: milliseconds - periodic sync interval (default: 3600000 = 1hr)
- `backendConfig`: { type: 'filesystem|dropbox|...', filePath?: string }
- `tagDefinitions`: Map of tag definitions synced from remote
- `lastSyncedTags`: { tags: [...], timestamp: number } - snapshot for three-way merge
- `tagModificationTimes`: { tagId: { name, color, modified } } - tag signatures for change detection (v2.2.0+; legacy bare-timestamp values are migrated on read)
- `logHistory`: [...] - persisted error handler history (survives MV3 event page restarts)

### Sync Algorithm Details

**Three-Way Merge Strategy** (v2.1.2+):
Compares three states to detect all changes:
- **Base**: Last synced snapshot (stored in `lastSyncedTags`)
- **Local**: Current Thunderbird tags
- **Remote**: Current backend file

**Decision Matrix**:
| Local | Remote | Base | Action |
|-------|--------|------|--------|
| ✓ | ✓ | ✓ | Both changed? Newer wins |
| ✓ | ✗ | ✓ | Remote deleted → Local modified? Keep : Delete |
| ✗ | ✓ | ✓ | Local deleted → Remote modified? Import : Remove |
| ✓ | ✓ | ✗ | Both added → Same? Keep : Newer wins |
| ✓ | ✗ | ✗ | New local → Export |
| ✗ | ✓ | ✗ | New remote → Import |
| ✗ | ✗ | ✓ | Both deleted → OK |

**Conflict Resolution**:
- **Modify-Delete conflicts**: Modification wins (conservative approach)
- **Modify-Modify conflicts**: Newer timestamp wins
- **Add-Add conflicts**: Newer timestamp wins if different, keep if identical

### Key Limitations & Workarounds
1. **Filesystem Backend**: Uses IOUtils API (Thunderbird 128+). Requires full path to tags.json.
2. **Concurrent Sync**: Multiple devices syncing simultaneously may cause race conditions (last-write-wins).
3. **Timestamp Accuracy**: Thunderbird API doesn't provide tag modification times, so we track them separately.

## Migration & Upgrades

### Upgrading to v2.1.2+ (Three-Way Merge)
When users upgrade from earlier versions:
1. `onInstalled` listener detects missing `lastSyncedTags` and `tagModificationTimes`
2. Storage is initialized with `lastSyncedTags: null` and `tagModificationTimes: {}`
3. First sync after upgrade:
   - Treats as "initial sync" (base state is empty)
   - All local tags treated as "new local additions" → exported
   - All remote tags treated as "new remote additions" → imported
   - No deletions occur (safe migration)
4. Subsequent syncs use full three-way merge with deletion tracking

**No data loss**: Migration is safe and automatic.

## Testing & Debugging

### Testing Sync Locally
1. Set backend to filesystem with `/tmp/test-tags.json`
2. Create initial tags.json manually or via sync
3. Trigger sync via popup button
4. Check Browser Console for [SyncEngine], [TagManager], [Filesystem] logs

### Testing Deletion Sync (v2.1.2+)
**Test Case 1: Local Deletion**
1. Create tag "TestDelete" in Thunderbird
2. Sync → verify tag appears in backend JSON
3. Delete "TestDelete" in Thunderbird
4. Sync → verify tag removed from backend JSON
5. Check popup: should show "1 deleted"

**Test Case 2: Remote Deletion**
1. Create tag "TestRemote" in Thunderbird
2. Sync → verify tag in backend JSON
3. Manually delete tag from backend JSON file
4. Sync → verify tag removed from Thunderbird
5. Check popup: should show "1 deleted"

**Test Case 3: Delete-Modify Conflict**
1. Create tag "TestConflict" with color #FF0000
2. Sync
3. Manually change color in JSON to #00FF00
4. Delete tag in Thunderbird
5. Sync → tag should be restored with #00FF00 (modification wins)
6. Check logs for conflict resolution message

### Viewing Logs
1. Open Settings → "📋 Logs" tab
2. Filter by log level (DEBUG, INFO, WARN, ERROR)
3. View detailed error information with stack traces
4. Download logs as JSON for debugging
5. Clear logs when needed

### Error Handler Features
- Centralized logging with levels (DEBUG/INFO/WARN/ERROR)
- Error history with timestamps
- Stack trace capture for debugging
- User-friendly error messages
- Export capability for debugging

## Thunderbird Version Compatibility

Minimum version: 128.0 (manifest.json `strict_min_version`)
- Use [Thunderbird WebExtension API docs](https://webextension-api.thunderbird.net/) for feature availability
- File I/O uses IOUtils via the fileIO experiment API (no nsIFile legacy code)
