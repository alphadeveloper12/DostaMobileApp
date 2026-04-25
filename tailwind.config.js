/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        'brand-blue':    '#054A86',
        'brand-blue-mid':'#056AC1',
        'brand-blue-lt': '#0768B8',
        'brand-dark':    '#2B2B43',
        'brand-muted':   '#545563',
        'brand-light':   '#83859C',
        'brand-border':  '#EDEEF2',
        'brand-bg':      '#F7F7F9',
        'brand-card':    '#EAF5FF',
      },
      fontFamily: {
        sans: ['System'],
      },
    },
  },
  plugins: [],
};
