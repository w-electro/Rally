import type { PulsePost } from '@/lib/types';
import { cn, formatDate, formatNumber } from '@/lib/utils';
import { Heart, Repeat2, MessageCircle, Eye, Share, MoreHorizontal } from 'lucide-react';

interface PulsePostCardProps {
  post: PulsePost;
  onLike: (postId: string) => void;
  onRepost: (postId: string) => void;
}

export function PulsePostCard({ post, onLike, onRepost }: PulsePostCardProps) {
  return (
    <article className="border-b border-rally-border px-4 py-3 hover:bg-white/[0.02] transition-colors">
      <div className="flex gap-3">
        {/* Avatar */}
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-black font-bold text-sm flex-shrink-0"
          style={{ background: `linear-gradient(135deg, #00D9FF, #39FF14)` }}
        >
          {post.author?.avatarUrl ? (
            <img src={post.author.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
          ) : (
            post.author?.displayName?.[0]?.toUpperCase() || '?'
          )}
        </div>

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-1.5 text-sm">
            <span className="font-semibold text-rally-text truncate">{post.author?.displayName}</span>
            <span className="text-rally-text-muted truncate">@{post.author?.username}</span>
            <span className="text-rally-text-muted">·</span>
            <span className="text-rally-text-muted text-xs">{formatDate(post.createdAt)}</span>
            <button className="ml-auto p-1 rounded hover:bg-white/10 text-rally-text-muted">
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>

          {/* Reply indicator */}
          {post.replyToId && (
            <p className="text-xs text-rally-text-muted mb-1">
              Replying to a post
            </p>
          )}

          {/* Content */}
          <p className="text-sm text-rally-text whitespace-pre-wrap mt-0.5 leading-relaxed">
            {post.content.split(/(#[\w]+)/g).map((part, i) =>
              part.startsWith('#') ? (
                <span key={i} className="text-rally-blue hover:underline cursor-pointer">{part}</span>
              ) : (
                <span key={i}>{part}</span>
              )
            )}
          </p>

          {/* Media */}
          {post.mediaUrls && post.mediaUrls.length > 0 && (
            <div className={cn(
              'mt-2 rounded-lg overflow-hidden border border-rally-border grid gap-0.5',
              post.mediaUrls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
            )}>
              {post.mediaUrls.map((media, i) => (
                <div key={i} className="bg-rally-navy aspect-video flex items-center justify-center">
                  {media.type === 'image' ? (
                    <img src={media.url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-rally-text-muted text-sm">Video</div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between mt-2 max-w-md">
            <button className="flex items-center gap-1.5 text-rally-text-muted hover:text-rally-blue transition-colors group">
              <div className="p-1.5 rounded-full group-hover:bg-rally-blue/10 transition-colors">
                <MessageCircle className="w-4 h-4" />
              </div>
              <span className="text-xs">{post.replyCount > 0 ? formatNumber(post.replyCount) : ''}</span>
            </button>

            <button
              onClick={() => onRepost(post.id)}
              className={cn(
                'flex items-center gap-1.5 transition-colors group',
                post.isReposted ? 'text-rally-green' : 'text-rally-text-muted hover:text-rally-green'
              )}
            >
              <div className="p-1.5 rounded-full group-hover:bg-rally-green/10 transition-colors">
                <Repeat2 className="w-4 h-4" />
              </div>
              <span className="text-xs">{post.repostCount > 0 ? formatNumber(post.repostCount) : ''}</span>
            </button>

            <button
              onClick={() => onLike(post.id)}
              className={cn(
                'flex items-center gap-1.5 transition-colors group',
                post.isLiked ? 'text-rally-magenta' : 'text-rally-text-muted hover:text-rally-magenta'
              )}
            >
              <div className="p-1.5 rounded-full group-hover:bg-rally-magenta/10 transition-colors">
                <Heart className={cn('w-4 h-4', post.isLiked && 'fill-current')} />
              </div>
              <span className="text-xs">{post.likeCount > 0 ? formatNumber(post.likeCount) : ''}</span>
            </button>

            <button className="flex items-center gap-1.5 text-rally-text-muted hover:text-rally-blue transition-colors group">
              <div className="p-1.5 rounded-full group-hover:bg-rally-blue/10 transition-colors">
                <Eye className="w-4 h-4" />
              </div>
              <span className="text-xs">{post.viewCount > 0 ? formatNumber(post.viewCount) : ''}</span>
            </button>

            <button className="p-1.5 rounded-full hover:bg-rally-blue/10 text-rally-text-muted hover:text-rally-blue transition-colors">
              <Share className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
