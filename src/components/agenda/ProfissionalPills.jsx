import React from 'react';
import { Loader2 } from 'lucide-react';
import { PILL_BASE, PILL_IDLE, PILL_SELECTED } from './agendaPillStyles.js';

export function ProfissionalPills({
  profissionais = [],
  value,
  onChange,
  loading = false,
  error = '',
  orphanLabel = '',
}) {
  const selectedId = String(value || '').trim();
  const list = Array.isArray(profissionais) ? profissionais : [];
  const idsInList = new Set(list.map((p) => String(p.roleUserId || '').trim()));
  const showOrphan = selectedId && !idsInList.has(selectedId);
  const orphanText = String(orphanLabel || '').trim() || 'Profissional (inativo)';

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando equipe…
      </div>
    );
  }

  return (
    <div>
      {error ? <p className="mb-2 text-xs font-medium text-red-600">{error}</p> : null}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Profissional">
        {list.map((p) => {
          const id = String(p.roleUserId || '').trim();
          const isSelected = id === selectedId;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onChange(id)}
              className={`${PILL_BASE} ${isSelected ? PILL_SELECTED : PILL_IDLE}`}
            >
              {p.nome}
            </button>
          );
        })}
        {showOrphan ? (
          <button
            type="button"
            aria-pressed
            title="Profissional não está mais na equipe"
            className={`${PILL_BASE} ${PILL_SELECTED}`}
          >
            {orphanText}
          </button>
        ) : null}
      </div>
    </div>
  );
}
