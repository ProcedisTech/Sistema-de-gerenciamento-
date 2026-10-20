// @vitest-environment jsdom
/**
 * Editor de anotação: carregamento da foto (local × servidor) e contrato de salvar
 * (`onAnnotatedCaptureSaved` devolve Promise de `{ estado: 'salva' | 'pendente' }` ou rejeita).
 */
import React, { useRef, useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
  toast: vi.fn(),
  dismiss: vi.fn(),
}));
const apiMock = vi.hoisted(() => ({ fetchArquivoBlob: vi.fn() }));

vi.mock('../../contexts/useToast.js', () => ({ useToast: () => toastMock }));
vi.mock('../../services/api.js', () => ({ pacientesGaleriaApi: apiMock }));

import { JourneyPhotoAnnotationEditor } from './JourneyPhotoAnnotationEditor.jsx';

/** `new Image()` falso: dispara onload (ou onerror) logo depois de receber `src`. */
const imagensCriadas = [];
class ImagemFalsa {
  constructor() {
    this.onload = null;
    this.onerror = null;
    this.complete = false;
    this.naturalWidth = 0;
    this.naturalHeight = 0;
    this._src = '';
    imagensCriadas.push(this);
  }
  set src(v) {
    this._src = v;
    setTimeout(() => {
      if (ImagemFalsa.falhar) {
        this.onerror?.(new Event('error'));
        return;
      }
      this.complete = true;
      this.naturalWidth = 100;
      this.naturalHeight = 80;
      this.onload?.(new Event('load'));
    }, 0);
  }
  get src() {
    return this._src;
  }
}
ImagemFalsa.falhar = false;

const TRACO = [{ tool: 'draw', points: [{ x: 1, y: 1 }, { x: 5, y: 5 }], color: '#ef4444', width: 3 }];

function Harness({ pathsIniciais = [], ...props }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [paths, setPaths] = useState(pathsIniciais);
  const [isDrawing, setIsDrawing] = useState(false);
  const [cursorPos, setCursorPos] = useState({ x: -100, y: -100 });
  const [isHoveringCanvas, setIsHoveringCanvas] = useState(false);
  const [activeTool, setActiveTool] = useState('draw');
  const [activeColor, setActiveColor] = useState('#ef4444');
  const [pointSize, setPointSize] = useState(8);
  const [showPointNumbers, setShowPointNumbers] = useState(false);
  const [eraserSize, setEraserSize] = useState(20);
  const [annUrl, setAnnUrl] = useState(null);
  return (
    <JourneyPhotoAnnotationEditor
      photos={[{ id: 'foto-1', url: props.imageSrc }]}
      editingIndex={0}
      setEditingIndex={() => {}}
      activeTool={activeTool}
      setActiveTool={setActiveTool}
      activeColor={activeColor}
      setActiveColor={setActiveColor}
      pointSize={pointSize}
      setPointSize={setPointSize}
      showPointNumbers={showPointNumbers}
      setShowPointNumbers={setShowPointNumbers}
      eraserSize={eraserSize}
      setEraserSize={setEraserSize}
      cursorPos={cursorPos}
      setCursorPos={setCursorPos}
      isHoveringCanvas={isHoveringCanvas}
      setIsHoveringCanvas={setIsHoveringCanvas}
      paths={paths}
      setPaths={setPaths}
      isDrawing={isDrawing}
      setIsDrawing={setIsDrawing}
      canvasRef={canvasRef}
      containerRef={containerRef}
      evaluationAnnotatedPhotoUrl={annUrl}
      setEvaluationAnnotatedPhotoUrl={setAnnUrl}
      {...props}
    />
  );
}

const botaoSalvar = () => screen.getByRole('button', { name: /Salvar anotação|Salvando/ });

function desenhar() {
  const canvas = document.querySelector('canvas');
  fireEvent.pointerDown(canvas, { clientX: 10, clientY: 10, pointerId: 1, button: 0 });
  fireEvent.pointerMove(canvas, { clientX: 20, clientY: 20, pointerId: 1, buttons: 1 });
  fireEvent.pointerUp(canvas, { clientX: 20, clientY: 20, pointerId: 1 });
}

beforeEach(() => {
  imagensCriadas.length = 0;
  ImagemFalsa.falhar = false;
  vi.stubGlobal('Image', ImagemFalsa);
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: true,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
  }));
  let n = 0;
  URL.createObjectURL = vi.fn(() => `blob:editor/${++n}`);
  URL.revokeObjectURL = vi.fn();
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null);
  HTMLCanvasElement.prototype.toBlob = function toBlobFalso(cb) {
    cb(new Blob(['jpeg'], { type: 'image/jpeg' }));
  };
  apiMock.fetchArquivoBlob.mockReset();
  Object.values(toastMock).forEach((f) => f.mockReset());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('JourneyPhotoAnnotationEditor — carregar a foto', () => {
  it('(a) URL do servidor com o fetch falhando: mostra o erro e o Salvar fica desabilitado', async () => {
    apiMock.fetchArquivoBlob.mockRejectedValue(new Error('[HTTP 500]'));
    render(
      <Harness
        imageSrc="https://cdn.exemplo/foto.jpg?X-Amz-Signature=abc"
        urlArquivoReserva={() => '/api/v1/pacientes/p1/galeria/foto-1/arquivo?v=123'}
        pathsIniciais={TRACO}
        onAnnotatedCaptureSaved={vi.fn()}
      />
    );
    expect(await screen.findByText('Não foi possível carregar a foto. Tente de novo.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument();
    expect(botaoSalvar()).toBeDisabled();
    // Carregou pela URL de reserva (GET /arquivo autenticado), não pela presign.
    expect(apiMock.fetchArquivoBlob).toHaveBeenCalledWith('/api/v1/pacientes/p1/galeria/foto-1/arquivo?v=123');
    expect(imagensCriadas.filter((im) => im.src)).toHaveLength(0);

    // "Tentar de novo" refaz o fetch; quando dá certo, a imagem carrega e o erro some.
    apiMock.fetchArquivoBlob.mockResolvedValue(new Blob(['ok'], { type: 'image/jpeg' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    await waitFor(() => expect(apiMock.fetchArquivoBlob).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(botaoSalvar()).toBeEnabled());
    expect(screen.queryByText('Não foi possível carregar a foto. Tente de novo.')).not.toBeInTheDocument();
  });

  it('(b) URL do servidor carregando: Salvar só habilita com imagem ok e depois de desenhar', async () => {
    apiMock.fetchArquivoBlob.mockResolvedValue(new Blob(['ok'], { type: 'image/jpeg' }));
    render(
      <Harness
        imageSrc="/api/v1/pacientes/p1/galeria/foto-1/arquivo"
        onAnnotatedCaptureSaved={vi.fn()}
      />
    );
    expect(botaoSalvar()).toBeDisabled();
    // Antes de a imagem carregar, o canvas não aceita traço.
    desenhar();
    expect(botaoSalvar()).toBeDisabled();

    await waitFor(() => expect(imagensCriadas.some((im) => im.complete)).toBe(true));
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
    // Sem traço ainda: desabilitado mesmo com imagem ok.
    expect(botaoSalvar()).toBeDisabled();
    desenhar();
    await waitFor(() => expect(botaoSalvar()).toBeEnabled());
    expect(imagensCriadas.find((im) => im.complete).src).toBe('blob:editor/1');
  });

  it('(e) `blob:` carrega direto, sem passar pelo hook', async () => {
    render(<Harness imageSrc="blob:http://localhost/abc" pathsIniciais={TRACO} onAnnotatedCaptureSaved={vi.fn()} />);
    await waitFor(() => expect(botaoSalvar()).toBeEnabled());
    expect(apiMock.fetchArquivoBlob).not.toHaveBeenCalled();
    expect(imagensCriadas[0].src).toBe('blob:http://localhost/abc');
  });
});

describe('JourneyPhotoAnnotationEditor — salvar', () => {
  async function montarPronto(onAnnotatedCaptureSaved, onClose) {
    render(
      <Harness
        imageSrc="blob:http://localhost/abc"
        pathsIniciais={TRACO}
        onAnnotatedCaptureSaved={onAnnotatedCaptureSaved}
        onClose={onClose}
      />
    );
    await waitFor(() => expect(botaoSalvar()).toBeEnabled());
  }

  it('(c) enquanto a Promise segura: nenhum toast, editor aberto e botão "Salvando…"; resolve salva → toast e fecha', async () => {
    let resolver;
    const salvar = vi.fn(() => new Promise((res) => { resolver = res; }));
    const onClose = vi.fn();
    await montarPronto(salvar, onClose);

    fireEvent.click(botaoSalvar());
    await waitFor(() => expect(salvar).toHaveBeenCalledTimes(1));
    expect(salvar.mock.calls[0][0]).toMatchObject({ index: 0, newUrl: 'blob:editor/1' });
    expect(salvar.mock.calls[0][0].blob).toBeInstanceOf(Blob);
    expect(screen.getByRole('button', { name: 'Salvando…' })).toBeDisabled();
    expect(toastMock.success).not.toHaveBeenCalled();
    expect(toastMock.warning).not.toHaveBeenCalled();
    expect(toastMock.error).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();

    await act(async () => {
      resolver({ estado: 'salva', arquivoAtualizadoEm: '2026-10-14T12:00:00.000Z' });
    });
    expect(toastMock.success).toHaveBeenCalledWith('Foto anotada salva.');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('(c2) resolve pendente → toast de aviso e fecha', async () => {
    const salvar = vi.fn().mockResolvedValue({ estado: 'pendente' });
    const onClose = vi.fn();
    await montarPronto(salvar, onClose);
    fireEvent.click(botaoSalvar());
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(toastMock.warning).toHaveBeenCalledWith(
      'Anotação guardada; sobe junto com a foto. Não atualize a página antes de enviar.'
    );
    expect(toastMock.success).not.toHaveBeenCalled();
  });

  it('(d) rejeita → toast de erro com a mensagem, editor aberto com o desenho e Salvar de volta', async () => {
    const salvar = vi.fn().mockRejectedValue(new Error('Sem conexão com o servidor.'));
    const onClose = vi.fn();
    await montarPronto(salvar, onClose);
    fireEvent.click(botaoSalvar());
    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith('Sem conexão com o servidor.'));
    expect(onClose).not.toHaveBeenCalled();
    expect(toastMock.success).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Salvar anotação' })).toBeEnabled();
    expect(screen.getByText('Foto 1 de 1')).toBeInTheDocument();
  });
});
