import React from 'react';
import { X, AlertTriangle, BadgeCheck, Cake, Clock3, FileX, UserPlus } from 'lucide-react';
import { PatientFilterChip } from './PatientFilterChip.jsx';
import { MinorAgeIcon } from './MinorAgeIcon.jsx';

/**
 * Grupo de chips de filtro — reutilizado no desktop (inline) e no bottom sheet (mobile).
 */
export function PatientListFilterChips({
  isSearching,
  isBirthdaySort,
  statusPlanoFilter,
  setStatusPlanoFilter,
  anamneseDesatualizadaFilter,
  setAnamneseDesatualizadaFilter,
  semRetornoFilter,
  setSemRetornoFilter,
  ehNovoFilter,
  setEhNovoFilter,
  ehAniversarianteFilter,
  setEhAniversarianteFilter,
  quickFilter,
  setQuickFilter,
  showKpiFilters = false,
  className = 'flex flex-wrap items-center gap-2',
}) {
  return (
    <div className={className}>
      <PatientFilterChip
        label="Sem plano"
        icon={FileX}
        active={statusPlanoFilter === 'sem_plano'}
        disabled={isSearching || !setStatusPlanoFilter}
        onClick={() =>
          setStatusPlanoFilter &&
          setStatusPlanoFilter((prev) => (prev === 'sem_plano' ? '' : 'sem_plano'))
        }
      />
      <PatientFilterChip
        label="Com plano ativo"
        icon={BadgeCheck}
        active={statusPlanoFilter === 'plano_ativo'}
        disabled={isSearching || !setStatusPlanoFilter}
        onClick={() =>
          setStatusPlanoFilter &&
          setStatusPlanoFilter((prev) => (prev === 'plano_ativo' ? '' : 'plano_ativo'))
        }
      />
      <PatientFilterChip
        label="Anamnese vencida"
        icon={AlertTriangle}
        active={anamneseDesatualizadaFilter}
        activeClass="bg-[#854d0e] text-white"
        disabled={isSearching || !setAnamneseDesatualizadaFilter}
        onClick={() => setAnamneseDesatualizadaFilter && setAnamneseDesatualizadaFilter((v) => !v)}
      />
      <PatientFilterChip
        label="Sem retorno 60d"
        icon={Clock3}
        active={semRetornoFilter}
        activeClass="bg-[#4338ca] text-white"
        disabled={isSearching || isBirthdaySort || !setSemRetornoFilter}
        title={isBirthdaySort ? 'Indisponível com ordenação por aniversário' : undefined}
        onClick={() => setSemRetornoFilter && setSemRetornoFilter((v) => !v)}
      />
      {showKpiFilters ? (
        <>
          <PatientFilterChip
            label="Novos"
            icon={UserPlus}
            active={ehNovoFilter}
            activeClass="bg-[#047857] text-white"
            disabled={isSearching || !setEhNovoFilter}
            onClick={() => setEhNovoFilter && setEhNovoFilter((v) => !v)}
          />
          <PatientFilterChip
            label="Aniversariantes (mês)"
            icon={Cake}
            active={ehAniversarianteFilter}
            activeClass="bg-pink-600 text-white"
            disabled={isSearching || !setEhAniversarianteFilter}
            onClick={() => setEhAniversarianteFilter && setEhAniversarianteFilter((v) => !v)}
          />
        </>
      ) : null}
      <span className="hidden h-5 w-px bg-[#e2e8f0] lg:inline" aria-hidden />
      <PatientFilterChip
        label="Menor de idade"
        icon={MinorAgeIcon}
        active={quickFilter === 'menor'}
        onClick={() => setQuickFilter((v) => (v === 'menor' ? 'todos' : 'menor'))}
      />
    </div>
  );
}

/**
 * Bottom sheet de filtros — mobile only. Toggle imediato, sem botão Aplicar.
 */
export function PatientFiltersSheet({ open, onClose, chipProps }) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col justify-end lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Filtros da lista de pacientes"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/35 backdrop-blur-[2px]"
        aria-label="Fechar filtros"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-h-[75dvh] overflow-y-auto overflow-x-hidden rounded-t-2xl border border-b-0 border-[#e2e8f0] bg-white pb-[env(safe-area-inset-bottom)] [-webkit-overflow-scrolling:touch] custom-scrollbar">
        <div className="sticky top-0 z-20 flex justify-center bg-white pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-[#e2e8f0]" aria-hidden />
        </div>
        <div className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-[#e2e8f0] bg-white px-4 pb-3">
          <h2 className="text-[15px] font-semibold text-[#0f172a]">Filtros</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#64748b] hover:bg-[#f1f5f9]"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" strokeWidth={2} aria-hidden />
          </button>
        </div>
        <div className="px-4 py-4">
          <PatientListFilterChips
            {...chipProps}
            showKpiFilters
            className="flex flex-wrap items-center gap-2.5"
          />
          {chipProps.isSearching ? (
            <p className="mt-4 text-[12px] text-[#94a3b8]">
              Filtros de indicador ficam indisponíveis durante a busca por texto.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
