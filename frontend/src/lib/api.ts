function getApiBase(): string {
  // 1. Explicit override from localStorage (dev/testing)
  const serverUrl = localStorage.getItem('rally-server-url');
  if (serverUrl) return `${serverUrl.replace(/\/$/, '')}/api`;

  // 2. Build-time env var (production builds)
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) return `${envUrl.replace(/\/$/, '')}/api`;

  // 3. Fallback: same origin via Vite proxy (dev mode)
  return '/api';
}

class ApiClient {
  private token: string | null = null;

  getApiBase() {
    return getApiBase();
  }

  setToken(token: string | null) {
    this.token = token;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const res = await fetch(`${getApiBase()}${path}`, {
      ...options,
      headers,
    });

    if (res.status === 401) {
      // Try to refresh token
      const refreshed = await this.refreshToken();
      if (refreshed) {
        headers['Authorization'] = `Bearer ${this.token}`;
        const retryRes = await fetch(`${getApiBase()}${path}`, { ...options, headers });
        if (!retryRes.ok) {
          const err = await retryRes.json().catch(() => ({ error: 'Request failed' }));
          throw new Error(err.error || 'Request failed');
        }
        return retryRes.json();
      }
      // Refresh failed, clear auth and throw — let the store handle navigation
      this.token = null;
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('rally-auth');
      throw new Error('Session expired');
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(err.error || `Request failed: ${res.status}`);
    }

    if (res.status === 204) return undefined as T;
    return res.json();
  }

  private async refreshToken(): Promise<boolean> {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) return false;

    try {
      const res = await fetch(`${getApiBase()}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!res.ok) return false;

      const data = await res.json();
      this.token = data.accessToken;
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);

      // Sync the new refresh token to saved accounts
      try {
        const raw = localStorage.getItem('rally-saved-accounts');
        if (raw) {
          const accounts = JSON.parse(raw);
          const updated = accounts.map((a: any) =>
            a.refreshToken === refreshToken ? { ...a, refreshToken: data.refreshToken, lastUsed: Date.now() } : a
          );
          localStorage.setItem('rally-saved-accounts', JSON.stringify(updated));
        }
      } catch {}

      return true;
    } catch {
      return false;
    }
  }

  // Auth
  register(data: { email: string; username: string; displayName: string; password: string }) {
    return this.request<{ user: any; accessToken: string; refreshToken: string }>('/auth/register', {
      method: 'POST', body: JSON.stringify(data),
    });
  }

  login(data: { email: string; password: string }) {
    return this.request<{ user: any; accessToken: string; refreshToken: string }>('/auth/login', {
      method: 'POST', body: JSON.stringify(data),
    });
  }

  getMe() {
    return this.request<any>('/auth/me');
  }

  logout() {
    const refreshToken = localStorage.getItem('refreshToken');
    return this.request('/auth/logout', {
      method: 'POST', body: JSON.stringify({ refreshToken }),
    });
  }

  // Servers
  getServers() { return this.request<any[]>('/servers'); }
  getServer(id: string) { return this.request<any>(`/servers/${id}`); }
  createServer(data: { name: string; description?: string; isPublic?: boolean }) {
    return this.request<any>('/servers', { method: 'POST', body: JSON.stringify(data) });
  }
  updateServer(id: string, data: any) {
    return this.request<any>(`/servers/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  }
  deleteServer(id: string) {
    return this.request(`/servers/${id}`, { method: 'DELETE' });
  }
  joinServer(id: string) {
    return this.request<any>(`/servers/${id}/join`, { method: 'POST' });
  }
  leaveServer(id: string) {
    return this.request(`/servers/${id}/leave`, { method: 'POST' });
  }
  getServerMembers(id: string) {
    return this.request<any[]>(`/servers/${id}/members`);
  }

  // Channels
  createChannel(serverId: string, data: { name: string; type: string; parentId?: string }) {
    return this.request<any>(`/servers/${serverId}/channels`, { method: 'POST', body: JSON.stringify(data) });
  }
  updateChannel(serverId: string, channelId: string, data: any) {
    return this.request<any>(`/servers/${serverId}/channels/${channelId}`, { method: 'PATCH', body: JSON.stringify(data) });
  }
  deleteChannel(serverId: string, channelId: string) {
    return this.request(`/servers/${serverId}/channels/${channelId}`, { method: 'DELETE' });
  }

  // Messages
  getMessages(channelId: string, cursor?: string) {
    const params = cursor ? `?cursor=${cursor}` : '';
    return this.request<any[]>(`/servers/channels/${channelId}/messages${params}`);
  }

  // Feed
  getFeedPosts(channelId: string, cursor?: string) {
    const params = cursor ? `?cursor=${cursor}` : '';
    return this.request<any[]>(`/feed/${channelId}/posts${params}`);
  }
  createFeedPost(channelId: string, data: { caption?: string; mediaUrls: any[]; hashtags?: string[] }) {
    return this.request<any>(`/feed/${channelId}/posts`, { method: 'POST', body: JSON.stringify(data) });
  }
  likeFeedPost(postId: string) {
    return this.request<any>(`/feed/posts/${postId}/like`, { method: 'POST' });
  }
  commentOnPost(postId: string, data: { content: string; replyToId?: string }) {
    return this.request<any>(`/feed/posts/${postId}/comments`, { method: 'POST', body: JSON.stringify(data) });
  }

  // Stories
  getStories(serverId: string) {
    return this.request<any[]>(`/stories/server/${serverId}`);
  }
  createStory(serverId: string, data: { mediaUrl: string; mediaType: string; caption?: string }) {
    return this.request<any>(`/stories/server/${serverId}`, { method: 'POST', body: JSON.stringify(data) });
  }

  // Pulse
  getPulseFeed(cursor?: string) {
    const params = cursor ? `?cursor=${cursor}` : '';
    return this.request<any[]>(`/pulse/feed${params}`);
  }
  getTrending() {
    return this.request<any[]>('/pulse/trending');
  }
  createPulsePost(data: { content: string; mediaUrls?: any[]; hashtags?: string[] }) {
    return this.request<any>('/pulse', { method: 'POST', body: JSON.stringify(data) });
  }
  likePulsePost(id: string) {
    return this.request<any>(`/pulse/${id}/like`, { method: 'POST' });
  }
  repostPulsePost(id: string) {
    return this.request<any>(`/pulse/${id}/repost`, { method: 'POST' });
  }

  // Points
  getPointBalance(serverId: string) {
    return this.request<any>(`/points/${serverId}/balance`);
  }
  getLeaderboard(serverId: string) {
    return this.request<any[]>(`/points/${serverId}/leaderboard`);
  }
  getRewards(serverId: string) {
    return this.request<any[]>(`/points/${serverId}/rewards`);
  }
  redeemReward(serverId: string, rewardId: string) {
    return this.request<any>(`/points/${serverId}/rewards/${rewardId}/redeem`, { method: 'POST' });
  }

  // Streaming
  getLiveStreams() {
    return this.request<any[]>('/stream/live');
  }
  startStream(data: { serverId: string; channelId: string; title: string; category?: string }) {
    return this.request<any>('/stream/start', { method: 'POST', body: JSON.stringify(data) });
  }
  endStream(sessionId: string) {
    return this.request<any>(`/stream/${sessionId}/end`, { method: 'POST' });
  }

  // AI
  summarizeChannel(channelId: string, messageCount = 50) {
    return this.request<any>('/ai/summarize', {
      method: 'POST', body: JSON.stringify({ channelId, messageCount }),
    });
  }
  aiChat(message: string, conversationHistory?: any[]) {
    return this.request<any>('/ai/chat', {
      method: 'POST', body: JSON.stringify({ message, conversationHistory }),
    });
  }

  // Commerce
  getProducts(serverId: string) {
    return this.request<any[]>(`/commerce/server/${serverId}/products`);
  }
  purchaseProduct(productId: string) {
    return this.request<any>(`/commerce/products/${productId}/purchase`, { method: 'POST' });
  }

  // Users
  getUserProfile(userId: string) {
    return this.request<any>(`/users/profile/${userId}`);
  }
  updateProfile(data: any) {
    return this.request<any>('/users/profile', { method: 'PATCH', body: JSON.stringify(data) });
  }
  sendFriendRequest(targetId: string) {
    return this.request<any>(`/users/friends/request/${targetId}`, { method: 'POST' });
  }
  getFriends() {
    return this.request<any>('/users/friends');
  }
  getFriendRequests() {
    return this.request<any>('/users/friends/requests');
  }
  acceptFriendRequest(requestId: string) {
    return this.request<any>(`/users/friends/accept/${requestId}`, { method: 'POST' });
  }
  declineFriendRequest(requestId: string) {
    return this.request<any>(`/users/friends/decline/${requestId}`, { method: 'POST' });
  }
  removeFriend(friendshipId: string) {
    return this.request<any>(`/users/friends/${friendshipId}`, { method: 'DELETE' });
  }
  searchUsers(query: string) {
    return this.request<any>(`/users/search?q=${encodeURIComponent(query)}`);
  }
  getDmConversations() {
    return this.request<any[]>('/users/dms');
  }
  getDmMessages(conversationId: string) {
    return this.request<any[]>(`/users/dms/${conversationId}/messages`);
  }
  createDmConversation(targetUserId: string) {
    return this.request<any>('/users/dms', { method: 'POST', body: JSON.stringify({ targetUserId }) });
  }
  deleteConversation(conversationId: string) {
    return this.request<any>(`/users/dms/${conversationId}`, { method: 'DELETE' });
  }
  getNotifications() {
    return this.request<any[]>('/users/notifications');
  }

  // Gaming
  getGameSessions(serverId: string) {
    return this.request<any[]>(`/gaming/server/${serverId}/sessions`);
  }
  createGameSession(data: any) {
    return this.request<any>('/gaming/sessions', { method: 'POST', body: JSON.stringify(data) });
  }
  rallyCall(serverId: string, message: string) {
    return this.request<any>('/gaming/rally', { method: 'POST', body: JSON.stringify({ serverId, message }) });
  }

  // Invites
  createInvite(serverId: string, options?: { expiresAt?: string; maxUses?: number }) {
    return this.request<any>(`/servers/${serverId}/invites`, {
      method: 'POST',
      body: JSON.stringify(options ?? {}),
    });
  }

  resolveInvite(code: string) {
    return this.request<any>(`/invites/${code}`);
  }

  joinByInvite(code: string) {
    return this.request<any>(`/invites/${code}/join`, { method: 'POST' });
  }

  // Roles
  getRoles(serverId: string) {
    return this.request<any>(`/servers/${serverId}/roles`);
  }
  createRole(serverId: string, data: { name: string; color?: string; permissions?: string }) {
    return this.request<any>(`/servers/${serverId}/roles`, { method: 'POST', body: JSON.stringify(data) });
  }
  updateRole(serverId: string, roleId: string, data: { name?: string; color?: string; permissions?: string; position?: number }) {
    return this.request<any>(`/servers/${serverId}/roles/${roleId}`, { method: 'PATCH', body: JSON.stringify(data) });
  }
  deleteRole(serverId: string, roleId: string) {
    return this.request<any>(`/servers/${serverId}/roles/${roleId}`, { method: 'DELETE' });
  }
  assignRole(serverId: string, memberId: string, roleId: string) {
    return this.request<any>(`/servers/${serverId}/members/${memberId}/roles`, { method: 'POST', body: JSON.stringify({ roleId }) });
  }
  removeRole(serverId: string, memberId: string, roleId: string) {
    return this.request<any>(`/servers/${serverId}/members/${memberId}/roles/${roleId}`, { method: 'DELETE' });
  }
}

export const api = new ApiClient();
export default api;
