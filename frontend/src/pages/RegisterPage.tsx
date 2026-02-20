import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { Eye, EyeOff } from 'lucide-react';

export function RegisterPage() {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const isPackaged = window.location.protocol === 'file:';
  const [showAdvanced, setShowAdvanced] = useState(isPackaged);
  const [serverUrl, setServerUrl] = useState(localStorage.getItem('rally-server-url') || '');
  const { register, isLoading, error, clearError } = useAuthStore();

  const handleServerUrlChange = (url: string) => {
    setServerUrl(url);
    if (url.trim()) {
      localStorage.setItem('rally-server-url', url.trim());
    } else {
      localStorage.removeItem('rally-server-url');
    }
  };
  const navigate = useNavigate();

  const passwordStrength = (() => {
    if (password.length === 0) return 0;
    let s = 0;
    if (password.length >= 8) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/[0-9]/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return s;
  })();

  const strengthColors = ['bg-rally-magenta', 'bg-orange-500', 'bg-yellow-400', 'bg-rally-green'];
  const strengthLabels = ['Weak', 'Fair', 'Good', 'Strong'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    if (password !== confirmPassword) return;
    if (password.length < 8) return;

    try {
      await register({ email, username, displayName: displayName || username, password });
      navigate('/app');
    } catch {}
  };

  return (
    <div className="min-h-screen bg-black bg-grid flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="./icon.png" alt="Rally" className="w-16 h-16 mx-auto" />
          <h1 className="mt-4 font-display text-3xl font-bold text-rally-blue tracking-wider">CREATE ACCOUNT</h1>
          <p className="mt-1 text-rally-text-muted text-sm">Join the next generation of gaming</p>
        </div>

        <form onSubmit={handleSubmit} className="card-rally rounded-lg p-6 space-y-4">
          {error && (
            <div className="p-3 rounded bg-rally-magenta/10 border border-rally-magenta/30 text-rally-magenta text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-display font-semibold uppercase tracking-wider text-rally-text-muted mb-1">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="input-rally rounded" placeholder="you@example.com" />
          </div>

          <div>
            <label className="block text-xs font-display font-semibold uppercase tracking-wider text-rally-text-muted mb-1">Username</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-rally-text-muted text-sm">@</span>
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} required className="input-rally rounded pl-7" placeholder="username" minLength={3} maxLength={20} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-display font-semibold uppercase tracking-wider text-rally-text-muted mb-1">Display Name</label>
            <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="input-rally rounded" placeholder={username || 'Display Name'} />
          </div>

          <div>
            <label className="block text-xs font-display font-semibold uppercase tracking-wider text-rally-text-muted mb-1">Password</label>
            <div className="relative">
              <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required className="input-rally rounded pr-10" placeholder="Min. 8 characters" minLength={8} />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-rally-text-muted hover:text-rally-text">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {password.length > 0 && (
              <div className="mt-2">
                <div className="flex gap-1 mb-1">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className={`h-1 flex-1 rounded-full ${i < passwordStrength ? strengthColors[passwordStrength - 1] : 'bg-white/10'}`} />
                  ))}
                </div>
                <p className="text-xs text-rally-text-muted">{strengthLabels[passwordStrength - 1] || 'Too short'}</p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-display font-semibold uppercase tracking-wider text-rally-text-muted mb-1">Confirm Password</label>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className="input-rally rounded" placeholder="Confirm password" />
            {confirmPassword && password !== confirmPassword && (
              <p className="text-xs text-rally-magenta mt-1">Passwords don't match</p>
            )}
          </div>

          {/* Advanced / Server Settings */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced((s) => !s)}
              className="font-body text-xs text-rally-text-muted hover:text-rally-blue transition-colors flex items-center gap-1"
            >
              <svg
                className={`w-3 h-3 transition-transform ${showAdvanced ? 'rotate-90' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              Server Settings
            </button>
            {showAdvanced && (
              <div className="mt-2">
                <label
                  htmlFor="serverUrl"
                  className="block text-xs font-display font-semibold uppercase tracking-wider text-rally-text-muted mb-1"
                >
                  Server URL
                </label>
                <input
                  id="serverUrl"
                  type="text"
                  value={serverUrl}
                  onChange={(e) => handleServerUrlChange(e.target.value)}
                  placeholder="http://localhost:3001"
                  className="input-rally rounded"
                />
                <p className="text-xs text-rally-text-muted mt-1 font-body">
                  Leave empty for local server. Enter the URL of your Rally server for LAN/internet play.
                </p>
              </div>
            )}
          </div>

          <button type="submit" disabled={isLoading || password !== confirmPassword || password.length < 8} className="btn-rally-primary w-full py-3 disabled:opacity-50">
            {isLoading ? 'Creating Account...' : 'Create Account'}
          </button>

          <p className="text-center text-sm text-rally-text-muted">
            Already have an account?{' '}
            <Link to="/login" className="text-rally-blue hover:underline">Login</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
