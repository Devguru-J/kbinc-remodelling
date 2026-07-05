/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,ts,tsx,md}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'charcoal-void': '#141414',
        'graphite-surface': '#1E1E1E',
        'steel-panel': '#262626',
        'bright-alloy': '#F5F5F5',
        'muted-zinc': '#8A8A8A',
        'hairline-steel': 'rgba(245,245,245,0.10)',
        'arterial-red': '#C8102E',
        'arterial-red-dim': '#9E0C24',
      },
      borderRadius: { DEFAULT: '2px', lg: '2px', xl: '2px' },
      maxWidth: { container: '1400px' },
      spacing: { 'section-v': 'clamp(4rem, 10vw, 8rem)', gutter: '1.5rem' },
      fontFamily: {
        display: ['Pretendard Variable', 'Pretendard', 'sans-serif'],
        body: ['Pretendard Variable', 'Pretendard', 'sans-serif'],
        mono: ['Pretendard Variable', 'Pretendard', 'sans-serif'],
      },
      letterSpacing: { tightest: '-0.03em' },
      keyframes: {
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-8px)' } },
      },
      animation: { float: 'float 6s ease-in-out infinite' },
    },
  },
  plugins: [],
};
