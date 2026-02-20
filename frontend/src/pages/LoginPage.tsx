import { useState, useEffect, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore, getSavedAccounts, removeSavedAccount } from '@/stores/authStore';
import type { SavedAccount } from '@/stores/authStore';
import { X } from 'lucide-react';

/* ================================================================== */
/*  LoginPage                                                          */
/* ================================================================== */
export function LoginPage() {
  const navigate = useNavigate();
  const { login, loginWithRefreshToken, isLoading, error, clearError, isAuthenticated } =
    useAuthStore();

  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>(() => getSavedAccounts());
  const [view, setView] = useState<'accounts' | 'password' | 'form'>(
    () => savedAccounts.length > 0 ? 'accounts' : 'form'
  );
  const [selectedAccount, setSelectedAccount] = useState<SavedAccount | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Redirect when authenticated
  useEffect(() => {
    if (isAuthenticated) navigate('/app', { replace: true });
  }, [isAuthenticated, navigate]);

  // Clear store error on mount / unmount
  useEffect(() => {
    clearError();
    return () => clearError();
  }, [clearError]);

  /* ---- handle saved account click ---- */
  async function handleAccountClick(account: SavedAccount) {
    clearError();
    setLocalError(null);
    try {
      await loginWithRefreshToken(account);
      navigate('/app', { replace: true });
    } catch {
      // Refresh token expired — show password form for this account
      setSelectedAccount(account);
      setEmail(account.email);
      setView('password');
    }
  }

  /* ---- remove saved account ---- */
  function handleRemoveAccount(e: React.MouseEvent, account: SavedAccount) {
    e.stopPropagation();
    removeSavedAccount(account.id);
    const updated = getSavedAccounts();
    setSavedAccounts(updated);
    if (updated.length === 0) setView('form');
  }

  /* ---- validation ---- */
  function validate(): boolean {
    if (!email.trim()) {
      setLocalError('Email is required.');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setLocalError('Please enter a valid email address.');
      return false;
    }
    if (!password) {
      setLocalError('Password is required.');
      return false;
    }
    setLocalError(null);
    return true;
  }

  /* ---- submit ---- */
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    try {
      await login(email, password);
      navigate('/app', { replace: true });
    } catch {
      // error is set in the store
    }
  }

  const displayError = localError || error;

  return (
    <div className="min-h-screen bg-black bg-grid flex items-center justify-center px-4 relative overflow-hidden">
      {/* Background radial glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{
          background:
            'radial-gradient(circle, rgba(0,217,255,0.06) 0%, rgba(139,0,255,0.03) 50%, transparent 70%)',
        }}
      />

      {/* Card */}
      <div className="relative w-full max-w-md animate-fade-in">
        {/* Outer gradient border */}
        <div className="absolute -inset-[1px] bg-gradient-to-br from-rally-blue/20 via-rally-purple/10 to-transparent rounded-sm pointer-events-none" />

        <div className="relative bg-rally-dark-surface border border-rally-border/40 rounded-sm p-8 sm:p-10">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <Link to="/">
              <img
                src="./icon.png"
                alt="Rally"
                className="w-14 h-14 mb-3 drop-shadow-[0_0_16px_rgba(0,217,255,0.3)] hover:drop-shadow-[0_0_24px_rgba(0,217,255,0.5)] transition"
              />
            </Link>
            <h1 className="font-display text-2xl font-bold tracking-[0.15em] uppercase neon-text">
              Rally
            </h1>
            <p className="font-body text-xs text-rally-text-muted mt-1 tracking-wide">
              {view === 'accounts' ? 'Choose an account' : 'Welcome back, Commander.'}
            </p>
          </div>

          {/* Error */}
          {displayError && (
            <div className="mb-5 px-4 py-3 bg-rally-magenta/10 border border-rally-magenta/30 rounded-sm text-sm font-body text-rally-magenta flex items-start gap-2">
              <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{displayError}</span>
            </div>
          )}

          {/* ============ SAVED ACCOUNTS VIEW ============ */}
          {view === 'accounts' && (
            <div className="flex flex-col gap-3">
              {savedAccounts.map((account) => (
                <button
                  key={account.id}
                  onClick={() => handleAccountClick(account)}
                  disabled={isLoading}
                  className="group relative flex items-center gap-3 w-full px-4 py-3 bg-white/5 border border-white/10 rounded-sm hover:border-rally-blue/40 hover:bg-rally-blue/5 transition-all text-left disabled:opacity-60"
                >
                  {/* Avatar */}
                  {account.avatarUrl ? (
                    <img src={account.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rally-cyan/30 to-rally-purple/30 flex items-center justify-center text-white font-display font-bold text-sm shrink-0">
                      {account.displayName?.[0]?.toUpperCase() || '?'}
                    </div>
                  )}
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-display font-semibold text-white truncate">
                      {account.displayName}
                    </div>
                    <div className="text-xs text-rally-text-muted truncate">
                      {account.email}
                    </div>
                  </div>
                  {/* Remove button */}
                  <div
                    onClick={(e) => handleRemoveAccount(e, account)}
                    className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 text-white/30 hover:text-rally-magenta hover:bg-rally-magenta/10 transition-all cursor-pointer"
                    title="Remove saved account"
                  >
                    <X className="w-3.5 h-3.5" />
                  </div>
                </button>
              ))}

              {/* Loading indicator */}
              {isLoading && (
                <div className="flex items-center justify-center py-2 gap-2 text-rally-text-muted text-sm">
                  <span className="w-4 h-4 border-2 border-rally-blue/30 border-t-rally-blue rounded-full animate-spin" />
                  Signing in...
                </div>
              )}

              {/* Use another account */}
              <button
                onClick={() => { setView('form'); clearError(); setLocalError(null); }}
                className="w-full py-3 text-sm font-body text-rally-text-muted hover:text-rally-blue transition-colors border border-transparent hover:border-white/10 rounded-sm"
              >
                Use another account
              </button>
            </div>
          )}

          {/* ============ PASSWORD VIEW (saved account, expired token) ============ */}
          {view === 'password' && selectedAccount && (
            <div>
              {/* Selected account header */}
              <div className="flex items-center gap-3 mb-5 px-4 py-3 bg-white/5 border border-white/10 rounded-sm">
                {selectedAccount.avatarUrl ? (
                  <img src={selectedAccount.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rally-cyan/30 to-rally-purple/30 flex items-center justify-center text-white font-display font-bold text-sm shrink-0">
                    {selectedAccount.displayName?.[0]?.toUpperCase() || '?'}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-display font-semibold text-white truncate">
                    {selectedAccount.displayName}
                  </div>
                  <div className="text-xs text-rally-text-muted truncate">
                    {selectedAccount.email}
                  </div>
                </div>
              </div>

              <p className="text-xs text-rally-text-muted mb-4">
                Your session expired. Enter your password to sign back in.
              </p>

              <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
                <div>
                  <label
                    htmlFor="password"
                    className="block font-display text-xs font-semibold uppercase tracking-widest text-rally-text-muted mb-1.5"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setLocalError(null); }}
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      autoFocus
                      className="input-rally rounded-sm pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-rally-text-muted hover:text-rally-blue transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-5 0-9.27-3.11-11-7.5a11.72 11.72 0 013.168-4.477M6.343 6.343A9.972 9.972 0 0112 5c5 0 9.27 3.11 11 7.5a11.7 11.7 0 01-4.373 5.157M6.343 6.343L3 3m3.343 3.343l2.829 2.829M17.657 17.657L21 21m-3.343-3.343l-2.829-2.829M9.878 9.878a3 3 0 104.243 4.243" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn-rally-primary w-full py-3 text-sm flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    'Sign In'
                  )}
                </button>
              </form>

              <button
                onClick={() => { setView('accounts'); setPassword(''); clearError(); setLocalError(null); }}
                className="w-full mt-4 py-2 text-xs font-body text-rally-text-muted hover:text-rally-blue transition-colors"
              >
                Back to accounts
              </button>
            </div>
          )}

          {/* ============ FULL LOGIN FORM ============ */}
          {view === 'form' && (
            <>
              <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
                {/* Email */}
                <div>
                  <label
                    htmlFor="email"
                    className="block font-display text-xs font-semibold uppercase tracking-widest text-rally-text-muted mb-1.5"
                  >
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setLocalError(null); }}
                    placeholder="you@example.com"
                    autoComplete="email"
                    className="input-rally rounded-sm"
                  />
                </div>

                {/* Password */}
                <div>
                  <label
                    htmlFor="password"
                    className="block font-display text-xs font-semibold uppercase tracking-widest text-rally-text-muted mb-1.5"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setLocalError(null); }}
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      className="input-rally rounded-sm pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-rally-text-muted hover:text-rally-blue transition-colors"
                      tabIndex={-1}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-5 0-9.27-3.11-11-7.5a11.72 11.72 0 013.168-4.477M6.343 6.343A9.972 9.972 0 0112 5c5 0 9.27 3.11 11 7.5a11.7 11.7 0 01-4.373 5.157M6.343 6.343L3 3m3.343 3.343l2.829 2.829M17.657 17.657L21 21m-3.343-3.343l-2.829-2.829M9.878 9.878a3 3 0 104.243 4.243" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {/* Forgot password */}
                <div className="text-right -mt-2">
                  <Link
                    to="#"
                    className="font-body text-xs text-rally-text-muted hover:text-rally-blue transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn-rally-primary w-full py-3 text-sm flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                      Logging in...
                    </>
                  ) : (
                    'Login'
                  )}
                </button>
              </form>

              {/* Back to saved accounts */}
              {savedAccounts.length > 0 && (
                <>
                  <div className="divider-geo my-5" />
                  <button
                    onClick={() => { setView('accounts'); clearError(); setLocalError(null); setPassword(''); }}
                    className="w-full py-2 text-sm font-body text-rally-text-muted hover:text-rally-blue transition-colors"
                  >
                    Back to saved accounts
                  </button>
                </>
              )}

              <div className="divider-geo my-6" />

              {/* Register link */}
              <p className="text-center font-body text-sm text-rally-text-muted">
                Don&apos;t have an account?{' '}
                <Link
                  to="/register"
                  className="font-semibold text-rally-blue hover:text-rally-cyan transition-colors"
                >
                  Register
                </Link>
              </p>
            </>
          )}

          {/* Register link for accounts/password views */}
          {view !== 'form' && (
            <>
              <div className="divider-geo my-6" />
              <p className="text-center font-body text-sm text-rally-text-muted">
                Don&apos;t have an account?{' '}
                <Link
                  to="/register"
                  className="font-semibold text-rally-blue hover:text-rally-cyan transition-colors"
                >
                  Register
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
