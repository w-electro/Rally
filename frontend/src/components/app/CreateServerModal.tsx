import { useState } from 'react';
import { X, Globe, Lock } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { useServerStore } from '@/stores/serverStore';

export function CreateServerModal() {
  const closeModal = useUIStore((s) => s.closeModal);
  const createServer = useServerStore((s) => s.createServer);
  const setActiveServer = useServerStore((s) => s.setActiveServer);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Server name is required');
      return;
    }
    setIsSubmitting(true);
    setError('');
    try {
      const server = await createServer({
        name: name.trim(),
        description: description.trim() || undefined,
        isPublic,
      });
      await setActiveServer(server);
      closeModal();
    } catch (err: any) {
      setError(err.message || 'Failed to create server');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      closeModal();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      closeModal();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
    >
      <div className="relative w-full max-w-md mx-4 border border-rally-blue/20 bg-rally-dark-surface rounded-sm overflow-hidden">
        {/* Top accent line */}
        <div className="h-px bg-gradient-to-r from-transparent via-rally-blue to-transparent" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="font-display text-lg font-bold uppercase tracking-wider text-white">
            Create Server
          </h2>
          <button
            onClick={closeModal}
            className="flex items-center justify-center w-8 h-8 text-white/40 hover:text-rally-magenta transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {/* Error display */}
          {error && (
            <div className="px-3 py-2 text-sm text-rally-magenta bg-rally-magenta/10 border border-rally-magenta/20 rounded">
              {error}
            </div>
          )}

          {/* Server Name */}
          <div>
            <label className="block text-xs font-display uppercase tracking-wider text-white/60 mb-1.5">
              Server Name <span className="text-rally-magenta">*</span>
            </label>
            <input
              type="text"
              className="input-rally w-full"
              placeholder="My Awesome Server"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-display uppercase tracking-wider text-white/60 mb-1.5">
              Description
            </label>
            <textarea
              className="input-rally w-full resize-none h-20"
              placeholder="What's your server about?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={1024}
            />
          </div>

          {/* Visibility toggle */}
          <div>
            <label className="block text-xs font-display uppercase tracking-wider text-white/60 mb-2">
              Visibility
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsPublic(false)}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-sm border transition-colors text-sm font-body ${
                  !isPublic
                    ? 'border-rally-blue bg-rally-blue/10 text-rally-blue'
                    : 'border-white/10 bg-transparent text-white/40 hover:border-white/20 hover:text-white/60'
                }`}
              >
                <Lock className="w-4 h-4" />
                Private
              </button>
              <button
                type="button"
                onClick={() => setIsPublic(true)}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-sm border transition-colors text-sm font-body ${
                  isPublic
                    ? 'border-rally-green bg-rally-green/10 text-rally-green'
                    : 'border-white/10 bg-transparent text-white/40 hover:border-white/20 hover:text-white/60'
                }`}
              >
                <Globe className="w-4 h-4" />
                Public
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10">
          <button
            type="button"
            onClick={closeModal}
            className="px-4 py-2 text-sm text-white/60 hover:text-white transition-colors font-body"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="btn-rally-primary px-5 py-2 text-sm"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Creating...' : 'Create Server'}
          </button>
        </div>

        {/* Bottom accent line */}
        <div className="h-px bg-gradient-to-r from-transparent via-rally-blue to-transparent" />
      </div>
    </div>
  );
}
