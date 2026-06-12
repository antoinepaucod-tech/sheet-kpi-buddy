/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#09090B',
        card: '#131316',
        card2: '#1A1A1F',
        line: '#26262C',
        accent: '#F97316',
        pos: '#22C55E',
        neg: '#EF4444',
        muted: '#8E8E96',
      },
      fontFamily: {
        display: ['"Bebas Neue"', 'sans-serif'],
        body: ['"DM Sans"', 'sans-serif'],
        num: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
