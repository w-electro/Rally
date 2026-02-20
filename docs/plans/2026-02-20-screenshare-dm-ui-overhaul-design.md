# Rally Phase 2: Screen Sharing, DM Chat & UI Overhaul

**Date**: 2026-02-20
**Status**: Approved

## 1. UI Overhaul — Top Nav + Hub Layout

### Problem
Current layout is a Discord clone (vertical server icon sidebar on left). User feedback: "everything looks the same" and "navigation feels old."

### New Layout

**Top Navigation Bar** (replaces left server icon sidebar):
- Horizontal bar below the titlebar
- Server icons displayed as tabs across the top (scrollable if many)
- Home/Dashboard tab on the far left (Rally logo)
- DMs tab, Explore tab on the right side
- Active server highlighted with neon underline

**Dashboard Home** (new view when Home tab is selected):
- Grid of server cards showing: icon, name, member count, last activity
- "Quick Actions" row: Create Server, Join Server, Browse
- Friends online sidebar widget
- Recent activity feed

**Persistent Voice Bar**:
- Fixed at the bottom of the screen (full width)
- Shows: channel name, server name, participants, mute/deafen/disconnect buttons
- Visible from any view (not just when inside a server)

**Channel Sidebar**:
- Remains on the left when a server is selected (same as now but narrower context)
- Server name + dropdown at top
- Channel list below

**Overall flow**:
```
[Titlebar]
[Top Nav: Home | Server1 | Server2 | ... | DMs | Explore]
[Channel Sidebar | Main Content | Optional Right Panel]
[Voice Bar (persistent)]
```

### Component Changes
- **Remove**: `ServerList` vertical sidebar (72px left column)
- **Create**: `TopNav` horizontal server tab bar
- **Create**: `Dashboard` home view with server cards grid
- **Modify**: `AppLayout` to use new layout structure
- **Modify**: `VoiceBar` to be full-width bottom bar

## 2. Screen Sharing

### Approach
- P2P via existing SimplePeer connections (add video track alongside audio)
- Electron `desktopCapturer` for screen/window source picker
- 1-2 concurrent viewers (mesh topology, same as voice)

### Flow
1. User clicks "Share Screen" button in voice bar or voice channel
2. Electron `desktopCapturer.getSources()` returns available screens + windows with thumbnails
3. User picks a source from a modal picker
4. `getDisplayMedia` / `getUserMedia` with the selected sourceId captures the stream
5. Video track added to all existing peer connections
6. Viewers see the stream in the main content area (replaces channel view)
7. User clicks "Stop Sharing" to remove the video track

### Components
- **Create**: `ScreenSharePicker` modal — grid of screen/window thumbnails
- **Create**: `ScreenShareView` — displays incoming screen share stream
- **Modify**: `VoicePeerManager` — add video track management (addTrack/removeTrack)
- **Modify**: `VoiceBar` — add Share Screen button
- **Modify**: `VoiceChannel` — show screen share viewer when active

### Socket Events
- `screen:start` — notify peers that a user started sharing
- `screen:stop` — notify peers that a user stopped sharing
- Video tracks flow over existing WebRTC peer connections (no new signaling needed)

## 3. DM Chat View

### Approach
Backend already has DM support (DirectMessage model, socket events for `dm:send`, `dm:history`). Just need the frontend component.

### Components
- **Create**: `DmChatView` — message list + input for a selected DM conversation
- **Modify**: `DmSidebar` — make conversation items clickable, track selected DM
- **Modify**: `AppLayout` — render `DmChatView` when a DM conversation is selected

### Data Flow
- Click on DM conversation in sidebar → store `activeDmUserId`
- Load history via `dm:history` socket event
- Send messages via `dm:send` socket event
- Listen for incoming `dm:receive` events

## Execution Strategy

Build all three features together. The UI overhaul is the foundation — screen sharing and DM chat slot into the new layout.

Order of implementation:
1. UI overhaul (TopNav, Dashboard, new AppLayout, VoiceBar repositioning)
2. DM Chat View (slots into new layout)
3. Screen Sharing (builds on voice infrastructure + new layout)
4. Integration testing + .exe rebuild
