import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        dark: '#0F172A',
        card: '#1E293B',
        accent: '#10B981',
      },
    },
  },
  plugins: [],
}

export default config
