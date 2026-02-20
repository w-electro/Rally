import { MicOff, HeadphoneOff } from 'lucide-react';
import { cn, getInitials, generateAvatarGradient } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import type { VoiceParticipant } from '@/lib/types';

/* ------------------------------------------------------------------ */
/* StageAvatar                                                         */
/* ------------------------------------------------------------------ */

interface StageAvatarProps {
  participant: VoiceParticipant;
  size: 'lg' | 'sm';
}

function StageAvatar({ participant, size }: StageAvatarProps) {
  const px = size === 'lg' ? 80 : 56;
  const textSize = size === 'lg' ? 'text-xl' : 'text-sm';
  const badgeIconSize = 12;

  return (
    <div className="flex flex-col items-center gap-1.5">
      {/* Avatar circle */}
      <div className="relative">
        <div
          className={cn(
            'flex items-center justify-center overflow-hidden rounded-full font-bold transition-all duration-300',
            textSize,
            participant.isSpeaking && [
              'ring-2 ring-[#39FF14]',
              'scale-105',
            ],
          )}
          style={{
            width: px,
            height: px,
            background: participant.avatarUrl
              ? undefined
              : generateAvatarGradient(participant.displayName),
            boxShadow: participant.isSpeaking
              ? '0 0 20px rgba(57,255,20,0.3), 0 0 40px rgba(57,255,20,0.15)'
              : undefined,
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

        {/* Speaking pulse ring */}
        {participant.isSpeaking && (
          <div
            className="absolute inset-0 animate-ping rounded-full border-2 border-[#39FF14]/40"
            style={{ animationDuration: '1.5s' }}
          />
        )}

        {/* Mute / deafen badge */}
        {(participant.isMuted || participant.isDeafened) && (
          <div
            className="absolute bottom-0 right-0 flex items-center justify-center rounded-full bg-[#0A0E27] border border-[#FF006E]/40"
            style={{ width: 20, height: 20 }}
          >
            {participant.isDeafened ? (
              <HeadphoneOff size={badgeIconSize} className="text-[#FF006E]" />
            ) : (
              <MicOff size={badgeIconSize} className="text-[#FF006E]" />
            )}
          </div>
        )}
      </div>

      {/* Name label */}
      <span className="max-w-[90px] truncate text-xs font-medium text-rally-text">
        {participant.displayName}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* VoiceParticipantStage                                               */
/* ------------------------------------------------------------------ */

interface VoiceParticipantStageProps {
  participants: VoiceParticipant[];
}

export function VoiceParticipantStage({ participants }: VoiceParticipantStageProps) {
  const user = useAuthStore((s) => s.user);

  // Separate current user from others
  const currentParticipant = participants.find((p) => p.userId === user?.id);
  const others = participants.filter((p) => p.userId !== user?.id);

  // Arc math: distribute others in a semi-circle arc above center
  // Arc spans from -60 degrees to +60 degrees (where 0 = straight up / north)
  // We work in math angles: 0 deg = right, so "straight up" = 90 deg
  const ARC_START_DEG = -60;
  const ARC_END_DEG = 60;
  const RADIUS = 130;

  function getArcPosition(index: number, total: number): { x: number; y: number } {
    let angleDeg: number;
    if (total === 1) {
      angleDeg = 0; // straight up
    } else {
      // Evenly distribute across the arc
      angleDeg = ARC_START_DEG + (ARC_END_DEG - ARC_START_DEG) * (index / (total - 1));
    }

    // Convert to radians. 0 deg = straight up (north), positive = clockwise.
    // In screen coords: x increases right, y increases down.
    // "straight up" means negative y offset.
    const angleRad = (angleDeg * Math.PI) / 180;
    const x = RADIUS * Math.sin(angleRad);
    const y = -RADIUS * Math.cos(angleRad);

    return { x, y };
  }

  const isAlone = others.length === 0;

  return (
    <div
      className="relative flex min-h-[280px] items-center justify-center"
      style={{ minHeight: 280 }}
    >
      {/* Center: current user avatar */}
      {currentParticipant && (
        <div className="relative z-10 flex flex-col items-center">
          <StageAvatar participant={currentParticipant} size="lg" />

          {/* "Waiting for others" message */}
          {isAlone && (
            <p className="mt-4 animate-pulse text-xs text-rally-text-muted">
              Waiting for others to join...
            </p>
          )}
        </div>
      )}

      {/* Arc: other participants positioned around center */}
      {others.map((participant, index) => {
        const { x, y } = getArcPosition(index, others.length);
        return (
          <div
            key={participant.userId}
            className="absolute z-10 transition-all duration-500"
            style={{
              transform: `translate(${x}px, ${y}px)`,
              // Position relative to the center of the container
              left: '50%',
              top: '50%',
              marginLeft: -28, // half of sm avatar (56/2)
              marginTop: -28,
            }}
          >
            <StageAvatar participant={participant} size="sm" />
          </div>
        );
      })}
    </div>
  );
}
