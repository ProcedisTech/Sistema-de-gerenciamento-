import { AlertTriangle, FlaskConical, HeartPulse, Pill, UtensilsCrossed } from 'lucide-react';

/**
 * Cor/ícone por categoria de alerta clínico — compartilhado entre AlertasClinicosPanel.jsx
 * (chips do hub/sidebar) e o modal "Ver todos" em PatientProfileView.jsx, para manter a
 * mesma hierarquia visual em todas as telas que listam esses alertas.
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

/** Borda superior por categoria — usado nos cards agrupados por campo do Hub. */
export const CARD_BORDER_CLASSES = {
  red: 'border-t-red-400',
  amber: 'border-t-amber-400',
  blue: 'border-t-blue-400',
  purple: 'border-t-purple-400',
};

/** Cor do rótulo/ícone do cabeçalho de cada card agrupado por campo. */
export const CARD_LABEL_CLASSES = {
  red: 'text-red-700',
  amber: 'text-amber-800',
  blue: 'text-blue-700',
  purple: 'text-purple-700',
};

/** Cor do marcador (bullet) de cada item nos cards agrupados por campo. */
export const CARD_DOT_CLASSES = {
  red: 'bg-red-500',
  amber: 'bg-amber-500',
  blue: 'bg-blue-500',
  purple: 'bg-purple-500',
};

/** Estilo (cor/ícone) para itens vindos da anamnese — sempre vermelho. */
export const ANAMNESE_STYLE = { color: 'red', Icon: AlertTriangle };
