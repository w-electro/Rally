import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';
import type { FeedPost, FeedComment } from '@/lib/types';
import { cn, formatDate, formatNumber, getInitials } from '@/lib/utils';
import {
  Heart,
  MessageCircle,
  Share2,
  Send,
  ChevronDown,
  ChevronUp,
  Play,
  Image as ImageIcon,
} from 'lucide-react';

interface FeedPostCardProps {
  post: FeedPost;
  onLike: (postId: string) => void;
}

export function FeedPostCard({ post, onLike }: FeedPostCardProps) {
  const user = useAuthStore((s) => s.user);
  const [comments, setComments] = useState<FeedComment[]>([]);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [replyTo, setReplyTo] = useState<FeedComment | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const mediaUrls = Array.isArray(post.mediaUrls) ? post.mediaUrls : [];
  const media = mediaUrls[0];
  const isVideo = media?.type === 'video';
  const author = post.author ?? { id: post.authorId, username: 'unknown', displayName: 'Unknown', avatarUrl: undefined };
  const hashtags = Array.isArray(post.hashtags) ? post.hashtags : [];

  useEffect(() => {
    // Comments would be loaded here via API
    // Simulating the structure for now
    setIsLoadingComments(false);
  }, [post.id]);

  const handleSubmitComment = async () => {
    if (!commentText.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const newComment = await api.commentOnPost(post.id, {
        content: commentText.trim(),
        replyToId: replyTo?.id,
      });
      if (replyTo) {
        setComments((prev) =>
          prev.map((c) =>
            c.id === replyTo.id
              ? { ...c, replies: [...(c.replies ?? []), newComment] }
              : c
          )
        );
      } else {
        setComments((prev) => [...prev, newComment]);
      }
      setCommentText('');
      setReplyTo(null);
    } catch {
      // silently handle
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmitComment();
    }
  };

  const renderCaption = (text: string) => {
    return (text ?? '').split(/(#[\w]+)/g).map((part, i) =>
      part.startsWith('#') ? (
        <span key={i} className="cursor-pointer font-medium text-rally-blue hover:underline">
          {part}
        </span>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  };

  return (
    <div className="flex h-[70vh] max-h-[600px] overflow-hidden border border-rally-blue/20 bg-rally-dark-surface">
      {/* Left: Media */}
      <div className="relative flex w-1/2 items-center justify-center bg-black">
        {media ? (
          isVideo ? (
            <div className="relative flex h-full w-full items-center justify-center">
              <img
                src={media.thumbnail ?? media.url}
                alt={post.caption ?? 'Post media'}
                className="h-full w-full object-contain"
                draggable={false}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-black/60 backdrop-blur-sm transition-transform hover:scale-110">
                  <Play className="h-8 w-8 text-white" fill="white" />
                </div>
              </div>
            </div>
          ) : (
            <img
              src={media.url}
              alt={post.caption ?? 'Post media'}
              className="h-full w-full object-contain"
              draggable={false}
            />
          )
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 text-rally-text-muted/40">
            <ImageIcon className="h-16 w-16" />
            <span className="font-display text-sm uppercase tracking-wider">
              No media
            </span>
          </div>
        )}
      </div>

      {/* Right: Details */}
      <div className="flex w-1/2 flex-col">
        {/* Author info */}
        <div className="flex items-center gap-3 border-b border-rally-border/50 px-4 py-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden"
            style={{
              clipPath: 'polygon(15% 0%, 100% 0%, 85% 100%, 0% 100%)',
            }}
          >
            {author.avatarUrl ? (
              <img
                src={author.avatarUrl}
                alt={author.displayName}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-neon-gradient text-xs font-bold text-rally-dark-surface">
                {getInitials(author.displayName)}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-sm font-bold text-rally-text">
              {author.displayName}
            </p>
            <p className="text-xs text-rally-text-muted">
              @{author.username}
            </p>
          </div>
          <span className="text-xs text-rally-text-muted">
            {formatDate(post.createdAt)}
          </span>
        </div>

        {/* Caption + Comments scroll area */}
        <div className="flex-1 overflow-y-auto">
          {/* Caption */}
          {post.caption && (
            <div className="border-b border-rally-border/30 px-4 py-3">
              <p className="font-body text-sm leading-relaxed text-rally-text">
                <span className="mr-2 font-display font-bold text-rally-text">
                  {author.username}
                </span>
                {renderCaption(post.caption)}
              </p>
              {hashtags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {hashtags.map((tag) => (
                    <span
                      key={tag}
                      className="cursor-pointer text-xs font-medium text-rally-blue hover:underline"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Comments */}
          <div className="px-4 py-2">
            {comments.length === 0 && !isLoadingComments && (
              <p className="py-4 text-center text-xs text-rally-text-muted">
                No comments yet. Be the first!
              </p>
            )}
            {comments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                onReply={(c) => setReplyTo(c)}
              />
            ))}
          </div>
        </div>

        {/* Action bar */}
        <div className="border-t border-rally-border/50 px-4 py-3">
          <div className="flex items-center gap-4">
            <button
              onClick={() => onLike(post.id)}
              className="group flex items-center gap-1.5 transition-transform active:scale-90"
              aria-label={post.isLiked ? 'Unlike' : 'Like'}
            >
              <Heart
                className={cn(
                  'h-6 w-6 transition-colors',
                  post.isLiked
                    ? 'fill-rally-magenta text-rally-magenta'
                    : 'text-rally-text-muted group-hover:text-rally-magenta'
                )}
              />
            </button>
            <button
              className="group transition-transform active:scale-90"
              aria-label="Comment"
            >
              <MessageCircle className="h-6 w-6 text-rally-text-muted transition-colors group-hover:text-rally-blue" />
            </button>
            <button
              className="group transition-transform active:scale-90"
              aria-label="Share"
            >
              <Share2 className="h-6 w-6 text-rally-text-muted transition-colors group-hover:text-rally-green" />
            </button>
          </div>
          <p className="mt-2 font-display text-sm font-bold text-rally-text">
            {formatNumber(post.likeCount ?? 0)} {post.likeCount === 1 ? 'like' : 'likes'}
          </p>
          <p className="mt-0.5 text-[10px] uppercase tracking-wider text-rally-text-muted">
            {formatDate(post.createdAt)}
          </p>
        </div>

        {/* Comment input */}
        <div className="border-t border-rally-border/50 px-4 py-3">
          {replyTo && (
            <div className="mb-2 flex items-center justify-between rounded bg-rally-surface px-3 py-1.5 text-xs text-rally-text-muted">
              <span>
                Replying to{' '}
                <span className="font-medium text-rally-blue">
                  @{replyTo.author?.username ?? 'unknown'}
                </span>
              </span>
              <button
                onClick={() => setReplyTo(null)}
                className="text-rally-text-muted hover:text-rally-magenta"
              >
                &times;
              </button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Add a comment..."
              className="flex-1 bg-transparent font-body text-sm text-rally-text placeholder:text-rally-text-muted/50 focus:outline-none"
            />
            <button
              onClick={handleSubmitComment}
              disabled={!commentText.trim() || isSubmitting}
              className={cn(
                'transition-colors',
                commentText.trim()
                  ? 'text-rally-blue hover:text-rally-blue/80'
                  : 'text-rally-text-muted/30'
              )}
              aria-label="Submit comment"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ==================== Comment Item ==================== */

interface CommentItemProps {
  comment: FeedComment;
  onReply: (comment: FeedComment) => void;
}

function CommentItem({ comment, onReply }: CommentItemProps) {
  const [showReplies, setShowReplies] = useState(false);
  const hasReplies = comment.replies && comment.replies.length > 0;

  return (
    <div className="py-2">
      <div className="flex gap-2.5">
        {/* Avatar */}
        <div
          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden"
          style={{
            clipPath: 'polygon(15% 0%, 100% 0%, 85% 100%, 0% 100%)',
          }}
        >
          {comment.author?.avatarUrl ? (
            <img
              src={comment.author.avatarUrl}
              alt={comment.author?.displayName ?? 'Unknown'}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-rally-surface-light text-[10px] font-bold text-rally-text-muted">
              {getInitials(comment.author?.displayName ?? 'Unknown')}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <p className="font-body text-xs leading-relaxed text-rally-text">
            <span className="mr-1.5 font-display font-bold">
              {comment.author?.username ?? 'unknown'}
            </span>
            {comment.content}
          </p>
          <div className="mt-1 flex items-center gap-3 text-[10px] text-rally-text-muted">
            <span>{formatDate(comment.createdAt)}</span>
            <button
              onClick={() => onReply(comment)}
              className="font-medium uppercase tracking-wider transition-colors hover:text-rally-blue"
            >
              Reply
            </button>
          </div>
        </div>
      </div>

      {/* Replies */}
      {hasReplies && (
        <div className="ml-9 mt-1">
          <button
            onClick={() => setShowReplies(!showReplies)}
            className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-rally-text-muted transition-colors hover:text-rally-blue"
          >
            <div className="mr-1 h-px w-4 bg-rally-text-muted/40" />
            {showReplies ? (
              <>
                <ChevronUp className="h-3 w-3" />
                Hide replies
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3" />
                View {comment.replies!.length}{' '}
                {comment.replies!.length === 1 ? 'reply' : 'replies'}
              </>
            )}
          </button>
          {showReplies && (
            <div className="mt-1">
              {comment.replies!.map((reply) => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  onReply={onReply}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
