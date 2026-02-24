import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

export function Toggle({ checked, onChange, label, disabled, size = 'md' }: ToggleProps) {
  const sizes = {
    sm: { track: 'w-8 h-4', thumb: 'w-3 h-3', translate: 15 },
    md: { track: 'w-11 h-6', thumb: 'w-5 h-5', translate: 20 },
  };

  const s = sizes[size];

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={cn(
        'relative inline-flex shrink-0 cursor-pointer items-center rounded-full transition-colors duration-normal',
        s.track,
        checked ? 'bg-rally-green' : 'bg-rally-border',
        disabled && 'opacity-40 cursor-not-allowed',
      )}
    >
      <motion.span
        className={cn(
          'block rounded-full bg-white shadow-sm',
          s.thumb,
        )}
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        style={{ marginLeft: checked ? s.translate : 2 }}
      />
    </button>
  );
}
