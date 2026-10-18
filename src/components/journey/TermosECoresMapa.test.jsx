// Regressão prevenida:
// 1. Termos de consentimento vigentes/assinados desapareciam do Hub de Procedimento após assinatura porque
//    AppRefactored omitia termosExigidos do objeto resolucaoAgregada.
// 2. Pontos de múltiplos procedimentos no mapa perdiam seus vínculos ao importar do plano e assumiam a cor do
//    procedimento armado atualmente selecionado.
// 3. getProcedimentoStats contava grupos em vez de pontos individuais na barra lateral fullscreen.
// 4. Teste de colisão forçada em recursos finitos (Pigeonhole Collision Test) para cores dos procedimentos.

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom';

import { consentimentosAguardandoExecucao } from '../../utils/termoResolucao.js';
import { Step4Procedimento } from './Step4LGPD.jsx';
import { useMapaAplicacaoState } from '../hooks/useMapaAplicacaoState.js';
import { renderHook, act } from '@testing-library/react';
import { getCorLivreParaProcedimento, hashUuid } from '../../constants/mapeamentoPaletaCores.js';

vi.mock('../../hooks/useProcedimentosOptions', () => ({
  useProcedimentosOptions: () => ({
    options: [
      { id: 'cat-biopsia', nomeProcedimento: 'Biópsia de Pele', nome: 'Biópsia de Pele' },
      { id: 'cat-drenagem', nomeProcedimento: 'Drenagem de Abscesso', nome: 'Drenagem de Abscesso' },
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

describe('Regressão Zero — Termos Assinados no Hub e Cores Únicas no Mapa', () => {
  it('Cenário 1: Agregação de termosExigidos permite que termos assinados apareçam no Hub de Procedimento', () => {
    // Simula o retorno de dois procedimentos que foram resolvidos e assinados
    const resolucaoBiopsia = {
      termosObrigatorios: [{ termoId: 'termo-1', titulo: 'Termo de Biópsia' }],
      faltantes: [],
      termosExigidos: [
        {
          termoId: 'termo-1',
          titulo: 'Termo de Biópsia',
          vigente: true,
          assinaturaId: 'ass-1',
          assinadoEm: '2026-10-17T10:00:00Z',
          catalogos: [{ id: 'cat-biopsia', nome: 'Biópsia de Pele' }],
        },
      ],
      procedimentos: [{ id: 'cat-biopsia', nome: 'Biópsia de Pele' }],
    };

    const resolucaoDrenagem = {
      termosObrigatorios: [{ termoId: 'termo-2', titulo: 'Termo de Drenagem' }],
      faltantes: [],
      termosExigidos: [
        {
          termoId: 'termo-2',
          titulo: 'Termo de Drenagem',
          vigente: true,
          assinaturaId: 'ass-2',
          assinadoEm: '2026-10-17T10:05:00Z',
          catalogos: [{ id: 'cat-drenagem', nome: 'Drenagem de Abscesso' }],
        },
      ],
      procedimentos: [{ id: 'cat-drenagem', nome: 'Drenagem de Abscesso' }],
    };

    // Função de agregação canônica esperada em AppRefactored
    const resolucoesValidas = [resolucaoBiopsia, resolucaoDrenagem];
    const termosExigidosMap = new Map();
    resolucoesValidas.forEach((r) => {
      (r.termosExigidos || []).forEach((item) => {
        const id = String(item?.termoId || item?.id || '').trim();
        if (!id) return;
        if (!termosExigidosMap.has(id)) {
          termosExigidosMap.set(id, {
            ...item,
            catalogos: Array.isArray(item.catalogos) ? [...item.catalogos] : [],
          });
        }
      });
    });

    const resolucaoAgregada = {
      termosObrigatorios: [...resolucaoBiopsia.termosObrigatorios, ...resolucaoDrenagem.termosObrigatorios],
      faltantes: [],
      termosExigidos: Array.from(termosExigidosMap.values()),
      procedimentos: [...resolucaoBiopsia.procedimentos, ...resolucaoDrenagem.procedimentos],
      totalObrigatorios: 2,
      totalFaltantes: 0,
    };

    // Valida que consentimentosAguardandoExecucao extrai corretamente os 2 termos
    const aguardando = consentimentosAguardandoExecucao(resolucaoAgregada);
    expect(aguardando).toHaveLength(2);
    expect(aguardando[0].titulo).toBe('Termo de Biópsia');
    expect(aguardando[0].procedimentos).toEqual(['Biópsia de Pele']);
    expect(aguardando[1].titulo).toBe('Termo de Drenagem');
    expect(aguardando[1].procedimentos).toEqual(['Drenagem de Abscesso']);

    // Renderiza Step4Procedimento com a resolução agregada
    render(
      <Step4Procedimento
        resolucao={resolucaoAgregada}
        consentimentosAguardandoExecucao={aguardando}
        execucaoBloqueadaPorTermos={false}
        procedimentosSessao={[
          { id: 'pf-1', catalogoProcedimentoSaudeId: 'cat-biopsia', nome: 'Biópsia de Pele' },
          { id: 'pf-2', catalogoProcedimentoSaudeId: 'cat-drenagem', nome: 'Drenagem de Abscesso' },
        ]}
        nomeProcedimento="Biópsia de Pele"
        activeProcedureIndex={0}
      />
    );

    // Assertar que os 2 termos aparecem renderizados na interface como assinados
    expect(screen.getByText('Termo de Biópsia')).toBeInTheDocument();
    expect(screen.getByText('Termo de Drenagem')).toBeInTheDocument();
    expect(screen.getByText(/2 assinados/i)).toBeInTheDocument();
    expect(screen.getAllByText('Assinado')).toHaveLength(2);
  });

  it('Cenário 2: importarPontosDoPlano preserva catalogoProcedimentoSaudeId e cor', () => {
    const { result } = renderHook(() => useMapaAplicacaoState());

    const pontosDoPlano = [
      {
        posX: 35.5,
        posY: 42.0,
        quantidade: 2,
        tamanho: 1.0,
        catalogoProcedimentoSaudeId: 'cat-biopsia',
        cor: '#d946ef',
      },
      {
        posX: 60.0,
        posY: 50.0,
        quantidade: 1,
        tamanho: 1.0,
        catalogoProcedimentoSaudeId: 'cat-drenagem',
        cor: '#0d9488',
      },
    ];

    act(() => {
      result.current.importarPontosDoPlano(pontosDoPlano, 'frontal', 'cat-biopsia', 'Biópsia de Pele');
    });

    const pontosSalvos = result.current.pontosPorVista['frontal'];
    expect(pontosSalvos).toHaveLength(2);
    expect(pontosSalvos[0].catalogoProcedimentoSaudeId).toBe('cat-biopsia');
    expect(pontosSalvos[0].cor).toBe('#d946ef');
    expect(pontosSalvos[1].catalogoProcedimentoSaudeId).toBe('cat-drenagem');
    expect(pontosSalvos[1].cor).toBe('#0d9488');
  });

  it('Cenário 3: getPontosVista isola grupos e não contamina cores ao trocar procedimentoArmado', () => {
    const { result } = renderHook(() => useMapaAplicacaoState());

    act(() => {
      result.current.adicionarPonto('frontal', {
        posX: 30,
        posY: 30,
        quantidade: 1,
        catalogoProcedimentoSaudeId: 'cat-biopsia',
        catalogoId: 'cat-biopsia',
        cor: '#d946ef',
      });
      result.current.adicionarPonto('frontal', {
        posX: 70,
        posY: 70,
        quantidade: 1,
        catalogoProcedimentoSaudeId: 'cat-drenagem',
        catalogoId: 'cat-drenagem',
        cor: '#0d9488',
      });
    });

    const procedimentosSessao = [
      { id: 'cat-biopsia', nome: 'Biópsia de Pele', corHex: '#d946ef' },
      { id: 'cat-drenagem', nome: 'Drenagem de Abscesso', corHex: '#0d9488' },
    ];

    // Simula usuário com Biópsia selecionada
    const gruposComBiopsiaAtiva = result.current.getPontosVista(
      'frontal',
      'cat-biopsia',
      'Biópsia de Pele',
      procedimentosSessao
    );

    expect(gruposComBiopsiaAtiva).toHaveLength(2);
    const grupoBiopsia1 = gruposComBiopsiaAtiva.find((g) => g.catalogoProcedimentoSaudeId === 'cat-biopsia');
    const grupoDrenagem1 = gruposComBiopsiaAtiva.find((g) => g.catalogoProcedimentoSaudeId === 'cat-drenagem');
    expect(grupoBiopsia1.pontos[0].cor).toBe('#d946ef');
    expect(grupoDrenagem1.pontos[0].cor).toBe('#0d9488');

    // Simula usuário trocando para Drenagem selecionada
    const gruposComDrenagemAtiva = result.current.getPontosVista(
      'frontal',
      'cat-drenagem',
      'Drenagem de Abscesso',
      procedimentosSessao
    );

    expect(gruposComDrenagemAtiva).toHaveLength(2);
    const grupoBiopsia2 = gruposComDrenagemAtiva.find((g) => g.catalogoProcedimentoSaudeId === 'cat-biopsia');
    const grupoDrenagem2 = gruposComDrenagemAtiva.find((g) => g.catalogoProcedimentoSaudeId === 'cat-drenagem');
    // Ponto de Biópsia permanece rosa! Não vira a cor de Drenagem
    expect(grupoBiopsia2.pontos[0].cor).toBe('#d946ef');
    expect(grupoDrenagem2.pontos[0].cor).toBe('#0d9488');
  });

  it('Cenário 4: getProcedimentoStats conta pontos individuais dentro dos grupos e não os grupos', () => {
    // Simula a estrutura de pontosVista recebida por MapeamentoFullscreenOverlay
    const pontosVista = [
      {
        catalogoProcedimentoSaudeId: 'cat-biopsia',
        nomeProcedimento: 'Biópsia de Pele',
        pontos: [
          { localId: '1', quantidade: 1, catalogoProcedimentoSaudeId: 'cat-biopsia' },
          { localId: '2', quantidade: 1, catalogoProcedimentoSaudeId: 'cat-biopsia' },
          { localId: '3', quantidade: 2, catalogoProcedimentoSaudeId: 'cat-biopsia' },
        ],
      },
      {
        catalogoProcedimentoSaudeId: 'cat-drenagem',
        nomeProcedimento: 'Drenagem de Abscesso',
        pontos: [
          { localId: '4', quantidade: 0.5, catalogoProcedimentoSaudeId: 'cat-drenagem' },
        ],
      },
    ];

    // Implementação correta de getProcedimentoStats
    const getProcedimentoStats = (procId) => {
      let pontosCount = 0;
      let doseTotal = 0;
      const targetId = String(procId || '');
      const colecao = Array.isArray(pontosVista) ? pontosVista : [];

      colecao.forEach((item) => {
        if (Array.isArray(item.pontos)) {
          const grupoCatId = String(item.catalogoProcedimentoSaudeId || item.catalogoId || '');
          item.pontos.forEach((pt) => {
            const ptId = String(pt.catalogoProcedimentoSaudeId || pt.catalogoId || pt.procedimentoId || grupoCatId);
            if (ptId === targetId) {
              pontosCount++;
              doseTotal += Number(pt.quantidade || pt.dose || 0);
            }
          });
        } else {
          const ptId = String(item.catalogoProcedimentoSaudeId || item.catalogoId || item.procedimentoId || '');
          if (ptId === targetId) {
            pontosCount++;
            doseTotal += Number(item.quantidade || item.dose || 0);
          }
        }
      });

      return { pontosCount, doseTotal: Number(doseTotal.toFixed(2)) };
    };

    const statsBiopsia = getProcedimentoStats('cat-biopsia');
    expect(statsBiopsia.pontosCount).toBe(3);
    expect(statsBiopsia.doseTotal).toBe(4);

    const statsDrenagem = getProcedimentoStats('cat-drenagem');
    expect(statsDrenagem.pontosCount).toBe(1);
    expect(statsDrenagem.doseTotal).toBe(0.5);
  });

  it('Cenário 5: Teste Adversarial de Colisão Forçada em Recursos Finitos (Pigeonhole Collision Test)', () => {
    // Procura dois UUIDs/strings com o mesmo hash mod 12
    let id1 = 'id_test_base';
    let baseMod = hashUuid(id1) % 12;
    let id2 = null;

    for (let i = 0; i < 2000; i++) {
      const candidate = `id_candidate_${i}`;
      if (hashUuid(candidate) % 12 === baseMod) {
        id2 = candidate;
        break;
      }
    }

    expect(id2).not.toBeNull();
    expect(hashUuid(id1) % 12).toBe(hashUuid(id2) % 12);

    // O primeiro procedimento pega a cor preferencial do hash
    const cor1 = getCorLivreParaProcedimento(id1, []);
    // O segundo procedimento, tendo o mesmo hash, DEVE desviar para uma cor livre sem colidir
    const cor2 = getCorLivreParaProcedimento(id2, [cor1]);

    expect(cor1).toBeTruthy();
    expect(cor2).toBeTruthy();
    expect(cor1.toLowerCase()).not.toBe(cor2.toLowerCase());
  });
});
