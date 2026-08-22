import React from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { ViewportDialog } from '../shared/ViewportDialog.jsx';
import { BTN, BTN_PRIMARY } from './editorDocumentoTokens.js';

/**
 * Modal 3 botões para sair do editor com alterações não salvas.
 */
export function AnamneseDocUnsavedModal({
  open,
  saving,
  onSaveAndLeave,
  onDiscard,
  onCancel,
}) {
  return (
    <ViewportDialog open={open} onDismiss={onCancel} titleId="unsaved-ficha-title">
      <div className="border-b border-[#f1f5f9] bg-[#fbfefe] px-5 py-4">
        <div className="flex items-start gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
            <AlertTriangle className="h-5 w-5" strokeWidth={2} />
          </div>
          <div>
            <b id="unsaved-ficha-title" className="block text-[13px] font-semibold text-[#0f172a]">
              Sair sem salvar?
            </b>
            <span className="mt-0.5 block text-[11.5px] leading-snug text-[#64748b]">
              Você tem alterações não salvas.
            </span>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:justify-end">
        <button
          type="button"
          data-dialog-initial-focus
          className={BTN}
          onClick={onCancel}
          disabled={saving}
        >
          Cancelar
        </button>
        <button
          type="button"
          className="inline-flex h-[37px] items-center gap-1.5 rounded-[10px] border border-rose-200 bg-rose-50 px-4 text-[13px] font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
          onClick={onDiscard}
          disabled={saving}
        >
          Sair sem salvar
        </button>
        <button type="button" className={BTN_PRIMARY} onClick={onSaveAndLeave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Salvar e sair
        </button>
      </div>
    </ViewportDialog>
  );
}
