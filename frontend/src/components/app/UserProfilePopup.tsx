import { useEffect, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageCircle, UserPlus, X, Check, Loader2 } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { getInitials, getStatusColor } from '@/lib/utils';
import api from '@/lib/api';

export function UserProfilePopup() {
  const { t } = useTranslation();
  const activeModal = useUIStore((s) => s.activeModal);
  const modalData = useUIStore((s) => s.modalData);
  const closeModal = useUIStore((s) => s.closeModal);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') closeModal();
  }, [closeModal]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const [friendLoading, setFriendLoading] = useState(false);
  const [friendSent, setFriendSent] = useState(false);
  const [msgLoading, setMsgLoading] = useState(false);

  const handleAddFriend = useCallback(async (userId: string) => {
    setFriendLoading(true);
    try {
      await api.sendFriendRequest(userId);
      setFriendSent(true);
    } catch (err) {
      console.error('Failed to send friend request:', err);
    }
    setFriendLoading(false);
  }, []);

  const handleMessage = useCallback(async (userId: string) => {
    setMsgLoading(true);
    try {
      const conv = await api.createDmConversation(userId);
      const convId = conv?.id ?? conv?.conversation?.id;
      if (convId) {
        closeModal();
        useUIStore.getState().setView('dms');
        useUIStore.getState().setActiveDmConversation(convId);
      }
    } catch (err) {
      console.error('Failed to start DM:', err);
    }
    setMsgLoading(false);
  }, [closeModal]);

  if (activeModal !== 'userProfile' || !modalData) return null;

  const user = modalData as any;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0" onClick={closeModal} />
      <div className="relative z-10 w-72 rounded-xl border border-white/10 bg-[#0D1117] shadow-2xl overflow-hidden">
        {/* Top gradient bar */}
        <div className="h-16 bg-gradient-to-r from-[#00D9FF]/20 via-[#8B00FF]/20 to-[#FF006E]/20 relative">
          <button
            onClick={closeModal}
            className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full bg-black/40 text-white/60 hover:text-white transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Avatar overlapping gradient */}
        <div className="flex justify-center -mt-8">
          <div className="relative">
            <div className="w-16 h-16 rounded-full overflow-hidden bg-[#1A1F36] border-4 border-[#0D1117] flex items-center justify-center text-lg font-bold text-white/70">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                getInitials(user.displayName ?? 'User')
              )}
            </div>
            <div
              className="absolute bottom-0 right-0 w-4 h-4 rounded-full"
              style={{
                backgroundColor: getStatusColor(user.status ?? 'OFFLINE'),
                borderWidth: '3px',
                borderColor: '#0D1117',
                borderStyle: 'solid',
              }}
            />
          </div>
        </div>

        {/* Info */}
        <div className="text-center px-4 pt-2 pb-3">
          <h3 className="text-base font-bold text-white">{user.displayName ?? 'User'}</h3>
          <p className="text-xs text-white/30">@{user.username ?? 'unknown'}</p>
          {user.currentGame && (
            <p className="text-xs text-[#00D9FF] mt-1">{t('profile.playing', { game: user.currentGame })}</p>
          )}
          {!user.currentGame && user.customStatus && (
            <p className="text-xs text-white/40 mt-1">{user.customStatus}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 px-4 pb-4">
          <button
            onClick={() => handleMessage(user.id)}
            disabled={msgLoading}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[#00D9FF]/10 border border-[#00D9FF]/20 text-[#00D9FF] text-xs font-medium hover:bg-[#00D9FF]/20 transition-colors disabled:opacity-50"
          >
            {msgLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageCircle className="w-3.5 h-3.5" />}
            {t('profile.message')}
          </button>
          <button
            onClick={() => handleAddFriend(user.id)}
            disabled={friendLoading || friendSent}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[#39FF14]/10 border border-[#39FF14]/20 text-[#39FF14] text-xs font-medium hover:bg-[#39FF14]/20 transition-colors disabled:opacity-50"
          >
            {friendLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : friendSent ? <Check className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
            {friendSent ? t('profile.requestSent') : t('profile.addFriend')}
          </button>
        </div>
      </div>
    </div>
  );
}
