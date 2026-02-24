import { useState, useEffect } from 'react';
import api from '@/lib/api';

interface OgData {
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
  url: string;
}

// Simple in-memory cache to avoid re-fetching
const ogCache = new Map<string, OgData | null>();

export function LinkPreview({ url }: { url: string }) {
  const [data, setData] = useState<OgData | null>(ogCache.get(url) ?? null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (ogCache.has(url)) {
      setData(ogCache.get(url) ?? null);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `${(api as any).baseURL ?? ''}/api/og?url=${encodeURIComponent(url)}`,
        );
        if (!res.ok) throw new Error('fetch failed');
        const og: OgData = await res.json();
        ogCache.set(url, og);
        if (!cancelled) setData(og);
      } catch {
        ogCache.set(url, null);
      }
    })();

    return () => { cancelled = true; };
  }, [url]);

  if (!data || hidden || (!data.title && !data.description)) return null;

  return (
    <div className="mt-1.5 flex max-w-[520px] overflow-hidden rounded-md border border-white/10 bg-[#0D1117]">
      {/* Left accent bar */}
      <div className="w-1 shrink-0 bg-rally-cyan/60" />

      <div className="flex flex-1 gap-3 p-3 min-w-0">
        <div className="flex-1 min-w-0">
          {data.siteName && (
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/30 mb-0.5">
              {data.siteName}
            </p>
          )}
          {data.title && (
            <a
              href={data.url || url}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-sm font-medium text-rally-cyan hover:underline truncate"
            >
              {data.title}
            </a>
          )}
          {data.description && (
            <p className="mt-0.5 text-xs text-white/40 line-clamp-2">
              {data.description}
            </p>
          )}
        </div>

        {data.image && (
          <img
            src={data.image}
            alt=""
            className="h-16 w-16 shrink-0 rounded object-cover"
            loading="lazy"
          />
        )}
      </div>
    </div>
  );
}

/** Extract the first URL from a message content string. */
export function extractFirstUrl(content: string): string | null {
  const match = content.match(/https?:\/\/[^\s<>)"']+/);
  return match?.[0] ?? null;
}
