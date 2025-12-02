/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'sgtm-orange': '#E59A2F',
        'sgtm-orange-dark': '#CC8526',
        'sgtm-orange-light': '#F5B24D',
        'sgtm-gray': '#3D3D3D',
        'sgtm-gray-dark': '#2D2D2D',
        'sgtm-gray-light': '#4D4D4D',
        hse: {
          primary: '#E59A2F',
          secondary: '#CC8526',
          accent: '#F5B24D',
          success: '#16a34a',
          warning: '#f59e0b',
          danger: '#dc2626',
          dark: '#3D3D3D',
          light: '#f8fafc',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-in': 'slideIn 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateX(-10px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
