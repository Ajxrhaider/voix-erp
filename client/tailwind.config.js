/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Replace these hex codes with your exact Voix logo colors
        voix: {
          50: '#fdf8f6',
          100: '#f2e8e5',
          200: '#eaddd7',
          300: '#e0cec7',
          400: '#d2bab0',
          500: '#D95C27', // Primary Logo Color (Example: Orange)
          600: '#C24B1B', // Darker shade for hovers (used in Login.jsx)
          700: '#9E3911',
          800: '#7B2A0A',
          900: '#5A1D05',
        }
      }
    },
  },
  plugins: [],
}