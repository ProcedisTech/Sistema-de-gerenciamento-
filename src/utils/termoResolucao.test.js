import { describe, expect, it } from 'vitest';
import {
  abortarEncerrarPorTermos,
  bloqueioExecucaoTermos,
  catalogoIdsDoAtendimento,
  consentimentosAguardandoExecucao,
  deveCriarProcedimentoNoEncerrar,
  idsFilaExigida,
  isAssinaturaResolvida,
  parseTermosBloqueioError,
  pfIdNestaSessaoParaCatalogo,
  procedimentoBloqueadoPorTermos,
  sessaoComPfDoCatalogo,
  temFaltantes,
  titulosFaltantes,
  detalharTermosFaltantes,
  procedimentosSemTermoExigido,
  statusTermoPorProcedimento,
} from './termoResolucao.js';

describe('termoResolucao — consome o endpoint, não a natureza', () => {
  it('só inclui IDs devolvidos em faltantes, ignorando natureza PROCEDIMENTO sem vínculo', () => {
    const resolucao = {
      termosExigidos: [
        { termoId: 'termo-um', titulo: 'Termo de um', status: 'AUSENTE', vigente: false },
      ],
      faltantes: [{ termoId: 'termo-um', titulo: 'Termo de um' }],
    };
    const todosOsTermos = [
      { id: 'termo-um', naturezaCodigo: 'PROCEDIMENTO' },
      { id: 'termo-drenagem', naturezaCodigo: 'PROCEDIMENTO' },
      { id: 'lgpd', naturezaCodigo: 'INSTITUCIONAL' },
    ];
    const ids = idsFilaExigida(resolucao);
    expect(ids).toEqual(['termo-um']);
    expect(ids).not.toContain('termo-drenagem');
    expect(ids).not.toContain('lgpd');
    expect(todosOsTermos.filter((t) => t.naturezaCodigo === 'PROCEDIMENTO').map((t) => t.id))
      .toHaveLength(2);
  });

  it('INSTITUCIONAL fora da fila mesmo se listado no catálogo da clínica', () => {
    const resolucao = { faltantes: [] };
    expect(idsFilaExigida(resolucao)).toEqual([]);
    expect(temFaltantes(resolucao)).toBe(false);
  });

  it('RECUSADO não resolve a assinatura', () => {
    expect(isAssinaturaResolvida({ statusCodigo: 'RECUSADO', vigente: true })).toBe(false);
    expect(isAssinaturaResolvida({ statusCodigo: 'ASSINADO', vigente: true })).toBe(true);
  });

  it('parseia 409 TERMOS_OBRIGATORIOS_PENDENTES', () => {
    const parsed = parseTermosBloqueioError({
      status: 409,
      body: {
        error: 'TERMOS_OBRIGATORIOS_PENDENTES',
        nomeProcedimento: 'Criolipólise',
        termosFaltantes: [{ termoId: 't1', titulo: 'Termo de um' }],
      },
    });
    expect(parsed.nomeProcedimento).toBe('Criolipólise');
    expect(parsed.faltantes).toHaveLength(1);
    expect(parsed.termosFaltantes).toBeUndefined();
    expect(parseTermosBloqueioError({ status: 400, body: {} })).toBeNull();
  });

  it('catalogoIdsDoAtendimento inclui o id após o patch único da sessão', () => {
    expect(
      catalogoIdsDoAtendimento({
        nomeProcedimentoCatalogoId: 'cat-botox',
        procedimentosSessao: [
          { nomeProcedimento: 'Botox', nomeProcedimentoCatalogoId: 'cat-botox' },
        ],
      })
    ).toEqual(['cat-botox']);
  });

  it('procedimentoBloqueadoPorTermos ignora se o modal está aberto', () => {
    const comFaltantes = {
      faltantes: [{ termoId: 't1', titulo: 'Termo de Botox' }],
    };
    expect(procedimentoBloqueadoPorTermos(comFaltantes)).toBe(true);
    expect(procedimentoBloqueadoPorTermos({ faltantes: [] })).toBe(false);
    expect(procedimentoBloqueadoPorTermos(null)).toBe(false);
    const modalOpen = true;
    expect(procedimentoBloqueadoPorTermos(comFaltantes)).toBe(true);
    expect(modalOpen).toBe(true);
  });

  it('titulosFaltantes lista os títulos da resolução', () => {
    expect(
      titulosFaltantes({
        faltantes: [{ termoId: 't1', titulo: 'Termo de Botox' }, { termoId: 't2' }],
      })
    ).toEqual(['Termo de Botox']);
  });

  it('catalogoIdsDoAtendimento inclui o catálogo do pai no retorno', () => {
    expect(
      catalogoIdsDoAtendimento({
        nomeProcedimentoCatalogoId: null,
        catalogoOrigemId: 'cat-pai',
        procedimentosSessao: [],
      })
    ).toEqual(['cat-pai']);
  });

  it('consentimentosAguardandoExecucao lista crédito vigente com procedimentos mesmo quando existem faltantes', () => {
    expect(
      consentimentosAguardandoExecucao({
        termosExigidos: [
          {
            termoId: 't1',
            titulo: 'Termo de Botox',
            vigente: true,
            assinaturaId: 'a1',
            assinadoEm: '2026-08-19T08:17:00Z',
            catalogos: [{ id: 'c1', nome: 'Toxina Botulínica' }],
          },
        ],
        faltantes: [{ termoId: 't2', titulo: 'Termo Sutura' }],
      })
    ).toEqual([
      {
        termoId: 't1',
        titulo: 'Termo de Botox',
        assinadoEm: '2026-08-19T08:17:00Z',
        procedimentos: ['Toxina Botulínica'],
      },
    ]);
    expect(
      consentimentosAguardandoExecucao({
        termosExigidos: [{ termoId: 't1', titulo: 'X', vigente: false, assinaturaId: null }],
        faltantes: [{ termoId: 't1', titulo: 'X' }],
      })
    ).toEqual([]);
  });

  it('abortarEncerrarPorTermos: ato clínico aborta; Encerrar administrativo não', () => {
    expect(abortarEncerrarPorTermos({ bloqueadoPorTermos: true })).toBe(true);
    expect(abortarEncerrarPorTermos({ bloqueadoPorTermos: true, isApenasSair: true })).toBe(false);
    expect(abortarEncerrarPorTermos({ bloqueadoPorTermos: true, pularGateTermos: true })).toBe(false);
    expect(abortarEncerrarPorTermos({ bloqueadoPorTermos: false })).toBe(false);
  });

  it('deveCriarProcedimentoNoEncerrar é falso quando o termo falta', () => {
    expect(deveCriarProcedimentoNoEncerrar(true)).toBe(false);
    expect(deveCriarProcedimentoNoEncerrar(false)).toBe(true);
  });
});

describe('termoResolucao — PF desta sessão por catálogo (T1)', () => {
  const sessao = [
    { catalogoProcedimentoSaudeId: 'cat-a', id: 'pf-a' },
    { nomeProcedimentoCatalogoId: 'cat-b' },
  ];
  const faltantesB = { faltantes: [{ termoId: 't-b', titulo: 'Termo B' }] };

  it('dois procedimentos: PF do primeiro não libera o segundo', () => {
    expect(pfIdNestaSessaoParaCatalogo('cat-a', sessao)).toBe('pf-a');
    expect(pfIdNestaSessaoParaCatalogo('cat-b', sessao)).toBeNull();
    expect(bloqueioExecucaoTermos({ resolucao: faltantesB, pfIdNestaSessao: pfIdNestaSessaoParaCatalogo('cat-a', sessao) })).toBe(false);
    expect(bloqueioExecucaoTermos({ resolucao: faltantesB, pfIdNestaSessao: pfIdNestaSessaoParaCatalogo('cat-b', sessao) })).toBe(true);
  });

  it('linha com id e sem catálogo não libera ninguém', () => {
    expect(pfIdNestaSessaoParaCatalogo('cat-a', [{ id: 'pf-x' }])).toBeNull();
    expect(bloqueioExecucaoTermos({ resolucao: faltantesB, pfIdNestaSessao: null })).toBe(true);
  });

  it('não usa posição de lote: PF em outro índice só conta com catálogo na mesma linha', () => {
    const misturado = [
      { catalogoProcedimentoSaudeId: 'cat-a', id: 'pf-a' },
      { catalogoProcedimentoSaudeId: 'cat-b', id: 'pf-b' },
    ];
    expect(pfIdNestaSessaoParaCatalogo('cat-b', misturado)).toBe('pf-b');
    expect(pfIdNestaSessaoParaCatalogo('cat-a', misturado)).toBe('pf-a');
  });

  it('sessaoComPfDoCatalogo grava id e catálogo na mesma linha', () => {
    const next = sessaoComPfDoCatalogo(
      [{ catalogoProcedimentoSaudeId: 'cat-a' }, { catalogoProcedimentoSaudeId: 'cat-b' }],
      'cat-b',
      'pf-b',
      0,
    );
    expect(pfIdNestaSessaoParaCatalogo('cat-a', next)).toBeNull();
    expect(pfIdNestaSessaoParaCatalogo('cat-b', next)).toBe('pf-b');
    expect(next[1].nomeProcedimentoCatalogoId).toBe('cat-b');
  });

  it('linha com id idêntico ao catálogo não é tratada como PF persistido', () => {
    const rascunho = [{ catalogoProcedimentoSaudeId: 'cat-a', id: 'cat-a' }];
    expect(pfIdNestaSessaoParaCatalogo('cat-a', rascunho)).toBeNull();
  });

  it('detalharTermosFaltantes mapeia os procedimentos de cada termo exigido', () => {
    const resolucao = {
      termosExigidos: [
        {
          termoId: 't1',
          titulo: 'Termo de Lesão',
          catalogos: [{ catalogoId: 'cat-lesao', nome: 'Exérese de Lesão Cutânea Benigna' }],
        },
        {
          termoId: 't2',
          titulo: 'Termo Geral',
          catalogos: [],
        },
      ],
      faltantes: [
        { termoId: 't1', titulo: 'Termo de Lesão' },
        { termoId: 't2', titulo: 'Termo Geral' },
      ],
    };
    const detalhado = detalharTermosFaltantes(resolucao);
    expect(detalhado).toEqual([
      {
        termoId: 't1',
        titulo: 'Termo de Lesão',
        procedimentos: ['Exérese de Lesão Cutânea Benigna'],
      },
      {
        termoId: 't2',
        titulo: 'Termo Geral',
        procedimentos: [],
      },
    ]);
  });

  it('procedimentosSemTermoExigido retorna procedimentos do campo procedimentosSemVinculo do DTO', () => {
    const resolucao = {
      procedimentosSemVinculo: [
        { catalogoId: 'cat-infiltracao', nome: 'Infiltração Intralesional (Corticoide)' },
      ],
    };
    const semTermo = procedimentosSemTermoExigido(resolucao);
    expect(semTermo).toEqual([
      { catalogoId: 'cat-infiltracao', nome: 'Infiltração Intralesional (Corticoide)' },
    ]);
  });

  it('statusTermoPorProcedimento identifica corretamente procedimentos pendentes, assinados e dispensados', () => {
    const resolucao = {
      termosExigidos: [
        {
          termoId: 't-drenagem',
          titulo: 'DRENAGEM',
          catalogos: [{ catalogoId: 'cat-drenagem', nome: 'Drenagem de Abscesso' }],
          vigente: false,
        },
        {
          termoId: 't-botox',
          titulo: 'BOTOX',
          catalogos: [{ catalogoId: 'cat-botox', nome: 'Aplicação de Botox' }],
          assinaturaId: 'ass-123',
          vigente: true,
        },
      ],
      faltantes: [
        { termoId: 't-drenagem', titulo: 'DRENAGEM' },
      ],
      procedimentosSemVinculo: [
        { catalogoId: 'cat-infiltracao', nome: 'Infiltração Intralesional (Corticoide)' },
      ],
    };

    // Drenagem está em faltantes
    const statusDrenagem = statusTermoPorProcedimento('cat-drenagem', resolucao);
    expect(statusDrenagem.status).toBe('pendente');
    expect(statusDrenagem.titulo).toBe('DRENAGEM');

    // Botox está vigente
    const statusBotox = statusTermoPorProcedimento('cat-botox', resolucao);
    expect(statusBotox.status).toBe('assinado');

    // Infiltração está em procedimentosSemVinculo
    const statusInfiltracao = statusTermoPorProcedimento('cat-infiltracao', resolucao);
    expect(statusInfiltracao.status).toBe('dispensado');
    expect(statusInfiltracao.rotulo).toContain('Dispensado');

    // Procedimento sem vínculo cai em dispensado
    const statusOutro = statusTermoPorProcedimento('cat-qualquer', resolucao);
    expect(statusOutro.status).toBe('dispensado');
  });
});

