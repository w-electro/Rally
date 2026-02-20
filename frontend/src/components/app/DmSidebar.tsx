import { useState, useEffect } from 'react';
import {
  Search,
  Users,
  X,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { useSocket } from '@/hooks/useSocket';
import api from '@/lib/api';
import { cn, getInitials, getStatusColor, formatDate } from '@/lib/utils';
import type { DmConversation } from '@/lib/types';

export function DmSidebar() {
  const user = useAuthStore((s) => s.user);
  const activeConversationId = useUIStore((s) => s.activeDmConversationId);
  const setActiveDmConversation = useUIStore((s) => s.setActiveDmConversation);
  const { socket } = useSocket();
  const [conversations, setConversations] = useState<DmConversation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  useEffect(() => {
    api.getDmConversations()
      .then((data: any) => {
        const list = Array.isArray(data) ? data : data?.conversations ?? [];
        setConversations(list);
      })
      .catch(() => {});
  }, []);

  // Backend returns members as user objects directly (not wrapped in { user: ... })
  const getMember = (m: any) => (m?.user ? m.user : m);

  const filteredConversations = conversations.filter((conv) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    if (conv.name && conv.name.toLowerCase().includes(query)) return true;
    return conv.members.some((m: any) => {
      const member = getMember(m);
      return (
        member.id !== user?.id &&
        (member.displayName?.toLowerCase().includes(query) ||
          member.username?.toLowerCase().includes(query))
      );
    });
  });

  const getConversationName = (conv: DmConversation): string => {
    if (conv.name) return conv.name;
    const otherMembers = conv.members
      .filter((m: any) => getMember(m).id !== user?.id)
      .map((m: any) => getMember(m).displayName);
    return otherMembers.join(', ') || 'Unknown';
  };

  const getConversationAvatar = (conv: DmConversation) => {
    if (conv.isGroup) return null;
    const other = conv.members.find((m: any) => getMember(m).id !== user?.id);
    return other ? getMember(other) : null;
  };

  return (
    <div className="h-full flex flex-col bg-[#0D1117]">
      {/* Search Bar */}
      <div className="p-3 border-b border-white/5">
        <div
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#080B18] border transition-colors',
            isSearchFocused
              ? 'border-[#00D9FF]/30'
              : 'border-white/5'
          )}
        >
          <Search className="w-4 h-4 text-white/30 shrink-0" />
          <input
            type="text"
            placeholder="Find or start a conversation"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            className="flex-1 bg-transparent text-sm text-white placeholder-white/30 outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-white/30 hover:text-white/60"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Friends Button */}
      <div className="px-2 py-2">
        <button className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-white/60 hover:text-white hover:bg-white/5 transition-colors">
          <Users className="w-5 h-5" />
          <span className="text-sm font-medium">Friends</span>
        </button>
      </div>

      {/* Section Header */}
      <div className="px-4 py-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
          Direct Messages
        </span>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 px-2 space-y-0.5">
        {filteredConversations.length === 0 && (
          <div className="text-center py-8">
            <p className="text-white/30 text-sm">
              {searchQuery ? 'No conversations found' : 'No conversations yet'}
            </p>
          </div>
        )}

        {filteredConversations.map((conv) => {
          const name = getConversationName(conv);
          const avatarUser = getConversationAvatar(conv);
          const isActive = activeConversationId === conv.id;
          const lastMsg = conv.lastMessage;

          return (
            <button
              key={conv.id}
              onClick={() => {
                setActiveDmConversation(conv.id);
                socket?.emit('dm:join', conv.id);
              }}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors group',
                isActive
                  ? 'bg-white/10 text-white'
                  : 'text-white/60 hover:text-white/80 hover:bg-white/5'
              )}
            >
              {/* Avatar */}
              <div className="relative shrink-0">
                <div className="w-8 h-8 rounded-full overflow-hidden bg-[#1A1F36]">
                  {avatarUser?.avatarUrl ? (
                    <img
                      src={avatarUser.avatarUrl}
                      alt={name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-white/70">
                      {conv.isGroup ? (
                        <Users className="w-4 h-4 text-white/40" />
                      ) : (
                        getInitials(name)
                      )}
                    </div>
                  )}
                </div>
                {/* Online status indicator */}
                {avatarUser && (
                  <div
                    className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#0D1117]"
                    style={{
                      backgroundColor: getStatusColor(avatarUser.status),
                    }}
                  />
                )}
              </div>

              {/* Name and last message */}
              <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium truncate">{name}</span>
                  {lastMsg && (
                    <span className="text-[10px] text-white/20 shrink-0 ml-1">
                      {formatDate(lastMsg.createdAt)}
                    </span>
                  )}
                </div>
                {lastMsg && (
                  <p className="text-xs text-white/30 truncate mt-0.5">
                    {lastMsg.content}
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
