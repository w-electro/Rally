import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Monitor, X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

declare global {
  interface Window {
    electronAPI?: {
      minimize: () => void;
      maximize: () => void;
      close: () => void;
      isMaximized: () => Promise<boolean>;
      onStatusChange: (callback: (status: string) => void) => void;
      detectGames: () => Promise<any>;
      platform: string;
      getScreenSources: () => Promise<Array<{
        id: string;
        name: string;
        thumbnail: string;
        appIcon: string | null;
      }>>;
    };
  }
}

interface ScreenSource {
  id: string;
  name: string;
  thumbnail: string;
  appIcon: string | null;
}

interface ScreenSharePickerProps {
  onSelect: (sourceId: string, withAudio: boolean) => void;
  onCancel: () => void;
}

type TabId = 'screens' | 'windows';

export function ScreenSharePicker({ onSelect, onCancel }: ScreenSharePickerProps) {
  const { t } = useTranslation();
  const [sources, setSources] = useState<ScreenSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [withAudio, setWithAudio] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('screens');

  const isElectronAvailable = typeof window !== 'undefined' && !!window.electronAPI?.getScreenSources;

  useEffect(() => {
    if (!isElectronAvailable) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchSources() {
      try {
        const result = await window.electronAPI!.getScreenSources();
        if (!cancelled) {
          setSources(result);
        }
      } catch (err) {
        console.error('Failed to get screen sources:', err);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchSources();

    return () => {
      cancelled = true;
    };
  }, [isElectronAvailable]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    },
    [onCancel],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [handleKeyDown]);

  const screenSources = sources.filter((s) => s.id.startsWith('screen:'));
  const windowSources = sources.filter((s) => s.id.startsWith('window:'));
  const displayedSources = activeTab === 'screens' ? screenSources : windowSources;

  const handleShare = () => {
    if (selectedSourceId) {
      onSelect(selectedSourceId, withAudio);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Modal container */}
      <div className="relative z-10 w-full max-w-2xl mx-4 rounded-xl border border-white/10 bg-[#0D1117] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <Monitor size={20} className="text-[#00D9FF]" />
            <h2 className="font-display text-lg font-bold uppercase tracking-wider text-white">
              {t('voice.shareYourScreen')}
            </h2>
          </div>
          <button
            onClick={onCancel}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Fallback for non-Electron */}
        {!isElectronAvailable ? (
          <div className="px-6 py-12 text-center">
            <Monitor size={48} className="mx-auto mb-4 text-[#00D9FF]" />
            <p className="text-gray-300 text-sm mb-2 font-medium">
              {t('voice.shareYourScreen')}
            </p>
            <p className="text-gray-500 text-xs mb-6">
              {t('voice.browserSharePrompt')}
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={onCancel}
                className="px-4 py-2 rounded-lg border border-white/10 text-gray-300 text-sm font-medium hover:bg-white/5 transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => onSelect('browser', false)}
                className="px-6 py-2 rounded-lg bg-[#00D9FF] text-black text-sm font-medium hover:bg-[#00D9FF]/90 transition-colors"
              >
                {t('voice.shareScreen')}
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Tab bar */}
            <div className="flex border-b border-white/10 px-6">
              <button
                onClick={() => {
                  setActiveTab('screens');
                  setSelectedSourceId(null);
                }}
                className={cn(
                  'relative px-4 py-3 text-sm font-display font-semibold uppercase tracking-wider transition-colors',
                  activeTab === 'screens'
                    ? 'text-[#00D9FF]'
                    : 'text-gray-400 hover:text-gray-200',
                )}
              >
                {t('voice.screens')}
                {activeTab === 'screens' && (
                  <span
                    className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#00D9FF]"
                    style={{
                      boxShadow: '0 0 8px rgba(0, 217, 255, 0.5), 0 0 16px rgba(0, 217, 255, 0.2)',
                    }}
                  />
                )}
              </button>
              <button
                onClick={() => {
                  setActiveTab('windows');
                  setSelectedSourceId(null);
                }}
                className={cn(
                  'relative px-4 py-3 text-sm font-display font-semibold uppercase tracking-wider transition-colors',
                  activeTab === 'windows'
                    ? 'text-[#00D9FF]'
                    : 'text-gray-400 hover:text-gray-200',
                )}
              >
                {t('voice.windows')}
                {activeTab === 'windows' && (
                  <span
                    className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#00D9FF]"
                    style={{
                      boxShadow: '0 0 8px rgba(0, 217, 255, 0.5), 0 0 16px rgba(0, 217, 255, 0.2)',
                    }}
                  />
                )}
              </button>
            </div>

            {/* Source grid */}
            <div className="px-6 py-4 max-h-[400px] overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#00D9FF] border-t-transparent" />
                </div>
              ) : displayedSources.length === 0 ? (
                <div className="py-12 text-center">
                  <Monitor size={36} className="mx-auto mb-3 text-gray-600" />
                  <p className="text-gray-500 text-sm">
                    {activeTab === 'screens'
                      ? t('voice.noScreens')
                      : t('voice.noWindows')}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {displayedSources.map((source) => {
                    const isSelected = selectedSourceId === source.id;
                    return (
                      <button
                        key={source.id}
                        onClick={() => setSelectedSourceId(source.id)}
                        className={cn(
                          'group relative flex flex-col rounded-lg border overflow-hidden transition-all text-left',
                          isSelected
                            ? 'border-[#00D9FF] shadow-[0_0_12px_rgba(0,217,255,0.3)]'
                            : 'border-white/10 hover:border-white/25',
                        )}
                      >
                        {/* Thumbnail */}
                        <div className="relative aspect-video bg-black/50">
                          <img
                            src={source.thumbnail}
                            alt={source.name}
                            className="h-full w-full object-contain"
                          />
                          {/* Selected check overlay */}
                          {isSelected && (
                            <div className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#00D9FF]">
                              <Check size={12} className="text-black" />
                            </div>
                          )}
                        </div>
                        {/* Source name */}
                        <div className="flex items-center gap-2 px-2 py-2 bg-[#0D1117]">
                          {source.appIcon && (
                            <img
                              src={source.appIcon}
                              alt=""
                              className="h-4 w-4 flex-shrink-0"
                            />
                          )}
                          <span className="truncate text-xs text-gray-300">
                            {source.name}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-white/10">
              {/* Audio checkbox */}
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <div
                  className={cn(
                    'flex h-4 w-4 items-center justify-center rounded border transition-colors',
                    withAudio
                      ? 'border-[#00D9FF] bg-[#00D9FF]'
                      : 'border-gray-500 bg-transparent hover:border-gray-400',
                  )}
                  onClick={() => setWithAudio((prev) => !prev)}
                >
                  {withAudio && <Check size={10} className="text-black" />}
                </div>
                <input
                  type="checkbox"
                  checked={withAudio}
                  onChange={(e) => setWithAudio(e.target.checked)}
                  className="sr-only"
                />
                <span className="text-sm text-gray-300">{t('voice.includeAudio')}</span>
              </label>

              {/* Action buttons */}
              <div className="flex items-center gap-3">
                <button
                  onClick={onCancel}
                  className="px-4 py-2 rounded-lg border border-white/10 text-gray-300 text-sm font-medium hover:bg-white/5 transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleShare}
                  disabled={!selectedSourceId}
                  className={cn(
                    'px-6 py-2 rounded-lg text-sm font-medium transition-colors',
                    selectedSourceId
                      ? 'bg-[#00D9FF] text-black hover:bg-[#00D9FF]/90'
                      : 'bg-[#00D9FF]/30 text-black/50 cursor-not-allowed',
                  )}
                >
                  {t('voice.share')}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
