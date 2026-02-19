import { useMemo } from 'react';
import { useServerStore } from '@/stores/serverStore';
import { useUIStore } from '@/stores/uiStore';
import { Avatar } from '../ui/Avatar';
import { cn, getStatusColor } from '@/lib/utils';
import type { ServerMember } from '@/lib/types';

export function MemberList() {
  const { members } = useServerStore();
  const { openModal } = useUIStore();

  const grouped = useMemo(() => {
    const online: ServerMember[] = [];
    const offline: ServerMember[] = [];

    members.forEach((m) => {
      if (m.user.status === 'OFFLINE') offline.push(m);
      else online.push(m);
    });

    return { online, offline };
  }, [members]);

  return (
    <div className="w-60 bg-[#0D1117] border-l border-rally-border flex flex-col h-full">
      <div className="p-3 border-b border-rally-border">
        <h3 className="text-xs font-display font-semibold uppercase tracking-wider text-rally-text-muted">
          Members — {members.length}
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-4">
        {/* Online */}
        <div>
          <h4 className="px-2 py-1 text-xs font-display font-semibold uppercase tracking-wider text-rally-green">
            Online — {grouped.online.length}
          </h4>
          {grouped.online.map((m) => (
            <MemberItem key={m.id} member={m} onClick={() => openModal('userProfile', m.user)} />
          ))}
        </div>

        {/* Offline */}
        {grouped.offline.length > 0 && (
          <div>
            <h4 className="px-2 py-1 text-xs font-display font-semibold uppercase tracking-wider text-rally-text-muted">
              Offline — {grouped.offline.length}
            </h4>
            {grouped.offline.map((m) => (
              <MemberItem key={m.id} member={m} onClick={() => openModal('userProfile', m.user)} dimmed />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MemberItem({ member, onClick, dimmed }: { member: ServerMember; onClick: () => void; dimmed?: boolean }) {
  const roleColor = member.roles?.[0]?.role?.color || '#E6EDF3';

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/5 transition-colors text-left group',
        dimmed && 'opacity-40'
      )}
    >
      <Avatar
        name={member.user.displayName}
        src={member.user.avatarUrl}
        size="sm"
        status={member.user.status}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: roleColor }}>
          {member.nickname || member.user.displayName}
        </p>
        {member.user.customStatus && (
          <p className="text-xs text-rally-text-muted truncate">{member.user.customStatus}</p>
        )}
        {member.user.currentGame && (
          <p className="text-xs text-rally-blue truncate">Playing {member.user.currentGame}</p>
        )}
      </div>
      {member.user.isStreaming && (
        <span className="w-2 h-2 rounded-full bg-rally-purple animate-pulse" />
      )}
    </button>
  );
}
