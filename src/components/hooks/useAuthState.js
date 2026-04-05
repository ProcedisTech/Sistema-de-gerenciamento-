import { useState, useEffect, useCallback } from 'react';
import { api } from '../utils/formatters';
import { setAuthToken, clearAuthToken } from '../../services/api';

function normalizeAuthUser(raw) {
  if (!raw || typeof raw !== 'object') return null;
  return {
    id: raw.id,
    username: raw.username,
    role: raw.role,
    roleUserId: raw.roleUserId,
  };
}

function isUuid(v) {
  return Boolean(v && /^[0-9a-f-]{36}$/i.test(String(v)));
}

/**
 * @param {{ setRoleUserId?: (id: string) => void }} [options]
 */
export const useAuthState = (options = {}) => {
  const { setRoleUserId } = options;
  const [authReady, setAuthReady] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authUser, setAuthUser] = useState(null);
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

  const applySessionUser = useCallback(
    (user) => {
      const normalized = normalizeAuthUser(user);
      setAuthUser(normalized);
      if (normalized?.roleUserId && isUuid(normalized.roleUserId) && typeof setRoleUserId === 'function') {
        setRoleUserId(String(normalized.roleUserId));
      }
    },
    [setRoleUserId]
  );

  const acceptCookies = () => {
    try {
      document.cookie =
        'cookie_consent=true; Path=/; Max-Age=' + 60 * 60 * 24 * 365 + '; SameSite=Lax';
    } catch {
      // ignore
    }
    setCookieConsentAccepted(true);
  };

  useEffect(() => {
    if (!cookieConsentAccepted) {
      setIsLoggedIn(false);
      setAuthUser(null);
      setAuthReady(true);
      return;
    }

    let cancelled = false;
    const timeoutId = setTimeout(() => {
      if (!cancelled) setAuthReady(true);
    }, 2000);

    fetch(api('/api/auth/me'), { credentials: 'include' })
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          setIsLoggedIn(false);
          setAuthUser(null);
          return;
        }
        const data = await res.json().catch(() => ({}));
        const token = data?.token ?? data?.accessToken ?? data?.jwt ?? null;
        if (token) setAuthToken(token);
        const user = data?.user;
        if (user) {
          applySessionUser(user);
          setIsLoggedIn(true);
        } else {
          setIsLoggedIn(false);
          setAuthUser(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIsLoggedIn(false);
          setAuthUser(null);
        }
      })
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
  }, [cookieConsentAccepted, applySessionUser]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoginSubmitting(true);
    try {
      const usernameTrim = username.trim();
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
        if (res.status === 404) {
          setLoginError(
            'Não encontrei o endpoint de login (`/api/auth/login`). Verifique se o Spring Boot está rodando e o proxy do Vite aponta para a porta correta.'
          );
          return;
        }
        setLoginError(data.error || data.message || 'Usuário ou senha incorretos.');
        return;
      }
      const token = data.token ?? data.accessToken ?? data.jwt ?? null;
      if (token) setAuthToken(token);
      if (data.user) {
        applySessionUser(data.user);
      }
      setIsLoggedIn(true);
      setPassword('');
    } catch {
      setLoginError(
        'Não foi possível conectar ao servidor. Inicie o Spring Boot (ex.: porta 8080) e rode `npm run dev` com o proxy configurado.'
      );
    } finally {
      setLoginSubmitting(false);
    }
  };

  const registerAndEnter = useCallback(
    async ({ username, email, password }) => {
      const res = await fetch(api('/api/auth/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          username: username.trim(),
          email: email.trim(),
          password,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = new Error(data.message || 'Não foi possível criar o usuário.');
        err.status = res.status;
        err.body = data;
        throw err;
      }
      const token = data.token ?? data.accessToken ?? data.jwt ?? null;
      if (token) setAuthToken(token);
      if (data.user) {
        applySessionUser(data.user);
      }
      setIsLoggedIn(true);
    },
    [applySessionUser]
  );

  const handleLogout = useCallback(async () => {
    try {
      await fetch(api('/api/auth/logout'), {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      /* sessão localmente encerrada */
    }
    clearAuthToken();
    setIsLoggedIn(false);
    setAuthUser(null);
    setUsername('');
    setPassword('');
    setLoginError('');
  }, []);

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
    cookieConsentAccepted,
    acceptCookies,
    handleLogin,
    registerAndEnter,
    handleLogout,
    setIsLoggedIn,
    setLoginError,
  };
};
