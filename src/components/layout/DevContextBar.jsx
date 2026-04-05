import React, { useEffect, useState } from 'react';
import { useOrg } from '../../contexts/OrgContext';
import { equipeApi } from '../../services/api';

function roleKey(p) {
  return p?.roleUserId || p?.role_user_id || p?.id || '';
}

export function DevContextBar() {
  const { orgId, setOrgId, roleUserId, setRoleUserId, defaultOrgId, altOrgId } = useOrg();
  const [equipe, setEquipe] = useState([]);

  useEffect(() => {
    equipeApi
      .list()
      .then((data) => {
        if (Array.isArray(data)) setEquipe(data.filter((p) => p.ativo !== false));
      })
      .catch(() => setEquipe([]));
  }, [orgId]);

  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold text-[#64748b] bg-[#f8fbfb] border-[2px] border-[#00a88e]/15 rounded-xl px-3 py-2">
      <span className="text-[#0f172a]">Contexto API</span>
      <select
        value={orgId}
        onChange={(e) => setOrgId(e.target.value)}
        className="rounded-lg border-[2px] border-[#e2e8f0] px-2 py-1 text-[11px] bg-white max-w-[200px]"
      >
        <option value={defaultOrgId}>Org padrão (VITE_DEFAULT_ORG_ID)</option>
        {altOrgId ? (
          <option value={altOrgId}>Org alternativa (VITE_ALT_ORG_ID)</option>
        ) : null}
      </select>
      <select
        value={roleUserId}
        onChange={(e) => setRoleUserId(e.target.value)}
        className="rounded-lg border-[2px] border-[#e2e8f0] px-2 py-1 text-[11px] bg-white max-w-[220px]"
      >
        <option value="">Profissional (roleUserId)…</option>
        {equipe.map((p) => (
          <option key={roleKey(p) || p.id} value={roleKey(p)}>
            {p.nomeCompleto || p.id}
          </option>
        ))}
      </select>
    </div>
  );
}
