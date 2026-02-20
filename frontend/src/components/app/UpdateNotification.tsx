import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

interface UpdateInfo {
  version: string;
  releaseNotes?: string;
}

export function UpdateNotification() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api?.onUpdateDownloaded) return;

    const cleanup = api.onUpdateDownloaded((info: UpdateInfo) => {
      setUpdateInfo(info);
      setDismissed(false);
    });

    return () => {
      if (typeof cleanup === 'function') cleanup();
    };
  }, []);

  if (!updateInfo || dismissed) return null;

  const handleRestart = () => {
    (window as any).electronAPI?.installUpdate();
  };

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[200] rounded-lg border border-[#39FF14]/30 bg-[#0A0E27] px-4 py-3 shadow-2xl">
      <div className="flex items-center gap-3">
        <Download className="h-5 w-5 text-[#39FF14] shrink-0" />
        <span className="text-sm text-white/90 font-body whitespace-nowrap">
          Rally <span className="text-[#39FF14] font-bold">v{updateInfo.version}</span> is ready
        </span>
        <button
          onClick={handleRestart}
          className="ml-2 rounded-md bg-[#39FF14]/20 hover:bg-[#39FF14]/30 text-[#39FF14] px-3 py-1 text-sm font-display transition-colors"
        >
          Restart to Update
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="ml-1 text-white/40 hover:text-white/70 transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
