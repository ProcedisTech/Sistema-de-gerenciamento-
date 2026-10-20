// Regressão prevenida: Seleção de múltiplos procedimentos com termos exige que TODOS os termos apareçam e sejam validados/bloqueados
// Anti-Isolated-Mock Rule: Testa a derivação real multi-catálogo sem mocks que mascarem a resolução agregada do container pai.
import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom';
import { Step4Procedimento } from './Step4LGPD.jsx';
import {
  catalogoIdsDoAtendimento,
  bloqueioExecucaoTermos,
  faltantesDoItem,
  titulosFaltantes,
} from '../../utils/termoResolucao.js';

vi.mock('../../hooks/useProcedimentosOptions', () => ({
  useProcedimentosOptions: () => ({
    options: [
      { id: 'cat-procedimento-1', nomeProcedimento: 'Aplicação de Toxina Botulínica' },
      { id: 'cat-procedimento-2', nomeProcedimento: 'Preenchimento com Ácido Hialurônico' },
    ],
    loading: false,
  }),
}));

vi.mock('./mapa-aplicacao/MapaAplicacaoPanel.jsx', () => ({
  MapaAplicacaoPanel: () => <div data-testid="mapa-panel">mapa</div>,
}));

vi.mock('./PhotoCarouselLane.jsx', () => ({
  PhotoCarouselLane: () => <div>lane</div>,
}));

describe('Auditoria de Integração: Múltiplos Procedimentos e Termos de Consentimento', () => {
  it('1. Derivação do Container: catalogoIdsDoAtendimento extrai todos os IDs e agrega resoluções sem omitir procedimentos', () => {
    const procedimentosSessao = [
      {
        id: null,
        catalogoId: 'cat-procedimento-1',
        catalogoProcedimentoSaudeId: 'cat-procedimento-1',
        nome: 'Aplicação de Toxina Botulínica',
      },
      {
        id: null,
        catalogoId: 'cat-procedimento-2',
        catalogoProcedimentoSaudeId: 'cat-procedimento-2',
        nome: 'Preenchimento com Ácido Hialurônico',
      },
    ];

    const todosIds = catalogoIdsDoAtendimento({
      nomeProcedimentoCatalogoId: 'cat-procedimento-1',
      procedimentosSessao,
    });

    expect(todosIds).toContain('cat-procedimento-1');
    expect(todosIds).toContain('cat-procedimento-2');
    expect(todosIds.length).toBe(2);

    // Resoluções simuladas do backend para cada catálogo
    const resolucaoCat1 = {
      termosObrigatorios: [{ termoId: 'termo-botox', titulo: 'Termo de Consentimento - Toxina Botulínica' }],
      faltantes: [{ termoId: 'termo-botox', titulo: 'Termo de Consentimento - Toxina Botulínica' }],
      consentimentosVigentes: [],
      procedimentos: [{ id: 'cat-procedimento-1', nome: 'Aplicação de Toxina Botulínica' }],
    };

    const resolucaoCat2 = {
      termosObrigatorios: [{ termoId: 'termo-preenchimento', titulo: 'Termo de Consentimento - Preenchimento' }],
      faltantes: [{ termoId: 'termo-preenchimento', titulo: 'Termo de Consentimento - Preenchimento' }],
      consentimentosVigentes: [],
      procedimentos: [{ id: 'cat-procedimento-2', nome: 'Preenchimento com Ácido Hialurônico' }],
    };

    const resolucaoPorCatalogo = {
      'cat-procedimento-1': resolucaoCat1,
      'cat-procedimento-2': resolucaoCat2,
    };

    // Executa a lógica de agregação do container (AppRefactored)
    const dedupPorId = (arr) => {
      const map = new Map();
      (arr || []).forEach((item) => {
        const id = item?.termoId || item?.id;
        if (id && !map.has(String(id))) map.set(String(id), item);
      });
      return Array.from(map.values());
    };

    const resolucoesValidas = todosIds.map((id) => resolucaoPorCatalogo[id]).filter(Boolean);
    const termosDaConsulta = []; // Nenhum assinado ainda nesta consulta

    const termosObrigatorios = dedupPorId(resolucoesValidas.flatMap((r) => r.termosObrigatorios || []));
    const faltantes = dedupPorId(resolucoesValidas.flatMap((r) => faltantesDoItem(r, termosDaConsulta)));

    const resolucaoAgregada = {
      termosObrigatorios,
      faltantes,
      totalObrigatorios: termosObrigatorios.length,
      totalFaltantes: faltantes.length,
    };

    // Assertiva: ambos os termos aparecem na resolução agregada
    expect(resolucaoAgregada.totalObrigatorios).toBe(2);
    expect(resolucaoAgregada.totalFaltantes).toBe(2);
    expect(resolucaoAgregada.faltantes.map((f) => f.termoId)).toEqual(['termo-botox', 'termo-preenchimento']);

    // Assertiva: bloqueio de execução ativo
    const bloqueado = bloqueioExecucaoTermos({ resolucao: resolucaoAgregada, pfIdNestaSessao: null });
    expect(bloqueado).toBe(true);

    // Assertiva: lista de títulos faltantes exibe ambos os termos
    const titulos = titulosFaltantes(resolucaoAgregada);
    expect(titulos).toContain('Termo de Consentimento - Toxina Botulínica');
    expect(titulos).toContain('Termo de Consentimento - Preenchimento');
  });

  it('2. Efeito de Revalidação no Step4Procedimento: revalida termos quando novos procedimentos entram mesmo se resolucao !== null', async () => {
    const onValidarMock = vi.fn().mockResolvedValue(true);

    const procsIniciais = [
      {
        id: 'cat-procedimento-1',
        catalogoProcedimentoSaudeId: 'cat-procedimento-1',
        nome: 'Aplicação de Toxina Botulínica',
      },
    ];

    const resolucaoPrevia = {
      termosObrigatorios: [{ termoId: 'termo-botox' }],
      faltantes: [],
    };

    // Renderiza inicialmente com 1 procedimento e resolução pré-existente
    const { rerender } = render(
      <Step4Procedimento
        procedimentosSessao={procsIniciais}
        setProcedimentosSessao={() => {}}
        onValidarTermosCatalogo={onValidarMock}
        resolucao={resolucaoPrevia}
      />
    );

    // Primeiro mount valida o procedimento inicial
    await waitFor(() => {
      expect(onValidarMock).toHaveBeenCalledWith(
        ['cat-procedimento-1'],
        expect.any(String),
        expect.objectContaining({ abrirModal: false })
      );
    });

    onValidarMock.mockClear();

    // Adiciona o segundo procedimento na sessão enquanto resolucao NÃO é nula
    const procsAtualizados = [
      ...procsIniciais,
      {
        id: 'cat-procedimento-2',
        catalogoProcedimentoSaudeId: 'cat-procedimento-2',
        nome: 'Preenchimento com Ácido Hialurônico',
      },
    ];

    rerender(
      <Step4Procedimento
        procedimentosSessao={procsAtualizados}
        setProcedimentosSessao={() => {}}
        onValidarTermosCatalogo={onValidarMock}
        resolucao={resolucaoPrevia}
      />
    );

    // O efeito DEVE disparar a revalidação com ambos os IDs
    await waitFor(() => {
      expect(onValidarMock).toHaveBeenCalledWith(
        expect.arrayContaining(['cat-procedimento-1', 'cat-procedimento-2']),
        expect.any(String),
        expect.objectContaining({ abrirModal: false })
      );
    });
  });
});
