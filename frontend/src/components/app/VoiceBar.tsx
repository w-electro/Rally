import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useVoiceStore } from '@/stores/voiceStore';
import { useServerStore } from '@/stores/serverStore';
import { useSocket } from '@/hooks/useSocket';
import { ScreenSharePicker } from '@/components/voice/ScreenSharePicker';
import {
  Mic,
  MicOff,
  Headphones,
  HeadphoneOff,
  PhoneOff,
  Signal,
  Monitor,
  MonitorOff,
} from 'lucide-react';
import { cn, getInitials } from '@/lib/utils';

const MAX_VISIBLE_AVATARS = 4;

export function VoiceBar() {
  const { t } = useTranslation();
  const { channelId, isMuted, isDeafened, isScreenSharing, participants, toggleMute, toggleDeafen } =
    useVoiceStore();
  const { activeServer } = useServerStore();
  const { leaveVoice, startScreenShare, stopScreenShare } = useSocket();
  const [showScreenPicker, setShowScreenPicker] = useState(false);

  if (!channelId) return null;

  const channel = activeServer?.channels?.find((c) => c.id === channelId);
  const visibleParticipants = participants.slice(0, MAX_VISIBLE_AVATARS);
  const overflowCount = Math.max(0, participants.length - MAX_VISIBLE_AVATARS);

  const handleDisconnect = () => {
    leaveVoice();
  };

  const handleScreenShare = () => {
    if (isScreenSharing) {
      stopScreenShare();
    } else {
      setShowScreenPicker(true);
    }
  };

  return (
    <div className="h-12 shrink-0 flex items-center justify-between px-4 bg-[#0A0E27] border-t border-white/5">
      {/* Left: connection info */}
      <div className="flex items-center gap-3 min-w-0">
        <Signal className="w-4 h-4 text-rally-green shrink-0" />
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-semibold text-rally-green whitespace-nowrap">
            {t('voice.voiceConnected')}
          </span>
          <span className="text-xs text-white/40 whitespace-nowrap truncate">
            {channel?.name || t('voice.voiceChannel')}
            {activeServer?.name ? ` / ${activeServer.name}` : ''}
          </span>
        </div>
      </div>

      {/* Center: participant avatars */}
      <div className="flex items-center gap-1">
        {visibleParticipants.map((p) => (
          <div
            key={p.userId}
            className={cn(
              'w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 border-2 border-[#0A0E27]',
              p.isSpeaking
                ? 'ring-2 ring-rally-green ring-offset-1 ring-offset-[#0A0E27]'
                : ''
            )}
            style={
              p.avatarUrl
                ? { backgroundImage: `url(${p.avatarUrl})`, backgroundSize: 'cover' }
                : {
                    background: 'linear-gradient(135deg, #00D9FF, #8B00FF)',
                  }
            }
            title={p.displayName || p.username}
          >
            {!p.avatarUrl && (
              <span className="text-white">
                {getInitials(p.displayName || p.username)}
              </span>
            )}
          </div>
        ))}
        {overflowCount > 0 && (
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold text-white/60 bg-white/10 shrink-0 border-2 border-[#0A0E27]">
            +{overflowCount}
          </div>
        )}
      </div>

      {/* Right: controls */}
      <div className="flex items-center gap-1">
        {/* Mute */}
        <button
          onClick={toggleMute}
          className={cn(
            'w-8 h-8 flex items-center justify-center rounded transition-colors',
            isMuted
              ? 'bg-rally-magenta/20 text-rally-magenta hover:bg-rally-magenta/30'
              : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
          )}
          title={isMuted ? t('voice.unmute') : t('voice.mute')}
        >
          {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>

        {/* Deafen */}
        <button
          onClick={toggleDeafen}
          className={cn(
            'w-8 h-8 flex items-center justify-center rounded transition-colors',
            isDeafened
              ? 'bg-rally-magenta/20 text-rally-magenta hover:bg-rally-magenta/30'
              : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
          )}
          title={isDeafened ? t('voice.undeafen') : t('voice.deafen')}
        >
          {isDeafened ? (
            <HeadphoneOff className="w-4 h-4" />
          ) : (
            <Headphones className="w-4 h-4" />
          )}
        </button>

        {/* Screen Share */}
        <button
          onClick={handleScreenShare}
          className={cn(
            'w-8 h-8 flex items-center justify-center rounded transition-colors',
            isScreenSharing
              ? 'bg-rally-green/20 text-rally-green hover:bg-rally-green/30'
              : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
          )}
          title={isScreenSharing ? t('voice.stopSharing') : t('voice.shareScreen')}
        >
          {isScreenSharing ? (
            <MonitorOff className="w-4 h-4" />
          ) : (
            <Monitor className="w-4 h-4" />
          )}
        </button>

        {/* Disconnect */}
        <button
          onClick={handleDisconnect}
          className="w-8 h-8 flex items-center justify-center rounded bg-rally-magenta/20 text-rally-magenta hover:bg-rally-magenta/30 transition-colors ml-1"
          title={t('voice.disconnect')}
        >
          <PhoneOff className="w-4 h-4" />
        </button>
      </div>

      {showScreenPicker && (
        <ScreenSharePicker
          onSelect={(sourceId, withAudio) => {
            setShowScreenPicker(false);
            startScreenShare(sourceId, withAudio);
          }}
          onCancel={() => setShowScreenPicker(false)}
        />
      )}
    </div>
  );
}
