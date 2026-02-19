import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

/* ------------------------------------------------------------------ */
/*  Animated counter hook                                              */
/* ------------------------------------------------------------------ */
function useCounter(target: number, duration = 2000, start = false) {
  const [value, setValue] = useState(0);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!start) return;
    const startTime = performance.now();

    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.floor(eased * target));
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      }
    }

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [target, duration, start]);

  return value;
}

/* ------------------------------------------------------------------ */
/*  Floating geometric shapes (background decoration)                  */
/* ------------------------------------------------------------------ */
function FloatingShapes() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
      {/* Triangle top-right */}
      <div
        className="absolute -top-10 right-[15%] w-40 h-40 opacity-[0.04] animate-[float_18s_ease-in-out_infinite]"
        style={{
          clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)',
          background: 'linear-gradient(135deg, #00D9FF, #39FF14)',
        }}
      />
      {/* Diamond left */}
      <div
        className="absolute top-[30%] -left-6 w-28 h-28 rotate-45 opacity-[0.03] animate-[float_22s_ease-in-out_infinite_1s]"
        style={{ background: 'linear-gradient(135deg, #8B00FF, #FF006E)' }}
      />
      {/* Hexagon bottom-right */}
      <div
        className="absolute bottom-[20%] right-[8%] w-36 h-36 opacity-[0.03] animate-[float_20s_ease-in-out_infinite_3s]"
        style={{
          clipPath:
            'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
          background: 'linear-gradient(135deg, #00D9FF, #8B00FF)',
        }}
      />
      {/* Small square center-left */}
      <div
        className="absolute top-[60%] left-[20%] w-16 h-16 rotate-12 opacity-[0.04] animate-[float_16s_ease-in-out_infinite_2s]"
        style={{ background: '#39FF14' }}
      />
      {/* Circle bottom-left */}
      <div
        className="absolute bottom-[10%] left-[10%] w-24 h-24 rounded-full opacity-[0.03] animate-[float_24s_ease-in-out_infinite_4s]"
        style={{ background: 'linear-gradient(135deg, #FF006E, #00D9FF)' }}
      />

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          25% { transform: translateY(-30px) rotate(5deg); }
          50% { transform: translateY(-15px) rotate(-3deg); }
          75% { transform: translateY(-25px) rotate(2deg); }
        }
      `}</style>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Feature card data                                                  */
/* ------------------------------------------------------------------ */
interface Feature {
  title: string;
  subtitle: string;
  description: string;
  icon: React.ReactNode;
  gradient: string;
  shadowColor: string;
}

const FEATURES: Feature[] = [
  {
    title: 'Squad Up',
    subtitle: 'Discord-like',
    description:
      'Team management, voice and text chat, role-based permissions and channels. Build your gaming community from the ground up.',
    gradient: 'from-[#00D9FF] to-[#8B00FF]',
    shadowColor: 'rgba(0, 217, 255, 0.35)',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8">
        <path
          d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2" />
        <path
          d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    title: 'Share & Discover',
    subtitle: 'Instagram-like',
    description:
      'Visual feeds, stories, clips and highlights. Showcase your best plays and discover content from the community.',
    gradient: 'from-[#FF006E] to-[#8B00FF]',
    shadowColor: 'rgba(255, 0, 110, 0.35)',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8">
        <rect
          x="3"
          y="3"
          width="18"
          height="18"
          rx="5"
          stroke="currentColor"
          strokeWidth="2"
        />
        <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
        <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" />
      </svg>
    ),
  },
  {
    title: 'The Pulse',
    subtitle: 'Twitter-like',
    description:
      'Global discovery feed, trending topics, and real-time gaming discourse. Stay on the pulse of the gaming world.',
    gradient: 'from-[#39FF14] to-[#00D9FF]',
    shadowColor: 'rgba(57, 255, 20, 0.35)',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8">
        <path
          d="M22 12h-4l-3 9L9 3l-3 9H2"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    title: 'Go Live',
    subtitle: 'Twitch-like',
    description:
      'Live streaming with channel points, chat overlays and raid mechanics. Turn every session into a show.',
    gradient: 'from-[#8B00FF] to-[#FF006E]',
    shadowColor: 'rgba(139, 0, 255, 0.35)',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8">
        <path
          d="M23 7l-7 5 7 5V7z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect
          x="1"
          y="5"
          width="15"
          height="14"
          rx="2"
          stroke="currentColor"
          strokeWidth="2"
        />
      </svg>
    ),
  },
];

/* ------------------------------------------------------------------ */
/*  Feature card component                                             */
/* ------------------------------------------------------------------ */
function FeatureCard({ feature }: { feature: Feature }) {
  return (
    <div className="group relative p-[1px] transition-all duration-300">
      {/* Gradient border on hover */}
      <div
        className={`absolute inset-0 rounded-sm bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
      />
      <div className="relative bg-rally-dark-surface rounded-sm p-6 h-full flex flex-col">
        {/* Icon */}
        <div
          className={`w-14 h-14 rounded flex items-center justify-center mb-4 bg-gradient-to-br ${feature.gradient} bg-opacity-10`}
          style={{
            background: `linear-gradient(135deg, ${feature.shadowColor}, transparent)`,
          }}
        >
          <span
            className="text-white"
            style={{
              filter: `drop-shadow(0 0 8px ${feature.shadowColor})`,
            }}
          >
            {feature.icon}
          </span>
        </div>
        {/* Title */}
        <h3 className="font-display text-xl font-bold text-rally-text mb-1 tracking-wide uppercase">
          {feature.title}
        </h3>
        <span className="text-xs font-body text-rally-text-muted mb-3 uppercase tracking-widest">
          {feature.subtitle}
        </span>
        {/* Description */}
        <p className="font-body text-sm text-rally-text-muted leading-relaxed flex-1">
          {feature.description}
        </p>
        {/* Bottom accent line */}
        <div
          className={`mt-5 h-[2px] w-0 group-hover:w-full bg-gradient-to-r ${feature.gradient} transition-all duration-500`}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Stat counter component                                             */
/* ------------------------------------------------------------------ */
function StatBlock({
  label,
  target,
  suffix,
  started,
}: {
  label: string;
  target: number;
  suffix: string;
  started: boolean;
}) {
  const count = useCounter(target, 2200, started);
  return (
    <div className="text-center">
      <div className="font-display text-4xl md:text-5xl font-bold neon-text">
        {count.toLocaleString()}
        {suffix}
      </div>
      <div className="font-body text-sm text-rally-text-muted mt-2 uppercase tracking-widest">
        {label}
      </div>
    </div>
  );
}

/* ================================================================== */
/*  LandingPage                                                        */
/* ================================================================== */
export function LandingPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [statsVisible, setStatsVisible] = useState(false);
  const statsRef = useRef<HTMLDivElement>(null);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) navigate('/app', { replace: true });
  }, [isAuthenticated, navigate]);

  // Intersection observer for stats counters
  useEffect(() => {
    if (!statsRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStatsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(statsRef.current);
    return () => observer.disconnect();
  }, []);

  const scrollToFeatures = () => {
    document
      .getElementById('features')
      ?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-black bg-grid overflow-y-auto overflow-x-hidden relative">
      <FloatingShapes />

      {/* ---------------------------------------------------------- */}
      {/*  Navigation Bar                                             */}
      {/* ---------------------------------------------------------- */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-black/70 backdrop-blur-md border-b border-rally-border/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <img
              src="/icon.png"
              alt="Rally"
              className="w-8 h-8 group-hover:drop-shadow-[0_0_8px_rgba(0,217,255,0.5)] transition"
            />
            <span className="font-display text-xl font-bold tracking-widest uppercase text-rally-text group-hover:text-rally-blue transition-colors">
              Rally
            </span>
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-8">
            <button
              onClick={scrollToFeatures}
              className="font-body text-sm text-rally-text-muted hover:text-rally-blue transition-colors"
            >
              Features
            </button>
            <a
              href="#stats"
              className="font-body text-sm text-rally-text-muted hover:text-rally-blue transition-colors"
            >
              Community
            </a>
            <Link
              to="/login"
              className="font-display text-sm font-semibold uppercase tracking-wider text-rally-text hover:text-rally-blue transition-colors"
            >
              Login
            </Link>
            <Link to="/register" className="btn-rally-primary px-5 py-2 text-xs">
              Register
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden text-rally-text-muted hover:text-rally-blue transition-colors"
            onClick={() => setMobileMenuOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-rally-dark-surface/95 backdrop-blur-md border-t border-rally-border/40 animate-fade-in">
            <div className="px-4 py-4 flex flex-col gap-3">
              <button
                onClick={() => {
                  scrollToFeatures();
                  setMobileMenuOpen(false);
                }}
                className="font-body text-sm text-rally-text-muted hover:text-rally-blue transition-colors text-left"
              >
                Features
              </button>
              <a
                href="#stats"
                className="font-body text-sm text-rally-text-muted hover:text-rally-blue transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Community
              </a>
              <Link
                to="/login"
                className="font-display text-sm font-semibold uppercase tracking-wider text-rally-text hover:text-rally-blue transition-colors"
              >
                Login
              </Link>
              <Link to="/register" className="btn-rally-primary text-center px-5 py-2 text-xs">
                Register
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* ---------------------------------------------------------- */}
      {/*  Hero Section                                               */}
      {/* ---------------------------------------------------------- */}
      <section className="relative flex flex-col items-center justify-center min-h-screen px-4 pt-16">
        {/* Radial glow behind logo */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
          style={{
            background:
              'radial-gradient(circle, rgba(0,217,255,0.08) 0%, rgba(139,0,255,0.04) 40%, transparent 70%)',
          }}
        />

        <div className="relative z-10 flex flex-col items-center text-center max-w-3xl">
          {/* Logo */}
          <img
            src="/icon.png"
            alt="Rally Logo"
            className="w-28 h-28 md:w-36 md:h-36 mb-6 drop-shadow-[0_0_30px_rgba(0,217,255,0.35)] animate-glow-pulse"
          />

          {/* Title */}
          <h1 className="font-display text-6xl sm:text-7xl md:text-8xl font-bold tracking-[0.2em] uppercase neon-text select-none">
            Rally
          </h1>

          {/* Tagline */}
          <p className="mt-4 font-body text-lg sm:text-xl text-rally-text-muted max-w-xl leading-relaxed">
            The Next Generation Gaming &amp; Social Platform
          </p>

          {/* CTA Buttons */}
          <div className="mt-10 flex flex-col sm:flex-row items-center gap-4">
            <Link
              to="/register"
              className="btn-rally-primary px-8 py-3 text-sm min-w-[180px] text-center"
            >
              Get Started
            </Link>
            <button
              onClick={scrollToFeatures}
              className="btn-rally px-8 py-3 text-sm min-w-[180px]"
            >
              Learn More
            </button>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <svg
            className="w-6 h-6 text-rally-text-muted"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7" />
          </svg>
        </div>
      </section>

      {/* ---------------------------------------------------------- */}
      {/*  Features Section                                           */}
      {/* ---------------------------------------------------------- */}
      <section id="features" className="relative py-24 px-4">
        <div className="max-w-6xl mx-auto">
          {/* Section heading */}
          <div className="text-center mb-16">
            <h2 className="font-display text-3xl sm:text-4xl font-bold uppercase tracking-widest text-rally-text">
              One Platform.{' '}
              <span className="neon-text">Infinite Possibilities.</span>
            </h2>
            <p className="mt-4 font-body text-rally-text-muted max-w-xl mx-auto">
              Everything you need to game, connect, create and compete &mdash;
              unified in one place.
            </p>
            {/* Geometric divider */}
            <div className="divider-geo mt-8 max-w-xs mx-auto" />
          </div>

          {/* Cards grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map((f) => (
              <FeatureCard key={f.title} feature={f} />
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- */}
      {/*  Stats Section                                              */}
      {/* ---------------------------------------------------------- */}
      <section id="stats" ref={statsRef} className="relative py-24 px-4">
        {/* Subtle top border glow */}
        <div className="divider-geo mb-16 max-w-lg mx-auto" />

        <div className="max-w-5xl mx-auto text-center">
          <h2 className="font-display text-3xl sm:text-4xl font-bold uppercase tracking-widest text-rally-text mb-4">
            Built for <span className="neon-text-green">Gamers</span>
          </h2>
          <p className="font-body text-rally-text-muted max-w-md mx-auto mb-16">
            Join a growing community of players, creators and competitors.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <StatBlock label="Gamers" target={125000} suffix="+" started={statsVisible} />
            <StatBlock label="Squads" target={8400} suffix="+" started={statsVisible} />
            <StatBlock label="Hours Streamed" target={320000} suffix="+" started={statsVisible} />
            <StatBlock label="Pulse Posts" target={1800000} suffix="+" started={statsVisible} />
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- */}
      {/*  Bottom CTA                                                 */}
      {/* ---------------------------------------------------------- */}
      <section className="relative py-24 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="font-display text-3xl sm:text-4xl font-bold uppercase tracking-widest text-rally-text mb-4">
            Ready to <span className="neon-text-magenta">Rally?</span>
          </h2>
          <p className="font-body text-rally-text-muted mb-10">
            Create your account in seconds and dive into the action.
          </p>
          <Link
            to="/register"
            className="btn-rally-primary px-10 py-3 text-sm inline-block"
          >
            Join Now
          </Link>
        </div>
      </section>

      {/* ---------------------------------------------------------- */}
      {/*  Footer                                                     */}
      {/* ---------------------------------------------------------- */}
      <footer className="border-t border-rally-border/30 py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src="/icon.png" alt="Rally" className="w-5 h-5 opacity-60" />
            <span className="font-display text-xs text-rally-text-muted tracking-widest uppercase">
              Rally
            </span>
          </div>
          <p className="font-body text-xs text-rally-text-muted">
            &copy; {new Date().getFullYear()} Rally. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
