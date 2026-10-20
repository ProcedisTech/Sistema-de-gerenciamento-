import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

/**
 * B-42 FD — testador T-FD: a saída limpa a chave do supabase-js REAL (2.109), não só a de um mock.
 * Cliente real com o mesmo formato do src/lib/supabaseClient.js (storage: sessionStorage). O signOut real
 * recebe erro de rede (fetch rejeita) e, por isso, NÃO apaga a sessão (GoTrueClient signOut retorna antes do
 * _removeSession); quem apaga é o app.
 */

const rede = vi.hoisted(() => ({ fetch: null }));

vi.mock('../../lib/supabaseClient.js', async () => {
  const { createClient } = await import('@supabase/supabase-js');
  return {
    supabase: createClient('https://refreal.supabase.co', 'chave-publica-teste', {
      auth: { storage: window.sessionStorage, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: (...args) => rede.fetch(...args) },
    }),
  };
});

const toast = vi.hoisted(() => ({ success: vi.fn(), info: vi.fn(), error: vi.fn(), warning: vi.fn() }));
vi.mock('../../contexts/useToast.js', () => ({ useToast: () => toast }));

import { supabase } from '../../lib/supabaseClient.js';
import { useAuthState } from './useAuthState';

const CHAVE = 'sb-refreal-auth-token';
const FILA = 'procedi_consulta_fila_u1_at-1';

const sessaoGravada = () => ({
  access_token: 'tok-acesso',
  refresh_token: 'tok-refresh',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: { id: 'u1', email: 'u1@clinica.test', aud: 'authenticated', app_metadata: {}, user_metadata: {} },
});

describe('useAuthState com o supabase-js real (T-FD)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    rede.fetch = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    vi.stubGlobal('BroadcastChannel', undefined);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  it('a chave do cliente real é sb-<ref>-auth-token (a mesma que o fallback calcula)', () => {
    expect(supabase.auth.storageKey).toBe(CHAVE);
    const host = new URL('https://refreal.supabase.co').hostname.split('.')[0];
    expect(`sb-${host}-auth-token`).toBe(CHAVE);
  });

  it('renovação recusada com signOut sem rede → a sessão do supabase real some do storage; a fila fica', async () => {
    sessionStorage.setItem(CHAVE, JSON.stringify(sessaoGravada()));
    sessionStorage.setItem(`${CHAVE}-code-verifier`, 'cv');
    sessionStorage.setItem(FILA, '{"itens":{}}');

    const { result } = renderHook(() => useAuthState({ clearOrgSession: vi.fn() }));
    await waitFor(() => expect(result.current.isLoggedIn).toBe(true));

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent('auth:expired', { detail: { scope: 'local', motivo: 'renovacao' } }),
      );
    });
    await waitFor(() => expect(result.current.isLoggedIn).toBe(false));

    // o signOut real tentou o servidor e falhou por rede (ele mesmo não apagou a sessão)
    expect(rede.fetch).toHaveBeenCalled();
    expect(sessionStorage.getItem(CHAVE)).toBeNull();
    expect(sessionStorage.getItem(`${CHAVE}-code-verifier`)).toBeNull();
    expect(sessionStorage.getItem(FILA)).toBe('{"itens":{}}');
    const { data } = await supabase.auth.getSession();
    expect(data.session).toBeNull();
    expect(result.current.loginError).toBe('Sua sessão expirou. Faça login novamente.');
  });
});
