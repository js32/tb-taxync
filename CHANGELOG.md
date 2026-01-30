# Changelog

Alle nennenswerten Änderungen an diesem Projekt werden in dieser Datei dokumentiert.

Das Format basiert auf [Keep a Changelog](https://keepachangelog.com/) und dieses Projekt folgt [Semantic Versioning](https://semver.org/).

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
