import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { contextMenuVariants } from '@/lib/motion';

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
  const [activeIndex, setActiveIndex] = useState(-1);

  // Filter out divider-only items for keyboard navigation
  const actionItems = items.filter((item) => !item.divider || item.label);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
        case 'ArrowDown':
          e.preventDefault();
          setActiveIndex((prev) => (prev + 1) % actionItems.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setActiveIndex((prev) => (prev - 1 + actionItems.length) % actionItems.length);
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          if (activeIndex >= 0 && activeIndex < actionItems.length) {
            actionItems[activeIndex].onClick();
            onClose();
          }
          break;
        default:
          // First-letter jump
          if (e.key.length === 1) {
            const idx = actionItems.findIndex((item) =>
              item.label.toLowerCase().startsWith(e.key.toLowerCase()),
            );
            if (idx >= 0) setActiveIndex(idx);
          }
          break;
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
  }, [onClose, activeIndex, actionItems]);

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

  let actionIdx = -1;

  return ReactDOM.createPortal(
    <AnimatePresence>
      <motion.div
        ref={menuRef}
        className="fixed z-[100] min-w-[180px] border border-rally-blue/20 bg-rally-dark-surface py-1 shadow-elevation-3 rounded-md"
        style={{
          left: position.x,
          top: position.y,
        }}
        variants={contextMenuVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        role="menu"
      >
        {items.map((item, index) => {
          if (item.divider && !item.label) {
            return (
              <div
                key={`divider-${index}`}
                className="my-1 h-px bg-gradient-to-r from-transparent via-rally-border to-transparent"
              />
            );
          }

          actionIdx++;
          const currentActionIdx = actionIdx;

          return (
            <button
              key={index}
              className={cn(
                'flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm font-body transition-colors duration-fast',
                item.danger
                  ? 'text-rally-magenta hover:bg-rally-magenta/10'
                  : 'text-rally-text hover:bg-rally-blue/10 hover:text-rally-blue',
                activeIndex === currentActionIdx &&
                  (item.danger ? 'bg-rally-magenta/10' : 'bg-rally-blue/10 text-rally-blue'),
              )}
              role="menuitem"
              tabIndex={-1}
              onMouseEnter={() => setActiveIndex(currentActionIdx)}
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
          );
        })}
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
