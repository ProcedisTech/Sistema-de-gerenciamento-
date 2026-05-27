const PALETTE = Object.freeze([
  { bg: 'bg-vivid-teal-100', fg: 'text-vivid-teal-800' },
  { bg: 'bg-indigo-100', fg: 'text-indigo-800' },
  { bg: 'bg-purple-100', fg: 'text-purple-800' },
  { bg: 'bg-rose-100', fg: 'text-rose-800' },
  { bg: 'bg-amber-100', fg: 'text-amber-900' },
  { bg: 'bg-emerald-100', fg: 'text-emerald-800' },
  { bg: 'bg-sky-100', fg: 'text-sky-800' },
  { bg: 'bg-fuchsia-100', fg: 'text-fuchsia-800' },
  { bg: 'bg-orange-100', fg: 'text-orange-900' },
  { bg: 'bg-cyan-100', fg: 'text-cyan-900' },
]);

function hashNome(nome) {
  const s = String(nome || '').trim().toLowerCase();
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

/** @returns {{ bg: string, fg: string }} */
export function gerarCorAvatar(nome) {
  const idx = hashNome(nome) % PALETTE.length;
  return PALETTE[idx];
}

export function iniciaisDoNome(nome, max = 2) {
  const parts = String(nome || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, max).toUpperCase();
  return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase().slice(0, max);
}
