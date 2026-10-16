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

  it('isola 3 avaliações clínicas distintas realizadas no mesmo dia usando agendaId', () => {
    const fotosBrutas = [
      {
        id: 'foto-aval-1',
        categoria: 'avaliacao',
        agendaId: 'agenda-sessao-1',
        dataReferencia: '2026-09-30',
        registradoEm: '2026-09-30T10:00:00Z',
        nomeProcedimento: 'Consulta / Avaliação Clínica',
      },
      {
        id: 'foto-aval-2',
        categoria: 'avaliacao',
        agendaId: 'agenda-sessao-2',
        dataReferencia: '2026-09-30',
        registradoEm: '2026-09-30T14:30:00Z',
        nomeProcedimento: 'Consulta / Avaliação Clínica',
      },
      {
        id: 'foto-aval-3',
        categoria: 'avaliacao',
        agendaId: 'agenda-sessao-3',
        dataReferencia: '2026-09-30',
        registradoEm: '2026-09-30T17:15:00Z',
        nomeProcedimento: 'Consulta / Avaliação Clínica',
      },
    ];

    const resultado = resolverFotosEPlanos([], fotosBrutas, []);

    // Deve gerar exatamente 3 cards independentes de atendimento avulso
    expect(resultado.atendimentosAvulsos).toHaveLength(3);
    const agIds = resultado.atendimentosAvulsos.map((a) => a.agendaId);
    expect(agIds).toContain('agenda-sessao-1');
    expect(agIds).toContain('agenda-sessao-2');
    expect(agIds).toContain('agenda-sessao-3');

    // Cada card deve conter apenas a sua respectiva foto
    const card1 = resultado.atendimentosAvulsos.find((a) => a.agendaId === 'agenda-sessao-1');
    expect(card1.fotos.map((f) => f.id)).toEqual(['foto-aval-1']);
    expect(card1.horaInicio).toBe('10:00');
    expect(card1.nomeProcedimento).toBe('Consulta / Avaliação Clínica');

    const card2 = resultado.atendimentosAvulsos.find((a) => a.agendaId === 'agenda-sessao-2');
    expect(card2.fotos.map((f) => f.id)).toEqual(['foto-aval-2']);
    expect(card2.horaInicio).toBe('14:30');

    const card3 = resultado.atendimentosAvulsos.find((a) => a.agendaId === 'agenda-sessao-3');
    expect(card3.fotos.map((f) => f.id)).toEqual(['foto-aval-3']);
    expect(card3.horaInicio).toBe('17:15');
  });

  it('unifica múltiplos procedimentos e fotos realizados na mesma sessão clínica (mesmo agendaId)', () => {
    const procedimentosFeitos = [
      {
        id: 'pf-1',
        agendaId: 'agenda-sessao-multi',
        planejamentoItemId: null,
        procedimentoNome: 'Biópsia de Pele',
        criadoEm: '2026-09-30T15:00:00Z',
      },
      {
        id: 'pf-2',
        agendaId: 'agenda-sessao-multi',
        planejamentoItemId: null,
        procedimentoNome: 'Drenagem de Abscesso',
        criadoEm: '2026-09-30T15:05:00Z',
      },
    ];

    const fotosBrutas = [
      {
        id: 'foto-antes',
        categoria: 'antes',
        agendaId: 'agenda-sessao-multi',
        procedimentoFeitoId: 'pf-1',
        dataReferencia: '2026-09-30',
        registradoEm: '2026-09-30T15:00:00Z',
      },
      {
        id: 'foto-depois',
        categoria: 'depois',
        agendaId: 'agenda-sessao-multi',
        procedimentoFeitoId: 'pf-2',
        dataReferencia: '2026-09-30',
        registradoEm: '2026-09-30T15:20:00Z',
      },
    ];

    const resultado = resolverFotosEPlanos([], fotosBrutas, procedimentosFeitos);

    // Deve unificar em 1 card único para a sessão
    expect(resultado.atendimentosAvulsos).toHaveLength(1);
    const cardSessao = resultado.atendimentosAvulsos[0];
    expect(cardSessao.agendaId).toBe('agenda-sessao-multi');
    expect(cardSessao.nomeProcedimento).toBe('Biópsia de Pele + Drenagem de Abscesso');
    expect(cardSessao.procedimentosItens).toEqual([
      { id: 'pf-1', nome: 'Biópsia de Pele', corHex: null },
      { id: 'pf-2', nome: 'Drenagem de Abscesso', corHex: null },
    ]);
    expect(cardSessao.fotos.map((f) => f.id)).toEqual(['foto-antes', 'foto-depois']);
  });

  it('vincula foto de avaliação com agendaId ao plano em fotosPorPlanoId sem alocar em fotosPorPlanejamentoItemId', () => {
    const planos = [
      {
        id: 'plano-1',
        nome: 'Harmonização Facial',
        itens: [
          {
            id: 'item-1',
            planejamentoItemId: 'item-1',
            catalogoNome: 'Toxina Botulínica',
          },
        ],
      },
    ];

    const procedimentosFeitos = [
      {
        id: 'pf-1',
        agendaId: 'agenda-avaliacao-1',
        planejamentoItemId: 'item-1',
      },
    ];

    const fotosBrutas = [
      {
        id: 'foto-avaliacao-limpa',
        categoria: 'avaliacao',
        agendaId: 'agenda-avaliacao-1',
        procedimentoFeitoId: null,
      },
    ];

    const resultado = resolverFotosEPlanos(planos, fotosBrutas, procedimentosFeitos);

    // Deve vincular ao plano geral
    expect(resultado.fotosPorPlanoId['plano-1']?.map((f) => f.id)).toContain('foto-avaliacao-limpa');
    // MAS NÃO deve alocar em nenhum item de procedimento específico
    expect(resultado.fotosPorPlanejamentoItemId['item-1']).toBeUndefined();
  });

  it('vincula foto/mapa de avaliação ao plano via mapaOverlay.procedimentos com planejamentoItemId', () => {
    const planos = [
      {
        id: 'plano-harmonizacao',
        nome: 'Harmonização Facial',
        itens: [
          {
            id: 'item-toxina-1',
            planejamentoItemId: 'item-toxina-1',
            catalogoNome: 'Toxina Botulínica',
          },
        ],
      },
    ];

    const fotosBrutas = [
      {
        id: 'foto-avaliacao-com-mapa',
        categoria: 'avaliacao',
        mapaOverlay: {
          mapaId: 'mapa-uuid-1',
          procedimentos: [
            {
              id: 'mp-1',
              planejamentoItemId: 'item-toxina-1',
              catalogoNome: 'Toxina Botulínica',
            },
          ],
          marcacoes: [{ id: 'm-1', x: 0.5, y: 0.5 }],
        },
      },
    ];

    const resultado = resolverFotosEPlanos(planos, fotosBrutas, []);

    expect(resultado.fotosPorPlanoId['plano-harmonizacao']).toHaveLength(1);
    expect(resultado.fotosPorPlanoId['plano-harmonizacao'][0].id).toBe('foto-avaliacao-com-mapa');
    expect(resultado.fotosAvulsas).toHaveLength(0);
  });

  it('vincula foto/mapa de avaliação ao plano via fallback por catalogoProcedimentoSaudeId', () => {
    const planos = [
      {
        id: 'plano-labios',
        nome: 'Preenchimento Labial',
        itens: [
          {
            id: 'item-preenchimento',
            catalogoProcedimentoSaudeId: 'cat-preenchimento-labial',
            catalogoNome: 'Preenchimento Labial',
          },
        ],
      },
    ];

    const fotosBrutas = [
      {
        id: 'foto-avaliacao-sem-itemId',
        categoria: 'avaliacao',
        mapaOverlay: {
          mapaId: 'mapa-uuid-2',
          procedimentos: [
            {
              id: 'mp-2',
              catalogoProcedimentoSaudeId: 'cat-preenchimento-labial',
              catalogoNome: 'Preenchimento Labial',
            },
          ],
          marcacoes: [{ id: 'm-2', x: 0.4, y: 0.6 }],
        },
      },
    ];

    const resultado = resolverFotosEPlanos(planos, fotosBrutas, []);

    expect(resultado.fotosPorPlanoId['plano-labios']).toHaveLength(1);
    expect(resultado.fotosPorPlanoId['plano-labios'][0].id).toBe('foto-avaliacao-sem-itemId');
    expect(resultado.fotosAvulsas).toHaveLength(0);
  });

  it('vincula foto de avaliação com mapaOverlay.planejamentoId diretamente ao plano em fotosPorPlanoId', () => {
    const planos = [
      {
        id: 'plano-biopsia-1',
        nome: 'Plano Biópsia',
        itens: [{ id: 'item-1', catalogoNome: 'Biópsia de Pele' }],
      },
    ];

    const fotosBrutas = [
      {
        id: 'foto-aval-com-plan-id',
        categoria: 'avaliacao',
        mapaOverlay: {
          mapaId: 'mapa-uuid-9',
          planejamentoId: 'plano-biopsia-1',
          marcacoes: [{ id: 'm-1' }],
        },
      },
    ];

    const resultado = resolverFotosEPlanos(planos, fotosBrutas, []);
    expect(resultado.fotosPorPlanoId['plano-biopsia-1']).toHaveLength(1);
    expect(resultado.fotosPorPlanoId['plano-biopsia-1'][0].id).toBe('foto-aval-com-plan-id');
    expect(resultado.fotosAvulsas).toHaveLength(0);
  });

  it('vincula foto de avaliação com mapaOverlay.planejamentoItemId ao plano em fotosPorPlanoId', () => {
    const planos = [
      {
        id: 'plano-biopsia-1',
        nome: 'Plano Biópsia',
        itens: [{ id: 'item-1', planejamentoItemId: 'item-1', catalogoNome: 'Biópsia de Pele' }],
      },
    ];

    const fotosBrutas = [
      {
        id: 'foto-aval-com-item-id',
        categoria: 'avaliacao',
        mapaOverlay: {
          mapaId: 'mapa-uuid-10',
          planejamentoItemId: 'item-1',
          marcacoes: [{ id: 'm-1' }],
        },
      },
    ];

    const resultado = resolverFotosEPlanos(planos, fotosBrutas, []);
    expect(resultado.fotosPorPlanoId['plano-biopsia-1']).toHaveLength(1);
    expect(resultado.fotosPorPlanoId['plano-biopsia-1'][0].id).toBe('foto-aval-com-item-id');
    expect(resultado.fotosAvulsas).toHaveLength(0);
  });

  it('vincula foto de avaliação sem mapa mas na mesma data da execução do procedimento do plano', () => {
    const planos = [
      {
        id: 'plano-biopsia-1',
        status: 'ativo',
        itens: [{ id: 'item-1', planejamentoItemId: 'item-1' }],
      },
    ];

    const procedimentosFeitos = [
      {
        id: 'pf-1',
        planejamentoItemId: 'item-1',
        criadoEm: '2026-10-13T10:00:00Z',
      },
    ];

    const fotosBrutas = [
      {
        id: 'foto-aval-mesma-data',
        categoria: 'avaliacao',
        dataReferencia: '2026-10-13',
      },
    ];

    const resultado = resolverFotosEPlanos(planos, fotosBrutas, procedimentosFeitos);
    expect(resultado.fotosPorPlanoId['plano-biopsia-1']).toHaveLength(1);
    expect(resultado.fotosPorPlanoId['plano-biopsia-1'][0].id).toBe('foto-aval-mesma-data');
    expect(resultado.fotosAvulsas).toHaveLength(0);
  });

  it('vincula foto de avaliação que compartilha agendaId com procedimento realizado do plano mesmo sem agenda pré-mapeada', () => {
    const planos = [
      {
        id: 'plano-harmonizacao',
        status: 'ativo',
        itens: [{ id: 'item-h1', planejamentoItemId: 'item-h1' }],
      },
    ];

    const procedimentosFeitos = [
      {
        id: 'pf-exec-1',
        planejamentoItemId: 'item-h1',
        agendaId: 'agenda-sessao-atendimento-123',
        criadoEm: '2026-10-13T14:00:00Z',
      },
    ];

    const fotosBrutas = [
      {
        id: 'foto-avaliacao-sessao',
        categoria: 'avaliacao',
        agendaId: 'agenda-sessao-atendimento-123',
        dataReferencia: '2026-10-13',
      },
    ];

    const resultado = resolverFotosEPlanos(planos, fotosBrutas, procedimentosFeitos);
    expect(resultado.fotosPorPlanoId['plano-harmonizacao']).toHaveLength(1);
    expect(resultado.fotosPorPlanoId['plano-harmonizacao'][0].id).toBe('foto-avaliacao-sessao');
    expect(resultado.fotosAvulsas).toHaveLength(0);
  });

  it('preserva o isolamento estrito: foto de avaliação sem vínculo não é sequestrada pelo único plano ativo', () => {
    const planos = [
      {
        id: 'plano-antigo-concluido',
        status: 'concluido',
        itens: [{ id: 'item-antigo', planejamentoItemId: 'item-antigo' }],
      },
      {
        id: 'plano-vigente-ativo',
        status: 'ativo',
        itens: [{ id: 'item-vigente', planejamentoItemId: 'item-vigente' }],
      },
    ];

    const fotosBrutas = [
      {
        id: 'foto-aval-clinica',
        categoria: 'avaliacao',
        dataReferencia: '2026-10-13',
      },
    ];

    const resultado = resolverFotosEPlanos(planos, fotosBrutas, []);
    expect(resultado.fotosPorPlanoId['plano-vigente-ativo']).toBeUndefined();
    expect(resultado.fotosAvulsas).toHaveLength(1);
    expect(resultado.fotosAvulsas[0].id).toBe('foto-aval-clinica');
  });
});

