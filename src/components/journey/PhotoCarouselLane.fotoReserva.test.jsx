// @vitest-environment jsdom
/**
 * F5: faixa de fotos do procedimento. O <img> do card nunca recebe URL /api/ crua (blob: do fetch autenticado, ou a
 * foto local direto); a legenda e a key seguem `meta.fotoId`, então a legenda fica quando a url troca (aviso GALERIA).
 */
import React, { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom';

const apiMock = vi.hoisted(() => ({ fetchArquivoBlob: vi.fn() }));
vi.mock('../../services/api.js', () => ({ pacientesGaleriaApi: apiMock }));

import { PhotoCarouselLane } from './PhotoCarouselLane.jsx';
import { urlDeReservaDaFoto } from '../consulta/mergeFotosPorId.js';

const PACIENTE = 'pac-1';
const reserva = (photo) => urlDeReservaDaFoto(PACIENTE, photo?.meta?.fotoId, photo?.meta?.arquivoAtualizadoEm);
const remota = (fotoId, versao) => ({
  url: `/api/v1/pacientes/${PACIENTE}/galeria/${fotoId}/arquivo?v=${versao}`,
  meta: { fotoId, arquivoAtualizadoEm: versao, categoria: 'antes' },
});
const imgs = () => Array.from(document.querySelectorAll('img'));

function Harness({ fotos }) {
  const [legendas, setLegendas] = useState({});
  return (
    <PhotoCarouselLane
      title="Antes"
      category="antes"
      items={fotos.map((photo, originalIndex) => ({ photo, originalIndex }))}
      legendas={legendas}
      setLegendas={setLegendas}
      urlArquivoReserva={reserva}
      showUpload={false}
    />
  );
}

describe('PhotoCarouselLane: foto do card (F5)', () => {
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

  it('foto do servidor: <img> com blob: e nunca /api/ cru; troca de versão busca de novo e segue blob:', async () => {
    const v1 = remota('f1', '2026-10-06T12:00:00Z');
    const { rerender } = render(<Harness fotos={[v1]} />);
    await waitFor(() => expect(imgs()[0]?.getAttribute('src') || '').toMatch(/^blob:/));
    expect(apiMock.fetchArquivoBlob.mock.calls[0][0]).toBe(reserva(v1));

    const v2 = remota('f1', '2026-10-06T12:30:00Z');
    rerender(<Harness fotos={[v2]} />);
    await waitFor(() => expect(apiMock.fetchArquivoBlob).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(imgs()[0]?.getAttribute('src') || '').toMatch(/^blob:/));
    expect(document.querySelector('img[src^="/api/"]')).toBeNull();
  });

  it('a legenda permanece quando a url troca e o fotoId é o mesmo', async () => {
    const { rerender } = render(<Harness fotos={[remota('f1', 'v1')]} />);
    const campo = await screen.findByPlaceholderText('Ex: Detalhe...');
    fireEvent.change(campo, { target: { value: 'Testa, lado direito' } });
    expect(screen.getByPlaceholderText('Ex: Detalhe...')).toHaveValue('Testa, lado direito');

    rerender(<Harness fotos={[remota('f1', 'v2')]} />);
    await waitFor(() => expect(imgs()[0]?.getAttribute('src') || '').toMatch(/^blob:/));
    expect(screen.getByPlaceholderText('Ex: Detalhe...')).toHaveValue('Testa, lado direito');
  });

  it('foto local (blob:/data:) vai direto, sem fetch, e a legenda segue a url quando não há fotoId', async () => {
    const local = { url: 'blob:http://localhost/loc-1', meta: { categoria: 'antes' } };
    render(<Harness fotos={[local]} />);
    await waitFor(() => expect(imgs()).toHaveLength(1));
    expect(imgs()[0].getAttribute('src')).toBe('blob:http://localhost/loc-1');
    expect(apiMock.fetchArquivoBlob).not.toHaveBeenCalled();
    fireEvent.change(screen.getByPlaceholderText('Ex: Detalhe...'), { target: { value: 'Local' } });
    expect(screen.getByPlaceholderText('Ex: Detalhe...')).toHaveValue('Local');
  });
});
