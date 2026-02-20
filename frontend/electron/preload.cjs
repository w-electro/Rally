const { contextBridge, ipcRenderer } = require('electron');

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
  installUpdate: () => ipcRenderer.send('update:install'),

  // Platform info
  platform: process.platform,
});
