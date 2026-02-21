import { X, CheckCircle, AlertTriangle, Info } from 'lucide-react';
import { useToastStore, type ToastType } from '@/stores/toastStore';
import { cn } from '@/lib/utils';

const icons: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle className="h-4 w-4 text-rally-green" />,
  error: <AlertTriangle className="h-4 w-4 text-rally-magenta" />,
  info: <Info className="h-4 w-4 text-rally-blue" />,
};

const accents: Record<ToastType, string> = {
  success: 'border-l-rally-green shadow-[0_0_12px_rgba(57,255,20,0.15)]',
  error: 'border-l-rally-magenta shadow-[0_0_12px_rgba(255,0,110,0.15)]',
  info: 'border-l-rally-blue shadow-[0_0_12px_rgba(0,217,255,0.15)]',
};

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col-reverse gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            'pointer-events-auto flex items-center gap-3 rounded border border-white/10 border-l-2 bg-[#0D1117]/95 backdrop-blur-sm px-4 py-3 min-w-[280px] max-w-[400px] animate-slide-in-right',
            accents[toast.type],
          )}
        >
          {icons[toast.type]}
          <span className="flex-1 text-sm text-gray-200 font-body">{toast.message}</span>
          <button
            onClick={() => removeToast(toast.id)}
            className="shrink-0 p-0.5 text-gray-500 hover:text-gray-300 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
