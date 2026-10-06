import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { SolicitarAnamneseModal } from './SolicitarAnamneseModal.jsx';
import { montarUrlWhatsAppAnamnese } from './solicitarAnamneseEnvio.js';
import { criarAvisosFalsos } from '../../test/avisosFalsos.jsx';
import { AVISO } from '../../services/avisos/tiposAviso.js';

vi.mock('../../services/api', () => ({
  anamneseEnvioApi: {
    gerar: vi.fn(),
    status: vi.fn(),
    cancelar: vi.fn(),
  },
  anamneseApi: {
    getPaciente: vi.fn(),
  },
}));

import { anamneseApi, anamneseEnvioApi } from '../../services/api';

describe('SolicitarAnamneseModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    anamneseEnvioApi.gerar.mockResolvedValue({
      envioId: 'e1',
      urlPublica: 'https://app.procedi.com/anamnese?clinic=demo',
      otpCode: '123456',
      preenchimentoAnamneseId: 'pre-1',
    });
    anamneseEnvioApi.status.mockResolvedValue({ status: 'PENDENTE' });
    anamneseEnvioApi.cancelar.mockResolvedValue(undefined);
    anamneseApi.getPaciente.mockResolvedValue({ status: 'Finalizada' });
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
    const canal = criarAvisosFalsos();

    render(
      <SolicitarAnamneseModal
        open
        escolha={{ metodoCodigo: 'DISPOSITIVO_PROPRIO_REMOTO', canalCodigo: 'WHATSAPP' }}
        payload={{ pacienteId: 'pac-1', telefonePaciente: '11999999999', pacienteNome: 'Marina' }}
        onClose={() => {}}
      />,
      { wrapper: canal.Wrapper },
    );
    await screen.findByText('Aguardando paciente');
    await waitFor(() => expect(anamneseEnvioApi.status).toHaveBeenCalledTimes(1));
    anamneseEnvioApi.status.mockResolvedValue({ status: 'EXPIRADO' });
    canal.emitirAviso(AVISO.ANAMNESE.ENVIO_ALTERADO, 'e1');
    await vi.advanceTimersByTimeAsync(300);
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

  it('busca o status ao abrir, ignora aviso de outro envio e rebusca com aviso do envio', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const canal = criarAvisosFalsos();
    render(
      <SolicitarAnamneseModal
        open
        escolha={{ metodoCodigo: 'DISPOSITIVO_PROPRIO_REMOTO', canalCodigo: 'WHATSAPP' }}
        payload={{ pacienteId: 'pac-1', telefonePaciente: '11999999999', pacienteNome: 'Marina' }}
        onClose={() => {}}
      />,
      { wrapper: canal.Wrapper },
    );
    await screen.findByText('Aguardando paciente');
    await waitFor(() => expect(anamneseEnvioApi.status).toHaveBeenCalledWith('e1'));
    expect(anamneseEnvioApi.status).toHaveBeenCalledTimes(1);

    canal.emitirAviso(AVISO.ANAMNESE.ENVIO_ALTERADO, 'outro');
    await vi.advanceTimersByTimeAsync(1000);
    expect(anamneseEnvioApi.status).toHaveBeenCalledTimes(1);

    canal.emitirAviso(AVISO.ANAMNESE.ENVIO_ALTERADO, 'e1');
    await vi.advanceTimersByTimeAsync(300);
    expect(anamneseEnvioApi.status).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('ENVIO_ALTERADO com registroId nulo faz o modal rebuscar o status', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const canal = criarAvisosFalsos();
    render(
      <SolicitarAnamneseModal
        open
        escolha={{ metodoCodigo: 'DISPOSITIVO_PROPRIO_REMOTO', canalCodigo: 'WHATSAPP' }}
        payload={{ pacienteId: 'pac-1', telefonePaciente: '11999999999', pacienteNome: 'Marina' }}
        onClose={() => {}}
      />,
      { wrapper: canal.Wrapper },
    );
    await screen.findByText('Aguardando paciente');
    await waitFor(() => expect(anamneseEnvioApi.status).toHaveBeenCalledTimes(1));
    anamneseEnvioApi.status.mockResolvedValue({ status: 'CANCELADO' });
    canal.emitirAviso(AVISO.ANAMNESE.ENVIO_ALTERADO, null);
    await vi.advanceTimersByTimeAsync(300);
    expect(anamneseEnvioApi.status).toHaveBeenCalledTimes(2);
    await screen.findByText('Link expirado');
    vi.useRealTimers();
  });

  it('recarregar do canal rebusca o status; sem avisos não há nova consulta', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const canal = criarAvisosFalsos();
    render(
      <SolicitarAnamneseModal
        open
        escolha={{ metodoCodigo: 'DISPOSITIVO_PROPRIO_REMOTO', canalCodigo: 'WHATSAPP' }}
        payload={{ pacienteId: 'pac-1', telefonePaciente: '11999999999', pacienteNome: 'Marina' }}
        onClose={() => {}}
      />,
      { wrapper: canal.Wrapper },
    );
    await screen.findByText('Aguardando paciente');
    await waitFor(() => expect(anamneseEnvioApi.status).toHaveBeenCalledTimes(1));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(anamneseEnvioApi.status).toHaveBeenCalledTimes(1);
    canal.emitirRecarregar();
    await vi.advanceTimersByTimeAsync(300);
    expect(anamneseEnvioApi.status).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('busca o status no vencimento informado pelo status', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const canal = criarAvisosFalsos();
    anamneseEnvioApi.status.mockResolvedValue({
      status: 'PENDENTE',
      expiraEm: new Date(Date.now() + 10 * 60_000).toISOString(),
    });
    render(
      <SolicitarAnamneseModal
        open
        escolha={{ metodoCodigo: 'DISPOSITIVO_PROPRIO_REMOTO', canalCodigo: 'WHATSAPP' }}
        payload={{ pacienteId: 'pac-1', telefonePaciente: '11999999999', pacienteNome: 'Marina' }}
        onClose={() => {}}
      />,
      { wrapper: canal.Wrapper },
    );
    await screen.findByText('Aguardando paciente');
    await waitFor(() => expect(anamneseEnvioApi.status).toHaveBeenCalledTimes(1));
    anamneseEnvioApi.status.mockResolvedValue({ status: 'EXPIRADO' });
    await vi.advanceTimersByTimeAsync(10 * 60_000 + 50);
    expect(anamneseEnvioApi.status).toHaveBeenCalledTimes(2);
    await screen.findByText('Link expirado');
    vi.useRealTimers();
  });

  it('CONCLUIDO com preenchimento cancelada mostra recusa e chama onRecusado (não onConcluido)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const onConcluido = vi.fn();
    const onRecusado = vi.fn();
    const canal = criarAvisosFalsos();
    anamneseApi.getPaciente.mockResolvedValue({ status: 'cancelada' });

    render(
      <SolicitarAnamneseModal
        open
        escolha={{ metodoCodigo: 'DISPOSITIVO_PROPRIO_REMOTO', canalCodigo: 'WHATSAPP' }}
        payload={{
          pacienteId: 'pac-1',
          telefonePaciente: '11999999999',
          pacienteNome: 'Marina',
          preenchimentoAnamneseId: 'pre-1',
        }}
        onClose={() => {}}
        onConcluido={onConcluido}
        onRecusado={onRecusado}
      />,
      { wrapper: canal.Wrapper },
    );
    await screen.findByText('Aguardando paciente');
    await waitFor(() => expect(anamneseEnvioApi.status).toHaveBeenCalledTimes(1));
    anamneseEnvioApi.status.mockResolvedValue({ status: 'CONCLUIDO' });
    canal.emitirAviso(AVISO.ANAMNESE.ENVIO_ALTERADO, 'e1');
    await vi.advanceTimersByTimeAsync(300);
    await screen.findByText('Paciente recusou');
    expect(screen.queryByText('Anamnese recebida!')).not.toBeInTheDocument();
    await vi.advanceTimersByTimeAsync(1600);
    expect(onRecusado).toHaveBeenCalledTimes(1);
    expect(onConcluido).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('CONCLUIDO assinado mostra sucesso e chama onConcluido', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const onConcluido = vi.fn();
    const onRecusado = vi.fn();
    const canal = criarAvisosFalsos();
    anamneseApi.getPaciente.mockResolvedValue({ status: 'Finalizada' });

    render(
      <SolicitarAnamneseModal
        open
        escolha={{ metodoCodigo: 'DISPOSITIVO_PROPRIO_REMOTO', canalCodigo: 'WHATSAPP' }}
        payload={{
          pacienteId: 'pac-1',
          telefonePaciente: '11999999999',
          pacienteNome: 'Marina',
          preenchimentoAnamneseId: 'pre-1',
        }}
        onClose={() => {}}
        onConcluido={onConcluido}
        onRecusado={onRecusado}
      />,
      { wrapper: canal.Wrapper },
    );
    await screen.findByText('Aguardando paciente');
    await waitFor(() => expect(anamneseEnvioApi.status).toHaveBeenCalledTimes(1));
    anamneseEnvioApi.status.mockResolvedValue({ status: 'CONCLUIDO' });
    canal.emitirAviso(AVISO.ANAMNESE.ENVIO_ALTERADO, 'e1');
    await vi.advanceTimersByTimeAsync(300);
    await screen.findByText('Anamnese recebida!');
    expect(screen.queryByText('Paciente recusou')).not.toBeInTheDocument();
    await vi.advanceTimersByTimeAsync(1600);
    expect(onConcluido).toHaveBeenCalledTimes(1);
    expect(onRecusado).not.toHaveBeenCalled();
    vi.useRealTimers();
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
