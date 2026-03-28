// Funções de formatação de dados

export const maskCPF = (value) => {
  return value
    .replace(/\D/g, '')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})/, '$1-$2')
    .replace(/(-\d{2})\d+?$/, '$1');
};

export const maskRG = (value) => {
  return value
    .replace(/\D/g, '')
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})/, '$1-$2')
    .replace(/(-\d{1})\d+?$/, '$1');
};

export const maskTelefone = (value) => {
  return value
    .replace(/\D/g, '')
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{4,5})(\d{4})/, '$1-$2')
    .replace(/(-\d{4})\d+?$/, '$1');
};

export const normalizeCpf = (cpf) => {
  return (cpf || '').replace(/\D/g, '');
};

export const normalizeTelefone = (tel) => {
  return (tel || '').replace(/\D/g, '');
};

export const calculateAgeFromISODate = (iso) => {
  if (!iso) return '';
  const parts = iso.split('-');
  if (parts.length !== 3) return '';
  const [year, month, day] = parts;
  const dataNasc = new Date(Number(year), Number(month) - 1, Number(day));
  if (Number.isNaN(dataNasc.getTime())) return '';
  const hoje = new Date();
  let idadeCalculada = hoje.getFullYear() - dataNasc.getFullYear();
  const m = hoje.getMonth() - dataNasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < dataNasc.getDate())) {
    idadeCalculada--;
  }
  return idadeCalculada;
};

export const getPatientInitials = (name) => {
  const parts = (name || '')
    .split(' ')
    .map((p) => p.trim())
    .filter(Boolean);
  const initials = parts.slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
  return initials || 'P';
};

export const generateJourneyId = () => {
  try {
    if (globalThis?.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  } catch {
    // ignore and fallback
  }
  return `journey_${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

export const api = (path) =>
  `${import.meta.env.VITE_API_BASE_URL ?? ''}${path}`;

