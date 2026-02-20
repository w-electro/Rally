# Voice Chat, Server Creation & Invite System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add working peer-to-peer voice chat, a Create Server modal, invite codes for friends, and configurable server URLs so multiple users can connect.

**Architecture:** P2P mesh WebRTC via simple-peer. Each user captures their microphone and establishes direct peer connections to all other users in the voice channel. Socket.IO handles signaling (offer/answer/ICE candidates). Voice activity detection via Web Audio AnalyserNode.

**Tech Stack:** simple-peer (WebRTC), Web Audio API (VAD), Socket.IO (signaling), Prisma/SQLite (invites), React/Zustand (UI state)

---

### Task 1: Install simple-peer and fix backend binding

**Files:**
- Modify: `frontend/package.json` (add simple-peer)
- Modify: `backend/src/index.ts:70` (bind to 0.0.0.0, enable WebRTC signaling)
- Modify: `backend/src/index.ts:29` (widen CORS for LAN/tunnel access)

**Step 1: Install simple-peer in frontend**

Run from `frontend/`:
```bash
npm install simple-peer
npm install -D @types/simple-peer
```

**Step 2: Enable WebRTC signaling in backend**

In `backend/src/index.ts`, the `setupWebRTCSignaling(io)` call exists at line 67 but the signaling code is never invoked because the function registers a second `io.on('connection')` handler. Instead of a separate handler, we need to integrate signaling events into the existing socket handler in `backend/src/socket/index.ts`.

In `backend/src/socket/index.ts`, after the `voice:deafen` handler (~line 342), add WebRTC signaling events:

```typescript
// ==================== WEBRTC SIGNALING ====================

socket.on('webrtc:offer', (data: { targetUserId: string; offer: any }) => {
  const targetSocketId = findSocketByUserId(data.targetUserId);
  if (targetSocketId) {
    io.to(targetSocketId).emit('webrtc:offer', {
      fromUserId: userId,
      offer: data.offer,
    });
  }
});

socket.on('webrtc:answer', (data: { targetUserId: string; answer: any }) => {
  const targetSocketId = findSocketByUserId(data.targetUserId);
  if (targetSocketId) {
    io.to(targetSocketId).emit('webrtc:answer', {
      fromUserId: userId,
      answer: data.answer,
    });
  }
});

socket.on('webrtc:ice_candidate', (data: { targetUserId: string; candidate: any }) => {
  const targetSocketId = findSocketByUserId(data.targetUserId);
  if (targetSocketId) {
    io.to(targetSocketId).emit('webrtc:ice_candidate', {
      fromUserId: userId,
      candidate: data.candidate,
    });
  }
});
```

Also modify the `voice:user_joined` event to include the participant list so the new joiner knows who to connect to:

```typescript
socket.on('voice:join', async (channelId: string) => {
  if (!voiceChannels.has(channelId)) {
    voiceChannels.set(channelId, new Set());
  }

  // Get existing participants BEFORE adding new user
  const existingParticipants = Array.from(voiceChannels.get(channelId)!);

  voiceChannels.get(channelId)!.add(userId);
  socket.join(`voice:${channelId}`);

  // Tell the NEW user about all existing participants
  socket.emit('voice:participants', {
    channelId,
    participants: existingParticipants,
  });

  // Tell EXISTING users about the new user
  socket.to(`voice:${channelId}`).emit('voice:user_joined', {
    channelId,
    userId,
    username,
  });

  await setPresence(userId, 'ONLINE', { voiceChannel: channelId });
});
```

**Step 3: Bind backend to 0.0.0.0 and widen CORS**

In `backend/src/index.ts`, change the listen call:

```typescript
httpServer.listen(config.port, '0.0.0.0', () => {
```

In `backend/src/index.ts`, update CORS for development:

```typescript
app.use(cors({
  origin: config.nodeEnv === 'production' ? config.corsOrigin : true,
  credentials: true,
}));
```

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: install simple-peer, enable WebRTC signaling, bind 0.0.0.0"
```

---

### Task 2: Create VoicePeerManager (core WebRTC logic)

**Files:**
- Create: `frontend/src/lib/voicePeerManager.ts`

This is the heart of voice chat. A class that manages:
- Local microphone stream
- Peer connections to all other users in the channel
- WebRTC offer/answer/ICE signaling via Socket.IO
- Voice activity detection

**Step 1: Create VoicePeerManager**

```typescript
// frontend/src/lib/voicePeerManager.ts
import SimplePeer from 'simple-peer';
import { getSocket } from '@/hooks/useSocket';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

type OnSpeakingChange = (speaking: boolean) => void;
type OnRemoteStream = (userId: string, stream: MediaStream) => void;
type OnPeerDisconnect = (userId: string) => void;

export class VoicePeerManager {
  private localStream: MediaStream | null = null;
  private peers: Map<string, SimplePeer.Instance> = new Map();
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private vadInterval: ReturnType<typeof setInterval> | null = null;
  private isMuted = false;
  private isDeafened = false;

  private onSpeakingChange: OnSpeakingChange;
  private onRemoteStream: OnRemoteStream;
  private onPeerDisconnect: OnPeerDisconnect;

  constructor(
    onSpeakingChange: OnSpeakingChange,
    onRemoteStream: OnRemoteStream,
    onPeerDisconnect: OnPeerDisconnect,
  ) {
    this.onSpeakingChange = onSpeakingChange;
    this.onRemoteStream = onRemoteStream;
    this.onPeerDisconnect = onPeerDisconnect;
  }

  async start(): Promise<void> {
    this.localStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });

    // Set up voice activity detection
    this.audioContext = new AudioContext();
    const source = this.audioContext.createMediaStreamSource(this.localStream);
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 512;
    source.connect(this.analyser);

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    let wasSpeaking = false;

    this.vadInterval = setInterval(() => {
      if (!this.analyser) return;
      this.analyser.getByteFrequencyData(dataArray);
      const avg = dataArray.reduce((sum, val) => sum + val, 0) / dataArray.length;
      const isSpeaking = avg > 15 && !this.isMuted;

      if (isSpeaking !== wasSpeaking) {
        wasSpeaking = isSpeaking;
        this.onSpeakingChange(isSpeaking);
      }
    }, 100);

    // Listen for WebRTC signaling events
    this.setupSocketListeners();
  }

  private setupSocketListeners(): void {
    const socket = getSocket();
    if (!socket) return;

    socket.on('webrtc:offer', (data: { fromUserId: string; offer: any }) => {
      this.handleOffer(data.fromUserId, data.offer);
    });

    socket.on('webrtc:answer', (data: { fromUserId: string; answer: any }) => {
      const peer = this.peers.get(data.fromUserId);
      if (peer) peer.signal(data.answer);
    });

    socket.on('webrtc:ice_candidate', (data: { fromUserId: string; candidate: any }) => {
      const peer = this.peers.get(data.fromUserId);
      if (peer) peer.signal(data.candidate);
    });
  }

  // Called when we get the list of existing participants (we are the INITIATOR)
  connectToParticipants(userIds: string[]): void {
    for (const userId of userIds) {
      this.createPeer(userId, true);
    }
  }

  // Handle incoming offer (we are NOT the initiator)
  private handleOffer(fromUserId: string, offer: any): void {
    const peer = this.createPeer(fromUserId, false);
    peer.signal(offer);
  }

  private createPeer(targetUserId: string, initiator: boolean): SimplePeer.Instance {
    // Destroy existing peer if any
    this.peers.get(targetUserId)?.destroy();

    const peer = new SimplePeer({
      initiator,
      stream: this.localStream || undefined,
      trickle: true,
      config: { iceServers: ICE_SERVERS },
    });

    peer.on('signal', (signal) => {
      const socket = getSocket();
      if (!socket) return;

      if (signal.type === 'offer') {
        socket.emit('webrtc:offer', { targetUserId, offer: signal });
      } else if (signal.type === 'answer') {
        socket.emit('webrtc:answer', { targetUserId, answer: signal });
      } else if (signal.candidate) {
        socket.emit('webrtc:ice_candidate', { targetUserId, candidate: signal });
      }
    });

    peer.on('stream', (stream: MediaStream) => {
      this.onRemoteStream(targetUserId, stream);
    });

    peer.on('close', () => {
      this.peers.delete(targetUserId);
      this.onPeerDisconnect(targetUserId);
    });

    peer.on('error', (err) => {
      console.error(`Peer error with ${targetUserId}:`, err.message);
      this.peers.delete(targetUserId);
      this.onPeerDisconnect(targetUserId);
    });

    this.peers.set(targetUserId, peer);
    return peer;
  }

  removePeer(userId: string): void {
    const peer = this.peers.get(userId);
    if (peer) {
      peer.destroy();
      this.peers.delete(userId);
    }
  }

  setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }
  }

  setDeafened(deafened: boolean): void {
    this.isDeafened = deafened;
    // Deafening is handled at the audio element level (mute remote streams)
  }

  stop(): void {
    // Clean up all peers
    for (const [, peer] of this.peers) {
      peer.destroy();
    }
    this.peers.clear();

    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }

    // Clean up VAD
    if (this.vadInterval) {
      clearInterval(this.vadInterval);
      this.vadInterval = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    // Remove socket listeners
    const socket = getSocket();
    if (socket) {
      socket.off('webrtc:offer');
      socket.off('webrtc:answer');
      socket.off('webrtc:ice_candidate');
    }
  }
}
```

**Step 2: Commit**

```bash
git add frontend/src/lib/voicePeerManager.ts
git commit -m "feat: add VoicePeerManager for P2P WebRTC voice chat"
```

---

### Task 3: Wire voice chat into useSocket and VoiceChannel UI

**Files:**
- Modify: `frontend/src/hooks/useSocket.ts` (add voice:participants listener, wire VoicePeerManager)
- Modify: `frontend/src/components/app/ChannelSidebar.tsx` (handle voice channel clicks to join/leave)
- Modify: `frontend/src/components/voice/VoiceChannel.tsx` (play remote audio streams)
- Modify: `frontend/src/components/app/VoiceBar.tsx` (wire mute/deafen to VoicePeerManager)
- Modify: `frontend/src/components/app/AppLayout.tsx` (render VoiceChannel when in voice)

**Step 1: Update useSocket to manage VoicePeerManager lifecycle**

Key changes to `frontend/src/hooks/useSocket.ts`:
- Import VoicePeerManager
- Create a singleton instance when joining voice
- Listen for `voice:participants` (list of existing users to connect to)
- On `voice:user_joined`, the VoicePeerManager handles it via webrtc:offer listener
- On `voice:user_left`, call removePeer
- Store remote audio streams in voiceStore (add a `remoteStreams` map)
- On joinVoice: create VoicePeerManager, call start(), emit voice:join
- On leaveVoice: call stop(), emit voice:leave

**Step 2: Update voiceStore with remoteStreams**

Add to `frontend/src/stores/voiceStore.ts`:
```typescript
remoteStreams: {} as Record<string, MediaStream>,
setRemoteStream: (userId, stream) => set((s) => ({
  remoteStreams: { ...s.remoteStreams, [userId]: stream },
})),
removeRemoteStream: (userId) => set((s) => {
  const { [userId]: _, ...rest } = s.remoteStreams;
  return { remoteStreams: rest };
}),
```

And clear remoteStreams in leaveChannel.

**Step 3: Update ChannelSidebar voice channel click**

In `ChannelSidebar.tsx`, when a VOICE channel is clicked:
- If not in a voice channel: call `joinVoice(channel.id)` from useSocket
- If already in this channel: no-op
- If in a different channel: leave current, join new
- Also update voiceStore.joinChannel() to set the channelId

**Step 4: Update VoiceChannel to render audio elements**

Add hidden `<audio>` elements for each remote stream in VoiceChannel.tsx:
```tsx
{Object.entries(remoteStreams).map(([userId, stream]) => (
  <audio
    key={userId}
    ref={(el) => { if (el) el.srcObject = stream; }}
    autoPlay
    muted={isDeafened}
  />
))}
```

**Step 5: Update AppLayout to show VoiceChannel**

In AppLayout, when a voice channel is active, render VoiceChannel as the main content:
```tsx
if (view === 'servers' && activeServer && activeChannel?.type === 'VOICE') {
  return <VoiceChannel />;
}
```

**Step 6: Commit**

```bash
git add -A && git commit -m "feat: wire P2P voice chat into UI with audio playback"
```

---

### Task 4: Create Server Modal

**Files:**
- Create: `frontend/src/components/app/CreateServerModal.tsx`
- Modify: `frontend/src/components/app/AppLayout.tsx` (render modal)

**Step 1: Create CreateServerModal component**

```typescript
// frontend/src/components/app/CreateServerModal.tsx
import { useState } from 'react';
import { X, Globe, Lock } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { useServerStore } from '@/stores/serverStore';

export function CreateServerModal() {
  const closeModal = useUIStore((s) => s.closeModal);
  const createServer = useServerStore((s) => s.createServer);
  const setActiveServer = useServerStore((s) => s.setActiveServer);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Server name is required'); return; }
    setIsSubmitting(true);
    setError('');
    try {
      const server = await createServer({ name: name.trim(), description: description.trim() || undefined, isPublic });
      await setActiveServer(server);
      closeModal();
    } catch (err: any) {
      setError(err.message || 'Failed to create server');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={closeModal} />
      <div className="relative z-10 w-full max-w-md mx-4 border border-rally-blue/20 bg-rally-dark-surface">
        {/* Top accent */}
        <div className="h-px bg-gradient-to-r from-transparent via-rally-blue to-transparent" />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
          <h2 className="font-display text-lg font-bold uppercase tracking-wider text-white">
            Create Server
          </h2>
          <button onClick={closeModal} className="text-white/40 hover:text-white/80">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {error && (
            <div className="text-sm text-rally-magenta bg-rally-magenta/10 border border-rally-magenta/20 px-3 py-2">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-display uppercase tracking-wider text-white/60 mb-1.5">
              Server Name *
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Awesome Server"
              className="input-rally"
              maxLength={100}
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-display uppercase tracking-wider text-white/60 mb-1.5">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this server about?"
              className="input-rally resize-none"
              rows={3}
              maxLength={1024}
            />
          </div>

          <div>
            <label className="block text-xs font-display uppercase tracking-wider text-white/60 mb-2">
              Visibility
            </label>
            <div className="flex gap-3">
              <button
                onClick={() => setIsPublic(false)}
                className={`flex-1 flex items-center gap-2 px-4 py-3 border transition-colors ${
                  !isPublic
                    ? 'border-rally-blue bg-rally-blue/10 text-rally-blue'
                    : 'border-white/10 text-white/40 hover:border-white/20'
                }`}
              >
                <Lock className="w-4 h-4" />
                <div className="text-left">
                  <div className="text-sm font-semibold">Private</div>
                  <div className="text-xs opacity-60">Invite only</div>
                </div>
              </button>
              <button
                onClick={() => setIsPublic(true)}
                className={`flex-1 flex items-center gap-2 px-4 py-3 border transition-colors ${
                  isPublic
                    ? 'border-rally-green bg-rally-green/10 text-rally-green'
                    : 'border-white/10 text-white/40 hover:border-white/20'
                }`}
              >
                <Globe className="w-4 h-4" />
                <div className="text-left">
                  <div className="text-sm font-semibold">Public</div>
                  <div className="text-xs opacity-60">Anyone can join</div>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-white/5 px-6 py-4">
          <button onClick={closeModal} className="px-4 py-2 text-sm text-white/40 hover:text-white/60 mr-3">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !name.trim()}
            className="btn-rally-primary disabled:opacity-50"
          >
            {isSubmitting ? 'Creating...' : 'Create Server'}
          </button>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-rally-blue/40 to-transparent" />
      </div>
    </div>
  );
}
```

**Step 2: Render in AppLayout**

In `frontend/src/components/app/AppLayout.tsx`, add:
```tsx
import { CreateServerModal } from './CreateServerModal';
// ...
const activeModal = useUIStore((s) => s.activeModal);
// ... at the end of the JSX, before closing </div>:
{activeModal === 'createServer' && <CreateServerModal />}
```

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: add Create Server modal"
```

---

### Task 5: Invite System (database + backend routes)

**Files:**
- Modify: `backend/prisma/schema.prisma` (add ServerInvite model)
- Create: `backend/src/routes/invites.ts` (invite routes)
- Modify: `backend/src/index.ts` (register invite routes)
- Modify: `frontend/src/lib/api.ts` (add invite API methods)

**Step 1: Add ServerInvite model to Prisma schema**

At the end of the Server & Channels section in `backend/prisma/schema.prisma`:

```prisma
model ServerInvite {
  id        String    @id @default(cuid())
  code      String    @unique
  serverId  String
  creatorId String
  expiresAt DateTime?
  maxUses   Int?
  uses      Int       @default(0)
  createdAt DateTime  @default(now())

  server    Server    @relation(fields: [serverId], references: [id], onDelete: Cascade)
  creator   User      @relation(fields: [creatorId], references: [id])

  @@index([code])
  @@index([serverId])
}
```

Add the relations to User and Server models:
- User: add `serverInvites ServerInvite[]`
- Server: add `invites ServerInvite[]`

**Step 2: Run Prisma generate and push**

```bash
cd backend && npx prisma generate && npx prisma db push
```

**Step 3: Create invite routes**

`backend/src/routes/invites.ts`:

```typescript
import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { BadRequestError, NotFoundError, ForbiddenError } from '../utils/errors';

const router = Router();

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

function generateCode(): string {
  return crypto.randomBytes(4).toString('hex'); // 8 hex chars
}

// POST /servers/:serverId/invites — Create invite
router.post(
  '/servers/:serverId/invites',
  authenticate,
  asyncHandler(async (req, res) => {
    const { serverId } = req.params;
    const userId = req.user!.userId;

    // Verify membership
    const member = await prisma.serverMember.findUnique({
      where: { userId_serverId: { userId, serverId } },
    });
    if (!member) throw new ForbiddenError('You are not a member of this server');

    const expiresAt = req.body.expiresAt
      ? new Date(req.body.expiresAt)
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days default

    const invite = await prisma.serverInvite.create({
      data: {
        code: generateCode(),
        serverId,
        creatorId: userId,
        expiresAt,
        maxUses: req.body.maxUses ?? null,
      },
    });

    res.status(201).json(invite);
  }),
);

// GET /invites/:code — Resolve invite (public, no auth)
router.get(
  '/invites/:code',
  asyncHandler(async (req, res) => {
    const invite = await prisma.serverInvite.findUnique({
      where: { code: req.params.code },
      include: {
        server: {
          select: { id: true, name: true, iconUrl: true, memberCount: true, description: true },
        },
        creator: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
      },
    });

    if (!invite) throw new NotFoundError('Invalid invite code');
    if (invite.expiresAt && invite.expiresAt < new Date()) {
      throw new BadRequestError('This invite has expired');
    }
    if (invite.maxUses && invite.uses >= invite.maxUses) {
      throw new BadRequestError('This invite has reached its max uses');
    }

    // Get actual member count
    const memberCount = await prisma.serverMember.count({ where: { serverId: invite.serverId } });

    res.json({
      code: invite.code,
      server: { ...invite.server, memberCount },
      creator: invite.creator,
      expiresAt: invite.expiresAt,
    });
  }),
);

// POST /invites/:code/join — Redeem invite
router.post(
  '/invites/:code/join',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user!.userId;
    const invite = await prisma.serverInvite.findUnique({
      where: { code: req.params.code },
    });

    if (!invite) throw new NotFoundError('Invalid invite code');
    if (invite.expiresAt && invite.expiresAt < new Date()) {
      throw new BadRequestError('This invite has expired');
    }
    if (invite.maxUses && invite.uses >= invite.maxUses) {
      throw new BadRequestError('This invite has reached its max uses');
    }

    // Check if already a member
    const existing = await prisma.serverMember.findUnique({
      where: { userId_serverId: { userId, serverId: invite.serverId } },
    });
    if (existing) throw new BadRequestError('You are already a member of this server');

    // Add member and increment invite uses
    const [member] = await prisma.$transaction([
      prisma.serverMember.create({
        data: { userId, serverId: invite.serverId },
        include: {
          server: { select: { id: true, name: true, iconUrl: true } },
        },
      }),
      prisma.serverInvite.update({
        where: { id: invite.id },
        data: { uses: { increment: 1 } },
      }),
    ]);

    res.json(member);
  }),
);

export default router;
```

**Step 4: Register routes in index.ts**

```typescript
import inviteRoutes from './routes/invites';
// ...
app.use('/api', inviteRoutes);
```

**Step 5: Add API methods in frontend**

In `frontend/src/lib/api.ts`, add:
```typescript
// Invites
createInvite(serverId: string, options?: { expiresAt?: string; maxUses?: number }) {
  return this.request<any>(`/servers/${serverId}/invites`, {
    method: 'POST', body: JSON.stringify(options ?? {}),
  });
}
resolveInvite(code: string) {
  return this.request<any>(`/invites/${code}`);
}
joinByInvite(code: string) {
  return this.request<any>(`/invites/${code}/join`, { method: 'POST' });
}
```

**Step 6: Commit**

```bash
git add -A && git commit -m "feat: add invite code system with create/resolve/join"
```

---

### Task 6: Invite UI (create invite dialog + join server dialog)

**Files:**
- Create: `frontend/src/components/app/InviteDialog.tsx` (generate and copy invite code)
- Create: `frontend/src/components/app/JoinServerDialog.tsx` (enter invite code to join)
- Modify: `frontend/src/components/app/ChannelSidebar.tsx` (add "Invite People" button)
- Modify: `frontend/src/components/app/ServerList.tsx` (add "Join Server" option)
- Modify: `frontend/src/stores/uiStore.ts` (add 'invite' and 'joinServer' modals)
- Modify: `frontend/src/components/app/AppLayout.tsx` (render both dialogs)

**Step 1: Add modal types to uiStore**

In `frontend/src/stores/uiStore.ts`, update the Modal type:
```typescript
type Modal = 'createServer' | 'serverSettings' | 'createChannel' | 'userProfile' | 'gameSession' | 'storyViewer' | 'commerce' | 'invite' | 'joinServer' | null;
```

**Step 2: Create InviteDialog**

Shows the generated invite code with a copy button. Uses the Rally neon aesthetic.

**Step 3: Create JoinServerDialog**

Input field for invite code. Shows server preview after resolving. "Join" button to redeem.

**Step 4: Wire into ChannelSidebar and ServerList**

- ChannelSidebar: Add an "Invite" button in the server header area
- ServerList: Change the "Explore" button to open JoinServerDialog, or add a new button

**Step 5: Render in AppLayout**

```tsx
{activeModal === 'invite' && <InviteDialog />}
{activeModal === 'joinServer' && <JoinServerDialog />}
```

**Step 6: Commit**

```bash
git add -A && git commit -m "feat: add invite creation and join server UI"
```

---

### Task 7: Configurable Server URL

**Files:**
- Modify: `frontend/src/lib/api.ts:1` (read base URL from localStorage)
- Modify: `frontend/src/hooks/useSocket.ts:26` (use configurable URL for socket)
- Modify: `frontend/src/pages/LoginPage.tsx` (add server URL input)
- Modify: `frontend/src/pages/RegisterPage.tsx` (add server URL input)

**Step 1: Make API base URL configurable**

In `frontend/src/lib/api.ts`, change line 1:
```typescript
function getApiBase(): string {
  const serverUrl = localStorage.getItem('rally-server-url');
  if (serverUrl) return `${serverUrl.replace(/\/$/, '')}/api`;
  return '/api'; // default: same origin (Vite proxy)
}

const API_BASE = getApiBase();
```

**Step 2: Make Socket.IO URL configurable**

In `frontend/src/hooks/useSocket.ts`, change line 26:
```typescript
const serverUrl = localStorage.getItem('rally-server-url') || window.location.origin;
socket = io(serverUrl, {
```

**Step 3: Add server URL field to LoginPage and RegisterPage**

Add a collapsible "Advanced" section with a text input for server URL. Store in localStorage on change.

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: add configurable server URL for multi-user connectivity"
```

---

### Task 8: Fix 500 error on GET /servers/:id

**Files:**
- Modify: `backend/src/routes/servers.ts` (investigate and fix the 500 error)

**Step 1: Investigate the error**

Start the backend with `npm run dev`, then hit the endpoint directly:
```bash
curl http://localhost:3001/api/servers/<server-id> -H "Authorization: Bearer <token>"
```

The 500 is likely caused by BigInt serialization (permissions field is BigInt, which can't be JSON.stringify'd) or the SQLite migration missing some fields.

**Step 2: Fix BigInt serialization**

In the GET /:serverId route, serialize BigInt permissions to string:
```typescript
const server = await prisma.server.findUnique({...});
// Serialize roles permissions
if (server.roles) {
  server.roles = server.roles.map(r => ({ ...r, permissions: r.permissions.toString() }));
}
```

**Step 3: Commit**

```bash
git add -A && git commit -m "fix: serialize BigInt permissions in GET /servers/:id response"
```

---

### Task 9: Add default Voice channel to new servers

**Files:**
- Modify: `backend/src/routes/servers.ts` (add Voice channel on server creation)

**Step 1: Update server creation**

In the POST / handler, after creating the "General" text channel, also create a "Voice Chat" voice channel:

```typescript
prisma.channel.create({
  data: {
    serverId: server.id,
    name: 'Voice Chat',
    type: 'VOICE',
    position: 1,
  },
}),
```

**Step 2: Commit**

```bash
git add -A && git commit -m "feat: add default Voice Chat channel to new servers"
```

---

## Execution Order

Tasks 1-3 are the voice chat core (must be sequential).
Task 4 (Create Server Modal) is independent.
Tasks 5-6 (Invite System) are sequential but independent of 1-3.
Task 7 (Server URL) is independent.
Task 8 (Fix 500) should be done early as it blocks server navigation.
Task 9 (Default voice channel) is a quick addition.

**Recommended order:** 8 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 9

---
