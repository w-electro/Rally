import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Copy, Check, Link, Loader2 } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { useServerStore } from '@/stores/serverStore';
import api from '@/lib/api';

export function InviteDialog() {
  const { t } = useTranslation();
  const closeModal = useUIStore((s) => s.closeModal);
  const activeServer = useServerStore((s) => s.activeServer);
  const [code, setCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!activeServer) return;
    api
      .createInvite(activeServer.id)
      .then((data: any) => setCode(data.code))
      .catch(() => setError(t('server.failedCreateInvite')))
      .finally(() => setIsLoading(false));
  }, [activeServer]);

  const handleCopy = () => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
            {t('server.invitePeople')}
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
          {/* Server info */}
          {activeServer && (
            <p className="text-sm text-white/50 font-body">
              {t('server.shareInvite')}{' '}
              <span className="text-rally-blue font-semibold">{activeServer.name}</span>
            </p>
          )}

          {/* Error display */}
          {error && (
            <div className="px-3 py-2 text-sm text-rally-magenta bg-rally-magenta/10 border border-rally-magenta/20 rounded">
              {error}
            </div>
          )}

          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-rally-blue animate-spin" />
              <span className="ml-2 text-sm text-white/40 font-body">{t('server.generatingInvite')}</span>
            </div>
          )}

          {/* Invite code display */}
          {!isLoading && code && (
            <div className="space-y-3">
              <label className="block text-xs font-display uppercase tracking-wider text-white/60">
                {t('server.inviteCode')}
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-3 px-4 py-3 bg-black/40 border border-white/10 rounded-sm">
                  <Link className="w-4 h-4 text-rally-blue shrink-0" />
                  <span className="text-lg font-display font-bold tracking-widest text-rally-blue select-all">
                    {code}
                  </span>
                </div>
                <button
                  onClick={handleCopy}
                  className={`shrink-0 flex items-center justify-center w-12 h-12 rounded-sm border transition-all duration-200 ${
                    copied
                      ? 'border-rally-green bg-rally-green/10 text-rally-green'
                      : 'border-rally-blue/30 bg-rally-blue/10 text-rally-blue hover:bg-rally-blue/20'
                  }`}
                  aria-label="Copy invite code"
                >
                  {copied ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <Copy className="w-5 h-5" />
                  )}
                </button>
              </div>
              {copied && (
                <p className="text-xs text-rally-green font-body">{t('common.copied')}</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10">
          <button
            type="button"
            onClick={closeModal}
            className="px-4 py-2 text-sm text-white/60 hover:text-white transition-colors font-body"
          >
            {t('common.done')}
          </button>
        </div>

        {/* Bottom accent line */}
        <div className="h-px bg-gradient-to-r from-transparent via-rally-blue to-transparent" />
      </div>
    </div>
  );
}
