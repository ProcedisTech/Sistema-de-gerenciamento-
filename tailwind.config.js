/** @type {import('tailwindcss').Config} */
export default {
    content: [
      "./index.html",
      "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
      extend: {
        colors: {
          app: {
            border: '#E5E7EB',
            surface: '#F9FAFB',
            'nav-hover': '#F0FDFA',
            'nav-active': '#E6F7F5',
            accent: '#00A88E',
            'accent-deep': '#0F766E',
          },
        },
        boxShadow: {
          'app-card':
            '0 1px 2px 0 rgb(0 0 0 / 0.04), 0 1px 3px 0 rgb(0 0 0 / 0.08)',
          'app-sidebar': '4px 0 24px rgb(0 0 0 / 0.04)',
        },
      },
    },
    plugins: [],
  }