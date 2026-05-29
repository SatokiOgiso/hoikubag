/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        accent: '#D86B4A',
        cream: '#FAF5EA',
      },
      fontFamily: {
        sans: ['"Zen Maru Gothic"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
