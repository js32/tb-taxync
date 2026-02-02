# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Version & Compatibility

- **Manifest Version:** 3 (modern Thunderbird 128+)
- **Min Thunderbird:** 128.0 ESR
- **APIs Used:** IOUtils, PathUtils (Thunderbird 115+ APIs)
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
  settings.html settings.js logs.html logs.js \
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
  - Pulls remote tags via backend
  - Merges with local tags (conflict resolution: "newer wins" by timestamp)
  - Exports merged set back to backend
  - Returns result: { status, imported, exported, conflictsResolved, errors }

- **Tag Manager** (`sync/tag-manager.js`): Interface to Thunderbird's tag system
  - getLocalTags(): Reads from browser.messages.listTags()
  - importTags(): Queues tag definitions in storage (Thunderbird WebExt API limitation)
  - exportTags(): Converts local tags to JSON format

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
- `syncInterval`: milliseconds - periodic sync interval (default: 3600000 = 1hr)
- `backendConfig`: { type: 'filesystem|dropbox|...', filePath?: string }
- `tagDefinitions`: Map of tag definitions synced from remote

### Key Limitations & Workarounds
1. **Thunderbird WebExtension API**: No direct tag creation API. Solution: Store definitions in storage and provide import instructions to user.
2. **Filesystem Backend**: Uses nsIFile for file I/O (deprecated but still works). Requires full path to tags.json.
3. **Conflict Resolution**: "Newer wins" by modified timestamp. No three-way merge.

## Testing & Debugging

### Testing Sync Locally
1. Set backend to filesystem with `/tmp/test-tags.json`
2. Create initial tags.json manually or via sync
3. Trigger sync via popup button
4. Check Browser Console for [SyncEngine], [TagManager], [Filesystem] logs

### Viewing Logs
1. Click "📋 Logs" button in popup
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

Minimum version: 78.0 (manifest.json line 11)
- Use [Thunderbird WebExtension API docs](https://webextension-api.thunderbird.net/) for feature availability
- nsIFile APIs (used in filesystem backend) available since TB 78+
