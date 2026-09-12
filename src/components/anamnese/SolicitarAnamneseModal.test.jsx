import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { SolicitarAnamneseModal } from './SolicitarAnamneseModal.jsx';
import { montarUrlWhatsAppAnamnese } from './solicitarAnamneseEnvio.js';

vi.mock('../../services/api', () => ({
  anamneseEnvioApi: {
    gerar: vi.fn(),
    status: vi.fn(),
    cancelar: vi.fn(),
  },
}));

import { anamneseEnvioApi } from '../../services/api';

describe('SolicitarAnamneseModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    anamneseEnvioApi.gerar.mockResolvedValue({
      envioId: 'e1',
      urlPublica: 'https://app.procedi.com/anamnese?clinic=demo',
      otpCode: '123456',
    });
    anamneseEnvioApi.status.mockResolvedValue({ status: 'PENDENTE' });
    anamneseEnvioApi.cancelar.mockResolvedValue(undefined);
  });

  it('dispara gerar uma única vez sob StrictMode', async () => {
    const payload = { pacienteId: 'pac-1', telefonePaciente: '11999999999', pacienteNome: 'Marina', pacienteCpf: '41288790633' };
    render(
      <React.StrictMode>
        <SolicitarAnamneseModal
          open
          escolha={{ metodoCodigo: 'DISPOSITIVO_PROPRIO_REMOTO', canalCodigo: 'WHATSAPP' }}
          payload={payload}
          onClose={() => {}}
        />
      </React.StrictMode>,
    );

    await screen.findByText('Aguardando paciente');
    await waitFor(() => expect(anamneseEnvioApi.gerar).toHaveBeenCalledTimes(1));
  });

  it('reabrir chama gerar de novo mas mantém o mesmo envioId (reaproveitamento no back)', async () => {
    const payload = { pacienteId: 'pac-1', telefonePaciente: '11999999999', pacienteNome: 'Marina' };
    anamneseEnvioApi.gerar.mockResolvedValue({
      envioId: 'e1',
      urlPublica: 'https://app.procedi.com/anamnese?clinic=demo',
      otpCode: '123456',
    });
    const { rerender } = render(
      <SolicitarAnamneseModal
        open
        escolha={{ metodoCodigo: 'DISPOSITIVO_PROPRIO_REMOTO', canalCodigo: 'WHATSAPP' }}
        payload={payload}
        onClose={() => {}}
      />,
    );
    await waitFor(() => expect(anamneseEnvioApi.gerar).toHaveBeenCalledTimes(1));

    rerender(
      <SolicitarAnamneseModal
        open={false}
        escolha={{ metodoCodigo: 'DISPOSITIVO_PROPRIO_REMOTO', canalCodigo: 'WHATSAPP' }}
        payload={payload}
        onClose={() => {}}
      />,
    );
    rerender(
      <SolicitarAnamneseModal
        open
        escolha={{ metodoCodigo: 'DISPOSITIVO_PROPRIO_REMOTO', canalCodigo: 'WHATSAPP' }}
        payload={payload}
        onClose={() => {}}
      />,
    );
    await waitFor(() => expect(anamneseEnvioApi.gerar).toHaveBeenCalledTimes(2));
    const ids = anamneseEnvioApi.gerar.mock.results.map((r) => r.value).filter(Boolean);
    const resolved = await Promise.all(ids);
    expect(resolved.map((r) => r.envioId)).toEqual(['e1', 'e1']);
  });

  it('Gerar novo link no branch expirado envia forcarNovo true', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    anamneseEnvioApi.status.mockResolvedValue({ status: 'EXPIRADO' });

    render(
      <SolicitarAnamneseModal
        open
        escolha={{ metodoCodigo: 'DISPOSITIVO_PROPRIO_REMOTO', canalCodigo: 'WHATSAPP' }}
        payload={{ pacienteId: 'pac-1', telefonePaciente: '11999999999', pacienteNome: 'Marina' }}
        onClose={() => {}}
      />,
    );
    await screen.findByText('Aguardando paciente');
    await vi.advanceTimersByTimeAsync(3000);
    await screen.findByText('Link expirado');
    anamneseEnvioApi.gerar.mockClear();
    await user.click(screen.getByRole('button', { name: 'Gerar novo link' }));
    await waitFor(() => {
      expect(anamneseEnvioApi.gerar).toHaveBeenCalledWith(
        expect.objectContaining({ forcarNovo: true, pacienteId: 'pac-1' }),
      );
    });
    vi.useRealTimers();
  });

  it('no branch de sucesso Gerar novo link envia forcarNovo true', async () => {
    const user = userEvent.setup();
    render(
      <SolicitarAnamneseModal
        open
        escolha={{ metodoCodigo: 'DISPOSITIVO_PROPRIO_REMOTO', canalCodigo: 'WHATSAPP' }}
        payload={{ pacienteId: 'pac-1', telefonePaciente: '11999999999', pacienteNome: 'Marina' }}
        onClose={() => {}}
      />,
    );
    await screen.findByText('Aguardando paciente');
    expect(screen.getByRole('button', { name: 'Gerar novo link' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Gerar novo link' }));
    await waitFor(() => {
      expect(anamneseEnvioApi.gerar).toHaveBeenCalledWith(
        expect.objectContaining({ forcarNovo: true, pacienteId: 'pac-1' }),
      );
    });
  });

  it('Cancelar chama cancelar com envioId e depois onCancelar', async () => {
    const onCancelar = vi.fn();
    const user = userEvent.setup();
    render(
      <SolicitarAnamneseModal
        open
        escolha={{ metodoCodigo: 'DISPOSITIVO_PROPRIO_REMOTO', canalCodigo: 'WHATSAPP' }}
        payload={{ pacienteId: 'pac-1', telefonePaciente: '11999999999', pacienteNome: 'Marina' }}
        onClose={() => {}}
        onCancelar={onCancelar}
      />,
    );
    await screen.findByText('Aguardando paciente');
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(anamneseEnvioApi.cancelar).toHaveBeenCalledWith('e1'));
    expect(onCancelar).toHaveBeenCalledTimes(1);
  });

  it('Tentar outro método após erro não chama cancelar', async () => {
    anamneseEnvioApi.gerar.mockRejectedValue(new Error('falha'));
    const onCancelar = vi.fn();
    const user = userEvent.setup();
    render(
      <SolicitarAnamneseModal
        open
        escolha={{ metodoCodigo: 'DISPOSITIVO_PROPRIO_REMOTO', canalCodigo: 'WHATSAPP' }}
        payload={{ pacienteId: 'pac-1', telefonePaciente: '11999999999', pacienteNome: 'Marina' }}
        onClose={() => {}}
        onCancelar={onCancelar}
      />,
    );
    await screen.findByText('falha');
    await user.click(screen.getByRole('button', { name: 'Tentar outro método' }));
    expect(anamneseEnvioApi.cancelar).not.toHaveBeenCalled();
    expect(onCancelar).toHaveBeenCalledTimes(1);
  });

  it('não inclui OTP no texto do WhatsApp', async () => {
    render(
      <SolicitarAnamneseModal
        open
        escolha={{ metodoCodigo: 'DISPOSITIVO_PROPRIO_REMOTO', canalCodigo: 'WHATSAPP' }}
        payload={{ pacienteId: 'pac-1', telefonePaciente: '11988887777', pacienteNome: 'Marina', pacienteCpf: '41288790633' }}
        onClose={() => {}}
      />,
    );
    const link = await screen.findByRole('link', { name: 'Enviar via WhatsApp' });
    const href = decodeURIComponent(link.getAttribute('href') || '');
    expect(href).toContain('wa.me/');
    expect(href).not.toContain('123456');
    expect(href).not.toContain('código de verificação');
    expect(screen.queryByText(/Código de verificação/)).not.toBeInTheDocument();
  });
});

describe('montarUrlWhatsAppAnamnese', () => {
  it('nunca inclui otpCode no texto', () => {
    const url = montarUrlWhatsAppAnamnese({
      telefonePaciente: '11999999999',
      pacienteCpf: '41288790633',
      pacienteNome: 'Marina',
      urlPublica: 'https://app/anamnese?clinic=x',
    });
    const decoded = decodeURIComponent(url);
    expect(decoded).not.toMatch(/código de verificação/i);
    expect(decoded).toContain('https://app/anamnese?clinic=x&cpf=41288790633');
  });
});
