import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import api from '@/lib/api';
import type { PulsePost, TrendingHashtag } from '@/lib/types';
import { PulsePostCard } from './PulsePostCard';
import { cn, formatNumber } from '@/lib/utils';
import { Flame, TrendingUp, Users, Sparkles, Send, Image, Hash } from 'lucide-react';

export function PulseView() {
  const { user } = useAuthStore();
  const [posts, setPosts] = useState<PulsePost[]>([]);
  const [trending, setTrending] = useState<TrendingHashtag[]>([]);
  const [activeTab, setActiveTab] = useState<'foryou' | 'following' | 'trending'>('foryou');
  const [newPost, setNewPost] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadFeed();
    loadTrending();
  }, []);

  const loadFeed = async () => {
    setIsLoading(true);
    try {
      const data = await api.getPulseFeed();
      setPosts(data);
    } catch {}
    setIsLoading(false);
  };

  const loadTrending = async () => {
    try {
      const data = await api.getTrending();
      setTrending(data);
    } catch {}
  };

  const handlePost = async () => {
    if (!newPost.trim()) return;
    setIsPosting(true);
    try {
      const hashtags = newPost.match(/#[\w]+/g)?.map((t) => t.slice(1)) || [];
      const post = await api.createPulsePost({ content: newPost, hashtags });
      setPosts([post, ...posts]);
      setNewPost('');
    } catch {}
    setIsPosting(false);
  };

  const handleLike = async (postId: string) => {
    try {
      await api.likePulsePost(postId);
      setPosts(posts.map((p) => p.id === postId ? { ...p, isLiked: !p.isLiked, likeCount: p.isLiked ? p.likeCount - 1 : p.likeCount + 1 } : p));
    } catch {}
  };

  const handleRepost = async (postId: string) => {
    try {
      await api.repostPulsePost(postId);
      setPosts(posts.map((p) => p.id === postId ? { ...p, isReposted: !p.isReposted, repostCount: p.isReposted ? p.repostCount - 1 : p.repostCount + 1 } : p));
    } catch {}
  };

  return (
    <div className="flex-1 flex bg-black min-h-0 overflow-hidden">
      {/* Main Feed */}
      <div className="flex-1 flex flex-col max-w-2xl mx-auto border-x border-rally-border">
        {/* Header */}
        <div className="border-b border-rally-border">
          <div className="px-4 pt-3 pb-0">
            <h1 className="font-display text-xl font-bold text-rally-text flex items-center gap-2">
              <Flame className="w-5 h-5 text-rally-blue" />
              The Pulse
            </h1>
          </div>
          <div className="flex mt-3">
            {[
              { id: 'foryou', label: 'For You', icon: Sparkles },
              { id: 'following', label: 'Following', icon: Users },
              { id: 'trending', label: 'Trending', icon: TrendingUp },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  'flex-1 py-3 text-sm font-display font-semibold text-center transition-colors relative',
                  activeTab === tab.id ? 'text-rally-blue' : 'text-rally-text-muted hover:text-rally-text hover:bg-white/5'
                )}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-rally-blue rounded-full shadow-neon-blue" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Compose */}
        <div className="border-b border-rally-border p-4">
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rally-blue to-rally-green flex items-center justify-center text-black font-bold text-sm flex-shrink-0">
              {user?.displayName?.[0]?.toUpperCase() || '?'}
            </div>
            <div className="flex-1">
              <textarea
                value={newPost}
                onChange={(e) => setNewPost(e.target.value)}
                placeholder="What's happening in your world?"
                className="w-full bg-transparent text-rally-text placeholder-rally-text-muted text-sm resize-none outline-none min-h-[60px]"
                maxLength={280}
              />
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-2">
                  <button className="p-1.5 rounded hover:bg-rally-blue/10 text-rally-blue transition-colors">
                    <Image className="w-4 h-4" />
                  </button>
                  <button className="p-1.5 rounded hover:bg-rally-blue/10 text-rally-blue transition-colors">
                    <Hash className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  {newPost.length > 0 && (
                    <span className={cn('text-xs', newPost.length > 260 ? 'text-rally-magenta' : 'text-rally-text-muted')}>
                      {280 - newPost.length}
                    </span>
                  )}
                  <button onClick={handlePost} disabled={!newPost.trim() || isPosting} className="btn-rally-primary px-4 py-1.5 text-xs disabled:opacity-50">
                    <Send className="w-3.5 h-3.5 inline mr-1" />
                    Post
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Posts */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="w-6 h-6 border-2 border-rally-blue border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-12">
              <Flame className="w-12 h-12 text-rally-text-muted mx-auto mb-3" />
              <p className="text-rally-text-muted">No posts yet. Be the first!</p>
            </div>
          ) : (
            posts.map((post) => (
              <PulsePostCard key={post.id} post={post} onLike={handleLike} onRepost={handleRepost} />
            ))
          )}
        </div>
      </div>

      {/* Trending Sidebar */}
      <div className="w-80 border-l border-rally-border p-4 overflow-y-auto hidden xl:block">
        <div className="card-rally rounded-lg p-4 mb-4">
          <h3 className="font-display font-bold text-rally-text mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-rally-blue" />
            Trending Now
          </h3>
          {trending.map((tag, i) => (
            <button key={tag.id} className="w-full text-left py-2.5 hover:bg-white/5 rounded px-2 transition-colors">
              <p className="text-xs text-rally-text-muted">{i + 1} · Trending</p>
              <p className="font-semibold text-rally-text text-sm">#{tag.tag}</p>
              <p className="text-xs text-rally-text-muted">{formatNumber(tag.postCount)} posts</p>
            </button>
          ))}
        </div>

        <div className="card-rally rounded-lg p-4">
          <h3 className="font-display font-bold text-rally-text mb-3">Who to follow</h3>
          <p className="text-sm text-rally-text-muted">Suggestions based on your interests will appear here.</p>
        </div>
      </div>
    </div>
  );
}
