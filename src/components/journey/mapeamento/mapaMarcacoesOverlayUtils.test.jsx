// Regressão prevenida: Pontos e traços de avaliação sem vínculo com catálogo de procedimento
// NÃO podem cair no fallback vermelho (#ef4444) nem receber rótulo vazio ou "Procedimento".
// A cor canônica clínica para avaliação é o azul (#3b82f6) e o rótulo descritivo deve ser "Avaliação".

import { describe, it, expect } from 'vitest';
import { marcacoesApiToOverlayPontos } from './mapaMarcacoesOverlayUtils.js';

describe('marcacoesApiToOverlayPontos — Regras de Cores e Rótulos Clínicos', () => {
  it('aplica cor azul #3b82f6 e rótulo "Avaliação" para marcações de avaliação avulsa sem procedimento', () => {
    // Dado um mapa de avaliação onde o profissional desenhou pontos/traços sem escolher procedimento de catálogo
    const marcacoesSemProcedimento = [
      {
        id: 'marc-av-1',
        tipoGeometria: 'ponto',
        quantidade: 1,
        vertices: [{ posX: 15.5, posY: 25.0, ordem: 1 }],
      },
      {
        id: 'marc-av-2',
        tipoGeometria: 'traco',
        quantidade: 2,
        vertices: [
          { posX: 10.0, posY: 20.0, ordem: 1 },
          { posX: 12.0, posY: 22.0, ordem: 2 },
        ],
      },
    ];

    // Quando o overlay normaliza as marcações para renderização
    const pontos = marcacoesApiToOverlayPontos(marcacoesSemProcedimento, []);

    // Então nenhum ponto/traço deve ficar vermelho (#ef4444)
    expect(pontos).toHaveLength(2);
    expect(pontos[0].cor).toBe('#3b82f6');
    expect(pontos[0].nomeProcedimento).toBe('Avaliação');
    expect(pontos[1].cor).toBe('#3b82f6');
    expect(pontos[1].nomeProcedimento).toBe('Avaliação');
  });

  it('preserva a cor explícita e o procedimento quando fornecidos', () => {
    // Dado um procedimento cadastrado com cor própria (ex: Roxa #8b5cf6)
    const procedimentos = [
      {
        id: 'proc-1',
        catalogoNome: 'Toxina Botulínica',
        corHex: '#8b5cf6',
      },
    ];
    const marcacoes = [
      {
        id: 'm-tox',
        mapaProcedimentoId: 'proc-1',
        vertices: [{ posX: 50.0, posY: 50.0, ordem: 1 }],
      },
    ];

    // Quando normalizado
    const pontos = marcacoesApiToOverlayPontos(marcacoes, procedimentos);

    // Então respeita os dados do procedimento vinculado
    expect(pontos[0].cor).toBe('#8b5cf6');
    expect(pontos[0].nomeProcedimento).toBe('Toxina Botulínica');
  });

  it('resolve cor do procedimento por catalogoProcedimentoSaudeId mesmo com mapaProcedimentoId nulo (cenário em memória do Hub)', () => {
    // Procedimento sem id relacional, apenas catalogoProcedimentoSaudeId com cor customizada laranja
    const procedimentos = [
      {
        catalogoProcedimentoSaudeId: 'cat-biopsia-1',
        nomeProcedimento: 'Biópsia de Pele',
        corHex: '#f97316',
      },
    ];
    // Marcação local com mapaProcedimentoId nulo
    const marcacoes = [
      {
        id: 'm-local-1',
        mapaProcedimentoId: null,
        catalogoProcedimentoSaudeId: 'cat-biopsia-1',
        vertices: [{ posX: 50.0, posY: 50.0, ordem: 1 }],
      },
    ];

    const pontos = marcacoesApiToOverlayPontos(marcacoes, procedimentos);
    expect(pontos[0].cor).toBe('#f97316');
    expect(pontos[0].nomeProcedimento).toBe('Biópsia de Pele');
  });

  it('preserva a precedência estrita: m.corHex na marcação continua vencendo quando fornecida explicitamente', () => {
    const procedimentos = [
      {
        id: 'proc-1',
        catalogoProcedimentoSaudeId: 'cat-1',
        corHex: '#8b5cf6',
      },
    ];
    const marcacoes = [
      {
        id: 'm-1',
        mapaProcedimentoId: 'proc-1',
        corHex: '#ec4899', // rosa explícito na marcação
        vertices: [{ posX: 50.0, posY: 50.0, ordem: 1 }],
      },
    ];

    const pontos = marcacoesApiToOverlayPontos(marcacoes, procedimentos);
    expect(pontos[0].cor).toBe('#ec4899');
  });
});
