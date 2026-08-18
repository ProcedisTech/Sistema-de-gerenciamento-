import { AlertTriangle, FlaskConical, HeartPulse, Pill, UtensilsCrossed } from 'lucide-react';

/**
 * Cor/ícone por categoria de alerta clínico — compartilhado entre a sidebar do perfil
 * e o modal "Ver todos".
 */
export const SECAO_STYLE = {
  alergiasPrincipioAtivo: { color: 'purple', Icon: FlaskConical },
  antecedentes: { color: 'red', Icon: HeartPulse },
  alergias: { color: 'amber', Icon: UtensilsCrossed },
  medicamentos: { color: 'blue', Icon: Pill },
};

export const COLOR_CLASSES = {
  red: 'border-red-200 bg-red-50 text-red-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-800',
  blue: 'border-blue-200 bg-blue-50 text-blue-700',
  purple: 'border-purple-200 bg-purple-50 text-purple-700',
};

/** Borda superior por categoria — cards agrupados da sidebar/modal. */
export const CARD_BORDER_CLASSES = {
  red: 'border-t-red-400',
  amber: 'border-t-amber-400',
  blue: 'border-t-blue-400',
  purple: 'border-t-purple-400',
};

export const CARD_LABEL_CLASSES = {
  red: 'text-red-700',
  amber: 'text-amber-800',
  blue: 'text-blue-700',
  purple: 'text-purple-700',
};

export const CARD_DOT_CLASSES = {
  red: 'bg-red-500',
  amber: 'bg-amber-500',
  blue: 'bg-blue-500',
  purple: 'bg-purple-500',
};

export const ANAMNESE_STYLE = { color: 'red', Icon: AlertTriangle };

/** Paleta canônica da faixa (protótipo v4). Transição 180ms, desliga em prefers-reduced-motion. */
export const FAIXA_EASE = 'ease-[cubic-bezier(.4,0,.2,1)]';
export const FAIXA_TRANSITION = `transition-all duration-[180ms] ${FAIXA_EASE} motion-reduce:transition-none`;

export const FAIXA_CONTAINER = {
  crit: 'border-[#fecdd3] shadow-[0_1px_2px_rgba(225,29,72,0.07)]',
  ok: 'border-[#99f6e4]',
  nada: 'border-[#e2e8f0]',
};

/** Número + cor da célula por natureza. */
export const FAIXA_CELL = {
  ali: 'text-[#b45309]',
  pa: 'text-[#6d28d9]',
  med: 'text-[#1d4ed8]',
  ant: 'text-[#e11d48]',
  ana: 'text-[#e11d48]',
};

export const FAIXA_GROUP_NAME = {
  ali: 'text-[#b45309]',
  pa: 'text-[#6d28d9]',
  med: 'text-[#1d4ed8]',
  ant: 'text-[#e11d48]',
  ana: 'text-[#e11d48]',
  ctx: 'text-[#5b6b7f]',
};
