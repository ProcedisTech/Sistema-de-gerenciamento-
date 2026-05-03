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
            /** Fundo principal do app (shell / telas logadas) */
            canvas: '#F8FBFB',
            /** Texto principal sobre fundos claros */
            ink: '#0F172A',
            'nav-hover': '#F0FDFA',
            'nav-active': '#E6F7F5',
            accent: '#00A88E',
            'accent-deep': '#0F766E',
          },
          /**
           * Procedi brand + agenda dashboard tokens (Sprint visual 1).
           * TODO: alinhar app.accent, agendaStatusColors.js e demais telas numa sprint futura.
           */
          brand: {
            primary: '#14B8A6',
            primaryDark: '#0D9488',
            primaryLight: '#5EEAD4',
            primarySubtle: '#CCFBF1',
            primaryGhost: '#F0FDFA',
          },
          stats: {
            totalBg: '#F3E8FF',
            totalIcon: '#A855F7',
            confirmedBg: '#D1FAE5',
            confirmedIcon: '#10B981',
            pendingBg: '#FEF3C7',
            pendingIcon: '#F59E0B',
            /** Ícone no card “Hoje” (fundo = brand.primary) */
            todayIcon: '#FFFFFF',
          },
          calendar: {
            cellEmpty: '#FFFFFF',
            cellWithEvents: '#F9FAFB',
            cellHover: '#F3F4F6',
            cellSelected: '#14B8A6',
            border: '#E5E7EB',
          },
        },
        fontFamily: {
          sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
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