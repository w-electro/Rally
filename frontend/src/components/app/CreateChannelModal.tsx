import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Hash, Volume2, Camera, Megaphone } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { useServerStore } from '@/stores/serverStore';
import api from '@/lib/api';

const CHANNEL_TYPES = [
  { value: 'TEXT', labelKey: 'channel.text', icon: Hash, descKey: 'channel.textDesc' },
  { value: 'VOICE', labelKey: 'channel.voice', icon: Volume2, descKey: 'channel.voiceDesc' },
  { value: 'FEED', labelKey: 'channel.feed', icon: Camera, descKey: 'channel.feedDesc' },
  { value: 'ANNOUNCEMENT', labelKey: 'channel.announcement', icon: Megaphone, descKey: 'channel.announcementDesc' },
];

export function CreateChannelModal() {
  const { t } = useTranslation();
  const closeModal = useUIStore((s) => s.closeModal);
  const activeServer = useServerStore((s) => s.activeServer);
  const addChannel = useServerStore((s) => s.addChannel);
  const [name, setName] = useState('');
  const [type, setType] = useState('TEXT');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError(t('channel.nameRequired'));
      return;
    }
    if (!activeServer) return;

    setIsSubmitting(true);
    setError('');
    try {
      const channel = await api.createChannel(activeServer.id, {
        name: name.trim(),
        type,
      });
      addChannel(channel);
      closeModal();
    } catch (err: any) {
      setError(err.message || 'Failed to create channel');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) closeModal();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="relative w-full max-w-md mx-4 border border-rally-blue/20 bg-rally-dark-surface rounded-sm overflow-hidden">
        <div className="h-px bg-gradient-to-r from-transparent via-rally-blue to-transparent" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="font-display text-lg font-bold uppercase tracking-wider text-white">
            {t('channel.createChannel')}
          </h2>
          <button
            onClick={closeModal}
            className="flex items-center justify-center w-8 h-8 text-white/40 hover:text-rally-magenta transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {error && (
            <div className="px-3 py-2 text-sm text-rally-magenta bg-rally-magenta/10 border border-rally-magenta/20 rounded">
              {error}
            </div>
          )}

          {/* Channel Type */}
          <div>
            <label className="block text-xs font-display uppercase tracking-wider text-white/60 mb-2">
              {t('channel.channelType')}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {CHANNEL_TYPES.map((ct) => {
                const Icon = ct.icon;
                const isSelected = type === ct.value;
                return (
                  <button
                    key={ct.value}
                    onClick={() => setType(ct.value)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-sm border transition-colors text-left ${
                      isSelected
                        ? 'border-rally-blue bg-rally-blue/10 text-rally-blue'
                        : 'border-white/10 bg-transparent text-white/40 hover:border-white/20 hover:text-white/60'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <div>
                      <div className="text-sm font-semibold">{t(ct.labelKey)}</div>
                      <div className="text-[10px] opacity-60">{t(ct.descKey)}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Channel Name */}
          <div>
            <label className="block text-xs font-display uppercase tracking-wider text-white/60 mb-1.5">
              {t('channel.channelName')} <span className="text-rally-magenta">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm">#</span>
              <input
                type="text"
                className="input-rally w-full pl-7"
                placeholder="new-channel"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                autoFocus
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10">
          <button
            onClick={closeModal}
            className="px-4 py-2 text-sm text-white/60 hover:text-white transition-colors font-body"
            disabled={isSubmitting}
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSubmit}
            className="btn-rally-primary px-5 py-2 text-sm"
            disabled={isSubmitting}
          >
            {isSubmitting ? t('server.creating') : t('channel.createChannel')}
          </button>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-rally-blue to-transparent" />
      </div>
    </div>
  );
}
