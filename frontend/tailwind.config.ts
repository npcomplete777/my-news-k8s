import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        hn: '#ff6600',
        reddit: '#ff4500',
        github: '#6e7681',
        devto: '#0a0a0a',
        lobsters: '#ac130d',
        youtube: '#ff0000',
        k8s: '#326ce5',
        cncf: '#446ca9',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Oxygen',
          'Ubuntu',
          'Cantarell',
          'Fira Sans',
          'Droid Sans',
          'Helvetica Neue',
          'sans-serif',
        ],
        mono: [
          'SF Mono',
          'Fira Code',
          'Fira Mono',
          'Roboto Mono',
          'monospace',
        ],
      },
    },
  },
  plugins: [],
}

export default config
