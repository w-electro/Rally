import { useMemo } from 'react';
import { useServerStore } from '@/stores/serverStore';
import { useUIStore } from '@/stores/uiStore';
import { cn, getInitials, getStatusColor } from '@/lib/utils';
import type { ServerMember } from '@/lib/types';

export function MemberList() {
  const { members } = useServerStore();
  const { openModal } = useUIStore();

  const sorted = useMemo(() => {
    const online: ServerMember[] = [];
    const offline: ServerMember[] = [];
    members.forEach((m) => {
      if (m.user.status === 'OFFLINE') offline.push(m);
      else online.push(m);
    });
    return [...online, ...offline];
  }, [members]);

  const onlineCount = sorted.filter((m) => m.user.status !== 'OFFLINE').length;

  return (
    <div className="w-60 bg-[#0D1117] border-l border-white/5 flex flex-col h-full">
      <div className="p-3 border-b border-white/5">
        <h3 className="text-xs font-display font-semibold uppercase tracking-wider text-white/40">
          Members — {onlineCount} online
        </h3>
      </div>
      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
        {sorted.map((m) => (
          <MemberCard
            key={m.id}
            member={m}
            dimmed={m.user.status === 'OFFLINE'}
            onClick={() => openModal('userProfile', m.user)}
          />
        ))}
      </div>
    </div>
  );
}

function MemberCard({ member, dimmed, onClick }: { member: ServerMember; dimmed?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-white/5 transition-colors text-left',
        dimmed && 'opacity-40',
      )}
    >
      <div className="relative shrink-0">
        <div className="w-8 h-8 rounded-full overflow-hidden bg-[#1A1F36] flex items-center justify-center text-xs font-bold text-white/70">
          {member.user.avatarUrl ? (
            <img src={member.user.avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            getInitials(member.user.displayName)
          )}
        </div>
        <div
          className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#0D1117]"
          style={{ backgroundColor: getStatusColor(member.user.status ?? 'OFFLINE') }}
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate leading-tight">
          {member.nickname || member.user.displayName}
        </p>
        {member.user.currentGame && (
          <p className="text-[11px] text-[#00D9FF] truncate leading-tight">
            Playing {member.user.currentGame}
          </p>
        )}
        {!member.user.currentGame && member.user.customStatus && (
          <p className="text-[11px] text-white/30 truncate leading-tight">
            {member.user.customStatus}
          </p>
        )}
      </div>
    </button>
  );
}
