import React from 'react';
import { Loader2 } from 'lucide-react';
import { BTN, BTN_PRIMARY, SAVEBAR } from './editorDocumentoTokens.js';
import { formatarInstante } from '../../utils/datasClinica';
import { useFusoClinica } from '../hooks/useFusoClinica';

function formatTime(date, fuso) {
  if (!date) return '';
  return formatarInstante(date, fuso, { hour: '2-digit', minute: '2-digit' });
}

export function AnamneseDocSaveBar({
  dirty,
  saving,
  lastSavedAt,
  editavel,
  onSave,
  onPreview,
}) {
  const { fuso } = useFusoClinica();
  return (
    <div className={SAVEBAR}>
      <span
        className={`flex flex-1 items-center gap-1.5 text-[12px] ${
          dirty && !saving ? 'font-semibold text-teal-800' : 'text-[#64748b]'
        }`}
      >
        {saving ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            Salvando...
          </>
        ) : dirty ? (
          <>● Alterações não salvas</>
        ) : lastSavedAt ? (
          <>Salvo às {formatTime(lastSavedAt, fuso)}</>
        ) : (
          <>Salvo</>
        )}
      </span>
      <button type="button" className={BTN} onClick={onPreview}>
        Pré-visualizar
      </button>
      <button
        type="button"
        className={BTN_PRIMARY}
        onClick={onSave}
        disabled={!editavel || saving || !dirty}
      >
        {saving ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            Salvando…
          </>
        ) : (
          'Salvar'
        )}
      </button>
    </div>
  );
}
