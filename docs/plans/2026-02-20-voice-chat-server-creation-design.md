# Voice Chat, Server Creation & Invite System Design

**Date:** 2026-02-20
**Status:** Approved

## Context

Rally is a Discord-alternative desktop app (Electron + React + Node.js). The core feature is voice chat. The app currently has voice channel UI, socket events for join/leave/mute, and WebRTC signaling code — but no actual audio flows between users. Additionally, there's no Create Server modal and no invite system for friends.

## Goals

1. Working peer-to-peer voice chat with 6-8 concurrent users
2. Create Server modal so users can make their own servers
3. Invite code system so friends can join private servers
4. Configurable server URL so friends can connect from LAN or internet

## Design

### 1. Voice Chat — P2P Mesh via simple-peer

**Architecture:** Every user in a voice channel creates a direct WebRTC connection to every other user. Audio flows peer-to-peer (no media server).

**Flow:**
1. User clicks voice channel → `voice:join` socket event
2. Backend broadcasts `voice:user_joined` with list of existing participants
3. Each existing participant creates a WebRTC offer to the new user (via `webrtc:offer`)
4. New user answers each offer → peer connections established
5. Audio streams flow directly between browsers
6. On leave, peer connections close and participants are notified

**Implementation:**
- Install `simple-peer` in frontend
- Create `VoicePeerManager` class managing all peer connections for a channel
- On join: get local audio stream (`navigator.mediaDevices.getUserMedia`)
- For each existing participant: create a new `SimplePeer` instance (initiator for existing users, non-initiator for new user)
- Signaling via existing Socket.IO `voice:signal` / `webrtc:offer` / `webrtc:answer` / `webrtc:ice_candidate` events
- Wire up `setupWebRTCSignaling()` in backend/src/index.ts (already written, just not called)
- STUN: Google servers (`stun:stun.l.google.com:19302`)
- No TURN server initially (works on LAN; most home NATs work with STUN)

**Voice Activity Detection:**
- Web Audio API `AnalyserNode` on local microphone stream
- Poll frequency data; if RMS > threshold, set `isSpeaking = true`
- Emit speaking state to channel for UI indicators

**Limits:** Cap at 8 participants per voice channel (mesh becomes expensive beyond that).

### 2. Create Server Modal

**Component:** `CreateServerModal` rendered in AppLayout when `activeModal === 'createServer'`

**Fields:**
- Server name (required, 1-100 chars)
- Description (optional, max 1024 chars)
- Visibility: Public / Private toggle (defaults private)

**On submit:** Call `serverStore.createServer()`, close modal, auto-select new server.

### 3. Invite System

**Database model:**
```prisma
model ServerInvite {
  id        String   @id @default(cuid())
  code      String   @unique
  serverId  String
  server    Server   @relation(fields: [serverId], references: [id], onDelete: Cascade)
  creatorId String
  creator   User     @relation(fields: [creatorId], references: [id])
  expiresAt DateTime?
  maxUses   Int?
  uses      Int      @default(0)
  createdAt DateTime @default(now())
}
```

**Backend routes:**
- `POST /servers/:serverId/invites` — create invite (requires membership), returns `{ code, expiresAt }`
- `GET /invites/:code` — resolve invite to server info (public, no auth needed)
- `POST /invites/:code/join` — redeem invite, add user as member

**Frontend:**
- "Invite People" button in channel sidebar header → generates code, shows copyable link
- "Join Server" button in server list → modal with code input → calls join endpoint

**Invite codes:** 8-character alphanumeric, generated server-side. Default expiry: 7 days. Max uses: unlimited unless specified.

### 4. Configurable Server URL

**Frontend:**
- Login/Register pages get a "Server URL" input (collapsed by default, expandable)
- Default value: `http://localhost:3001`
- Stored in localStorage key `rally-server-url`
- `api.ts` reads this value as base URL on initialization

**Backend:**
- Bind to `0.0.0.0:3001` instead of `localhost` in index.ts
- Update CORS to accept any origin in development

### 5. Fix 500 Error on GET /servers/:id

Investigate and fix the 500 Internal Server Error when loading a server. Likely caused by SQLite/Prisma schema mismatch from the PostgreSQL-to-SQLite migration (BigInt permissions serialization or array field handling).

## Non-Goals

- No SFU/MCU media server (keep P2P for simplicity)
- No video calls (audio only for now)
- No screen sharing audio (just screen share visual if simple-peer supports it later)
- No TURN server (STUN only; works for LAN and most home networks)
- No vanity invite URLs (just codes)

## Dependencies

- `simple-peer` npm package (frontend)
- Existing WebRTC signaling code (backend/src/webrtc/signaling.ts)
- Existing Socket.IO voice events
