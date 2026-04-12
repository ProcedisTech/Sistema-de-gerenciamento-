/**
 * Auth contra Spring Boot (cookie HttpOnly `jwt`).
 *
 * - GET /api/auth/me com 401 = não logado (esperado; o DevTools pode listar em vermelho — não é bug).
 * - Snapshot deduplicado (authMeProbe): BackendGate + este hook + StrictMode compartilham uma requisição.
 * - Login: POST com credentials:'include'; sessão vem no Set-Cookie e pode vir accessToken no JSON.
 * - accessToken → sessionStorage + Authorization: Bearer nas chamadas api.js (complementa o cookie).
 * - Resposta típica: { ok: true, user: { … }, accessToken?, organizacaoSaudeId? } — org para X-Org-Id.
 */
import { useState, useEffect, useCallback } from 'react';
import { api } from '../utils/formatters';
import {
  extractAccessTokenFromAuthResponse,
  extractOrganizacaoIdFromAuthResponse,
} from '../../utils/authPayload';
import { authHeadersForFetch, setAccessToken } from '../../services/api.js';
import { useToast } from '../../contexts/useToast.js';
import { fetchAuthMeSnapshot, invalidateAuthMeCache } from '../../utils/authMeProbe.js';

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
 * @param {{ setRoleUserId?: (id: string) => void, setOrgId?: (id: string) => void }} [options]
 */
export const useAuthState = (options = {}) => {
  const { setRoleUserId, setOrgId } = options;
  const { success: toastSuccess, info: toastInfo } = useToast();

  const syncOrganizacaoFromAuthPayload = useCallback(
    (payload) => {
      const oid = extractOrganizacaoIdFromAuthResponse(payload);
      if (oid && typeof setOrgId === 'function') setOrgId(oid);
    },
    [setOrgId]
  );
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

    fetchAuthMeSnapshot()
      .then((snap) => {
        if (cancelled) return;
        if (snap.status === 401) {
          setIsLoggedIn(false);
          setAuthUser(null);
          return;
        }
        if (!snap.ok) {
          setIsLoggedIn(false);
          setAuthUser(null);
          return;
        }
        const data = snap.payload || {};
        const tok = extractAccessTokenFromAuthResponse(data);
        if (tok) setAccessToken(tok);
        syncOrganizacaoFromAuthPayload(data);
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
  }, [cookieConsentAccepted, applySessionUser, syncOrganizacaoFromAuthPayload]);

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
      syncOrganizacaoFromAuthPayload(data);
      if (data.user) {
        applySessionUser(data.user);
      }
      const tok = extractAccessTokenFromAuthResponse(data);
      if (tok) setAccessToken(tok);
      invalidateAuthMeCache();
      setIsLoggedIn(true);
      setPassword('');
      toastSuccess('Login realizado com sucesso.');
    } catch {
      setLoginError(
        'Não foi possível conectar ao servidor. Inicie o Spring Boot (ex.: porta 8080) e rode `npm run dev` com o proxy configurado.'
      );
    } finally {
      setLoginSubmitting(false);
    }
  };

  const handleLogout = useCallback(async () => {
    try {
      await fetch(api('/api/auth/logout'), {
        method: 'POST',
        credentials: 'include',
        headers: { ...authHeadersForFetch({ needsOrg: false }) },
      });
    } catch {
      /* sessão localmente encerrada */
    }
    setAccessToken(null);
    try {
      sessionStorage.clear();
    } catch {
      // ignore
    }
    invalidateAuthMeCache();
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
    cookieConsentAccepted,
    acceptCookies,
    handleLogin,
    handleLogout,
    setIsLoggedIn,
    setLoginError,
  };
};
