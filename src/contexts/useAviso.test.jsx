import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAviso } from './useAviso.js';
import { criarAvisosFalsos } from '../test/avisosFalsos.jsx';
import { AVISO } from '../services/avisos/tiposAviso.js';

describe('useAviso', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function montar(prefixo, opts) {
    const canal = criarAvisosFalsos();
    const handler = vi.fn();
    const utils = renderHook(() => useAviso(prefixo, handler, opts), { wrapper: canal.Wrapper });
    return { ...utils, canal, handler };
  }

  it('aviso com registroId nulo dispara inscrito filtrado por registroId', () => {
    const { canal, handler } = montar('ANAMNESE', { registroId: 'env1' });
    canal.emitirAviso(AVISO.ANAMNESE.ENVIO_ALTERADO, null);
    vi.advanceTimersByTime(300);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('registroId diferente não dispara; igual dispara', () => {
    const { canal, handler } = montar('ANAMNESE', { registroId: 'env1' });
    canal.emitirAviso(AVISO.ANAMNESE.ENVIO_ALTERADO, 'env2');
    vi.advanceTimersByTime(1000);
    expect(handler).not.toHaveBeenCalled();
    canal.emitirAviso(AVISO.ANAMNESE.ENVIO_ALTERADO, 'env1');
    vi.advanceTimersByTime(300);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('inscrito sem filtro recebe qualquer registro do prefixo e ignora outros prefixos', () => {
    const { canal, handler } = montar('AGENDA');
    canal.emitirAviso(AVISO.ANAMNESE.ENVIO_ALTERADO, 'x');
    vi.advanceTimersByTime(1000);
    expect(handler).not.toHaveBeenCalled();
    canal.emitirAviso(AVISO.AGENDA.CRIADO, 'ag-1');
    vi.advanceTimersByTime(300);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('recarregar dispara todos os inscritos', () => {
    const { canal, handler } = montar('TERMOS', { registroId: 's1' });
    canal.emitirRecarregar();
    vi.advanceTimersByTime(300);
    expect(handler).toHaveBeenCalledWith({ tipo: 'recarregar' });
  });

  it('debounce padrão 300 ms junta a rajada', () => {
    const { canal, handler } = montar('AGENDA');
    for (let i = 0; i < 5; i += 1) {
      canal.emitirAviso(AVISO.AGENDA.ALTERADO, `ag-${i}`);
      vi.advanceTimersByTime(50);
    }
    expect(handler).not.toHaveBeenCalled();
    vi.advanceTimersByTime(249);
    expect(handler).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('desmontar limpa o timer', () => {
    const { canal, handler, unmount } = montar('AGENDA');
    canal.emitirAviso(AVISO.AGENDA.CRIADO, 'ag-1');
    unmount();
    vi.advanceTimersByTime(1000);
    expect(handler).not.toHaveBeenCalled();
    expect(canal.inscritos.size).toBe(0);
  });

  it('fora do provider é no-op', () => {
    const handler = vi.fn();
    expect(() => renderHook(() => useAviso('AGENDA', handler))).not.toThrow();
  });
});
