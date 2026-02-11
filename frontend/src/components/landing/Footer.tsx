import { Link } from 'react-router-dom';

const footerLinks = {
  Product: [
    { label: 'Download', href: '/download' },
    { label: 'Nitro', href: '/premium' },
    { label: 'Status', href: '/status' },
    { label: 'App Directory', href: '/directory' },
  ],
  Company: [
    { label: 'About', href: '/about' },
    { label: 'Jobs', href: '/careers' },
    { label: 'Brand', href: '/brand' },
    { label: 'Newsroom', href: '/news' },
  ],
  Resources: [
    { label: 'Support', href: '/support' },
    { label: 'Safety', href: '/safety' },
    { label: 'Blog', href: '/blog' },
    { label: 'Developers', href: '/developers' },
    { label: 'Community', href: '/community' },
  ],
  Policies: [
    { label: 'Terms', href: '/terms' },
    { label: 'Privacy', href: '/privacy' },
    { label: 'Guidelines', href: '/guidelines' },
    { label: 'Licenses', href: '/licenses' },
  ],
};

function SocialIcon({ type }: { type: string }) {
  const icons: Record<string, JSX.Element> = {
    twitter: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
    github: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
      </svg>
    ),
    youtube: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    ),
    instagram: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
      </svg>
    ),
    tiktok: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
      </svg>
    ),
  };
  return icons[type] || null;
}

export default function Footer() {
  return (
    <footer className="relative bg-rally-darkerBg border-t border-white/5">
      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-rally-cyan/30 to-transparent" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-8">
        {/* Top section */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8 lg:gap-12">
          {/* Brand */}
          <div className="col-span-2">
            <Link to="/" className="flex items-center gap-2.5 mb-4">
              <svg className="h-8 w-8" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <filter id="footerGlow">
                    <feGaussianBlur stdDeviation="1.5" result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                </defs>
                <polygon points="8,24 12,8 24,2 30,28" fill="#6D28D9" />
                <polygon points="24,2 50,20 30,28" fill="#7C3AED" />
                <polygon points="50,20 62,32 50,38 40,30" fill="#00D4FF" />
                <polygon points="30,28 50,20 40,30" fill="#4C1D95" />
                <polygon points="30,28 40,30 40,44 22,58" fill="#3730A3" />
                <polygon points="40,30 50,38 40,44" fill="#312E81" />
                <polygon points="8,24 30,28 22,58 6,48" fill="#1E1B4B" />
                <circle cx="38" cy="26" r="3.5" fill="#00F0FF" filter="url(#footerGlow)" />
                <circle cx="38" cy="26" r="1.5" fill="#FFFFFF" />
              </svg>
              <span className="font-display font-bold text-lg text-white">Rally</span>
            </Link>
            <p className="text-sm text-rally-dimmed leading-relaxed max-w-xs">
              The ultimate gaming communication platform. Built for gamers who demand more.
            </p>

            {/* Social Icons */}
            <div className="flex items-center gap-4 mt-6">
              {['twitter', 'instagram', 'youtube', 'tiktok', 'github'].map((social) => (
                <a
                  key={social}
                  href="#"
                  className="text-rally-dimmed hover:text-rally-cyan transition-colors duration-200"
                  aria-label={social}
                >
                  <SocialIcon type={social} />
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-rally-cyan mb-4">
                {category}
              </h3>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      to={link.href}
                      className="text-sm text-rally-dimmed hover:text-white transition-colors duration-200"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="mt-12 pt-8 border-t border-white/5">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-rally-dimmed">
              &copy; {new Date().getFullYear()} Rally. All rights reserved.
            </p>
            <div className="flex items-center gap-6">
              <Link to="/terms" className="text-xs text-rally-dimmed hover:text-white transition-colors">
                Terms
              </Link>
              <Link to="/privacy" className="text-xs text-rally-dimmed hover:text-white transition-colors">
                Privacy
              </Link>
              <Link to="/guidelines" className="text-xs text-rally-dimmed hover:text-white transition-colors">
                Guidelines
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
