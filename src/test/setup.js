/**
 * src/test/setup.js
 *
 * Setup global para Vitest: importa os matchers do @testing-library/jest-dom
 * para que assertions como `toBeInTheDocument()`, `toBeDisabled()`, etc.
 * estejam disponíveis em todos os testes.
 */
import '@testing-library/jest-dom';
