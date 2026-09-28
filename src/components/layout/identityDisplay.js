import { resolveApiUrl } from '../../config/apiEnv';

export function clinicaLogoDisplaySrc(u) {
  if (u == null || typeof u !== 'string') return '';
  const t = u.trim();
  if (!t) return '';
  if (t.startsWith('data:') || t.startsWith('http://') || t.startsWith('https://')) return t;
  if (t.startsWith('/')) return resolveApiUrl(t);
  return t;
}

export function perfilFotoDisplaySrc(u) {
  return clinicaLogoDisplaySrc(u);
}

export function displayInitials(name) {
  if (!name || typeof name !== 'string') return 'U';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function displayRole(role) {
  if (!role || typeof role !== 'string') return 'Usuário';
  return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
}

/**
 * Textos de reserva da identidade (clínica e usuário) exibidos na Sidebar e no GlobalHeader.
 *
 * @param {{
 *   clinicaNome?: string,
 *   clinicaLogoUrl?: string,
 *   perfilNomeCompleto?: string,
 *   perfilApelido?: string,
 *   perfilFotoUrl?: string,
 *   authUser?: object,
 * }} params
 */
export function resolveIdentity({
  clinicaNome,
  clinicaLogoUrl,
  perfilNomeCompleto,
  perfilApelido,
  perfilFotoUrl,
  authUser,
} = {}) {
  const tituloClinica =
    (typeof clinicaNome === 'string' && clinicaNome.trim()) || 'Procedi';
  const clinicaLogoResolved =
    clinicaLogoUrl && String(clinicaLogoUrl).trim() ? clinicaLogoDisplaySrc(clinicaLogoUrl) : '';
  const displayName =
    (typeof perfilNomeCompleto === 'string' && perfilNomeCompleto.trim()) ||
    authUser?.email ||
    authUser?.username ||
    'Usuário';
  const apelido = typeof perfilApelido === 'string' ? perfilApelido.trim() : '';
  const nomeCompleto = typeof perfilNomeCompleto === 'string' ? perfilNomeCompleto.trim() : '';
  const shortName = apelido || (nomeCompleto && nomeCompleto.split(/\s+/)[0]) || displayName;
  const perfilFotoResolved =
    perfilFotoUrl && String(perfilFotoUrl).trim() ? perfilFotoDisplaySrc(perfilFotoUrl) : '';
  const roleLabel = displayRole(authUser?.role);
  return { tituloClinica, clinicaLogoResolved, displayName, shortName, perfilFotoResolved, roleLabel };
}
