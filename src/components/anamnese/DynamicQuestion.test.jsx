import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, expect, it, vi } from 'vitest';
import { DynamicQuestion } from './DynamicQuestion.jsx';

const perguntaReacao = {
  id: 'p-reacao',
  descricao: 'Qual foi a reação?',
  tipoResposta: 'catalogo_reacao',
};

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
});
