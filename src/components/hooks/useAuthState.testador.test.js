import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

/**
 * B-42 Frente 1 — testes do testador T1 (complementam useAuthState.test.js).
 * Fake do supabase-js 2.109 (auth-js GoTrueClient.js):
 * - onAuthStateChange emite INITIAL_SESSION assíncrono depois de registrar (:3539-3575);
 * - signOut remove a sessão do storage desta aba e notifica SIGNED_OUT (:3326-3351, _removeSession :4265-4284);
 * - evento de outra aba chega no callback com a sessão da OUTRA aba, sem mexer no storage desta (:240-261, :4196-4221).
 */

const fake = vi.hoisted(() => ({
  sessaoDaAba: null,
  callbacks: [],
}));

vi.mock('../../lib/supabaseClient.js', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: fake.sessaoDaAba }, error: null })),
      onAuthStateChange: vi.fn((cb) => {
        fake.callbacks.push(cb);
        Promise.resolve().then(() => {
          if (fake.callbacks.includes(cb)) cb('INITIAL_SESSION', fake.sessaoDaAba);
        });
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
  success: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
}));
vi.mock('../../contexts/useToast.js', () => ({ useToast: () => toast }));

import { supabase } from '../../lib/supabaseClient.js';
import { useAuthState } from './useAuthState';

class CanalFalso {
  static instancias = [];
  constructor(nome) {
    this.nome = nome;
    this.listeners = new Set();
    this.enviadas = [];
    this.fechado = false;
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
    this.fechado = true;
    CanalFalso.instancias = CanalFalso.instancias.filter((c) => c !== this);
  }
}

const sessao = (id, token = `token-${id}`) => ({
  access_token: token,
  user: { id, email: `${id}@clinica.test` },
});

const emitir = (evento, sessaoDoEvento) => {
  fake.callbacks.forEach((cb) => cb(evento, sessaoDoEvento));
};

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
  await assentar();
  return { ...hook, opcoes };
};

const canalDoApp = () => CanalFalso.instancias.find((c) => c.nome === 'procedi-sessao');

describe('useAuthState — testador T1 (B-42 F1)', () => {
  beforeEach(() => {
    fake.sessaoDaAba = null;
    fake.callbacks = [];
    CanalFalso.instancias = [];
    vi.stubGlobal('BroadcastChannel', CanalFalso);
    vi.clearAllMocks();
    supabase.auth.getSession.mockImplementation(async () => ({
      data: { session: fake.sessaoDaAba },
      error: null,
    }));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('eventos da PRÓPRIA aba continuam valendo', () => {
    it('login nesta aba (SIGNED_IN com o storage desta aba gravado) → entra', async () => {
      const { result } = await montar();
      expect(result.current.isLoggedIn).toBe(false);

      fake.sessaoDaAba = sessao('u1');
      emitir('SIGNED_IN', sessao('u1'));
      await assentar();

      expect(result.current.isLoggedIn).toBe(true);
      expect(result.current.authUser).toEqual({ id: 'u1', email: 'u1@clinica.test' });
    });

    it('handleLogin desta aba → logado e o SIGNED_IN que vem depois não desfaz', async () => {
      supabase.auth.signInWithPassword.mockImplementation(async () => {
        fake.sessaoDaAba = sessao('u1');
        emitir('SIGNED_IN', fake.sessaoDaAba);
        return { data: { user: fake.sessaoDaAba.user }, error: null };
      });
      const { result } = await montar();
      act(() => {
        result.current.setUsername('u1@clinica.test');
        result.current.setPassword('x');
      });
      await act(async () => {
        await result.current.handleLogin({ preventDefault: () => {} });
      });
      await assentar();

      expect(result.current.isLoggedIn).toBe(true);
      expect(result.current.authUser?.id).toBe('u1');
    });

    it('TOKEN_REFRESHED / INITIAL_SESSION desta aba (mesmo usuário, token novo) → continua, sem trocar o objeto', async () => {
      fake.sessaoDaAba = sessao('u1');
      const { result } = await montar();
      const antes = result.current.authUser;

      fake.sessaoDaAba = sessao('u1', 'token-novo');
      emitir('TOKEN_REFRESHED', fake.sessaoDaAba);
      await assentar();
      emitir('INITIAL_SESSION', fake.sessaoDaAba);
      await assentar();

      expect(result.current.isLoggedIn).toBe(true);
      expect(result.current.authUser).toBe(antes);
    });

    it('INITIAL_SESSION emitido pelo próprio onAuthStateChange no início não derruba a sessão da aba', async () => {
      fake.sessaoDaAba = sessao('u1');
      const { result } = await montar();
      expect(result.current.isLoggedIn).toBe(true);
      expect(result.current.authUser?.id).toBe('u1');
    });

    it('SIGNED_OUT desta aba (storage desta aba apagado) → sai', async () => {
      fake.sessaoDaAba = sessao('u1');
      const { result } = await montar();

      fake.sessaoDaAba = null;
      emitir('SIGNED_OUT', null);
      await assentar();

      expect(result.current.isLoggedIn).toBe(false);
      expect(result.current.authUser).toBeNull();
    });
  });

  describe('callback do onAuthStateChange', () => {
    it('não chama método do supabase dentro do callback (adiado) e não devolve promessa', async () => {
      fake.sessaoDaAba = sessao('u1');
      await montar();
      const chamadasAntes = supabase.auth.getSession.mock.calls.length;

      const retornos = fake.callbacks.map((cb) => cb('TOKEN_REFRESHED', sessao('u2')));

      expect(supabase.auth.getSession.mock.calls.length).toBe(chamadasAntes);
      retornos.forEach((r) => expect(r).toBeUndefined());
      await assentar();
      expect(supabase.auth.getSession.mock.calls.length).toBe(chamadasAntes + 1);
    });

    it('rajada de eventos: só a leitura mais recente vale (resposta velha que chega depois é ignorada)', async () => {
      fake.sessaoDaAba = sessao('u1');
      const { result } = await montar();

      let soltarVelha;
      let soltarNova;
      supabase.auth.getSession
        .mockImplementationOnce(
          () => new Promise((r) => {
            soltarVelha = () => r({ data: { session: null }, error: null });
          }),
        )
        .mockImplementationOnce(
          () => new Promise((r) => {
            soltarNova = () => r({ data: { session: sessao('u1') }, error: null });
          }),
        );

      emitir('SIGNED_OUT', null);
      await assentar();
      emitir('TOKEN_REFRESHED', sessao('u1'));
      await assentar();

      await act(async () => {
        soltarNova();
      });
      await act(async () => {
        soltarVelha();
      });
      await assentar();

      expect(result.current.isLoggedIn).toBe(true);
      expect(result.current.authUser?.id).toBe('u1');
    });

    it('getSession rejeita depois de um evento → mantém o estado atual, sem rejeição solta', async () => {
      fake.sessaoDaAba = sessao('u1');
      const { result } = await montar();
      const soltas = [];
      const onRej = (e) => soltas.push(e);
      globalThis.process.on('unhandledRejection', onRej);
      try {
        supabase.auth.getSession.mockImplementationOnce(async () => {
          throw new Error('lock timeout');
        });
        emitir('SIGNED_OUT', null);
        await assentar();
      } finally {
        globalThis.process.off('unhandledRejection', onRej);
      }

      expect(soltas).toEqual([]);
      expect(result.current.isLoggedIn).toBe(true);
      expect(result.current.authUser?.id).toBe('u1');
    });
  });

  describe('canal do app (procedi-sessao)', () => {
    it('getSession rejeita ao receber sair-global → não sai', async () => {
      fake.sessaoDaAba = sessao('u1');
      const { result } = await montar();
      const outra = new CanalFalso('procedi-sessao');
      supabase.auth.getSession.mockImplementationOnce(async () => {
        throw new Error('falhou');
      });

      outra.postMessage({ tipo: 'sair-global', userId: 'u1' });
      await assentar();

      expect(supabase.auth.signOut).not.toHaveBeenCalled();
      expect(result.current.isLoggedIn).toBe(true);
    });

    it('sair-global chega ANTES do SIGNED_OUT do supabase → também sai (ordem não importa)', async () => {
      fake.sessaoDaAba = sessao('u1');
      const { result } = await montar();
      const outra = new CanalFalso('procedi-sessao');

      outra.postMessage({ tipo: 'sair-global', userId: 'u1' });
      await assentar();
      emitir('SIGNED_OUT', null);
      await assentar();

      expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
      expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
      expect(result.current.isLoggedIn).toBe(false);
    });

    it('sair-global do mesmo usuário com esta aba já deslogada, ou mensagem estranha → não faz nada', async () => {
      const { result } = await montar();
      const outra = new CanalFalso('procedi-sessao');

      outra.postMessage({ tipo: 'sair-global', userId: 'u1' });
      outra.postMessage({ tipo: 'outra-coisa', userId: 'u1' });
      outra.postMessage({ tipo: 'sair-global' });
      outra.postMessage(null);
      await assentar();

      expect(supabase.auth.signOut).not.toHaveBeenCalled();
      expect(result.current.isLoggedIn).toBe(false);
    });

    it('sem laço: depois de sair pela mensagem, nenhuma mensagem nova circula no canal', async () => {
      fake.sessaoDaAba = sessao('u1');
      await montar();
      const outra = new CanalFalso('procedi-sessao');

      outra.postMessage({ tipo: 'sair-global', userId: 'u1' });
      await assentar();
      await assentar();

      const total = CanalFalso.instancias.reduce((n, c) => n + c.enviadas.length, 0);
      expect(total).toBe(1);
      expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
    });

    it('"Sair" global com getSession rejeitando → faz signOut e desloga, mas não publica', async () => {
      fake.sessaoDaAba = sessao('u1');
      const { result } = await montar();
      supabase.auth.getSession.mockImplementationOnce(async () => {
        throw new Error('falhou');
      });

      await act(async () => {
        await result.current.handleLogout();
      });

      expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: 'global' });
      expect(canalDoApp().enviadas).toEqual([]);
      expect(result.current.isLoggedIn).toBe(false);
    });

    it('"Sair" pelo botão (handleLogout recebe o evento de clique) → global e publica', async () => {
      fake.sessaoDaAba = sessao('u1');
      const { result } = await montar();

      await act(async () => {
        await result.current.handleLogout({ type: 'click' });
      });

      expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: 'global' });
      expect(canalDoApp().enviadas).toEqual([{ tipo: 'sair-global', userId: 'u1' }]);
    });

    it('auth:expired com scope local (inatividade) → sai sem publicar', async () => {
      fake.sessaoDaAba = sessao('u1');
      const { result } = await montar();

      await act(async () => {
        window.dispatchEvent(new CustomEvent('auth:expired', { detail: { scope: 'local' } }));
      });
      await assentar();

      expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
      expect(canalDoApp().enviadas).toEqual([]);
      expect(result.current.isLoggedIn).toBe(false);
    });
  });

  describe('unmount', () => {
    it('fecha o canal, tira o listener e mensagem posterior não faz nada', async () => {
      fake.sessaoDaAba = sessao('u1');
      const { unmount } = await montar();
      const meu = canalDoApp();
      const outra = new CanalFalso('procedi-sessao');

      unmount();

      expect(meu.fechado).toBe(true);
      expect(meu.listeners.size).toBe(0);
      expect(CanalFalso.instancias).toEqual([outra]);
      outra.postMessage({ tipo: 'sair-global', userId: 'u1' });
      await assentar();
      expect(supabase.auth.signOut).not.toHaveBeenCalled();
    });

    it('evento com leitura adiada pendente e unmount → a leitura não acontece (timer limpo)', async () => {
      fake.sessaoDaAba = sessao('u1');
      const { unmount } = await montar();
      const chamadasAntes = supabase.auth.getSession.mock.calls.length;

      emitir('TOKEN_REFRESHED', sessao('u2'));
      unmount();
      await assentar();

      expect(supabase.auth.getSession.mock.calls.length).toBe(chamadasAntes);
      expect(fake.callbacks).toEqual([]);
    });
  });

  describe('B-42 FD — saída (T8-T11 e storage)', () => {
    const MENSAGEM = 'Sua sessão expirou. Faça login novamente.';
    const CPF = '12345678901';
    const CHAVE_SB = 'sb-refteste-auth-token';
    const FILA = 'procedi_consulta_fila_u1_at-1';
    const FILA_VALOR = '{"modulo":null,"itens":{"i1":{"descricao":"x"}}}';

    const expirar = async (detail) => {
      await act(async () => {
        window.dispatchEvent(new CustomEvent('auth:expired', { detail }));
      });
    };

    const semearStorage = () => {
      sessionStorage.setItem(CHAVE_SB, '{"access_token":"tok"}');
      sessionStorage.setItem(`${CHAVE_SB}-code-verifier`, 'cv');
      sessionStorage.setItem(`${CHAVE_SB}-user`, '{"id":"u1"}');
      sessionStorage.setItem('procedi_last_activity', String(Date.now()));
      sessionStorage.setItem('selectedPatientCpf', CPF);
      sessionStorage.setItem('activePatientCpf', CPF);
      sessionStorage.setItem('patientView', 'profile');
      sessionStorage.setItem('patientDetailTab', 'geral');
      sessionStorage.setItem('activeView', 'pacientes');
      sessionStorage.setItem(`procedi_bday_modal_${CPF}_2026-10-11`, '1');
      sessionStorage.setItem(FILA, FILA_VALOR);
      sessionStorage.setItem('procedi_config_tab', 'equipe');
      localStorage.setItem('procedi_paciente_foto_p1', 'blob');
      localStorage.setItem('procedi.sidebar.desktopCollapsed', 'true');
    };

    beforeEach(() => {
      sessionStorage.clear();
      localStorage.clear();
      vi.stubEnv('VITE_SUPABASE_URL', 'https://refteste.supabase.co');
    });
    afterEach(() => {
      vi.useRealTimers();
      vi.unstubAllEnvs();
      sessionStorage.clear();
      localStorage.clear();
    });

    it('T8: signOut pendurado (scope local) → sai em 3 s mesmo assim', async () => {
      fake.sessaoDaAba = sessao('u1');
      const { result } = await montar();
      supabase.auth.signOut.mockImplementationOnce(() => new Promise(() => {}));
      vi.useFakeTimers();

      await expirar({ scope: 'local' });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2999);
      });
      expect(result.current.isLoggedIn).toBe(true);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });
      expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
      expect(result.current.isLoggedIn).toBe(false);
    });

    it('(b) sb-* (token, code-verifier, user) e procedi_last_activity somem mesmo com o signOut pendurado', async () => {
      fake.sessaoDaAba = sessao('u1');
      await montar();
      semearStorage();
      supabase.auth.signOut.mockImplementationOnce(() => new Promise(() => {}));
      vi.useFakeTimers();

      await expirar({ scope: 'local' });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });

      expect(sessionStorage.getItem(CHAVE_SB)).toBeNull();
      expect(sessionStorage.getItem(`${CHAVE_SB}-code-verifier`)).toBeNull();
      expect(sessionStorage.getItem(`${CHAVE_SB}-user`)).toBeNull();
      expect(sessionStorage.getItem('procedi_last_activity')).toBeNull();
    });

    it('(b) usa a chave do próprio cliente supabase (auth.storageKey) quando existe', async () => {
      fake.sessaoDaAba = sessao('u1');
      await montar();
      supabase.auth.storageKey = 'sb-docliente-auth-token';
      try {
        sessionStorage.setItem('sb-docliente-auth-token', '{}');
        sessionStorage.setItem('sb-docliente-auth-token-code-verifier', 'cv');
        await expirar({ scope: 'local' });
        await assentar();
        expect(sessionStorage.getItem('sb-docliente-auth-token')).toBeNull();
        expect(sessionStorage.getItem('sb-docliente-auth-token-code-verifier')).toBeNull();
      } finally {
        delete supabase.auth.storageKey;
      }
    });

    it('(a) saída por inatividade: a fila de envios procedi_consulta_fila_<user>_<id> continua no storage', async () => {
      fake.sessaoDaAba = sessao('u1');
      const { result } = await montar();
      semearStorage();

      await expirar({ scope: 'local' });
      await assentar();

      expect(result.current.isLoggedIn).toBe(false);
      expect(sessionStorage.getItem(FILA)).toBe(FILA_VALOR);
      // preferência/layout também ficam
      expect(sessionStorage.getItem('procedi_config_tab')).toBe('equipe');
      expect(localStorage.getItem('procedi.sidebar.desktopCollapsed')).toBe('true');
    });

    it('(c) depois da saída nenhuma chave do sessionStorage contém o CPF; tela, org e foto saem', async () => {
      fake.sessaoDaAba = sessao('u1');
      const { result, opcoes } = await montar();
      semearStorage();

      await expirar({ scope: 'local' });
      await assentar();

      expect(result.current.isLoggedIn).toBe(false);
      const comCpf = Object.keys(sessionStorage).filter(
        (k) => k.includes(CPF) || String(sessionStorage.getItem(k)).includes(CPF),
      );
      expect(comCpf).toEqual([]);
      ['patientView', 'patientDetailTab', 'activeView'].forEach((k) => {
        expect(sessionStorage.getItem(k)).toBeNull();
      });
      expect(localStorage.getItem('procedi_paciente_foto_p1')).toBeNull();
      expect(opcoes.clearOrgSession).toHaveBeenCalledTimes(1);
    });

    it('T9: renovação recusada → banner do login com a mensagem, sem toast "Sessão encerrada."', async () => {
      fake.sessaoDaAba = sessao('u1');
      const { result } = await montar();

      await expirar({ scope: 'local', motivo: 'renovacao' });
      await assentar();

      expect(result.current.isLoggedIn).toBe(false);
      expect(result.current.loginError).toBe(MENSAGEM);
      expect(toast.info).not.toHaveBeenCalled();
    });

    it('T9: inatividade (sem motivo) → toast "Sessão encerrada." e banner vazio', async () => {
      fake.sessaoDaAba = sessao('u1');
      const { result } = await montar();

      await expirar({ scope: 'local' });
      await assentar();

      expect(result.current.isLoggedIn).toBe(false);
      expect(result.current.loginError).toBe('');
      expect(toast.info).toHaveBeenCalledWith('Sessão encerrada.');
    });

    it('T10: uma saída só — eventos em rajada e evento atrasado depois de sair não repetem a saída', async () => {
      fake.sessaoDaAba = sessao('u1');
      const { result, opcoes } = await montar();

      await act(async () => {
        window.dispatchEvent(new CustomEvent('auth:expired', { detail: { scope: 'local', motivo: 'renovacao' } }));
        window.dispatchEvent(new CustomEvent('auth:expired', { detail: { scope: 'local' } }));
        window.dispatchEvent(new CustomEvent('auth:expired', { detail: { scope: 'local', motivo: 'renovacao' } }));
      });
      await assentar();
      await expirar({ scope: 'local' });
      await assentar();

      expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
      expect(opcoes.clearOrgSession).toHaveBeenCalledTimes(1);
      expect(toast.info).not.toHaveBeenCalled();
      expect(result.current.loginError).toBe(MENSAGEM);
    });

    it('T11: renovação recusada (scope local) nunca publica sair-global — a outra aba continua', async () => {
      fake.sessaoDaAba = sessao('u1');
      await montar();
      const outra = new CanalFalso('procedi-sessao');
      const recebidas = [];
      outra.addEventListener('message', (ev) => recebidas.push(ev.data));

      await expirar({ scope: 'local', motivo: 'renovacao' });
      await assentar();

      expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
      expect(canalDoApp().enviadas).toEqual([]);
      expect(recebidas).toEqual([]);
    });
  });
});
