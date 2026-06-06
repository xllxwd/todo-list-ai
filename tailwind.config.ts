import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./pages/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      boxShadow: {
        paper: '0 24px 80px rgba(70, 55, 34, 0.18)',
        note: '0 8px 18px rgba(77, 60, 38, 0.12)',
      },
      fontFamily: {
        journal: [
          'Bradley Hand',
          'Segoe Print',
          'Comic Sans MS',
          'Kaiti SC',
          'STKaiti',
          'cursive',
        ],
        serifcn: ['Songti SC', 'Noto Serif SC', 'STSong', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}

export default config
