import { cn, getInitials, generateAvatarGradient } from '@/lib/utils';
import { useVoiceStore } from '@/stores/voiceStore';

interface VoiceChannelPreviewProps {
  channelId: string;
}

export function VoiceChannelPreview({ channelId }: VoiceChannelPreviewProps) {
  const participants = useVoiceStore((s) => s.participants);
  const voiceChannelId = useVoiceStore((s) => s.channelId);

  const isActive = voiceChannelId === channelId;
  const visibleParticipants = isActive ? participants.slice(0, 5) : [];
  const extraCount = isActive ? Math.max(0, participants.length - 5) : 0;

  return (
    <div className="absolute top-full left-0 mt-1 z-50 min-w-[160px] rounded-lg border border-white/10 bg-[#0A0E27] p-2 shadow-xl">
      {!isActive || participants.length === 0 ? (
        <span className="text-xs text-white/40">Empty</span>
      ) : (
        <div className="flex flex-col gap-1.5">
          {visibleParticipants.map((participant) => (
            <div key={participant.userId} className="flex items-center gap-2">
              <div
                className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center"
                style={{ background: generateAvatarGradient(participant.userId) }}
              >
                <span className="text-[8px] font-bold text-white leading-none">
                  {getInitials(participant.displayName)}
                </span>
              </div>
              <span className="text-xs text-white/70 truncate flex-1">
                {participant.displayName}
              </span>
              <div className="h-1.5 w-1.5 rounded-full bg-[#39FF14] shrink-0" />
            </div>
          ))}
          {extraCount > 0 && (
            <span className="text-xs text-white/40 pl-7">+{extraCount} more</span>
          )}
        </div>
      )}
    </div>
  );
}
