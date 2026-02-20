# Voice UI + Server Tab Management Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the empty voice channel UI with a "Concert Stage" layout (audio visualizer + participant stage + activity strip), add voice channel hover previews, and add server tab drag-reorder/pin/hide.

**Architecture:** Three independent feature areas. Voice UI is a rewrite of `VoiceChannel.tsx` plus two new sub-components. Voice hover preview modifies `ChannelBar.tsx`. Server tab management adds a `useServerPrefs` hook (localStorage) and modifies `TopNav.tsx` + `Dashboard.tsx`.

**Tech Stack:** React 18, Web Audio API (AnalyserNode), Canvas 2D, Zustand, HTML5 Drag & Drop, localStorage

---

### Task 1: Create AudioVisualizer component

**Files:**
- Create: `frontend/src/components/voice/AudioVisualizer.tsx`

**Step 1: Create the component**

```tsx
import { useRef, useEffect, useCallback } from 'react';

interface AudioVisualizerProps {
  stream: MediaStream | null;
  className?: string;
}

export function AudioVisualizer({ stream, className }: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);

    ctx.clearRect(0, 0, width, height);

    const barCount = 48;
    const gap = 3;
    const barWidth = (width - (barCount - 1) * gap) / barCount;
    const centerX = width / 2;

    for (let i = 0; i < barCount; i++) {
      // Mirror from center outward
      const dataIndex = Math.floor((i < barCount / 2 ? barCount / 2 - i : i - barCount / 2) * (bufferLength / (barCount / 2)));
      const value = dataArray[Math.min(dataIndex, bufferLength - 1)] / 255;

      // Idle bounce: minimum height with gentle sine wave
      const time = Date.now() / 1000;
      const idleBounce = 0.03 + 0.02 * Math.sin(time * 2 + i * 0.3);
      const barHeight = Math.max(idleBounce, value) * height * 0.8;

      const x = i * (barWidth + gap);
      const y = height - barHeight;

      // Gradient: cyan at base -> purple at peaks
      const gradient = ctx.createLinearGradient(x, height, x, y);
      gradient.addColorStop(0, 'rgba(0, 217, 255, 0.6)');
      gradient.addColorStop(0.5, 'rgba(0, 217, 255, 0.3)');
      gradient.addColorStop(1, 'rgba(139, 0, 255, 0.5)');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, 2);
      ctx.fill();
    }

    animFrameRef.current = requestAnimationFrame(draw);
  }, []);

  useEffect(() => {
    if (!stream) {
      // No stream: still draw idle animation
      draw();
      return () => cancelAnimationFrame(animFrameRef.current);
    }

    const audioCtx = new AudioContext();
    audioCtxRef.current = audioCtx;
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 128;
    analyser.smoothingTimeConstant = 0.8;
    source.connect(analyser);
    analyserRef.current = analyser;

    draw();

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      analyser.disconnect();
      source.disconnect();
      audioCtx.close();
      analyserRef.current = null;
      audioCtxRef.current = null;
    };
  }, [stream, draw]);

  // Resize canvas to match container
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      canvas.width = width * window.devicePixelRatio;
      canvas.height = height * window.devicePixelRatio;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      // Reset logical size for CSS
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    });

    observer.observe(canvas.parentElement!);
    return () => observer.disconnect();
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className ?? 'absolute inset-0 w-full h-full pointer-events-none opacity-60'}
    />
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/voice/AudioVisualizer.tsx
git commit -m "feat: create AudioVisualizer component with Web Audio API"
```

---

### Task 2: Create VoiceParticipantStage component

**Files:**
- Create: `frontend/src/components/voice/VoiceParticipantStage.tsx`

**Step 1: Create the component**

The stage renders the current user as a large center avatar (80px) and other participants in a semi-circle arc (56px). Speaking participants get a green glow ring.

```tsx
import { cn, getInitials, generateAvatarGradient } from '@/lib/utils';
import { MicOff, HeadphoneOff } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import type { VoiceParticipant } from '@/lib/types';

interface VoiceParticipantStageProps {
  participants: VoiceParticipant[];
}

function StageAvatar({
  participant,
  size,
  showActivity,
}: {
  participant: VoiceParticipant;
  size: 'lg' | 'sm';
  showActivity?: boolean;
}) {
  const px = size === 'lg' ? 80 : 56;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative">
        {/* Speaking glow ring */}
        {participant.isSpeaking && (
          <div
            className="absolute -inset-1.5 rounded-full animate-pulse"
            style={{
              background: 'radial-gradient(circle, rgba(57,255,20,0.3) 0%, transparent 70%)',
            }}
          />
        )}

        <div
          className={cn(
            'flex items-center justify-center overflow-hidden rounded-full font-bold transition-all duration-300',
            participant.isSpeaking && 'ring-2 ring-[#39FF14] shadow-[0_0_20px_rgba(57,255,20,0.4)]',
            size === 'lg' ? 'text-xl' : 'text-sm',
          )}
          style={{
            width: px,
            height: px,
            background: participant.avatarUrl ? undefined : generateAvatarGradient(participant.displayName),
          }}
        >
          {participant.avatarUrl ? (
            <img src={participant.avatarUrl} alt={participant.displayName} className="h-full w-full object-cover" />
          ) : (
            <span className="text-white">{getInitials(participant.displayName)}</span>
          )}
        </div>

        {/* Mute/Deafen badge */}
        {(participant.isMuted || participant.isDeafened) && (
          <div className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#0A0E27] border border-[#FF006E]/40">
            {participant.isDeafened ? (
              <HeadphoneOff size={10} className="text-[#FF006E]" />
            ) : (
              <MicOff size={10} className="text-[#FF006E]" />
            )}
          </div>
        )}
      </div>

      {/* Name */}
      <span className={cn(
        'max-w-[90px] truncate text-center font-medium',
        size === 'lg' ? 'text-xs text-white' : 'text-[10px] text-white/70',
      )}>
        {participant.displayName}
      </span>
    </div>
  );
}

export function VoiceParticipantStage({ participants }: VoiceParticipantStageProps) {
  const user = useAuthStore((s) => s.user);

  // Split: current user center, others around
  const me = participants.find((p) => p.userId === user?.id);
  const others = participants.filter((p) => p.userId !== user?.id);

  // Semi-circle positions for others
  const getArcPosition = (index: number, total: number) => {
    // Arc from -60 to +60 degrees (centered at top)
    const startAngle = -60;
    const endAngle = 60;
    const angle = total === 1
      ? 0
      : startAngle + (endAngle - startAngle) * (index / (total - 1));
    const radians = (angle * Math.PI) / 180;
    const radius = 130; // px from center
    return {
      x: Math.sin(radians) * radius,
      y: -Math.cos(radians) * radius + 30, // offset down so arc is above center
    };
  };

  return (
    <div className="relative flex items-center justify-center" style={{ minHeight: 280 }}>
      {/* Others on arc */}
      {others.map((p, i) => {
        const pos = getArcPosition(i, others.length);
        return (
          <div
            key={p.userId}
            className="absolute transition-all duration-500"
            style={{
              transform: `translate(${pos.x}px, ${pos.y}px)`,
            }}
          >
            <StageAvatar participant={p} size="sm" />
          </div>
        );
      })}

      {/* Center: me (or placeholder if not in participants list yet) */}
      {me ? (
        <div className="relative z-10">
          <StageAvatar participant={me} size="lg" showActivity />
        </div>
      ) : (
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/5 text-white/20 text-2xl font-bold">
          ?
        </div>
      )}

      {/* Solo waiting text */}
      {others.length === 0 && (
        <div className="absolute bottom-2 text-xs text-white/30 animate-pulse">
          Waiting for others to join...
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/voice/VoiceParticipantStage.tsx
git commit -m "feat: create VoiceParticipantStage with semi-circle arc layout"
```

---

### Task 3: Create VoiceActivityStrip component

**Files:**
- Create: `frontend/src/components/voice/VoiceActivityStrip.tsx`

**Step 1: Create the component**

Shows voice duration timer, participant count, and current game (if any).

```tsx
import { useState, useEffect } from 'react';
import { Users, Clock, Gamepad2 } from 'lucide-react';
import type { VoiceParticipant } from '@/lib/types';

interface VoiceActivityStripProps {
  participants: VoiceParticipant[];
  channelName: string;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function VoiceActivityStrip({ participants, channelName }: VoiceActivityStripProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    setElapsed(0);
    const interval = setInterval(() => setElapsed((prev) => prev + 1), 1000);
    return () => clearInterval(interval);
  }, [channelName]);

  return (
    <div className="flex items-center justify-center gap-6 border-t border-white/5 bg-[#0A0E27]/50 px-4 py-2">
      {/* Duration */}
      <div className="flex items-center gap-1.5 text-xs text-white/50">
        <Clock className="h-3.5 w-3.5 text-[#00D9FF]/60" />
        <span className="tabular-nums font-medium">{formatDuration(elapsed)}</span>
      </div>

      {/* Divider */}
      <div className="h-3 w-px bg-white/10" />

      {/* Participants */}
      <div className="flex items-center gap-1.5 text-xs text-white/50">
        <Users className="h-3.5 w-3.5 text-[#39FF14]/60" />
        <span className="font-medium">
          {participants.length} participant{participants.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Divider */}
      <div className="h-3 w-px bg-white/10" />

      {/* Channel name */}
      <div className="flex items-center gap-1.5 text-xs text-white/50">
        <Gamepad2 className="h-3.5 w-3.5 text-[#8B00FF]/60" />
        <span className="font-medium">{channelName}</span>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/voice/VoiceActivityStrip.tsx
git commit -m "feat: create VoiceActivityStrip with duration timer and participant count"
```

---

### Task 4: Rewrite VoiceChannel with Concert Stage layout

**Files:**
- Modify: `frontend/src/components/voice/VoiceChannel.tsx` (full rewrite)

**Step 1: Rewrite the component**

Replace the existing component with the Concert Stage layout. Imports the three new sub-components. Keeps existing controls bar and screen share logic. Removes grid/spatial view toggle (replaced by stage).

Key changes:
- Remove `viewMode` state and `spatial` drag logic
- Import `AudioVisualizer`, `VoiceParticipantStage`, `VoiceActivityStrip`
- Layout: header -> stage area (visualizer bg + participant stage) -> activity strip -> screen share (if active) -> controls
- Pass local mic stream to AudioVisualizer (need to get it from voicePeerManager or create a new one)

For the mic stream, add a `localStream` to voiceStore or capture it in VoiceChannel. Simplest: create a local mic stream on mount for the visualizer only.

The full rewritten component should:
1. Keep the same exports/props interface
2. Keep all screen share rendering logic
3. Keep all control buttons (Mute, Deafen, Screen, Camera, Disconnect)
4. Replace the grid/spatial views with the stage
5. Add visualizer as absolute-positioned behind the stage
6. Add activity strip between stage and controls
7. Get channel name from serverStore for the header

**Step 2: Commit**

```bash
git add frontend/src/components/voice/VoiceChannel.tsx
git commit -m "feat: rewrite VoiceChannel with Concert Stage layout"
```

---

### Task 5: Add voice channel hover preview to ChannelBar

**Files:**
- Create: `frontend/src/components/voice/VoiceChannelPreview.tsx`
- Modify: `frontend/src/components/app/ChannelBar.tsx`

**Step 1: Create VoiceChannelPreview**

A small popover that appears on hover over voice channel pills. Shows avatars + names of participants, or "Empty" if nobody's there.

```tsx
import { cn, getInitials, generateAvatarGradient } from '@/lib/utils';
import { useVoiceStore } from '@/stores/voiceStore';

interface VoiceChannelPreviewProps {
  channelId: string;
}

export function VoiceChannelPreview({ channelId }: VoiceChannelPreviewProps) {
  const participants = useVoiceStore((s) => s.participants);
  const voiceChannelId = useVoiceStore((s) => s.channelId);

  // Only show participants if this is the active voice channel
  const isActiveVoice = voiceChannelId === channelId;
  const channelParticipants = isActiveVoice ? participants : [];

  return (
    <div className="absolute top-full left-0 mt-1 z-50 min-w-[160px] rounded-lg border border-white/10 bg-[#0A0E27] p-2 shadow-xl">
      {channelParticipants.length === 0 ? (
        <p className="text-xs text-white/30 px-1 py-0.5">Empty</p>
      ) : (
        <div className="flex flex-col gap-1">
          {channelParticipants.slice(0, 5).map((p) => (
            <div key={p.userId} className="flex items-center gap-2 px-1 py-0.5">
              <div
                className="h-5 w-5 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0"
                style={{ background: generateAvatarGradient(p.displayName) }}
              >
                <span className="text-white">{getInitials(p.displayName)}</span>
              </div>
              <span className="text-xs text-white/70 truncate">{p.displayName}</span>
              <div className="h-1.5 w-1.5 rounded-full bg-[#39FF14] shrink-0" />
            </div>
          ))}
          {channelParticipants.length > 5 && (
            <p className="text-[10px] text-white/30 px-1">+{channelParticipants.length - 5} more</p>
          )}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Modify ChannelBar**

In `ChannelBar.tsx`, for voice channel pills:
- Add a participant count badge `(N)` next to the channel name when people are connected
- Wrap the button in a relative container
- Add hover state that shows `VoiceChannelPreview` after 300ms delay
- Import `VoiceChannelPreview` from the new file

**Step 3: Commit**

```bash
git add frontend/src/components/voice/VoiceChannelPreview.tsx frontend/src/components/app/ChannelBar.tsx
git commit -m "feat: add voice channel hover preview with participant list"
```

---

### Task 6: Create useServerPrefs hook

**Files:**
- Create: `frontend/src/hooks/useServerPrefs.ts`

**Step 1: Create the hook**

```tsx
import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'rally:server-prefs';

interface ServerPrefs {
  order: string[];   // server IDs in display order
  pinned: string[];  // server IDs that are pinned
  hidden: string[];  // server IDs that are hidden
}

const DEFAULT_PREFS: ServerPrefs = { order: [], pinned: [], hidden: [] };

function loadPrefs(): ServerPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFS;
  }
}

function savePrefs(prefs: ServerPrefs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

export function useServerPrefs() {
  const [prefs, setPrefs] = useState<ServerPrefs>(loadPrefs);

  // Persist on change
  useEffect(() => {
    savePrefs(prefs);
  }, [prefs]);

  const togglePin = useCallback((serverId: string) => {
    setPrefs((prev) => {
      const pinned = prev.pinned.includes(serverId)
        ? prev.pinned.filter((id) => id !== serverId)
        : [...prev.pinned, serverId];
      return { ...prev, pinned };
    });
  }, []);

  const toggleHide = useCallback((serverId: string) => {
    setPrefs((prev) => {
      const hidden = prev.hidden.includes(serverId)
        ? prev.hidden.filter((id) => id !== serverId)
        : [...prev.hidden, serverId];
      return { ...prev, hidden };
    });
  }, []);

  const reorder = useCallback((serverIds: string[]) => {
    setPrefs((prev) => ({ ...prev, order: serverIds }));
  }, []);

  const unhide = useCallback((serverId: string) => {
    setPrefs((prev) => ({
      ...prev,
      hidden: prev.hidden.filter((id) => id !== serverId),
    }));
  }, []);

  const isPinned = useCallback((serverId: string) => prefs.pinned.includes(serverId), [prefs.pinned]);
  const isHidden = useCallback((serverId: string) => prefs.hidden.includes(serverId), [prefs.hidden]);

  // Sort servers: pinned first, then by order array, then alphabetical
  const sortServers = useCallback(<T extends { id: string; name: string }>(servers: T[]): T[] => {
    const visible = servers.filter((s) => !prefs.hidden.includes(s.id));
    const orderMap = new Map(prefs.order.map((id, i) => [id, i]));

    return visible.sort((a, b) => {
      const aPinned = prefs.pinned.includes(a.id);
      const bPinned = prefs.pinned.includes(b.id);
      if (aPinned !== bPinned) return aPinned ? -1 : 1;

      const aOrder = orderMap.get(a.id) ?? Infinity;
      const bOrder = orderMap.get(b.id) ?? Infinity;
      if (aOrder !== bOrder) return aOrder - bOrder;

      return a.name.localeCompare(b.name);
    });
  }, [prefs]);

  const getHiddenServers = useCallback(<T extends { id: string }>(servers: T[]): T[] => {
    return servers.filter((s) => prefs.hidden.includes(s.id));
  }, [prefs]);

  return { prefs, togglePin, toggleHide, reorder, unhide, isPinned, isHidden, sortServers, getHiddenServers };
}
```

**Step 2: Commit**

```bash
git add frontend/src/hooks/useServerPrefs.ts
git commit -m "feat: create useServerPrefs hook for pin/hide/reorder with localStorage"
```

---

### Task 7: Create ServerContextMenu component

**Files:**
- Create: `frontend/src/components/app/ServerContextMenu.tsx`

**Step 1: Create the component**

A right-click context menu for server tabs and server cards. Options: Pin/Unpin, Hide, Notifications (placeholder), Server Settings (placeholder).

```tsx
import { useEffect, useRef } from 'react';
import { Pin, EyeOff, Bell, Settings } from 'lucide-react';

interface ServerContextMenuProps {
  x: number;
  y: number;
  isPinned: boolean;
  onPin: () => void;
  onHide: () => void;
  onClose: () => void;
}

export function ServerContextMenu({ x, y, isPinned, onPin, onHide, onClose }: ServerContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="fixed z-[100] w-48 rounded-lg border border-white/10 bg-[#0A0E27] py-1 shadow-2xl"
      style={{ left: x, top: y }}
    >
      <button
        onClick={() => { onPin(); onClose(); }}
        className="flex w-full items-center gap-2.5 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10 hover:text-white transition-colors"
      >
        <Pin className="h-3.5 w-3.5" />
        {isPinned ? 'Unpin Server' : 'Pin Server'}
      </button>
      <button
        onClick={() => { onHide(); onClose(); }}
        className="flex w-full items-center gap-2.5 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10 hover:text-white transition-colors"
      >
        <EyeOff className="h-3.5 w-3.5" />
        Hide Server
      </button>
      <div className="my-1 h-px bg-white/5" />
      <button
        className="flex w-full items-center gap-2.5 px-3 py-1.5 text-xs text-white/30 cursor-not-allowed"
        disabled
      >
        <Bell className="h-3.5 w-3.5" />
        Notifications
      </button>
      <button
        className="flex w-full items-center gap-2.5 px-3 py-1.5 text-xs text-white/30 cursor-not-allowed"
        disabled
      >
        <Settings className="h-3.5 w-3.5" />
        Server Settings
      </button>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/app/ServerContextMenu.tsx
git commit -m "feat: create ServerContextMenu for pin/hide right-click actions"
```

---

### Task 8: Add drag-reorder + right-click + pin/hide to TopNav

**Files:**
- Modify: `frontend/src/components/app/TopNav.tsx`

**Step 1: Modify TopNav**

Changes needed:
1. Import `useServerPrefs` hook and `ServerContextMenu`
2. Use `sortServers` to order the server tabs (instead of raw `servers` array)
3. Filter out hidden servers (already handled by `sortServers`)
4. Add `draggable` attribute to `ServerTab` buttons
5. Add `onDragStart`, `onDragOver`, `onDrop` handlers for reordering
6. Add `onContextMenu` to each `ServerTab` to show the context menu
7. Show a pinned dot indicator under pinned tabs
8. Add a "..." overflow button that shows hidden servers in a dropdown
9. Pass `isPinned` prop to `ServerTab` so it can show the pin dot

Key modifications to `ServerTab`:
- Add `isPinned` prop → shows a small cyan dot below the tab
- Add `draggable` + drag event handlers
- Add `onContextMenu` handler

Key modifications to `TopNav`:
- State for `contextMenu: { serverId, x, y } | null`
- State for `dragOverId: string | null` (drop indicator)
- State for `showHiddenDropdown: boolean`
- Use `useServerPrefs()` to get `sortServers`, `togglePin`, `toggleHide`, etc.
- Render `ServerContextMenu` when `contextMenu` is set
- Render overflow "..." button + hidden server dropdown

**Step 2: Commit**

```bash
git add frontend/src/components/app/TopNav.tsx
git commit -m "feat: add drag-reorder, right-click pin/hide to TopNav server tabs"
```

---

### Task 9: Add right-click pin/hide to Dashboard server cards

**Files:**
- Modify: `frontend/src/components/app/Dashboard.tsx`

**Step 1: Modify Dashboard**

Changes needed:
1. Import `useServerPrefs` and `ServerContextMenu`
2. Use `sortServers` to order server cards (pinned first)
3. Filter out hidden servers
4. Add `onContextMenu` to each `ServerCard`
5. Show pin icon badge on pinned server cards
6. State for context menu position

Key modifications to `ServerCard`:
- Add `isPinned` prop → shows a small pin icon in the corner
- Add `onContextMenu` prop

Key modifications to `Dashboard`:
- State for `contextMenu: { serverId, x, y } | null`
- Use `sortServers` on the `servers` array before mapping
- Render `ServerContextMenu` when active

**Step 2: Commit**

```bash
git add frontend/src/components/app/Dashboard.tsx
git commit -m "feat: add right-click pin/hide to Dashboard server cards"
```

---

### Task 10: Fix BubbleMessage compact grouping (already done)

**Files:**
- Already modified: `frontend/src/components/chat/BubbleMessage.tsx`

The compact message name was already removed in this session. Just need to commit.

```bash
git add frontend/src/components/chat/BubbleMessage.tsx
git commit -m "fix: remove author name from compact bubble messages"
```

---

### Task 11: TypeScript verification + build

**Step 1: Run TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: zero errors

**Step 2: Run production build**

```bash
cd frontend && npm run build
```

Expected: successful build

**Step 3: Fix any errors found, then commit fixes**

---

### Task 12: Visual QA in browser

**Step 1: Start servers, navigate to app**
**Step 2: Test voice channel — verify Concert Stage with visualizer, participant stage, activity strip**
**Step 3: Test voice channel hover in ChannelBar — verify popover appears**
**Step 4: Test right-click on server tab — verify context menu with Pin/Hide**
**Step 5: Test drag-reorder server tabs — verify tabs move**
**Step 6: Test right-click on Dashboard server card — verify same menu**
**Step 7: Test pin persistence — pin a server, refresh, verify still pinned**
**Step 8: Test hide — hide a server, verify gone from TopNav and Home, visible in overflow**
**Step 9: Take screenshots of each feature**
