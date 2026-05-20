import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { AgendaDisponibilidadeBody } from './AgendaDisponibilidadePanel.jsx';

const BTN_ACTION =
  'inline-flex flex-1 justify-center rounded-lg px-4 py-2.5 text-[13px] font-bold';

/**
 * Sheet full-screen de disponibilidade (max-lg) — z-[225], acima do form modal.
 */
export function AgendaDisponibilidadeMobileSheet({
  open,
  agenda,
  formErrors,
  onCancel,
  onConfirm,
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

  const handleSelectSlot = (iso, hhmm) => {
    agenda.selectDispSlot(iso, hhmm);
    onConfirm();
  };

  return (
    <div
      className="fixed inset-0 z-[225] flex flex-col bg-white lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="disp-mobile-sheet-title"
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-200 px-4 py-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <h2 id="disp-mobile-sheet-title" className="text-[16px] font-black text-gray-900">
          Disponibilidade
        </h2>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl p-2 text-gray-500 hover:bg-gray-50"
          aria-label="Fechar"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 custom-scrollbar">
        <AgendaDisponibilidadeBody
          agenda={agenda}
          formErrors={formErrors}
          layout="stacked"
          onSelectSlot={handleSelectSlot}
          slotsMaxListHeight="min(40dvh, 280px)"
        />
      </div>

      <footer className="flex shrink-0 gap-2 border-t border-gray-200 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button type="button" onClick={onCancel} className={`${BTN_ACTION} border border-gray-200 text-gray-600 hover:bg-gray-50`}>
          Cancelar
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className={`${BTN_ACTION} bg-teal-600 text-white hover:bg-teal-700`}
        >
          Confirmar
        </button>
      </footer>
    </div>
  );
}
