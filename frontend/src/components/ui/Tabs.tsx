import React from 'react';
import { cn } from '@/lib/utils';

interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export function Tabs({ tabs, activeTab, onTabChange }: TabsProps) {
  return (
    <div className="flex border-b border-rally-border/40">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'relative flex items-center gap-2 px-4 py-2.5 text-sm font-display font-semibold uppercase tracking-wider transition-colors duration-200',
              isActive
                ? 'text-rally-blue'
                : 'text-rally-text-muted hover:text-rally-text',
            )}
          >
            {tab.icon && (
              <span className="flex items-center text-current">{tab.icon}</span>
            )}
            <span>{tab.label}</span>

            {/* Active indicator line with neon glow */}
            {isActive && (
              <span
                className="absolute bottom-0 left-0 right-0 h-[2px] bg-rally-blue"
                style={{
                  boxShadow:
                    '0 0 8px rgba(0, 217, 255, 0.5), 0 0 16px rgba(0, 217, 255, 0.2)',
                }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
