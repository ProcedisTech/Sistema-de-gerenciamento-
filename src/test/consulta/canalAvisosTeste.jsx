/**
 * Canal de avisos dos testes de tela da consulta. Use no arquivo de teste:
 *   vi.mock('../../contexts/AvisosProvider.jsx', async () => (await import('./canalAvisosTeste.jsx')).avisosProviderFalso());
 */
import React from 'react';
import { criarAvisosFalsos } from '../avisosFalsos.jsx';

export const avisos = criarAvisosFalsos();

export function avisosProviderFalso() {
  function AvisosProvider({ children }) {
    return <avisos.Wrapper>{children}</avisos.Wrapper>;
  }
  return { AvisosProvider };
}
