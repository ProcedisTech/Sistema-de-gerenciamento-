import React, { createContext, useCallback, useContext, useMemo, useState, useEffect } from 'react';
import { setOrgId as apiSetOrgId, getOrgId as apiGetOrgId } from '../services/api';
import { DEFAULT_ORG_ID, ALT_ORG_ID, sanitizeOrgId } from '../config/apiEnv';

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
  const initial = sanitizeOrgId(fromLs) || sanitizeOrgId(DEFAULT_ORG_ID) || '';
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
  const [orgSlug, setOrgSlugState] = useState(() => readLs(LS_SLUG, ''));
  const [roleUserId, setRoleUserIdState] = useState(() => readLs(LS_ROLE, ''));
  // Não inicializa a partir do localStorage: o papel só é confiável depois que /me responder,
  // para não aplicar um papel desatualizado/de outro usuário por uma fração de segundo.
  const [papel, setPapelState] = useState(null);
  /** Nome da role vindo do /me (antes de resolverPapel). */
  const [roleNome, setRoleNomeState] = useState('');
  /** Permissões customizadas ou do perfil, vindas do /me. */
  const [permissoes, setPermissoesState] = useState([]);

  useEffect(() => {
    apiSetOrgId(orgId);
  }, [orgId]);

  const setOrgId = useCallback((id, slug = '') => {
    const next = sanitizeOrgId(id);
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

  /** Limpa org/papel/role do localStorage e do estado no logout. */
  const clearOrgSession = useCallback(() => {
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
    apiSetOrgId('');
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
      clearOrgSession,
    }),
    [orgId, setOrgId, orgSlug, roleUserId, setRoleUserId, papel, setPapel, roleNome, setRoleNome, permissoes, setPermissoes, clearOrgSession]
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
      clearOrgSession: () => {},
    };
  }
  return ctx;
}
