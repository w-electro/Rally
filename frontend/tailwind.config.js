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
          neonGreen: '#39FF14',
          electricBlue: '#00B4D8',
          deepPurple: '#4C1D95',
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
        fadeInUp: 'fadeInUp 0.6s ease-out forwards',
        fadeInLeft: 'fadeInLeft 0.6s ease-out forwards',
        fadeInRight: 'fadeInRight 0.6s ease-out forwards',
        slideIn: 'slideIn 0.3s ease-out',
        slideInRight: 'slideInRight 0.3s ease-out',
        slideInUp: 'slideInUp 0.2s ease-out',
        pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        bounce: 'bounce 1s infinite',
        spin: 'spin 1s linear infinite',
        glow: 'glow 2s ease-in-out infinite alternate',
        float: 'float 6s ease-in-out infinite',
        floatSlow: 'float 8s ease-in-out infinite',
        gradientShift: 'gradientShift 8s ease infinite',
        textGlow: 'textGlow 2s ease-in-out infinite alternate',
        marquee: 'marquee 20s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(30px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeInLeft: {
          '0%': { opacity: '0', transform: 'translateX(-30px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        fadeInRight: {
          '0%': { opacity: '0', transform: 'translateX(30px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
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
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        gradientShift: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        textGlow: {
          '0%': { textShadow: '0 0 10px rgba(0, 240, 255, 0.3)' },
          '100%': { textShadow: '0 0 30px rgba(0, 240, 255, 0.8), 0 0 60px rgba(124, 58, 237, 0.4)' },
        },
        marquee: {
          '0%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Poppins', 'system-ui', 'sans-serif'],
        pixel: ['"Press Start 2P"', 'monospace'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
};
