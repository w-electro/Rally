# Server Redesign, Profiles & Screen Share Fix — Design Doc

**Goal:** Redesign the server view to have its own identity (not Discord-like), add minimal user profile popups, and fix screen sharing.

**Architecture:** Horizontal channel bar replaces sidebar, bubble-style chat replaces flat messages, compact gamer cards in member list, minimal profile popup on user click, and screen share WebRTC fix.

**Tech Stack:** React, TypeScript, Zustand, Tailwind CSS, SimplePeer (WebRTC), Socket.IO

---

## 1. TopNav Changes

- Remove "Rally HQ" (the default/seeded server) from the server tabs — it is only accessible from the Home Dashboard.
- User-created servers remain as horizontal tabs in the TopNav.
- No other structural changes to TopNav.

## 2. Channel Bar (replaces Channel Sidebar)

- **Removes** the 240px left sidebar (`ChannelSidebar.tsx`).
- **Adds** a horizontal scrollable channel bar below the TopNav.
- Channels displayed as pill/tab items with type icons:
  - `#` for TEXT channels
  - Speaker icon for VOICE channels
  - Camera icon for FEED channels
  - Megaphone icon for ANNOUNCEMENT channels
- Active channel has a cyan underline (matching TopNav's active server style).
- Scroll arrows appear when channels overflow.
- The server dropdown (invite, settings, create channel) moves to a gear/settings icon in the channel bar.
- The user panel (avatar, mute, deafen, settings) is already in the VoiceBar bottom, so no duplication needed.

### Layout

```
TopNav:    [HOME]  [hoa]  [server2]  ...        [+] [DMs] [?]
ChannelBar: # welcome | # general | # screenshots | 🔊 Lobby | 🔊 Gaming | ⚙️
Content:   [Bubble Chat Area]                    [Member List]
VoiceBar:  [Voice Connected · channel / server]  [controls]
```

## 3. Bubble Chat Messages

- **Your messages**: Right-aligned, cyan-tinted background (`bg-[#00D9FF]/10` with `border-[#00D9FF]/20`), rounded bubbles (rounded-2xl with rounded-br-md for own messages).
- **Others' messages**: Left-aligned, dark surface background (`bg-[#1A1F2E]`), rounded bubbles (rounded-2xl with rounded-bl-md).
- **First message in group**: Shows avatar (small, 28px) + display name + timestamp above the bubble.
- **Consecutive messages** (same author within 5 min): Just the bubble, no avatar/name repeat. Tighter spacing.
- **Message actions**: Hover reveals emoji react, reply, more menu — floating above the bubble.
- **Reactions**: Small pills below the bubble.
- **Reply/thread indicator**: Thin connecting line to parent message.
- **Date dividers**: Horizontal line with centered date (unchanged).
- **System messages**: Centered, smaller text, no bubble.

## 4. Member List Redesign

- Keep the right-side panel (w-60).
- Replace flat name list with **compact gamer cards**:
  - Avatar initials (colored circle, 32px)
  - Display name (bold, white)
  - Status dot (green/yellow/red/gray)
  - Current game activity (small text, cyan, e.g., "Playing Valorant")
  - Rank badge placeholder (small colored letter, e.g., "G" for Gold)
- Online members listed first (no explicit "Online — N" header, just sorted).
- Offline members dimmed (opacity-40).
- Click on any member → opens profile popup.

## 5. User Profile Popup

- **Trigger**: Click on a member's name in chat bubbles or member list.
- **Type**: Floating popup card (positioned near the click, not a full panel).
- **Content** (minimal):
  - Avatar (48px) + Display name + Status dot
  - Current game (if any)
  - Two action buttons: [Message] [Add Friend]
- **Styling**: Dark card (`bg-[#0D1117]`), subtle border (`border-white/10`), shadow, rounded-xl.
- **Dismiss**: Click outside or press Escape.
- No banner, no bio, no roles, no join date. Just a clean nameplate.

## 6. Screen Share Fix

### Problem
Screen sharing buttons work (UI opens picker, selection happens) but the actual video stream doesn't display. Two issues:

1. **Browser mode**: `navigator.mediaDevices.getUserMedia()` with `chromeMediaSource: 'desktop'` is Electron-only. In Vite dev server (browser), this fails silently.
2. **WebRTC renegotiation**: SimplePeer's `addTrack()` may not trigger proper renegotiation. Need to use `addStream()` or recreate peers.

### Fix
- **Browser fallback**: Use `navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })` when not in Electron. This is the standard browser API for screen capture.
- **SimplePeer integration**: Replace `peer.addTrack()` with creating a new peer connection that includes the video track, or use SimplePeer's `addStream()` method.
- **Error handling**: Show toast/notification when screen share fails with a user-friendly message.
- **Visual feedback**: Show a "sharing" indicator on the VoiceBar and in the voice channel view when actively sharing.

---

## Components Affected

### New Components
- `ChannelBar.tsx` — Horizontal channel tab bar
- `BubbleMessage.tsx` — Bubble-style message component
- `UserProfilePopup.tsx` — Minimal floating profile card
- `MemberCard.tsx` — Compact gamer card for member list

### Modified Components
- `AppLayout.tsx` — Remove ChannelSidebar, add ChannelBar
- `TopNav.tsx` — Filter out Rally HQ from server tabs
- `ChatArea.tsx` — Use BubbleMessage instead of MessageItem
- `MemberList.tsx` — Use MemberCard instead of flat list
- `VoiceChannel.tsx` — Fix screen share display
- `voicePeerManager.ts` — Fix screen stream WebRTC flow
- `ScreenSharePicker.tsx` — Add getDisplayMedia fallback
- `useSocket.ts` — Fix screen share socket integration

### Removed Components
- `ChannelSidebar.tsx` — Replaced by ChannelBar (horizontal)
