import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/api.js', () => ({
  setOrgId: vi.fn(),
  getOrgId: () => '',
  authHeadersForFetch: vi.fn(async () => ({ Authorization: 'Bearer t', 'X-Org-Id': 'org' })),
}));
vi.mock('../../utils/authMeProbe', () => ({ invalidateAuthMeCache: vi.fn() }));

import { OrgProvider, useOrg } from '../../contexts/OrgContext';
import { invalidateAuthMeCache } from '../../utils/authMeProbe';
import { useContextoOrgMe, LIMITE_CONTEXTO_SEM_ME_MS, TIMEOUT_ME_MS } from './useContextoOrgMe';
import { useFusoClinica } from './useFusoClinica';
import { useAgoraDaClinica } from './useAgoraDaClinica';
import { ContextoClinicaTela } from '../system/ContextoClinicaGate.jsx';
import { estadoGateContexto } from '../system/estadoGateContexto.js';

const ORG = '330e8b5c-8687-48dd-a534-d12aea1d5cd7';
const OTHER = 'd0000000-0000-0000-0000-0000000000aa';
const AC = 'America/Rio_Branco';

let org;
let agoraCapturado;

function capturar(orgAtual, agoraAtual) {
  org = orgAtual;
  agoraCapturado = agoraAtual;
}

function Shell() {
  useContextoOrgMe({ authReady: true, isLoggedIn: true });
  const orgAtual = useOrg();
  const { fuso } = useFusoClinica();
  const agoraAtual = useAgoraDaClinica();
  React.useLayoutEffect(() => capturar(orgAtual, agoraAtual));
  const estado = estadoGateContexto({ orgId: orgAtual.orgId, contextStatus: orgAtual.contextStatus });
  if (estado) return <ContextoClinicaTela estado={estado} onTentarDeNovo={orgAtual.recarregarContextoOrg} />;
  return <div data-testid="shell">shell {fuso} {orgAtual.permissoes.join(',')}</div>;
}

function renderShell() {
  return render(<OrgProvider><Shell /></OrgProvider>);
}

function meResponse(body) {
  return { ok: true, status: 200, json: async () => body };
}

function meBody(orgId = ORG, fusoHorario = AC) {
  return {
    organizacaoId: orgId,
    fusoHorario,
    roleUserId: 'vinculo',
    perfilAcessoCodigo: 'RECEPCAO',
    permissoes: ['PACIENTE_VER'],
    apareceNaAgenda: false,
  };
}

function deferred() {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
}

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

describe('useContextoOrgMe — fonte do fuso e F5', () => {
  let fetchMock;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('procedi_org_id', ORG);
    fetchMock = vi.fn(async (url) => {
      if (String(url).includes('/api/v1/clinica')) return { ok: false, status: 403, json: async () => ({}) };
      return meResponse(meBody());
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.mocked(invalidateAuthMeCache).mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  const chamadasMe = () => fetchMock.mock.calls.filter(([u]) => String(u).includes('/api/auth/me'));

  it('perfil sem permissão de clínica numa clínica AC recebe America/Rio_Branco do /me (sem chamar /api/v1/clinica)', async () => {
    fetchMock.mockImplementation(async (url) => {
      if (String(url).includes('/api/v1/clinica')) return { ok: false, status: 403, json: async () => ({}) };
      return meResponse({ ...meBody(), permissoes: [] });
    });
    renderShell();
    await flush();
    expect(screen.getByTestId('shell').textContent).toContain(AC);
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('/api/v1/clinica'))).toBe(false);
  });

  it('antes do /me responder não há fuso nem "hoje" e o shell fica em "Preparando sessão…"', async () => {
    const d = deferred();
    fetchMock.mockImplementation(() => d.promise);
    renderShell();
    expect(screen.getByText('Preparando sessão…')).toBeTruthy();
    expect(agoraCapturado).toMatchObject({ pronto: false, hojeIso: null, minutos: null });
    await act(async () => { d.resolve(meResponse(meBody())); });
    await flush();
    expect(screen.getByTestId('shell')).toBeTruthy();
    expect(agoraCapturado.pronto).toBe(true);
  });

  it('F5 ordem 1: /me resolve e depois setOrgId(mesmo id) não reseta nada', async () => {
    renderShell();
    await flush();
    expect(org.contextStatus).toBe('ready');
    act(() => org.setOrgId(ORG, 'clinica-top'));
    await flush();
    expect(org).toMatchObject({ contextStatus: 'ready', fusoHorario: AC, permissoes: ['PACIENTE_VER'], orgSlug: 'clinica-top' });
    expect(invalidateAuthMeCache).not.toHaveBeenCalled();
    expect(chamadasMe()).toHaveLength(1);
    expect(screen.getByTestId('shell')).toBeTruthy();
    expect(screen.queryByText('Preparando sessão…')).toBeNull();
  });

  it('F5 ordem 2: setOrgId(mesmo id) antes do /me responder', async () => {
    const d = deferred();
    fetchMock.mockImplementation(() => d.promise);
    renderShell();
    act(() => org.setOrgId(ORG));
    await act(async () => { d.resolve(meResponse(meBody())); });
    await flush();
    expect(chamadasMe()).toHaveLength(1);
    expect(org).toMatchObject({ contextStatus: 'ready', fusoHorario: AC });
    expect(screen.getByTestId('shell')).toBeTruthy();
  });

  it('troca real de clínica zera o fuso e só volta com o /me da nova clínica', async () => {
    renderShell();
    await flush();
    const d = deferred();
    fetchMock.mockImplementation(() => d.promise);
    act(() => org.setOrgId(OTHER));
    expect(org.fusoHorario).toBeNull();
    expect(screen.getByText('Preparando sessão…')).toBeTruthy();
    await act(async () => { d.resolve(meResponse(meBody(OTHER, 'America/Sao_Paulo'))); });
    await flush();
    expect(org).toMatchObject({ orgId: OTHER, contextStatus: 'ready', fusoHorario: 'America/Sao_Paulo' });
  });

  it('logout seguido da mesma clínica recarrega o /me e o fuso', async () => {
    renderShell();
    await flush();
    act(() => org.clearOrgSession());
    expect(org.fusoHorario).toBeNull();
    act(() => org.setOrgId(ORG));
    expect(org.contextStatus).toBe('loading');
    await flush();
    expect(chamadasMe()).toHaveLength(2);
    expect(org).toMatchObject({ contextStatus: 'ready', fusoHorario: AC });
  });

  it('salvar a UF (recarregarContextoOrg) troca o fuso sem voltar a "Preparando sessão…"', async () => {
    renderShell();
    await flush();
    const d = deferred();
    fetchMock.mockImplementation(() => d.promise);
    act(() => org.recarregarContextoOrg());
    expect(invalidateAuthMeCache).toHaveBeenCalledTimes(1);
    expect(org.contextStatus).toBe('ready');
    expect(screen.getByTestId('shell').textContent).toContain(AC);
    await act(async () => { d.resolve(meResponse(meBody(ORG, 'America/Sao_Paulo'))); });
    await flush();
    expect(screen.getByTestId('shell').textContent).toContain('America/Sao_Paulo');
  });

  it.each([
    // 23:30 de Brasília: o dia é o mesmo, mas 22:00 deixa de ter passado em Rio Branco (21:30)
    ['2026-10-02T02:30:00Z', '2026-10-01', true, '2026-10-01', false],
    // 00:30 de Brasília (22:30 em Rio Branco): o "hoje" volta para 01/10 e 22:00 passa a ter passado
    ['2026-10-02T03:30:00Z', '2026-10-02', false, '2026-10-01', true],
  ])('trocar a UF de DF para AC em %s recalcula "hoje" e "já passou" sem remontar', async (utc, hojeDf, passouDf, hojeAc, passouAc) => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(utc));
    fetchMock.mockImplementation(async () => meResponse(meBody(ORG, 'America/Sao_Paulo')));
    const { container } = renderShell();
    await flush();
    const shellNode = container.querySelector('[data-testid="shell"]');
    const slot2200Passou = () => agoraCapturado.minutos >= 22 * 60;
    expect(agoraCapturado.hojeIso).toBe(hojeDf);
    expect(slot2200Passou()).toBe(passouDf);
    fetchMock.mockImplementation(async () => meResponse(meBody(ORG, AC)));
    act(() => org.recarregarContextoOrg());
    await flush();
    expect(agoraCapturado.hojeIso).toBe(hojeAc);
    expect(slot2200Passou()).toBe(passouAc);
    expect(container.querySelector('[data-testid="shell"]')).toBe(shellNode);
  });

  it('/me com erro mostra "Tentar de novo" e nunca usa o padrão', async () => {
    fetchMock.mockImplementation(async () => ({ ok: false, status: 500, json: async () => ({}) }));
    renderShell();
    await flush();
    expect(org).toMatchObject({ contextStatus: 'error', fusoHorario: null });
    fetchMock.mockImplementation(async () => meResponse(meBody()));
    fireEvent.click(screen.getByText('Tentar de novo'));
    await flush();
    expect(screen.getByTestId('shell')).toBeTruthy();
  });

  it('watchdog: loading sem /me em andamento vira erro com "Tentar de novo"', async () => {
    vi.useFakeTimers();
    renderShell();
    await flush();
    expect(org.contextStatus).toBe('ready');
    act(() => org.setContextStatus('loading'));
    expect(screen.getByText('Preparando sessão…')).toBeTruthy();
    await act(async () => { await vi.advanceTimersByTimeAsync(LIMITE_CONTEXTO_SEM_ME_MS - 1); });
    expect(screen.queryByText('Tentar de novo')).toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(2); });
    expect(screen.getByText('Tentar de novo')).toBeTruthy();
    fireEvent.click(screen.getByText('Tentar de novo'));
    await flush();
    expect(screen.getByTestId('shell')).toBeTruthy();
  });

  it('timeout do /me (15 s) leva ao erro; o watchdog não dispara antes', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation((_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new Error('abort')));
    }));
    renderShell();
    await act(async () => { await vi.advanceTimersByTimeAsync(LIMITE_CONTEXTO_SEM_ME_MS + 1000); });
    expect(org.contextStatus).toBe('loading');
    await act(async () => { await vi.advanceTimersByTimeAsync(TIMEOUT_ME_MS); });
    expect(org.contextStatus).toBe('error');
    expect(screen.getByText('Tentar de novo')).toBeTruthy();
  });
});
