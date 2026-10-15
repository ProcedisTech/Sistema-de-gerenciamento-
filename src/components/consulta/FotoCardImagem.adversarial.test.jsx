// @vitest-environment jsdom
/**
 * F5 (testador independente): testes adversariais do FotoCardImagem / PhotoCarouselLane.
 */
import React, { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom';

const apiMock = vi.hoisted(() => ({ fetchArquivoBlob: vi.fn() }));
vi.mock('../../services/api.js', () => ({ pacientesGaleriaApi: apiMock }));

import { FotoCardImagem } from './FotoCardImagem.jsx';
import { PhotoCarouselLane } from '../journey/PhotoCarouselLane.jsx';

const imgs = () => Array.from(document.querySelectorAll('img'));
const srcs = () => imgs().map((i) => i.getAttribute('src'));
const PRESIGNED =
  'https://bucket.r2.example.com/galeria/f1.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=abc123';

describe('FotoCardImagem: adversarial (F5)', () => {
  let seq;
  beforeEach(() => {
    seq = 0;
    apiMock.fetchArquivoBlob.mockReset();
    apiMock.fetchArquivoBlob.mockImplementation(async () => new Blob(['x'], { type: 'image/png' }));
    URL.createObjectURL = vi.fn(() => `blob:http://localhost/${(seq += 1)}`);
    URL.revokeObjectURL = vi.fn();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('foto local blob: e data: nunca dispara fetch, mesmo com urlArquivoReserva', async () => {
    const reserva = vi.fn(() => '/api/v1/pacientes/p/galeria/f/arquivo');
    render(
      <>
        <FotoCardImagem photo={{ url: 'blob:http://localhost/a', meta: { fotoId: 'f' } }} urlArquivoReserva={reserva} />
        <FotoCardImagem photo={{ url: 'data:image/png;base64,AAAA', meta: { fotoId: 'g' } }} urlArquivoReserva={reserva} />
      </>,
    );
    await waitFor(() => expect(imgs()).toHaveLength(2));
    expect(srcs()).toEqual(['blob:http://localhost/a', 'data:image/png;base64,AAAA']);
    expect(apiMock.fetchArquivoBlob).not.toHaveBeenCalled();
    expect(reserva).not.toHaveBeenCalled();
  });

  it('remota sem reserva e presigned: passa pelo fetch (forceBlob) e o <img> recebe blob:, nunca a URL crua', async () => {
    render(<FotoCardImagem photo={{ url: PRESIGNED, meta: { fotoId: 'f1' } }} />);
    await waitFor(() => expect(imgs()).toHaveLength(1));
    expect(apiMock.fetchArquivoBlob).toHaveBeenCalledTimes(1);
    expect(apiMock.fetchArquivoBlob.mock.calls[0][0]).toBe(PRESIGNED);
    expect(imgs()[0].getAttribute('src')).toMatch(/^blob:/);
    expect(document.querySelector('img[src^="https://"]')).toBeNull();
  });

  it('remota /api/ sem reserva: usa photo.url via fetch, nunca crua no <img>', async () => {
    const url = '/api/v1/pacientes/p/galeria/f1/arquivo?v=1';
    render(<FotoCardImagem photo={{ url, meta: { fotoId: 'f1' } }} />);
    await waitFor(() => expect(imgs()).toHaveLength(1));
    expect(apiMock.fetchArquivoBlob.mock.calls[0][0]).toBe(url);
    expect(imgs()[0].getAttribute('src')).toMatch(/^blob:/);
  });

  it('?v= novo revoga o blob antigo e o <img> recebe o novo blob:', async () => {
    const reserva = (p) => p.url;
    const v1 = { url: '/api/v1/pacientes/p/galeria/f1/arquivo?v=1', meta: { fotoId: 'f1' } };
    const v2 = { url: '/api/v1/pacientes/p/galeria/f1/arquivo?v=2', meta: { fotoId: 'f1' } };
    const { rerender } = render(<FotoCardImagem photo={v1} urlArquivoReserva={reserva} />);
    await waitFor(() => expect(srcs()).toEqual(['blob:http://localhost/1']));
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    rerender(<FotoCardImagem photo={v2} urlArquivoReserva={reserva} />);
    await waitFor(() => expect(srcs()).toEqual(['blob:http://localhost/2']));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:http://localhost/1');
    expect(apiMock.fetchArquivoBlob.mock.calls[1][0]).toBe(v2.url);
  });

  it('erro do fetch: ícone indisponível, nenhum <img>, nunca /api/ cru', async () => {
    apiMock.fetchArquivoBlob.mockImplementation(async () => {
      throw new Error('401');
    });
    render(<FotoCardImagem photo={{ url: '/api/v1/pacientes/p/galeria/f1/arquivo?v=1', meta: { fotoId: 'f1' } }} />);
    expect(await screen.findByLabelText('Imagem indisponível')).toBeInTheDocument();
    expect(imgs()).toHaveLength(0);
    expect(document.querySelector('img[src^="/api/"]')).toBeNull();
  });

  it('unmount revoga o blob', async () => {
    const { unmount } = render(
      <FotoCardImagem photo={{ url: '/api/v1/pacientes/p/galeria/f1/arquivo', meta: { fotoId: 'f1' } }} />,
    );
    await waitFor(() => expect(srcs()).toEqual(['blob:http://localhost/1']));
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:http://localhost/1');
  });

  it('sem url nenhuma: ícone indisponível e nenhum fetch', () => {
    render(<FotoCardImagem photo={{ meta: {} }} />);
    expect(screen.getByLabelText('Imagem indisponível')).toBeInTheDocument();
    expect(apiMock.fetchArquivoBlob).not.toHaveBeenCalled();
  });
});

function Lane({ fotos }) {
  const [legendas, setLegendas] = useState({});
  return (
    <PhotoCarouselLane
      title="Antes"
      category="antes"
      items={fotos.map((photo, originalIndex) => ({ photo, originalIndex }))}
      legendas={legendas}
      setLegendas={setLegendas}
      showUpload={false}
    />
  );
}

describe('PhotoCarouselLane: legendas e chaves (F5, adversarial)', () => {
  beforeEach(() => {
    apiMock.fetchArquivoBlob.mockReset();
    apiMock.fetchArquivoBlob.mockImplementation(async () => new Blob(['x']));
    URL.createObjectURL = vi.fn(() => 'blob:http://localhost/z');
    URL.revokeObjectURL = vi.fn();
  });

  it('duas fotos com o mesmo fotoId e urls diferentes não colidem a legenda', async () => {
    const a = { url: 'blob:http://localhost/a', meta: { fotoId: 'dup', categoria: 'antes' } };
    const b = { url: 'blob:http://localhost/b', meta: { fotoId: 'dup', categoria: 'antes' } };
    render(<Lane fotos={[a, b]} />);
    const campos = screen.getAllByPlaceholderText('Ex: Detalhe...');
    fireEvent.change(campos[0], { target: { value: 'so a' } });
    const depois = screen.getAllByPlaceholderText('Ex: Detalhe...');
    expect(depois[0]).toHaveValue('so a');
    expect(depois[1]).toHaveValue('');
  });

  it('foto sem meta.fotoId usa a url como chave de legenda, sem quebrar, e fotos distintas não colidem', async () => {
    const a = { url: 'blob:http://localhost/a' };
    const b = { url: 'blob:http://localhost/b', meta: { categoria: 'antes' } };
    render(<Lane fotos={[a, b]} />);
    const campos = screen.getAllByPlaceholderText('Ex: Detalhe...');
    fireEvent.change(campos[1], { target: { value: 'so b' } });
    const depois = screen.getAllByPlaceholderText('Ex: Detalhe...');
    expect(depois[0]).toHaveValue('');
    expect(depois[1]).toHaveValue('so b');
    expect(apiMock.fetchArquivoBlob).not.toHaveBeenCalled();
  });
});
