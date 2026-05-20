/** @type {import('tailwindcss').Config} */
export default {
    content: [
      "./index.html",
      "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
      extend: {
        fontFamily: {
          sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'system-ui', 'sans-serif'],
          display: ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
          mono: ['monospace'],
        },
        colors: {
          /**
           * Agenda redesign tokens (feat/agenda-redesign-foundation).
           * Fases 2-5: usar vivid-teal-*, ink-*, status-*, shadow-agenda-*.
           * Legado: não usar estes tokens fora da Agenda redesign; manter teal-*, brand-*, app-*.
           * Fonte: design_handoff_agenda/README.md (Claude Designer).
           */
          vivid: {
            teal: {
              50: 'oklch(0.975 0.025 172)',
              100: 'oklch(0.94 0.06 172)',
              200: 'oklch(0.88 0.10 172)',
              300: 'oklch(0.80 0.14 172)',
              400: 'oklch(0.72 0.16 172)',
              500: 'oklch(0.66 0.165 172)',
              600: 'oklch(0.58 0.155 172)',
              700: 'oklch(0.46 0.13 172)',
              800: 'oklch(0.30 0.09 176)',
              900: 'oklch(0.20 0.06 180)',
              950: 'oklch(0.14 0.04 185)',
            },
          },
          ink: {
            50: 'oklch(0.985 0.004 250)',
            100: 'oklch(0.965 0.006 250)',
            150: 'oklch(0.945 0.008 250)',
            200: 'oklch(0.92 0.010 250)',
            300: 'oklch(0.86 0.012 250)',
            400: 'oklch(0.70 0.018 250)',
            500: 'oklch(0.55 0.020 250)',
            600: 'oklch(0.42 0.022 250)',
            700: 'oklch(0.30 0.024 252)',
            800: 'oklch(0.20 0.024 254)',
            900: 'oklch(0.14 0.022 256)',
          },
          status: {
            ok: 'oklch(0.66 0.165 172)',
            'ok-bg': 'oklch(0.95 0.05 172)',
            warn: 'oklch(0.78 0.16 78)',
            'warn-bg': 'oklch(0.97 0.06 86)',
            'warn-ink': 'oklch(0.42 0.13 70)',
            danger: 'oklch(0.66 0.20 25)',
            'danger-bg': 'oklch(0.96 0.05 25)',
            'danger-ink': 'oklch(0.45 0.18 25)',
            noshow: 'oklch(0.70 0.17 38)',
            'noshow-bg': 'oklch(0.97 0.05 50)',
            'noshow-ink': 'oklch(0.46 0.15 38)',
            info: 'oklch(0.66 0.16 245)',
            'info-bg': 'oklch(0.96 0.04 245)',
          },
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
        boxShadow: {
          'app-card':
            '0 1px 2px 0 rgb(0 0 0 / 0.04), 0 1px 3px 0 rgb(0 0 0 / 0.08)',
          'app-sidebar': '4px 0 24px rgb(0 0 0 / 0.04)',
          'agenda-sm':
            '0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 1px rgba(15, 23, 42, 0.03)',
          'agenda-md':
            '0 8px 24px -12px rgba(15, 23, 42, 0.12), 0 2px 6px -2px rgba(15, 23, 42, 0.06)',
          'agenda-lg':
            '0 24px 60px -24px rgba(15, 23, 42, 0.18), 0 8px 20px -8px rgba(15, 23, 42, 0.08)',
          'agenda-glow':
            '0 0 0 1px oklch(0.66 0.165 172 / 0.25), 0 12px 40px -12px oklch(0.46 0.13 172 / 0.5)',
        },
      },
    },
    plugins: [],
  }