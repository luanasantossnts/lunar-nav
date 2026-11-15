// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        bg2: 'var(--bg2)',
        panel: 'var(--panel)',
        raise: 'var(--raise)',
        hair: 'var(--hair)',
        active: 'var(--active)',
        line: 'var(--line)',
        line2: 'var(--line2)',
        dim: 'var(--dim)',
        muted: 'var(--muted)',
        text2: 'var(--text2)',
        ink: 'var(--ink)',
        sun: 'var(--sun)',
        earth: 'var(--earth)',
        alert: 'var(--alert)',
        warnbg: 'var(--warnbg)',
        warnline: 'var(--warnline)',
        warntext: 'var(--warntext)',
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: { DEFAULT: '4px' },
    },
  },
  plugins: [],
};
