/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          lime: '#C8FF00',
          'lime-dim': '#A8D900',
          black: '#0A0A0A',
          charcoal: '#161616',
          ink: '#1C1C1C',
          mute: '#8A8A8A',
          snow: '#F5F5F5',
        },
      },
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
        display: ['"Barlow Condensed"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        lime: '0 0 0 1px rgba(200,255,0,0.25), 0 8px 24px rgba(0,0,0,0.35)',
      },
    },
  },
  plugins: [],
}
