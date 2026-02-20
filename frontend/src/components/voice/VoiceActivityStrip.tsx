import { useState, useEffect } from 'react';
import { Clock, Users, Gamepad2 } from 'lucide-react';
import type { VoiceParticipant } from '@/lib/types';

interface VoiceActivityStripProps {
  participants: VoiceParticipant[];
  channelName: string;
}

export function VoiceActivityStrip({ participants, channelName }: VoiceActivityStripProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    setElapsed(0);
  }, [channelName]);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [channelName]);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const duration = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return (
    <div className="flex items-center justify-center gap-6 border-t border-white/5 bg-[#0A0E27]/50 px-4 py-2">
      {/* Duration */}
      <div className="flex items-center gap-1.5 text-xs text-white/50">
        <Clock className="h-3.5 w-3.5 text-[#00D9FF]/60" />
        <span className="tabular-nums font-medium">{duration}</span>
      </div>

      {/* Divider */}
      <div className="h-3 w-px bg-white/10" />

      {/* Participant count */}
      <div className="flex items-center gap-1.5 text-xs text-white/50">
        <Users className="h-3.5 w-3.5 text-[#39FF14]/60" />
        <span className="font-medium">{participants.length} participants</span>
      </div>

      {/* Divider */}
      <div className="h-3 w-px bg-white/10" />

      {/* Channel name */}
      <div className="flex items-center gap-1.5 text-xs text-white/50">
        <Gamepad2 className="h-3.5 w-3.5 text-[#8B00FF]/60" />
        <span className="font-medium">{channelName}</span>
      </div>
    </div>
  );
}
