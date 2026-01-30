// TB Labels Sync - Settings Script

document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();

  // Save button handler
  document.getElementById('saveBtn').addEventListener('click', saveSettings);

  // Test sync button handler
  document.getElementById('testSyncBtn').addEventListener('click', testSync);

  // Detect Syncthing folders button handler
  document.getElementById('detectSyncthingBtn').addEventListener('click', detectSyncthingFolders);

  // Browse button handler (placeholder)
  document.getElementById('browseBtn').addEventListener('click', () => {
    showMessage('Hinweis: Die Dateiauswahl ist derzeit nur manuell über Texteingabe möglich.', 'error');
  });
});

async function loadSettings() {
  const defaults = {
    syncFilePath: '/home/jens/Sync/thunderbird-tags.json',
    autoSync: true,
    syncOnChange: false,
    manualSync: true,
    syncService: 'syncthing'
  };

  const settings = await browser.storage.local.get(defaults);

  document.getElementById('syncFilePath').value = settings.syncFilePath || '';
  document.getElementById('autoSync').checked = settings.autoSync;
  document.getElementById('syncOnChange').checked = settings.syncOnChange;
  document.getElementById('manualSync').checked = settings.manualSync;

  const serviceRadio = document.getElementById(`syncService${capitalize(settings.syncService)}`);
  if (serviceRadio) {
    serviceRadio.checked = true;
  }
}

async function saveSettings() {
  const settings = {
    syncFilePath: document.getElementById('syncFilePath').value.trim(),
    autoSync: document.getElementById('autoSync').checked,
    syncOnChange: document.getElementById('syncOnChange').checked,
    manualSync: document.getElementById('manualSync').checked,
    syncService: document.querySelector('input[name="syncService"]:checked').value
  };

  try {
    await browser.storage.local.set(settings);
    showMessage('Einstellungen erfolgreich gespeichert!', 'success');

    // Notify background script to reload settings
    await browser.runtime.sendMessage({ action: 'reloadSettings' });
  } catch (error) {
    showMessage(`Fehler beim Speichern: ${error.message}`, 'error');
  }
}

async function testSync() {
  showMessage('Teste Synchronisierung...', 'success');

  try {
    const response = await browser.runtime.sendMessage({ action: 'performSync' });

    if (response.success) {
      showMessage('Sync-Test erfolgreich!', 'success');
    } else {
      showMessage(`Sync-Test fehlgeschlagen: ${response.error}`, 'error');
    }
  } catch (error) {
    showMessage(`Fehler beim Sync-Test: ${error.message}`, 'error');
  }
}

async function detectSyncthingFolders() {
  const detectedPaths = document.getElementById('detectedPaths');
  const pathList = document.getElementById('pathList');

  pathList.innerHTML = '<div style="text-align: center; padding: 10px;">Suche nach Syncthing-Ordnern...</div>';
  detectedPaths.style.display = 'block';

  try {
    // Try to use native messaging to detect actual folders
    const response = await browser.runtime.sendMessage({
      action: 'detectSyncthing'
    });

    pathList.innerHTML = '';

    if (response.success && response.folders && response.folders.length > 0) {
      response.folders.forEach(folder => {
        const pathDiv = document.createElement('div');
        pathDiv.className = 'path-option';
        pathDiv.innerHTML = `<strong>${folder.path}</strong><br><small>${folder.suggestedFile}</small>`;
        pathDiv.addEventListener('click', () => {
          document.getElementById('syncFilePath').value = folder.suggestedFile;
          detectedPaths.style.display = 'none';
        });
        pathList.appendChild(pathDiv);
      });
      showMessage(`${response.folders.length} Syncthing-Ordner gefunden!`, 'success');
    } else {
      // Fallback to suggestions
      const possiblePaths = [
        '~/Syncthing',
        '~/Sync',
        '~/.config/syncthing',
        '/home/jens/Syncthing',
        '/home/jens/Sync'
      ];

      possiblePaths.forEach(path => {
        const pathDiv = document.createElement('div');
        pathDiv.className = 'path-option';
        pathDiv.textContent = `${path}/thunderbird-tags.json`;
        pathDiv.addEventListener('click', () => {
          document.getElementById('syncFilePath').value = `${path}/thunderbird-tags.json`;
          detectedPaths.style.display = 'none';
        });
        pathList.appendChild(pathDiv);
      });

      showMessage('Keine Syncthing-Ordner gefunden. Hier sind Vorschläge:', 'success');
    }
  } catch (error) {
    console.error('Error detecting Syncthing folders:', error);
    showMessage('Fehler bei der Ordner-Erkennung. Bitte gib den Pfad manuell ein.', 'error');
  }
}

function showMessage(message, type) {
  const statusMessage = document.getElementById('statusMessage');
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${type}`;
  statusMessage.style.display = 'block';

  setTimeout(() => {
    statusMessage.style.display = 'none';
  }, 5000);
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
