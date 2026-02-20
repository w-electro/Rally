import React, { useState, useCallback, useEffect } from 'react';
import {
  Mic,
  MicOff,
  Headphones,
  HeadphoneOff,
  Monitor,
  Camera,
  CameraOff,
  PhoneOff,
} from 'lucide-react';
import { useVoiceStore } from '@/stores/voiceStore';
import { useAuthStore } from '@/stores/authStore';
import { useServerStore } from '@/stores/serverStore';
import { useSocket } from '@/hooks/useSocket';
import { cn } from '@/lib/utils';
import { ScreenSharePicker } from './ScreenSharePicker';
import { AudioVisualizer } from '@/components/voice/AudioVisualizer';
import { VoiceParticipantStage } from '@/components/voice/VoiceParticipantStage';
import { VoiceActivityStrip } from '@/components/voice/VoiceActivityStrip';

export function VoiceChannel() {
  const {
    channelId,
    isMuted,
    isDeafened,
    participants,
    remoteStreams,
    isScreenSharing,
    screenShareStream,
    remoteScreenStream,
    screenShareUserId,
    toggleMute,
    toggleDeafen,
  } = useVoiceStore();
  const user = useAuthStore((s) => s.user);
  const activeChannel = useServerStore((s) => s.activeChannel);
  const { leaveVoice, startScreenShare, stopScreenShare } = useSocket();

  const [isCameraOn, setIsCameraOn] = useState(false);
  const [showScreenPicker, setShowScreenPicker] = useState(false);
  const [localMicStream, setLocalMicStream] = useState<MediaStream | null>(null);

  const channelName = activeChannel?.name ?? 'Voice Chat';

  // Acquire microphone stream for the AudioVisualizer
  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        setLocalMicStream(s);
      })
      .catch(() => {
        // Microphone unavailable — visualizer will use idle animation
      });

    return () => {
      cancelled = true;
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
      setLocalMicStream(null);
    };
  }, [channelId]);

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

  const handleScreenShareSelect = useCallback(
    (sourceId: string, withAudio: boolean) => {
      setShowScreenPicker(false);
      startScreenShare(sourceId, withAudio);
    },
    [startScreenShare],
  );

  const { joinVoice } = useSocket();

  // Show join screen when viewing a voice channel but not connected
  if (!channelId || channelId !== activeChannel?.id) {
    return (
      <div className="flex-1 w-full flex flex-col items-center justify-center bg-rally-dark-bg gap-6">
        <div className="w-20 h-20 rounded-full bg-[#00D9FF]/10 flex items-center justify-center">
          <Headphones size={36} className="text-[#00D9FF]" />
        </div>
        <div className="text-center">
          <h2 className="font-display text-xl font-bold text-white tracking-wider uppercase">
            {channelName}
          </h2>
          <p className="text-rally-text-muted text-sm mt-1">
            {participants.length > 0
              ? `${participants.length} ${participants.length === 1 ? 'person' : 'people'} connected`
              : 'No one is here yet'}
          </p>
        </div>
        <button
          onClick={() => activeChannel && joinVoice(activeChannel.id)}
          className="flex items-center gap-2 rounded-lg bg-[#39FF14]/20 px-6 py-3 text-[#39FF14] font-semibold transition-colors hover:bg-[#39FF14]/30"
        >
          <Mic size={18} />
          <span>Join Voice</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full flex flex-col bg-rally-dark-bg">
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

      {/* Header: channel name + live indicator */}
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-[#39FF14] animate-pulse" />
          <span className="font-display text-sm font-bold uppercase tracking-wider text-white">
            Voice Connected
          </span>
        </div>
      </div>

      {/* Main stage area */}
      <div className="flex-1 relative overflow-hidden flex items-center justify-center">
        {/* Audio visualizer as background layer */}
        <AudioVisualizer stream={localMicStream} />

        {/* Participant stage on top */}
        <VoiceParticipantStage participants={participants} />
      </div>

      {/* Screen share area (if active) */}
      {(remoteScreenStream || (isScreenSharing && screenShareStream)) && (
        <div className="mx-4 mb-2 overflow-hidden rounded-lg border border-[#8B00FF]/40 bg-black">
          <div className="flex items-center gap-2 border-b border-rally-border/30 px-3 py-2">
            <Monitor size={14} className="text-[#39FF14]" />
            <span className="text-xs font-medium text-rally-text">
              {isScreenSharing
                ? 'You are sharing your screen'
                : `${participants.find((p) => p.userId === screenShareUserId)?.displayName ?? 'Someone'} is sharing`}
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

      {/* Activity strip */}
      <VoiceActivityStrip participants={participants} channelName={channelName} />

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
