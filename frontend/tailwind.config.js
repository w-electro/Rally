/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        rally: {
          blue: '#00D9FF',
          green: '#39FF14',
          purple: '#8B00FF',
          'deep-purple': '#4B0082',
          black: '#000000',
          navy: '#0A0E27',
          cyan: '#00F0FF',
          magenta: '#FF006E',
          'dark-surface': '#0D1117',
          'surface': '#161B22',
          'surface-light': '#21262D',
          'border': '#30363D',
          'text': '#E6EDF3',
          'text-muted': '#8B949E',
        },
      },
      fontFamily: {
        display: ['Rajdhani', 'Orbitron', 'sans-serif'],
        body: ['Exo 2', 'Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      backgroundImage: {
        'purple-gradient': 'linear-gradient(135deg, #8B00FF, #4B0082)',
        'neon-gradient': 'linear-gradient(135deg, #00D9FF, #39FF14)',
        'magenta-gradient': 'linear-gradient(135deg, #FF006E, #8B00FF)',
        'surface-gradient': 'linear-gradient(180deg, #0D1117, #0A0E27)',
      },
      boxShadow: {
        'neon-blue': '0 0 10px rgba(0, 217, 255, 0.3), 0 0 20px rgba(0, 217, 255, 0.1)',
        'neon-green': '0 0 10px rgba(57, 255, 20, 0.3), 0 0 20px rgba(57, 255, 20, 0.1)',
        'neon-purple': '0 0 10px rgba(139, 0, 255, 0.3), 0 0 20px rgba(139, 0, 255, 0.1)',
        'neon-magenta': '0 0 10px rgba(255, 0, 110, 0.3), 0 0 20px rgba(255, 0, 110, 0.1)',
      },
      animation: {
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'neon-flicker': 'neon-flicker 3s ease-in-out infinite',
        'slide-in-left': 'slide-in-left 0.3s ease-out',
        'slide-in-right': 'slide-in-right 0.3s ease-out',
        'fade-in': 'fade-in 0.2s ease-out',
        'scale-in': 'scale-in 0.2s ease-out',
      },
      keyframes: {
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 5px rgba(0, 217, 255, 0.2)' },
          '50%': { boxShadow: '0 0 20px rgba(0, 217, 255, 0.4), 0 0 40px rgba(0, 217, 255, 0.1)' },
        },
        'neon-flicker': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.85' },
          '75%': { opacity: '0.95' },
        },
        'slide-in-left': {
          '0%': { transform: 'translateX(-20px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        'slide-in-right': {
          '0%': { transform: 'translateX(20px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scale-in': {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
