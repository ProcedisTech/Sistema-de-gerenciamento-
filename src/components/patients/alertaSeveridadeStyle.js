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

/** Estilo (cor/ícone) para itens vindos da anamnese — sempre vermelho. */
export const ANAMNESE_STYLE = { color: 'red', Icon: AlertTriangle };
