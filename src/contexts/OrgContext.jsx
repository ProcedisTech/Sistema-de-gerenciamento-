import React, { createContext, useCallback, useContext, useMemo, useState, useEffect, useRef } from 'react';
import { setOrgId as apiSetOrgId, getOrgId as apiGetOrgId } from '../services/api';
import { invalidateAuthMeCache } from '../utils/authMeProbe';
import { DEFAULT_ORG_ID, ALT_ORG_ID, sanitizeOrgId } from '../config/apiEnv';
import { FUSO_PADRAO } from '../utils/datasClinica';

const LS_ORG = 'procedi_org_id';
const LS_SLUG = 'procedi_org_slug';
/** v2: evita reaproveitar roleUserId de demo antigo no localStorage. */
const LS_ROLE = 'procedi_role_user_id_v2';
const LS_PAPEL = 'procedi_papel';

const OrgContext = createContext(null);

function readLs(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v && /^[0-9a-f-]{36}$/i.test(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

function readInitialOrgIdSynced() {
  const fromLs = readLs(LS_ORG, '');
  const initial = sanitizeOrgId(fromLs) || '';
  // Seed presa no LS de sessões antigas → limpar e não reinjetar.
  if (fromLs && !initial) {
    try {
      localStorage.removeItem(LS_ORG);
      localStorage.removeItem(LS_SLUG);
    } catch {
      /* ignore */
    }
  }
  /** Antes do primeiro useEffect: sync api.js (vazio até /minhas ou escolha real). */
  apiSetOrgId(initial);
  return initial;
}

export function OrgProvider({ children }) {
  const [orgId, setOrgIdState] = useState(readInitialOrgIdSynced);
  const orgIdRef = useRef(orgId);
  const [orgSlug, setOrgSlugState] = useState(() => readLs(LS_SLUG, ''));
  const [roleUserId, setRoleUserIdState] = useState('');
  // Não inicializa a partir do localStorage: o papel só é confiável depois que /me responder,
  // para não aplicar um papel desatualizado/de outro usuário por uma fração de segundo.
  const [papel, setPapelState] = useState(null);
  /** Nome da role vindo do /me (antes de resolverPapel). */
  const [roleNome, setRoleNomeState] = useState('');
  /** Permissões customizadas ou do perfil, vindas do /me. */
  const [permissoes, setPermissoesState] = useState([]);
  /** Flag de elegibilidade para aparecer na agenda como profissional vinda do perfil de acesso (/me). */
  const [apareceNaAgenda, setApareceNaAgendaState] = useState(null);
  const [contextStatus, setContextStatus] = useState('idle');
  /** Fuso IANA da clínica ativa, vindo do /me com X-Org-Id (null até o /me responder). */
  const [fusoHorario, setFusoHorarioState] = useState(null);
  /** Incrementa para recarregar o /me da mesma clínica (ex.: depois de salvar a UF). */
  const [contextoNonce, setContextoNonce] = useState(0);

  useEffect(() => {
    apiSetOrgId(orgId);
  }, [orgId]);

  const setOrgId = useCallback((id, slug = '') => {
    const next = sanitizeOrgId(id);
    // A descoberta confirma a clínica persistida após /me: não apaga o contexto
    // já carregado (ou em voo) quando o ID é o mesmo, pois o effect não repetirá.
    if (next && next === orgIdRef.current) {
      if (slug) {
        setOrgSlugState(slug);
        try { localStorage.setItem(LS_SLUG, slug); } catch { /* ignore */ }
      }
      return;
    }
    orgIdRef.current = next;
    apiSetOrgId(next);
    invalidateAuthMeCache();
    setRoleUserIdState('');
    setPapelState(null);
    setRoleNomeState('');
    setPermissoesState([]);
    setApareceNaAgendaState(null);
    setFusoHorarioState(null);
    setContextStatus(next ? 'loading' : 'idle');
    if (!next) {
      // falsy / placeholder: limpa org (nunca reinjeta seed)
      setOrgIdState('');
      setOrgSlugState('');
      try {
        localStorage.removeItem(LS_ORG);
        localStorage.removeItem(LS_SLUG);
      } catch {
        /* ignore */
      }
      apiSetOrgId('');
      return;
    }
    setOrgIdState(next);
    try {
      localStorage.setItem(LS_ORG, next);
      if (slug) localStorage.setItem(LS_SLUG, slug);
      else localStorage.removeItem(LS_SLUG);
    } catch {
      /* ignore */
    }
    if (slug) setOrgSlugState(slug);
    apiSetOrgId(next);
  }, []);

  const setRoleUserId = useCallback((id) => {
    const next = id == null ? '' : String(id).trim();
    setRoleUserIdState(next);
    try {
      if (next) localStorage.setItem(LS_ROLE, next);
      else localStorage.removeItem(LS_ROLE);
    } catch {
      /* ignore */
    }
  }, []);

  const setPapel = useCallback((novoPapel) => {
    setPapelState(novoPapel);
    try {
      if (novoPapel) localStorage.setItem(LS_PAPEL, novoPapel);
      else localStorage.removeItem(LS_PAPEL);
    } catch {
      /* ignore */
    }
  }, []);

  const setRoleNome = useCallback((nome) => {
    setRoleNomeState(nome == null ? '' : String(nome).trim());
  }, []);

  const setPermissoes = useCallback((perms) => {
    setPermissoesState(Array.isArray(perms) ? perms : []);
  }, []);

  const setApareceNaAgenda = useCallback((val) => {
    setApareceNaAgendaState(typeof val === 'boolean' ? val : null);
  }, []);

  const setFusoHorario = useCallback((fuso) => {
    setFusoHorarioState(typeof fuso === 'string' && fuso.trim() ? fuso.trim() : null);
  }, []);

  /** Mesma clínica, dados novos: invalida o cache do /me e refaz o /me com X-Org-Id. */
  const recarregarContextoOrg = useCallback(() => {
    invalidateAuthMeCache();
    setContextoNonce((n) => n + 1);
  }, []);

  /** Limpa org/papel/role do localStorage e do estado no logout. */
  const clearOrgSession = useCallback(() => {
    orgIdRef.current = '';
    try {
      localStorage.removeItem(LS_ORG);
      localStorage.removeItem(LS_SLUG);
      localStorage.removeItem(LS_ROLE);
      localStorage.removeItem(LS_PAPEL);
    } catch {
      /* ignore */
    }
    setOrgIdState('');
    setOrgSlugState('');
    setRoleUserIdState('');
    setPapelState(null);
    setRoleNomeState('');
    setPermissoesState([]);
    setApareceNaAgendaState(null);
    setFusoHorarioState(null);
    setContextStatus('idle');
    apiSetOrgId('');
    invalidateAuthMeCache();
  }, []);

  const value = useMemo(
    () => ({
      orgId,
      setOrgId,
      orgSlug,
      roleUserId,
      setRoleUserId,
      defaultOrgId: DEFAULT_ORG_ID,
      altOrgId: ALT_ORG_ID,
      papel,
      setPapel,
      roleNome,
      setRoleNome,
      permissoes,
      setPermissoes,
      apareceNaAgenda,
      setApareceNaAgenda,
      contextStatus,
      setContextStatus,
      fusoHorario,
      setFusoHorario,
      contextoNonce,
      recarregarContextoOrg,
      clearOrgSession,
    }),
    [orgId, setOrgId, orgSlug, roleUserId, setRoleUserId, papel, setPapel, roleNome, setRoleNome, permissoes, setPermissoes, apareceNaAgenda, setApareceNaAgenda, contextStatus, fusoHorario, setFusoHorario, contextoNonce, recarregarContextoOrg, clearOrgSession]
  );

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useOrg() {
  const ctx = useContext(OrgContext);
  if (!ctx) {
    return {
      orgId: apiGetOrgId(),
      setOrgId: apiSetOrgId,
      orgSlug: '',
      roleUserId: '',
      setRoleUserId: () => {},
      defaultOrgId: DEFAULT_ORG_ID,
      altOrgId: ALT_ORG_ID,
      papel: null,
      setPapel: () => {},
      roleNome: '',
      setRoleNome: () => {},
      permissoes: [],
      setPermissoes: () => {},
      apareceNaAgenda: null,
      setApareceNaAgenda: () => {},
      contextStatus: 'idle',
      setContextStatus: () => {},
      // Sem OrgProvider (render isolado): não há /me; usa o fuso padrão.
      fusoHorario: FUSO_PADRAO,
      setFusoHorario: () => {},
      contextoNonce: 0,
      recarregarContextoOrg: () => {},
      clearOrgSession: () => {},
    };
  }
  return ctx;
}
