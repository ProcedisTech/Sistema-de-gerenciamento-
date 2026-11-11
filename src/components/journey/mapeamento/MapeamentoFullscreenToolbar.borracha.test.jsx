import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';

vi.mock('../../../hooks/useMediaQuery.js', () => ({ useMediaQuery: () => true }));
vi.mock('../../../hooks/useCatalogoMapeamentoOptions.js', () => ({
  useCatalogoMapeamentoOptions: () => ({ options: [], loading: false }),
}));

import { MapeamentoFullscreenToolbar } from './MapeamentoFullscreenToolbar.jsx';

describe('Barra Ponto · Traço · Borracha do mapeamento em tela cheia', () => {
  it('divide a barra em três colunas iguais e põe o nome embaixo do ícone, para "Borracha" caber em 240 px', () => {
    render(<MapeamentoFullscreenToolbar setModo={() => {}} hideProcedimentoPicker />);

    const barra = screen.getByTestId('mapa-ferramentas-barra');
    expect(barra.className).toMatch(/\bgrid\b/);
    expect(barra.className).toMatch(/\bgrid-cols-3\b/);

    const botoes = within(barra).getAllByRole('button');
    expect(botoes.map((b) => b.textContent)).toEqual(['Ponto', 'Traço', 'Borracha']);
    for (const botao of botoes) {
      expect(botao.className).toMatch(/\bmin-w-0\b/);
      expect(botao.className).toMatch(/\bflex-col\b/);
      expect(botao.className).not.toMatch(/\bflex-1\b/);
    }
  });
});
