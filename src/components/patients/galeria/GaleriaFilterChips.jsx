import React from 'react';
import { Filter } from 'lucide-react';
import { PatientFilterChip } from '../PatientFilterChip.jsx';
import { GALERIA_CATEGORIA_LABELS } from '../../../utils/pacienteGaleria.js';
import { ORDEM_CATEGORIAS } from './galeriaUiConstants.js';

function formatMesChipLabel(m) {
  return new Date(`${m}-01T12:00:00`).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });
}

export function GaleriaFilterChips({
  galeriaFilterCategoria,
  setGaleriaFilterCategoria,
  galeriaFilterMes,
  setGaleriaFilterMes,
  galeriaFilterProcedimento,
  setGaleriaFilterProcedimento,
  galeriaMesesOpcoes,
  galeriaProcedimentosOpcoes,
}) {
  return (
    <div className="rounded-2xl border border-app-border bg-[#f8fbfb] p-4 space-y-4">
      <div className="flex items-center gap-2 text-[12px] font-bold text-[#0f766e]">
        <Filter className="w-4 h-4 shrink-0" strokeWidth={2.5} aria-hidden />
        Filtrar visualização
      </div>

      <div className="space-y-2">
        <span className="text-[11px] font-bold text-[#64748b]">Categoria</span>
        <div className="flex flex-wrap items-center gap-2">
          <PatientFilterChip
            label="Todas"
            active={galeriaFilterCategoria === 'all'}
            onClick={() => setGaleriaFilterCategoria('all')}
          />
          {ORDEM_CATEGORIAS.map((cat) => (
            <PatientFilterChip
              key={cat}
              label={GALERIA_CATEGORIA_LABELS[cat] || cat}
              active={galeriaFilterCategoria === cat}
              onClick={() =>
                setGaleriaFilterCategoria((prev) => (prev === cat ? 'all' : cat))
              }
            />
          ))}
        </div>
      </div>

      {galeriaMesesOpcoes?.length > 0 ? (
        <div className="space-y-2">
          <span className="text-[11px] font-bold text-[#64748b]">Mês</span>
          <div className="flex flex-wrap items-center gap-2 overflow-x-auto pb-0.5">
            <PatientFilterChip
              label="Todos"
              active={galeriaFilterMes === 'all'}
              onClick={() => setGaleriaFilterMes('all')}
            />
            {galeriaMesesOpcoes.map((m) => (
              <PatientFilterChip
                key={m}
                label={formatMesChipLabel(m)}
                active={galeriaFilterMes === m}
                onClick={() => setGaleriaFilterMes((prev) => (prev === m ? 'all' : m))}
              />
            ))}
          </div>
        </div>
      ) : null}

      {galeriaProcedimentosOpcoes?.length > 0 ? (
        <div className="space-y-2">
          <span className="text-[11px] font-bold text-[#64748b]">Procedimento / texto</span>
          <div className="flex flex-wrap items-center gap-2 overflow-x-auto pb-0.5">
            <PatientFilterChip
              label="Todos"
              active={galeriaFilterProcedimento === 'all'}
              onClick={() => setGaleriaFilterProcedimento('all')}
            />
            {galeriaProcedimentosOpcoes.map((p) => {
              const short = p.length > 32 ? `${p.slice(0, 32)}…` : p;
              return (
                <PatientFilterChip
                  key={p}
                  label={short}
                  title={p}
                  active={galeriaFilterProcedimento === p}
                  onClick={() =>
                    setGaleriaFilterProcedimento((prev) => (prev === p ? 'all' : p))
                  }
                />
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
