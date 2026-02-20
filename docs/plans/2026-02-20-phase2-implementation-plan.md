# Phase 2 Implementation Plan: UI Overhaul, DM Chat & Screen Sharing

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace Rally's Discord-clone layout with a Top Nav + Hub design, add working DM chat, and add screen sharing to voice channels.

**Architecture:** The UI overhaul restructures AppLayout from a vertical server sidebar to a horizontal top nav bar with server tabs. The Dashboard becomes the home view with server cards. VoiceBar moves to a persistent full-width bottom bar. DM Chat reuses existing backend socket events (dm:send, dm:new, dm:join). Screen sharing uses Electron's desktopCapturer via IPC and adds video tracks to existing SimplePeer connections.

**Tech Stack:** React 18, TypeScript, Zustand, Socket.IO, SimplePeer, Electron desktopCapturer, Tailwind CSS, Lucide icons.

---

## Task 1: Create TopNav component

**Files:**
- Create: `frontend/src/components/app/TopNav.tsx`

**Context:** This replaces the vertical `ServerList` (72px sidebar) with a horizontal bar below the titlebar. It shows: Rally home button, server icon tabs (scrollable), DMs button, Explore button. The active server has a neon cyan underline.

**Step 1: Create TopNav.tsx**

```tsx
import { useState, useRef, useEffect } from 'react';
import {
  MessageCircle,
  Compass,
  Plus,
  UserPlus,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { useServerStore } from '@/stores/serverStore';
import { cn, getInitials } from '@/lib/utils';
import type { Server } from '@/lib/types';

export function TopNav() {
  const view = useUIStore((s) => s.view);
  const setView = useUIStore((s) => s.setView);
  const openModal = useUIStore((s) => s.openModal);
  const servers = useServerStore((s) => s.servers);
  const activeServer = useServerStore((s) => s.activeServer);
  const setActiveServer = useServerStore((s) => s.setActiveServer);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  };

  useEffect(() => {
    updateScrollState();
    const el = scrollRef.current;
    if (el) el.addEventListener('scroll', updateScrollState);
    return () => el?.removeEventListener('scroll', updateScrollState);
  }, [servers.length]);

  const scroll = (dir: 'left' | 'right') => {
    scrollRef.current?.scrollBy({ left: dir === 'left' ? -200 : 200, behavior: 'smooth' });
  };

  const handleServerClick = (server: Server) => {
    setView('servers');
    setActiveServer(server);
  };

  const handleHomeClick = () => {
    setView('servers');
    setActiveServer(null);
  };

  const handleDmClick = () => {
    setView('dms');
    setActiveServer(null);
  };

  return (
    <div className="h-11 flex items-center bg-[#0A0E27] border-b border-white/5 px-2 shrink-0">
      {/* Home / Rally logo */}
      <button
        onClick={handleHomeClick}
        className={cn(
          'flex items-center gap-1.5 px-3 h-8 rounded-md text-xs font-bold tracking-wider transition-colors shrink-0',
          view === 'servers' && !activeServer
            ? 'bg-[#00D9FF]/15 text-[#00D9FF]'
            : 'text-white/50 hover:text-white hover:bg-white/5'
        )}
      >
        <img src="./icon.png" alt="Rally" className="w-4 h-4" />
        HOME
      </button>

      {/* Divider */}
      <div className="w-px h-5 bg-white/10 mx-1.5 shrink-0" />

      {/* Scroll left arrow */}
      {canScrollLeft && (
        <button
          onClick={() => scroll('left')}
          className="p-1 text-white/30 hover:text-white/60 shrink-0"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      )}

      {/* Server tabs (scrollable) */}
      <div
        ref={scrollRef}
        className="flex items-center gap-1 overflow-x-auto scrollbar-none flex-1 min-w-0 px-1"
      >
        {servers.map((server) => {
          const isActive = activeServer?.id === server.id && view === 'servers';
          return (
            <button
              key={server.id}
              onClick={() => handleServerClick(server)}
              className={cn(
                'relative flex items-center gap-2 px-3 h-8 rounded-md text-sm font-medium transition-all shrink-0 max-w-[160px]',
                isActive
                  ? 'bg-white/10 text-white'
                  : 'text-white/40 hover:text-white/70 hover:bg-white/5'
              )}
            >
              {server.iconUrl ? (
                <img src={server.iconUrl} alt="" className="w-5 h-5 rounded-full shrink-0" />
              ) : (
                <div className="w-5 h-5 rounded-full bg-[#1A1F36] flex items-center justify-center text-[9px] font-bold text-white/60 shrink-0">
                  {getInitials(server.name)}
                </div>
              )}
              <span className="truncate">{server.name}</span>
              {/* Active underline */}
              {isActive && (
                <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-[#00D9FF] rounded-full" />
              )}
            </button>
          );
        })}
      </div>

      {/* Scroll right arrow */}
      {canScrollRight && (
        <button
          onClick={() => scroll('right')}
          className="p-1 text-white/30 hover:text-white/60 shrink-0"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}

      {/* Divider */}
      <div className="w-px h-5 bg-white/10 mx-1.5 shrink-0" />

      {/* Action buttons (right side) */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => openModal('createServer')}
          className="h-7 w-7 flex items-center justify-center rounded-md text-[#39FF14]/70 hover:bg-[#39FF14]/10 hover:text-[#39FF14] transition-colors"
          title="Create Server"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          onClick={() => openModal('joinServer')}
          className="h-7 w-7 flex items-center justify-center rounded-md text-[#39FF14]/70 hover:bg-[#39FF14]/10 hover:text-[#39FF14] transition-colors"
          title="Join Server"
        >
          <UserPlus className="w-4 h-4" />
        </button>

        <div className="w-px h-5 bg-white/10 mx-1" />

        <button
          onClick={handleDmClick}
          className={cn(
            'h-7 w-7 flex items-center justify-center rounded-md transition-colors',
            view === 'dms'
              ? 'bg-[#00D9FF]/15 text-[#00D9FF]'
              : 'text-white/40 hover:text-white/70 hover:bg-white/5'
          )}
          title="Direct Messages"
        >
          <MessageCircle className="w-4 h-4" />
        </button>
        <button
          className="h-7 w-7 flex items-center justify-center rounded-md text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
          title="Explore"
        >
          <Compass className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/app/TopNav.tsx
git commit -m "feat: create TopNav horizontal server tab bar"
```

---

## Task 2: Create Dashboard home view

**Files:**
- Create: `frontend/src/components/app/Dashboard.tsx`

**Context:** This is the new home screen shown when no server is selected. Shows server cards in a grid, quick actions (create/join), and a welcome area.

**Step 1: Create Dashboard.tsx**

```tsx
import {
  Plus,
  UserPlus,
  Users,
  MessageSquare,
  Zap,
} from 'lucide-react';
import { useServerStore } from '@/stores/serverStore';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { cn, getInitials } from '@/lib/utils';
import type { Server } from '@/lib/types';

function ServerCard({
  server,
  onClick,
}: {
  server: Server;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group relative flex flex-col items-center gap-3 rounded-xl border border-white/5 bg-[#0D1117] p-5 transition-all hover:border-[#00D9FF]/30 hover:bg-[#0D1117]/80 hover:shadow-[0_0_20px_rgba(0,217,255,0.08)]"
    >
      {/* Server icon */}
      <div className="w-14 h-14 rounded-2xl overflow-hidden bg-[#1A1F36] flex items-center justify-center transition-transform group-hover:scale-105">
        {server.iconUrl ? (
          <img src={server.iconUrl} alt={server.name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-lg font-bold text-white/60">
            {getInitials(server.name)}
          </span>
        )}
      </div>

      {/* Server name */}
      <div className="text-center w-full">
        <h3 className="text-sm font-semibold text-white truncate">{server.name}</h3>
        {server.memberCount != null && (
          <p className="text-xs text-white/30 mt-0.5 flex items-center justify-center gap-1">
            <Users className="w-3 h-3" />
            {server.memberCount} members
          </p>
        )}
      </div>

      {/* Hover glow */}
      <div className="absolute inset-0 rounded-xl border border-[#00D9FF]/0 group-hover:border-[#00D9FF]/20 transition-colors pointer-events-none" />
    </button>
  );
}

export function Dashboard() {
  const user = useAuthStore((s) => s.user);
  const servers = useServerStore((s) => s.servers);
  const setActiveServer = useServerStore((s) => s.setActiveServer);
  const setView = useUIStore((s) => s.setView);
  const openModal = useUIStore((s) => s.openModal);

  const handleServerClick = (server: Server) => {
    setView('servers');
    setActiveServer(server);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#080B18] p-6">
      {/* Welcome */}
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold text-white mb-1">
          Welcome back, <span className="text-[#00D9FF]">{user?.displayName || 'Gamer'}</span>
        </h1>
        <p className="text-sm text-white/40">Here's your Rally hub</p>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-3 mb-8">
        <button
          onClick={() => openModal('createServer')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#00D9FF]/10 border border-[#00D9FF]/20 text-[#00D9FF] text-sm font-medium hover:bg-[#00D9FF]/15 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Server
        </button>
        <button
          onClick={() => openModal('joinServer')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#39FF14]/10 border border-[#39FF14]/20 text-[#39FF14] text-sm font-medium hover:bg-[#39FF14]/15 transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          Join Server
        </button>
      </div>

      {/* Server Grid */}
      <div className="mb-4">
        <h2 className="font-display text-sm font-bold uppercase tracking-wider text-white/50 mb-3 flex items-center gap-2">
          <Zap className="w-4 h-4 text-[#00D9FF]" />
          Your Servers
        </h2>
      </div>

      {servers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#1A1F36] flex items-center justify-center mb-4">
            <MessageSquare className="w-8 h-8 text-white/20" />
          </div>
          <h3 className="text-lg font-semibold text-white/60 mb-2">No servers yet</h3>
          <p className="text-sm text-white/30 max-w-md mb-4">
            Create your own server or join one with an invite code to get started.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {servers.map((server) => (
            <ServerCard
              key={server.id}
              server={server}
              onClick={() => handleServerClick(server)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/app/Dashboard.tsx
git commit -m "feat: create Dashboard home view with server cards grid"
```

---

## Task 3: Redesign VoiceBar for full-width bottom position

**Files:**
- Modify: `frontend/src/components/app/VoiceBar.tsx`

**Context:** The VoiceBar currently lives inside the server list sidebar (narrow). It needs to become a full-width horizontal bar at the bottom of the screen, showing channel info + controls inline.

**Step 1: Rewrite VoiceBar.tsx**

Replace the entire contents of `VoiceBar.tsx` with a horizontal layout:
- Left side: connection status (green signal icon, channel name / server name)
- Center: participant avatars (small row)
- Right side: Mute, Deafen, Screen Share, Disconnect buttons

The component should use the same Zustand stores and `useSocket` hook. Add a screen share button that calls a new `onScreenShare` callback (we'll wire it later).

Key design: single row, `h-12`, dark background `bg-[#0A0E27]`, `border-t border-white/5`.

**Step 2: Commit**

```bash
git add frontend/src/components/app/VoiceBar.tsx
git commit -m "feat: redesign VoiceBar as full-width bottom bar"
```

---

## Task 4: Rewire AppLayout to new layout structure

**Files:**
- Modify: `frontend/src/components/app/AppLayout.tsx`

**Context:** This is the biggest change. The current layout is:
```
[Titlebar]
[ServerList(72px) | ChannelSidebar(240px) | Content | RightPanel]
  └─ VoiceBar inside ServerList
```

New layout:
```
[Titlebar]
[TopNav]
[ChannelSidebar | Content | RightPanel]
[VoiceBar (full-width, only when voice connected)]
```

**Step 1: Update imports**

- Remove: `ServerList` import
- Add: `TopNav` import, `Dashboard` import

**Step 2: Restructure the JSX**

- Remove the `w-[72px]` ServerList column
- Add `<TopNav />` between titlebar and main content
- Add `<Dashboard />` as the view when `view === 'servers' && !activeServer`
- Move `VoiceBar` outside the sidebar into a full-width row at the bottom of the layout
- VoiceBar should render below the main content area, spanning full width

**Step 3: Update renderMainContent()**

Add a new case: when `view === 'servers'` and `activeServer` is null, render `<Dashboard />`.

**Step 4: Commit**

```bash
git add frontend/src/components/app/AppLayout.tsx
git commit -m "feat: restructure AppLayout with TopNav + Dashboard + bottom VoiceBar"
```

---

## Task 5: Add activeDmConversation to UI store & wire DM sidebar

**Files:**
- Modify: `frontend/src/stores/uiStore.ts`
- Modify: `frontend/src/components/app/DmSidebar.tsx`

**Context:** Currently `DmSidebar` tracks `activeConversationId` in local state. We need to lift it to the UI store so `AppLayout` can decide what to render in the main area.

**Step 1: Add to uiStore**

Add `activeDmConversationId: string | null` to the store state and `setActiveDmConversation: (id: string | null) => void` action.

**Step 2: Update DmSidebar**

Replace local `activeConversationId` state with `useUIStore((s) => s.activeDmConversationId)` and `useUIStore((s) => s.setActiveDmConversation)`.

When a conversation is clicked, call `setActiveDmConversation(conv.id)` and also emit `dm:join` via socket so the backend adds the socket to the DM room.

**Step 3: Commit**

```bash
git add frontend/src/stores/uiStore.ts frontend/src/components/app/DmSidebar.tsx
git commit -m "feat: lift activeDmConversation to uiStore, wire DmSidebar"
```

---

## Task 6: Create DmChatView component

**Files:**
- Create: `frontend/src/components/chat/DmChatView.tsx`

**Context:** This component shows the message list + input for a selected DM conversation. It reuses the visual structure of ChatArea but uses DM-specific API calls and socket events.

**Step 1: Create DmChatView.tsx**

The component receives `conversationId: string` and `conversation: DmConversation` as props.

Key behaviors:
- On mount: call `api.getDmMessages(conversationId)` to load history
- On mount: emit `dm:join` via socket to join the room
- On unmount: emit `dm:leave` via socket
- Listen for `dm:new` socket events and append to messages list (use local state, not messageStore since DMs are separate)
- Render messages with sender avatar, displayName, timestamp
- Chat input at bottom calls `sendDm(conversationId, receiverId, content)` from `useSocket()`
- The `receiverId` is the other member's ID (found from `conversation.members` by filtering out current user)

Use the same visual design as ChatArea: dark background, message bubbles, input at bottom.

**Step 2: Commit**

```bash
git add frontend/src/components/chat/DmChatView.tsx
git commit -m "feat: create DmChatView component for direct message conversations"
```

---

## Task 7: Wire DmChatView into AppLayout

**Files:**
- Modify: `frontend/src/components/app/AppLayout.tsx`

**Context:** When `view === 'dms'` and `activeDmConversationId` is set, render `DmChatView` in the main content area instead of the placeholder.

**Step 1: Update renderMainContent()**

In the `view === 'dms'` branch:
- If `activeDmConversationId` is set, render `<DmChatView conversationId={activeDmConversationId} />`
- DmSidebar needs to pass conversation data. We can have DmChatView fetch its own conversation info, or pass it from DmSidebar via the store.

Simple approach: DmChatView loads the conversation data itself using the stored conversations from DmSidebar (pass via a Zustand field or fetch from API).

**Step 2: Add DmChatView import**

**Step 3: Commit**

```bash
git add frontend/src/components/app/AppLayout.tsx
git commit -m "feat: render DmChatView in main area when DM conversation selected"
```

---

## Task 8: Add desktopCapturer IPC to Electron

**Files:**
- Modify: `frontend/electron/main.cjs`
- Modify: `frontend/electron/preload.cjs`

**Context:** To pick screens/windows for screen sharing, we need to use Electron's `desktopCapturer` API. This must run in the main process and pass sources to the renderer via IPC.

**Step 1: Add IPC handler in main.cjs**

```javascript
const { desktopCapturer } = require('electron');

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
```

**Step 2: Expose in preload.cjs**

```javascript
getScreenSources: () => ipcRenderer.invoke('screen:getSources'),
```

**Step 3: Add TypeScript type declaration**

Update the `Window.electronAPI` interface in `AppLayout.tsx` (or move to a global `electron.d.ts`) to include `getScreenSources`.

**Step 4: Commit**

```bash
git add frontend/electron/main.cjs frontend/electron/preload.cjs
git commit -m "feat: add desktopCapturer IPC for screen sharing source picker"
```

---

## Task 9: Create ScreenSharePicker modal

**Files:**
- Create: `frontend/src/components/voice/ScreenSharePicker.tsx`

**Context:** Modal that shows available screens and windows as a grid of thumbnails. User clicks one to start sharing. Uses the `window.electronAPI.getScreenSources()` IPC call.

**Step 1: Create ScreenSharePicker.tsx**

The component:
- On open: calls `getScreenSources()` IPC and displays thumbnails in a grid
- Each thumbnail shows: screenshot preview, source name, app icon
- Tabs at top: "Screens" | "Windows" to filter by type (screen sources have ids starting with "screen:", windows with "window:")
- An "Include System Audio" checkbox (maps to `audio: true` in the getUserMedia constraints)
- Cancel and Share buttons
- On share: returns the selected sourceId via an `onSelect(sourceId: string, withAudio: boolean)` callback

Fallback for non-Electron (browser dev): show a message "Screen sharing requires the desktop app" or use `navigator.mediaDevices.getDisplayMedia()` directly.

**Step 2: Commit**

```bash
git add frontend/src/components/voice/ScreenSharePicker.tsx
git commit -m "feat: create ScreenSharePicker modal with source thumbnails"
```

---

## Task 10: Add screen share to VoicePeerManager

**Files:**
- Modify: `frontend/src/lib/voicePeerManager.ts`

**Context:** VoicePeerManager currently only handles audio. We need to add methods to start/stop screen sharing by adding/removing a video track on all peer connections.

**Step 1: Add screen share methods**

Add to VoicePeerManager:
- `private screenStream: MediaStream | null = null`
- `async startScreenShare(sourceId: string, withAudio: boolean): Promise<MediaStream>` — gets the display media using the sourceId, stores it, adds video track to all peers
- `stopScreenShare(): void` — removes video track from all peers, stops the stream
- `isScreenSharing(): boolean` — returns whether screen share is active

For getting screen media with a specific sourceId in Electron:
```typescript
const stream = await navigator.mediaDevices.getUserMedia({
  audio: withAudio ? { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: sourceId } } : false,
  video: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: sourceId } },
} as any);
```

To add the video track to existing peers:
```typescript
for (const [userId, peer] of this.peers.entries()) {
  const videoTrack = this.screenStream.getVideoTracks()[0];
  peer.addTrack(videoTrack, this.screenStream);
}
```

**Step 2: Add onRemoteTrack callback**

Modify the `stream` event handler on peers to differentiate between audio-only and video streams. When a video track arrives, fire a new `onScreenStream(userId: string, stream: MediaStream)` callback.

**Step 3: Commit**

```bash
git add frontend/src/lib/voicePeerManager.ts
git commit -m "feat: add screen share track management to VoicePeerManager"
```

---

## Task 11: Add screen share state to voiceStore

**Files:**
- Modify: `frontend/src/stores/voiceStore.ts`

**Context:** We need to track screen share state: who is sharing, and the incoming screen share streams.

**Step 1: Add state fields**

```typescript
screenShareUserId: string | null;       // userId of the person sharing
screenShareStream: MediaStream | null;  // local screen share stream (if we're sharing)
remoteScreenStream: MediaStream | null; // incoming screen share from another user
isScreenSharing: boolean;               // are we sharing?
```

**Step 2: Add actions**

```typescript
startScreenShare: (stream: MediaStream) => void;
stopScreenShare: () => void;
setRemoteScreenShare: (userId: string, stream: MediaStream) => void;
clearRemoteScreenShare: () => void;
```

**Step 3: Commit**

```bash
git add frontend/src/stores/voiceStore.ts
git commit -m "feat: add screen share state to voiceStore"
```

---

## Task 12: Wire screen sharing into VoiceChannel + VoiceBar

**Files:**
- Modify: `frontend/src/components/voice/VoiceChannel.tsx`
- Modify: `frontend/src/components/app/VoiceBar.tsx`
- Modify: `frontend/src/hooks/useSocket.ts`

**Context:** Connect all the screen share pieces together.

**Step 1: Update useSocket.ts**

Add `startScreenShare` and `stopScreenShare` functions:
- `startScreenShare(sourceId, withAudio)`: calls `peerManager.startScreenShare()`, emits `screen:start` to socket, updates voiceStore
- `stopScreenShare()`: calls `peerManager.stopScreenShare()`, emits `screen:stop` to socket, updates voiceStore

Add socket listener for `screen:start` and `screen:stop` from remote peers.

Update the `VoicePeerManager` constructor callbacks to include `onScreenStream`.

**Step 2: Update VoiceChannel.tsx**

Replace the stub screen share area with actual functionality:
- When `remoteScreenStream` or `screenShareStream` exists in voiceStore, show a `<video>` element playing the stream
- The "Screen Share" button in controls calls `startScreenShare` which opens the picker
- Show `<ScreenSharePicker>` modal when triggered, pass `onSelect` callback
- When the video track ends (user stops sharing from OS-level controls), auto-cleanup

**Step 3: Update VoiceBar.tsx**

Add a "Share Screen" / "Stop Sharing" button that toggles screen sharing.

**Step 4: Commit**

```bash
git add frontend/src/hooks/useSocket.ts frontend/src/components/voice/VoiceChannel.tsx frontend/src/components/app/VoiceBar.tsx
git commit -m "feat: wire screen sharing end-to-end in voice channel"
```

---

## Task 13: Add screen share socket events to backend

**Files:**
- Modify: `backend/src/socket/index.ts`

**Context:** The backend needs to relay screen:start and screen:stop events to other users in the voice channel.

**Step 1: Add socket handlers**

In the voice section of the socket handler, add:

```typescript
socket.on('screen:start', (data: { channelId: string }) => {
  socket.to(`voice:${data.channelId}`).emit('screen:start', {
    userId,
    username,
  });
});

socket.on('screen:stop', (data: { channelId: string }) => {
  socket.to(`voice:${data.channelId}`).emit('screen:stop', {
    userId,
  });
});
```

These events are purely informational — the actual video data flows over WebRTC. These events just let the UI know to expect a video track and show the screen share viewer.

**Step 2: Commit**

```bash
git add backend/src/socket/index.ts
git commit -m "feat: add screen:start/stop socket events to backend"
```

---

## Task 14: TypeScript build verification

**Files:** None (verification only)

**Step 1: Run TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: zero errors.

**Step 2: Run Vite build**

```bash
cd frontend && npm run build
```

Expected: successful build.

**Step 3: Fix any errors found**

If any TypeScript or build errors, fix them.

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve TypeScript and build errors from Phase 2"
```

---

## Task 15: Build portable .exe

**Step 1: Build the Electron portable exe**

```bash
cd frontend && CSC_IDENTITY_AUTO_DISCOVERY=false npx electron-builder --win portable
```

Expected: `Rally.exe` in `frontend/release/`.

**Step 2: Verify the build**

Confirm the file exists and is reasonable size (should be ~80MB).

---

## Dependency Map

```
Task 1 (TopNav) ─────────┐
Task 2 (Dashboard) ───────┼──→ Task 4 (AppLayout rewire)
Task 3 (VoiceBar redesign)┘         │
                                     │
Task 5 (uiStore + DmSidebar) ──→ Task 6 (DmChatView) ──→ Task 7 (wire into AppLayout)
                                     │
Task 8 (Electron IPC) ──→ Task 9 (ScreenSharePicker) ┐
Task 10 (PeerManager)                                  ├──→ Task 12 (wire together)
Task 11 (voiceStore)                                   ┘         │
                                                                  │
Task 13 (backend events) ────────────────────────────────────────┘
                                                                  │
                                                          Task 14 (verify)
                                                                  │
                                                          Task 15 (build .exe)
```

**Parallelizable groups:**
- Group A: Tasks 1, 2, 3 (independent new components)
- Group B: Tasks 5, 8, 10, 11, 13 (independent store/backend changes)
- Group C: Tasks 4, 6, 7, 9, 12 (depend on group A/B)
- Group D: Tasks 14, 15 (final verification)
