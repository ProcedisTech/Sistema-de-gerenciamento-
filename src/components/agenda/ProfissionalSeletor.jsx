import React from 'react';
import { User } from 'lucide-react';

// STUB — Checkpoint 2 implementará seleção real de profissional (Painel C).
export function ProfissionalSeletor({ roleUserIdAgenda, equipeList, onAbrirPainelC }) {
  const profissional = (equipeList || []).find(
    (p) => String(p.roleUserId) === String(roleUserIdAgenda || '')
  );

  return (
    <button
      type="button"
      onClick={() => onAbrirPainelC?.()}
      className="flex w-full items-center gap-2 rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-left text-sm hover:border-vivid-teal-300 hover:bg-vivid-teal-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vivid-teal-500"
    >
      <User className="h-4 w-4 shrink-0 text-ink-400" />
      <span className={profissional ? 'text-ink-800' : 'text-ink-400'}>
        {profissional ? profissional.nome : 'Qualquer profissional'}
      </span>
    </button>
  );
}
