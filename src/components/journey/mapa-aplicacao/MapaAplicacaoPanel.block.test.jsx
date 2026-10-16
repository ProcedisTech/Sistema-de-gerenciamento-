import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import '@testing-library/jest-dom';
import { MapaAplicacaoPanel } from './MapaAplicacaoPanel.jsx';

vi.mock('../../../contexts/useToast.js', () => ({
  useToast: () => ({
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  }),
}));

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

describe('MapaAplicacaoPanel — Bloqueio de upload e painel sem procedimento', () => {
  const mockMapaState = {
    getVistasPreenchidas: () => ['frontal_rosto'],
    vistaAtual: 'frontal_rosto',
    getFotoVista: () => null,
    getPontosVista: () => [],
    setFotoVista: vi.fn(),
    setVistaAtual: vi.fn(),
    countPontosVista: () => 0,
    pontosPorVista: {},
  };

  it('exibe estado bloqueado e mensagem explicativa quando listaProcedimentosSessao está vazia', () => {
    render(
      <MapaAplicacaoPanel
        mapaState={mockMapaState}
        pacienteId="paciente-123"
        procedimentosSessao={[]}
        disabled={false}
      />
    );

    // Deve renderizar o card pontilhado com a mensagem de bloqueio e o botão de atalho
    expect(screen.getByText(/para habilitar o mapa/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Selecionar Procedimento/i })).toBeInTheDocument();
  });

  it('exibe o painel ativo com a vista quando há procedimentos válidos', () => {
    render(
      <MapaAplicacaoPanel
        mapaState={mockMapaState}
        pacienteId="paciente-123"
        procedimentosSessao={[
          {
            catalogoProcedimentoSaudeId: 'cat-1',
            nomeProcedimento: 'Toxina Botulínica',
          },
        ]}
        disabled={false}
      />
    );

    // No modo ativo, o card pontilhado de bloqueio NÃO deve estar presente
    expect(screen.queryByText(/Selecione um procedimento do catálogo para habilitar o mapa de aplicação/i)).toBeNull();
    // A barra de unidade e vista deve estar presente
    expect(screen.getByText(/Unidade:/i)).toBeInTheDocument();
  });
});
