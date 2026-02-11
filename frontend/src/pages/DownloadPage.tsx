import { useEffect, useState, useRef } from 'react';
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
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.unobserve(el); } },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);
  return { ref, visible };
}

function AnimatedSection({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const { ref, visible } = useInView();
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* ─── OS Detection ─── */
type Platform = 'windows' | 'macos' | 'linux' | 'ios' | 'android' | 'unknown';

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  if (ua.includes('Win')) return 'windows';
  if (ua.includes('Mac')) return 'macos';
  if (ua.includes('Linux')) return 'linux';
  return 'windows';
}

const platformLabels: Record<Platform, string> = {
  windows: 'Windows',
  macos: 'macOS',
  linux: 'Linux',
  ios: 'iOS',
  android: 'Android',
  unknown: 'your platform',
};

/* ─── Icons ─── */
function WindowsIcon({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" />
    </svg>
  );
}

function AppleIcon({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  );
}

function LinuxIcon({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.05 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.832-.41 1.684-.287 2.489a.424.424 0 00-.11.135c-.26.268-.45.6-.663.839-.199.199-.485.267-.797.4-.313.136-.658.269-.864.68-.09.189-.136.394-.132.602 0 .199.027.4.055.536.058.399.116.728.04.97-.249.68-.28 1.145-.106 1.484.174.334.535.47.94.601.81.2 1.91.135 2.774.6.926.466 1.866.67 2.616.47.526-.116.97-.464 1.208-.946.587-.003 1.23-.269 2.26-.334.699-.058 1.574.267 2.577.2.025.134.063.198.114.333l.003.003c.391.778 1.113 1.368 1.884 1.43.868.07 1.723-.559 1.89-1.151.076-.262.032-.412-.06-.667-.284-.749-.543-1.616-.196-2.028.291-.348.783-.46 1.305-.668.564-.227 1.187-.532 1.489-1.17.305-.642.121-1.465-.22-2.063-.789-1.39-2.028-2.99-2.903-4.042-.747-.896-.97-1.755-1.044-2.846-.065-1.49 1.057-5.966-3.184-6.299-.165-.014-.33-.021-.495-.021z" />
    </svg>
  );
}

function AndroidIcon({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M17.523 15.341a1 1 0 001-1v-5.4a2.584 2.584 0 00-2.582-2.582h-7.882A2.584 2.584 0 005.477 8.94v5.4a1 1 0 002 0v-5.4a.584.584 0 01.582-.582h7.882a.584.584 0 01.582.582v5.4a1 1 0 001 0zM3.477 8.94a1 1 0 00-2 0v5.4a1 1 0 002 0v-5.4zM22.523 8.94a1 1 0 00-2 0v5.4a1 1 0 002 0v-5.4zM15.682 3.86l1.1-1.6a.5.5 0 10-.82-.564l-1.17 1.7a7.252 7.252 0 00-5.584 0l-1.17-1.7a.5.5 0 10-.82.564l1.1 1.6A4.586 4.586 0 005.477 8.36h13.046a4.586 4.586 0 00-2.841-4.5zM9.477 7.36a.75.75 0 110-1.5.75.75 0 010 1.5zm5 0a.75.75 0 110-1.5.75.75 0 010 1.5z" />
    </svg>
  );
}

/* ─── Download URLs ─── */
const DOWNLOAD_URLS: Record<string, string> = {
  'windows-x64': '/downloads/Rally-1.0.0-win-x64.zip',
};

/* ─── Download card component ─── */
function DownloadCard({
  icon,
  platform,
  description,
  primary = false,
  options,
  href,
}: {
  icon: React.ReactNode;
  platform: string;
  description: string;
  primary?: boolean;
  options?: { label: string; sublabel?: string; href?: string }[];
  href?: string;
}) {
  return (
    <div
      className={`group relative p-8 rounded-xl border transition-all duration-300 hover:scale-[1.02] ${
        primary
          ? 'border-rally-cyan/30 bg-gradient-to-b from-rally-cyan/5 to-transparent hover:border-rally-cyan/50'
          : 'border-white/5 bg-gradient-to-b from-white/[0.03] to-transparent hover:border-white/10'
      }`}
    >
      {/* Primary indicator */}
      {primary && (
        <div className="absolute -top-px left-[20%] right-[20%] h-px bg-gradient-to-r from-transparent via-rally-cyan to-transparent" />
      )}

      <div className="flex flex-col items-center text-center">
        <div className={`mb-4 ${primary ? 'text-rally-cyan' : 'text-rally-muted'} transition-colors duration-300 group-hover:text-white`}>
          {icon}
        </div>
        <h3 className="text-lg font-bold text-white mb-2 font-display">{platform}</h3>
        <p className="text-sm text-rally-dimmed mb-6 font-sans">{description}</p>

        {options ? (
          <div className="flex flex-col gap-2 w-full">
            {options.map((opt) => (
              <a
                key={opt.label + (opt.sublabel || '')}
                href={opt.href || '#'}
                download
                className={`w-full py-3 px-4 rounded-lg font-semibold text-sm transition-all duration-200 text-center block ${
                  primary
                    ? 'bg-rally-cyan/10 hover:bg-rally-cyan/20 text-rally-cyan border border-rally-cyan/20 hover:border-rally-cyan/40'
                    : 'bg-white/5 hover:bg-white/10 text-white border border-white/10 hover:border-white/20'
                } ${!opt.href ? 'opacity-50 pointer-events-none' : ''}`}
              >
                {opt.label}
                {opt.sublabel && (
                  <span className="text-xs text-rally-dimmed ml-2">{opt.sublabel}</span>
                )}
              </a>
            ))}
          </div>
        ) : (
          <a
            href={href || '#'}
            download
            className={`w-full py-3 px-6 rounded-lg font-semibold text-sm transition-all duration-200 text-center block ${
              primary
                ? 'bg-gradient-to-r from-rally-purple to-rally-cyan text-white hover:opacity-90 glow-cyan'
                : 'bg-white/5 hover:bg-white/10 text-white border border-white/10 hover:border-white/20'
            } ${!href ? 'opacity-50 pointer-events-none' : ''}`}
          >
            Download
          </a>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════ */
/* ═══          DOWNLOAD PAGE              ═══ */
/* ═══════════════════════════════════════════ */

export default function DownloadPage() {
  const [platform, setPlatform] = useState<Platform>('windows');

  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

  return (
    <div className="min-h-screen bg-rally-darkBg font-display">
      <Navbar />

      {/* ═══ HERO ═══ */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-b from-[#0D1233] to-rally-darkBg" />
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                'radial-gradient(ellipse 60% 50% at 50% 30%, rgba(0, 240, 255, 0.1) 0%, transparent 70%), radial-gradient(ellipse 40% 40% at 70% 60%, rgba(124, 58, 237, 0.08) 0%, transparent 70%)',
            }}
          />
          <div
            className="absolute inset-0 opacity-[0.02]"
            style={{
              backgroundImage: 'linear-gradient(rgba(0,240,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(0,240,255,0.5) 1px, transparent 1px)',
              backgroundSize: '50px 50px',
            }}
          />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-4 text-center">
          <AnimatedSection>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white mb-6">
              DOWNLOAD
              <br />
              <span className="text-gradient">RALLY</span>
            </h1>
            <p className="text-lg text-rally-muted max-w-2xl mx-auto font-sans font-light leading-relaxed">
              Talk, play, and dominate with your squad on any device.
              Available on {platformLabels[platform] === 'your platform' ? 'all major platforms' : platformLabels[platform]} and everywhere else.
            </p>
          </AnimatedSection>
        </div>
      </section>

      {/* ═══ PRIMARY DOWNLOAD ═══ */}
      <section className="relative pb-20">
        <div className="max-w-4xl mx-auto px-4">
          <AnimatedSection>
            <div className="relative p-10 rounded-2xl border border-rally-cyan/20 bg-gradient-to-b from-rally-cyan/5 to-transparent text-center overflow-hidden">
              <div className="absolute -top-px left-[10%] right-[10%] h-px bg-gradient-to-r from-transparent via-rally-cyan/50 to-transparent" />

              <div className="text-rally-cyan mb-4">
                {platform === 'macos' || platform === 'ios' ? (
                  <AppleIcon className="w-16 h-16 mx-auto" />
                ) : platform === 'linux' ? (
                  <LinuxIcon className="w-16 h-16 mx-auto" />
                ) : platform === 'android' ? (
                  <AndroidIcon className="w-16 h-16 mx-auto" />
                ) : (
                  <WindowsIcon className="w-16 h-16 mx-auto" />
                )}
              </div>

              <h2 className="text-2xl font-bold text-white mb-3">
                Download for {platformLabels[platform]}
              </h2>
              <p className="text-rally-muted font-sans mb-8 max-w-md mx-auto">
                Get Rally on your {platform === 'ios' || platform === 'android' ? 'device' : 'desktop'} and start
                rallying your squad in seconds.
              </p>

              <a
                href={DOWNLOAD_URLS[`${platform}-x64`] || DOWNLOAD_URLS['windows-x64']}
                download
                className="inline-flex items-center gap-3 px-10 py-4 rounded-md font-bold text-lg text-white bg-gradient-to-r from-rally-purple via-rally-cyan to-rally-neonGreen hover:opacity-90 transition-all duration-300 hover:scale-105 glow-cyan"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download Now
              </a>

              <p className="text-xs text-rally-dimmed mt-4 font-sans">
                Version 1.0.0 &middot; ~150 MB (zip)
              </p>

              {/* Decorative glow */}
              <div className="absolute -bottom-32 left-1/2 -translate-x-1/2 w-64 h-64 bg-rally-cyan/10 rounded-full blur-3xl" />
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ═══ DESKTOP DOWNLOADS ═══ */}
      <section className="py-20 border-t border-white/5">
        <div className="max-w-6xl mx-auto px-4">
          <AnimatedSection className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">Desktop</h2>
            <p className="text-rally-muted font-sans">
              Full-featured desktop app with hardware-accelerated voice and video.
            </p>
          </AnimatedSection>

          <div className="grid md:grid-cols-3 gap-6">
            <AnimatedSection delay={0}>
              <DownloadCard
                icon={<WindowsIcon className="w-12 h-12" />}
                platform="Windows"
                description="Windows 10 or newer"
                primary={platform === 'windows'}
                options={[
                  { label: 'Download', sublabel: 'x64', href: DOWNLOAD_URLS['windows-x64'] },
                ]}
              />
            </AnimatedSection>
            <AnimatedSection delay={100}>
              <DownloadCard
                icon={<AppleIcon className="w-12 h-12" />}
                platform="macOS"
                description="macOS 11 Big Sur or newer — Coming Soon"
                primary={platform === 'macos'}
              />
            </AnimatedSection>
            <AnimatedSection delay={200}>
              <DownloadCard
                icon={<LinuxIcon className="w-12 h-12" />}
                platform="Linux"
                description="Ubuntu 20.04+, Fedora 33+ — Coming Soon"
                primary={platform === 'linux'}
              />
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* ═══ MOBILE DOWNLOADS ═══ */}
      <section className="py-20 border-t border-white/5">
        <div className="max-w-4xl mx-auto px-4">
          <AnimatedSection className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">Mobile</h2>
            <p className="text-rally-muted font-sans">
              Take Rally everywhere. Chat on the go, hop into voice from anywhere.
            </p>
          </AnimatedSection>

          <div className="grid sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
            <AnimatedSection delay={0}>
              <div className="group p-8 rounded-xl border border-white/5 bg-gradient-to-b from-white/[0.03] to-transparent hover:border-white/10 transition-all duration-300 text-center">
                <AppleIcon className="w-12 h-12 mx-auto mb-4 text-rally-muted group-hover:text-white transition-colors" />
                <h3 className="text-lg font-bold text-white mb-2">iOS</h3>
                <p className="text-sm text-rally-dimmed mb-6 font-sans">Requires iOS 16 or later</p>
                <button className="w-full py-3 px-6 rounded-lg font-semibold text-sm bg-white/5 hover:bg-white/10 text-white border border-white/10 hover:border-white/20 transition-all duration-200 flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                  </svg>
                  App Store
                </button>
              </div>
            </AnimatedSection>
            <AnimatedSection delay={100}>
              <div className="group p-8 rounded-xl border border-white/5 bg-gradient-to-b from-white/[0.03] to-transparent hover:border-white/10 transition-all duration-300 text-center">
                <AndroidIcon className="w-12 h-12 mx-auto mb-4 text-rally-muted group-hover:text-white transition-colors" />
                <h3 className="text-lg font-bold text-white mb-2">Android</h3>
                <p className="text-sm text-rally-dimmed mb-6 font-sans">Requires Android 8.0 or later</p>
                <button className="w-full py-3 px-6 rounded-lg font-semibold text-sm bg-white/5 hover:bg-white/10 text-white border border-white/10 hover:border-white/20 transition-all duration-200 flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.198l2.807 1.626a1 1 0 010 1.73l-2.808 1.626L15.206 12l2.492-2.491zM5.864 2.658L16.802 8.99l-2.303 2.303-8.635-8.635z" />
                  </svg>
                  Google Play
                </button>
              </div>
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* ═══ EXPERIMENTAL / PTB ═══ */}
      <section className="py-20 border-t border-white/5">
        <div className="max-w-4xl mx-auto px-4">
          <AnimatedSection className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-rally-neonGreen/20 bg-rally-neonGreen/5 mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-rally-neonGreen animate-pulse" />
              <span className="text-xs font-medium text-rally-neonGreen uppercase tracking-wider font-sans">Experimental</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">Public Test Build</h2>
            <p className="text-rally-muted font-sans max-w-lg mx-auto">
              Live on the bleeding edge. Try out features before they launch.
              Bug reports welcome, crashes expected.
            </p>
          </AnimatedSection>

          <div className="grid sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
            {[
              { name: 'Windows PTB', sub: 'x64', icon: <WindowsIcon className="w-6 h-6" /> },
              { name: 'macOS PTB', sub: 'Universal', icon: <AppleIcon className="w-6 h-6" /> },
              { name: 'Linux PTB', sub: '.deb', icon: <LinuxIcon className="w-6 h-6" /> },
            ].map((item, i) => (
              <AnimatedSection key={item.name} delay={i * 100}>
                <button className="w-full flex items-center gap-3 p-4 rounded-lg border border-white/5 bg-white/[0.02] hover:border-rally-neonGreen/20 hover:bg-white/[0.04] transition-all duration-200 group">
                  <span className="text-rally-dimmed group-hover:text-rally-neonGreen transition-colors">
                    {item.icon}
                  </span>
                  <div className="text-left">
                    <div className="text-sm font-semibold text-white">{item.name}</div>
                    <div className="text-xs text-rally-dimmed font-sans">{item.sub}</div>
                  </div>
                  <svg className="w-4 h-4 ml-auto text-rally-dimmed group-hover:text-rally-neonGreen transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </button>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ SYSTEM REQUIREMENTS ═══ */}
      <section className="py-20 border-t border-white/5">
        <div className="max-w-4xl mx-auto px-4">
          <AnimatedSection className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">System Requirements</h2>
          </AnimatedSection>

          <AnimatedSection delay={100}>
            <div className="grid sm:grid-cols-3 gap-8">
              {[
                {
                  platform: 'Windows',
                  reqs: ['Windows 10 or later', '4 GB RAM minimum', '200 MB disk space', 'x64 or ARM64 processor'],
                },
                {
                  platform: 'macOS',
                  reqs: ['macOS 11 Big Sur or later', '4 GB RAM minimum', '250 MB disk space', 'Intel or Apple Silicon'],
                },
                {
                  platform: 'Linux',
                  reqs: ['Ubuntu 20.04+ or equivalent', '4 GB RAM minimum', '200 MB disk space', 'x64 processor'],
                },
              ].map((item) => (
                <div key={item.platform} className="p-6 rounded-xl border border-white/5 bg-white/[0.02]">
                  <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-wider">{item.platform}</h3>
                  <ul className="space-y-2">
                    {item.reqs.map((req) => (
                      <li key={req} className="flex items-start gap-2 text-sm text-rally-dimmed font-sans">
                        <svg className="w-4 h-4 mt-0.5 text-rally-cyan shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {req}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ═══ BOTTOM CTA ═══ */}
      <section className="py-20 border-t border-white/5">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <AnimatedSection>
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">
              WHAT ARE YOU <span className="text-gradient">WAITING FOR?</span>
            </h2>
            <p className="text-rally-muted font-sans mb-8 max-w-md mx-auto">
              Your squad is already here. Download Rally and join the action.
            </p>
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-sm font-semibold text-rally-cyan hover:text-white transition-colors group"
            >
              Back to homepage
              <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </AnimatedSection>
        </div>
      </section>

      <Footer />
    </div>
  );
}
