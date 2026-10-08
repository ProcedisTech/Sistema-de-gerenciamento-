import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import '@testing-library/jest-dom';
import { Step4Procedimento } from './Step4LGPD.jsx';
import { temFaltantes, titulosFaltantes } from '../../utils/termoResolucao.js';

vi.mock('../../hooks/useProcedimentosOptions', () => ({
  useProcedimentosOptions: () => ({
    options: [
      { id: 'cat-botox', nomeProcedimento: 'Toxina Botulínica', tipoCodigo: 'INJETAVEL' },
      { id: 'cat-preench', nomeProcedimento: 'Preenchimento Labial', tipoCodigo: 'PREENCHIMENTO' },
      { id: 'cat-bio', nomeProcedimento: 'Bioestimulador de Colágeno', tipoCodigo: 'BIOESTIMULADOR' },
      { id: 'cat-limpeza', nomeProcedimento: 'Limpeza de Pele Profunda', tipoCodigo: 'FACIAL' },
    ],
    loading: false,
  }),
}));

vi.mock('./mapa-aplicacao/MapaAplicacaoPanel.jsx', () => ({
  MapaAplicacaoPanel: () => <div data-testid="mapa-panel">mapa-aplicacao-panel</div>,
}));

vi.mock('./PhotoCarouselLane.jsx', () => ({
  PhotoCarouselLane: () => <div data-testid="photo-lane">photo-carousel-lane</div>,
}));

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════
 * 🧪 BATERIA DE TESTES UNIFICADA: MÚLTIPLOS PROCEDIMENTOS + ISOLAMENTO DE PLANOS E TERMOS
 * ══════════════════════════════════════════════════════════════════════════════════════════
 */
describe('Bateria Unificada: Múltiplos Procedimentos & Isolamento de Termos (Plano vs Avulso)', () => {
  const planoHarmonizacaoCtx = {
    planejamentoId: 'plano-harmonizacao-uuid',
    titulo: 'Harmonização Facial Completa',
    itens: [
      {
        id: 'item-botox-1',
        catalogoProcedimentoSaudeId: 'cat-botox',
        nomeProcedimento: 'Toxina Botulínica',
        statusItem: 'pendente',
      },
      {
        id: 'item-preench-1',
        catalogoProcedimentoSaudeId: 'cat-preench',
        nomeProcedimento: 'Preenchimento Labial',
        statusItem: 'pendente',
      },
    ],
  };

  // ─── TESTE 1: ADIÇÃO RÁPIDA DE MÚLTIPLOS ITENS DO PLANO COM 1-CLIQUE ───────────────────
  it('Cenário 1: Adiciona múltiplos procedimentos do plano pelo card com 1 clique (vinculando planejamentoItemId)', async () => {
    const onValidarMock = vi.fn().mockResolvedValue(true);
    let sessaoAtual = [];
    const setProcedimentosSessaoMock = vi.fn((novaLista) => {
      sessaoAtual = novaLista;
    });

    const { rerender } = render(
      <Step4Procedimento
        procedimentosSessao={sessaoAtual}
        setProcedimentosSessao={setProcedimentosSessaoMock}
        onValidarTermosCatalogo={onValidarMock}
        journeyPlanejamentoCtx={planoHarmonizacaoCtx}
      />
    );

    // Card do plano deve exibir os 2 procedimentos pendentes
    expect(screen.getByText(/Procedimentos do Plano de Tratamento Ativo/i)).toBeInTheDocument();
    expect(screen.getByText(/2 pendentes/i)).toBeInTheDocument();

    // 1º Clique: adiciona Toxina Botulínica pelo plano
    const btnBotox = screen.getByRole('button', { name: /\+.*Toxina Botulínica.*Realizar pelo Plano/i });
    fireEvent.click(btnBotox);

    expect(setProcedimentosSessaoMock).toHaveBeenCalledWith([
      expect.objectContaining({
        catalogoId: 'cat-botox',
        nomeProcedimento: 'Toxina Botulínica',
        planejamentoItemId: 'item-botox-1',
        isAvulso: false,
      }),
    ]);

    // Simula re-render com 1 procedimento já na sessão
    sessaoAtual = [
      {
        catalogoId: 'cat-botox',
        catalogoProcedimentoSaudeId: 'cat-botox',
        nomeProcedimento: 'Toxina Botulínica',
        planejamentoItemId: 'item-botox-1',
        isAvulso: false,
      },
    ];

    rerender(
      <Step4Procedimento
        procedimentosSessao={sessaoAtual}
        setProcedimentosSessao={setProcedimentosSessaoMock}
        onValidarTermosCatalogo={onValidarMock}
        journeyPlanejamentoCtx={planoHarmonizacaoCtx}
      />
    );

    // Agora o card deve exibir apenas 1 procedimento pendente (Preenchimento)
    expect(screen.getByText(/1 pendente/i)).toBeInTheDocument();

    // 2º Clique: adiciona Preenchimento Labial pelo plano
    const btnPreench = screen.getByRole('button', { name: /\+.*Preenchimento Labial.*Realizar pelo Plano/i });
    fireEvent.click(btnPreench);

    // Verifica que agora a sessão contém ambos os procedimentos vinculados ao plano
    expect(setProcedimentosSessaoMock).toHaveBeenCalledWith([
      expect.objectContaining({
        catalogoId: 'cat-botox',
        planejamentoItemId: 'item-botox-1',
        isAvulso: false,
      }),
      expect.objectContaining({
        catalogoId: 'cat-preench',
        planejamentoItemId: 'item-preench-1',
        isAvulso: false,
      }),
    ]);
  });

  // ─── TESTE 2: SESSÃO MISTA (1 DO PLANO + 1 AVULSO) ──────────────────────────────────────
  it('Cenário 2: Sessão Mista com 1 procedimento do Plano e 1 procedimento Avulso fora do plano', async () => {
    const onValidarMock = vi.fn().mockResolvedValue(true);
    let sessaoAtual = [
      {
        catalogoId: 'cat-botox',
        catalogoProcedimentoSaudeId: 'cat-botox',
        nomeProcedimento: 'Toxina Botulínica',
        planejamentoItemId: 'item-botox-1',
        isAvulso: false,
      },
    ];
    const setProcedimentosSessaoMock = vi.fn((novaLista) => {
      sessaoAtual = novaLista;
    });

    render(
      <Step4Procedimento
        procedimentosSessao={sessaoAtual}
        setProcedimentosSessao={setProcedimentosSessaoMock}
        onValidarTermosCatalogo={onValidarMock}
        journeyPlanejamentoCtx={planoHarmonizacaoCtx}
      />
    );

    // O profissional agora busca no autocomplete um procedimento fora do plano (Bioestimulador)
    const searchInput = screen.getByPlaceholderText(/Buscar procedimento/i);
    fireEvent.focus(searchInput);
    fireEvent.change(searchInput, { target: { value: 'Bioestimulador' } });

    const optionBio = await screen.findByRole('option', { name: /Bioestimulador de Colágeno/i });
    fireEvent.click(optionBio);

    // Como o bioestimulador NÃO está no plano, NÃO deve abrir o modal de interceptação e entra direto como avulso
    expect(screen.queryByText(/Procedimento Encontrado no Plano/i)).not.toBeInTheDocument();

    expect(setProcedimentosSessaoMock).toHaveBeenCalledWith([
      expect.objectContaining({
        catalogoId: 'cat-botox',
        planejamentoItemId: 'item-botox-1',
        isAvulso: false,
      }),
      expect.objectContaining({
        catalogoId: 'cat-bio',
        nomeProcedimento: 'Bioestimulador de Colágeno',
        planejamentoItemId: null,
        isAvulso: true,
      }),
    ]);

    // onValidarTermosCatalogo é acionado com a lista mista completa
    expect(onValidarMock).toHaveBeenCalledWith(
      ['cat-botox', 'cat-bio'],
      'Toxina Botulínica + Bioestimulador de Colágeno',
      expect.objectContaining({
        abrirModal: false,
        procedimentosSessaoOverride: expect.arrayContaining([
          expect.objectContaining({ catalogoId: 'cat-botox', isAvulso: false, planejamentoItemId: 'item-botox-1' }),
          expect.objectContaining({ catalogoId: 'cat-bio', isAvulso: true, planejamentoItemId: null }),
        ]),
      })
    );
  });

  // ─── TESTE 3: INTERCEPTOR INTELIGENTE - ESCOLHA DE PROCEDIMENTO AVULSO ──────────────────
  it('Cenário 3: Interceptor detecta busca manual de item do plano e profissional escolhe torná-lo AVULSO', async () => {
    const onValidarMock = vi.fn().mockResolvedValue(true);
    const setProcedimentosSessaoMock = vi.fn();

    render(
      <Step4Procedimento
        procedimentosSessao={[]}
        setProcedimentosSessao={setProcedimentosSessaoMock}
        onValidarTermosCatalogo={onValidarMock}
        journeyPlanejamentoCtx={planoHarmonizacaoCtx}
      />
    );

    // Profissional busca "Toxina Botulínica" (que existe no plano) no campo de busca geral
    const searchInput = screen.getByPlaceholderText(/Buscar procedimento/i);
    fireEvent.focus(searchInput);
    fireEvent.change(searchInput, { target: { value: 'Toxina' } });

    const optionBotox = await screen.findByRole('option', { name: /Toxina Botulínica/i });
    fireEvent.click(optionBotox);

    // O modal interceptador DEVE ser aberto
    await waitFor(() => {
      expect(screen.getByText(/Procedimento Encontrado no Plano/i)).toBeInTheDocument();
      expect(screen.getByText(/Realizar pelo Plano de Tratamento/i)).toBeInTheDocument();
      expect(screen.getByText(/Realizar como Procedimento Avulso \(Fora do Plano\)/i)).toBeInTheDocument();
    });

    // Clica em "Realizar como Procedimento Avulso"
    const btnAvulso = screen.getByText(/Realizar como Procedimento Avulso \(Fora do Plano\)/i);
    fireEvent.click(btnAvulso);

    // Verifica que entrou na sessão como avulso (planejamentoItemId: null, isAvulso: true)
    expect(setProcedimentosSessaoMock).toHaveBeenCalledWith([
      expect.objectContaining({
        catalogoId: 'cat-botox',
        nomeProcedimento: 'Toxina Botulínica',
        planejamentoItemId: null,
        isAvulso: true,
      }),
    ]);

    // O modal deve fechar
    await waitFor(() => {
      expect(screen.queryByText(/Procedimento Encontrado no Plano/i)).not.toBeInTheDocument();
    });
  });

  // ─── TESTE 4: INTERCEPTOR INTELIGENTE - ESCOLHA DE REALIZAR PELO PLANO ──────────────────
  it('Cenário 4: Interceptor detecta busca manual e profissional escolhe a opção RECOMENDADA (Pelo Plano)', async () => {
    const onValidarMock = vi.fn().mockResolvedValue(true);
    const setProcedimentosSessaoMock = vi.fn();

    render(
      <Step4Procedimento
        procedimentosSessao={[]}
        setProcedimentosSessao={setProcedimentosSessaoMock}
        onValidarTermosCatalogo={onValidarMock}
        journeyPlanejamentoCtx={planoHarmonizacaoCtx}
      />
    );

    const searchInput = screen.getByPlaceholderText(/Buscar procedimento/i);
    fireEvent.focus(searchInput);
    fireEvent.change(searchInput, { target: { value: 'Preenchimento' } });

    const optionPreench = await screen.findByRole('option', { name: /Preenchimento Labial/i });
    fireEvent.click(optionPreench);

    // O modal interceptador abre
    await waitFor(() => {
      expect(screen.getByText(/Procedimento Encontrado no Plano/i)).toBeInTheDocument();
    });

    // Clica na opção recomendada (Pelo Plano)
    const btnPlano = screen.getByText(/Realizar pelo Plano de Tratamento/i);
    fireEvent.click(btnPlano);

    // Verifica que entrou vinculado ao plano
    expect(setProcedimentosSessaoMock).toHaveBeenCalledWith([
      expect.objectContaining({
        catalogoId: 'cat-preench',
        nomeProcedimento: 'Preenchimento Labial',
        planejamentoItemId: 'item-preench-1',
        isAvulso: false,
      }),
    ]);
  });

  // ─── TESTE 5: REMOÇÃO DE CHIP E REIDRATAÇÃO REATIVA DO PLANO ─────────────────────────────
  it('Cenário 5: Remoção de procedimento da sessão devolve o item imediatamente para o card do plano', async () => {
    const onValidarMock = vi.fn().mockResolvedValue(true);
    const setProcedimentosSessaoMock = vi.fn();

    const sessaoComDois = [
      {
        catalogoId: 'cat-botox',
        catalogoProcedimentoSaudeId: 'cat-botox',
        nomeProcedimento: 'Toxina Botulínica',
        planejamentoItemId: 'item-botox-1',
        isAvulso: false,
      },
      {
        catalogoId: 'cat-bio',
        catalogoProcedimentoSaudeId: 'cat-bio',
        nomeProcedimento: 'Bioestimulador de Colágeno',
        planejamentoItemId: null,
        isAvulso: true,
      },
    ];

    render(
      <Step4Procedimento
        procedimentosSessao={sessaoComDois}
        setProcedimentosSessao={setProcedimentosSessaoMock}
        onValidarTermosCatalogo={onValidarMock}
        journeyPlanejamentoCtx={planoHarmonizacaoCtx}
      />
    );

    // Remove a Toxina Botulínica
    const btnRemoverBotox = screen.getByRole('button', { name: /Remover Toxina Botulínica/i });
    fireEvent.click(btnRemoverBotox);

    // Apenas o bioestimulador deve sobrar na sessão
    expect(setProcedimentosSessaoMock).toHaveBeenCalledWith([
      expect.objectContaining({
        catalogoId: 'cat-bio',
      }),
    ]);

    // Validação de termos é recalculada imediatamente com os procedimentos restantes
    expect(onValidarMock).toHaveBeenCalledWith(
      ['cat-bio'],
      'Bioestimulador de Colágeno',
      expect.objectContaining({
        abrirModal: false,
        procedimentosSessaoOverride: [expect.objectContaining({ catalogoId: 'cat-bio' })],
      })
    );
  });

  // ─── TESTE 6: GATE DE TERMOS NA SESSÃO MISTA (ISOLAMENTO EFETIVO) ───────────────────────
  it('Cenário 6: Gate Coletivo em Sessão Mista — Bloqueia se o avulso não estiver assinado, mesmo com plano assinado', () => {
    // Simulação do payload retornado pelo endpoint /resolucao do backend:
    // Toxina (do plano): vigente: true (aproveitou a assinatura do plano)
    // Bioestimulador (avulso): vigente: false (falta assinatura avulsa)
    const resolucaoMistaComFaltante = {
      podeExecutar: false,
      termosExigidos: [
        {
          termoId: 'termo-botox-id',
          titulo: 'Termo de Consentimento - Toxina Botulínica',
          obrigatorio: true,
          vigente: true, // Coberto pelo plano!
        },
        {
          termoId: 'termo-bio-id',
          titulo: 'Termo de Consentimento - Bioestimulador de Colágeno',
          obrigatorio: true,
          vigente: false, // Avulso não assinado!
        },
      ],
      faltantes: [
        {
          termoId: 'termo-bio-id',
          titulo: 'Termo de Consentimento - Bioestimulador de Colágeno',
          obrigatorio: true,
        },
      ],
    };

    // Avaliação do gate clínico:
    expect(temFaltantes(resolucaoMistaComFaltante)).toBe(true);
    expect(titulosFaltantes(resolucaoMistaComFaltante)).toEqual([
      'Termo de Consentimento - Bioestimulador de Colágeno',
    ]);

    // Quando o termo avulso é assinado:
    const resolucaoMistaAposAssinatura = {
      podeExecutar: true,
      termosExigidos: [
        {
          termoId: 'termo-botox-id',
          titulo: 'Termo de Consentimento - Toxina Botulínica',
          obrigatorio: true,
          vigente: true,
        },
        {
          termoId: 'termo-bio-id',
          titulo: 'Termo de Consentimento - Bioestimulador de Colágeno',
          obrigatorio: true,
          vigente: true,
        },
      ],
      faltantes: [],
    };

    expect(temFaltantes(resolucaoMistaAposAssinatura)).toBe(false);
    expect(titulosFaltantes(resolucaoMistaAposAssinatura)).toHaveLength(0);
  });
});
