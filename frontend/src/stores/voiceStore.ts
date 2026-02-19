import { create } from 'zustand';
import type { VoiceParticipant, VoiceState } from '../lib/types';

interface VoiceStoreState extends VoiceState {
  participants: VoiceParticipant[];
  spatialPositions: Record<string, { x: number; y: number }>;
  remoteStreams: Record<string, MediaStream>;

  joinChannel: (channelId: string) => void;
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
}

export const useVoiceStore = create<VoiceStoreState>((set) => ({
  channelId: null,
  isMuted: false,
  isDeafened: false,
  isSpeaking: false,
  participants: [],
  spatialPositions: {},
  remoteStreams: {},

  joinChannel: (channelId) => set({ channelId, isMuted: false, isDeafened: false }),
  leaveChannel: () => set({ channelId: null, participants: [], spatialPositions: {}, remoteStreams: {} }),

  toggleMute: () => set((s) => ({ isMuted: !s.isMuted })),
  toggleDeafen: () =>
    set((s) => ({
      isDeafened: !s.isDeafened,
      isMuted: !s.isDeafened ? true : s.isMuted,
    })),
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
      const { [userId]: _, ...rest } = s.remoteStreams;
      return { remoteStreams: rest };
    }),
}));
