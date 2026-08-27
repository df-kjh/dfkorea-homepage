/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#0066ff',
        secondary: '#4E5968',
        'background-light': '#f5f8f8',
        'background-dark': '#0f2123',
        // About page colors (light theme)
        background: '#FFFFFF',
        surface: '#F2F4F6',
        'text-main': '#191F28',
        'text-sub': '#4E5968',
        'text-desc': '#8B95A1',
      },
      fontFamily: {
        sans: ['Noto Sans KR', 'system-ui', 'sans-serif'],
        noto: ['Noto Sans KR', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        sm: '2px',
      },
      backdropBlur: {
        md: '12px',
      },
      keyframes: {
        'slide-in-left': {
          '0%': {
            opacity: '0',
            transform: 'translateX(-20px)',
          },
          '100%': {
            opacity: '1',
            transform: 'translateX(0)',
          },
        },
      },
      animation: {
        'slide-in-left': 'slide-in-left 0.4s ease-out forwards',
      },
    },
  },
  plugins: [],
}
