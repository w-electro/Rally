import { useState, useEffect, useCallback, useRef, type ReactNode, type MouseEvent as ReactMouseEvent } from 'react';
import { cn } from '@/lib/utils';

export interface ContextMenuItem {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  variant?: 'default' | 'danger';
  disabled?: boolean;
}

export interface ContextMenuDivider {
  type: 'divider';
}

export type ContextMenuEntry = ContextMenuItem | ContextMenuDivider;

interface ContextMenuProps {
  items: ContextMenuEntry[];
  children: ReactNode;
  className?: string;
}

function isDivider(entry: ContextMenuEntry): entry is ContextMenuDivider {
  return 'type' in entry && entry.type === 'divider';
}

export default function ContextMenu({ items, children, className }: ContextMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [focusIndex, setFocusIndex] = useState(-1);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleContextMenu = useCallback(
    (e: ReactMouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const x = e.clientX;
      const y = e.clientY;

      const menuWidth = 200;
      const menuHeight = items.length * 36;
      const adjustedX = x + menuWidth > window.innerWidth ? x - menuWidth : x;
      const adjustedY = y + menuHeight > window.innerHeight ? y - menuHeight : y;

      setPosition({ x: adjustedX, y: adjustedY });
      setIsOpen(true);
      setFocusIndex(-1);
    },
    [items.length]
  );

  const close = useCallback(() => {
    setIsOpen(false);
    setFocusIndex(-1);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const handleClick = () => close();
    const handleScroll = () => close();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
        return;
      }

      const actionItems = items.filter((item) => !isDivider(item)) as ContextMenuItem[];

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusIndex((prev) => {
          const next = prev + 1;
          return next >= actionItems.length ? 0 : next;
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusIndex((prev) => {
          const next = prev - 1;
          return next < 0 ? actionItems.length - 1 : next;
        });
      } else if (e.key === 'Enter' && focusIndex >= 0) {
        e.preventDefault();
        const item = actionItems[focusIndex];
        if (item && !item.disabled) {
          item.onClick();
          close();
        }
      }
    };

    document.addEventListener('click', handleClick);
    document.addEventListener('scroll', handleScroll, true);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('scroll', handleScroll, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, close, items, focusIndex]);

  let actionIndex = -1;

  return (
    <>
      <div onContextMenu={handleContextMenu} className={className}>
        {children}
      </div>
      {isOpen && (
        <div
          ref={menuRef}
          className="fixed z-[200] min-w-[180px] py-1.5 bg-rally-darkerBg border border-primary rounded-lg shadow-2xl animate-fadeIn"
          style={{ left: position.x, top: position.y }}
        >
          {items.map((entry, i) => {
            if (isDivider(entry)) {
              return (
                <div
                  key={`divider-${i}`}
                  className="h-px bg-primary mx-2 my-1"
                />
              );
            }

            actionIndex++;
            const currentActionIndex = actionIndex;

            return (
              <button
                key={i}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-1.5 text-sm transition-colors text-left',
                  entry.variant === 'danger'
                    ? 'text-red-400 hover:bg-red-500/10 hover:text-red-300'
                    : 'text-rally-muted hover:bg-rally-cardBg/60 hover:text-white',
                  entry.disabled && 'opacity-40 cursor-not-allowed',
                  currentActionIndex === focusIndex &&
                    (entry.variant === 'danger'
                      ? 'bg-red-500/10 text-red-300'
                      : 'bg-rally-cardBg/60 text-white')
                )}
                onClick={() => {
                  if (!entry.disabled) {
                    entry.onClick();
                    close();
                  }
                }}
                disabled={entry.disabled}
              >
                {entry.icon && (
                  <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
                    {entry.icon}
                  </span>
                )}
                <span>{entry.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
