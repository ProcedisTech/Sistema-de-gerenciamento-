/**
 * Auth via Supabase (signInWithPassword / signOut) + JWT em api.js (Authorization: Bearer) para o backend Java.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient.js';
import { setAccessToken } from '../../services/api.js';
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
    if (session?.access_token) {
      setAccessToken(session.access_token);
    } else {
      setAccessToken(null);
    }
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
    } = supabase.auth.onAuthStateChange((_event, session) => {
      applySessionFromSupabase(session);
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
      if (data.session?.access_token) {
        setAccessToken(data.session.access_token);
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
    setAccessToken(null);
    try {
      sessionStorage.clear();
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
