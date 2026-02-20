# Rally Production Installer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build Rally as a distributable one-click Windows installer (.exe) with auto-updates, so users can install and run Rally without any manual setup.

**Architecture:** Electron loads the production frontend from `dist/index.html`. The frontend connects to a remote API server via `VITE_API_URL` (configurable at build time). `electron-updater` checks GitHub Releases on launch, downloads silently, and prompts to restart. NSIS one-click installer handles installation to `%LOCALAPPDATA%/Rally`.

**Tech Stack:** Electron 33, electron-builder 25, electron-updater, NSIS, Vite env vars

---

### Task 1: Generate Windows ICO Icon

**Files:**
- Create: `frontend/public/icon.ico`

**Step 1: Generate ICO from PNG**

The existing `frontend/public/icon.png` needs to be converted to `.ico` format with multiple sizes embedded (16, 32, 48, 64, 128, 256). Use the `sharp` npm package (already in backend deps) or an online converter.

Run from `frontend/`:
```bash
npx png-to-ico ../public/icon.png > ../public/icon.ico
```

If `png-to-ico` isn't available, install it:
```bash
npx png-to-ico@1.0.0 public/icon.png > public/icon.ico
```

Alternative: Use `electron-icon-builder`:
```bash
npx electron-icon-builder --input=public/icon.png --output=public/
```

This creates `public/icons/win/icon.ico`.

**Step 2: Verify the ICO exists**

```bash
ls -la public/icon.ico
```

**Step 3: Commit**

```bash
git add public/icon.ico
git commit -m "chore: add Windows ICO icon for installer"
```

---

### Task 2: Update electron-builder Config for NSIS Installer

**Files:**
- Modify: `frontend/package.json` (build section, lines 46-63)

**Step 1: Install electron-updater**

```bash
cd frontend
npm install electron-updater
```

**Step 2: Update the build config in `frontend/package.json`**

Replace the entire `"build"` section with:

```json
{
  "build": {
    "appId": "com.rally.desktop",
    "productName": "Rally",
    "directories": {
      "output": "release"
    },
    "files": [
      "dist/**/*",
      "electron/**/*"
    ],
    "extraResources": [
      {
        "from": "public/icon.png",
        "to": "icon.png"
      }
    ],
    "win": {
      "target": ["nsis"],
      "icon": "public/icon.ico",
      "signAndEditExecutable": false,
      "signDlls": false
    },
    "nsis": {
      "oneClick": true,
      "perMachine": false,
      "allowToChangeInstallationDirectory": false,
      "deleteAppDataOnUninstall": false,
      "shortcutName": "Rally",
      "runAfterFinish": true
    },
    "protocols": {
      "name": "Rally",
      "schemes": ["rally"]
    },
    "publish": {
      "provider": "github",
      "owner": "OWNER",
      "repo": "Rally",
      "releaseType": "release"
    }
  }
}
```

Key changes from current config:
- `target`: `portable` -> `nsis` (proper installer instead of single exe)
- `nsis.oneClick: true` — instant install like Discord
- `nsis.perMachine: false` — installs per-user (no admin needed)
- `protocols` — registers `rally://` deep link protocol
- `publish` — configures GitHub Releases for auto-updater
- `files` — includes `dist/` and `electron/` in the package
- `extraResources` — includes icon.png for tray

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: configure NSIS one-click installer and electron-updater"
```

---

### Task 3: Add Auto-Updater to Electron Main Process

**Files:**
- Modify: `frontend/electron/main.cjs` (add auto-update logic)

**Step 1: Add auto-updater import and setup at the top of `main.cjs`**

Add after the existing `require` statements (line 1):

```javascript
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
```

Wait — `electron-log` may not be installed. Use console instead for simplicity:

```javascript
const { autoUpdater } = require('electron-updater');
```

**Step 2: Add auto-updater configuration after `createWindow()` function (after line 62)**

Add a new function:

```javascript
function setupAutoUpdater() {
  // Don't check for updates in dev mode
  if (isDev) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    console.log('[AutoUpdater] Checking for updates...');
  });

  autoUpdater.on('update-available', (info) => {
    console.log('[AutoUpdater] Update available:', info.version);
  });

  autoUpdater.on('update-not-available', () => {
    console.log('[AutoUpdater] App is up to date.');
  });

  autoUpdater.on('download-progress', (progress) => {
    console.log(`[AutoUpdater] Download: ${Math.round(progress.percent)}%`);
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[AutoUpdater] Update downloaded:', info.version);
    // Notify the renderer process
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('update:downloaded', {
        version: info.version,
        releaseNotes: info.releaseNotes,
      });
    }
  });

  autoUpdater.on('error', (err) => {
    console.error('[AutoUpdater] Error:', err.message);
  });

  // Check for updates after a short delay (let app finish loading)
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      console.error('[AutoUpdater] Check failed:', err.message);
    });
  }, 5000);
}
```

**Step 3: Add IPC handler for "install update" action**

Add after the existing IPC handlers (around line 123):

```javascript
// Auto-updater: user wants to install the update now
ipcMain.on('update:install', () => {
  autoUpdater.quitAndInstall(false, true);
});
```

**Step 4: Call `setupAutoUpdater()` in `app.whenReady()`**

Change line 146 from:
```javascript
app.whenReady().then(createWindow);
```

To:
```javascript
app.whenReady().then(() => {
  createWindow();
  setupAutoUpdater();
});
```

**Step 5: Commit**

```bash
git add electron/main.cjs
git commit -m "feat: add auto-updater with silent download and restart prompt"
```

---

### Task 4: Update Preload with Update IPC Channels

**Files:**
- Modify: `frontend/electron/preload.cjs` (add update-related IPC)

**Step 1: Add update notification IPC to preload.cjs**

Add inside the `contextBridge.exposeInMainWorld('electronAPI', { ... })` object, after the existing entries:

```javascript
  // Auto-updates
  onUpdateDownloaded: (callback) => {
    ipcRenderer.on('update:downloaded', (_, info) => callback(info));
  },
  installUpdate: () => ipcRenderer.send('update:install'),
```

**Step 2: Commit**

```bash
git add electron/preload.cjs
git commit -m "feat: expose auto-update IPC channels in preload"
```

---

### Task 5: Configure Production API URL

**Files:**
- Modify: `frontend/src/lib/api.ts` (lines 1-5, `getApiBase` function)
- Modify: `frontend/src/hooks/useSocket.ts` (line 32, server URL)
- Create: `frontend/.env.production`

**Step 1: Update `getApiBase()` in `api.ts`**

Replace the existing `getApiBase` function (lines 1-5) with:

```typescript
function getApiBase(): string {
  // 1. Explicit override from localStorage (dev/testing)
  const serverUrl = localStorage.getItem('rally-server-url');
  if (serverUrl) return `${serverUrl.replace(/\/$/, '')}/api`;

  // 2. Build-time env var (production builds)
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) return `${envUrl.replace(/\/$/, '')}/api`;

  // 3. Fallback: same origin via Vite proxy (dev mode)
  return '/api';
}
```

**Step 2: Update Socket.IO URL in `useSocket.ts`**

Replace line 32:
```typescript
    const serverUrl = localStorage.getItem('rally-server-url') || window.location.origin;
```

With:
```typescript
    const serverUrl = localStorage.getItem('rally-server-url')
      || import.meta.env.VITE_API_URL
      || window.location.origin;
```

**Step 3: Create `frontend/.env.production`**

```
# Production API server URL
# Change this to your deployed backend URL before building the installer
VITE_API_URL=http://localhost:3001
```

Note: This defaults to `localhost:3001` for now. When you deploy the backend to a server, change this to the public URL (e.g., `https://api.rally.gg`).

**Step 4: Commit**

```bash
git add src/lib/api.ts src/hooks/useSocket.ts .env.production
git commit -m "feat: configure production API URL via VITE_API_URL env var"
```

---

### Task 6: Add Update Notification UI

**Files:**
- Create: `frontend/src/components/app/UpdateNotification.tsx`
- Modify: `frontend/src/App.tsx` (import and render)

**Step 1: Create `UpdateNotification.tsx`**

```tsx
import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

interface UpdateInfo {
  version: string;
  releaseNotes?: string;
}

export function UpdateNotification() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Listen for update-downloaded event from Electron
    const electronAPI = (window as any).electronAPI;
    if (electronAPI?.onUpdateDownloaded) {
      electronAPI.onUpdateDownloaded((info: UpdateInfo) => {
        setUpdateInfo(info);
      });
    }
  }, []);

  if (!updateInfo || dismissed) return null;

  const handleInstall = () => {
    const electronAPI = (window as any).electronAPI;
    electronAPI?.installUpdate();
  };

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-3 rounded-lg border border-[#39FF14]/30 bg-[#0A0E27] px-4 py-3 shadow-2xl">
      <Download size={16} className="text-[#39FF14] shrink-0" />
      <span className="text-sm text-white">
        Rally <span className="font-bold text-[#39FF14]">v{updateInfo.version}</span> is ready
      </span>
      <button
        onClick={handleInstall}
        className="rounded-md bg-[#39FF14]/20 px-3 py-1 text-xs font-bold text-[#39FF14] hover:bg-[#39FF14]/30 transition-colors"
      >
        Restart to Update
      </button>
      <button
        onClick={() => setDismissed(true)}
        className="text-white/40 hover:text-white/70 transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  );
}
```

**Step 2: Import and render in App.tsx**

Add to the imports in `App.tsx`:
```tsx
import { UpdateNotification } from '@/components/app/UpdateNotification';
```

Add `<UpdateNotification />` inside the root layout, e.g., just before the closing fragment or root div.

**Step 3: Commit**

```bash
git add src/components/app/UpdateNotification.tsx src/App.tsx
git commit -m "feat: add auto-update notification bar with restart button"
```

---

### Task 7: Build and Test the Installer

**Step 1: Run the production build**

```bash
cd frontend
npm run electron:build
```

This runs `vite build && electron-builder --win`, producing:
- `frontend/release/Rally Setup X.Y.Z.exe` (NSIS installer)
- `frontend/release/latest.yml` (auto-updater manifest)

**Step 2: Verify the build output**

```bash
ls -la release/
```

Expected: `Rally Setup 1.0.0.exe` (approximately 80-120MB)

**Step 3: Test the installer**

1. Run `Rally Setup 1.0.0.exe`
2. Verify: one-click install (no wizard)
3. Verify: Desktop shortcut created
4. Verify: Start Menu entry created
5. Verify: App launches and shows Rally UI
6. Verify: Check "Add/Remove Programs" — Rally should appear

**Step 4: Commit any build config tweaks**

```bash
git add -A
git commit -m "chore: finalize installer build configuration"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Generate Windows ICO icon | `public/icon.ico` |
| 2 | NSIS installer config + electron-updater dep | `package.json` |
| 3 | Auto-updater in Electron main process | `electron/main.cjs` |
| 4 | Update IPC in preload | `electron/preload.cjs` |
| 5 | Production API URL config | `api.ts`, `useSocket.ts`, `.env.production` |
| 6 | Update notification UI | `UpdateNotification.tsx`, `App.tsx` |
| 7 | Build and test installer | Build verification |

## Notes for Future

- **Code signing**: Purchase an OV or EV certificate to eliminate Windows SmartScreen warnings
- **GitHub Releases**: Set `publish.owner` and `publish.repo` in package.json once the GitHub repo is created
- **Backend deployment**: When you deploy the backend, update `frontend/.env.production` with the public API URL
- **Domain**: Purchase domain, build landing page with download button pointing to GitHub Releases
