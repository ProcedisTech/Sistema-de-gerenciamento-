import { describe, it, expect } from 'vitest';
import { resolverFotosEPlanos } from './planoGaleriaResolver.js';

describe('planoGaleriaResolver - Separação estrita de fotos entre Pai e Retorno', () => {
  const planoMock = {
    id: 'plano-1',
    nome: 'Harmonização Facial',
    itens: [
      {
        id: 'item-biopsia',
        planejamentoItemId: 'item-biopsia',
        catalogoNome: 'Biópsia de Pele',
        catalogoProcedimentoSaudeId: 'cat-biopsia',
      },
    ],
  };

  it('separa fotos do procedimento pai e fotos do retorno em chaves distintas', () => {
    const procedimentosFeitos = [
      {
        id: 'pf-pai',
        planejamentoItemId: 'item-biopsia',
        isRetoque: false,
        procedimentoFeitoOrigemId: null,
      },
      {
        id: 'pf-retorno',
        planejamentoItemId: 'item-biopsia',
        isRetoque: true,
        procedimentoFeitoOrigemId: 'pf-pai',
        tipoProcedimentoCodigo: 'retorno',
      },
    ];

    const fotosBrutas = [
      {
        id: 'foto-antes-pai',
        procedimentoFeitoId: 'pf-pai',
        categoria: 'antes',
        dataReferencia: '2026-09-11',
      },
      {
        id: 'foto-mapa-pai',
        procedimentoFeitoId: 'pf-pai',
        categoria: 'mapa',
        dataReferencia: '2026-09-11',
      },
      {
        id: 'foto-antes-retorno',
        procedimentoFeitoId: 'pf-retorno',
        categoria: 'antes',
        dataReferencia: '2026-09-11',
      },
      {
        id: 'foto-mapa-retorno',
        procedimentoFeitoId: 'pf-retorno',
        categoria: 'mapa',
        dataReferencia: '2026-09-11',
      },
    ];

    const resultado = resolverFotosEPlanos([planoMock], fotosBrutas, procedimentosFeitos);

    // 1. Fotos do pai devem conter apenas fotos do pf-pai
    const fotosPai = resultado.fotosPorPlanejamentoItemId['item-biopsia'] || [];
    expect(fotosPai).toHaveLength(2);
    expect(fotosPai.map((f) => f.id)).toEqual(['foto-antes-pai', 'foto-mapa-pai']);
    expect(fotosPai.every((f) => f.isRetorno === false)).toBe(true);

    // 2. Fotos do retorno devem conter apenas fotos do pf-retorno sob a chave item-biopsia_retorno
    const fotosRetorno = resultado.fotosPorPlanejamentoItemId['item-biopsia_retorno'] || [];
    expect(fotosRetorno).toHaveLength(2);
    expect(fotosRetorno.map((f) => f.id)).toEqual(['foto-antes-retorno', 'foto-mapa-retorno']);
    expect(fotosRetorno.every((f) => f.isRetorno === true)).toBe(true);

    // 3. O plano como um todo deve conter todas as 4 fotos para os contadores globais
    const fotosPlano = resultado.fotosPorPlanoId['plano-1'] || [];
    expect(fotosPlano).toHaveLength(4);
  });

  it('herda o plano e chave de retorno mesmo quando o retorno não tem planejamentoItemId direto mas tem procedimentoFeitoOrigemId', () => {
    const procedimentosFeitos = [
      {
        id: 'pf-pai',
        planejamentoItemId: 'item-biopsia',
        isRetoque: false,
      },
      {
        id: 'pf-retorno-legado',
        planejamentoItemId: null, // não veio gravado no retorno legado
        isRetoque: true,
        procedimentoFeitoOrigemId: 'pf-pai', // link com o pai
      },
    ];

    const fotosBrutas = [
      {
        id: 'foto-pai',
        procedimentoFeitoId: 'pf-pai',
        categoria: 'antes',
      },
      {
        id: 'foto-retorno',
        procedimentoFeitoId: 'pf-retorno-legado',
        categoria: 'depois',
      },
    ];

    const resultado = resolverFotosEPlanos([planoMock], fotosBrutas, procedimentosFeitos);

    expect(resultado.fotosPorPlanejamentoItemId['item-biopsia']).toHaveLength(1);
    expect(resultado.fotosPorPlanejamentoItemId['item-biopsia'][0].id).toBe('foto-pai');

    expect(resultado.fotosPorPlanejamentoItemId['item-biopsia_retorno']).toHaveLength(1);
    expect(resultado.fotosPorPlanejamentoItemId['item-biopsia_retorno'][0].id).toBe('foto-retorno');
    expect(resultado.fotosPorPlanejamentoItemId['item-biopsia_retorno'][0].isRetorno).toBe(true);
  });

  it('mantém procedimentos e fotos avulsas (fora de plano) isolados em atendimentosAvulsos', () => {
    const procedimentosFeitos = [
      {
        id: 'pf-avulso',
        planejamentoItemId: null,
        procedimentoNome: 'Consulta Avulsa',
      },
    ];

    const fotosBrutas = [
      {
        id: 'foto-avulsa',
        procedimentoFeitoId: 'pf-avulso',
        categoria: 'outro',
      },
    ];

    const resultado = resolverFotosEPlanos([planoMock], fotosBrutas, procedimentosFeitos);

    expect(resultado.atendimentosAvulsos).toHaveLength(1);
    expect(resultado.atendimentosAvulsos[0].id).toBe('pf-avulso');
    expect(resultado.atendimentosAvulsos[0].fotos).toHaveLength(1);
    expect(resultado.atendimentosAvulsos[0].fotos[0].id).toBe('foto-avulsa');
    expect(resultado.fotosPorPlanejamentoItemId['item-biopsia']).toBeUndefined();
  });

  it('isola estritamente Retorno A (Biópsia) e Retorno B (Drenagem) no mesmo plano e na mesma data', () => {
    const planoMultiplo = {
      id: 'plano-multi',
      itens: [
        {
          id: 'item-biopsia',
          planejamentoItemId: 'item-biopsia',
          catalogoNome: 'Biópsia de Pele',
          sessaoRealizada: { agendaId: 'ag-pai-a', statusCodigo: 'realizado' },
          sessaoRetornoRealizada: { agendaId: 'ag-ret-a', statusCodigo: 'realizado' },
        },
        {
          id: 'item-drenagem',
          planejamentoItemId: 'item-drenagem',
          catalogoNome: 'Drenagem de Abscesso',
          sessaoRealizada: { agendaId: 'ag-pai-b', statusCodigo: 'realizado' },
          sessaoRetornoRealizada: { agendaId: 'ag-ret-b', statusCodigo: 'realizado' },
        },
      ],
    };

    const procedimentosFeitos = [
      { id: 'pf-pai-a', planejamentoItemId: 'item-biopsia', isRetoque: false },
      { id: 'pf-retorno-a', agendaId: 'ag-ret-a', isRetoque: true, procedimentoFeitoOrigemId: 'pf-pai-a', tipoProcedimentoCodigo: 'retorno' },
      { id: 'pf-pai-b', planejamentoItemId: 'item-drenagem', isRetoque: false },
      { id: 'pf-retorno-b', agendaId: 'ag-ret-b', isRetoque: true, procedimentoFeitoOrigemId: 'pf-pai-b', tipoProcedimentoCodigo: 'retorno' },
    ];

    const fotosBrutas = [
      { id: 'foto-pai-a', procedimentoFeitoId: 'pf-pai-a', categoria: 'antes', dataReferencia: '2026-09-11' },
      { id: 'foto-retorno-a-1', procedimentoFeitoId: 'pf-retorno-a', categoria: 'depois', dataReferencia: '2026-09-11' },
      { id: 'foto-pai-b', procedimentoFeitoId: 'pf-pai-b', categoria: 'antes', dataReferencia: '2026-09-11' },
      { id: 'foto-retorno-b-1', procedimentoFeitoId: 'pf-retorno-b', categoria: 'depois', dataReferencia: '2026-09-11' },
      { id: 'foto-retorno-b-2', procedimentoFeitoId: 'pf-retorno-b', categoria: 'mapa', dataReferencia: '2026-09-11' },
    ];

    const resultado = resolverFotosEPlanos([planoMultiplo], fotosBrutas, procedimentosFeitos);

    // 1. Procedimento Pai A
    const fotosPaiA = resultado.fotosPorPlanejamentoItemId['item-biopsia'] || [];
    expect(fotosPaiA.map((f) => f.id)).toEqual(['foto-pai-a']);
    expect(fotosPaiA[0].matchedItemId).toBe('item-biopsia');

    // 2. Retorno A (Biópsia) deve conter APENAS a foto do Retorno A
    const fotosRetA = resultado.fotosPorPlanejamentoItemId['item-biopsia_retorno'] || [];
    expect(fotosRetA.map((f) => f.id)).toEqual(['foto-retorno-a-1']);
    expect(fotosRetA[0].matchedItemId).toBe('item-biopsia_retorno');
    expect(fotosRetA[0].isRetorno).toBe(true);

    // 3. Procedimento Pai B
    const fotosPaiB = resultado.fotosPorPlanejamentoItemId['item-drenagem'] || [];
    expect(fotosPaiB.map((f) => f.id)).toEqual(['foto-pai-b']);
    expect(fotosPaiB[0].matchedItemId).toBe('item-drenagem');

    // 4. Retorno B (Drenagem) deve conter APENAS as fotos do Retorno B (NUNCA vazar para Retorno A)
    const fotosRetB = resultado.fotosPorPlanejamentoItemId['item-drenagem_retorno'] || [];
    expect(fotosRetB.map((f) => f.id)).toEqual(['foto-retorno-b-1', 'foto-retorno-b-2']);
    expect(fotosRetB.every((f) => f.matchedItemId === 'item-drenagem_retorno')).toBe(true);
    expect(fotosRetB.every((f) => f.isRetorno === true)).toBe(true);

    // 5. Total do plano consolidado
    expect(resultado.fotosPorPlanoId['plano-multi']).toHaveLength(5);
  });
});
