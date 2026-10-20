// Regressão prevenida:
// Em atendimentos avulsos com avaliação, procedimento e fotos (ex: 4 fotos: mapa de avaliação,
// mapa de procedimento, foto antes e foto depois), todas as 4 fotos DEVEM ser agrupadas em um ÚNICO card
// de atendimento avulso via atendimentoId, sem gerar cards órfãos como 'Consulta / Avaliação Clínica (1 foto)'.

import { describe, it, expect } from 'vitest';
import { resolverFotosEPlanos } from './planoGaleriaResolver.js';

describe('Regressão Zero — Unificação Atômica de Fotos em Atendimento Avulso', () => {
  const atendimentoIdSessao = 'atend-avulso-4-fotos';

  const procedimentoFeitoSessao = {
    id: 'pf-100',
    atendimentoId: atendimentoIdSessao,
    procedimentoNome: 'Drenagem de Abscesso + Biópsia de Pele',
    planejamentoItemId: null,
    agendaId: null,
    criadoEm: '2026-10-18T14:00:00Z',
    profissionalNome: 'Dra. Beatriz',
  };

  const fotoMapaAvaliacao = {
    id: 'foto-1-mapa-avaliacao',
    atendimentoId: atendimentoIdSessao,
    procedimentoFeitoId: null,
    agendaId: null,
    tipoFotoCodigo: 'MAPA',
    legenda: '[avaliacao] Mapa de Avaliação Clínica',
    registradoEm: '2026-10-18T14:05:00Z',
  };

  const fotoAntes = {
    id: 'foto-2-antes',
    atendimentoId: atendimentoIdSessao,
    procedimentoFeitoId: 'pf-100',
    agendaId: null,
    tipoFotoCodigo: 'ANTES',
    legenda: '[antes] Drenagem de Abscesso',
    registradoEm: '2026-10-18T14:15:00Z',
  };

  const fotoMapaProcedimento = {
    id: 'foto-3-mapa-procedimento',
    atendimentoId: atendimentoIdSessao,
    procedimentoFeitoId: 'pf-100',
    agendaId: null,
    tipoFotoCodigo: 'MAPA',
    legenda: '[mapa] Vista Frontal',
    registradoEm: '2026-10-18T14:20:00Z',
  };

  const fotoDepois = {
    id: 'foto-4-depois',
    atendimentoId: atendimentoIdSessao,
    procedimentoFeitoId: 'pf-100',
    agendaId: null,
    tipoFotoCodigo: 'DEPOIS',
    legenda: '[depois] Pós-imediato',
    registradoEm: '2026-10-18T14:30:00Z',
  };

  it('agrupa todas as 4 fotos da consulta no mesmo card de atendimento avulso via atendimentoId', () => {
    const planos = [];
    const procedimentosFeitos = [procedimentoFeitoSessao];
    const galeriaFotos = [fotoMapaAvaliacao, fotoAntes, fotoMapaProcedimento, fotoDepois];

    const { atendimentosAvulsos, fotosAvulsas } = resolverFotosEPlanos(
      planos,
      galeriaFotos,
      procedimentosFeitos,
      'America/Sao_Paulo'
    );

    // Deve existir EXATAMENTE 1 card de atendimento avulso
    expect(atendimentosAvulsos).toHaveLength(1);

    const card = atendimentosAvulsos[0];
    expect(card.nomeProcedimento).toBe('Drenagem de Abscesso + Biópsia de Pele');
    expect(card.fotos).toHaveLength(4);

    const idsDasFotosNoCard = card.fotos.map((f) => f.id);
    expect(idsDasFotosNoCard).toContain('foto-1-mapa-avaliacao');
    expect(idsDasFotosNoCard).toContain('foto-2-antes');
    expect(idsDasFotosNoCard).toContain('foto-3-mapa-procedimento');
    expect(idsDasFotosNoCard).toContain('foto-4-depois');

    // A lista geral de fotos fora de plano tem as 4 fotos, e atendimentosAvulsos unifica todas em 1 único card
    expect(fotosAvulsas).toHaveLength(4);
  });

  it('quando a consulta cria slot na agenda (agendaId), o casamento por atendimentoId ainda unifica a foto de avaliação sem agendaId', () => {
    const procComAgenda = {
      ...procedimentoFeitoSessao,
      agendaId: 'agenda-avulsa-999',
    };

    // A foto de avaliação foi enviada durante a sessão antes do encerramento (agendaId ainda era null)
    const fotos = [fotoMapaAvaliacao, fotoAntes, fotoMapaProcedimento, fotoDepois];

    const { atendimentosAvulsos } = resolverFotosEPlanos(
      [],
      fotos,
      [procComAgenda],
      'America/Sao_Paulo'
    );

    expect(atendimentosAvulsos).toHaveLength(1);
    expect(atendimentosAvulsos[0].fotos).toHaveLength(4);
    expect(atendimentosAvulsos[0].fotos.map((f) => f.id)).toContain('foto-1-mapa-avaliacao');
  });

  it('consulta pura de avaliação (sem procedimentosFeitos) cria o card de Consulta / Avaliação Clínica com suas fotos', () => {
    const fotos = [fotoMapaAvaliacao];

    const { atendimentosAvulsos } = resolverFotosEPlanos(
      [],
      fotos,
      [],
      'America/Sao_Paulo'
    );

    expect(atendimentosAvulsos).toHaveLength(1);
    expect(atendimentosAvulsos[0].isAvaliacao).toBe(true);
    expect(atendimentosAvulsos[0].fotos).toHaveLength(1);
    expect(atendimentosAvulsos[0].fotos[0].id).toBe('foto-1-mapa-avaliacao');
  });
});
