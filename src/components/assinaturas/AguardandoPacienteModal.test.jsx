import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom';
import { AguardandoPacienteModal } from './AguardandoPacienteModal.jsx';

vi.mock('../../config/apiEnv', () => ({
  resolveApiUrl: (path) => path,
}));

vi.mock('../../services/api', () => ({
  authHeadersForFetch: vi.fn().mockResolvedValue({}),
}));

describe('AguardandoPacienteModal', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllTimers();
  });

  it('re-render do pai repassando novo objeto literal NÃO dispara chamada nova (fetch continua com exatamente 1 chamada)', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          sessaoId: 'sess-123',
          urlAssinatura: 'https://procedi.app/assinar/sess-123',
        }),
    });

    const { rerender } = render(
      <AguardandoPacienteModal
        open={true}
        onClose={vi.fn()}
        escolha={{ metodoCodigo: 'DISPOSITIVO_PROPRIO_LOCAL', canalCodigo: null }}
        sessaoExternaPayload={{
          termoAssinaturaId: 'termo-abc',
          telefonePaciente: '11999998888',
        }}
        onAssinaturaConcluida={vi.fn()}
      />
    );

    await waitFor(() => {
      const gerarCalls = fetch.mock.calls.filter(([url]) =>
        String(url).includes('/api/v1/assinaturas/externa/gerar')
      );
      expect(gerarCalls.length).toBe(1);
    });

    // Re-render com novo objeto literal (mesmos valores primitivos)
    rerender(
      <AguardandoPacienteModal
        open={true}
        onClose={vi.fn()}
        escolha={{ metodoCodigo: 'DISPOSITIVO_PROPRIO_LOCAL', canalCodigo: null }}
        sessaoExternaPayload={{
          termoAssinaturaId: 'termo-abc',
          telefonePaciente: '11999998888',
        }}
        onAssinaturaConcluida={vi.fn()}
      />
    );

    // Permite eventuais microtasks processarem
    await new Promise((resolve) => setTimeout(resolve, 50));

    const gerarCallsAposRerender = fetch.mock.calls.filter(([url]) =>
      String(url).includes('/api/v1/assinaturas/externa/gerar')
    );
    expect(gerarCallsAposRerender.length).toBe(1);
  });

  it('modal com open=true e termoAssinaturaId nulo não chama nada (0 chamadas)', async () => {
    render(
      <AguardandoPacienteModal
        open={true}
        onClose={vi.fn()}
        escolha={{ metodoCodigo: 'DISPOSITIVO_PROPRIO_LOCAL', canalCodigo: null }}
        sessaoExternaPayload={{
          termoAssinaturaId: null,
          telefonePaciente: '11999998888',
        }}
        onAssinaturaConcluida={vi.fn()}
      />
    );

    await new Promise((resolve) => setTimeout(resolve, 50));

    const gerarCalls = fetch.mock.calls.filter(([url]) =>
      String(url).includes('/api/v1/assinaturas/externa/gerar')
    );
    expect(gerarCalls.length).toBe(0);
  });

  it('callback trocado entre renders é executado na versão nova, via ref, sem re-disparar o effect de geração', async () => {
    vi.useFakeTimers();

    fetch.mockImplementation((url) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/v1/assinaturas/externa/gerar')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              sessaoId: 'sess-polling',
              urlAssinatura: 'https://procedi.app/assinar/sess-polling',
            }),
        });
      }
      if (urlStr.includes('/status')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ status: 'CONCLUIDO' }),
        });
      }
      if (urlStr.includes('/termos/assinaturas/')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ statusCodigo: 'ASSINADO' }),
        });
      }
      return Promise.resolve({ ok: false });
    });

    const cb1 = vi.fn();
    const cb2 = vi.fn();

    const { rerender } = render(
      <AguardandoPacienteModal
        open={true}
        onClose={vi.fn()}
        escolha={{ metodoCodigo: 'DISPOSITIVO_PROPRIO_LOCAL', canalCodigo: null }}
        sessaoExternaPayload={{
          termoAssinaturaId: 'termo-123',
          telefonePaciente: '',
        }}
        onAssinaturaConcluida={cb1}
      />
    );

    // Processa a chamada inicial de gerar
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const gerarCalls = fetch.mock.calls.filter(([url]) =>
      String(url).includes('/api/v1/assinaturas/externa/gerar')
    );
    expect(gerarCalls.length).toBe(1);

    // Troca o callback via re-render do pai
    rerender(
      <AguardandoPacienteModal
        open={true}
        onClose={vi.fn()}
        escolha={{ metodoCodigo: 'DISPOSITIVO_PROPRIO_LOCAL', canalCodigo: null }}
        sessaoExternaPayload={{
          termoAssinaturaId: 'termo-123',
          telefonePaciente: '',
        }}
        onAssinaturaConcluida={cb2}
      />
    );

    // Não deve ter disparado nova chamada para /gerar
    const gerarCallsAposTroca = fetch.mock.calls.filter(([url]) =>
      String(url).includes('/api/v1/assinaturas/externa/gerar')
    );
    expect(gerarCallsAposTroca.length).toBe(1);

    // Avança o timer de polling (3000ms)
    await act(async () => {
      vi.advanceTimersByTime(3000);
      await Promise.resolve();
      await Promise.resolve();
    });

    // Avança o setTimeout do callback (1500ms)
    await act(async () => {
      vi.advanceTimersByTime(1500);
      await Promise.resolve();
    });

    expect(cb1).not.toHaveBeenCalled();
    expect(cb2).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it('fechar e reabrir o modal não exibe dados da sessão anterior — o estado volta ao inicial', async () => {
    let promiseForSecondCall = new Promise(() => {}); // nunca resolve para manter em loading

    let callCount = 0;
    fetch.mockImplementation((url) => {
      if (String(url).includes('/gerar')) {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                sessaoId: 'sess-reset-test',
                urlAssinatura: 'https://procedi.app/assinar/sess-reset',
              }),
          });
        }
        return promiseForSecondCall;
      }
      return Promise.resolve({ ok: false });
    });

    const { rerender } = render(
      <AguardandoPacienteModal
        open={true}
        onClose={vi.fn()}
        escolha={{ metodoCodigo: 'DISPOSITIVO_PROPRIO_LOCAL', canalCodigo: null }}
        sessaoExternaPayload={{
          termoAssinaturaId: 'termo-reset',
          telefonePaciente: '',
        }}
        onAssinaturaConcluida={vi.fn()}
      />
    );

    // Espera a primeira sessão carregar
    await waitFor(() => {
      expect(screen.getByText('Aguardando Paciente')).toBeInTheDocument();
    });

    // Fecha o modal
    rerender(
      <AguardandoPacienteModal
        open={false}
        onClose={vi.fn()}
        escolha={{ metodoCodigo: 'DISPOSITIVO_PROPRIO_LOCAL', canalCodigo: null }}
        sessaoExternaPayload={{
          termoAssinaturaId: 'termo-reset',
          telefonePaciente: '',
        }}
        onAssinaturaConcluida={vi.fn()}
      />
    );

    expect(screen.queryByText('Aguardando Paciente')).not.toBeInTheDocument();

    // Reabre o modal com nova sessão (a segunda requisição está pendente)
    rerender(
      <AguardandoPacienteModal
        open={true}
        onClose={vi.fn()}
        escolha={{ metodoCodigo: 'DISPOSITIVO_PROPRIO_LOCAL', canalCodigo: null }}
        sessaoExternaPayload={{
          termoAssinaturaId: 'termo-reset-2',
          telefonePaciente: '',
        }}
        onAssinaturaConcluida={vi.fn()}
      />
    );

    // O estado anterior (sessaoData com "Aguardando Paciente") foi resetado para loading ("Gerando sessão segura...")
    expect(screen.queryByText('Aguardando Paciente')).not.toBeInTheDocument();
    expect(screen.getByText('Gerando sessão segura...')).toBeInTheDocument();
  });
});
