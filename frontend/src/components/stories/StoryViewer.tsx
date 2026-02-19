import { useState, useEffect, useCallback } from 'react';
import type { Story } from '@/lib/types';
import { X, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import api from '@/lib/api';

interface StoryViewerProps {
  stories: Story[];
  initialIndex?: number;
  onClose: () => void;
}

export function StoryViewer({ stories, initialIndex = 0, onClose }: StoryViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);
  const story = stories[currentIndex];

  const goNext = useCallback(() => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setProgress(0);
    } else {
      onClose();
    }
  }, [currentIndex, stories.length, onClose]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setProgress(0);
    }
  }, [currentIndex]);

  // Auto-advance timer
  useEffect(() => {
    if (!story || story.mediaType === 'VIDEO') return;

    const duration = 5000;
    const interval = 50;
    let elapsed = 0;

    const timer = setInterval(() => {
      elapsed += interval;
      setProgress((elapsed / duration) * 100);
      if (elapsed >= duration) goNext();
    }, interval);

    return () => clearInterval(timer);
  }, [currentIndex, story, goNext]);

  // Mark as viewed
  useEffect(() => {
    if (story) {
      api.getStories(story.serverId).catch(() => {}); // Placeholder view tracking
    }
  }, [story]);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, goNext, goPrev]);

  if (!story) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center">
      {/* Close button */}
      <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 text-white transition-colors z-10">
        <X className="w-6 h-6" />
      </button>

      {/* Navigation areas */}
      <button onClick={goPrev} className={cn('absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 hover:bg-black/80 text-white transition-colors', currentIndex === 0 && 'opacity-30 pointer-events-none')}>
        <ChevronLeft className="w-6 h-6" />
      </button>
      <button onClick={goNext} className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 hover:bg-black/80 text-white transition-colors">
        <ChevronRight className="w-6 h-6" />
      </button>

      {/* Story container */}
      <div className="relative w-full max-w-sm aspect-[9/16] bg-rally-navy rounded-lg overflow-hidden">
        {/* Progress bars */}
        <div className="absolute top-0 left-0 right-0 z-10 flex gap-1 p-2">
          {stories.map((_, i) => (
            <div key={i} className="flex-1 h-0.5 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-100"
                style={{ width: i < currentIndex ? '100%' : i === currentIndex ? `${progress}%` : '0%' }}
              />
            </div>
          ))}
        </div>

        {/* Author info */}
        <div className="absolute top-6 left-3 right-3 z-10 flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-rally-blue to-rally-green flex items-center justify-center text-black font-bold text-xs">
            {story.author?.displayName?.[0]?.toUpperCase() || '?'}
          </div>
          <span className="text-white text-sm font-semibold">{story.author?.displayName}</span>
          <span className="text-white/60 text-xs">{formatDate(story.createdAt)}</span>
        </div>

        {/* Media */}
        <div className="w-full h-full flex items-center justify-center">
          {story.mediaType === 'IMAGE' ? (
            <img src={story.mediaUrl} alt="" className="w-full h-full object-cover" />
          ) : story.mediaType === 'VIDEO' ? (
            <video src={story.mediaUrl} className="w-full h-full object-cover" autoPlay muted />
          ) : (
            <div className="p-8 text-center">
              <p className="text-white text-xl font-display">{story.caption}</p>
            </div>
          )}
        </div>

        {/* Caption overlay */}
        {story.caption && story.mediaType !== 'TEXT' && (
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
            <p className="text-white text-sm">{story.caption}</p>
          </div>
        )}

        {/* View count */}
        <div className="absolute bottom-4 right-4 flex items-center gap-1 text-white/60 text-xs">
          <Eye className="w-3 h-3" />
          {story.viewCount}
        </div>
      </div>
    </div>
  );
}
