/**
 * Auth via Supabase (signInWithPassword / signOut) + JWT em api.js (Authorization: Bearer) para o backend Java.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient.js';
import { useToast } from '../../contexts/useToast.js';
import { SESSION_STORAGE_KEY } from '../../config/sessionTimeout';
import { MENSAGEM_SESSAO_EXPIRADA } from '../../services/api.js';

/** Saída por scope local não espera o signOut mais que isto (rede fora, lock preso). */
export const LIMITE_SIGNOUT_LOCAL_MS = 3000;

/** Chaves de tela/CPF do sessionStorage removidas na saída (a fila de envios procedi_consulta_fila_* fica). */
const CHAVES_SESSAO_NA_SAIDA = [
  SESSION_STORAGE_KEY,
  'selectedPatientCpf',
  'activePatientCpf',
  'patientView',
  'patientDetailTab',
  'activeView',
];
const PREFIXOS_SESSAO_NA_SAIDA = ['procedi_bday_modal_'];

/**
 * Chave da sessão do supabase-js no storage: a do cliente (`auth.storageKey`) ou a mesma conta que o
 * supabase-js faz (`sb-<primeiro pedaço do host>-auth-token`).
 * @returns {string | null}
 */
function chaveSessaoSupabase() {
  const doCliente = supabase?.auth?.storageKey;
  if (typeof doCliente === 'string' && doCliente) return doCliente;
  try {
    const url = import.meta.env.VITE_SUPABASE_URL;
    if (url) return `sb-${new URL(url).hostname.split('.')[0]}-auth-token`;
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Remove da aba só o que é da sessão/tela (nunca `sessionStorage.clear()`: a fila de envios pendentes fica).
 * Roda mesmo se o signOut não responder (ele retorna antes de apagar a sessão em erro de rede/5xx).
 */
function limparStorageDaSaida() {
  try {
    const chaveSupabase = chaveSessaoSupabase();
    const chaves = [...CHAVES_SESSAO_NA_SAIDA];
    if (chaveSupabase) {
      chaves.push(chaveSupabase, `${chaveSupabase}-code-verifier`, `${chaveSupabase}-user`);
    }
    for (const key of Object.keys(sessionStorage)) {
      if (PREFIXOS_SESSAO_NA_SAIDA.some((p) => key.startsWith(p))) chaves.push(key);
    }
    chaves.forEach((key) => sessionStorage.removeItem(key));
  } catch {
    /* ignore */
  }
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('procedi_paciente_foto_')) localStorage.removeItem(key);
    }
  } catch {
    /* ignore */
  }
}

/** signOut com limite de tempo: nunca rejeita, resolve no máximo em `ms`. */
function signOutComLimite(scope, ms) {
  let timer = null;
  const limite = new Promise((resolve) => {
    timer = setTimeout(resolve, ms);
  });
  const saida = Promise.resolve()
    .then(() => supabase.auth.signOut({ scope }))
    .catch(() => {
      /* ignore */
    });
  return Promise.race([saida, limite]).finally(() => clearTimeout(timer));
}

/**
 * @param {{ setRoleUserId?: (id: string) => void, setOrgId?: (id: string) => void, clearOrgSession?: () => void }} [options]
 */
export const useAuthState = (options = {}) => {
  const { setRoleUserId, clearOrgSession } = options;
  const { success: toastSuccess, info: toastInfo } = useToast();

  const [authReady, setAuthReady] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authUser, setAuthUser] = useState(null);
  const [loginSubmitting, setLoginSubmitting] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  /** Canal próprio do app entre abas (BroadcastChannel 'procedi-sessao'). */
  const canalSessaoRef = useRef(null);
  const handleLogoutRef = useRef(null);
  /** Guarda de uma saída: só sai quem está logado e não está saindo. */
  const isLoggedInRef = useRef(false);
  const saindoRef = useRef(false);

  useEffect(() => {
    isLoggedInRef.current = isLoggedIn;
  }, [isLoggedIn]);

  const applySessionFromSupabase = useCallback((session) => {
    if (session?.user) {
      const nextId = session.user.id;
      const nextEmail = session.user.email;
      setAuthUser((prev) => {
        if (prev && prev.id === nextId && prev.email === nextEmail) return prev;
        return { id: nextId, email: nextEmail };
      });
      setIsLoggedIn(true);
    } else {
      setAuthUser(null);
      setIsLoggedIn(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    // Só a leitura mais recente vale (eventos em rajada não sobrescrevem com resposta velha).
    let leitura = 0;
    const pendentes = new Set();

    const lerSessaoDestaAba = () => {
      const minha = ++leitura;
      supabase.auth
        .getSession()
        .then(({ data: { session } }) => {
          if (!alive || minha !== leitura) return;
          applySessionFromSupabase(session);
        })
        .catch(() => {
          /* mantém o estado atual */
        });
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!alive) return;
      applySessionFromSupabase(session);
      setAuthReady(true);
    });

    // Nunca confiar na sessão que vem no evento: o BroadcastChannel do supabase repassa eventos de
    // OUTRAS abas (SIGNED_OUT, SIGNED_IN, TOKEN_REFRESHED de outro usuário) sem mexer no storage desta.
    // A verdade é a sessão da própria aba (sessionStorage). Adiado com setTimeout 0 para não chamar
    // método do supabase dentro do callback (o lock do supabase ainda está preso aqui).
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      const t = setTimeout(() => {
        pendentes.delete(t);
        lerSessaoDestaAba();
      }, 0);
      pendentes.add(t);
    });

    return () => {
      alive = false;
      pendentes.forEach((t) => clearTimeout(t));
      pendentes.clear();
      subscription.unsubscribe();
    };
  }, [applySessionFromSupabase]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoginSubmitting(true);
    try {
      const email = username.trim();
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setLoginError(error.message || 'Usuário ou senha incorretos.');
        return;
      }
      if (data.user) {
        setAuthUser({ id: data.user.id, email: data.user.email });
        setIsLoggedIn(true);
      }
      setPassword('');
      toastSuccess('Login realizado com sucesso.');
    } catch (err) {
      setLoginError(err?.message || 'Não foi possível conectar. Tente novamente.');
    } finally {
      setLoginSubmitting(false);
    }
  };

  const handleLogout = useCallback(async (options = {}) => {
    if (saindoRef.current || !isLoggedInRef.current) return;
    saindoRef.current = true;
    try {
      const scope = options?.scope || 'global';
      const porRenovacao = options?.motivo === 'renovacao';
      if (scope === 'global') {
        let userIdDaSessao = null;
        try {
          const { data } = await supabase.auth.getSession();
          userIdDaSessao = data?.session?.user?.id ?? null;
        } catch {
          /* ignore */
        }
        try {
          await supabase.auth.signOut({ scope });
        } catch {
          /* ignore */
        }
        // "Sair" global avisa as outras abas do app (o aviso do supabase não traz scope nem usuário).
        if (userIdDaSessao) {
          try {
            canalSessaoRef.current?.postMessage({ tipo: 'sair-global', userId: userIdDaSessao });
          } catch {
            /* ignore */
          }
        }
      } else {
        // Scope local (inatividade, renovação recusada, "Sair" de outra aba): não depende do servidor e
        // nunca publica 'sair-global' (a outra aba continua).
        await signOutComLimite(scope, LIMITE_SIGNOUT_LOCAL_MS);
      }
      limparStorageDaSaida();
      if (typeof clearOrgSession === 'function') {
        clearOrgSession();
      } else if (typeof setRoleUserId === 'function') {
        setRoleUserId('');
      }
      isLoggedInRef.current = false;
      setIsLoggedIn(false);
      setAuthUser(null);
      setUsername('');
      setPassword('');
      if (porRenovacao) {
        setLoginError(MENSAGEM_SESSAO_EXPIRADA);
      } else {
        setLoginError('');
        toastInfo('Sessão encerrada.');
      }
    } finally {
      saindoRef.current = false;
    }
  }, [setRoleUserId, clearOrgSession, toastInfo]);

  useEffect(() => {
    handleLogoutRef.current = handleLogout;
  }, [handleLogout]);

  // Outra aba deu "Sair" global: sai também só se a sessão DESTA aba for do mesmo usuário.
  // Sai com scope local (sem republicar).
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return undefined;
    let canal;
    try {
      canal = new BroadcastChannel('procedi-sessao');
    } catch {
      return undefined;
    }
    canalSessaoRef.current = canal;
    let alive = true;
    const onMessage = async (ev) => {
      const msg = ev?.data;
      if (!msg || msg.tipo !== 'sair-global' || !msg.userId) return;
      try {
        const { data } = await supabase.auth.getSession();
        if (!alive) return;
        if (data?.session?.user?.id === msg.userId) {
          handleLogoutRef.current?.({ scope: 'local' });
        }
      } catch {
        /* ignore */
      }
    };
    canal.addEventListener('message', onMessage);
    return () => {
      alive = false;
      canal.removeEventListener('message', onMessage);
      try {
        canal.close();
      } catch {
        /* ignore */
      }
      if (canalSessaoRef.current === canal) canalSessaoRef.current = null;
    };
  }, []);

  useEffect(() => {
    const handler = (e) => {
      const scope = e.detail?.scope || 'global';
      handleLogout({ scope, motivo: e.detail?.motivo });
    };
    window.addEventListener('auth:expired', handler);
    return () => window.removeEventListener('auth:expired', handler);
  }, [handleLogout]);

  // Refresh automático quando a aba voltar do background
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        supabase.auth.getSession().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  return {
    authReady,
    isLoggedIn,
    authUser,
    loginSubmitting,
    loginError,
    username,
    setUsername,
    password,
    setPassword,
    showPassword,
    setShowPassword,
    handleLogin,
    handleLogout,
    setIsLoggedIn,
    setLoginError,
  };
};
