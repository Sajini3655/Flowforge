/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#070C1A',
          900: '#0B132B',
          800: '#1C2541',
          700: '#2E3D5E',
          600: '#3A506B',
        },
        forge: {
          teal: '#00A896',
          cyan: '#0284C7',
          blue: '#2563EB',
          amber: '#F59E0B',
          red: '#EF4444',
          emerald: '#10B981',
          purple: '#6366F1',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'Courier New', 'monospace'],
      }
    },
  },
  plugins: [],
}
