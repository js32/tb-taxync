# Changelog

Alle nennenswerten Änderungen an diesem Projekt werden in dieser Datei dokumentiert.

Das Format basiert auf [Keep a Changelog](https://keepachangelog.com/) und dieses Projekt folgt [Semantic Versioning](https://semver.org/).

## [2.2.0] - 2026-07-03

### 🐛 Kritische Bugfixes

- **Remote-Änderungen wurden nie importiert**: `importTags()` hat existierende Tags übersprungen statt sie zu aktualisieren. Umbenennungen/Farbänderungen von anderen Geräten kamen nie an und wurden beim nächsten Sync sogar zurückgesetzt.
- **Kaputte Remote-Datei löschte lokale Tags**: Eine unlesbare/korrupte Sync-Datei wurde als "leer" behandelt, wodurch der Three-Way-Merge alle Tags als remote gelöscht interpretierte. Der Sync bricht jetzt sicher ab.
- **Fehlgeschlagener Sync zeigte weiter "Success"**: Fehler werden jetzt in `lastSyncResult` persistiert und im Popup angezeigt.
- **Snapshot-Korrektur bei Teilfehlern**: Fehlgeschlagene Importe/Löschungen werden im Snapshot berücksichtigt, damit sie beim nächsten Sync wiederholt werden.

### 🔒 Sicherheit

- **Schema-Validierung der Remote-Datei**: Struktur, Tag-IDs, Namen, Farben (#rrggbb) und Timestamps werden vor dem Merge geprüft.
- **Pfad-Validierung in der fileIO-API**: Nur absolute Pfade ohne `..`-Segmente werden akzeptiert.
- **Atomare Schreibvorgänge**: Writes gehen über Temp-Datei + Rename, andere Geräte sehen nie halbe Dateien.
- **Legacy-Code entfernt**: nsIFile/Components.classes-Fallbacks aus der Experiment-API entfernt (TB 128+ braucht sie nicht).

### 🔧 Verbesserungen

- **Echte Änderungserkennung**: Tag-Modifikationszeiten werden jetzt bei tatsächlichen Namens-/Farbänderungen aktualisiert (Signatur-Tracking), Konfliktauflösung "newer wins" funktioniert damit korrekt.
- **Hardcodierte Pfade entfernt**: Kein `/home/jens`-Default mehr; Pfad muss in den Einstellungen gesetzt werden.
- **Logs überleben Neustarts**: Log-Historie wird in `storage.local` persistiert (MV3-Event-Page-Neustarts).
- **Doppel-Initialisierung behoben**: Speichern der Einstellungen löst den Reload nur noch einmal aus (über `storage.onChanged`).
- **Intervall 0 = deaktiviert** funktioniert jetzt wie dokumentiert.

### 🎨 UI/UX

- **Dark Mode** für Popup und Einstellungen.
- **Popup zeigt "Not configured"** mit Hinweis, solange kein Pfad gesetzt ist (Sync-Button deaktiviert).
- **Tote UI-Elemente entfernt**: Checkboxen "Synchronize on changes" / "Show manual sync button" und der funktionslose "Browse..."-Button.
- **Info-Toast** für laufende Vorgänge statt verfrühtem Erfolgs-Grün.
- **Systemlocale** für alle Datumsanzeigen statt hardcodiertem en-US/de-DE.
- **Aufgeräumt**: Ungenutzte `logs.html`/`logs.js` entfernt (Logs sind in den Einstellungen integriert).

## [2.0.0] - 2026-01-30

### ✨ Neu

- **Komplette Neuentwicklung der UI** mit deutscher Benutzeroberfläche
- **Willkommens-Tab (📖 Übersicht)** mit Erklärungen und Setup-Anleitung
- **Integrierte Logs** direkt in Einstellungen (Tab "📋 Logs") statt separates Fenster
- **Konfigurierbare Sync-Intervalle** - Benutzer können Minuten frei einstellen
- **StorageBackend als Fallback** - Extension funktioniert auch wenn Dateisystem nicht verfügbar
- **Syncthing-Empfehlungen** - Prominente Markierung von Syncthing als empfohlem Tool
- **Tab-Navigation** - Einfache Navigation zwischen Übersicht, Einstellungen und Logs
- **Erweiterte .gitignore** - Bessere Verwaltung von Abhängigkeiten und Dateien
- **MIT Lizenz** - Klare Lizenzierung des Projekts
- **Umfassende README.md** - Deutsche Dokumentation mit Quick Start und Entwickler-Tipps

### 🔧 Verbesserungen

- **Synchronisierungs-Logik** - Automatische Synchronisierung nutzt korrektes `syncEnabled` Flag
- **Fehlerbehandlung** - Bessere Fallback-Mechanismen wenn APIs nicht verfügbar
- **Beispiel-Pfade** - Generische Beispiele statt hardcodierte Pfade mit Benutzernamen
- **Label-Texte** - "Automatische Synchronisierung" zeigt nicht mehr hardcodierte 5 Minuten

### 🐛 Bugfixes

- **Sync-Scheduler startet nicht** - Fix: `autoSync` → `syncEnabled` Namenskonflikt
- **Logs waren leer** - Integriert direkt in Settings statt separates Fenster
- **Hardcoded Pfade** - Generische Beispiele für portablere Nutzung
- **Sync-Service Auswahl** - Entfernt (war nicht implementiert)

### ⚠️ Breaking Changes

- `settings.js` speichert jetzt `syncEnabled` statt `autoSync`
- Alte Einstellungen müssen ggf. neu gespeichert werden

## [1.0.0] - Initial Release

- Basis-Funktionalität für Tag-Synchronisierung
- FilesystemBackend für Datei-basierte Synchronisierung
- StorageBackend für Browser-Storage Fallback
- Popup UI für schnellen Sync-Zugriff
- Basic Settings Seite
- Experiment API Integration für Dateisystem-Zugriff
