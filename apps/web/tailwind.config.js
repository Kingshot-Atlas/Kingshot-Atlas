/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Backgrounds
        bg: '#0a0a0a',
        surface: '#111111',
        card: '#131318',
        'surface-hover': '#1a1a1a',
        
        // Borders
        border: '#2a2a2a',
        'border-subtle': '#1f1f1f',
        'border-strong': '#3a3a3a',
        
        // Text
        'text-primary': '#ffffff',
        'text-secondary': '#9ca3af',
        'text-muted': '#6b7280',
        
        // Brand & Accent
        primary: '#22d3ee',
        'primary-hover': '#06b6d4',
        success: '#22c55e',
        warning: '#eab308',
        error: '#ef4444',
        orange: '#f97316',
        purple: '#a855f7',
        blue: '#3b82f6',
        gold: '#fbbf24',
        discord: '#5865F2',
        
        // Tier colors
        'tier-s': '#fbbf24',
        'tier-a': '#22c55e',
        'tier-b': '#3b82f6',
        'tier-c': '#6b7280',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['Cinzel', 'Times New Roman', 'serif'],
        mono: ['Orbitron', 'monospace'],
      },
      borderRadius: {
        'sm': '4px',
        'md': '8px',
        'lg': '12px',
        'xl': '16px',
      },
      boxShadow: {
        'card': '0 4px 20px rgba(0, 0, 0, 0.2)',
        'card-hover': '0 12px 40px rgba(0, 0, 0, 0.4)',
        'tooltip': '0 4px 12px rgba(0, 0, 0, 0.4)',
        'glow': '0 0 20px rgba(34, 211, 238, 0.1)',
        'glow-primary': '0 0 20px rgba(34, 211, 238, 0.3)',
        'glow-gold': '0 0 20px rgba(251, 191, 36, 0.3)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease',
        'slide-in': 'slideIn 0.3s ease',
        'slide-up': 'slideUp 0.2s ease',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(34, 211, 238, 0.1)' },
          '50%': { boxShadow: '0 0 30px rgba(34, 211, 238, 0.3)' },
        },
      },
    },
  },
  plugins: [],
}
