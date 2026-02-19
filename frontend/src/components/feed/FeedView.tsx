import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';
import type { FeedPost, MediaItem } from '@/lib/types';
import { cn, formatNumber, extractHashtags } from '@/lib/utils';
import {
  Plus,
  Heart,
  MessageCircle,
  Image,
  Film,
  X,
  Hash,
  Loader2,
} from 'lucide-react';
import { FeedPostCard } from './FeedPostCard';

interface FeedViewProps {
  channelId: string;
  channelName?: string;
}

export function FeedView({ channelId, channelName = 'Feed' }: FeedViewProps) {
  const user = useAuthStore((s) => s.user);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [selectedPost, setSelectedPost] = useState<FeedPost | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const fetchPosts = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.getFeedPosts(channelId);
      setPosts(data ?? []);
      if (data && data.length > 0) {
        setCursor(data[data.length - 1].id);
      }
      setHasMore((data?.length ?? 0) >= 20);
    } catch {
      // silently handle
    } finally {
      setIsLoading(false);
    }
  }, [channelId]);

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore || !cursor) return;
    setIsLoadingMore(true);
    try {
      const data = await api.getFeedPosts(channelId, cursor);
      if (data && data.length > 0) {
        setPosts((prev) => [...prev, ...data]);
        setCursor(data[data.length - 1].id);
        setHasMore(data.length >= 20);
      } else {
        setHasMore(false);
      }
    } catch {
      // silently handle
    } finally {
      setIsLoadingMore(false);
    }
  }, [channelId, cursor, hasMore, isLoadingMore]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (sentinelRef.current) {
      observerRef.current.observe(sentinelRef.current);
    }

    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, [hasMore, isLoadingMore, loadMore]);

  const handleLikeToggle = async (postId: string) => {
    try {
      await api.likeFeedPost(postId);
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                isLiked: !p.isLiked,
                likeCount: p.isLiked ? p.likeCount - 1 : p.likeCount + 1,
              }
            : p
        )
      );
      if (selectedPost?.id === postId) {
        setSelectedPost((prev) =>
          prev
            ? {
                ...prev,
                isLiked: !prev.isLiked,
                likeCount: prev.isLiked
                  ? prev.likeCount - 1
                  : prev.likeCount + 1,
              }
            : null
        );
      }
    } catch {
      // silently handle
    }
  };

  return (
    <div className="flex h-full flex-col bg-rally-dark-surface">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-rally-border/50 px-6 py-4">
        <div className="flex items-center gap-3">
          <Image className="h-5 w-5 text-rally-blue" />
          <h1 className="font-display text-xl font-bold uppercase tracking-wider text-rally-text">
            {channelName}
          </h1>
        </div>
        <button
          onClick={() => setShowCreateDialog(true)}
          className="flex items-center gap-2 rounded-none px-4 py-2 font-display text-sm font-bold uppercase tracking-wider text-rally-dark-surface transition-all duration-200 hover:shadow-neon-blue bg-neon-gradient"
          style={{
            clipPath:
              'polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)',
          }}
        >
          <Plus className="h-4 w-4" />
          New Post
        </button>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-rally-blue" />
          </div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-rally-text-muted">
            <Image className="mb-4 h-16 w-16 opacity-30" />
            <p className="font-display text-lg uppercase tracking-wider">
              No posts yet
            </p>
            <p className="mt-1 text-sm">
              Be the first to share something!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1">
            {posts.map((post) => (
              <FeedThumbnail
                key={post.id}
                post={post}
                onClick={() => setSelectedPost(post)}
              />
            ))}
          </div>
        )}

        {/* Infinite scroll sentinel */}
        <div ref={sentinelRef} className="h-4" />

        {isLoadingMore && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-rally-blue" />
          </div>
        )}
      </div>

      {/* Post Detail Modal */}
      {selectedPost && (
        <PostDetailModal
          post={selectedPost}
          onClose={() => setSelectedPost(null)}
          onLike={handleLikeToggle}
        />
      )}

      {/* Create Post Dialog */}
      {showCreateDialog && (
        <CreatePostDialog
          channelId={channelId}
          onClose={() => setShowCreateDialog(false)}
          onCreated={(post) => {
            setPosts((prev) => [post, ...prev]);
            setShowCreateDialog(false);
          }}
        />
      )}
    </div>
  );
}

/* ==================== Feed Thumbnail ==================== */

interface FeedThumbnailProps {
  post: FeedPost;
  onClick: () => void;
}

function FeedThumbnail({ post, onClick }: FeedThumbnailProps) {
  const media = post.mediaUrls[0];
  const isVideo = media?.type === 'video';

  return (
    <button
      onClick={onClick}
      className="group relative aspect-square w-full overflow-hidden bg-rally-surface focus:outline-none focus:ring-1 focus:ring-rally-blue"
    >
      {media ? (
        <img
          src={media.thumbnail ?? media.url}
          alt={post.caption ?? 'Feed post'}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          draggable={false}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-rally-surface">
          <Image className="h-8 w-8 text-rally-text-muted/30" />
        </div>
      )}

      {isVideo && (
        <div className="absolute right-2 top-2">
          <Film className="h-4 w-4 text-white drop-shadow-lg" />
        </div>
      )}

      {/* Hover overlay */}
      <div className="absolute inset-0 flex items-center justify-center gap-4 bg-black/60 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        <span className="flex items-center gap-1.5 text-sm font-bold text-white">
          <Heart className="h-4 w-4 fill-white" />
          {formatNumber(post.likeCount)}
        </span>
        <span className="flex items-center gap-1.5 text-sm font-bold text-white">
          <MessageCircle className="h-4 w-4 fill-white" />
          {formatNumber(post.commentCount)}
        </span>
      </div>
    </button>
  );
}

/* ==================== Post Detail Modal ==================== */

interface PostDetailModalProps {
  post: FeedPost;
  onClose: () => void;
  onLike: (postId: string) => void;
}

function PostDetailModal({ post, onClose, onLike }: PostDetailModalProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div className="relative z-10 mx-4 w-full max-w-5xl animate-scale-in">
        <button
          onClick={onClose}
          className="absolute -right-2 -top-10 p-2 text-rally-text-muted transition-colors hover:text-white"
          aria-label="Close"
        >
          <X className="h-6 w-6" />
        </button>
        <FeedPostCard post={post} onLike={onLike} />
      </div>
    </div>
  );
}

/* ==================== Create Post Dialog ==================== */

interface CreatePostDialogProps {
  channelId: string;
  onClose: () => void;
  onCreated: (post: FeedPost) => void;
}

function CreatePostDialog({
  channelId,
  onClose,
  onCreated,
}: CreatePostDialogProps) {
  const [caption, setCaption] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);

  const hashtags = extractHashtags(caption);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const handleMediaSelect = () => {
    // Placeholder for file upload
    setMediaPreview('/placeholder-media.jpg');
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const mediaUrls: MediaItem[] = mediaPreview
        ? [{ url: mediaPreview, type: 'image' }]
        : [];
      const post = await api.createFeedPost(channelId, {
        caption,
        mediaUrls,
        hashtags,
      });
      onCreated(post);
    } catch {
      // silently handle
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div className="relative z-10 mx-4 w-full max-w-lg animate-scale-in">
        <div className="border border-rally-blue/20 bg-rally-dark-surface">
          {/* Top accent */}
          <div className="h-px bg-gradient-to-r from-transparent via-rally-blue to-transparent" />

          {/* Header */}
          <div className="flex items-center justify-between border-b border-rally-border/50 px-6 py-4">
            <h2 className="font-display text-lg font-bold uppercase tracking-wider text-rally-text">
              Create Post
            </h2>
            <button
              onClick={onClose}
              className="text-rally-text-muted transition-colors hover:text-rally-magenta"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          <div className="space-y-4 px-6 py-5">
            {/* Media Upload Area */}
            <button
              onClick={handleMediaSelect}
              className={cn(
                'flex w-full flex-col items-center justify-center gap-3 border-2 border-dashed transition-colors',
                mediaPreview
                  ? 'border-rally-blue/40 bg-rally-surface'
                  : 'border-rally-border/50 bg-rally-surface hover:border-rally-blue/40'
              )}
              style={{ minHeight: '200px' }}
            >
              {mediaPreview ? (
                <div className="relative w-full">
                  <img
                    src={mediaPreview}
                    alt="Preview"
                    className="h-48 w-full object-cover"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <p className="font-display text-sm uppercase tracking-wider text-white">
                      Click to change
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rally-surface-light">
                    <Image className="h-6 w-6 text-rally-blue" />
                  </div>
                  <p className="font-display text-sm uppercase tracking-wider text-rally-text-muted">
                    Add photos or videos
                  </p>
                  <p className="text-xs text-rally-text-muted/60">
                    Click to upload media
                  </p>
                </>
              )}
            </button>

            {/* Caption */}
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Write a caption..."
              rows={3}
              className="w-full resize-none border border-rally-border/50 bg-rally-surface px-4 py-3 font-body text-sm text-rally-text placeholder:text-rally-text-muted/50 focus:border-rally-blue/50 focus:outline-none"
            />

            {/* Hashtag preview */}
            {hashtags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {hashtags.map((tag) => (
                  <span
                    key={tag}
                    className="flex items-center gap-1 bg-rally-blue/10 px-2 py-1 text-xs font-medium text-rally-blue"
                  >
                    <Hash className="h-3 w-3" />
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end border-t border-rally-border/50 px-6 py-4">
            <button
              onClick={onClose}
              className="mr-3 px-4 py-2 font-display text-sm uppercase tracking-wider text-rally-text-muted transition-colors hover:text-rally-text"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2 font-display text-sm font-bold uppercase tracking-wider text-rally-dark-surface transition-all duration-200 hover:shadow-neon-blue bg-neon-gradient disabled:opacity-50"
              style={{
                clipPath:
                  'polygon(6px 0, 100% 0, calc(100% - 6px) 100%, 0 100%)',
              }}
            >
              {isSubmitting && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Post
            </button>
          </div>

          {/* Bottom accent */}
          <div className="h-px bg-gradient-to-r from-transparent via-rally-blue/40 to-transparent" />
        </div>
      </div>
    </div>
  );
}
