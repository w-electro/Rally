import { useState } from 'react';
import { X, Hash, Volume2, Camera, Megaphone } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { useServerStore } from '@/stores/serverStore';
import api from '@/lib/api';

const CHANNEL_TYPES = [
  { value: 'TEXT', label: 'Text', icon: Hash, description: 'Send messages and media' },
  { value: 'VOICE', label: 'Voice', icon: Volume2, description: 'Talk with your crew' },
  { value: 'FEED', label: 'Feed', icon: Camera, description: 'Share photos and videos' },
  { value: 'ANNOUNCEMENT', label: 'Announcement', icon: Megaphone, description: 'Important updates' },
];

export function CreateChannelModal() {
  const closeModal = useUIStore((s) => s.closeModal);
  const activeServer = useServerStore((s) => s.activeServer);
  const loadServers = useServerStore((s) => s.loadServers);
  const [name, setName] = useState('');
  const [type, setType] = useState('TEXT');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Channel name is required');
      return;
    }
    if (!activeServer) return;

    setIsSubmitting(true);
    setError('');
    try {
      await api.createChannel(activeServer.id, {
        name: name.trim().toLowerCase().replace(/\s+/g, '-'),
        type,
      });
      await loadServers();
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
            Create Channel
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
              Channel Type
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
                      <div className="text-sm font-semibold">{ct.label}</div>
                      <div className="text-[10px] opacity-60">{ct.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Channel Name */}
          <div>
            <label className="block text-xs font-display uppercase tracking-wider text-white/60 mb-1.5">
              Channel Name <span className="text-rally-magenta">*</span>
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
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="btn-rally-primary px-5 py-2 text-sm"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Creating...' : 'Create Channel'}
          </button>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-rally-blue to-transparent" />
      </div>
    </div>
  );
}
