import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';

/* ─── Scroll-triggered animation hook ─── */
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, visible };
}

/* ─── Animated Section Wrapper ─── */
function AnimatedSection({
  children,
  className = '',
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const { ref, visible } = useInView();
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      } ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* ─── Feature data ─── */
const features = [
  {
    title: 'Crystal Clear Comms',
    description:
      'Ultra-low latency voice with noise suppression that actually works. Hear every callout, never miss a play. Military-grade audio processing meets gaming performance.',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="w-full h-full">
        <path d="M24 4C20.686 4 18 6.686 18 10V24C18 27.314 20.686 30 24 30C27.314 30 30 27.314 30 24V10C30 6.686 27.314 4 24 4Z" stroke="url(#voiceGrad)" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M12 22V24C12 30.627 17.373 36 24 36C30.627 36 36 30.627 36 24V22" stroke="url(#voiceGrad)" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M24 36V44M18 44H30" stroke="url(#voiceGrad)" strokeWidth="2.5" strokeLinecap="round" />
        <defs>
          <linearGradient id="voiceGrad" x1="12" y1="4" x2="36" y2="44" gradientUnits="userSpaceOnUse">
            <stop stopColor="#00F0FF" /><stop offset="1" stopColor="#39FF14" />
          </linearGradient>
        </defs>
      </svg>
    ),
  },
  {
    title: 'Express Your Power Level',
    description:
      'Custom emojis, animated stickers, soundboard effects, and profile banners. Show the lobby who you are before the match even starts.',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="w-full h-full">
        <circle cx="24" cy="24" r="18" stroke="url(#emojiGrad)" strokeWidth="2.5" />
        <circle cx="17" cy="20" r="2.5" fill="#00F0FF" />
        <circle cx="31" cy="20" r="2.5" fill="#39FF14" />
        <path d="M16 30C18 33 21 35 24 35C27 35 30 33 32 30" stroke="url(#emojiGrad)" strokeWidth="2.5" strokeLinecap="round" />
        <defs>
          <linearGradient id="emojiGrad" x1="6" y1="6" x2="42" y2="42" gradientUnits="userSpaceOnUse">
            <stop stopColor="#7C3AED" /><stop offset="1" stopColor="#00F0FF" />
          </linearGradient>
        </defs>
      </svg>
    ),
  },
  {
    title: 'Stream Like a Boss',
    description:
      'Share your screen in buttery-smooth HD. Watch parties, co-op sessions, or just showing off your gameplay. Zero lag, all glory.',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="w-full h-full">
        <rect x="4" y="8" width="40" height="28" rx="3" stroke="url(#streamGrad)" strokeWidth="2.5" />
        <path d="M20 18L32 24L20 30V18Z" fill="url(#streamGrad)" />
        <path d="M16 40H32" stroke="url(#streamGrad)" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M24 36V40" stroke="url(#streamGrad)" strokeWidth="2.5" strokeLinecap="round" />
        <defs>
          <linearGradient id="streamGrad" x1="4" y1="8" x2="44" y2="40" gradientUnits="userSpaceOnUse">
            <stop stopColor="#00F0FF" /><stop offset="1" stopColor="#7C3AED" />
          </linearGradient>
        </defs>
      </svg>
    ),
  },
  {
    title: 'Always-On Battle Stations',
    description:
      'Drop in and out of voice channels without ringing anyone. Your squad is always one click away. No invites, no scheduling — just jump in.',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="w-full h-full">
        <path d="M8 12H16V36H8C6.895 36 6 35.105 6 34V14C6 12.895 6.895 12 8 12Z" stroke="url(#channelGrad)" strokeWidth="2.5" />
        <path d="M16 12H36C38.209 12 40 13.791 40 16V32C40 34.209 38.209 36 36 36H16V12Z" stroke="url(#channelGrad)" strokeWidth="2.5" />
        <circle cx="28" cy="24" r="5" stroke="url(#channelGrad)" strokeWidth="2.5" />
        <path d="M28 19V24L31 26" stroke="url(#channelGrad)" strokeWidth="2" strokeLinecap="round" />
        <defs>
          <linearGradient id="channelGrad" x1="6" y1="12" x2="40" y2="36" gradientUnits="userSpaceOnUse">
            <stop stopColor="#39FF14" /><stop offset="1" stopColor="#00F0FF" />
          </linearGradient>
        </defs>
      </svg>
    ),
  },
  {
    title: 'Your Server, Your Rules',
    description:
      'Full control over roles, permissions, and channels. Built-in moderation tools, custom bots, and granular access control. Run your community like a pro.',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="w-full h-full">
        <path d="M24 4L40 12V22C40 32 33 40 24 44C15 40 8 32 8 22V12L24 4Z" stroke="url(#shieldGrad)" strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M18 24L22 28L30 20" stroke="url(#shieldGrad)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <defs>
          <linearGradient id="shieldGrad" x1="8" y1="4" x2="40" y2="44" gradientUnits="userSpaceOnUse">
            <stop stopColor="#7C3AED" /><stop offset="0.5" stopColor="#00F0FF" /><stop offset="1" stopColor="#39FF14" />
          </linearGradient>
        </defs>
      </svg>
    ),
  },
  {
    title: 'Play Anywhere, Rally Everywhere',
    description:
      'Windows, Mac, Linux, iOS, Android. Seamlessly switch between devices. Your messages, calls, and communities follow you everywhere.',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="w-full h-full">
        <rect x="2" y="8" width="28" height="20" rx="2" stroke="url(#deviceGrad)" strokeWidth="2.5" />
        <rect x="34" y="14" width="12" height="22" rx="2" stroke="url(#deviceGrad)" strokeWidth="2.5" />
        <path d="M2 24H30" stroke="url(#deviceGrad)" strokeWidth="2" opacity="0.5" />
        <path d="M10 32H22" stroke="url(#deviceGrad)" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="40" cy="32" r="1.5" fill="#00F0FF" />
        <defs>
          <linearGradient id="deviceGrad" x1="2" y1="8" x2="46" y2="36" gradientUnits="userSpaceOnUse">
            <stop stopColor="#00F0FF" /><stop offset="0.5" stopColor="#7C3AED" /><stop offset="1" stopColor="#39FF14" />
          </linearGradient>
        </defs>
      </svg>
    ),
  },
];

/* ─── Stats ─── */
const stats = [
  { value: '10M+', label: 'Active Gamers' },
  { value: '<15ms', label: 'Voice Latency' },
  { value: '99.99%', label: 'Uptime' },
  { value: '500K+', label: 'Communities' },
];

/* ─── Marquee words ─── */
const marqueeWords = ['RALLY', 'CHAT', 'STREAM', 'PLAY', 'COMPETE', 'BUILD', 'CONNECT', 'DOMINATE'];

/* ─── Floating geometric shapes for hero ─── */
function FloatingShapes() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Large cyan triangle */}
      <div className="absolute top-[15%] left-[8%] w-20 h-20 opacity-[0.07] animate-float">
        <svg viewBox="0 0 80 80" fill="none">
          <polygon points="40,5 75,70 5,70" stroke="#00F0FF" strokeWidth="2" />
        </svg>
      </div>
      {/* Purple diamond */}
      <div className="absolute top-[25%] right-[12%] w-16 h-16 opacity-[0.08] animate-floatSlow" style={{ animationDelay: '2s' }}>
        <svg viewBox="0 0 64 64" fill="none">
          <polygon points="32,4 60,32 32,60 4,32" stroke="#7C3AED" strokeWidth="2" />
        </svg>
      </div>
      {/* Green hexagon */}
      <div className="absolute bottom-[30%] left-[15%] w-14 h-14 opacity-[0.06] animate-float" style={{ animationDelay: '4s' }}>
        <svg viewBox="0 0 56 56" fill="none">
          <polygon points="28,2 52,15 52,41 28,54 4,41 4,15" stroke="#39FF14" strokeWidth="2" />
        </svg>
      </div>
      {/* Small cyan square */}
      <div className="absolute top-[60%] right-[20%] w-10 h-10 opacity-[0.05] animate-floatSlow" style={{ animationDelay: '1s' }}>
        <svg viewBox="0 0 40 40" fill="none">
          <rect x="4" y="4" width="32" height="32" stroke="#00F0FF" strokeWidth="2" transform="rotate(15 20 20)" />
        </svg>
      </div>
      {/* Purple triangle */}
      <div className="absolute bottom-[20%] right-[8%] w-12 h-12 opacity-[0.07] animate-float" style={{ animationDelay: '3s' }}>
        <svg viewBox="0 0 48 48" fill="none">
          <polygon points="24,4 44,40 4,40" stroke="#7C3AED" strokeWidth="2" />
        </svg>
      </div>
      {/* Glow orbs */}
      <div className="absolute top-[10%] left-[50%] w-96 h-96 rounded-full bg-rally-purple/5 blur-3xl" />
      <div className="absolute bottom-[20%] right-[30%] w-80 h-80 rounded-full bg-rally-cyan/5 blur-3xl" />
      <div className="absolute top-[50%] left-[20%] w-64 h-64 rounded-full bg-rally-neonGreen/3 blur-3xl" />
    </div>
  );
}

/* ─── Detect user OS ─── */
function getOS(): string {
  const ua = navigator.userAgent;
  if (ua.includes('Win')) return 'Windows';
  if (ua.includes('Mac')) return 'macOS';
  if (ua.includes('Linux')) return 'Linux';
  if (ua.includes('Android')) return 'Android';
  if (/iPhone|iPad|iPod/.test(ua)) return 'iOS';
  return 'Windows';
}

/* ═══════════════════════════════════════════ */
/* ═══            LANDING PAGE             ═══ */
/* ═══════════════════════════════════════════ */

export default function LandingPage() {
  const [os, setOS] = useState('Windows');

  useEffect(() => {
    setOS(getOS());
  }, []);

  return (
    <div className="min-h-screen bg-rally-darkBg font-display">
      <Navbar />

      {/* ═══ HERO SECTION ═══ */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-b from-rally-darkBg via-[#0D1233] to-rally-darkBg" />
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(0, 240, 255, 0.08) 0%, transparent 70%), radial-gradient(ellipse 60% 50% at 30% 60%, rgba(124, 58, 237, 0.06) 0%, transparent 70%), radial-gradient(ellipse 40% 30% at 70% 30%, rgba(57, 255, 20, 0.04) 0%, transparent 70%)',
            }}
          />
          <FloatingShapes />
          {/* Grid lines */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: 'linear-gradient(rgba(0,240,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(0,240,255,0.3) 1px, transparent 1px)',
              backgroundSize: '60px 60px',
            }}
          />
        </div>

        {/* Hero Content */}
        <div className="relative z-10 max-w-5xl mx-auto px-4 text-center pt-24 pb-16">
          {/* Badge */}
          <AnimatedSection delay={0}>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-rally-cyan/20 bg-rally-cyan/5 mb-8">
              <span className="w-2 h-2 rounded-full bg-rally-neonGreen animate-pulse" />
              <span className="text-xs font-medium text-rally-cyan tracking-wide uppercase">
                Now in Open Beta
              </span>
            </div>
          </AnimatedSection>

          {/* Main Headline */}
          <AnimatedSection delay={100}>
            <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-tight leading-[0.9] mb-6">
              <span className="text-white">RALLY</span>
              <br />
              <span className="text-gradient">YOUR SQUAD</span>
            </h1>
          </AnimatedSection>

          {/* Subheadline */}
          <AnimatedSection delay={200}>
            <p className="text-lg sm:text-xl text-rally-muted max-w-2xl mx-auto mb-10 leading-relaxed font-sans font-light">
              The ultimate platform for gaming communities. Crystal-clear voice,
              blazing-fast text, and total control over your world.
              Built by gamers, for gamers who refuse to settle.
            </p>
          </AnimatedSection>

          {/* CTA Buttons */}
          <AnimatedSection delay={300}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/download"
                className="group relative inline-flex items-center gap-3 px-8 py-4 rounded-md font-bold text-lg text-white overflow-hidden transition-all duration-300 hover:scale-105"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-rally-purple via-rally-cyan to-rally-neonGreen opacity-90 group-hover:opacity-100 transition-opacity" />
                <span
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  style={{ boxShadow: 'inset 0 0 30px rgba(0, 240, 255, 0.3), 0 0 30px rgba(0, 240, 255, 0.3), 0 0 60px rgba(124, 58, 237, 0.2)' }}
                />
                <span className="relative flex items-center gap-3">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download for {os}
                </span>
              </Link>

              <Link
                to="/login"
                className="group inline-flex items-center gap-2 px-8 py-4 rounded-md font-semibold text-base text-white border border-white/10 hover:border-rally-cyan/30 hover:bg-white/5 transition-all duration-300"
              >
                Open Rally in Browser
                <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </AnimatedSection>

          {/* Platform icons */}
          <AnimatedSection delay={400}>
            <div className="flex items-center justify-center gap-8 mt-12 text-rally-dimmed">
              <span className="text-xs uppercase tracking-wider font-sans">Available on</span>
              <div className="flex items-center gap-5">
                {/* Windows */}
                <svg className="w-5 h-5 opacity-40 hover:opacity-80 transition-opacity" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" />
                </svg>
                {/* macOS */}
                <svg className="w-5 h-5 opacity-40 hover:opacity-80 transition-opacity" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                </svg>
                {/* Linux */}
                <svg className="w-5 h-5 opacity-40 hover:opacity-80 transition-opacity" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.05 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.832-.41 1.684-.287 2.489a.424.424 0 00-.11.135c-.26.268-.45.6-.663.839-.199.199-.485.267-.797.4-.313.136-.658.269-.864.68-.09.189-.136.394-.132.602 0 .199.027.4.055.536.058.399.116.728.04.97-.249.68-.28 1.145-.106 1.484.174.334.535.47.94.601.81.2 1.91.135 2.774.6.926.466 1.866.67 2.616.47.526-.116.97-.464 1.208-.946.587-.003 1.23-.269 2.26-.334.699-.058 1.574.267 2.577.2.025.134.063.198.114.333l.003.003c.391.778 1.113 1.368 1.884 1.43.868.07 1.723-.559 1.89-1.151.076-.262.032-.412-.06-.667-.284-.749-.543-1.616-.196-2.028.291-.348.783-.46 1.305-.668.564-.227 1.187-.532 1.489-1.17.305-.642.121-1.465-.22-2.063-.789-1.39-2.028-2.99-2.903-4.042-.747-.896-.97-1.755-1.044-2.846-.065-1.49 1.057-5.966-3.184-6.299-.165-.014-.33-.021-.495-.021zM12.516 1.51c.14 0 .28.006.42.019 2.844.222 2.36 3.457 2.413 5.372.065 1.205.304 2.214 1.136 3.214.883 1.057 2.103 2.625 2.85 3.94.258.454.397 1.058.164 1.547-.22.46-.725.713-1.22.907-.495.194-1.015.359-1.402.834-.51.633-.37 1.6-.04 2.468.042.11.082.207.109.3-.05.001-.089-.047-.128-.132-.29-.572-.86-.961-1.494-1.01-.583-.047-1.137.37-1.347 1.079-.01.033-.02.068-.027.104-.29.058-.67.054-1.119-.133-.823-.4-1.89-.361-2.816-.188-.392.075-.72.21-.974.305-.073.03-.135.058-.191.08a1.42 1.42 0 01-.085-.268c-.065-.265-.041-.482-.032-.645.021-.345.051-.597-.056-.965-.228-.768-.728-1.282-1.42-1.282-.508 0-.974.282-1.174.754-.236.568-.064 1.18.22 1.706.046.085.093.165.139.242-.42-.26-.74-.547-.855-.898-.12-.367-.044-.809.213-1.491.145-.383.082-.758.024-1.152-.031-.146-.055-.293-.055-.49-.003-.156.025-.31.089-.446.115-.228.337-.294.635-.425.363-.146.73-.312 1.004-.618.27-.295.443-.646.625-.965.085-.145.17-.276.27-.393.183-.214.42-.467.645-.762.895-1.139 1.077-2.048 1.148-3.038.057-1.192-.64-5.22 2.475-5.408.126-.007.248-.014.373-.014z" />
                </svg>
                {/* iOS */}
                <svg className="w-5 h-5 opacity-40 hover:opacity-80 transition-opacity" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M15.769 0H8.231C3.684 0 0 3.684 0 8.231v7.538C0 20.316 3.684 24 8.231 24h7.538C20.316 24 24 20.316 24 15.769V8.231C24 3.684 20.316 0 15.769 0zM12 18.4c-3.535 0-6.4-2.865-6.4-6.4S8.465 5.6 12 5.6s6.4 2.865 6.4 6.4-2.865 6.4-6.4 6.4z" />
                </svg>
                {/* Android */}
                <svg className="w-5 h-5 opacity-40 hover:opacity-80 transition-opacity" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.523 15.341a1 1 0 001-1v-5.4a2.584 2.584 0 00-2.582-2.582h-7.882A2.584 2.584 0 005.477 8.94v5.4a1 1 0 002 0v-5.4a.584.584 0 01.582-.582h7.882a.584.584 0 01.582.582v5.4a1 1 0 001 0zM3.477 8.94a1 1 0 00-2 0v5.4a1 1 0 002 0v-5.4zM22.523 8.94a1 1 0 00-2 0v5.4a1 1 0 002 0v-5.4zM15.682 3.86l1.1-1.6a.5.5 0 10-.82-.564l-1.17 1.7a7.252 7.252 0 00-5.584 0l-1.17-1.7a.5.5 0 10-.82.564l1.1 1.6A4.586 4.586 0 005.477 8.36h13.046a4.586 4.586 0 00-2.841-4.5zM9.477 7.36a.75.75 0 110-1.5.75.75 0 010 1.5zm5 0a.75.75 0 110-1.5.75.75 0 010 1.5zM8.477 15.94v3a1.5 1.5 0 003 0v-3h1v3a1.5 1.5 0 003 0v-3" />
                </svg>
              </div>
            </div>
          </AnimatedSection>
        </div>

        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-rally-darkBg to-transparent" />
      </section>

      {/* ═══ STATS BAR ═══ */}
      <section className="relative py-16 border-y border-white/5">
        <div className="absolute inset-0 bg-gradient-to-r from-rally-purple/5 via-rally-cyan/5 to-rally-neonGreen/5" />
        <div className="relative max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, i) => (
              <AnimatedSection key={stat.label} delay={i * 100} className="text-center">
                <div className="text-3xl sm:text-4xl font-black text-gradient mb-2 font-display">
                  {stat.value}
                </div>
                <div className="text-sm text-rally-dimmed font-sans uppercase tracking-wider">
                  {stat.label}
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FEATURES ═══ */}
      <section id="features" className="py-24 lg:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section header */}
          <AnimatedSection className="text-center mb-20">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-rally-cyan mb-4 block font-sans">
              Built Different
            </span>
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white mb-6">
              EVERYTHING YOU NEED.
              <br />
              <span className="text-gradient">NOTHING YOU DON'T.</span>
            </h2>
            <p className="text-lg text-rally-muted max-w-2xl mx-auto font-sans font-light">
              Every feature designed with competitive gamers in mind.
              No bloat, no compromises, no excuses.
            </p>
          </AnimatedSection>

          {/* Feature grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {features.map((feature, i) => (
              <AnimatedSection key={feature.title} delay={i * 100}>
                <div className="group relative h-full p-8 rounded-xl border border-white/5 bg-gradient-to-b from-white/[0.03] to-transparent hover:border-rally-cyan/20 hover:bg-white/[0.04] transition-all duration-500">
                  {/* Corner accent */}
                  <div className="absolute top-0 right-0 w-16 h-16 overflow-hidden rounded-tr-xl">
                    <div className="absolute top-0 right-0 w-px h-8 bg-gradient-to-b from-rally-cyan/30 to-transparent" />
                    <div className="absolute top-0 right-0 h-px w-8 bg-gradient-to-l from-rally-cyan/30 to-transparent" />
                  </div>

                  {/* Icon */}
                  <div className="w-14 h-14 mb-6 opacity-80 group-hover:opacity-100 transition-opacity duration-300">
                    {feature.icon}
                  </div>

                  {/* Content */}
                  <h3 className="text-xl font-bold text-white mb-3 tracking-tight">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-rally-muted leading-relaxed font-sans">
                    {feature.description}
                  </p>

                  {/* Bottom glow on hover */}
                  <div className="absolute bottom-0 left-[20%] right-[20%] h-px bg-gradient-to-r from-transparent via-rally-cyan/0 to-transparent group-hover:via-rally-cyan/30 transition-all duration-500" />
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ MARQUEE DIVIDER ═══ */}
      <section className="py-12 overflow-hidden border-y border-white/5 bg-rally-darkerBg/50">
        <div className="flex animate-marquee whitespace-nowrap">
          {[...marqueeWords, ...marqueeWords].map((word, i) => (
            <span key={i} className="mx-8 text-4xl sm:text-5xl font-black text-white/[0.04] font-pixel tracking-wider select-none">
              {word}
            </span>
          ))}
        </div>
      </section>

      {/* ═══ SHOWCASE SECTIONS (Alternating Layout) ═══ */}
      <section className="py-24 lg:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-32">
          {/* Section 1: Voice Chat */}
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
            <AnimatedSection className="flex-1">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-rally-neonGreen mb-4 block font-sans">
                Voice & Video
              </span>
              <h3 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white mb-6 leading-tight">
                HEAR EVERY
                <br />
                <span className="text-gradient-green">CALLOUT</span>
              </h3>
              <p className="text-base text-rally-muted font-sans font-light leading-relaxed mb-8 max-w-lg">
                Our voice engine is built from scratch for gaming. AI-powered noise
                suppression eliminates keyboard clicks, fan noise, and background chatter.
                Spatial audio puts teammates in your ears like they're sitting next to you.
              </p>
              <Link
                to="/download"
                className="inline-flex items-center gap-2 text-sm font-semibold text-rally-cyan hover:text-white transition-colors group"
              >
                Try it now
                <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
            </AnimatedSection>
            <AnimatedSection className="flex-1" delay={200}>
              <div className="relative rounded-xl overflow-hidden border border-white/5 bg-rally-darkerBg p-6">
                {/* Simulated voice channel UI */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-2 h-2 rounded-full bg-rally-neonGreen animate-pulse" />
                  <span className="text-sm font-semibold text-rally-neonGreen font-sans">Voice Connected</span>
                </div>
                <div className="text-xs text-rally-dimmed uppercase tracking-wider mb-3 font-sans">Gaming Lounge</div>
                {[
                  { name: 'PhantomX', status: 'speaking', color: 'border-rally-neonGreen' },
                  { name: 'NeonBlade', status: 'connected', color: 'border-rally-cyan' },
                  { name: 'VoidWalker', status: 'connected', color: 'border-rally-purple' },
                  { name: 'CyberFox', status: 'muted', color: 'border-rally-dimmed' },
                ].map((user) => (
                  <div key={user.name} className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-white/5 transition-colors">
                    <div className={`w-8 h-8 rounded-full bg-rally-cardBg border-2 ${user.color} flex items-center justify-center text-xs font-bold`}>
                      {user.name[0]}
                    </div>
                    <span className="text-sm font-medium text-white font-sans">{user.name}</span>
                    {user.status === 'speaking' && (
                      <div className="ml-auto flex items-center gap-1">
                        {[1, 2, 3].map((bar) => (
                          <div
                            key={bar}
                            className="w-0.5 bg-rally-neonGreen rounded-full"
                            style={{
                              height: `${8 + bar * 4}px`,
                              animation: `typingBounce ${0.6 + bar * 0.2}s ease-in-out infinite`,
                            }}
                          />
                        ))}
                      </div>
                    )}
                    {user.status === 'muted' && (
                      <svg className="w-4 h-4 ml-auto text-rally-dimmed" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                      </svg>
                    )}
                  </div>
                ))}
                {/* Glow effect */}
                <div className="absolute -top-20 -right-20 w-40 h-40 bg-rally-neonGreen/10 rounded-full blur-3xl" />
              </div>
            </AnimatedSection>
          </div>

          {/* Section 2: Text Chat */}
          <div className="flex flex-col lg:flex-row-reverse items-center gap-12 lg:gap-20">
            <AnimatedSection className="flex-1">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-rally-cyan mb-4 block font-sans">
                Messaging
              </span>
              <h3 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white mb-6 leading-tight">
                CHAT THAT
                <br />
                <span className="text-gradient">KEEPS UP</span>
              </h3>
              <p className="text-base text-rally-muted font-sans font-light leading-relaxed mb-8 max-w-lg">
                Rich text, code blocks, file sharing, threads, and reactions.
                Everything loads instantly. Search your entire history in milliseconds.
                This is messaging without the waiting.
              </p>
              <Link
                to="/download"
                className="inline-flex items-center gap-2 text-sm font-semibold text-rally-cyan hover:text-white transition-colors group"
              >
                Start chatting
                <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
            </AnimatedSection>
            <AnimatedSection className="flex-1" delay={200}>
              <div className="relative rounded-xl overflow-hidden border border-white/5 bg-rally-darkerBg p-6">
                {/* Simulated chat UI */}
                <div className="space-y-4">
                  {[
                    { user: 'NeonBlade', msg: 'Anyone up for ranked? Need 2 more', time: '9:42 PM', color: 'text-rally-cyan' },
                    { user: 'PhantomX', msg: "I'm in. Let me grab my headset", time: '9:42 PM', color: 'text-rally-neonGreen' },
                    { user: 'VoidWalker', msg: 'Count me in. Which map are we banning?', time: '9:43 PM', color: 'text-rally-purple' },
                  ].map((message, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-rally-cardBg flex items-center justify-center text-xs font-bold text-white shrink-0">
                        {message.user[0]}
                      </div>
                      <div>
                        <div className="flex items-baseline gap-2">
                          <span className={`text-sm font-semibold ${message.color}`}>{message.user}</span>
                          <span className="text-[10px] text-rally-dimmed font-sans">{message.time}</span>
                        </div>
                        <p className="text-sm text-rally-muted font-sans mt-0.5">{message.msg}</p>
                      </div>
                    </div>
                  ))}
                  {/* Typing indicator */}
                  <div className="flex items-center gap-2 px-3 pt-2">
                    <div className="flex gap-1">
                      <div className="typing-dot" />
                      <div className="typing-dot" />
                      <div className="typing-dot" />
                    </div>
                    <span className="text-xs text-rally-dimmed font-sans">CyberFox is typing...</span>
                  </div>
                </div>
                {/* Input bar */}
                <div className="mt-4 flex items-center gap-2 bg-rally-cardBg rounded-lg px-4 py-3">
                  <svg className="w-5 h-5 text-rally-dimmed" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span className="text-sm text-rally-dimmed font-sans">Message #general</span>
                </div>
                <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-rally-cyan/10 rounded-full blur-3xl" />
              </div>
            </AnimatedSection>
          </div>

          {/* Section 3: Community */}
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
            <AnimatedSection className="flex-1">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-rally-purple mb-4 block font-sans">
                Community
              </span>
              <h3 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white mb-6 leading-tight">
                BUILD YOUR
                <br />
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-rally-purple to-rally-cyan">EMPIRE</span>
              </h3>
              <p className="text-base text-rally-muted font-sans font-light leading-relaxed mb-8 max-w-lg">
                Create servers with unlimited channels, custom roles with
                granular permissions, invite links, and built-in moderation.
                From a 5-person squad to a 50,000-member community —
                Rally scales with you.
              </p>
              <Link
                to="/download"
                className="inline-flex items-center gap-2 text-sm font-semibold text-rally-cyan hover:text-white transition-colors group"
              >
                Create a server
                <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
            </AnimatedSection>
            <AnimatedSection className="flex-1" delay={200}>
              <div className="relative rounded-xl overflow-hidden border border-white/5 bg-rally-darkerBg p-6">
                {/* Server sidebar mockup */}
                <div className="flex gap-4">
                  {/* Server icons */}
                  <div className="flex flex-col gap-2">
                    {['AP', 'GG', 'FN', 'CS', 'VR'].map((s, i) => (
                      <div
                        key={s}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold transition-all hover:rounded-lg cursor-pointer ${
                          i === 0
                            ? 'bg-gradient-to-br from-rally-purple to-rally-cyan text-white'
                            : 'bg-rally-cardBg text-rally-muted hover:text-white'
                        }`}
                      >
                        {s}
                      </div>
                    ))}
                  </div>
                  {/* Channel list */}
                  <div className="flex-1">
                    <div className="text-xs font-semibold text-white mb-3 font-sans">Apex Predators</div>
                    <div className="text-[10px] uppercase tracking-wider text-rally-dimmed mb-2 font-sans">Text Channels</div>
                    {['# general', '# strategies', '# highlights', '# lfg'].map((ch, i) => (
                      <div
                        key={ch}
                        className={`text-sm py-1.5 px-2 rounded cursor-pointer transition-colors font-sans ${
                          i === 0 ? 'text-white bg-white/5' : 'text-rally-dimmed hover:text-rally-muted'
                        }`}
                      >
                        {ch}
                      </div>
                    ))}
                    <div className="text-[10px] uppercase tracking-wider text-rally-dimmed mb-2 mt-4 font-sans">Voice Channels</div>
                    {['Gaming Lounge', 'Ranked Squad'].map((ch) => (
                      <div key={ch} className="flex items-center gap-2 text-sm py-1.5 px-2 rounded text-rally-dimmed hover:text-rally-muted cursor-pointer transition-colors font-sans">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                        </svg>
                        {ch}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="absolute -top-16 -right-16 w-32 h-32 bg-rally-purple/10 rounded-full blur-3xl" />
              </div>
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* ═══ FINAL CTA ═══ */}
      <section className="relative py-32 overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-b from-rally-darkBg via-[#0D1233] to-rally-darkBg" />
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                'radial-gradient(ellipse 50% 50% at 50% 50%, rgba(124, 58, 237, 0.1) 0%, transparent 70%)',
            }}
          />
          {/* Grid */}
          <div
            className="absolute inset-0 opacity-[0.02]"
            style={{
              backgroundImage: 'linear-gradient(rgba(0,240,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(0,240,255,0.5) 1px, transparent 1px)',
              backgroundSize: '40px 40px',
            }}
          />
        </div>

        <div className="relative z-10 max-w-3xl mx-auto px-4 text-center">
          <AnimatedSection>
            <p className="font-pixel text-xs text-rally-cyan tracking-wider mb-8 uppercase">
              Stop scrolling. Start playing.
            </p>
            <h2 className="text-4xl sm:text-5xl lg:text-7xl font-black tracking-tight text-white mb-6">
              READY TO
              <br />
              <span className="text-gradient">RALLY?</span>
            </h2>
            <p className="text-lg text-rally-muted font-sans font-light mb-10 max-w-xl mx-auto">
              Join millions of gamers building the communities they've always wanted.
              Free forever. No compromises.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/download"
                className="group relative inline-flex items-center gap-3 px-10 py-4 rounded-md font-bold text-lg text-white overflow-hidden transition-all duration-300 hover:scale-105"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-rally-purple via-rally-cyan to-rally-neonGreen opacity-90 group-hover:opacity-100 transition-opacity" />
                <span
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  style={{ boxShadow: 'inset 0 0 30px rgba(0, 240, 255, 0.3), 0 0 40px rgba(0, 240, 255, 0.4), 0 0 80px rgba(124, 58, 237, 0.3)' }}
                />
                <span className="relative flex items-center gap-3">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download for {os}
                </span>
              </Link>
            </div>
          </AnimatedSection>
        </div>
      </section>

      <Footer />
    </div>
  );
}
