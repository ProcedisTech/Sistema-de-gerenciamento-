import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import '@testing-library/jest-dom';
import { PublicSignatureFlow } from './PublicSignatureFlow.jsx';

vi.mock('../../config/apiEnv', () => ({
  resolveApiUrl: (path) => path,
}));

vi.mock('../../utils/replaceTermVariables', () => ({
  replaceTermVariables: (c) => c,
}));

vi.mock('../../utils/pdfGenerator', () => ({
  generateTermoPdf: vi.fn(),
}));

describe('PublicSignatureFlow — recusa', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('location', { pathname: '/assinar/sessao-otp-1' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('mostra Recusar no passo do documento após OTP e confirma POST /recusar', async () => {
    fetch.mockImplementation((url, opts) => {
      if (String(url).includes('/status')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              status: 'PENDENTE',
              precisaOtp: false,
              otpValidado: true,
              titulo: 'Termo de um',
              conteudoSnapshot: '<p>Conteúdo</p>',
            }),
        });
      }
      if (String(url).includes('/recusar') && opts?.method === 'POST') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    });

    render(<PublicSignatureFlow />);

    expect(await screen.findByRole('button', { name: 'Recusar' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Recusar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar recusa' }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/v1/assinaturas/externa/sessao-otp-1/recusar',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'X-Requested-With': 'XMLHttpRequest' }),
        })
      );
    });
    expect(await screen.findByText('Assinatura recusada')).toBeInTheDocument();
  });

  it('pede código de 6 dígitos e só habilita Confirmar com 6 caracteres', async () => {
    fetch.mockImplementation((url) => {
      if (String(url).includes('/status')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              status: 'PENDENTE',
              precisaOtp: true,
              otpValidado: false,
              titulo: 'Termo de um',
              conteudoSnapshot: '<p>Conteúdo</p>',
            }),
        });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    });

    render(<PublicSignatureFlow />);

    expect(await screen.findByText(/código de 6 dígitos/i)).toBeInTheDocument();
    const input = screen.getByPlaceholderText('000000');
    const confirmar = screen.getByRole('button', { name: 'Confirmar' });
    expect(confirmar).toBeDisabled();
    await userEvent.type(input, '1234');
    expect(confirmar).toBeDisabled();
    await userEvent.type(input, '56');
    expect(confirmar).not.toBeDisabled();
  });
});

describe('PublicSignatureFlow — data/hora da assinatura no fuso da clínica', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    // 21:30 em Brasília = 00:30 UTC do dia seguinte = 19:30 em Rio Branco.
    vi.setSystemTime(new Date('2026-10-01T00:30:00Z'));
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('location', { pathname: '/assinar/sessao-fuso-1' });
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      }
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fillRect: vi.fn(),
      setTransform: vi.fn(),
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,AAAA');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function assinarComFuso(fusoHorario) {
    fetch.mockImplementation((url, opts) => {
      if (String(url).includes('/status')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              status: 'PENDENTE',
              precisaOtp: false,
              otpValidado: true,
              titulo: 'Termo',
              conteudoSnapshot: '<p>Conteúdo</p>',
              ...(fusoHorario ? { fusoHorario } : {}),
            }),
        });
      }
      if (String(url).includes('/assinar') && opts?.method === 'POST') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    });

    const { container } = render(<PublicSignatureFlow />);
    await userEvent.click(await screen.findByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Avançar para Identificação' }));
    await userEvent.click(screen.getByRole('button', { name: /Tirar Foto/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Avançar' }));
    const canvas = container.querySelector('canvas');
    fireEvent.pointerDown(canvas, { clientX: 10, clientY: 10 });
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar Assinatura' }));
    return screen.findByText(/Data\/Hora:/);
  }

  it('usa status.fusoHorario (Rio Branco)', async () => {
    const el = await assinarComFuso('America/Rio_Branco');
    expect(el.textContent).toContain('30/09/2026, 19:30:00');
  });

  it('sem fusoHorario cai no FUSO_PADRAO (Brasília)', async () => {
    const el = await assinarComFuso(null);
    expect(el.textContent).toContain('30/09/2026, 21:30:00');
  });
});
