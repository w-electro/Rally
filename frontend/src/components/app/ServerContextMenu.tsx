import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Pin, EyeOff, Bell, Settings } from 'lucide-react';

interface ServerContextMenuProps {
  x: number;
  y: number;
  isPinned: boolean;
  onPin: () => void;
  onHide: () => void;
  onClose: () => void;
}

export function ServerContextMenu({
  x,
  y,
  isPinned,
  onPin,
  onHide,
  onClose,
}: ServerContextMenuProps) {
  const { t } = useTranslation();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="fixed z-[100] w-48 rounded-lg border border-white/10 bg-[#0A0E27] py-1 shadow-2xl"
      style={{ left: x, top: y }}
    >
      {/* Pin / Unpin */}
      <button
        className="flex w-full items-center gap-2.5 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10 hover:text-white"
        onClick={() => {
          onPin();
          onClose();
        }}
      >
        <Pin className="h-3.5 w-3.5" />
        {isPinned ? t('server.unpinServer') : t('server.pinServer')}
      </button>

      {/* Hide Server */}
      <button
        className="flex w-full items-center gap-2.5 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10 hover:text-white"
        onClick={() => {
          onHide();
          onClose();
        }}
      >
        <EyeOff className="h-3.5 w-3.5" />
        {t('server.hideServer')}
      </button>

      {/* Divider */}
      <div className="my-1 h-px bg-white/5" />

      {/* Notifications (disabled) */}
      <button
        className="flex w-full cursor-not-allowed items-center gap-2.5 px-3 py-1.5 text-xs text-white/30"
        disabled
      >
        <Bell className="h-3.5 w-3.5" />
        {t('server.notifications')}
      </button>

      {/* Server Settings (disabled) */}
      <button
        className="flex w-full cursor-not-allowed items-center gap-2.5 px-3 py-1.5 text-xs text-white/30"
        disabled
      >
        <Settings className="h-3.5 w-3.5" />
        {t('server.serverSettings')}
      </button>
    </div>
  );
}
