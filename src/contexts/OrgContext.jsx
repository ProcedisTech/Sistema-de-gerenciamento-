import React, { createContext, useCallback, useContext, useMemo, useState, useEffect } from 'react';
import { setOrgId as apiSetOrgId, getOrgId as apiGetOrgId } from '../services/api';
import { DEFAULT_ORG_ID, ALT_ORG_ID } from '../config/apiEnv';

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
  const initial = readLs(LS_ORG, DEFAULT_ORG_ID);
  /** Antes do primeiro useEffect: garante que api.js já usa a org do localStorage (evita 401 em /v1 com org errada). */
  apiSetOrgId(initial);
  return initial;
}

export function OrgProvider({ children }) {
  const [orgId, setOrgIdState] = useState(readInitialOrgIdSynced);
  const [orgSlug, setOrgSlugState] = useState(() => readLs(LS_SLUG, ''));
  const [roleUserId, setRoleUserIdState] = useState(() => readLs(LS_ROLE, ''));
  const [papel, setPapelState] = useState(() => {
    try {
      return localStorage.getItem(LS_PAPEL) || null;
    } catch {
      return null;
    }
  });
  /** Nome da role vindo do /me (antes de resolverPapel). */
  const [roleNome, setRoleNomeState] = useState('');
  /** Permissões customizadas ou do perfil, vindas do /me. */
  const [permissoes, setPermissoesState] = useState([]);

  useEffect(() => {
    apiSetOrgId(orgId);
  }, [orgId]);



  const setOrgId = useCallback((id, slug = '') => {
    if (!id) return;
    setOrgIdState(id);
    try {
      localStorage.setItem(LS_ORG, id);
      if (slug) localStorage.setItem(LS_SLUG, slug);
      else localStorage.removeItem(LS_SLUG);
    } catch {
      /* ignore */
    }
    if (slug) setOrgSlugState(slug);
    apiSetOrgId(id);
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
    }),
    [orgId, setOrgId, orgSlug, roleUserId, setRoleUserId, papel, setPapel, roleNome, setRoleNome, permissoes, setPermissoes]
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
    };
  }
  return ctx;
}
