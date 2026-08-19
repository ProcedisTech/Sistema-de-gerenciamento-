import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
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
