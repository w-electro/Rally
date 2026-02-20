import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Play,
  Square,
  Users,
  Clock,
  MessageSquare,
  Gift,
  Radio,
  Settings,
  ChevronDown,
  Send,
  Zap,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useServerStore } from '@/stores/serverStore';
import { api } from '@/lib/api';
import { cn, formatNumber } from '@/lib/utils';
import type { StreamSession } from '@/lib/types';

type QualityOption = 'Auto' | '1080p' | '720p' | '480p' | '360p';

export function StreamView() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const activeServer = useServerStore((s) => s.activeServer);
  const activeChannel = useServerStore((s) => s.activeChannel);

  const [stream, setStream] = useState<StreamSession | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [chatMessages, setChatMessages] = useState<
    { id: string; author: string; content: string }[]
  >([]);
  const [chatInput, setChatInput] = useState('');
  const [showChat, setShowChat] = useState(true);
  const [quality, setQuality] = useState<QualityOption>('Auto');
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [showPointsPanel, setShowPointsPanel] = useState(false);
  const [showGoLiveForm, setShowGoLiveForm] = useState(false);
  const [showRaidDialog, setShowRaidDialog] = useState(false);
  const [streamTitle, setStreamTitle] = useState('');
  const [streamCategory, setStreamCategory] = useState('');
  const [raidTarget, setRaidTarget] = useState('');
  const [uptime, setUptime] = useState('00:00:00');

  const isStreamer = stream?.streamerId === user?.id;

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (stream?.isLive && stream.startedAt) {
      interval = setInterval(() => {
        const diff = Date.now() - new Date(stream.startedAt).getTime();
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        setUptime(
          `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`,
        );
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [stream]);

  useEffect(() => {
    async function loadLiveStreams() {
      try {
        const streams = await api.getLiveStreams();
        const current = streams.find(
          (s: StreamSession) =>
            s.channelId === activeChannel?.id && s.isLive,
        );
        if (current) {
          setStream(current);
          setIsLive(true);
        }
      } catch {
        /* ignore */
      }
    }
    if (activeChannel) loadLiveStreams();
  }, [activeChannel]);

  const handleGoLive = useCallback(async () => {
    if (!activeServer || !activeChannel) return;
    try {
      const session = await api.startStream({
        serverId: activeServer.id,
        channelId: activeChannel.id,
        title: streamTitle || t('stream.untitledStream'),
        category: streamCategory || undefined,
      });
      setStream(session);
      setIsLive(true);
      setShowGoLiveForm(false);
      setStreamTitle('');
      setStreamCategory('');
    } catch {
      /* ignore */
    }
  }, [activeServer, activeChannel, streamTitle, streamCategory]);

  const handleEndStream = useCallback(async () => {
    if (!stream) return;
    try {
      await api.endStream(stream.id);
      setStream(null);
      setIsLive(false);
    } catch {
      /* ignore */
    }
  }, [stream]);

  const handleSendChat = useCallback(() => {
    if (!chatInput.trim()) return;
    setChatMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        author: user?.displayName || 'You',
        content: chatInput.trim(),
      },
    ]);
    setChatInput('');
  }, [chatInput, user]);

  const handleRaid = useCallback(() => {
    setShowRaidDialog(false);
    setRaidTarget('');
  }, []);

  const qualityOptions: QualityOption[] = ['Auto', '1080p', '720p', '480p', '360p'];

  return (
    <div className="flex h-full flex-col bg-black">
      <div className="flex flex-1 overflow-hidden">
        {/* Stream video area */}
        <div className="flex flex-1 flex-col">
          {/* Video display */}
          <div className="relative flex flex-1 items-center justify-center bg-rally-dark-bg">
            {isLive ? (
              <>
                {/* Placeholder for video */}
                <div className="flex flex-col items-center gap-3">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#8B00FF]/20">
                    <Radio size={32} className="text-[#8B00FF]" />
                  </div>
                  <p className="text-sm text-rally-text-muted">{t('stream.streamLive')}</p>
                </div>

                {/* LIVE badge */}
                <div className="absolute left-4 top-4 flex items-center gap-2">
                  <span className="flex items-center gap-1 rounded bg-[#FF006E] px-2 py-0.5 text-xs font-bold uppercase text-white">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                    {t('stream.live')}
                  </span>
                </div>

                {/* Quality selector */}
                <div className="absolute bottom-4 right-4">
                  <div className="relative">
                    <button
                      onClick={() => setShowQualityMenu(!showQualityMenu)}
                      className="flex items-center gap-1 rounded bg-black/70 px-2 py-1 text-xs text-rally-text transition-colors hover:bg-black/90"
                    >
                      <Settings size={12} />
                      {quality}
                      <ChevronDown size={12} />
                    </button>
                    {showQualityMenu && (
                      <div className="absolute bottom-full right-0 mb-1 overflow-hidden rounded border border-rally-border/30 bg-rally-dark-surface shadow-xl">
                        {qualityOptions.map((q) => (
                          <button
                            key={q}
                            onClick={() => {
                              setQuality(q);
                              setShowQualityMenu(false);
                            }}
                            className={cn(
                              'block w-full px-4 py-1.5 text-left text-xs transition-colors',
                              quality === q
                                ? 'bg-[#00D9FF]/10 text-[#00D9FF]'
                                : 'text-rally-text-muted hover:bg-rally-dark-bg/60 hover:text-rally-text',
                            )}
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div className="flex h-20 w-20 items-center justify-center rounded-full border border-rally-border/20 bg-rally-dark-surface">
                  <Radio size={36} className="text-rally-text-muted/40" />
                </div>
                <p className="text-rally-text-muted">{t('stream.noStreaming')}</p>
                <button
                  onClick={() => setShowGoLiveForm(true)}
                  className="flex items-center gap-2 rounded-lg bg-[#FF006E] px-5 py-2.5 text-sm font-bold text-white transition-all hover:shadow-[0_0_20px_rgba(255,0,110,0.4)]"
                >
                  <Play size={16} />
                  {t('stream.goLive')}
                </button>
              </div>
            )}
          </div>

          {/* Stream info bar */}
          <div className="flex items-center justify-between border-t border-rally-border/20 bg-rally-dark-surface px-4 py-2.5">
            <div className="flex items-center gap-4">
              {stream && (
                <>
                  <div>
                    <h3 className="text-sm font-semibold text-rally-text">
                      {stream.title || t('stream.untitledStream')}
                    </h3>
                    <p className="text-xs text-rally-text-muted">
                      {stream.category || t('stream.justChatting')}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-rally-text-muted">
                    <span className="flex items-center gap-1">
                      <Users size={12} />
                      {formatNumber(stream.viewerCount)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      {uptime}
                    </span>
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowPointsPanel(!showPointsPanel)}
                className={cn(
                  'flex items-center gap-1 rounded px-2.5 py-1.5 text-xs font-medium transition-colors',
                  showPointsPanel
                    ? 'bg-[#39FF14]/20 text-[#39FF14]'
                    : 'text-rally-text-muted hover:bg-rally-dark-bg/60 hover:text-rally-text',
                )}
                title="Channel Points"
              >
                <Gift size={14} />
                {t('stream.points')}
              </button>
              <button
                onClick={() => setShowChat(!showChat)}
                className={cn(
                  'flex items-center gap-1 rounded px-2.5 py-1.5 text-xs font-medium transition-colors',
                  showChat
                    ? 'bg-[#00D9FF]/20 text-[#00D9FF]'
                    : 'text-rally-text-muted hover:bg-rally-dark-bg/60 hover:text-rally-text',
                )}
              >
                <MessageSquare size={14} />
                {t('stream.chat')}
              </button>
              {isStreamer && isLive && (
                <>
                  <button
                    onClick={() => setShowRaidDialog(true)}
                    className="flex items-center gap-1 rounded bg-[#8B00FF]/20 px-2.5 py-1.5 text-xs font-medium text-[#8B00FF] transition-colors hover:bg-[#8B00FF]/30"
                  >
                    <Zap size={14} />
                    {t('stream.raid')}
                  </button>
                  <button
                    onClick={handleEndStream}
                    className="flex items-center gap-1 rounded bg-[#FF006E]/20 px-2.5 py-1.5 text-xs font-medium text-[#FF006E] transition-colors hover:bg-[#FF006E]/30"
                  >
                    <Square size={14} />
                    {t('stream.endStream')}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Chat overlay */}
        {showChat && (
          <div className="flex w-80 flex-col border-l border-rally-border/20 bg-rally-dark-surface">
            <div className="border-b border-rally-border/20 px-4 py-2.5">
              <h4 className="font-display text-xs font-bold uppercase tracking-wider text-rally-text">
                {t('stream.streamChat')}
              </h4>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-3 py-2">
              {chatMessages.length === 0 && (
                <p className="py-8 text-center text-xs text-rally-text-muted">
                  {t('stream.welcomeChat')}
                </p>
              )}
              {chatMessages.map((msg) => (
                <div key={msg.id} className="mb-1.5">
                  <span className="text-xs font-semibold text-[#00D9FF]">
                    {msg.author}
                  </span>
                  <span className="ml-1.5 text-xs text-rally-text">
                    {msg.content}
                  </span>
                </div>
              ))}
            </div>

            {/* Chat input */}
            <div className="border-t border-rally-border/20 p-3">
              <div className="flex items-center gap-2 rounded-lg border border-rally-border/20 bg-rally-dark-bg px-3 py-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                  placeholder={t('stream.sendMessage')}
                  className="flex-1 bg-transparent text-xs text-rally-text outline-none placeholder:text-rally-text-muted"
                />
                <button
                  onClick={handleSendChat}
                  disabled={!chatInput.trim()}
                  className="text-rally-text-muted transition-colors hover:text-[#00D9FF] disabled:opacity-40"
                >
                  <Send size={14} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Go Live dialog */}
      {showGoLiveForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowGoLiveForm(false)}
          />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-rally-border/30 bg-rally-dark-surface p-6 shadow-2xl">
            <h3 className="mb-4 font-display text-lg font-bold uppercase tracking-wider text-rally-text">
              {t('stream.goLive')}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-rally-text-muted">
                  {t('stream.streamTitle')}
                </label>
                <input
                  type="text"
                  value={streamTitle}
                  onChange={(e) => setStreamTitle(e.target.value)}
                  placeholder={t('stream.titlePlaceholder')}
                  className="w-full rounded-lg border border-rally-border/30 bg-rally-dark-bg px-3 py-2 text-sm text-rally-text outline-none transition-colors focus:border-[#00D9FF]/50 placeholder:text-rally-text-muted"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-rally-text-muted">
                  {t('stream.category')}
                </label>
                <input
                  type="text"
                  value={streamCategory}
                  onChange={(e) => setStreamCategory(e.target.value)}
                  placeholder={t('stream.categoryPlaceholder')}
                  className="w-full rounded-lg border border-rally-border/30 bg-rally-dark-bg px-3 py-2 text-sm text-rally-text outline-none transition-colors focus:border-[#00D9FF]/50 placeholder:text-rally-text-muted"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setShowGoLiveForm(false)}
                  className="flex-1 rounded-lg border border-rally-border/30 px-4 py-2 text-sm text-rally-text-muted transition-colors hover:text-rally-text"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleGoLive}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#FF006E] px-4 py-2 text-sm font-bold text-white transition-all hover:shadow-[0_0_20px_rgba(255,0,110,0.4)]"
                >
                  <Play size={14} />
                  {t('stream.startStreaming')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Raid dialog */}
      {showRaidDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowRaidDialog(false)}
          />
          <div className="relative z-10 w-full max-w-sm rounded-xl border border-[#8B00FF]/30 bg-rally-dark-surface p-6 shadow-2xl">
            <h3 className="mb-4 font-display text-lg font-bold uppercase tracking-wider text-rally-text">
              {t('stream.raidChannel')}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-rally-text-muted">
                  {t('stream.targetChannel')}
                </label>
                <input
                  type="text"
                  value={raidTarget}
                  onChange={(e) => setRaidTarget(e.target.value)}
                  placeholder={t('stream.targetPlaceholder')}
                  className="w-full rounded-lg border border-rally-border/30 bg-rally-dark-bg px-3 py-2 text-sm text-rally-text outline-none transition-colors focus:border-[#8B00FF]/50 placeholder:text-rally-text-muted"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setShowRaidDialog(false)}
                  className="flex-1 rounded-lg border border-rally-border/30 px-4 py-2 text-sm text-rally-text-muted transition-colors hover:text-rally-text"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleRaid}
                  disabled={!raidTarget.trim()}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#8B00FF] px-4 py-2 text-sm font-bold text-white transition-all hover:shadow-[0_0_20px_rgba(139,0,255,0.4)] disabled:opacity-40"
                >
                  <Zap size={14} />
                  {t('stream.startRaid')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
