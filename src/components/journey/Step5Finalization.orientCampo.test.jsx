// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
  toast: vi.fn(),
  dismiss: vi.fn(),
}));
vi.mock('../../contexts/useToast.js', () => ({ useToast: () => toastMock }));
vi.mock('../../services/api.js', () => ({ perfilApi: { getOrientacoesTemplate: vi.fn(async () => []) } }));
vi.mock('../hooks/useAgoraDaClinica.js', () => ({
  useAgoraDaClinica: () => ({ pronto: true, fuso: 'America/Sao_Paulo', hojeIso: '2026-10-06' }),
}));

import { Step5Finalization } from './Step5Finalization.jsx';

const base = {
  procedureDateIso: '2026-10-06',
  pacienteNome: 'Ana',
  telefonePaciente: '11999990000',
  nomeProcedimento: 'Toxina',
  step5Errors: {},
  setStep5Errors: () => {},
  setOrientacoesDoItem: () => {},
  itensSemOrientacaoMarcada: [],
};
const lista = (t) => [{ id: `o-${t}`, descricao: `Texto ${t}`, ordem: 0, checado: false }];
const attr = (el) => el.getAttribute('data-campo-consulta');
const doisItens = [
  { itemId: 'A', nome: 'Toxina', orient: lista('a'), legado: false },
  { itemId: 'B', nome: 'Fio', orient: lista('b'), legado: false },
];

describe('Step5Finalization — data-campo-consulta das orientações', () => {
  it('(a) checkbox e texto de cada orientação levam o id do item correto', () => {
    const { container } = render(<Step5Finalization {...base} itensOrientacoes={doisItens} />);
    expect(screen.getAllByRole('checkbox').map(attr)).toEqual(['item:A:orient', 'item:B:orient']);
    fireEvent.click(screen.getByText('Texto b'));
    const tb = container.querySelectorAll('textarea');
    expect(tb.length).toBe(1);
    expect(attr(tb[0])).toBe('item:B:orient');
    fireEvent.blur(tb[0]);
    fireEvent.click(screen.getByText('Texto a'));
    expect(attr(container.querySelector('textarea'))).toBe('item:A:orient');
  });

  it('(b) sem itemId nenhum atributo', () => {
    const { container } = render(
      <Step5Finalization {...base} itensOrientacoes={[{ nome: 'X', orient: lista('x'), legado: false }]} />,
    );
    expect(container.querySelectorAll('[data-campo-consulta]').length).toBe(0);
  });

  it('(c) item legado sem atributo', () => {
    const { container } = render(
      <Step5Finalization
        {...base}
        itensOrientacoes={[{ itemId: 'L', nome: 'Leg', orient: lista('l'), legado: true }]}
      />,
    );
    expect(container.querySelectorAll('[data-campo-consulta]').length).toBe(0);
  });

  it('(d) botão Adicionar do item tem o atributo', () => {
    render(<Step5Finalization {...base} itensOrientacoes={doisItens} />);
    const btns = screen.getAllByRole('button', { name: /Adicionar orientação/ });
    expect(btns.map(attr)).toEqual(['item:A:orient', 'item:B:orient']);
  });
});
