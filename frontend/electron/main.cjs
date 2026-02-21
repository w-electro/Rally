const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, shell, desktopCapturer, session, screen, globalShortcut, Notification } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');

// MUST be before app.whenReady() — allow WebRTC audio autoplay without user gesture
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
// Disable audio sandbox which can conflict with multiple WebRTC streams
app.commandLine.appendSwitch('disable-features', 'AudioServiceSandbox');

let mainWindow = null;
let tray = null;
let isQuitting = false;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// --- Window State Persistence ---
const windowStateFile = path.join(app.getPath('userData'), 'window-state.json');

function loadWindowState() {
  try {
    if (fs.existsSync(windowStateFile)) {
      const data = JSON.parse(fs.readFileSync(windowStateFile, 'utf-8'));
      // Validate that the saved position is on a connected display
      if (data.x !== undefined && data.y !== undefined) {
        const displays = screen.getAllDisplays();
        const isOnDisplay = displays.some((display) => {
          const { x, y, width, height } = display.bounds;
          return data.x >= x && data.x < x + width && data.y >= y && data.y < y + height;
        });
        if (!isOnDisplay) {
          // Position is off-screen, discard x/y so defaults are used
          delete data.x;
          delete data.y;
        }
      }
      return data;
    }
  } catch (err) {
    console.log('[WindowState] Failed to load:', err.message);
  }
  return null;
}

function saveWindowState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  try {
    const isMaximized = mainWindow.isMaximized();
    const bounds = isMaximized ? (mainWindow._lastBounds || mainWindow.getBounds()) : mainWindow.getBounds();
    const state = {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      isMaximized,
    };
    fs.writeFileSync(windowStateFile, JSON.stringify(state, null, 2));
  } catch (err) {
    console.log('[WindowState] Failed to save:', err.message);
  }
}

let saveStateTimeout = null;
function saveWindowStateDebounced() {
  if (saveStateTimeout) clearTimeout(saveStateTimeout);
  saveStateTimeout = setTimeout(saveWindowState, 500);
}

function createWindow() {
  const iconPath = isDev
    ? path.join(__dirname, '../public/icon.png')
    : path.join(process.resourcesPath, 'icon.png');

  const savedState = loadWindowState();

  const windowOptions = {
    width: (savedState && savedState.width) || 1400,
    height: (savedState && savedState.height) || 900,
    minWidth: 1000,
    minHeight: 700,
    title: 'Rally',
    icon: iconPath,
    frame: false, // Custom titlebar for esports aesthetic
    backgroundColor: '#000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
    show: false, // Show after ready-to-show for splash screen
  };

  // Restore position only if validated on-screen
  if (savedState && savedState.x !== undefined && savedState.y !== undefined) {
    windowOptions.x = savedState.x;
    windowOptions.y = savedState.y;
  }

  mainWindow = new BrowserWindow(windowOptions);

  // Restore maximized state
  if (savedState && savedState.isMaximized) {
    mainWindow.maximize();
  }

  // Track bounds before maximize so we can save the normal bounds
  mainWindow.on('resize', () => {
    if (!mainWindow.isMaximized()) {
      mainWindow._lastBounds = mainWindow.getBounds();
    }
    saveWindowStateDebounced();
  });
  mainWindow.on('move', () => {
    if (!mainWindow.isMaximized()) {
      mainWindow._lastBounds = mainWindow.getBounds();
    }
    saveWindowStateDebounced();
  });

  // Load the app
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Show window when ready (avoids white flash)
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Minimize to tray instead of closing — save window state first
  mainWindow.on('close', (e) => {
    saveWindowState();
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  // Create system tray
  createTray(iconPath);
}

function createTray(iconPath) {
  try {
    const trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
    tray = new Tray(trayIcon);

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Open Rally',
        click: () => {
          mainWindow.show();
          mainWindow.focus();
        },
      },
      {
        label: 'Set Status',
        submenu: [
          { label: 'Online', click: () => sendToRenderer('status:change', 'ONLINE') },
          { label: 'Idle', click: () => sendToRenderer('status:change', 'IDLE') },
          { label: 'Do Not Disturb', click: () => sendToRenderer('status:change', 'DND') },
          { label: 'Invisible', click: () => sendToRenderer('status:change', 'OFFLINE') },
        ],
      },
      { type: 'separator' },
      {
        label: 'Quit Rally',
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ]);

    tray.setToolTip('Rally');
    tray.setContextMenu(contextMenu);
    tray.on('click', () => {
      mainWindow.show();
      mainWindow.focus();
    });
  } catch (err) {
    console.log('Tray creation skipped:', err.message);
  }
}

function sendToRenderer(channel, data) {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send(channel, data);
  }
}

function setupAutoUpdater() {
  if (isDev) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    console.log('[AutoUpdater] Checking for update...');
  });

  autoUpdater.on('update-available', (info) => {
    console.log('[AutoUpdater] Update available:', info.version);
  });

  autoUpdater.on('update-not-available', (info) => {
    console.log('[AutoUpdater] Update not available. Current version is up-to-date.');
  });

  autoUpdater.on('download-progress', (progress) => {
    console.log('[AutoUpdater] Download progress:', Math.round(progress.percent) + '%');
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[AutoUpdater] Update downloaded:', info.version);
    sendToRenderer('update:downloaded', { version: info.version, releaseNotes: info.releaseNotes });
  });

  autoUpdater.on('error', (err) => {
    console.log('[AutoUpdater] Error:', err.message);
  });

  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      console.log('[AutoUpdater] Check failed:', err.message);
    });
  }, 5000);
}

// IPC handlers for custom titlebar
ipcMain.on('window:minimize', () => mainWindow?.minimize());
ipcMain.on('window:maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});
ipcMain.on('window:close', () => mainWindow?.close());
ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized() ?? false);

// Game detection placeholder
ipcMain.handle('gaming:detect', async () => {
  // In production, scan running processes for known games
  return { detectedGames: [] };
});

// Screen capture source picker
ipcMain.handle('screen:getSources', async () => {
  const sources = await desktopCapturer.getSources({
    types: ['screen', 'window'],
    thumbnailSize: { width: 320, height: 180 },
  });
  return sources.map((s) => ({
    id: s.id,
    name: s.name,
    thumbnail: s.thumbnail.toDataURL(),
    appIcon: s.appIcon ? s.appIcon.toDataURL() : null,
  }));
});

// Auto-update install trigger
ipcMain.on('update:install', () => autoUpdater.quitAndInstall(false, true));

// Manual check for updates (from Settings UI)
ipcMain.on('update:check', () => {
  if (isDev) {
    sendToRenderer('update:result', { status: 'dev-mode', message: 'Auto-updater is disabled in development mode.' });
    return;
  }
  sendToRenderer('update:result', { status: 'checking' });
  autoUpdater.checkForUpdates()
    .then((result) => {
      if (result && result.updateInfo && result.updateInfo.version !== app.getVersion()) {
        sendToRenderer('update:result', { status: 'available', version: result.updateInfo.version });
      } else {
        sendToRenderer('update:result', { status: 'up-to-date', version: app.getVersion() });
      }
    })
    .catch((err) => {
      sendToRenderer('update:result', { status: 'error', message: err.message });
    });
});

// Desktop notifications — only show when window is not focused
ipcMain.on('notify', (event, { title, body }) => {
  if (mainWindow && mainWindow.isFocused()) return;
  const iconPath = isDev
    ? path.join(__dirname, '../public/icon.png')
    : path.join(process.resourcesPath, 'icon.png');
  const notification = new Notification({ title, body, icon: iconPath });
  notification.on('click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
  notification.show();
});

// App lifecycle
app.whenReady().then(() => {
  // Auto-grant microphone/camera/screen-capture permissions for WebRTC
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    const allowed = ['media', 'mediaKeySystem', 'audioCapture', 'display-capture'];
    callback(allowed.includes(permission));
  });
  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
    const allowed = ['media', 'mediaKeySystem', 'audioCapture', 'display-capture'];
    return allowed.includes(permission);
  });

  createWindow();
  setupAutoUpdater();

  // Global mute shortcut (Ctrl+Shift+M)
  globalShortcut.register('Ctrl+Shift+M', () => {
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('voice:toggle-mute');
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// Security: prevent new window creation
app.on('web-contents-created', (_, contents) => {
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
});
