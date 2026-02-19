import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatDate(date: string | Date): string {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();

  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return d.toLocaleDateString();
}

export function formatTime(date: string | Date): string {
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'ONLINE': return '#39FF14';
    case 'IDLE': return '#FFD700';
    case 'DND': return '#FF006E';
    case 'IN_GAME': return '#00D9FF';
    case 'STREAMING': return '#8B00FF';
    default: return '#8B949E';
  }
}

export function getChannelIcon(type: string): string {
  switch (type) {
    case 'TEXT': return '#';
    case 'VOICE': return '🔊';
    case 'FEED': return '📷';
    case 'STAGE': return '🎭';
    case 'ANNOUNCEMENT': return '📢';
    default: return '#';
  }
}

export function truncate(str: string, len: number): string {
  return str.length > len ? str.substring(0, len) + '...' : str;
}

export function extractHashtags(text: string): string[] {
  const matches = text.match(/#[\w]+/g);
  return matches ? matches.map((t) => t.slice(1)) : [];
}

export function generateAvatarGradient(id: string): string {
  const colors = [
    ['#00D9FF', '#39FF14'],
    ['#8B00FF', '#FF006E'],
    ['#FF006E', '#FFD700'],
    ['#39FF14', '#00D9FF'],
    ['#4B0082', '#00F0FF'],
  ];
  const index = id.charCodeAt(0) % colors.length;
  return `linear-gradient(135deg, ${colors[index][0]}, ${colors[index][1]})`;
}
