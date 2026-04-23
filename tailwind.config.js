/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './context/**/*.{ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        background: '#09090b',
        foreground: '#fafafa',
        card: '#09090b',
        'card-foreground': '#fafafa',
        border: '#27272a',
        input: '#27272a',
        muted: '#18181b',
        'muted-foreground': '#71717a',
        accent: '#18181b',
        'accent-foreground': '#fafafa',
        primary: '#fafafa',
        'primary-foreground': '#18181b',
        secondary: '#18181b',
        'secondary-foreground': '#fafafa',
        destructive: '#ef4444',
      },
    },
  },
}
