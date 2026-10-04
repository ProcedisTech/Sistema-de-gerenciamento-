import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
      'no-alert': 'warn',
    },
  },
  {
    files: [
      '**/PatientProfileView.jsx',
      '**/components/patients/galeria/**/*.jsx',
      '**/Step5Finalization.jsx',
      '**/components/agenda/MarcarCompromissoModal.jsx',
      '**/components/agenda/PacienteSearchInput.jsx',
      '**/components/agenda/useAgendaPage.js',
      '**/components/agenda/CancelarAgendaModal.jsx',
      '**/components/anamnese/AnamneseAdminView.jsx',
      '**/components/journey/Step1CheckIn.jsx',
      '**/components/journey/Step3Evaluation.jsx',
    ],
    rules: {
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  {
    files: ['**/components/journey/Step4LGPD.jsx', '**/components/shared/ProcedimentoAutocomplete.jsx'],
    rules: {
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  {
    files: [
      '**/components/estoque/ItemFormModal.jsx',
      '**/components/estoque/LoteFormModal.jsx',
      '**/components/estoque/MovimentacaoFormModal.jsx',
      '**/components/hooks/usePatientState.js',
      '**/hooks/usePacienteGaleriaArquivoBlobUrl.js',
      '**/hooks/usePatientProfilePhotoSrc.js',
      '**/hooks/useProcedimentosOptions.js',
      '**/hooks/useAnamneseStatusPaciente.js',
      '**/hooks/agenda/useDisponibilidadeDoDia.js',
      '**/hooks/agenda/useDiasComDisponibilidade.js',
      '**/components/agenda/AgendaDashboard.jsx',
      '**/components/agenda/AgendaFormModal.jsx',
    ],
    rules: {
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/refs': 'off',
    },
  },
  {
    files: ['**/components/system/BackendGate.jsx'],
    rules: {
      'react-hooks/immutability': 'off',
    },
  },
  {
    files: ['**/OrgContext.jsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    files: ['vite.config.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ['**/*.{test,spec}.{js,jsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        vi: 'readonly',
      },
    },
  },
  {
    files: ['**/usePatientsKpi.js'],
    rules: {
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  {
    files: ['**/PatientListPagination.jsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    files: ['src/**/*.{js,jsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "Literal[value='America/Sao_Paulo']",
          message: "Use o fuso da clínica (useFusoClinica / payload.fusoHorario) ou FUSO_PADRAO de utils/datasClinica.",
        },
        {
          selector:
            "CallExpression[callee.type='MemberExpression'][callee.property.name=/^(slice|split)$/][callee.object.type='CallExpression'][callee.object.callee.property.name='toISOString']",
          message: 'toISOString() é UTC: use hojeDaClinica(fuso) ou diaDoInstante(valor, fuso).',
        },
        {
          selector: "NewExpression[callee.name='Date'] > Literal.arguments[value=/^\\d{4}-\\d{2}-\\d{2}/]",
          message: "new Date('AAAA-MM-DD') desloca o dia: use as funções de calendário de utils/datasClinica.",
        },
        {
          selector: "NewExpression[callee.name='Date'][arguments.length>=4]",
          message: 'new Date(a, m, d, h, …) usa o fuso do navegador: use instanteDoHorarioDaClinica(dataIso, hhmm, fuso).',
        },
        {
          selector: "CallExpression[callee.property.name=/^(getHours|getMinutes)$/]",
          message: 'getHours()/getMinutes() usam o fuso do navegador: use agoraDaClinica(fuso, ms) ou formatarInstante(valor, fuso, "hora").',
        },
      ],
    },
  },
  {
    files: ['src/utils/datasClinica.js', '**/*.test.{js,jsx}', 'src/test/**'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
])
