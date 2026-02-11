import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';

function RallyLogo({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="navGrad" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#7C3AED" />
          <stop offset="50%" stopColor="#00F0FF" />
          <stop offset="100%" stopColor="#39FF14" />
        </linearGradient>
        <filter id="navGlow">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <polygon points="8,24 12,8 24,2 30,28" fill="#6D28D9" />
      <polygon points="24,2 50,20 30,28" fill="#7C3AED" />
      <polygon points="50,20 62,32 50,38 40,30" fill="#00D4FF" />
      <polygon points="30,28 50,20 40,30" fill="#4C1D95" />
      <polygon points="30,28 40,30 40,44 22,58" fill="#3730A3" />
      <polygon points="40,30 50,38 40,44" fill="#312E81" />
      <polygon points="8,24 30,28 22,58 6,48" fill="#1E1B4B" />
      <circle cx="38" cy="26" r="3.5" fill="#00F0FF" filter="url(#navGlow)" />
      <circle cx="38" cy="26" r="1.5" fill="#FFFFFF" />
    </svg>
  );
}

const navLinks = [
  { label: 'Download', href: '/download' },
  { label: 'Features', href: '/#features' },
  { label: 'Safety', href: '/#safety' },
  { label: 'Support', href: '/support' },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-rally-darkBg/95 backdrop-blur-md border-b border-white/5 shadow-lg shadow-black/20'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <RallyLogo className="h-9 w-9 transition-transform duration-300 group-hover:scale-110" />
            <span className="font-display font-bold text-xl tracking-tight text-white">
              Rally
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                to={link.href}
                className="text-sm font-medium text-rally-muted hover:text-white transition-colors duration-200 relative group"
              >
                {link.label}
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-rally-cyan transition-all duration-300 group-hover:w-full" />
              </Link>
            ))}
          </div>

          {/* Desktop CTA */}
          <div className="hidden lg:flex items-center gap-3">
            <Link
              to="/login"
              className="text-sm font-medium text-white hover:text-rally-cyan transition-colors duration-200 px-4 py-2"
            >
              Log In
            </Link>
            <Link
              to="/download"
              className="relative text-sm font-semibold text-white px-6 py-2.5 rounded-md overflow-hidden group"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-rally-purple to-rally-cyan opacity-90 group-hover:opacity-100 transition-opacity" />
              <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ boxShadow: '0 0 20px rgba(0, 240, 255, 0.4), 0 0 40px rgba(124, 58, 237, 0.2)' }}
              />
              <span className="relative">Open Rally</span>
            </Link>
          </div>

          {/* Mobile Hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden p-2 text-rally-muted hover:text-white transition-colors"
            aria-label="Toggle menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <div
        className={`lg:hidden transition-all duration-300 overflow-hidden ${
          mobileOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="bg-rally-darkerBg/95 backdrop-blur-md border-t border-white/5 px-4 py-6 space-y-4">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              to={link.href}
              className="block text-base font-medium text-rally-muted hover:text-white transition-colors py-2"
            >
              {link.label}
            </Link>
          ))}
          <div className="pt-4 border-t border-white/5 space-y-3">
            <Link
              to="/login"
              className="block text-center text-sm font-medium text-white py-2.5 rounded-md border border-white/10 hover:border-rally-cyan/30 transition-colors"
            >
              Log In
            </Link>
            <Link
              to="/download"
              className="block text-center text-sm font-semibold text-white py-2.5 rounded-md bg-gradient-to-r from-rally-purple to-rally-cyan"
            >
              Open Rally
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
