# Rally Production Installer & Auto-Updater Design

**Date**: 2026-02-20
**Goal**: Build Rally as a distributable Windows desktop app with one-click installer, auto-updates, and production server URL configuration.

## Architecture Overview

Rally follows the Discord model: a cloud-hosted backend serving multiple clients, with a downloadable Electron desktop app. This design covers the client-side packaging.

```
User downloads Rally.exe from website
  -> One-click NSIS installer
  -> Installs to %LOCALAPPDATA%/Rally
  -> Creates shortcuts (Desktop + Start Menu)
  -> Registers in Add/Remove Programs
  -> On launch: checks for updates silently
  -> Connects to production API server (e.g. https://api.rally.gg)
```

## 1. NSIS Installer

### Current State
- `electron-builder` builds a `portable` .exe (single file, no install/uninstall)
- No shortcuts, no registry entries, no protocol handler

### Target State
- NSIS one-click installer: single click installs instantly (like Discord)
- Installs to `%LOCALAPPDATA%/Rally/` (per-user, no admin required)
- Creates Desktop + Start Menu shortcuts
- Registers `rally://` protocol for deep links
- Proper uninstaller registered in Add/Remove Programs

### Config Changes (`frontend/package.json` build section)
```json
{
  "build": {
    "appId": "com.rally.desktop",
    "productName": "Rally",
    "directories": { "output": "release" },
    "files": [
      "dist/**/*",
      "electron/**/*",
      "node_modules/**/*"
    ],
    "win": {
      "target": ["nsis"],
      "icon": "public/icon.png"
    },
    "nsis": {
      "oneClick": true,
      "perMachine": false,
      "allowToChangeInstallationDirectory": false,
      "installerIcon": "public/icon.ico",
      "uninstallerIcon": "public/icon.ico",
      "shortcutName": "Rally"
    },
    "protocols": {
      "name": "Rally",
      "schemes": ["rally"]
    },
    "publish": {
      "provider": "github",
      "owner": "OWNER",
      "repo": "Rally"
    }
  }
}
```

### Icon Requirements
- Need `icon.ico` (Windows icon format) in addition to existing `icon.png`
- ICO must contain multiple sizes: 16x16, 32x32, 48x48, 64x64, 128x128, 256x256

## 2. Auto-Updater

### How It Works
1. On app launch, `electron-updater` checks GitHub Releases for a newer version
2. If found, downloads the update in the background (no UI)
3. When download completes, sends IPC message to renderer: "Update ready"
4. Renderer shows subtle notification: "Update available - restart to apply"
5. User clicks restart, app quits and relaunches with new version

### Dependencies
- `electron-updater` (from `electron-builder` ecosystem)

### Implementation
- Add auto-update logic in `electron/main.cjs`:
  - `autoUpdater.checkForUpdatesAndNotify()` on `app.whenReady()`
  - `autoUpdater.on('update-downloaded')` sends IPC to renderer
- Add IPC handler in `preload.cjs`: `onUpdateAvailable(callback)`
- Add minimal UI in frontend: toast/bar when update is ready
- `autoUpdater.quitAndInstall()` when user confirms restart

### Update Hosting
- GitHub Releases (free, native `electron-updater` support)
- Each release contains: `Rally Setup X.Y.Z.exe`, `latest.yml` (auto-generated)
- Publish flow: bump version, build, `electron-builder --publish always`

## 3. Server URL Configuration

### Problem
Frontend currently hardcodes `localhost:3001` for API and Socket.IO connections.

### Solution
Use Vite environment variables at build time:

- **Development**: `VITE_API_URL=http://localhost:3001` (default fallback)
- **Production**: `VITE_API_URL=https://api.rally.gg` (set in `.env.production`)

### Files Changed
- `frontend/src/lib/api.ts`: Use `import.meta.env.VITE_API_URL || 'http://localhost:3001'`
- `frontend/src/hooks/useSocket.ts`: Same pattern for Socket.IO server URL
- `frontend/.env.production`: Production API URL
- `frontend/vite.config.ts`: Already supports env vars via Vite defaults

## 4. Code Signing (Future)

To eliminate "Windows doesn't recognize this publisher" SmartScreen warning:

- **OV Certificate** (~$70-200/year): Builds reputation over time. After enough installs, SmartScreen stops warning.
- **EV Certificate** (~$200-400/year): Immediate SmartScreen trust. Requires hardware token.

Providers: DigiCert, Sectigo, GlobalSign, SSL.com

This is a future step after the installer is working correctly.

## 5. Future: Landing Page & Domain

- Purchase domain (e.g., `rally.gg`, `getrally.app`)
- Build landing page with "Download for Windows" button
- Host installer on GitHub Releases or S3/CloudFront
- Point download button to latest release URL

## What Stays the Same

- All frontend React code, components, stores, hooks
- All backend Express routes, middleware, socket handlers
- Prisma ORM and PostgreSQL database (runs on server, not embedded)
- Redis (runs on server)
- Socket.IO real-time communication

## What Changes

| File | Change |
|------|--------|
| `frontend/package.json` | electron-builder NSIS config, add `electron-updater` dep |
| `frontend/electron/main.cjs` | Auto-updater integration, protocol handler |
| `frontend/electron/preload.cjs` | New IPC channel for update notifications |
| `frontend/src/lib/api.ts` | Use `VITE_API_URL` env var |
| `frontend/src/hooks/useSocket.ts` | Use `VITE_API_URL` for socket connection |
| `frontend/.env.production` | New file with production API URL |
| `public/icon.ico` | New: Windows ICO format icon |
