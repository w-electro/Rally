const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, shell, desktopCapturer } = require('electron');
const path = require('path');

let mainWindow = null;
let tray = null;
let isQuitting = false;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createWindow() {
  const iconPath = isDev
    ? path.join(__dirname, '../public/icon.png')
    : path.join(process.resourcesPath, 'icon.png');

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
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

  // Minimize to tray instead of closing
  mainWindow.on('close', (e) => {
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

// App lifecycle
app.whenReady().then(createWindow);

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

// Security: prevent new window creation
app.on('web-contents-created', (_, contents) => {
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
});
