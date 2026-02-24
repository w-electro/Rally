import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import ReactDOM from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, Hash, MessageCircle, Server } from 'lucide-react';
import { useServerStore } from '@/stores/serverStore';
import { useUIStore } from '@/stores/uiStore';
import { cn, getInitials } from '@/lib/utils';
import { modalBackdrop } from '@/lib/motion';

interface SwitcherItem {
  id: string;
  type: 'server' | 'channel' | 'dm';
  name: string;
  parentName?: string;
  icon?: string;
}

export function QuickSwitcher() {
  const { t } = useTranslation();
  const { closeModal } = useUIStore();
  const { servers, setActiveServer, setActiveChannel } = useServerStore();
  const { setView } = useUIStore();

  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Build flat searchable list
  const allItems = useMemo<SwitcherItem[]>(() => {
    const items: SwitcherItem[] = [];
    for (const server of servers) {
      items.push({
        id: server.id,
        type: 'server',
        name: server.name,
        icon: server.iconUrl ?? undefined,
      });
      if (server.channels) {
        for (const ch of server.channels) {
          items.push({
            id: `${server.id}:${ch.id}`,
            type: 'channel',
            name: ch.name,
            parentName: server.name,
          });
        }
      }
    }
    return items;
  }, [servers]);

  // Fuzzy filter
  const filtered = useMemo(() => {
    if (!query.trim()) return allItems.slice(0, 15);
    const q = query.toLowerCase();
    return allItems
      .filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          (item.parentName && item.parentName.toLowerCase().includes(q)),
      )
      .slice(0, 15);
  }, [allItems, query]);

  // Reset active index on filter change
  useEffect(() => {
    setActiveIndex(0);
  }, [filtered.length]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Scroll active item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const active = list.children[activeIndex] as HTMLElement | undefined;
    active?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const navigate = useCallback(
    (item: SwitcherItem) => {
      if (item.type === 'server') {
        const server = servers.find((s) => s.id === item.id);
        if (server) {
          setActiveServer(server);
          setView('servers');
        }
      } else if (item.type === 'channel') {
        const [serverId, channelId] = item.id.split(':');
        const server = servers.find((s) => s.id === serverId);
        if (server) {
          setActiveServer(server);
          setView('servers');
          const channel = server.channels?.find((c) => c.id === channelId);
          if (channel) setActiveChannel(channel);
        }
      }
      closeModal();
    },
    [servers, setActiveServer, setActiveChannel, setView, closeModal],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % Math.max(filtered.length, 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + filtered.length) % Math.max(filtered.length, 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[activeIndex]) navigate(filtered[activeIndex]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeModal();
      }
    },
    [filtered, activeIndex, navigate, closeModal],
  );

  const ItemIcon = ({ item }: { item: SwitcherItem }) => {
    if (item.type === 'channel') return <Hash className="w-4 h-4 text-white/40 shrink-0" />;
    if (item.type === 'dm') return <MessageCircle className="w-4 h-4 text-white/40 shrink-0" />;
    if (item.icon) {
      return <img src={item.icon} alt="" className="w-5 h-5 rounded-md object-cover shrink-0" />;
    }
    return (
      <div className="w-5 h-5 rounded-md bg-rally-cyan/20 flex items-center justify-center text-[9px] font-bold text-rally-cyan shrink-0">
        {getInitials(item.name)}
      </div>
    );
  };

  return ReactDOM.createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[15vh]">
        {/* Backdrop */}
        <motion.div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          variants={modalBackdrop}
          initial="initial"
          animate="animate"
          exit="exit"
          onClick={closeModal}
        />

        {/* Panel */}
        <motion.div
          className="relative z-10 w-full max-w-lg mx-4 rounded-lg border border-rally-blue/20 bg-[#0D1117] shadow-elevation-4 overflow-hidden"
          initial={{ y: -16, opacity: 0, scale: 0.97 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -16, opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
          onKeyDown={handleKeyDown}
        >
          {/* Search Input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
            <Search className="w-5 h-5 text-white/30 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('quickSwitcher.placeholder') || 'Where would you like to go?'}
              className="flex-1 bg-transparent text-sm text-white placeholder-white/30 outline-none font-body"
            />
          </div>

          {/* Results */}
          <div ref={listRef} className="max-h-[300px] overflow-y-auto py-1 scrollbar-thin scrollbar-thumb-white/10">
            {filtered.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-white/30 font-body">
                {t('quickSwitcher.noResults') || 'No results found'}
              </p>
            ) : (
              filtered.map((item, idx) => (
                <button
                  key={item.id}
                  className={cn(
                    'flex w-full items-center gap-3 px-4 py-2 text-left transition-colors',
                    idx === activeIndex
                      ? 'bg-rally-blue/10 text-white'
                      : 'text-white/70 hover:bg-white/5',
                  )}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => navigate(item)}
                >
                  <ItemIcon item={item} />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium truncate block">{item.name}</span>
                    {item.parentName && (
                      <span className="text-[11px] text-white/30 truncate block">{item.parentName}</span>
                    )}
                  </div>
                  <span className="text-[10px] text-white/20 uppercase font-display shrink-0">
                    {item.type}
                  </span>
                </button>
              ))
            )}
          </div>

          {/* Footer hint */}
          <div className="flex items-center gap-4 px-4 py-2 border-t border-white/5 text-[10px] text-white/20 font-body">
            <span><kbd className="px-1 py-0.5 rounded bg-white/5 text-white/40">↑↓</kbd> navigate</span>
            <span><kbd className="px-1 py-0.5 rounded bg-white/5 text-white/40">↵</kbd> go</span>
            <span><kbd className="px-1 py-0.5 rounded bg-white/5 text-white/40">esc</kbd> close</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body,
  );
}
