import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Search, Users, Shield, Loader2, ArrowRight } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { useServerStore } from '@/stores/serverStore';
import api from '@/lib/api';
import { getInitials } from '@/lib/utils';

export function JoinServerDialog() {
  const { t } = useTranslation();
  const closeModal = useUIStore((s) => s.closeModal);
  const loadServers = useServerStore((s) => s.loadServers);
  const setActiveServer = useServerStore((s) => s.setActiveServer);
  const [code, setCode] = useState('');
  const [serverInfo, setServerInfo] = useState<any>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState('');

  const handleResolve = async () => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setIsResolving(true);
    setError('');
    setServerInfo(null);
    try {
      const info = await api.resolveInvite(trimmed);
      setServerInfo(info);
    } catch (err: any) {
      setError(err.message || t('server.invalidInvite'));
    } finally {
      setIsResolving(false);
    }
  };

  const handleJoin = async () => {
    setIsJoining(true);
    setError('');
    try {
      const result = await api.joinByInvite(code.trim());
      await loadServers();
      // If result contains a server, set it as active
      if (result?.server) {
        await setActiveServer(result.server);
      }
      closeModal();
    } catch (err: any) {
      setError(err.message || t('server.failedJoin'));
    } finally {
      setIsJoining(false);
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
    if (e.key === 'Enter' && !serverInfo && code.trim()) {
      handleResolve();
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
            {t('server.joinServer')}
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
          {/* Description */}
          <p className="text-sm text-white/50 font-body">
            {t('server.enterInviteCode')}
          </p>

          {/* Error display */}
          {error && (
            <div className="px-3 py-2 text-sm text-rally-magenta bg-rally-magenta/10 border border-rally-magenta/20 rounded">
              {error}
            </div>
          )}

          {/* Code input */}
          <div>
            <label className="block text-xs font-display uppercase tracking-wider text-white/60 mb-1.5">
              {t('server.inviteCode')} <span className="text-rally-magenta">*</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                className="input-rally w-full"
                placeholder="e.g. aBcDe123"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  // Clear previous results when code changes
                  if (serverInfo) {
                    setServerInfo(null);
                  }
                  if (error) {
                    setError('');
                  }
                }}
                autoFocus
              />
              <button
                onClick={handleResolve}
                disabled={!code.trim() || isResolving}
                className="shrink-0 flex items-center justify-center w-10 h-10 rounded-sm border border-rally-blue/30 bg-rally-blue/10 text-rally-blue hover:bg-rally-blue/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
                aria-label="Look up invite code"
              >
                {isResolving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Server preview card */}
          {serverInfo && (
            <div className="border border-white/10 rounded-sm bg-black/30 p-4 space-y-3">
              <div className="flex items-center gap-3">
                {/* Server icon */}
                <div className="w-12 h-12 rounded-2xl bg-[#1A1F36] flex items-center justify-center overflow-hidden shrink-0 ring-1 ring-rally-blue/20">
                  {serverInfo.server?.iconUrl || serverInfo.iconUrl ? (
                    <img
                      src={serverInfo.server?.iconUrl || serverInfo.iconUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-sm font-bold text-rally-blue">
                      {getInitials(serverInfo.server?.name || serverInfo.name || 'Server')}
                    </span>
                  )}
                </div>

                {/* Server info */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-display text-base font-bold text-white truncate">
                    {serverInfo.server?.name || serverInfo.name || 'Unknown Server'}
                  </h3>
                  {(serverInfo.server?.description || serverInfo.description) && (
                    <p className="text-xs text-white/40 font-body truncate mt-0.5">
                      {serverInfo.server?.description || serverInfo.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Server stats */}
              <div className="flex items-center gap-4 text-xs text-white/40 font-body">
                {(serverInfo.memberCount != null || serverInfo.server?.memberCount != null) && (
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    <span>
                      {t('common.members', { count: serverInfo.memberCount ?? serverInfo.server?.memberCount ?? 0 })}
                    </span>
                  </div>
                )}
                {(serverInfo.server?.createdBy || serverInfo.createdBy) && (
                  <div className="flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5" />
                    <span>
                      by {serverInfo.server?.createdBy?.displayName || serverInfo.createdBy?.displayName || 'Unknown'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10">
          <button
            type="button"
            onClick={closeModal}
            className="px-4 py-2 text-sm text-white/60 hover:text-white transition-colors font-body"
            disabled={isJoining}
          >
            {t('common.cancel')}
          </button>
          {serverInfo ? (
            <button
              type="button"
              onClick={handleJoin}
              className="btn-rally-primary px-5 py-2 text-sm flex items-center gap-2"
              disabled={isJoining}
            >
              {isJoining ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('server.joining')}
                </>
              ) : (
                <>
                  {t('server.joinServer')}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleResolve}
              className="btn-rally-primary px-5 py-2 text-sm"
              disabled={!code.trim() || isResolving}
            >
              {isResolving ? t('server.lookingUp') : t('server.lookUp')}
            </button>
          )}
        </div>

        {/* Bottom accent line */}
        <div className="h-px bg-gradient-to-r from-transparent via-rally-blue to-transparent" />
      </div>
    </div>
  );
}
