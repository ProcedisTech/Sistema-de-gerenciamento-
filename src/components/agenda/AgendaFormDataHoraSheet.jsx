import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { CalendarioMensal } from './CalendarioMensal.jsx';
import { PainelA_SlotsHorario } from './PainelA_SlotsHorario.jsx';

const BTN_ACTION =
  'inline-flex flex-1 justify-center rounded-lg px-4 py-2.5 text-[13px] font-bold';

/**
 * Sheet full-screen (max-lg) para escolher data + horário no fluxo mobile do
 * AgendaFormModal. Renderiza os MESMOS componentes do corpo desktop
 * (CalendarioMensal + PainelA_SlotsHorario) — montados aqui SÓ no mobile com o
 * sheet aberto, garantindo instância única (sem duplo fetch). Casca de tokens
 * (z-[225], safe-area, scroll-lock) herdada do antigo AgendaDisponibilidadeMobileSheet.
 */
export function AgendaFormDataHoraSheet({
  open,
  diaSelecionado,
  roleUserIdFiltro,
  duracaoTotalMin,
  horaSelecionada,
  profissionalFixado,
  heatmap,
  loading,
  error,
  onPrevMonth,
  onNextMonth,
  onRetry,
  showDensityLegend = true,
  onSelecionarDia,
  onSelecionarSlot,
  onCancel,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[225] flex flex-col bg-white lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="form-datahora-sheet-title"
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-ink-100 px-4 py-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <h2 id="form-datahora-sheet-title" className="text-[16px] font-black text-ink-900">
          Escolher data e horário
        </h2>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl p-2 text-ink-500 hover:bg-ink-100"
          aria-label="Fechar"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4 custom-scrollbar">
        <div className="flex min-h-[min(42vh,22rem)] shrink-0 flex-col">
          <CalendarioMensal
            heatmap={heatmap}
            loading={loading}
            error={error}
            onPrevMonth={onPrevMonth}
            onNextMonth={onNextMonth}
            onRetry={onRetry}
            diaSelecionado={diaSelecionado}
            onSelecionarDia={onSelecionarDia}
            showDensityLegend={showDensityLegend}
          />
        </div>
        <div className="mt-6 shrink-0">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
            Horários disponíveis
          </p>
          <PainelA_SlotsHorario
            diaSelecionado={diaSelecionado}
            roleUserIdFiltro={roleUserIdFiltro}
            duracaoTotalMin={duracaoTotalMin}
            horaSelecionada={horaSelecionada}
            profissionalFixado={profissionalFixado}
            onSelecionarSlot={onSelecionarSlot}
          />
        </div>
      </div>

      <footer className="flex shrink-0 gap-2 border-t border-ink-100 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={onCancel}
          className={`${BTN_ACTION} bg-vivid-teal-600 text-white hover:bg-vivid-teal-700`}
        >
          Concluir
        </button>
      </footer>
    </div>
  );
}
