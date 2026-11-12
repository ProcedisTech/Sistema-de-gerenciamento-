// Regressão prevenida:
// No Hub de Procedimentos, a seção "AVALIAÇÃO — APENAS REFERÊNCIA" NUNCA pode vazar fotos
// de consultas anteriores (atendimento avulso) e a foto da vista do mapa (MAPA) nunca entra na faixa.
// Testa a função real usada em AppRefactored.jsx (antes era uma cópia da regra).
//
// Mudanças de expectativa vs. versão anterior (cópia da regra):
// - D1: foto MAPA do atendimento atual deixou de entrar (foto de mapa nunca entra na faixa).
// - D5: cenário "foto do plano de outra consulta" saiu: a regra de plano não existe no código.

import { describe, it, expect } from 'vitest';
import { ehFotoReferenciaAvaliacao } from '../../utils/pacienteGaleria.js';

const filtrar = (itens, atendId) => itens.filter((f) => ehFotoReferenciaAvaliacao(f, atendId));

describe('Regressão Zero — Filtro Estrito de Fotos de Referência no Hub de Procedimentos', () => {
  const atual = 'atend-atual-123';

  const fotoHistoricaMapa = {
    id: 'f-hist-1',
    tipoFotoCodigo: 'MAPA',
    legenda: 'Mapa de Avaliação Anterior',
    atendimentoId: 'atend-antigo-999',
  };
  const fotoHistoricaAvaliacao = {
    id: 'f-hist-2',
    tipoFotoCodigo: 'AVALIACAO',
    legenda: 'Avaliação Antiga',
    atendimentoId: 'atend-antigo-888',
  };
  const fotoMapaSessaoAtual = {
    id: 'f-mapa-atual',
    tipoFotoCodigo: 'MAPA',
    legenda: 'Mapa de Avaliação Desta Sessão',
    atendimentoId: atual,
  };
  const fotoAvaliacaoAtual = {
    id: 'f-aval-atual',
    tipoFotoCodigo: 'AVALIACAO',
    legenda: 'Foto de avaliação desta sessão',
    atendimentoId: atual,
  };

  it('Cenário 1: sem fotos de avaliação na sessão atual retorna lista VAZIA (Zero Vazamento)', () => {
    expect(filtrar([fotoHistoricaMapa, fotoHistoricaAvaliacao], atual)).toEqual([]);
  });

  it('Cenário 2: só a foto de avaliação da sessão atual entra; MAPA da sessão (D1) e antigas ficam fora', () => {
    const r = filtrar([fotoHistoricaMapa, fotoHistoricaAvaliacao, fotoMapaSessaoAtual, fotoAvaliacaoAtual], atual);
    expect(r.map((f) => f.id)).toEqual(['f-aval-atual']);
  });

  it('PLANEJAMENTO e legenda com "avaliacao" (sem acento) do mesmo atendimento entram', () => {
    const plan = { id: 'p', tipoFotoCodigo: 'PLANEJAMENTO', atendimentoId: atual };
    const leg = { id: 'l', tipoFotoCodigo: 'OUTRA', legenda: 'avaliacao inicial', atendimentoId: atual };
    expect(filtrar([plan, leg], atual).map((f) => f.id)).toEqual(['p', 'l']);
  });

  it('atendimentoId atual ausente não retorna nada', () => {
    expect(filtrar([fotoAvaliacaoAtual], null)).toEqual([]);
  });

  it('MAPA do mesmo atendimento com tipoMapaCodigo procedimento fica fora', () => {
    const f = { ...fotoMapaSessaoAtual, mapaOverlay: { tipoMapaCodigo: 'procedimento' } };
    expect(filtrar([f], atual)).toEqual([]);
  });

  it('MAPA com "avaliação" na legenda fica fora', () => {
    const f = { id: 'm', tipoFotoCodigo: 'MAPA', legenda: 'Mapa de avaliação', atendimentoId: atual };
    expect(filtrar([f], atual)).toEqual([]);
  });

  it('AVALIACAO com tipoMapaCodigo procedimento fica fora', () => {
    const f = { ...fotoAvaliacaoAtual, mapaOverlay: { tipoMapaCodigo: 'procedimento' } };
    expect(filtrar([f], atual)).toEqual([]);
  });

  it('AVALIACAO com tipoMapaCodigo retorno fica fora', () => {
    const f = { ...fotoAvaliacaoAtual, mapaOverlay: { tipoMapaCodigo: 'retorno' } };
    expect(filtrar([f], atual)).toEqual([]);
  });

  it('AVALIACAO com mapa de avaliação entra e mantém mapaOverlay com os pontos', () => {
    const overlay = { tipoMapaCodigo: 'avaliacao', pontos: [{ x: 1, y: 2 }, { x: 3, y: 4 }] };
    const r = filtrar([{ ...fotoAvaliacaoAtual, mapaOverlay: overlay }], atual);
    expect(r).toHaveLength(1);
    expect(r[0].mapaOverlay).toBe(overlay);
    expect(r[0].mapaOverlay.pontos).toHaveLength(2);
  });

  it('AVALIACAO sem mapa entra', () => {
    expect(filtrar([fotoAvaliacaoAtual], atual)).toHaveLength(1);
  });

  it('AVALIACAO de outro atendimento fica fora', () => {
    expect(filtrar([{ ...fotoAvaliacaoAtual, atendimentoId: 'outro' }], atual)).toEqual([]);
  });
});
