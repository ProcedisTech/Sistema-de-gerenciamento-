import React from 'react';
import { Filter } from 'lucide-react';
import { PatientFilterChip } from './PatientFilterChip.jsx';
import { GALERIA_CATEGORIA_LABELS, ORDEM_CATEGORIAS } from '../../utils/pacienteGaleria.js';

function formatMesChipLabel(m) {
  return new Date(`${m}-01T12:00:00`).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });
}

function truncateProcLabel(p) {
  return p.length > 48 ? `${p.slice(0, 48)}…` : p;
}

export function GaleriaFilterChips({
  filterCategoria,
  setFilterCategoria,
  filterMes,
  setFilterMes,
  mesesOpcoes,
  filterProcedimento,
  setFilterProcedimento,
  procedimentosOpcoes,
}) {
  return (
    <div className="space-y-3 rounded-2xl border border-app-border bg-[#f8fbfb] p-4">
      <div className="flex items-center gap-2 text-[12px] font-bold text-[#0f766e]">
        <Filter className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden />
        Filtrar visualização
      </div>

      <div className="space-y-2">
        <span className="text-[11px] font-bold text-[#64748b]">Categoria</span>
        <div className="flex flex-wrap items-center gap-2">
          <PatientFilterChip
            label="Todas"
            active={filterCategoria === 'all'}
            onClick={() => setFilterCategoria('all')}
          />
          {ORDEM_CATEGORIAS.map((cat) => (
            <PatientFilterChip
              key={cat}
              label={GALERIA_CATEGORIA_LABELS[cat] || cat}
              active={filterCategoria === cat}
              onClick={() => setFilterCategoria((prev) => (prev === cat ? 'all' : cat))}
            />
          ))}
        </div>
      </div>

      {mesesOpcoes.length > 0 ? (
        <div className="space-y-2">
          <span className="text-[11px] font-bold text-[#64748b]">Mês</span>
          <div className="flex flex-wrap items-center gap-2">
            <PatientFilterChip
              label="Todos"
              active={filterMes === 'all'}
              onClick={() => setFilterMes('all')}
            />
            {mesesOpcoes.map((m) => (
              <PatientFilterChip
                key={m}
                label={formatMesChipLabel(m)}
                active={filterMes === m}
                onClick={() => setFilterMes((prev) => (prev === m ? 'all' : m))}
              />
            ))}
          </div>
        </div>
      ) : null}

      {procedimentosOpcoes.length > 0 ? (
        <div className="space-y-2">
          <span className="text-[11px] font-bold text-[#64748b]">Procedimento / texto</span>
          <div className="flex flex-wrap items-center gap-2">
            <PatientFilterChip
              label="Todos"
              active={filterProcedimento === 'all'}
              onClick={() => setFilterProcedimento('all')}
            />
            {procedimentosOpcoes.map((p) => (
              <PatientFilterChip
                key={p}
                label={truncateProcLabel(p)}
                title={p}
                active={filterProcedimento === p}
                onClick={() => setFilterProcedimento((prev) => (prev === p ? 'all' : p))}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
