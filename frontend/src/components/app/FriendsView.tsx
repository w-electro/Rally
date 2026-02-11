import { useEffect, useState } from 'react';
import { Users, UserPlus, MessageCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import Avatar from '@/components/ui/Avatar';
import type { Friend } from '@/lib/types';

type Tab = 'online' | 'all' | 'pending' | 'blocked';

export default function FriendsView() {
  const { user } = useAuthStore();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('online');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFriends();
  }, []);

  const loadFriends = async () => {
    setLoading(true);
    try {
      const data = await api.get<Friend[]>('/users/@me/friends');
      setFriends(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'online', label: 'Online' },
    { id: 'all', label: 'All' },
    { id: 'pending', label: 'Pending' },
    { id: 'blocked', label: 'Blocked' },
  ];

  const filteredFriends = friends.filter((f) => {
    switch (activeTab) {
      case 'online':
        return f.status === 'accepted' && f.user.status !== 'offline';
      case 'all':
        return f.status === 'accepted';
      case 'pending':
        return f.status === 'pending_incoming' || f.status === 'pending_outgoing';
      case 'blocked':
        return f.status === 'blocked';
      default:
        return true;
    }
  });

  return (
    <div className="flex-1 flex flex-col bg-rally-darkBg/50 min-w-0">
      {/* Header */}
      <div className="h-12 flex items-center px-4 border-b border-primary gap-4 flex-shrink-0">
        <div className="flex items-center gap-2 text-white font-semibold">
          <Users size={20} />
          <span>Friends</span>
        </div>
        <div className="w-px h-5 bg-primary" />
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-rally-cardBg text-white'
                  : 'text-rally-muted hover:text-white hover:bg-rally-cardBg/40'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button className="ml-auto rally-btn-cyan text-xs px-3 py-1.5">
          <UserPlus size={16} />
          Add Friend
        </button>
      </div>

      {/* Friends list */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="w-8 h-8 border-3 border-rally-cyan border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && filteredFriends.length === 0 && (
          <div className="text-center py-12">
            <Users size={48} className="mx-auto text-rally-dimmed mb-3" />
            <p className="text-rally-muted">
              {activeTab === 'online'
                ? 'No friends are online right now'
                : activeTab === 'pending'
                ? 'No pending friend requests'
                : activeTab === 'blocked'
                ? 'No blocked users'
                : "No friends yet. Add some!"}
            </p>
          </div>
        )}

        <div className="space-y-0.5">
          {filteredFriends.map((friend) => (
            <div
              key={friend.id}
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-rally-cardBg/40 transition-colors group cursor-pointer"
            >
              <Avatar user={friend.user as any} size="md" showStatus />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {friend.user.username}
                </p>
                <p className="text-xs text-rally-dimmed capitalize">
                  {friend.user.status}
                </p>
              </div>
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="p-2 rounded-full bg-rally-cardBg text-rally-muted hover:text-white transition-colors">
                  <MessageCircle size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
