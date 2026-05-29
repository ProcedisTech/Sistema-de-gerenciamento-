import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { useDiasComDisponibilidade } from '../../hooks/agenda/useDiasComDisponibilidade.js';

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function toLocalDateIso(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function startOfMonthDate(year, month) {
  return new Date(year, month - 1, 1);
}

function buildCells(year, month) {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const cells = [];
  for (let i = 0; i < firstDay.getDay(); i++) cells.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) {
    cells.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function formatMesAno(year, month) {
  return new Date(year, month - 1, 1).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });
}

// Cor de intensidade baseada na qtd de slots livres — dessaturada em superfícies grandes.
function slotIntensityClass(qtd) {
  if (!qtd || qtd <= 0) return '';
  if (qtd >= 6) return 'bg-teal-700 text-white';
  if (qtd >= 3) return 'bg-teal-600 text-white';
  return 'bg-teal-500 text-white';
}

export function CalendarioMensal({ roleUserId, diaSelecionado, onSelecionarDia }) {
  const hoje = useMemo(() => toLocalDateIso(new Date()), []);

  const [mesAtual, setMesAtual] = useState(() => {
    if (diaSelecionado) {
      const [y, m] = diaSelecionado.split('-');
      return startOfMonthDate(Number(y), Number(m));
    }
    return startOfMonthDate(new Date().getFullYear(), new Date().getMonth() + 1);
  });

  const ano = mesAtual.getFullYear();
  const mes = mesAtual.getMonth() + 1;

  // Hook retorna { dias: Array<{data,temDisponibilidade,qtdSlotsLivres}>, loading, error, reload }
  const { dias, loading, error, reload } = useDiasComDisponibilidade({
    ano,
    mes,
    roleUserId: roleUserId || undefined,
    enabled: true,
  });

  // dispMap: { 'YYYY-MM-DD': { temDisponibilidade: bool, qtdSlotsLivres: int } }
  const dispMap = useMemo(
    () =>
      Object.fromEntries(
        (Array.isArray(dias) ? dias : []).map((d) => [
          d.data,
          { temDisponibilidade: Boolean(d.temDisponibilidade), qtdSlotsLivres: Number(d.qtdSlotsLivres) || 0 },
        ])
      ),
    [dias]
  );

  const cells = useMemo(() => buildCells(ano, mes), [ano, mes]);

  function irMesAnterior() {
    setMesAtual((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  }
  function irProximoMes() {
    setMesAtual((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  }

  function handleDiaClick(iso) {
    if (!iso) return;
    if (iso < hoje) return;
    const info = dispMap[iso];
    // Se a resposta chegou e explicitamente diz false → bloquear
    if (info && info.temDisponibilidade === false) return;
    onSelecionarDia?.(iso);
  }

  return (
    <div className="select-none">
      {/* Cabeçalho do mês */}
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={irMesAnterior}
          className="rounded-xl p-2 text-ink-500 hover:bg-ink-100 hover:text-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vivid-teal-500"
          aria-label="Mês anterior"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <span className="font-display text-xl font-black capitalize text-ink-900">
          {formatMesAno(ano, mes)}
        </span>

        <button
          type="button"
          onClick={irProximoMes}
          className="rounded-xl p-2 text-ink-500 hover:bg-ink-100 hover:text-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vivid-teal-500"
          aria-label="Próximo mês"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Dias da semana */}
      <div className="mb-2 grid grid-cols-7 gap-2">
        {DIAS_SEMANA.map((d) => (
          <div
            key={d}
            className="py-1 text-center text-[11px] font-bold uppercase tracking-wider text-ink-400"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Grid de dias */}
      {loading ? (
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 35 }).map((_, i) => (
            <div
              key={i}
              className="aspect-square animate-pulse rounded-xl bg-ink-100"
            />
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <p className="text-sm text-ink-500">Falha ao carregar disponibilidade</p>
          <button
            type="button"
            onClick={reload}
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-vivid-teal-700 hover:bg-vivid-teal-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vivid-teal-500"
          >
            <RefreshCw className="h-4 w-4" />
            Tentar novamente
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-2">
          {cells.map((iso, i) => {
            if (!iso) {
              return <div key={`empty-${i}`} className="aspect-square" />;
            }

            const isToday = iso === hoje;
            const isSelecionado = iso === diaSelecionado;
            const isPast = iso < hoje;
            const info = dispMap[iso];
            // info pode ser undefined (loading ainda não chegou) → não bloquear
            const temDisp = info?.temDisponibilidade;
            const qtdSlots = info?.qtdSlotsLivres ?? 0;
            const semDisp = temDisp === false; // só bloqueia quando explicitamente false
            const disabled = isPast || semDisp;

            let cellClass =
              'relative flex aspect-square w-full flex-col items-center justify-center rounded-xl text-base font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vivid-teal-500 focus-visible:ring-offset-1';

            if (isSelecionado) {
              cellClass += ' bg-vivid-teal-500 text-white ring-2 ring-vivid-teal-300 shadow-md';
            } else if (isPast) {
              cellClass += ' cursor-not-allowed text-ink-200';
            } else if (semDisp) {
              cellClass += ' cursor-not-allowed text-ink-300 bg-ink-50';
            } else if (temDisp === true) {
              // Tem disponibilidade: intensidade por qtd de slots
              const intensidade = slotIntensityClass(qtdSlots);
              cellClass += intensidade
                ? ` cursor-pointer ${intensidade} hover:opacity-90`
                : ' cursor-pointer bg-teal-500 text-white hover:bg-teal-600';
            } else {
              // temDisponibilidade ainda não carregado (undefined) — neutro clicável
              cellClass += ' cursor-pointer text-ink-700 hover:bg-vivid-teal-50 hover:text-vivid-teal-700';
            }

            return (
              <button
                key={iso}
                type="button"
                disabled={disabled}
                onClick={() => handleDiaClick(iso)}
                aria-label={`${iso}${temDisp === true ? ` — ${qtdSlots} horário${qtdSlots !== 1 ? 's' : ''}` : ''}`}
                aria-pressed={isSelecionado}
                className={cellClass}
              >
                <span>{iso.slice(-2).replace(/^0/, '')}</span>
                {/* Dot "hoje" quando não selecionado */}
                {isToday && !isSelecionado && (
                  <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-vivid-teal-500" />
                )}
                {/* Badge sutil de qtd de slots livres */}
                {!isSelecionado && temDisp === true && qtdSlots > 0 && (
                  <span className="absolute bottom-0.5 right-0.5 rounded-full bg-white/70 px-0.5 text-[8px] font-bold leading-none text-emerald-800">
                    {qtdSlots}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
