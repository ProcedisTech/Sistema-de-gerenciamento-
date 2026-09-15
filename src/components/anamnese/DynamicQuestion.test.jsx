import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { describe, expect, it, vi } from 'vitest';
import { DynamicQuestion } from './DynamicQuestion.jsx';
import { toVinculosReacaoPayload } from './anamneseFichaUtils.js';

const perguntaReacao = {
  id: 'p-reacao',
  descricao: 'Qual foi a reação?',
  tipoResposta: 'catalogo_reacao',
};

const opcoesComNaoLembra = [
  { id: 'r1', nome: 'Coceira', codigo: 'COCEIRA' },
  { id: 'r2', nome: 'Inchaço', codigo: 'INCHACO' },
  { id: 'r-nl', nome: 'Não lembra', codigo: 'NAO_LEMBRA' },
];

describe('DynamicQuestion catalogo_reacao', () => {
  it('mostra carregando enquanto searchFn não resolve', () => {
    const searchFn = vi.fn(() => new Promise(() => {}));
    render(
      <DynamicQuestion
        pergunta={perguntaReacao}
        searchFn={searchFn}
      />,
    );
    expect(screen.getByText('Carregando opções…')).toBeInTheDocument();
  });

  it('renderiza botões quando searchFn retorna itens', async () => {
    const searchFn = vi.fn().mockResolvedValue([
      { id: 'r1', nome: 'Coceira' },
      { id: 'r2', nome: 'Inchaço' },
    ]);
    render(
      <DynamicQuestion
        pergunta={perguntaReacao}
        searchFn={searchFn}
      />,
    );
    expect(await screen.findByRole('button', { name: 'Coceira' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Inchaço' })).toBeInTheDocument();
    expect(screen.getByText('Quais foram as reações?')).toBeInTheDocument();
  });

  it('mostra empty state quando searchFn retorna lista vazia', async () => {
    const searchFn = vi.fn().mockResolvedValue([]);
    render(
      <DynamicQuestion
        pergunta={perguntaReacao}
        searchFn={searchFn}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('Nenhuma opção disponível.')).toBeInTheDocument();
    });
  });

  it('mostra erro quando searchFn rejeita', async () => {
    const searchFn = vi.fn().mockRejectedValue(new Error('fail'));
    render(
      <DynamicQuestion
        pergunta={perguntaReacao}
        searchFn={searchFn}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('Não foi possível carregar as opções.')).toBeInTheDocument();
    });
  });

  it('acumula duas reações no mesmo grupo e serializa dois DTOs', async () => {
    const user = userEvent.setup();
    const searchFn = vi.fn().mockResolvedValue(opcoesComNaoLembra);
    const onChange = vi.fn();
    const onVinculosChange = vi.fn();
    const grupos = [{
      key: 'SUBSTANCIA:pa1',
      escopo: 'SUBSTANCIA',
      label: 'Dipirona',
      principioAtivoIds: ['pa1'],
      medicamentoCatalogoId: null,
    }];
    const vinculos = [{
      key: 'SUBSTANCIA:pa1',
      declaracaoClientId: 'c1',
      escopo: 'SUBSTANCIA',
      medicamentoCatalogoId: null,
      principioAtivoIds: ['pa1'],
      label: 'Dipirona',
      reacoes: [],
    }];

    const { rerender } = render(
      <DynamicQuestion
        pergunta={perguntaReacao}
        searchFn={searchFn}
        gruposReacao={grupos}
        vinculosReacao={vinculos}
        onVinculosChange={onVinculosChange}
        onChange={onChange}
      />,
    );

    await screen.findByRole('button', { name: 'Coceira' });
    await user.click(screen.getByRole('button', { name: 'Coceira' }));
    const afterFirst = onVinculosChange.mock.calls.at(-1)[0];
    rerender(
      <DynamicQuestion
        pergunta={perguntaReacao}
        searchFn={searchFn}
        gruposReacao={grupos}
        vinculosReacao={afterFirst}
        onVinculosChange={onVinculosChange}
        onChange={onChange}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Inchaço' }));
    const afterSecond = onVinculosChange.mock.calls.at(-1)[0];
    expect(afterSecond[0].reacoes).toHaveLength(2);
    const payload = toVinculosReacaoPayload(afterSecond);
    expect(payload).toHaveLength(2);
    expect(payload.every((p) => p.declaracaoClientId === 'c1')).toBe(true);
  });

  it('NAO_LEMBRA limpa as outras no mesmo grupo e vice-versa', async () => {
    const user = userEvent.setup();
    const searchFn = vi.fn().mockResolvedValue(opcoesComNaoLembra);
    const onVinculosChange = vi.fn();
    const grupos = [{
      key: 'SUBSTANCIA:pa1',
      escopo: 'SUBSTANCIA',
      label: 'Dipirona',
      principioAtivoIds: ['pa1'],
      medicamentoCatalogoId: null,
    }];
    let vinculos = [{
      key: 'SUBSTANCIA:pa1',
      declaracaoClientId: 'c1',
      escopo: 'SUBSTANCIA',
      principioAtivoIds: ['pa1'],
      label: 'Dipirona',
      reacoes: [],
    }];

    const { rerender } = render(
      <DynamicQuestion
        pergunta={perguntaReacao}
        searchFn={searchFn}
        gruposReacao={grupos}
        vinculosReacao={vinculos}
        onVinculosChange={(next) => {
          vinculos = next;
          onVinculosChange(next);
        }}
        onChange={() => {}}
      />,
    );

    await screen.findByRole('button', { name: 'Coceira' });
    await user.click(screen.getByRole('button', { name: 'Coceira' }));
    rerender(
      <DynamicQuestion
        pergunta={perguntaReacao}
        searchFn={searchFn}
        gruposReacao={grupos}
        vinculosReacao={vinculos}
        onVinculosChange={(next) => {
          vinculos = next;
          onVinculosChange(next);
        }}
        onChange={() => {}}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Não lembra' }));
    expect(vinculos[0].reacoes).toHaveLength(1);
    expect(vinculos[0].reacoes[0].codigo).toBe('NAO_LEMBRA');

    rerender(
      <DynamicQuestion
        pergunta={perguntaReacao}
        searchFn={searchFn}
        gruposReacao={grupos}
        vinculosReacao={vinculos}
        onVinculosChange={(next) => {
          vinculos = next;
          onVinculosChange(next);
        }}
        onChange={() => {}}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Inchaço' }));
    expect(vinculos[0].reacoes).toHaveLength(1);
    expect(vinculos[0].reacoes[0].codigo).toBe('INCHACO');
  });

  it('NAO_LEMBRA num grupo não afeta o outro', async () => {
    const user = userEvent.setup();
    const searchFn = vi.fn().mockResolvedValue(opcoesComNaoLembra);
    let vinculos = [
      {
        key: 'PRODUTO:dorflex',
        declaracaoClientId: 'c-dorflex',
        escopo: 'PRODUTO',
        principioAtivoIds: ['pa1'],
        label: 'Dorflex',
        reacoes: [],
      },
      {
        key: 'SUBSTANCIA:latex',
        declaracaoClientId: 'c-latex',
        escopo: 'SUBSTANCIA',
        principioAtivoIds: ['pa2'],
        label: 'Látex',
        reacoes: [{ reacaoAdversaId: 'r2', reacaoNome: 'Inchaço', codigo: 'INCHACO' }],
      },
    ];
    const grupos = [
      { key: 'PRODUTO:dorflex', escopo: 'PRODUTO', label: 'Dorflex', principioAtivoIds: ['pa1'] },
      { key: 'SUBSTANCIA:latex', escopo: 'SUBSTANCIA', label: 'Látex', principioAtivoIds: ['pa2'] },
    ];

    render(
      <DynamicQuestion
        pergunta={perguntaReacao}
        searchFn={searchFn}
        gruposReacao={grupos}
        vinculosReacao={vinculos}
        onVinculosChange={(next) => { vinculos = next; }}
        onChange={() => {}}
      />,
    );

    await screen.findAllByRole('button', { name: 'Não lembra' });
    const naoLembraButtons = screen.getAllByRole('button', { name: 'Não lembra' });
    await user.click(naoLembraButtons[0]);

    expect(vinculos.find((v) => v.key === 'PRODUTO:dorflex').reacoes[0].codigo).toBe('NAO_LEMBRA');
    expect(vinculos.find((v) => v.key === 'SUBSTANCIA:latex').reacoes).toEqual([
      { reacaoAdversaId: 'r2', reacaoNome: 'Inchaço', codigo: 'INCHACO' },
    ]);
  });

  it('reabre com duas reações marcadas', async () => {
    const searchFn = vi.fn().mockResolvedValue(opcoesComNaoLembra);
    render(
      <DynamicQuestion
        pergunta={perguntaReacao}
        searchFn={searchFn}
        resposta={{
          perguntaId: 'p-reacao',
          catalogoItens: [
            { id: 'r1', nome: 'Coceira', fonte: 'catalogo' },
            { id: 'r2', nome: 'Inchaço', fonte: 'catalogo' },
          ],
        }}
      />,
    );
    const coceira = await screen.findByRole('button', { name: 'Coceira' });
    const inchaco = screen.getByRole('button', { name: 'Inchaço' });
    expect(coceira).toHaveAttribute('aria-pressed', 'true');
    expect(inchaco).toHaveAttribute('aria-pressed', 'true');
  });

  it('grupo produto mostra nome sem prefixo Produto e sem UUID; substância só o nome', async () => {
    const searchFn = vi.fn().mockResolvedValue(opcoesComNaoLembra);
    const medId = '11111111-2222-3333-4444-555555555555';
    render(
      <DynamicQuestion
        pergunta={perguntaReacao}
        searchFn={searchFn}
        gruposReacao={[
          {
            key: `PRODUTO:${medId}`,
            escopo: 'PRODUTO',
            label: 'Dorflex (3 substâncias marcadas)',
            principioAtivoIds: ['pa1', 'pa2', 'pa3'],
            medicamentoCatalogoId: medId,
          },
          {
            key: 'SUBSTANCIA:latex',
            escopo: 'SUBSTANCIA',
            label: 'Látex',
            principioAtivoIds: ['latex'],
          },
        ]}
        vinculosReacao={[
          {
            key: `PRODUTO:${medId}`,
            declaracaoClientId: 'c1',
            escopo: 'PRODUTO',
            principioAtivoIds: ['pa1', 'pa2', 'pa3'],
            medicamentoCatalogoId: medId,
            reacoes: [],
          },
          {
            key: 'SUBSTANCIA:latex',
            declaracaoClientId: 'c2',
            escopo: 'SUBSTANCIA',
            principioAtivoIds: ['latex'],
            reacoes: [],
          },
        ]}
        onVinculosChange={() => {}}
        onChange={() => {}}
      />,
    );

    expect(await screen.findByText('Dorflex (3 substâncias marcadas)')).toBeInTheDocument();
    expect(screen.getByText('Látex')).toBeInTheDocument();
    expect(screen.queryByText(/Produto:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Substância:/)).not.toBeInTheDocument();
    expect(screen.queryByText(medId)).not.toBeInTheDocument();
    expect(screen.queryByText(/11111111/)).not.toBeInTheDocument();
  });
});
