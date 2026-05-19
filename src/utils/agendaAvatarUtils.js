const AVATAR_GRADIENTS = [
  { from: '#7F77DD', to: '#5B53C4' },
  { from: '#1D9E75', to: '#127A57' },
  { from: '#D4537E', to: '#A93C61' },
  { from: '#378ADD', to: '#2566B0' },
  { from: '#D85A30', to: '#A93D1B' },
];

export function hashAvatarGradient(name) {
  const value = String(name || 'Paciente');
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = (hash + value.charCodeAt(i) * (i + 1)) % 997;
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
}

export function initialsFromName(fullName) {
  const parts = String(fullName || 'Paciente').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'P';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}
