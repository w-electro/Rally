import { useVoiceStore } from '@/stores/voiceStore';
import { useServerStore } from '@/stores/serverStore';
import { useSocket } from '@/hooks/useSocket';
import { Mic, MicOff, Headphones, HeadphoneOff, PhoneOff, Signal } from 'lucide-react';
import { cn } from '@/lib/utils';

export function VoiceBar() {
  const { channelId, isMuted, isDeafened, toggleMute, toggleDeafen, leaveChannel: leaveVoiceStore } = useVoiceStore();
  const { activeServer } = useServerStore();
  const { leaveVoice } = useSocket();

  if (!channelId) return null;

  const channel = activeServer?.channels?.find((c) => c.id === channelId);

  const handleDisconnect = () => {
    leaveVoice(channelId);
    leaveVoiceStore();
  };

  return (
    <div className="bg-[#0D1117] border-t border-rally-border p-3">
      {/* Connection info */}
      <div className="flex items-center gap-2 mb-2">
        <Signal className="w-4 h-4 text-rally-green" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-rally-green">Voice Connected</p>
          <p className="text-xs text-rally-text-muted truncate">
            {channel?.name || 'Voice Channel'} / {activeServer?.name}
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-1">
        <button
          onClick={toggleMute}
          className={cn(
            'flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-xs font-medium transition-colors',
            isMuted
              ? 'bg-rally-magenta/20 text-rally-magenta'
              : 'bg-white/5 text-rally-text hover:bg-white/10'
          )}
        >
          {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
          {isMuted ? 'Muted' : 'Mute'}
        </button>

        <button
          onClick={toggleDeafen}
          className={cn(
            'flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-xs font-medium transition-colors',
            isDeafened
              ? 'bg-rally-magenta/20 text-rally-magenta'
              : 'bg-white/5 text-rally-text hover:bg-white/10'
          )}
        >
          {isDeafened ? <HeadphoneOff className="w-3.5 h-3.5" /> : <Headphones className="w-3.5 h-3.5" />}
          {isDeafened ? 'Deaf' : 'Deafen'}
        </button>

        <button
          onClick={handleDisconnect}
          className="flex items-center justify-center p-1.5 rounded bg-rally-magenta/20 text-rally-magenta hover:bg-rally-magenta/30 transition-colors"
        >
          <PhoneOff className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
