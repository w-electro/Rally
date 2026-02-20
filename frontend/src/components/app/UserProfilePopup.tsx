import { useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageCircle, UserPlus, X } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { getInitials, getStatusColor } from '@/lib/utils';

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
          <button className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[#00D9FF]/10 border border-[#00D9FF]/20 text-[#00D9FF] text-xs font-medium hover:bg-[#00D9FF]/20 transition-colors">
            <MessageCircle className="w-3.5 h-3.5" />
            {t('profile.message')}
          </button>
          <button className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[#39FF14]/10 border border-[#39FF14]/20 text-[#39FF14] text-xs font-medium hover:bg-[#39FF14]/20 transition-colors">
            <UserPlus className="w-3.5 h-3.5" />
            {t('profile.addFriend')}
          </button>
        </div>
      </div>
    </div>
  );
}
