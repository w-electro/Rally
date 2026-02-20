# Voice Chat UI + Server Tab Management — Design

**Date**: 2026-02-20
**Status**: Approved

## Problem

1. Voice channel UI is empty and lifeless — black void with controls, nothing to look at
2. No way to see who's in a voice channel before joining
3. Server tabs can't be reordered, pinned, or hidden

## 1. Concert Stage Voice UI

### Layout (top to bottom)
- **Header**: "VOICE CONNECTED" + channel name + duration timer (mm:ss)
- **Audio Visualizer**: Canvas-based frequency bars behind participant stage
- **Participant Stage**: Circular avatars arranged in semi-circle arc
- **Activity Strip**: Current game, voice duration, participant count
- **Controls**: Existing Mute/Deafen/Screen/Camera/Disconnect (unchanged)

### Audio Visualizer
- Web Audio API `AnalyserNode` on local mic stream
- 32-48 gradient bars: `#00D9FF` (base) to `#8B00FF` (peaks)
- Smooth animation; subtle idle bounce when quiet
- Bars spike proportionally when someone speaks

### Participant Stage
- Current user: 80px circle, center, cyan ring
- Others: 56px circles, semi-circle arc around center
- Speaking: green glow ring (`#39FF14`) + subtle scale pulse
- Muted: red slash badge on avatar
- Name + optional game activity text below each avatar

### Solo Mode
- Your avatar center-stage, visualizer animates on your mic
- "Waiting for others to join..." with subtle pulse
- Room feels alive even when alone

## 2. Voice Channel Hover Preview

### ChannelBar Integration
- Voice channel pills show participant count badge `(N)` in green when occupied
- On hover (300ms delay): popover appears below the pill
- Popover lists up to 5 participants: avatar circle + name + online dot
- If 0 participants: shows "Empty" in gray text
- If >5 participants: shows "+N more" overflow

## 3. Server Tab Management

### TopNav Drag-to-Reorder
- Drag server tabs left/right to reposition
- Drop indicator shows target position
- Pinned tabs stick to the left

### Right-Click Context Menu
Available on both TopNav tabs and Home Dashboard server cards:
- Pin/Unpin Server
- Hide Server
- Divider
- Notifications (placeholder)
- Server Settings (placeholder)

### Pin Behavior
- Pinned tabs get cyan dot indicator underneath
- Pinned tabs cluster to the left, can't be reordered past other pinned

### Hide Behavior
- Hidden servers disappear from TopNav and Home
- Accessible via "..." overflow button at end of tab row
- Overflow dropdown lists hidden servers with "Show" option

### Home Dashboard
- Pinned servers render first with pin icon badge
- Hidden servers excluded from view
- Same right-click context menu

### Persistence
- `localStorage` key: `rally:server-prefs`
- Shape: `{ order: string[], pinned: string[], hidden: string[] }`
- Keyed by server ID

## Components to Create/Modify

| Component | Action | Description |
|-----------|--------|-------------|
| `AudioVisualizer` | CREATE | Canvas-based frequency bar component |
| `VoiceChannel` | REWRITE | Concert stage layout with visualizer, stage, activity strip |
| `VoiceParticipantStage` | CREATE | Semi-circle participant arrangement |
| `VoiceActivityStrip` | CREATE | Horizontal activity bar |
| `ChannelBar` | MODIFY | Add hover preview + participant count on voice pills |
| `VoiceChannelPreview` | CREATE | Hover popover for voice channels |
| `TopNav` | MODIFY | Add drag-to-reorder + right-click context menu |
| `ServerContextMenu` | CREATE | Right-click menu component |
| `useServerPrefs` hook | CREATE | localStorage read/write for server prefs |
| `HomeDashboard` | MODIFY | Respect pin/hide prefs, add right-click menu |
