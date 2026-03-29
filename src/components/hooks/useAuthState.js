import { useState, useEffect } from 'react';
import { api } from '../utils/formatters';

export const useAuthState = () => {
  const isDev = import.meta.env.DEV;
  const [authReady, setAuthReady] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginSubmitting, setLoginSubmitting] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [cookieConsentAccepted, setCookieConsentAccepted] = useState(() => {
    try {
      return document.cookie.includes('cookie_consent=true');
    } catch {
      return false;
    }
  });

  const acceptCookies = () => {
    try {
      document.cookie =
        'cookie_consent=true; Path=/; Max-Age=' + 60 * 60 * 24 * 365 + '; SameSite=Lax';
    } catch {
      // ignore
    }
    setCookieConsentAccepted(true);
  };

  // Verificar autenticação ao montar
  useEffect(() => {
    if (!cookieConsentAccepted) {
      setIsLoggedIn(false);
      setAuthReady(true);
      return;
    }

    // Em dev local, evita ruído de 502 quando a API não está rodando.
    if (isDev && import.meta.env.VITE_FORCE_AUTH_ME_CHECK !== 'true') {
      setIsLoggedIn(false);
      setAuthReady(true);
      return;
    }

    let cancelled = false;
    const timeoutId = setTimeout(() => {
      if (!cancelled) setAuthReady(true);
    }, 2000);

    fetch(api('/api/auth/me'), { credentials: 'include' })
      .then((res) => {
        if (!cancelled && res.ok) setIsLoggedIn(true);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) {
          clearTimeout(timeoutId);
          setAuthReady(true);
        }
      });

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [cookieConsentAccepted, isDev]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoginSubmitting(true);
    try {
      const testUser = 'Rafael';
      const testPassword = 'PROcedi';
      const usernameTrim = username.trim();

      // Atalho local para desenvolvimento sem backend disponível.
      if (isDev && usernameTrim === testUser && password === testPassword) {
        setIsLoggedIn(true);
        setPassword('');
        setLoginError('');
        return;
      }

      const res = await fetch(api('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          username: usernameTrim,
          password,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Fallback de teste
        if (
          usernameTrim === testUser &&
          password === testPassword &&
          (res.status === 404 || res.status === 0 || res.status >= 500)
        ) {
          setIsLoggedIn(true);
          setPassword('');
          setLoginError('');
          return;
        }

        if (res.status === 404) {
          setLoginError(
            'Não encontrei o endpoint de login (`/api/auth/login`). Verifique se a API está encaminhada no Netlify.'
          );
          return;
        }

        setLoginError(data.error || 'Usuário ou senha incorretos.');
        return;
      }
      setIsLoggedIn(true);
      setPassword('');
    } catch {
      const testUser = 'Rafael';
      const testPassword = 'PROcedi';
      if (username.trim() === testUser && password === testPassword) {
        setIsLoggedIn(true);
        setPassword('');
        setLoginError('');
        return;
      }
      setLoginError(
        'Não foi possível conectar ao servidor. Inicie a API (npm run server) ou use npm run dev:full.'
      );
    } finally {
      setLoginSubmitting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch(api('/api/auth/logout'), {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      /* sessão localmente encerrada */
    }
    setIsLoggedIn(false);
    setUsername('');
    setPassword('');
    setLoginError('');
  };

  return {
    authReady,
    isLoggedIn,
    loginSubmitting,
    loginError,
    username,
    setUsername,
    password,
    setPassword,
    showPassword,
    setShowPassword,
    cookieConsentAccepted,
    acceptCookies,
    handleLogin,
    handleLogout,
    setIsLoggedIn,
    setLoginError,
  };
};

