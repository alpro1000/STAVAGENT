/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Fonts reference CSS custom properties from tokens.css
      fontFamily: {
        mono: ['var(--font-mono)'],
        sans: ['var(--font-body)'],
      },
      // All colors, shadows, and spacing come from tokens.css
      // Use arbitrary values like bg-[var(--panel-clean)] or @apply in components
    },
  },
  plugins: [],
}
