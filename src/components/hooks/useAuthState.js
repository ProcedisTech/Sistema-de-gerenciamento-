/**
 * Auth via Supabase (signInWithPassword / signOut) + JWT em api.js (Authorization: Bearer) para o backend Java.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient.js';
import { useToast } from '../../contexts/useToast.js';

/**
 * @param {{ setRoleUserId?: (id: string) => void, setOrgId?: (id: string) => void }} [options]
 */
export const useAuthState = (options = {}) => {
  const { setRoleUserId } = options;
  const { success: toastSuccess, info: toastInfo } = useToast();

  const [authReady, setAuthReady] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authUser, setAuthUser] = useState(null);
  const [loginSubmitting, setLoginSubmitting] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const applySessionFromSupabase = useCallback((session) => {
    if (session?.user) {
      setAuthUser({
        id: session.user.id,
        email: session.user.email,
      });
      setIsLoggedIn(true);
    } else {
      setAuthUser(null);
      setIsLoggedIn(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!alive) return;
      applySessionFromSupabase(session);
      setAuthReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setAuthUser(null);
        setIsLoggedIn(false);
        return;
      }
      if (session?.access_token) {
        setAuthUser((prev) => {
          const nextId = session.user.id;
          const nextEmail = session.user.email;
          if (prev && prev.id === nextId && prev.email === nextEmail) return prev;
          return { id: nextId, email: nextEmail };
        });
        setIsLoggedIn(true);
      }
    });

    return () => {
      alive = false;
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

  const handleLogout = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      /* ignore */
    }
    try {
      sessionStorage.clear();
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
    if (typeof setRoleUserId === 'function') setRoleUserId('');
    setIsLoggedIn(false);
    setAuthUser(null);
    setUsername('');
    setPassword('');
    setLoginError('');
    toastInfo('Sessão encerrada.');
  }, [setRoleUserId, toastInfo]);

  useEffect(() => {
    const handler = () => handleLogout();
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
