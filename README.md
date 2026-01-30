# Thunderbird Sync Labels Extension

A modern Thunderbird extension for synchronizing tag/keyword definitions across multiple Thunderbird installations via Syncthing or SMB/NFS shares.

## Features

- ✅ **Zero Configuration**: Install → Done. No setup required!
- ✅ **Auto-Discovery**: Automatically finds Syncthing/SMB on first run
- ✅ **Smart Fallback**: Uses home directory if no sync folder found
- ✅ **One-Click Sync**: Just click "Sync Now" button
- ✅ **Auto-Sync**: Enabled by default (1 hour interval)
- ✅ **Full Tag Management**: Creates, updates, and syncs tags automatically
- ✅ **Modern APIs**: Uses Thunderbird 128+ IOUtils + messages.tags API
- ✅ **Manifest v3**: Future-proof
- ✅ **Conflict Resolution**: "Newer wins" strategy
- ✅ **Bidirectional**: Changes on any machine sync to all others

## Requirements

- **Thunderbird 128.0 ESR or higher** (required for Manifest v3)
- Syncthing or SMB/NFS mount (for file sharing)

## Project Structure

```
thunderbird-sync-labels/
├── manifest.json              # Manifest v3 configuration
├── background.js              # Background service
├── popup.html/js              # Quick access UI
├── settings.html/js           # Configuration UI
├── logs.html/js              # Debug console
├── backends/
│   ├── backend-adapter.js     # Abstract backend
│   └── filesystem-backend.js  # IOUtils-based filesystem backend
├── sync/
│   ├── path-discovery.js      # Auto-detect sync paths
│   ├── tag-manager.js         # Thunderbird tag interface
│   ├── sync-engine.js         # Sync orchestration
│   └── error-handler.js       # Logging & errors
└── icons/                     # Extension icons
```

## Quick Start

### Prerequisites

- Thunderbird 128.0 ESR or higher
- Syncthing installed OR SMB/NFS share mounted

### Installation & Usage

**That's it. Literally.**

1. Download `thunderbird-sync-labels.xpi`
2. Drag & drop into Thunderbird
3. Click "Install"
4. **Done!**

Extension auto-configures on install:
- Finds Syncthing folder if available
- Falls back to `~/.thunderbird-tags.json` if not
- Enables auto-sync (1 hour)

### Using It

**To sync manually:**
- Click extension icon
- Click "🔄 Sync Now"

**That's all you need!**

### Advanced (Optional)

If you want to customize:
- Click extension icon
- Expand "⚙️ Advanced"
- Click "Settings" to change sync path
- Click "Logs" to debug

### For Multiple Machines

**On each machine:**
1. Install extension (same steps)
2. If using Syncthing: Ensure folder is synced between machines
3. Extension finds the same sync file automatically
4. Tags sync between all machines

**Example with Syncthing:**
- Machine A: Installs → finds `/home/user/Syncthing/thunderbird-tags.json`
- Machine B: Installs → finds `/home/user/Syncthing/thunderbird-tags.json`
- Same file → Tags synced! ✅

## Features

- **Background Script**: Monitors mail events and handles extension lifecycle
- **Popup Interface**: Provides UI for controlling sync settings
- **Storage**: Persists sync settings and status
- **Permissions**: Configured for message and account access

## Development

### Key Files

- **manifest.json**: Extension metadata and permissions
- **background.js**: Background processes and event listeners
- **popup.html/popup.js**: User interface and interaction logic

### Available Permissions

- `messagesRead`: Read email messages
- `accountsRead`: Access email accounts
- `storage`: Store extension data locally

### Next Steps

1. Implement label synchronization logic in `background.js`
2. Add proper error handling
3. Create settings page for advanced configuration
4. Add icons to the `icons/` directory
5. Implement actual sync mechanism between accounts

## Debugging

- Check the Browser Console for background script logs: `Tools` → `Developer Tools` → `Browser Console` (Ctrl+Shift+J)
- Inspect the popup: Right-click on the extension icon and select `Inspect`

## Resources

- [Thunderbird WebExtension APIs](https://webextension-api.thunderbird.net/)
- [Mozilla WebExtensions Documentation](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions)

## License

[Add your license here]

## Author

[Your Name]
