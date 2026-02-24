import { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  className?: string;
}

export function Select({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  label,
  disabled,
  className,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setOpen(false); return; }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!open) { setOpen(true); return; }
      if (activeIdx >= 0 && activeIdx < options.length) {
        onChange(options[activeIdx].value);
        setOpen(false);
      }
      return;
    }
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => (i + 1) % options.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => (i - 1 + options.length) % options.length);
    }
  };

  return (
    <div ref={ref} className={cn('relative', className)}>
      {label && (
        <label className="block mb-1 text-xs font-medium text-white/50 font-body uppercase tracking-wider">
          {label}
        </label>
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((p) => !p)}
        onKeyDown={handleKeyDown}
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm font-body',
          'bg-[#0D1117] border-white/10 text-white/80',
          'hover:border-rally-cyan/30 transition-colors duration-normal',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rally-cyan/50',
          disabled && 'opacity-40 cursor-not-allowed',
          open && 'border-rally-cyan/40',
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={cn(!selected && 'text-white/30')}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown className={cn('w-4 h-4 text-white/30 transition-transform', open && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            className="absolute z-50 mt-1 w-full rounded-md border border-rally-blue/20 bg-rally-dark-surface py-1 shadow-elevation-3 overflow-y-auto max-h-48"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.1 }}
          >
            {options.map((opt, i) => (
              <li
                key={opt.value}
                role="option"
                aria-selected={opt.value === value}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 text-sm font-body cursor-pointer transition-colors',
                  opt.value === value
                    ? 'text-rally-cyan bg-rally-cyan/10'
                    : 'text-white/70 hover:bg-white/5',
                  i === activeIdx && 'bg-rally-blue/10',
                )}
                onMouseEnter={() => setActiveIdx(i)}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
              >
                <span className="flex-1">{opt.label}</span>
                {opt.value === value && <Check className="w-3.5 h-3.5 text-rally-cyan" />}
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
