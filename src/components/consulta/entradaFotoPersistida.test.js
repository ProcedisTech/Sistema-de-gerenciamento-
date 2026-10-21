// Regressão prevenida: Ao persistir foto de avaliação na galeria, o updater não pode
// espalhar closure desatualizada de currentPh nem sobrescrever pontos/mapaOverlay vivos
// com undefined ou vetores desatualizados (Anti-Stale-Closure e Anti-Undefined-Overwrite).

import { describe, it, expect } from 'vitest';
import { montarEntradaFotoPersistida } from './entradaFotoPersistida.js';

describe('montarEntradaFotoPersistida — Preservação de Estado Vivo e Sanitização de Chaves', () => {
  it('monta entrada com uploaded, id e fotoId sem chaves undefined', () => {
    const res = { id: 'foto-remota-123' };
    const opts = {};
    const metaAtual = { vista: 'frontal' };

    const entrada = montarEntradaFotoPersistida({ res, opts, metaAtual });

    expect(entrada.uploaded).toBe(true);
    expect(entrada.id).toBe('foto-remota-123');
    expect(entrada.fotoId).toBe('foto-remota-123');
    expect(entrada.meta).toEqual({ vista: 'frontal', fotoId: 'foto-remota-123' });

    // Garante que chaves opcionais não definidas em opts NÃO existam como undefined
    expect(entrada).not.toHaveProperty('destinoAvaliacao');
    expect(entrada).not.toHaveProperty('planejamentoId');
    expect(entrada).not.toHaveProperty('planejamentoItemId');
    expect(entrada).not.toHaveProperty('pontos');
    expect(entrada).not.toHaveProperty('mapaOverlay');
  });

  it('inclui destinoAvaliacao e planejamentoId apenas quando presentes em opts', () => {
    const res = { id: 'foto-remota-456' };
    const opts = {
      destinoAvaliacao: 'plano',
      planejamentoId: 'plan-uuid-789',
      planejamentoItemId: 'item-uuid-101',
    };

    const entrada = montarEntradaFotoPersistida({ res, opts });

    expect(entrada.destinoAvaliacao).toBe('plano');
    expect(entrada.planejamentoId).toBe('plan-uuid-789');
    expect(entrada.planejamentoItemId).toBe('item-uuid-101');
  });

  it('preserva dados vetoriais vivos quando mesclado pelo padrão do hook useProcedureCamera', () => {
    // Simula a foto viva no hook que acabou de receber pontos e mapaOverlay com novas cores
    const oldFotoNoHook = {
      url: 'blob:clean-url',
      cleanUrl: 'blob:clean-url',
      blob: null,
      cleanBlob: null,
      pontos: [
        { id: 'pt-1', cor: '#f97316', corHex: '#f97316', catalogoProcedimentoSaudeId: 'cat-biopsia' },
      ],
      mapaOverlay: {
        pontos: [{ id: 'pt-1', cor: '#f97316' }],
        marcacoes: [{ id: 'pt-1', cor: '#f97316' }],
        procedimentos: [{ id: 'cat-biopsia', corHex: '#f97316' }],
      },
      procedimentosMapeados: [{ id: 'cat-biopsia', corHex: '#f97316' }],
      meta: { vista: 'frontal' },
      isAnnotated: true,
      destinoAvaliacao: 'plano',
    };

    const res = { id: 'foto-uuid-remoto' };
    const opts = { destinoAvaliacao: 'plano' };

    const entry = montarEntradaFotoPersistida({ res, opts, metaAtual: oldFotoNoHook.meta });

    // Simula a lógica de substituição do useProcedureCamera:
    const newSnapshot = {
      ...oldFotoNoHook,
      ...entry,
      pontos: entry.pontos || oldFotoNoHook.pontos || [],
      mapaOverlay: entry.mapaOverlay || oldFotoNoHook.mapaOverlay || null,
      procedimentosMapeados: entry.procedimentosMapeados || oldFotoNoHook.procedimentosMapeados || [],
    };

    // Assertar que os pontos e mapaOverlay com cor laranja NÃO foram perdidos
    expect(newSnapshot.uploaded).toBe(true);
    expect(newSnapshot.fotoId).toBe('foto-uuid-remoto');
    expect(newSnapshot.pontos).toHaveLength(1);
    expect(newSnapshot.pontos[0].corHex).toBe('#f97316');
    expect(newSnapshot.mapaOverlay.procedimentos[0].corHex).toBe('#f97316');
  });
});
