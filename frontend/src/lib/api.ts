// In packaged Electron, file:// protocol can't use relative paths for API calls.
// Detect Electron and use the full server URL instead.
function getServerUrl(): string {
  if (typeof window !== 'undefined' && (window as any).electronAPI) {
    // Desktop app: connect to the backend server directly
    return localStorage.getItem('rally_server_url') || 'http://localhost:3001';
  }
  return ''; // Web app: relative paths work via Vite proxy / same-origin
}

export const SERVER_URL = getServerUrl();
const API_BASE = `${SERVER_URL}/api`;

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('rally_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(body.message || `Request failed: ${res.status}`);
  }

  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
