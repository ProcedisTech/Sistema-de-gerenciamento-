import { describe, it, expect } from 'vitest';
import {
  normalizarProcedimento,
  normalizarListaProcedimentos,
} from './MapeamentoFullscreenOverlay.jsx';
import { getCorLivreParaProcedimento, MAPEAMENTO_PALETA_CORES } from '../../../constants/mapeamentoPaletaCores.js';

describe('Normalização e Anti-colisão de Procedimentos no Mapeamento Facial', () => {
  it('normaliza procedimento vindo do DTO com catalogoNome e catalogoProcedimentoSaudeId', () => {
    const rawDto = {
      id: 'map-proc-uuid-1',
      catalogoProcedimentoSaudeId: 'cat-uuid-botox',
      catalogoNome: 'Toxina Botulínica',
      corHex: '#3b82f6',
    };

    const norm = normalizarProcedimento(rawDto);
    expect(norm.id).toBe('cat-uuid-botox');
    expect(norm.catalogoProcedimentoSaudeId).toBe('cat-uuid-botox');
    expect(norm.nome).toBe('Toxina Botulínica');
    expect(norm.corHex).toBe('#3b82f6');
  });

  it('normaliza procedimento vindo de item de plano sem nome explícito usando catalogoId', () => {
    const rawPlanoItem = {
      id: 'item-plano-uuid',
      catalogoProcedimentoSaudeId: 'cat-uuid-preenchimento',
      procedimentoNome: 'Preenchimento Labial',
    };

    const norm = normalizarProcedimento(rawPlanoItem);
    expect(norm.id).toBe('cat-uuid-preenchimento');
    expect(norm.nome).toBe('Preenchimento Labial');
    expect(norm.corHex).toBeTruthy();
  });

  it('reidrata nome real a partir do catMap com nomeProcedimento quando nome original é genérico', () => {
    const catMap = new Map([
      ['cat-biopsia-id', { id: 'cat-biopsia-id', nomeProcedimento: 'Biópsia de Pele' }],
      ['cat-drenagem-id', { id: 'cat-drenagem-id', nomeProcedimento: 'Drenagem de Abscesso' }],
    ]);

    const procGenerico = {
      id: 'cat-biopsia-id',
      nome: 'Procedimento',
    };

    const norm = normalizarProcedimento(procGenerico, catMap);
    expect(norm.nome).toBe('Biópsia de Pele');
    expect(norm.catalogoNome).toBe('Biópsia de Pele');
  });

  it('normalizarListaProcedimentos filtra nulos e retorna lista vazia para valores indefinidos', () => {
    expect(normalizarListaProcedimentos(null)).toEqual([]);
    expect(normalizarListaProcedimentos(undefined)).toEqual([]);
    expect(normalizarListaProcedimentos([])).toEqual([]);

    const procs = [
      { id: '1', nome: 'P1' },
      null,
      { id: '2', catalogoNome: 'P2' },
    ];
    const res = normalizarListaProcedimentos(procs);
    expect(res).toHaveLength(2);
    expect(res[0].nome).toBe('P1');
    expect(res[1].nome).toBe('P2');
  });

  it('garante anti-colisão de cores ao adicionar procedimentos subsequentes', () => {
    const cor1 = MAPEAMENTO_PALETA_CORES[0];
    const coresOcupadas = new Set([cor1.toLowerCase()]);

    const novaCor = getCorLivreParaProcedimento('qualquer-cat-id', coresOcupadas);
    expect(coresOcupadas.has(novaCor.toLowerCase())).toBe(false);
  });
});
