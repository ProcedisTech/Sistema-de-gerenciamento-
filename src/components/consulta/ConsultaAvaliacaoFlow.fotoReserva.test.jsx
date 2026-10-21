// @vitest-environment jsdom
/**
 * F5: o card da foto da avaliação nunca põe URL /api/ crua no <img>. Foto do servidor passa pelo fetch autenticado
 * (blob:), com a url de reserva (`?v=` da versão que a foto conhece) quando houver; foto local (blob:/data:) vai
 * direto. Depois do aviso GALERIA (arquivoAtualizadoEm novo, url nova) o <img> recebe blob:, nunca /api/.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom';

const apiMock = vi.hoisted(() => ({ fetchArquivoBlob: vi.fn() }));
vi.mock('../../services/api.js', () => ({ pacientesGaleriaApi: apiMock }));

import { ConsultaAvaliacaoFlow } from './ConsultaAvaliacaoFlow.jsx';
import { urlDeReservaDaFoto } from './mergeFotosPorId.js';

const PACIENTE = 'pac-1';
const FOTO = 'foto-1';
const reserva = (photo) => urlDeReservaDaFoto(PACIENTE, photo?.meta?.fotoId, photo?.meta?.arquivoAtualizadoEm);
const fotoRemota = (versao) => ({
  url: `/api/v1/pacientes/${PACIENTE}/galeria/${FOTO}/arquivo?v=${versao}`,
  meta: { fotoId: FOTO, arquivoAtualizadoEm: versao, categoria: 'antes' },
});

const imgs = () => Array.from(document.querySelectorAll('img'));

describe('ConsultaAvaliacaoFlow: foto do card (F5)', () => {
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

  it('foto do servidor: o <img> recebe blob: (fetch autenticado), nunca o /api/ cru', async () => {
    const photo = fotoRemota('2026-10-06T12:00:00Z');
    render(<ConsultaAvaliacaoFlow evaluationCapturedPhotos={[photo]} urlArquivoReserva={reserva} />);
    await waitFor(() => expect(imgs().length).toBe(1));
    expect(imgs()[0].getAttribute('src')).toMatch(/^blob:/);
    expect(apiMock.fetchArquivoBlob).toHaveBeenCalledTimes(1);
    expect(apiMock.fetchArquivoBlob.mock.calls[0][0]).toBe(reserva(photo));
    expect(document.querySelector('img[src^="/api/"]')).toBeNull();
  });

  it('depois do aviso GALERIA (arquivoAtualizadoEm novo): o <img> do card recebe blob:, nunca /api/', async () => {
    const v1 = fotoRemota('2026-10-06T12:00:00Z');
    const { rerender } = render(<ConsultaAvaliacaoFlow evaluationCapturedPhotos={[v1]} urlArquivoReserva={reserva} />);
    await waitFor(() => expect(imgs()[0]?.getAttribute('src') || '').toMatch(/^blob:/));

    const v2 = fotoRemota('2026-10-06T12:30:00Z');
    rerender(<ConsultaAvaliacaoFlow evaluationCapturedPhotos={[v2]} urlArquivoReserva={reserva} />);
    await waitFor(() => expect(apiMock.fetchArquivoBlob).toHaveBeenCalledTimes(2));
    expect(apiMock.fetchArquivoBlob.mock.calls[1][0]).toBe(reserva(v2));
    await waitFor(() => expect(imgs()[0]?.getAttribute('src') || '').toMatch(/^blob:/));
    expect(document.querySelector('img[src^="/api/"]')).toBeNull();
  });

  it('foto local (blob:/data:) vai direto no <img>, sem fetch', async () => {
    const local = { url: 'blob:http://localhost/local-1', meta: { categoria: 'antes' } };
    const dataUrl = { url: 'data:image/png;base64,AAAA' };
    render(<ConsultaAvaliacaoFlow evaluationCapturedPhotos={[local, dataUrl]} urlArquivoReserva={reserva} />);
    await waitFor(() => expect(imgs().length).toBe(2));
    expect(imgs().map((i) => i.getAttribute('src'))).toEqual([
      'blob:http://localhost/local-1',
      'data:image/png;base64,AAAA',
    ]);
    expect(apiMock.fetchArquivoBlob).not.toHaveBeenCalled();
  });

  it('enquanto carrega: placeholder; se o fetch falha: ícone, e nunca /api/ cru', async () => {
    let falhar;
    apiMock.fetchArquivoBlob.mockImplementation(
      () => new Promise((_, rej) => {
        falhar = rej;
      }),
    );
    render(<ConsultaAvaliacaoFlow evaluationCapturedPhotos={[fotoRemota('v1')]} urlArquivoReserva={reserva} />);
    expect(await screen.findByLabelText('Carregando imagem')).toBeInTheDocument();
    expect(document.querySelector('img[src^="/api/"]')).toBeNull();
    falhar(new Error('401'));
    expect(await screen.findByLabelText('Imagem indisponível')).toBeInTheDocument();
    expect(imgs()).toHaveLength(0);
  });
});
