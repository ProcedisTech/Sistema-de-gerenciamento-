// Regressão prevenida: Em atendimentos com múltiplos procedimentos simultâneos (lote),
// a execução não deve ser fragmentada em abas sequenciais obrigatórias nem exigir múltiplos
// cliques de "Continuar" para cada procedimento individual. O profissional executa todos juntos
// no mesmo painel/mapa e o botão "Ir para Finalização e Orientações" avança diretamente para
// a fase de orientações (phase === 'orientacoes').

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConsultaProcedimentoFlow } from './ConsultaProcedimentoFlow.jsx';
import {
  prepararAmbienteSnapshot,
  limparAmbienteSnapshot,
  assentar,
} from '../../test/snapshotConsulta.jsx';

vi.mock('../../services/api.js', async (importOriginal) => {
  const { apiVazia } = await import('../../test/snapshotConsulta.jsx');
  return apiVazia(await importOriginal());
});

vi.mock('../../contexts/OrgContext', async (importOriginal) => {
  const { orgComTodasPermissoes } = await import('../../test/snapshotConsulta.jsx');
  const { PERMISSOES } = await import('../../constants/permissoes.js');
  return orgComTodasPermissoes(await importOriginal(), Object.values(PERMISSOES));
});

const noop = () => {};
const toastFalso = { error: noop, success: noop, info: noop, warning: noop };

describe('Regressão Zero — Fluxo unificado de Múltiplos Procedimentos (sem abas sequenciais)', () => {
  beforeEach(() => {
    prepararAmbienteSnapshot();
  });

  afterEach(() => {
    limparAmbienteSnapshot();
  });

  it('não deve exibir barra de abas numeradas por procedimento e deve avançar direto para orientações ao clicar em continuar', async () => {
    const loteMock = [
      {
        id: 'proc-1',
        catalogoProcedimentoSaudeId: 'cat-1',
        nomeProcedimento: 'Toxina Botulínica Facial',
        procedimentoNome: 'Toxina Botulínica Facial',
        corHex: '#3b82f6',
      },
      {
        id: 'proc-2',
        catalogoProcedimentoSaudeId: 'cat-2',
        nomeProcedimento: 'Preenchimento Labial',
        procedimentoNome: 'Preenchimento Labial',
        corHex: '#ec4899',
      },
    ];

    render(
      <ConsultaProcedimentoFlow
        pacienteIdForProcedures="paciente-123"
        nomeProcedimento="Toxina Botulínica Facial"
        procedimentosLote={loteMock}
        setProcedimentosLote={noop}
        onValidarTermosCatalogo={async () => true}
        execucaoBloqueadaPorTermos={false}
        toast={toastFalso}
        procedureCapturedPhotos={[]}
        fotosAvaliacao={[]}
        itensOrientacoes={[
          { itemId: 'proc-1', nome: 'Toxina Botulínica Facial', orient: ['Gelo'] },
          { itemId: 'proc-2', nome: 'Preenchimento Labial', orient: ['Massagem'] },
        ]}
        itensSemOrientacaoMarcada={[]}
      />
    );

    await assentar();

    // 1. Não deve haver botões de aba com prefixos "1. Toxina" ou "2. Preenchimento"
    expect(screen.queryByText('1. Toxina Botulínica Facial')).toBeNull();
    expect(screen.queryByText('2. Preenchimento Labial')).toBeNull();

    // 2. O botão de avançar deve estar presente
    const btnAvancar = screen.getByText('Ir para Finalização e Orientações');
    expect(btnAvancar).toBeTruthy();

    // 3. Ao clicar, deve ir direto para a fase de orientações sem passar por passo intermediário de abas
    fireEvent.click(btnAvancar);
    await assentar();

    // Na fase de orientações, o botão de finalização aparece
    expect(screen.getByText('Finalizar Atendimento ✓')).toBeTruthy();
  });
});
