/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        orange: {
          DEFAULT: '#FF7900',
          dark: '#E66E00',
          light: '#FFF5EB',
        },
        ink: {
          DEFAULT: '#0A0A0A',
          2: '#2C2C2C',
          3: '#5C5C5C',
          4: '#9A9A9A',
        },
        line: { DEFAULT: '#ECECEC', 2: '#F5F5F5' },
        bg: '#FAFAFA',
        green: { DEFAULT: '#00A86B', light: '#E8F7F0' },
        red: { DEFAULT: '#E63946', light: '#FDECEE' },
        amber: { DEFAULT: '#F59E0B', light: '#FEF6E7' },
        blue: { DEFAULT: '#2563EB', light: '#EFF4FF' },
        purple: { DEFAULT: '#7C3AED', light: '#F3EFFF' },
      },
      fontFamily: {
        sans: ['Manrope', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '12px',
        sm: '8px',
        lg: '18px',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(0,0,0,0.04)',
        DEFAULT: '0 4px 16px rgba(0,0,0,0.06)',
        lg: '0 12px 36px rgba(0,0,0,0.10)',
        orange: '0 8px 24px rgba(255, 121, 0, 0.25)',
      },
    },
  },
  plugins: [],
};
