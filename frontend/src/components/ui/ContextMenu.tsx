import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { cn } from '@/lib/utils';

interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  divider?: boolean;
}

interface ContextMenuProps {
  items: ContextMenuItem[];
  position: { x: number; y: number };
  onClose: () => void;
}

export function ContextMenu({ items, position, onClose }: ContextMenuProps) {
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

    const handleScroll = () => {
      onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('scroll', handleScroll, true);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('scroll', handleScroll, true);
    };
  }, [onClose]);

  // Adjust position so the menu stays in viewport
  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    if (rect.right > vw) {
      menuRef.current.style.left = `${position.x - rect.width}px`;
    }
    if (rect.bottom > vh) {
      menuRef.current.style.top = `${position.y - rect.height}px`;
    }
  }, [position]);

  return ReactDOM.createPortal(
    <div
      ref={menuRef}
      className="fixed z-[100] min-w-[180px] animate-scale-in border border-rally-blue/20 bg-rally-dark-surface py-1 shadow-lg shadow-black/50"
      style={{
        left: position.x,
        top: position.y,
        clipPath:
          'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)',
      }}
    >
      {items.map((item, index) => (
        <React.Fragment key={index}>
          {item.divider && (
            <div className="my-1 h-px bg-gradient-to-r from-transparent via-rally-border to-transparent" />
          )}
          <button
            className={cn(
              'flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm font-body transition-colors duration-100',
              item.danger
                ? 'text-rally-magenta hover:bg-rally-magenta/10'
                : 'text-rally-text hover:bg-rally-blue/10 hover:text-rally-blue',
            )}
            onClick={() => {
              item.onClick();
              onClose();
            }}
          >
            {item.icon && (
              <span className="flex w-4 items-center justify-center text-current opacity-70">
                {item.icon}
              </span>
            )}
            <span>{item.label}</span>
          </button>
        </React.Fragment>
      ))}
    </div>,
    document.body,
  );
}
