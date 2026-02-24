const { contextBridge, ipcRenderer } = require('electron');

// Read version safely — if require fails inside asar, the whole exposeInMainWorld would crash
let appVersion = 'unknown';
try {
  appVersion = require('../package.json').version;
} catch (_) {
  // Fallback handled via getVersion IPC below
}

contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls (custom titlebar)
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),

  // Status changes from tray
  onStatusChange: (callback) => {
    ipcRenderer.on('status:change', (_, status) => callback(status));
  },

  // Gaming integration
  detectGames: () => ipcRenderer.invoke('gaming:detect'),

  // Screen sharing
  getScreenSources: () => ipcRenderer.invoke('screen:getSources'),

  // Auto-updates
  onUpdateDownloaded: (callback) => {
    ipcRenderer.on('update:downloaded', (_, info) => callback(info));
  },
  onUpdateResult: (callback) => {
    ipcRenderer.on('update:result', (_, result) => callback(result));
  },
  installUpdate: () => ipcRenderer.send('update:install'),
  checkForUpdates: () => ipcRenderer.send('update:check'),

  // Global mute shortcut
  onToggleMute: (callback) => {
    ipcRenderer.on('voice:toggle-mute', () => callback());
  },

  // Desktop notifications
  notify: (options) => ipcRenderer.send('notify', options),

  // Platform info
  platform: process.platform,
  appVersion,
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
});
