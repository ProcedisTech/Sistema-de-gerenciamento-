import React from 'react';
import { ConfigCategoryCard } from './ConfigCategoryCard';
import { getVisibleCategories } from './configHubDefs';

/**
 * Hub de Configurações — landing com grid de cards de categoria.
 * Só exibe categorias em que o usuário tem ao menos 1 item visível.
 */
export function ConfigHub({
  canSeeAnamnese,
  canSeeProcedimentos,
  canSeeTermos,
  canSeePerfil,
  canSeeClinica,
  canSeeAgendaConfig,
  canSeeEquipe,
  onSelectCategory,
}) {
  const flags = { canSeeAnamnese, canSeeProcedimentos, canSeeTermos, canSeePerfil, canSeeClinica, canSeeAgendaConfig, canSeeEquipe };
  const visibleCategories = getVisibleCategories(flags);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <p className="animate-agenda-rise mb-5 text-[13px] leading-snug text-[#64748b]">
        Selecione uma área para configurar
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visibleCategories.map((cat, index) => (
          <ConfigCategoryCard
            key={cat.key}
            icon={cat.icon}
            color={cat.color}
            label={cat.label}
            description={cat.description}
            itemCount={cat.visibleItems.length}
            onClick={() => onSelectCategory(cat.key)}
            entranceDelayMs={index * 60}
          />
        ))}
      </div>
    </div>
  );
}
