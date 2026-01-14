/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Digital Concrete / Brutalist Neumorphism palette
        'bg-primary': '#1a1a1a',
        'bg-secondary': '#242424',
        'bg-tertiary': '#2d2d2d',
        'accent-primary': '#f59e0b',
        'accent-secondary': '#3b82f6',
        'accent-success': '#22c55e',
        'accent-warning': '#ef4444',
        'text-primary': '#f5f5f5',
        'text-secondary': '#a3a3a3',
        'text-muted': '#737373',
        'border-color': '#404040',
        'border-accent': '#525252',
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
        sans: ['Inter', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'neuro-up': '-4px -4px 8px rgba(45, 45, 45, 0.5), 4px 4px 8px rgba(0, 0, 0, 0.5)',
        'neuro-down': 'inset -2px -2px 4px rgba(45, 45, 45, 0.5), inset 2px 2px 4px rgba(0, 0, 0, 0.5)',
      },
    },
  },
  plugins: [],
}
