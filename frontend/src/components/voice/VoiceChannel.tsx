import React, { useState, useCallback } from 'react';
import {
  Mic,
  MicOff,
  Headphones,
  HeadphoneOff,
  Monitor,
  Camera,
  CameraOff,
  PhoneOff,
  Move,
  Grid,
} from 'lucide-react';
import { useVoiceStore } from '@/stores/voiceStore';
import { useAuthStore } from '@/stores/authStore';
import { useSocket } from '@/hooks/useSocket';
import { cn, getInitials, generateAvatarGradient } from '@/lib/utils';
import { ScreenSharePicker } from './ScreenSharePicker';
import type { VoiceParticipant } from '@/lib/types';

type ViewMode = 'grid' | 'spatial';

interface DragState {
  userId: string;
  startX: number;
  startY: number;
}

export function VoiceChannel() {
  const {
    channelId,
    isMuted,
    isDeafened,
    participants,
    spatialPositions,
    remoteStreams,
    isScreenSharing,
    screenShareStream,
    remoteScreenStream,
    screenShareUserId,
    toggleMute,
    toggleDeafen,
    updateSpatialPosition,
  } = useVoiceStore();
  const user = useAuthStore((s) => s.user);
  const { leaveVoice, startScreenShare, stopScreenShare } = useSocket();

  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [showScreenPicker, setShowScreenPicker] = useState(false);
  const [dragState, setDragState] = useState<DragState | null>(null);

  const handleDisconnect = useCallback(() => {
    leaveVoice();
  }, [leaveVoice]);

  const handleToggleCamera = useCallback(() => {
    setIsCameraOn((prev) => !prev);
  }, []);

  const handleToggleScreenShare = useCallback(() => {
    if (isScreenSharing) {
      stopScreenShare();
    } else {
      setShowScreenPicker(true);
    }
  }, [isScreenSharing, stopScreenShare]);

  const handleScreenShareSelect = useCallback((sourceId: string, withAudio: boolean) => {
    setShowScreenPicker(false);
    startScreenShare(sourceId, withAudio);
  }, [startScreenShare]);

  const handleSpatialMouseDown = useCallback(
    (userId: string, e: React.MouseEvent) => {
      e.preventDefault();
      setDragState({ userId, startX: e.clientX, startY: e.clientY });
    },
    [],
  );

  const handleSpatialMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!dragState) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
      updateSpatialPosition(dragState.userId, { x, y });
    },
    [dragState, updateSpatialPosition],
  );

  const handleSpatialMouseUp = useCallback(() => {
    setDragState(null);
  }, []);

  if (!channelId) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-rally-text-muted text-sm">
          Not connected to a voice channel.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-rally-dark-bg">
      {/* Hidden audio elements for remote streams */}
      {Object.entries(remoteStreams).map(([userId, stream]) => (
        <audio
          key={userId}
          ref={(el) => {
            if (el) el.srcObject = stream;
          }}
          autoPlay
          muted={isDeafened}
        />
      ))}

      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-rally-border/30 px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="font-display text-sm font-bold uppercase tracking-wider text-rally-text">
            Voice Connected
          </span>
          <span className="text-xs text-rally-text-muted">
            {participants.length} participant{participants.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setViewMode('grid')}
            className={cn(
              'rounded p-1.5 transition-colors',
              viewMode === 'grid'
                ? 'bg-[#00D9FF]/20 text-[#00D9FF]'
                : 'text-rally-text-muted hover:text-rally-text',
            )}
            title="Grid view"
          >
            <Grid size={16} />
          </button>
          <button
            onClick={() => setViewMode('spatial')}
            className={cn(
              'rounded p-1.5 transition-colors',
              viewMode === 'spatial'
                ? 'bg-[#00D9FF]/20 text-[#00D9FF]'
                : 'text-rally-text-muted hover:text-rally-text',
            )}
            title="Spatial audio"
          >
            <Move size={16} />
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 overflow-auto p-4">
        {/* Screen share area */}
        {(remoteScreenStream || (isScreenSharing && screenShareStream)) && (
          <div className="mb-4 overflow-hidden rounded-lg border border-[#8B00FF]/40 bg-black">
            <div className="flex items-center gap-2 border-b border-rally-border/30 px-3 py-2">
              <Monitor size={14} className="text-[#39FF14]" />
              <span className="text-xs font-medium text-rally-text">
                {isScreenSharing
                  ? 'You are sharing your screen'
                  : `${participants.find(p => p.userId === screenShareUserId)?.displayName ?? 'Someone'} is sharing`
                }
              </span>
            </div>
            <video
              ref={(el) => {
                if (el) {
                  el.srcObject = remoteScreenStream || screenShareStream;
                }
              }}
              autoPlay
              playsInline
              muted={!!screenShareStream}
              className="w-full"
            />
          </div>
        )}

        {/* Grid view */}
        {viewMode === 'grid' && (
          <div className="grid auto-rows-max grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {participants.map((participant) => (
              <ParticipantCard key={participant.userId} participant={participant} />
            ))}
          </div>
        )}

        {/* Spatial audio view */}
        {viewMode === 'spatial' && (
          <div
            className="relative mx-auto aspect-square max-w-xl overflow-hidden rounded-xl border border-rally-border/30 bg-rally-dark-surface"
            onMouseMove={handleSpatialMouseMove}
            onMouseUp={handleSpatialMouseUp}
            onMouseLeave={handleSpatialMouseUp}
          >
            {/* Grid overlay */}
            <div className="absolute inset-0 opacity-10">
              <div
                className="h-full w-full"
                style={{
                  backgroundImage:
                    'linear-gradient(rgba(0,217,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(0,217,255,0.3) 1px, transparent 1px)',
                  backgroundSize: '40px 40px',
                }}
              />
            </div>
            {/* Center indicator */}
            <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#00D9FF]/40 bg-[#00D9FF]/10" />

            {participants.map((participant) => {
              const pos = spatialPositions[participant.userId] || {
                x: 0.5 + (Math.random() - 0.5) * 0.4,
                y: 0.5 + (Math.random() - 0.5) * 0.4,
              };
              return (
                <div
                  key={participant.userId}
                  className={cn(
                    'absolute flex -translate-x-1/2 -translate-y-1/2 cursor-grab flex-col items-center gap-1 transition-shadow',
                    dragState?.userId === participant.userId && 'cursor-grabbing',
                  )}
                  style={{ left: `${pos.x * 100}%`, top: `${pos.y * 100}%` }}
                  onMouseDown={(e) => handleSpatialMouseDown(participant.userId, e)}
                >
                  <div
                    className={cn(
                      'flex h-10 w-10 items-center justify-center overflow-hidden rounded-full text-xs font-bold',
                      participant.isSpeaking &&
                        'ring-2 ring-[#39FF14] shadow-[0_0_12px_rgba(57,255,20,0.5)]',
                    )}
                    style={{
                      background: participant.avatarUrl
                        ? undefined
                        : generateAvatarGradient(participant.displayName),
                    }}
                  >
                    {participant.avatarUrl ? (
                      <img
                        src={participant.avatarUrl}
                        alt={participant.displayName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-white">
                        {getInitials(participant.displayName)}
                      </span>
                    )}
                  </div>
                  <span className="max-w-[80px] truncate rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-rally-text">
                    {participant.displayName}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom controls bar */}
      <div className="flex items-center justify-center gap-2 border-t border-rally-border/30 bg-rally-dark-surface px-4 py-3">
        <ControlButton
          active={isMuted}
          activeColor="text-[#FF006E]"
          icon={isMuted ? MicOff : Mic}
          label={isMuted ? 'Unmute' : 'Mute'}
          onClick={toggleMute}
        />
        <ControlButton
          active={isDeafened}
          activeColor="text-[#FF006E]"
          icon={isDeafened ? HeadphoneOff : Headphones}
          label={isDeafened ? 'Undeafen' : 'Deafen'}
          onClick={toggleDeafen}
        />
        <ControlButton
          active={isScreenSharing}
          activeColor="text-[#39FF14]"
          icon={Monitor}
          label="Screen Share"
          onClick={handleToggleScreenShare}
        />
        <ControlButton
          active={isCameraOn}
          activeColor="text-[#39FF14]"
          icon={isCameraOn ? Camera : CameraOff}
          label={isCameraOn ? 'Camera Off' : 'Camera On'}
          onClick={handleToggleCamera}
        />
        <button
          onClick={handleDisconnect}
          className="flex items-center gap-2 rounded-lg bg-[#FF006E]/20 px-4 py-2 text-[#FF006E] transition-colors hover:bg-[#FF006E]/30"
          title="Disconnect"
        >
          <PhoneOff size={18} />
          <span className="text-sm font-medium">Disconnect</span>
        </button>
      </div>

      {showScreenPicker && (
        <ScreenSharePicker
          onSelect={handleScreenShareSelect}
          onCancel={() => setShowScreenPicker(false)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                      */
/* ------------------------------------------------------------------ */

function ParticipantCard({ participant }: { participant: VoiceParticipant }) {
  return (
    <div
      className={cn(
        'relative flex flex-col items-center gap-2 rounded-xl border bg-rally-dark-surface p-4 transition-all',
        participant.isSpeaking
          ? 'border-[#39FF14]/60 shadow-[0_0_18px_rgba(57,255,20,0.25)]'
          : 'border-rally-border/20',
      )}
    >
      {/* Speaking pulse animation */}
      {participant.isSpeaking && (
        <div className="absolute inset-0 animate-pulse rounded-xl border border-[#39FF14]/30" />
      )}

      {/* Avatar */}
      <div className="relative">
        <div
          className={cn(
            'flex h-14 w-14 items-center justify-center overflow-hidden rounded-full text-sm font-bold transition-shadow',
            participant.isSpeaking &&
              'ring-2 ring-[#39FF14] shadow-[0_0_16px_rgba(57,255,20,0.4)]',
          )}
          style={{
            background: participant.avatarUrl
              ? undefined
              : generateAvatarGradient(participant.displayName),
          }}
        >
          {participant.avatarUrl ? (
            <img
              src={participant.avatarUrl}
              alt={participant.displayName}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-white">
              {getInitials(participant.displayName)}
            </span>
          )}
        </div>

        {/* Mute / deafen badge */}
        {(participant.isMuted || participant.isDeafened) && (
          <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-rally-dark-bg">
            {participant.isDeafened ? (
              <HeadphoneOff size={10} className="text-[#FF006E]" />
            ) : (
              <MicOff size={10} className="text-[#FF006E]" />
            )}
          </div>
        )}
      </div>

      {/* Name */}
      <span className="max-w-full truncate text-xs font-medium text-rally-text">
        {participant.displayName}
      </span>

      {/* Streaming badge */}
      {participant.isStreaming && (
        <span className="rounded-full bg-[#8B00FF]/20 px-2 py-0.5 text-[10px] font-semibold uppercase text-[#8B00FF]">
          Live
        </span>
      )}
    </div>
  );
}

function ControlButton({
  active,
  activeColor,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  activeColor: string;
  icon: React.ElementType;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
        active
          ? `bg-rally-dark-bg/60 ${activeColor}`
          : 'bg-rally-dark-bg/40 text-rally-text-muted hover:bg-rally-dark-bg/80 hover:text-rally-text',
      )}
      title={label}
    >
      <Icon size={18} />
    </button>
  );
}
