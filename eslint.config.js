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
      '**/Step5Finalization.jsx',
      '**/components/agenda/MarcarCompromissoModal.jsx',
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
    ],
    rules: {
      'react-hooks/set-state-in-effect': 'off',
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
])
