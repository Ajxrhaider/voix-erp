// The Vercel build runs from the repository root; scan the actual client app.
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./client/index.html",
    "./client/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      colors: {
        voix: {
          50: '#fdf8f6',
          100: '#f2e8e5',
          200: '#eaddd7',
          300: '#e0cec7',
          400: '#d2bab0',
          500: '#D95C27',
          600: '#C24B1B',
          700: '#9E3911',
          800: '#7B2A0A',
          900: '#5A1D05',
        },
      },
    },
  },
  plugins: [],
}