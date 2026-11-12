/** Pop-up "Você ainda está aí?" (PresencaConsultaModal): relógio falso, sem rede. */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PresencaConsultaModal from '../../components/consulta/PresencaConsultaModal.jsx';
import { definirVisibilidade, prepararVisibilidade } from '../servidorAvisosFalso.js';

const T0 = new Date('2026-03-10T12:00:00.000Z').getTime();
const iso = (ms) => new Date(ms).toISOString();
const HORA = 3600 * 1000;
const linha = (id, extras = {}) => ({
  id, status: 'aberto', iniciadoEm: iso(T0 - 4 * HORA), presencaAte: iso(T0 + 5000), ...extras,
});
const TEXTO = /Você ainda está aí\?/;
const avancar = (ms) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

function montar(minhas, extras = {}) {
  const props = {
    minhas, confirmarPresenca: vi.fn().mockResolvedValue({}), reler: vi.fn().mockResolvedValue(undefined), onErro: vi.fn(), ...extras,
  };
  const r = render(<PresencaConsultaModal {...props} />);
  return { ...r, props, trocar: (m) => r.rerender(<PresencaConsultaModal {...props} minhas={m} />) };
}

describe('PresencaConsultaModal', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    prepararVisibilidade();
  });
  afterEach(() => { vi.useRealTimers(); });

  it('aparece no prazo e nao antes; so depois de reler concluir', async () => {
    let concluir;
    const reler = vi.fn(() => new Promise((r) => { concluir = r; }));
    montar([linha('c-1')], { reler });
    await avancar(4000);
    expect(screen.queryByText(TEXTO)).toBeNull();
    expect(reler).not.toHaveBeenCalled();
    await avancar(1000);
    expect(reler).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(TEXTO)).toBeNull();
    await act(async () => { concluir(); });
    expect(screen.getByText('Já faz 4 h de consulta. Você ainda está aí?')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sim, estou aqui' })).toBeTruthy();
  });

  it('"Sim" chama confirmarPresenca(id) e some quando o prazo novo chega por minhas', async () => {
    const m = montar([linha('c-1')]);
    await avancar(5000);
    fireEvent.click(screen.getByRole('button', { name: 'Sim, estou aqui' }));
    await avancar(0);
    expect(m.props.confirmarPresenca).toHaveBeenCalledWith('c-1');
    m.trocar([linha('c-1', { presencaAte: iso(T0 + HORA + 5000) })]);
    await avancar(0);
    expect(screen.queryByText(TEXTO)).toBeNull();
  });

  it('outra aba ja disse "Sim": a releitura traz prazo novo e o pop-up nao aparece', async () => {
    let m;
    const reler = vi.fn(async () => { m.trocar([linha('c-1', { presencaAte: iso(T0 + HORA) })]); });
    m = montar([linha('c-1')], { reler });
    await avancar(5000);
    expect(reler).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(TEXTO)).toBeNull();
  });

  it('pop-up aberto e minhas muda em outra aba: fecha', async () => {
    const m = montar([linha('c-1')]);
    await avancar(5000);
    expect(screen.getByText(TEXTO)).toBeTruthy();
    m.trocar([linha('c-1', { presencaAte: iso(T0 + 2 * HORA) })]);
    await avancar(0);
    expect(screen.queryByText(TEXTO)).toBeNull();
    m.trocar([]);
    await avancar(0);
    expect(screen.queryByText(TEXTO)).toBeNull();
  });

  it('prazo novo do mesmo id que vence de novo: nova chave, relê de novo e so mostra depois', async () => {
    let concluir;
    const reler = vi.fn().mockResolvedValueOnce(undefined).mockImplementationOnce(() => new Promise((r) => { concluir = r; }));
    const m = montar([linha('c-1')], { reler });
    await avancar(5000);
    expect(screen.getByText(TEXTO)).toBeTruthy();
    m.trocar([linha('c-1', { presencaAte: iso(T0 + 5000 + 10000) })]);
    await avancar(0);
    expect(screen.queryByText(TEXTO)).toBeNull();
    await avancar(10000);
    expect(reler).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(TEXTO)).toBeNull();
    await act(async () => { concluir(); });
    expect(screen.getByText(TEXTO)).toBeTruthy();
  });

  it('mesma chave que some e volta (resposta velha): nao relê de novo', async () => {
    const m = montar([linha('c-1')]);
    await avancar(5000);
    expect(m.props.reler).toHaveBeenCalledTimes(1);
    m.trocar([linha('c-1', { presencaAte: iso(T0 + HORA) })]);
    await avancar(0);
    m.trocar([linha('c-1')]);
    await avancar(0);
    expect(m.props.reler).toHaveBeenCalledTimes(1);
  });

  it('voltar a aba visivel rele', async () => {
    const m = montar([linha('c-1', { presencaAte: iso(T0 + HORA) })]);
    await avancar(0);
    definirVisibilidade('hidden');
    expect(m.props.reler).not.toHaveBeenCalled();
    definirVisibilidade('visible');
    expect(m.props.reler).toHaveBeenCalledTimes(1);
  });

  it('sem laco: uma releitura por chave, mais so a de 1 min com o pop-up aberto', async () => {
    const m = montar([linha('c-1')]);
    await avancar(5000);
    expect(m.props.reler).toHaveBeenCalledTimes(1);
    await avancar(59000);
    expect(m.props.reler).toHaveBeenCalledTimes(1);
    await avancar(1000);
    expect(m.props.reler).toHaveBeenCalledTimes(2);
    m.trocar([linha('c-1')]); // resposta igual: mesma chave
    await avancar(1000);
    expect(m.props.reler).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['sem presencaAte', { presencaAte: null }],
    ['status abandonado', { status: 'abandonado' }],
    ['status encerrado', { status: 'encerrado' }],
  ])('linha %s nunca aparece', async (_n, extras) => {
    const m = montar([linha('c-1', extras)]);
    await avancar(10 * 60 * 1000);
    expect(screen.queryByText(TEXTO)).toBeNull();
    expect(m.props.reler).not.toHaveBeenCalled();
  });

  it('duas vencidas: uma por vez', async () => {
    const m = montar([linha('c-1'), linha('c-2', { iniciadoEm: iso(T0 - 6 * HORA) })]);
    await avancar(5000);
    expect(screen.getAllByText(TEXTO)).toHaveLength(1);
    expect(screen.getByText('Já faz 4 h de consulta. Você ainda está aí?')).toBeTruthy();
    m.trocar([linha('c-1', { presencaAte: iso(T0 + HORA) }), linha('c-2', { iniciadoEm: iso(T0 - 6 * HORA) })]);
    await avancar(0);
    await avancar(0);
    expect(screen.getAllByText(TEXTO)).toHaveLength(1);
    expect(screen.getByText('Já faz 6 h de consulta. Você ainda está aí?')).toBeTruthy();
  });

  it('N h e a parte inteira das horas desde iniciadoEm', async () => {
    montar([linha('c-1', { iniciadoEm: iso(T0 - 3.9 * HORA) })]);
    await avancar(5000);
    expect(screen.getByText('Já faz 3 h de consulta. Você ainda está aí?')).toBeTruthy();
  });

  it('erro de rede: fica e chama onErro', async () => {
    const m = montar([linha('c-1')], { confirmarPresenca: vi.fn().mockRejectedValue(Object.assign(new Error('x'), { status: 503 })) });
    await avancar(5000);
    fireEvent.click(screen.getByRole('button', { name: 'Sim, estou aqui' }));
    await avancar(0);
    expect(m.props.onErro).toHaveBeenCalledWith('Não foi possível confirmar. Tente de novo.');
    expect(screen.getByText(TEXTO)).toBeTruthy();
  });

  it('erro 409: chama reler e nao chama onErro', async () => {
    const m = montar([linha('c-1')], { confirmarPresenca: vi.fn().mockRejectedValue(Object.assign(new Error('x'), { status: 409 })) });
    await avancar(5000);
    const antes = m.props.reler.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Sim, estou aqui' }));
    await avancar(0);
    expect(m.props.reler.mock.calls.length).toBe(antes + 1);
    expect(m.props.onErro).not.toHaveBeenCalled();
  });

  it('digitar nao fecha nem adia', async () => {
    const m = montar([linha('c-1')]);
    await avancar(5000);
    fireEvent.keyDown(document, { key: 'a' });
    fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });
    fireEvent.keyUp(document, { key: 'b' });
    fireEvent.keyPress(document, { key: 'b', charCode: 98 });
    await avancar(0);
    expect(screen.getByText(TEXTO)).toBeTruthy();
    expect(m.props.confirmarPresenca).not.toHaveBeenCalled();
  });
});
