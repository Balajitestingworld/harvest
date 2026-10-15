/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Indigo ink: text, primary actions, brand.
        ink: { DEFAULT: '#1F2559', soft: '#3A4180' },
        // Turmeric: reserved for money found. Never decorative.
        turmeric: { DEFAULT: '#F2B21B', pale: '#FDF1CF', deep: '#8A5F00' },
        paper: '#F5F6FA',
        surface: '#FFFFFF',
        slate: '#5B6177',
        line: '#DADDEA',
        danger: '#B42318',
      },
      fontFamily: {
        // One family; weights are separate font files on native.
        body: ['BricolageGrotesque_400Regular'],
        medium: ['BricolageGrotesque_500Medium'],
        semibold: ['BricolageGrotesque_600SemiBold'],
        display: ['BricolageGrotesque_800ExtraBold'],
      },
    },
  },
  plugins: [],
};
