import React, { createContext, useCallback, useContext, useMemo, useState, useEffect } from 'react';
import { setOrgId as apiSetOrgId, getOrgId as apiGetOrgId } from '../services/api';

const LS_ORG = 'procedi_org_id';
const LS_ROLE = 'procedi_role_user_id';

const DEFAULT_ORG = 'b0000000-0000-0000-0000-000000000001';
/** Fallback até auth real; alinhar com seed do backend. */
const DEFAULT_ROLE_USER = 'a0a00000-0000-0000-0000-000000000001';

const OrgContext = createContext(null);

function readLs(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v && /^[0-9a-f-]{36}$/i.test(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

export function OrgProvider({ children }) {
  const [orgId, setOrgIdState] = useState(() => readLs(LS_ORG, DEFAULT_ORG));
  const [roleUserId, setRoleUserIdState] = useState(() => readLs(LS_ROLE, DEFAULT_ROLE_USER));

  useEffect(() => {
    apiSetOrgId(orgId);
  }, [orgId]);

  const setOrgId = useCallback((id) => {
    if (!id) return;
    setOrgIdState(id);
    try {
      localStorage.setItem(LS_ORG, id);
    } catch {
      /* ignore */
    }
    apiSetOrgId(id);
  }, []);

  const setRoleUserId = useCallback((id) => {
    if (!id) return;
    setRoleUserIdState(id);
    try {
      localStorage.setItem(LS_ROLE, id);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(
    () => ({
      orgId,
      setOrgId,
      roleUserId,
      setRoleUserId,
      defaultOrgId: DEFAULT_ORG,
      altOrgId: 'b0000000-0000-0000-0000-000000000002',
    }),
    [orgId, setOrgId, roleUserId, setRoleUserId]
  );

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useOrg() {
  const ctx = useContext(OrgContext);
  if (!ctx) {
    return {
      orgId: apiGetOrgId(),
      setOrgId: apiSetOrgId,
      roleUserId: DEFAULT_ROLE_USER,
      setRoleUserId: () => {},
      defaultOrgId: DEFAULT_ORG,
      altOrgId: 'b0000000-0000-0000-0000-000000000002',
    };
  }
  return ctx;
}
