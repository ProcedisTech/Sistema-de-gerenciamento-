// Toque no mapa: com canMark o container não deve virar pan do TransformWrapper, e um
// segundo dedo durante o traço descarta o traço (pinça/zoom não pode gravar risco).
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FotoVistaCanvas } from './FotoVistaCanvas.jsx';

const wrapperProps = vi.hoisted(() => ({ last: null }));

vi.mock('react-zoom-pan-pinch', () => ({
  TransformWrapper: (props) => {
    wrapperProps.last = props;
    return props.children({ state: {} });
  },
  TransformComponent: ({ children }) => <div>{children}</div>,
}));

vi.mock('../../ui/ProtectedPatientMedia.jsx', () => ({
  ProtectedPatientMedia: React.forwardRef((props, ref) => (
    <img ref={ref} alt="paciente" src={props.src} width={100} height={100} />
  )),
}));

vi.mock('./PontoQuantidadeModal.jsx', () => ({
  default: ({ open }) => <div data-testid="dose" data-open={String(Boolean(open))} />,
  PontoQuantidadeModal: ({ open }) => <div data-testid="dose" data-open={String(Boolean(open))} />,
}));
vi.mock('./MapaMarcacoesOverlay.jsx', () => ({ MapaMarcacoesOverlay: () => null }));
vi.mock('./TracadoEmProgresso.jsx', () => ({
  TracadoEmProgresso: ({ vertices }) => <div data-testid="ao-vivo" data-n={vertices.length} />,
}));

const base = {
  vistaAtual: 'frontal',
  foto: { displayUrl: 'https://exemplo.com/foto.jpg' },
  displayUrl: 'https://exemplo.com/foto.jpg',
  procedimentoArmado: { id: 'cat-1', nome: 'Fio' },
  externalModo: 'traco',
  readOnly: false,
  configMarcacao: { confirmarDose: false },
};

function montar(props = {}) {
  const onAddPonto = vi.fn();
  const r = render(<FotoVistaCanvas {...base} onAddPonto={onAddPonto} {...props} />);
  return { ...r, onAddPonto, area: r.container.querySelector('.touch-none') };
}

const ev = (x, y, id) => ({ clientX: x, clientY: y, pointerId: id });

describe('FotoVistaCanvas - toque (pan x desenho)', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} unobserve() {} });
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100, x: 0, y: 0,
    });
    Element.prototype.setPointerCapture = vi.fn();
    Element.prototype.releasePointerCapture = vi.fn();
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('(a) com canMark: container tem mapa-area-desenho e o pan exclui essa classe', () => {
    const { area } = montar();
    expect(area.classList.contains('mapa-area-desenho')).toBe(true);
    expect(wrapperProps.last.panning.excluded).toEqual(['mapa-area-desenho']);
  });

  it('(b) sem canMark (leitura): sem a classe e excluded vazio', () => {
    const { area } = montar({ readOnly: true });
    expect(area.classList.contains('mapa-area-desenho')).toBe(false);
    expect(wrapperProps.last.panning.excluded).toEqual([]);
  });

  it('(c) dois dedos: o traço é descartado e onAddPonto não é chamado', async () => {
    const { area, getByTestId, onAddPonto } = montar();
    fireEvent.pointerDown(area, ev(10, 10, 1));
    await waitFor(() => expect(getByTestId('ao-vivo').getAttribute('data-n')).toBe('1')); // sinal positivo
    fireEvent.pointerMove(area, ev(40, 40, 1));
    await waitFor(() => expect(getByTestId('ao-vivo').getAttribute('data-n')).toBe('2'));
    fireEvent.pointerDown(area, ev(60, 60, 2));
    await waitFor(() => expect(getByTestId('ao-vivo').getAttribute('data-n')).toBe('0')); // descartou
    fireEvent.pointerMove(area, ev(70, 70, 1));
    fireEvent.pointerUp(area, ev(70, 70, 1));
    fireEvent.pointerUp(area, ev(60, 60, 2));
    await waitFor(() => expect(getByTestId('ao-vivo').getAttribute('data-n')).toBe('0'));
    expect(onAddPonto).not.toHaveBeenCalled();
  });

  it('(d) um dedo: o traço é salvo', async () => {
    const { area, getByTestId, onAddPonto } = montar();
    fireEvent.pointerDown(area, ev(10, 10, 1));
    fireEvent.pointerMove(area, ev(40, 40, 1));
    fireEvent.pointerMove(area, ev(80, 80, 1));
    await waitFor(() => expect(Number(getByTestId('ao-vivo').getAttribute('data-n'))).toBeGreaterThan(1));
    fireEvent.pointerUp(area, ev(80, 80, 1));
    await waitFor(() => expect(onAddPonto).toHaveBeenCalledTimes(1));
    expect(onAddPonto.mock.calls[0][1].tipoGeometria).toBe('traco');
  });

  it('(e) pointercancel descarta o traço sem salvar', async () => {
    const { area, getByTestId, onAddPonto } = montar();
    fireEvent.pointerDown(area, ev(10, 10, 1));
    fireEvent.pointerMove(area, ev(50, 50, 1));
    await waitFor(() => expect(getByTestId('ao-vivo').getAttribute('data-n')).toBe('2'));
    fireEvent.pointerCancel(area, ev(50, 50, 1));
    await waitFor(() => expect(getByTestId('ao-vivo').getAttribute('data-n')).toBe('0'));
    fireEvent.pointerUp(area, ev(50, 50, 1));
    expect(onAddPonto).not.toHaveBeenCalled();
  });

  describe('modo ponto: só grava ao soltar o dedo', () => {
    const ponto = { externalModo: 'ponto' };
    const doseAberta = (q) => q.getByTestId('dose').getAttribute('data-open');
    // sinal positivo: um 3º dedo limpo grava 1x, provando que os eventos anteriores foram processados
    const sinal = async (area, onAddPonto) => {
      fireEvent.pointerDown(area, ev(30, 30, 9));
      fireEvent.pointerUp(area, ev(30, 30, 9));
      await waitFor(() => expect(onAddPonto).toHaveBeenCalledTimes(1));
    };

    it('(f) dose desligada: down + up grava 1x com as coordenadas do down', async () => {
      const { area, onAddPonto } = montar(ponto);
      fireEvent.pointerDown(area, ev(20, 40, 1));
      expect(onAddPonto).not.toHaveBeenCalled(); // down sozinho não grava
      fireEvent.pointerUp(area, ev(70, 70, 1));
      await waitFor(() => expect(onAddPonto).toHaveBeenCalledTimes(1));
      const [vista, p] = onAddPonto.mock.calls[0];
      expect(vista).toBe('frontal');
      expect(p.tipoGeometria).toBe('ponto');
      expect(p.posX).toBeCloseTo(20, 0);
      expect(p.posY).toBeCloseTo(40, 0);
    });

    it('(g) dois dedos: nada grava e a janela da dose não abre', async () => {
      const q = montar(ponto);
      fireEvent.pointerDown(q.area, ev(10, 10, 1));
      fireEvent.pointerDown(q.area, ev(60, 60, 2));
      fireEvent.pointerUp(q.area, ev(10, 10, 1));
      fireEvent.pointerUp(q.area, ev(60, 60, 2));
      await sinal(q.area, q.onAddPonto); // positivo: só o 3º dedo gravou
      await waitFor(() => expect(q.onAddPonto).toHaveBeenCalledTimes(1));
      expect(q.onAddPonto.mock.calls[0][1].posX).toBeCloseTo(30, 0);
      await waitFor(() => expect(doseAberta(q)).toBe('false'));
    });

    it('(h) dose ligada: down + up abre a janela da dose', async () => {
      const q = montar({ ...ponto, configMarcacao: { confirmarDose: true } });
      expect(doseAberta(q)).toBe('false');
      fireEvent.pointerDown(q.area, ev(20, 40, 1));
      expect(doseAberta(q)).toBe('false');
      fireEvent.pointerUp(q.area, ev(20, 40, 1));
      await waitFor(() => expect(doseAberta(q)).toBe('true'));
      expect(q.onAddPonto).not.toHaveBeenCalled();
    });

    it('(i) cancel: nada gravado e sem janela', async () => {
      const q = montar(ponto);
      fireEvent.pointerDown(q.area, ev(10, 10, 1));
      fireEvent.pointerCancel(q.area, ev(10, 10, 1));
      fireEvent.pointerUp(q.area, ev(10, 10, 1));
      await sinal(q.area, q.onAddPonto);
      expect(q.onAddPonto.mock.calls[0][1].posX).toBeCloseTo(30, 0);
      await waitFor(() => expect(doseAberta(q)).toBe('false'));
    });
  });
});
