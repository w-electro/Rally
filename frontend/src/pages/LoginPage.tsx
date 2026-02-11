import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    username: string;
    discriminator: string;
    email: string | null;
    avatar: string | null;
  };
}

export default function LoginPage() {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { setToken, setUser } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const isEmail = login.includes('@');
      const body = isEmail
        ? { email: login, password }
        : { username: login, password };

      const data = await api.post<AuthResponse>('/auth/login', body);
      setToken(data.accessToken);
      setUser(data.user as any);
      navigate('/channels/@me');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-layout flex items-center justify-center bg-rally-darkBg">
      <div className="absolute inset-0 geo-pattern opacity-30" />
      <div className="relative w-full max-w-md mx-4">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold font-display text-gradient mb-2">
            Welcome back!
          </h1>
          <p className="text-rally-muted">We're so excited to see you again!</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-rally-darkerBg border border-primary rounded-xl p-8 space-y-5"
        >
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-rally-muted uppercase tracking-wide mb-2">
              Email or Username
            </label>
            <input
              type="text"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              className="rally-input"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-rally-muted uppercase tracking-wide mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rally-input"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="rally-btn-primary w-full py-3 text-base"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              'Log In'
            )}
          </button>

          <p className="text-sm text-rally-muted">
            Need an account?{' '}
            <Link to="/register" className="text-rally-cyan hover:underline">
              Register
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
