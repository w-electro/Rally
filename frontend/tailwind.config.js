/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        rally: {
          darkBg: '#0A0E27',
          darkerBg: '#111640',
          cardBg: '#1A1F4E',
          cyan: '#00F0FF',
          purple: '#7C3AED',
          green: '#10B981',
          text: '#FFFFFF',
          muted: '#94A3B8',
          dimmed: '#64748B',
        },
      },
      backgroundColor: {
        primary: '#0A0E27',
        secondary: '#111640',
        tertiary: '#1A1F4E',
        accent: '#7C3AED',
        'accent-hover': '#6D28D9',
      },
      textColor: {
        primary: '#FFFFFF',
        secondary: '#94A3B8',
        dimmed: '#64748B',
        accent: '#00F0FF',
      },
      borderColor: {
        primary: '#1E2554',
        accent: '#7C3AED',
        cyan: '#00F0FF',
      },
      animation: {
        fadeIn: 'fadeIn 0.2s ease-in-out',
        slideIn: 'slideIn 0.3s ease-out',
        slideInRight: 'slideInRight 0.3s ease-out',
        slideInUp: 'slideInUp 0.2s ease-out',
        pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        bounce: 'bounce 1s infinite',
        spin: 'spin 1s linear infinite',
        glow: 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { opacity: '0', transform: 'translateX(-10px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(10px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideInUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(0, 240, 255, 0.2)' },
          '100%': { boxShadow: '0 0 20px rgba(0, 240, 255, 0.6)' },
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
};
