/**
 * useTermosConsulta: restaura o journeyState a partir de `termosDaConsulta` sem eco, e grava só se difere da base.
 */
import { useState } from 'react';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useTermosConsulta } from './useTermosConsulta.js';

const linha = (termoId, extras = {}) => ({
  termoId,
  ordem: 0,
  lido: false,
  lidoEm: null,
  escolhido: false,
  termoAssinaturaId: null,
  statusAssinatura: null,
  ...extras,
});

/** Um journeyState mínimo (os 3 valores e os 3 setters) e o hook, com `termosDaConsulta` vindo de fora. */
function montar({ termos = [], inicial = {} } = {}) {
  const salvar = vi.fn();
  const r = renderHook(
    ({ termosDaConsulta }) => {
      const [termoSelecionadoId, setTermoSelecionadoId] = useState(inicial.termoSelecionadoId ?? null);
      const [termoLido, setTermoLido] = useState(inicial.termoLido ?? false);
      const [termosPendentesIds, setTermosPendentesIds] = useState(inicial.termosPendentesIds ?? []);
      const journeyState = {
        termoSelecionadoId, setTermoSelecionadoId, termoLido, setTermoLido, termosPendentesIds, setTermosPendentesIds,
      };
      return { journeyState, ...useTermosConsulta({ termosDaConsulta, salvarTermosConsulta: salvar, journeyState }) };
    },
    { initialProps: { termosDaConsulta: termos } },
  );
  return { ...r, salvar };
}

describe('useTermosConsulta', () => {
  it('restaura no journeyState quando termosDaConsulta muda (outra aba), sem disparar PUT', () => {
    const { result, rerender, salvar } = montar();

    rerender({
      termosDaConsulta: [linha('t-1'), linha('t-2', { escolhido: true, lido: true })],
    });

    expect(result.current.journeyState.termoSelecionadoId).toBe('t-2');
    expect(result.current.journeyState.termoLido).toBe(true);
    expect(result.current.journeyState.termosPendentesIds).toEqual(['t-1', 't-2']);
    expect(salvar).not.toHaveBeenCalled();
  });

  it('não restaura o valor que o próprio gravarEstadoTermos acabou de gravar (sem eco)', () => {
    const { result, rerender, salvar } = montar({
      inicial: { termoSelecionadoId: 't-1', termoLido: false, termosPendentesIds: ['t-1'] },
    });

    act(() => {
      result.current.gravarEstadoTermos();
    });
    expect(salvar).toHaveBeenCalledTimes(1);

    // O usuário muda a tela depois do clique; a base otimista (igual ao que foi gravado) chega em seguida.
    act(() => {
      result.current.journeyState.setTermoLido(true);
    });
    rerender({ termosDaConsulta: [linha('t-1', { escolhido: true })] });

    expect(result.current.journeyState.termoLido).toBe(true);
    expect(result.current.journeyState.termosPendentesIds).toEqual(['t-1']);
  });

  it('gravarEstadoTermos chama o salvar só se o journeyState difere da base', () => {
    const { result, salvar } = montar({
      termos: [linha('t-1', { escolhido: true, lido: true })],
      inicial: { termoSelecionadoId: 't-1', termoLido: true, termosPendentesIds: ['t-1'] },
    });

    // Igual à base: nada (nem com o mesmo conjunto em outra ordem, nem com termoLido desmarcado).
    expect(result.current.gravarEstadoTermos()).toBe(false);
    expect(salvar).not.toHaveBeenCalled();

    act(() => {
      result.current.journeyState.setTermosPendentesIds(['t-1', 't-2']);
    });
    expect(result.current.gravarEstadoTermos()).toBe(true);
    expect(salvar).toHaveBeenCalledTimes(1);
    expect(salvar).toHaveBeenCalledWith({
      termoSelecionadoId: 't-1',
      termoLido: true,
      termosPendentesIds: ['t-1', 't-2'],
    });
  });

  it('marcar o termo como lido diferente da base grava; sem escolha e sem lista não grava', () => {
    const vazio = montar();
    expect(vazio.result.current.gravarEstadoTermos()).toBe(false);

    const { result, salvar } = montar({
      termos: [linha('t-1', { escolhido: true })],
      inicial: { termoSelecionadoId: 't-1', termoLido: true, termosPendentesIds: ['t-1'] },
    });
    expect(result.current.gravarEstadoTermos()).toBe(true);
    expect(salvar).toHaveBeenCalledWith({ termoSelecionadoId: 't-1', termoLido: true, termosPendentesIds: ['t-1'] });
  });
});
