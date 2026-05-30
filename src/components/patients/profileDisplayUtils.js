/** Utilitários de apresentação do perfil (sem lógica de API). */

export function formatDiasAtrasPtBr(iso) {
  if (!iso) return null;
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return null;
  const now = new Date();
  const diffMs = now.getTime() - t.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days <= 0) return 'hoje';
  if (days === 1) return 'há 1 dia';
  return `há ${days} dias`;
}

export function formatCreatedAtPtBr(iso) {
  if (!iso) return '—';
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return '—';
  return t.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

export function formatBirthDatePtBr(dataNascimento) {
  if (!dataNascimento) return '—';
  const s = String(dataNascimento).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const t = new Date(s);
    if (!Number.isNaN(t.getTime())) {
      return t.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    }
  }
  return s || '—';
}

export function formatCityUf(patient) {
  if (!patient) return '—';
  const city = String(patient.enderecoCidade ?? '').trim();
  const uf = String(patient.enderecoEstado ?? '').trim();
  if (city && uf) return `${city}, ${uf}`;
  if (city) return city;
  if (uf) return uf;
  return '—';
}

export function phoneDigitsForWa(telefone) {
  const digits = String(telefone ?? '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length >= 12 && digits.startsWith('55')) return digits;
  if (digits.length >= 10) return `55${digits}`;
  return digits;
}

export function displayField(val, emptyLabel = 'Não informado') {
  const s = val != null ? String(val).trim() : '';
  return s || emptyLabel;
}

export function isEmptyField(val) {
  return !String(val ?? '').trim();
}
