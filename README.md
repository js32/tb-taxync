# TB-TaXync

Eine Thunderbird WebExtension zum Synchronisieren von E-Mail-Tags/Beschriftungen zwischen mehreren Computern und Thunderbird-Installationen.

![Version](https://img.shields.io/badge/version-2.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Thunderbird](https://img.shields.io/badge/Thunderbird-128%2B-orange)

## 🎯 Was macht TB-TaXync?

TB-TaXync synchronisiert deine Thunderbird-Tags (Beschriftungen/Keywords) zwischen mehreren Computern. So haben alle deine E-Mail-Tags überall den gleichen Stand:

- 📤 **Exportiert** deine Tags in eine JSON-Datei
- 💾 **Speichert** die Datei an einem zentralen Ort (lokal, SMB, Cloud, etc.)
- 📥 **Importiert** die Tags auf anderen Computern automatisch

## ✨ Features

- ✅ **Manuelle & Automatische Synchronisierung**: Wähle zwischen manuell oder zeitgesteuert
- ✅ **Echtzeit-Sync**: Optional bei jeder Tag-Änderung synchronisieren
- ✅ **Flexible Sync-Tools**: Syncthing (⭐ empfohlen), Dropbox, SMB, NFS, SSH/SFTP
- ✅ **Deutsche Benutzeroberfläche**: Vollständig auf Deutsch
- ✅ **Debug-Logs**: Detaillierte Logs mit Fehlerbehandlung
- ✅ **Fallback-Support**: Nutzt Browser-Storage wenn Dateisystem nicht verfügbar
- ✅ **Moderne APIs**: Thunderbird 128+ Manifest v3
- ✅ **Konfliktauflösung**: "Neuere wins" Strategie

## 📋 Anforderungen

- **Thunderbird 128.0 ESR oder höher** (erforderlich für Manifest v3)
- Syncthing, Dropbox, SMB/NFS oder anderes Sync-Tool (optional aber empfohlen)

## 🚀 Schnellstart

### Installation

- Thunderbird 128+ erforderlich
- XPI-Datei laden: `thunderbird-sync-labels.xpi`
- `Tools` → `Add-ons and Themes` → Zahnrad-Icon ⚙️ → `Debug Add-ons`
- `Load Temporary Add-on` → `manifest.json` auswählen

### Konfiguration

1. Extension-Icon klicken → "Einstellungen öffnen"
2. Tab "📖 Übersicht" lesen
3. Tab "⚙️ Einstellungen":
   - Pfad zur Sync-Datei eingeben (z.B. `~/Sync/thunderbird-tags.json`)
   - Optional: Automatische Synchronisierung aktivieren
   - Optional: "Bei Änderungen synchronisieren" aktivieren
4. "Einstellungen speichern" klicken

### Erste Synchronisierung

- Klick "Sync testen" um Konfiguration zu prüfen
- Klick im Popup "Jetzt synchronisieren"
- Logs im Tab "📋 Logs" überprüfen

## 🔧 Sync-Tools (empfohlen nach Reihenfolge)

| Tool | Beschreibung | Setup |
|------|-------------|-------|
| **⭐ Syncthing** | Dezentral, privat, keine Server | einfach |
| Dropbox / Google Drive | Cloud-basiert | sehr einfach |
| SMB / NAS | Netzwerk-Freigaben | mittel |
| NFS | Linux Netzwerk-FS | mittel |
| SSH/SFTP | Server-Zugriff | komplex |

## 🏗️ Projektstruktur

```
tb-taxync/
├── manifest.json              # Manifest v3 Konfiguration
├── background.js              # Hintergrund-Service
├── popup.html/js              # Schnell-Sync UI
├── settings.html/js           # Konfiguration & Logs
├── backends/
│   ├── filesystem-backend.js  # Datei-Speicher
│   └── storage-backend.js     # Browser-Storage Fallback
├── sync/
│   ├── sync-engine.js         # Sync-Logik
│   ├── tag-manager.js         # Thunderbird-Integration
│   ├── error-handler.js       # Logging & Fehlerbehandlung
│   └── path-discovery.js      # Pfad-Erkennung
└── icons/                     # Extension-Icons
```

## 💻 Entwicklung

### Dateien ändern und testen

```bash
# 1. Datei bearbeiten (z.B. settings.html)
# 2. XPI bauen
zip -r thunderbird-sync-labels.xpi \
  manifest.json background.js popup.html popup.js \
  settings.html settings.js logs.html logs.js \
  backends/*.js sync/*.js icons/*.png

# 3. In Thunderbird neu laden
# Tools → Developer Tools → Browser Console
```

### Debug-Tipps

1. **Browser Console öffnen**: `Tools` → `Developer Tools` → `Browser Console` (Ctrl+Shift+J)
2. **Filter nach Logs**: Suche nach `[Filesystem]`, `[SyncEngine]`, `[TagManager]`
3. **Extension-Logs**: Tab "📋 Logs" in den Einstellungen öffnen

## 📚 Ressourcen

- [Thunderbird WebExtension API](https://webextension-api.thunderbird.net/)
- [Mozilla WebExtensions Docs](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions)
- [Syncthing](https://syncthing.net/)

## 🐛 Bekannte Limitationen

- Keine direkte Tag-Erstellung via WebExtension API (nur Import/Export)
- Konfliktauflösung: "Neuere wins" (kein 3-Way-Merge)
- Benötigt Experiment APIs in Thunderbird 128+

## 🤝 Beitragen

Contributions willkommen!

1. Fork & Clone
2. Feature-Branch: `git checkout -b feature/xyz`
3. Commit: `git commit -m "Add feature xyz"`
4. Push & Pull Request erstellen

## 📄 Lizenz

MIT License - siehe [LICENSE](LICENSE)

## 👤 Autor

Entwickelt mit Claude Code
