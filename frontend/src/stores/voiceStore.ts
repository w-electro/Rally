import { create } from 'zustand';
import type { VoiceParticipant, VoiceState } from '../lib/types';

interface VoiceStoreState extends VoiceState {
  _localUserId: string | null;
  _mutedBeforeDeafen: boolean;
  participants: VoiceParticipant[];
  spatialPositions: Record<string, { x: number; y: number }>;
  remoteStreams: Record<string, MediaStream>;
  screenShareUserId: string | null;
  screenShareStream: MediaStream | null;
  remoteScreenStream: MediaStream | null;
  isScreenSharing: boolean;

  joinChannel: (channelId: string, localUserId?: string) => void;
  leaveChannel: () => void;
  toggleMute: () => void;
  toggleDeafen: () => void;
  setSpeaking: (speaking: boolean) => void;
  setParticipants: (participants: VoiceParticipant[]) => void;
  addParticipant: (participant: VoiceParticipant) => void;
  removeParticipant: (userId: string) => void;
  updateParticipant: (userId: string, data: Partial<VoiceParticipant>) => void;
  updateSpatialPosition: (userId: string, position: { x: number; y: number }) => void;
  setRemoteStream: (userId: string, stream: MediaStream) => void;
  removeRemoteStream: (userId: string) => void;
  startScreenShare: (stream: MediaStream) => void;
  stopScreenShare: () => void;
  setRemoteScreenShare: (userId: string, stream: MediaStream) => void;
  clearRemoteScreenShare: () => void;
  setScreenShareUser: (userId: string | null) => void;
}

export const useVoiceStore = create<VoiceStoreState>((set) => ({
  channelId: null,
  _localUserId: null,
  _mutedBeforeDeafen: false,
  isMuted: false,
  isDeafened: false,
  isSpeaking: false,
  participants: [],
  spatialPositions: {},
  remoteStreams: {},
  screenShareUserId: null,
  screenShareStream: null,
  remoteScreenStream: null,
  isScreenSharing: false,

  joinChannel: (channelId, localUserId) => set({ channelId, isMuted: false, isDeafened: false, _localUserId: localUserId ?? null }),
  leaveChannel: () =>
    set((s) => {
      // Stop all remote stream tracks to prevent leaks
      Object.values(s.remoteStreams).forEach((stream) =>
        stream.getTracks().forEach((t) => t.stop()),
      );
      if (s.screenShareStream) s.screenShareStream.getTracks().forEach((t) => t.stop());
      if (s.remoteScreenStream) s.remoteScreenStream.getTracks().forEach((t) => t.stop());
      return {
        channelId: null,
        _localUserId: null,
        _mutedBeforeDeafen: false,
        participants: [],
        spatialPositions: {},
        remoteStreams: {},
        screenShareUserId: null,
        screenShareStream: null,
        remoteScreenStream: null,
        isScreenSharing: false,
      };
    }),

  toggleMute: () =>
    set((s) => {
      const newMuted = !s.isMuted;
      return {
        isMuted: newMuted,
        participants: s.participants.map((p) =>
          p.userId === s._localUserId ? { ...p, isMuted: newMuted } : p,
        ),
      };
    }),
  toggleDeafen: () =>
    set((s) => {
      const newDeafened = !s.isDeafened;
      // When deafening: save current mute state, force mute on
      // When undeafening: restore the saved mute state
      const newMuted = newDeafened ? true : s._mutedBeforeDeafen;
      return {
        isDeafened: newDeafened,
        isMuted: newMuted,
        _mutedBeforeDeafen: newDeafened ? s.isMuted : s._mutedBeforeDeafen,
        participants: s.participants.map((p) =>
          p.userId === s._localUserId
            ? { ...p, isDeafened: newDeafened, isMuted: newMuted }
            : p,
        ),
      };
    }),
  setSpeaking: (isSpeaking) => set({ isSpeaking }),

  setParticipants: (participants) => set({ participants }),
  addParticipant: (participant) =>
    set((s) => ({
      participants: s.participants.some((p) => p.userId === participant.userId)
        ? s.participants
        : [...s.participants, participant],
    })),
  removeParticipant: (userId) =>
    set((s) => ({
      participants: s.participants.filter((p) => p.userId !== userId),
    })),
  updateParticipant: (userId, data) =>
    set((s) => ({
      participants: s.participants.map((p) =>
        p.userId === userId ? { ...p, ...data } : p
      ),
    })),
  updateSpatialPosition: (userId, position) =>
    set((s) => ({
      spatialPositions: { ...s.spatialPositions, [userId]: position },
    })),
  setRemoteStream: (userId, stream) =>
    set((s) => ({
      remoteStreams: { ...s.remoteStreams, [userId]: stream },
    })),
  removeRemoteStream: (userId) =>
    set((s) => {
      const stream = s.remoteStreams[userId];
      if (stream) stream.getTracks().forEach((t) => t.stop());
      const { [userId]: _, ...rest } = s.remoteStreams;
      return { remoteStreams: rest };
    }),
  startScreenShare: (stream) => set({
    isScreenSharing: true,
    screenShareStream: stream,
  }),
  stopScreenShare: () =>
    set((s) => {
      if (s.screenShareStream) s.screenShareStream.getTracks().forEach((t) => t.stop());
      return { isScreenSharing: false, screenShareStream: null };
    }),
  setRemoteScreenShare: (userId, stream) => set({
    screenShareUserId: userId,
    remoteScreenStream: stream,
  }),
  clearRemoteScreenShare: () => set({
    screenShareUserId: null,
    remoteScreenStream: null,
  }),
  setScreenShareUser: (userId) => set({ screenShareUserId: userId }),
}));
