import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Search,
  Users,
  X,
  PenSquare,
  MessageCircle,
  Inbox,
  UserPlus,
  Check,
  XCircle,
  ArrowLeft,
  Loader2,
  UserMinus,
  Link,
  Copy,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { useServerStore } from '@/stores/serverStore';
import { useSocket, getSocket } from '@/hooks/useSocket';
import api from '@/lib/api';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToastStore } from '@/stores/toastStore';
import { cn, getInitials, getStatusColor, formatDate } from '@/lib/utils';
import type { DmConversation } from '@/lib/types';

type SidebarView = 'conversations' | 'friends';
type FriendsTab = 'all' | 'pending' | 'add';

// Module-level caches (persist across mount/unmount for instant navigation)
let _cachedConversations: DmConversation[] | null = null;
let _cachedFriends: Friend[] | null = null;
let _cachedPending: { sent: FriendRequest[]; received: FriendRequest[] } | null = null;

/** Clear all DM sidebar caches — call on logout */
export function clearDmSidebarCaches() {
  _cachedConversations = null;
  _cachedFriends = null;
  _cachedPending = null;
}

interface Friend {
  friendshipId: string;
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
    status?: string;
  };
}

interface FriendRequest {
  id: string;
  requesterId: string;
  targetId: string;
  requester: { id: string; username: string; displayName: string; avatarUrl?: string };
  target: { id: string; username: string; displayName: string; avatarUrl?: string };
  createdAt: string;
}

export function DmSidebar() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const activeConversationId = useUIStore((s) => s.activeDmConversationId);
  const setActiveDmConversation = useUIStore((s) => s.setActiveDmConversation);
  const { socket } = useSocket();
  const servers = useServerStore((s) => s.servers);
  const [conversations, setConversations] = useState<DmConversation[]>(_cachedConversations ?? []);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [sidebarView, setSidebarView] = useState<SidebarView>('conversations');

  // Friends state
  const [friendsTab, setFriendsTab] = useState<FriendsTab>('all');
  const [friends, setFriends] = useState<Friend[]>(_cachedFriends ?? []);
  const [pendingRequests, setPendingRequests] = useState<{ sent: FriendRequest[]; received: FriendRequest[] }>(_cachedPending ?? { sent: [], received: [] });
  const [addFriendQuery, setAddFriendQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [friendActionLoading, setFriendActionLoading] = useState<string | null>(null);
  const [inviteDropdownUser, setInviteDropdownUser] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [friendMessage, setFriendMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    api.getDmConversations()
      .then((data: any) => {
        const list = Array.isArray(data) ? data : data?.conversations ?? [];
        _cachedConversations = list;
        setConversations(list);
      })
      .catch((err) => console.error('Failed to load DM conversations:', err));
  }, []);

  // Pre-load friends data on mount (so it's cached when clicking Friends)
  useEffect(() => {
    loadFriends();
    loadFriendRequests();
  }, []);

  // Also refresh when switching to friends view
  useEffect(() => {
    if (sidebarView !== 'friends') return;
    loadFriends();
    loadFriendRequests();
  }, [sidebarView]);

  // Real-time friend request updates via socket
  useEffect(() => {
    const s = getSocket();
    if (!s) return;
    const handleFriendRequest = () => {
      loadFriendRequests();
      useToastStore.getState().addToast('info', 'New friend request received');
    };
    const handleFriendAccepted = () => {
      loadFriends();
      loadFriendRequests();
    };
    s.on('friend:request', handleFriendRequest);
    s.on('friend:accepted', handleFriendAccepted);
    return () => {
      s.off('friend:request', handleFriendRequest);
      s.off('friend:accepted', handleFriendAccepted);
    };
  }, []);

  const loadFriends = async () => {
    try {
      const data = await api.getFriends();
      const list = data?.friends ?? [];
      _cachedFriends = list;
      setFriends(list);
    } catch (err) {
      console.error('Failed to load friends:', err);
    }
  };

  const loadFriendRequests = async () => {
    try {
      const data = await api.getFriendRequests();
      const pending = {
        sent: data?.sent ?? [],
        received: data?.received ?? [],
      };
      _cachedPending = pending;
      setPendingRequests(pending);
    } catch (err) {
      console.error('Failed to load friend requests:', err);
    }
  };

  const handleSendFriendRequest = async (targetId: string) => {
    setFriendActionLoading(targetId);
    setFriendMessage(null);
    try {
      await api.sendFriendRequest(targetId);
      setFriendMessage({ type: 'success', text: t('dm.friendRequestSent') });
      setSearchResults((prev) => prev.filter((u) => u.id !== targetId));
      loadFriendRequests();
    } catch (err: any) {
      setFriendMessage({ type: 'error', text: err.message || t('dm.failedSendRequest') });
    }
    setFriendActionLoading(null);
  };

  const handleAcceptRequest = async (requestId: string) => {
    setFriendActionLoading(requestId);
    try {
      await api.acceptFriendRequest(requestId);
      loadFriends();
      loadFriendRequests();
    } catch (err: any) {
      useToastStore.getState().addToast('error', err?.message || 'Failed to accept request');
    }
    setFriendActionLoading(null);
  };

  const handleDeclineRequest = async (requestId: string) => {
    setFriendActionLoading(requestId);
    try {
      await api.declineFriendRequest(requestId);
      loadFriendRequests();
    } catch (err: any) {
      useToastStore.getState().addToast('error', err?.message || 'Failed to decline request');
    }
    setFriendActionLoading(null);
  };

  const handleRemoveFriend = async (friendshipId: string) => {
    setFriendActionLoading(friendshipId);
    try {
      await api.removeFriend(friendshipId);
      setFriends((prev) => prev.filter((f) => f.friendshipId !== friendshipId));
      useToastStore.getState().addToast('success', 'Friend removed');
    } catch (err: any) {
      useToastStore.getState().addToast('error', err?.message || 'Failed to remove friend');
    }
    setFriendActionLoading(null);
    setConfirmRemove(null);
  };

  const handleSearchUsers = async () => {
    if (!addFriendQuery.trim() || addFriendQuery.trim().length < 2) return;
    setIsSearching(true);
    setFriendMessage(null);
    try {
      const data = await api.searchUsers(addFriendQuery.trim());
      setSearchResults(data?.users ?? []);
      if ((data?.users ?? []).length === 0) {
        setFriendMessage({ type: 'error', text: t('dm.noUsersFound') });
      }
    } catch {
      setFriendMessage({ type: 'error', text: t('dm.searchFailed') });
    }
    setIsSearching(false);
  };

  const handleStartDm = async (targetUserId: string) => {
    try {
      const conv = await api.createDmConversation(targetUserId);
      const convId = conv?.id ?? conv?.conversation?.id;
      if (convId) {
        setSidebarView('conversations');
        setActiveDmConversation(convId);
        // Refresh conversations
        const data: any = await api.getDmConversations();
        setConversations(Array.isArray(data) ? data : data?.conversations ?? []);
      }
    } catch (err: any) {
      useToastStore.getState().addToast('error', err?.message || 'Failed to start conversation');
    }
  };

  const handleInviteToServer = async (serverId: string) => {
    setFriendActionLoading(serverId);
    try {
      const data = await api.createInvite(serverId);
      const code = data?.code ?? data?.invite?.code;
      if (code) {
        setInviteCode(code);
        await navigator.clipboard.writeText(code);
        setFriendMessage({ type: 'success', text: t('dm.inviteCopied') });
      }
    } catch {
      setFriendMessage({ type: 'error', text: t('dm.inviteFailed') });
    }
    setFriendActionLoading(null);
    setInviteDropdownUser(null);
  };

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

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'ONLINE': return t('common.online');
      case 'IDLE': return t('common.idle');
      case 'DND': return t('common.dnd');
      case 'IN_GAME': return t('common.inGame');
      case 'STREAMING': return t('common.streaming');
      default: return t('common.offline');
    }
  };

  const pendingCount = pendingRequests.received.length;

  // ─── Friends View ─────────────────────────────────────────────
  if (sidebarView === 'friends') {
    return (
      <div className="h-full flex flex-col bg-[#0D1117]">
        {/* Header */}
        <div className="px-3 py-3 border-b border-white/5 flex items-center gap-2">
          <button
            onClick={() => setSidebarView('conversations')}
            className="p-1.5 rounded-md text-white/40 hover:text-white hover:bg-white/10 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h2 className="font-display text-sm font-bold uppercase tracking-wider text-white/70">
            {t('dm.friends')}
          </h2>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/5">
          {([
            { id: 'all' as FriendsTab, label: t('dm.all') },
            { id: 'pending' as FriendsTab, label: t('dm.pending'), badge: pendingCount },
            { id: 'add' as FriendsTab, label: t('dm.add') },
          ]).map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setFriendsTab(tab.id); setFriendMessage(null); }}
              className={cn(
                'flex-1 py-2 text-xs font-display font-semibold uppercase tracking-wider transition-colors relative',
                friendsTab === tab.id
                  ? 'text-rally-blue border-b-2 border-rally-blue'
                  : 'text-white/40 hover:text-white/60'
              )}
            >
              {tab.label}
              {tab.badge ? (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-rally-magenta/20 text-rally-magenta text-[10px]">
                  {tab.badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {/* Message banner */}
          {friendMessage && (
            <div className={cn(
              'mx-1 mb-2 px-3 py-2 rounded text-xs',
              friendMessage.type === 'success'
                ? 'bg-rally-green/10 text-rally-green border border-rally-green/20'
                : 'bg-rally-magenta/10 text-rally-magenta border border-rally-magenta/20'
            )}>
              {friendMessage.text}
            </div>
          )}

          {/* All Friends */}
          {friendsTab === 'all' && (
            friends.length === 0 ? (
              <div className="text-center py-12 px-4">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-rally-cyan/10 border border-rally-cyan/20">
                  <Users className="w-8 h-8 text-rally-cyan/50" />
                </div>
                <p className="text-white/60 text-sm font-medium font-body">{t('dm.noFriends')}</p>
                <p className="text-white/50 text-xs mt-1 font-body">{t('dm.addFriends')}</p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {friends.map((f) => {
                  const isOnline = f.user.status && f.user.status !== 'OFFLINE';
                  return (
                    <div
                      key={f.friendshipId}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/[0.04] transition-colors group"
                    >
                      <div className="relative shrink-0">
                        <div className="w-9 h-9 rounded-full overflow-hidden bg-[#1A1F36] flex items-center justify-center">
                          {f.user.avatarUrl ? (
                            <img src={f.user.avatarUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-xs font-bold text-white/60">{getInitials(f.user.displayName)}</span>
                          )}
                        </div>
                        <div
                          className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#0D1117]"
                          style={{ backgroundColor: getStatusColor(f.user.status || 'OFFLINE') }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white/80 truncate">{f.user.displayName}</p>
                        <p className="text-[10px] text-white/50">@{f.user.username}</p>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleStartDm(f.user.id)}
                          className="p-1.5 rounded text-white/40 hover:text-rally-blue hover:bg-rally-blue/10 transition-colors"
                          title="Message"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                        </button>
                        <div className="relative">
                          <button
                            onClick={() => setInviteDropdownUser(inviteDropdownUser === f.user.id ? null : f.user.id)}
                            className="p-1.5 rounded text-white/40 hover:text-rally-green hover:bg-rally-green/10 transition-colors"
                            title={t('dm.inviteToServer')}
                          >
                            <Link className="w-3.5 h-3.5" />
                          </button>
                          {inviteDropdownUser === f.user.id && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setInviteDropdownUser(null)} />
                              <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-lg border border-white/10 bg-[#1A1F36] py-1 shadow-elevation-3">
                                <p className="px-3 py-1 text-[10px] font-display font-semibold uppercase tracking-wider text-white/50">
                                  {t('dm.selectServer')}
                                </p>
                                {servers.map((s) => (
                                  <button
                                    key={s.id}
                                    onClick={() => handleInviteToServer(s.id)}
                                    disabled={friendActionLoading === s.id}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-white/70 hover:bg-white/10 hover:text-white transition-colors"
                                  >
                                    {s.iconUrl ? (
                                      <img src={s.iconUrl} alt="" className="w-5 h-5 rounded-full" />
                                    ) : (
                                      <div className="w-5 h-5 rounded-full bg-rally-blue/20 flex items-center justify-center text-[10px] font-bold text-rally-blue">
                                        {s.name?.[0]}
                                      </div>
                                    )}
                                    <span className="truncate">{s.name}</span>
                                  </button>
                                ))}
                                {servers.length === 0 && (
                                  <p className="px-3 py-2 text-xs text-white/30">{t('dm.noServers')}</p>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                        <button
                          onClick={() => setConfirmRemove({ id: f.friendshipId, name: f.user.displayName })}
                          className="p-1.5 rounded text-white/40 hover:text-rally-magenta hover:bg-rally-magenta/10 transition-colors"
                          title="Remove Friend"
                          disabled={friendActionLoading === f.friendshipId}
                        >
                          {friendActionLoading === f.friendshipId ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <UserMinus className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}

          {/* Pending Requests */}
          {friendsTab === 'pending' && (
            <>
              {pendingRequests.received.length > 0 && (
                <>
                  <p className="px-3 py-1 text-[10px] font-display font-semibold uppercase tracking-wider text-white/50">
                    {t('dm.received')} — {pendingRequests.received.length}
                  </p>
                  {pendingRequests.received.map((req) => (
                    <div key={req.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/[0.04]">
                      <div className="w-9 h-9 rounded-full overflow-hidden bg-[#1A1F36] flex items-center justify-center shrink-0">
                        {req.requester.avatarUrl ? (
                          <img src={req.requester.avatarUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xs font-bold text-white/60">{getInitials(req.requester.displayName)}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white/80 truncate">{req.requester.displayName}</p>
                        <p className="text-[10px] text-white/50">@{req.requester.username}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleAcceptRequest(req.id)}
                          disabled={friendActionLoading === req.id}
                          className="p-1.5 rounded bg-rally-green/10 text-rally-green hover:bg-rally-green/20 transition-colors"
                          title="Accept"
                        >
                          {friendActionLoading === req.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => handleDeclineRequest(req.id)}
                          disabled={friendActionLoading === req.id}
                          className="p-1.5 rounded bg-rally-magenta/10 text-rally-magenta hover:bg-rally-magenta/20 transition-colors"
                          title="Decline"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {pendingRequests.sent.length > 0 && (
                <>
                  <p className="px-3 py-1 mt-2 text-[10px] font-display font-semibold uppercase tracking-wider text-white/50">
                    {t('dm.sent')} — {pendingRequests.sent.length}
                  </p>
                  {pendingRequests.sent.map((req) => (
                    <div key={req.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg">
                      <div className="w-9 h-9 rounded-full overflow-hidden bg-[#1A1F36] flex items-center justify-center shrink-0">
                        {req.target.avatarUrl ? (
                          <img src={req.target.avatarUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xs font-bold text-white/60">{getInitials(req.target.displayName)}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white/80 truncate">{req.target.displayName}</p>
                        <p className="text-[10px] text-white/50">{t('dm.pendingStatus')}</p>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {pendingRequests.received.length === 0 && pendingRequests.sent.length === 0 && (
                <div className="text-center py-12 px-4">
                  <Inbox className="w-10 h-10 text-white/10 mx-auto mb-3" />
                  <p className="text-white/50 text-sm">{t('dm.noPendingRequests')}</p>
                </div>
              )}
            </>
          )}

          {/* Add Friend */}
          {friendsTab === 'add' && (
            <div className="px-1">
              <p className="text-xs text-white/40 mb-3">
                Search by username or display name to add friends.
              </p>
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  placeholder={t('dm.enterUsername')}
                  value={addFriendQuery}
                  onChange={(e) => setAddFriendQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchUsers()}
                  className="flex-1 input-rally rounded text-sm py-2"
                  autoFocus
                />
                <button
                  onClick={handleSearchUsers}
                  disabled={isSearching || addFriendQuery.trim().length < 2}
                  className="btn-rally-primary px-3 py-2 text-xs shrink-0"
                >
                  {isSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                </button>
              </div>

              {searchResults.length > 0 && (
                <div className="space-y-0.5">
                  {searchResults.map((u) => (
                    <div key={u.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/[0.04]">
                      <div className="w-9 h-9 rounded-full overflow-hidden bg-[#1A1F36] flex items-center justify-center shrink-0">
                        {u.avatarUrl ? (
                          <img src={u.avatarUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xs font-bold text-white/60">{getInitials(u.displayName)}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white/80 truncate">{u.displayName}</p>
                        <p className="text-[10px] text-white/50">@{u.username}</p>
                      </div>
                      <button
                        onClick={() => handleSendFriendRequest(u.id)}
                        disabled={friendActionLoading === u.id}
                        className="p-1.5 rounded bg-rally-green/10 text-rally-green hover:bg-rally-green/20 transition-colors"
                        title="Send Friend Request"
                      >
                        {friendActionLoading === u.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <UserPlus className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Conversations View (default) ─────────────────────────────
  return (
    <div className="h-full flex flex-col bg-[#0D1117]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
        <h2 className="font-display text-sm font-bold uppercase tracking-wider text-white/70">
          {t('dm.messages')}
        </h2>
        <button
          className="p-1.5 rounded-md text-white/40 hover:text-rally-blue hover:bg-rally-blue/10 transition-colors"
          title={t('dm.newMessage')}
        >
          <PenSquare className="w-4 h-4" />
        </button>
      </div>

      {/* Search Bar */}
      <div className="px-3 py-2">
        <div
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-lg bg-[#080B18] border transition-colors',
            isSearchFocused
              ? 'border-rally-blue/30 shadow-[0_0_8px_rgba(0,217,255,0.1)]'
              : 'border-white/5'
          )}
        >
          <Search className="w-4 h-4 text-white/30 shrink-0" />
          <input
            type="text"
            placeholder={t('dm.searchConversations')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            className="flex-1 bg-transparent text-sm text-white placeholder-white/30 outline-none font-body"
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
      <div className="px-2 py-1">
        <button
          onClick={() => setSidebarView('friends')}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/50 hover:text-white hover:bg-white/5 transition-colors"
        >
          <Users className="w-5 h-5" />
          <span className="text-sm font-body font-medium">{t('dm.friends')}</span>
          {pendingCount > 0 && (
            <span className="ml-auto px-1.5 py-0.5 rounded-full bg-rally-magenta/20 text-rally-magenta text-[10px] font-bold">
              {pendingCount}
            </span>
          )}
        </button>
      </div>

      {/* Section Header */}
      <div className="px-4 pt-3 pb-1.5 flex items-center justify-between">
        <span className="text-[11px] font-display font-semibold uppercase tracking-wider text-white/50">
          {t('dm.directMessages')}
        </span>
        <span className="text-[10px] text-white/20 font-body">
          {filteredConversations.length}
        </span>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 px-2 space-y-0.5 pb-2">
        {/* Empty State */}
        {filteredConversations.length === 0 && (
          <div className="text-center py-12 px-4">
            {searchQuery ? (
              <>
                <Search className="w-8 h-8 text-white/10 mx-auto mb-3" />
                <p className="text-white/50 text-sm font-body">{t('dm.noConversations')}</p>
                <p className="text-white/15 text-xs mt-1 font-body">
                  {t('dm.tryDifferent')}
                </p>
              </>
            ) : (
              <>
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-rally-purple/10 border border-rally-purple/20">
                  <Inbox className="w-8 h-8 text-rally-purple/50" />
                </div>
                <p className="text-white/60 text-sm font-body font-medium">
                  {t('dm.noConversationsYet')}
                </p>
                <p className="text-white/50 text-xs mt-1.5 font-body leading-relaxed">
                  {t('dm.startConversation')}
                </p>
              </>
            )}
          </div>
        )}

        {filteredConversations.map((conv) => {
          const name = getConversationName(conv);
          const avatarUser = getConversationAvatar(conv);
          const isActive = activeConversationId === conv.id;
          const lastMsg = conv.lastMessage;
          const isOnline = avatarUser?.status && avatarUser.status !== 'OFFLINE';
          const hasUnread = lastMsg && lastMsg.senderId !== user?.id && !lastMsg.isRead;

          return (
            <button
              key={conv.id}
              onClick={() => {
                setActiveDmConversation(conv.id);
                socket?.emit('dm:join', conv.id);
              }}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group relative',
                isActive
                  ? 'bg-rally-blue/10 text-white border border-rally-blue/20'
                  : 'text-white/60 hover:text-white hover:bg-white/[0.04] border border-transparent',
                hasUnread && !isActive && 'bg-white/[0.02]'
              )}
            >
              {/* Unread indicator bar */}
              {hasUnread && !isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-rally-blue" />
              )}

              {/* Avatar */}
              <div className="relative shrink-0">
                <div className={cn(
                  'w-10 h-10 rounded-full overflow-hidden flex items-center justify-center',
                  isActive ? 'ring-2 ring-rally-blue/30' : ''
                )}
                style={{
                  backgroundColor: '#1A1F36',
                }}
                >
                  {avatarUser?.avatarUrl ? (
                    <img
                      src={avatarUser.avatarUrl}
                      alt={name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-sm font-bold text-white/60">
                      {conv.isGroup ? (
                        <Users className="w-5 h-5 text-white/30" />
                      ) : (
                        getInitials(name)
                      )}
                    </div>
                  )}
                </div>
                {/* Online status dot */}
                {avatarUser && (
                  <div
                    className={cn(
                      'absolute -bottom-0.5 -right-0.5 rounded-full border-[2.5px] border-[#0D1117]',
                      isOnline ? 'w-3.5 h-3.5' : 'w-3 h-3'
                    )}
                    style={{
                      backgroundColor: getStatusColor(avatarUser.status),
                    }}
                    title={getStatusLabel(avatarUser.status)}
                  />
                )}
              </div>

              {/* Name and last message */}
              <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center justify-between gap-2">
                  <span className={cn(
                    'text-sm truncate',
                    hasUnread ? 'font-semibold text-white' : 'font-medium',
                    isActive && 'text-white'
                  )}>
                    {name}
                  </span>
                  {lastMsg && (
                    <span className={cn(
                      'text-[10px] shrink-0',
                      hasUnread ? 'text-rally-blue' : 'text-white/20'
                    )}>
                      {formatDate(lastMsg.createdAt)}
                    </span>
                  )}
                </div>
                {lastMsg ? (
                  <p className={cn(
                    'text-xs truncate mt-0.5',
                    hasUnread ? 'text-white/50' : 'text-white/25'
                  )}>
                    {lastMsg.senderId === user?.id && (
                      <span className="text-white/15">{t('dm.you')}</span>
                    )}
                    {lastMsg.content}
                  </p>
                ) : (
                  <p className="text-xs text-white/15 mt-0.5 italic">
                    {t('dm.noMessages')}
                  </p>
                )}
              </div>

              {/* Unread badge */}
              {hasUnread && !isActive && (
                <div className="shrink-0 w-2 h-2 rounded-full bg-rally-blue" />
              )}
            </button>
          );
        })}
      </div>

      {/* Confirm remove friend dialog */}
      <ConfirmDialog
        isOpen={!!confirmRemove}
        title="Remove Friend"
        message={`Are you sure you want to remove ${confirmRemove?.name ?? 'this person'} from your friends?`}
        confirmLabel="Remove"
        danger
        onConfirm={() => confirmRemove && handleRemoveFriend(confirmRemove.id)}
        onCancel={() => setConfirmRemove(null)}
      />
    </div>
  );
}
