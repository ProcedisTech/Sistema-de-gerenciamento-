import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

/**
 * Sessão entre abas (B-42 Frente 1). "Outra aba" é simulada como o supabase-js faz:
 * - o BroadcastChannel do supabase chama o callback do onAuthStateChange desta aba com o evento e a sessão
 *   da OUTRA aba, sem mexer no storage desta (GoTrueClient.js:247-261);
 * - o canal do app ('procedi-sessao') recebe { tipo: 'sair-global', userId } quando outra aba dá "Sair" global.
 */

const fake = vi.hoisted(() => ({
  /** Sessão guardada no sessionStorage DESTA aba. */
  sessaoDaAba: null,
  callbacks: [],
}));

vi.mock('../../lib/supabaseClient.js', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: fake.sessaoDaAba }, error: null })),
      onAuthStateChange: vi.fn((cb) => {
        fake.callbacks.push(cb);
        return {
          data: {
            subscription: {
              unsubscribe: () => {
                fake.callbacks = fake.callbacks.filter((c) => c !== cb);
              },
            },
          },
        };
      }),
      signOut: vi.fn(async () => {
        fake.sessaoDaAba = null;
        fake.callbacks.forEach((cb) => cb('SIGNED_OUT', null));
        return { error: null };
      }),
      signInWithPassword: vi.fn(),
    },
  },
}));

const toast = vi.hoisted(() => ({
  success: () => {},
  info: () => {},
  error: () => {},
  warning: () => {},
}));
vi.mock('../../contexts/useToast.js', () => ({ useToast: () => toast }));

import { supabase } from '../../lib/supabaseClient.js';
import { useAuthState } from './useAuthState';

/** BroadcastChannel falso: entrega às OUTRAS instâncias do mesmo nome (como o navegador). */
class CanalFalso {
  static instancias = [];
  constructor(nome) {
    this.nome = nome;
    this.listeners = new Set();
    this.enviadas = [];
    CanalFalso.instancias.push(this);
  }
  addEventListener(tipo, fn) {
    if (tipo === 'message') this.listeners.add(fn);
  }
  removeEventListener(tipo, fn) {
    if (tipo === 'message') this.listeners.delete(fn);
  }
  postMessage(data) {
    this.enviadas.push(data);
    CanalFalso.instancias
      .filter((c) => c !== this && c.nome === this.nome)
      .forEach((c) => setTimeout(() => c.listeners.forEach((fn) => fn({ data })), 0));
  }
  close() {
    CanalFalso.instancias = CanalFalso.instancias.filter((c) => c !== this);
  }
}

const sessao = (id) => ({
  access_token: `token-${id}`,
  user: { id, email: `${id}@clinica.test` },
});

/** Evento do supabase vindo de outra aba (broadcast): chega no callback desta aba. */
const eventoDeOutraAba = (evento, sessaoDaOutra) => {
  fake.callbacks.forEach((cb) => cb(evento, sessaoDaOutra));
};

/** Canal do app de outra aba. */
const outraAbaNoCanalDoApp = () => new CanalFalso('procedi-sessao');

/** Deixa correr o setTimeout 0 e as promessas do getSession. */
const assentar = async () => {
  for (let i = 0; i < 3; i += 1) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
};

const montar = async () => {
  const opcoes = { clearOrgSession: vi.fn() };
  const hook = renderHook(() => useAuthState(opcoes));
  await waitFor(() => expect(hook.result.current.authReady).toBe(true));
  return { ...hook, opcoes };
};

describe('useAuthState — sessão entre abas', () => {
  beforeEach(() => {
    fake.sessaoDaAba = null;
    fake.callbacks = [];
    CanalFalso.instancias = [];
    vi.stubGlobal('BroadcastChannel', CanalFalso);
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('linha 1: outra aba sai por inatividade (scope local) → esta aba não muda nada', async () => {
    fake.sessaoDaAba = sessao('u1');
    const { result } = await montar();
    expect(result.current.authUser?.id).toBe('u1');

    // Inatividade: a outra aba faz signOut local → o supabase só transmite SIGNED_OUT; o app não publica nada.
    eventoDeOutraAba('SIGNED_OUT', null);
    await assentar();

    expect(result.current.isLoggedIn).toBe(true);
    expect(result.current.authUser?.id).toBe('u1');
    expect(supabase.auth.signOut).not.toHaveBeenCalled();
  });

  it('linha 2: mesmo usuário clica "Sair" (scope global) em outra aba → esta aba também sai, sem republicar', async () => {
    fake.sessaoDaAba = sessao('u1');
    const { result, opcoes } = await montar();
    const outra = outraAbaNoCanalDoApp();

    eventoDeOutraAba('SIGNED_OUT', null);
    outra.postMessage({ tipo: 'sair-global', userId: 'u1' });
    await assentar();

    expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
    expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(result.current.isLoggedIn).toBe(false);
    expect(result.current.authUser).toBeNull();
    expect(opcoes.clearOrgSession).toHaveBeenCalled();
    const minhaAba = CanalFalso.instancias.find((c) => c !== outra);
    expect(minhaAba.enviadas).toEqual([]);
  });

  it('linha 2 (quem clica): "Sair" global publica sair-global com o usuário; inatividade (local) não publica', async () => {
    fake.sessaoDaAba = sessao('u1');
    const { result } = await montar();
    const minhaAba = CanalFalso.instancias[0];

    await act(async () => {
      await result.current.handleLogout({ scope: 'local' });
    });
    expect(minhaAba.enviadas).toEqual([]);

    // A aba loga de novo (guarda de saída única: só sai quem está logado).
    fake.sessaoDaAba = sessao('u1');
    eventoDeOutraAba('SIGNED_IN', sessao('u1'));
    await assentar();
    expect(result.current.isLoggedIn).toBe(true);
    await act(async () => {
      await result.current.handleLogout();
    });
    expect(supabase.auth.signOut).toHaveBeenLastCalledWith({ scope: 'global' });
    expect(minhaAba.enviadas).toEqual([{ tipo: 'sair-global', userId: 'u1' }]);
  });

  it('linha 3: outro usuário sai, por qualquer caminho → esta aba não muda nada', async () => {
    fake.sessaoDaAba = sessao('u1');
    const { result } = await montar();
    const outra = outraAbaNoCanalDoApp();

    // inatividade/local do outro usuário
    eventoDeOutraAba('SIGNED_OUT', null);
    await assentar();
    // "Sair" global do outro usuário
    eventoDeOutraAba('SIGNED_OUT', null);
    outra.postMessage({ tipo: 'sair-global', userId: 'u2' });
    await assentar();

    expect(supabase.auth.signOut).not.toHaveBeenCalled();
    expect(result.current.isLoggedIn).toBe(true);
    expect(result.current.authUser?.id).toBe('u1');
  });

  it('linha 4: outro usuário renova o acesso ou loga (TOKEN_REFRESHED / SIGNED_IN) → ignora, não troca o usuário', async () => {
    fake.sessaoDaAba = sessao('u1');
    const { result } = await montar();
    const antes = result.current.authUser;

    eventoDeOutraAba('TOKEN_REFRESHED', sessao('u2'));
    await assentar();
    eventoDeOutraAba('SIGNED_IN', sessao('u2'));
    await assentar();

    expect(result.current.isLoggedIn).toBe(true);
    expect(result.current.authUser?.id).toBe('u1');
    expect(result.current.authUser).toBe(antes);
  });

  it('linha 5: esta aba está deslogada e outra loga ou renova → continua no login', async () => {
    fake.sessaoDaAba = null;
    const { result } = await montar();
    expect(result.current.isLoggedIn).toBe(false);

    eventoDeOutraAba('SIGNED_IN', sessao('u2'));
    await assentar();
    eventoDeOutraAba('TOKEN_REFRESHED', sessao('u2'));
    await assentar();

    expect(result.current.isLoggedIn).toBe(false);
    expect(result.current.authUser).toBeNull();
  });
});
