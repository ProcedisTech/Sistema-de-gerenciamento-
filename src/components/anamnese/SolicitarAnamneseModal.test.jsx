import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SolicitarAnamneseModal } from './SolicitarAnamneseModal.jsx';
import {
  resetSolicitarAnamneseGerarLock,
  montarUrlWhatsAppAnamnese,
} from './solicitarAnamneseEnvio.js';

vi.mock('../../services/api', () => ({
  anamneseEnvioApi: {
    gerar: vi.fn(),
    status: vi.fn(),
  },
}));

import { anamneseEnvioApi } from '../../services/api';

describe('SolicitarAnamneseModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSolicitarAnamneseGerarLock();
    anamneseEnvioApi.gerar.mockResolvedValue({
      envioId: 'e1',
      urlPublica: 'https://app.procedi.com/anamnese?clinic=demo',
      otpCode: '123456',
    });
    anamneseEnvioApi.status.mockResolvedValue({ status: 'PENDENTE' });
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

  it('dispara novo gerar após fechar e reabrir', async () => {
    const payload = { pacienteId: 'pac-1', telefonePaciente: '11999999999', pacienteNome: 'Marina' };
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
