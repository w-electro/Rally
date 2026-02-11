import { useServerStore } from '@/stores/serverStore';
import Avatar from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';

export default function MemberList() {
  const { members, getActiveServer } = useServerStore();
  const server = getActiveServer();

  if (!server) return null;

  // Group members by online/offline status
  const online = members.filter((m) => m.user.status !== 'offline');
  const offline = members.filter((m) => m.user.status === 'offline');

  return (
    <div className="w-60 bg-rally-darkerBg flex-shrink-0 overflow-y-auto py-4">
      {/* Online members */}
      {online.length > 0 && (
        <MemberGroup label={`Online — ${online.length}`} members={online} />
      )}

      {/* Offline members */}
      {offline.length > 0 && (
        <MemberGroup label={`Offline — ${offline.length}`} members={offline} />
      )}
    </div>
  );
}

interface MemberGroupProps {
  label: string;
  members: Array<{
    id: string;
    userId: string;
    user: {
      id: string;
      username: string;
      discriminator?: string;
      avatar?: string;
      status: string;
      customStatus?: string;
    };
    nickname?: string;
    roles: Array<{
      id: string;
      name: string;
      color: string;
      position: number;
    }>;
  }>;
}

function MemberGroup({ label, members }: MemberGroupProps) {
  return (
    <div className="mb-4">
      <h3 className="text-[11px] font-semibold text-rally-dimmed uppercase tracking-wide px-4 mb-1">
        {label}
      </h3>
      {members.map((member) => {
        const topRole = member.roles
          .filter((r) => r.name !== '@everyone')
          .sort((a, b) => b.position - a.position)[0];

        return (
          <button
            key={member.id}
            className="w-full flex items-center gap-3 px-4 py-1.5 hover:bg-rally-cardBg/40 transition-colors rounded-md mx-0 cursor-pointer"
          >
            <Avatar
              user={member.user as any}
              size="sm"
              showStatus
            />
            <div className="flex-1 min-w-0">
              <p
                className={cn('text-sm font-medium truncate')}
                style={topRole?.color ? { color: topRole.color } : undefined}
              >
                {member.nickname || member.user.username}
              </p>
              {member.user.customStatus && (
                <p className="text-[11px] text-rally-dimmed truncate">
                  {member.user.customStatus}
                </p>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
