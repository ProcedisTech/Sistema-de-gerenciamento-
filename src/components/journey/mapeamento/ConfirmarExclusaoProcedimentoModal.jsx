import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Trash2, X } from 'lucide-react';

const LABELS_VISTAS = {
  frontal: 'Frontal',
  lateral_dir: 'Lateral Direita',
  lateral_esq: 'Lateral Esquerda',
  obliqua_dir: 'Oblíqua Direita',
  obliqua_esq: 'Oblíqua Esquerda',
  sorriso: 'Sorriso',
  repouso: 'Repouso',
  antes: 'Antes',
  depois: 'Depois',
};

function formatarListaVistas(vistas = []) {
  if (!Array.isArray(vistas) || vistas.length === 0) return '';
  return vistas.map((v) => LABELS_VISTAS[v] || String(v)).join(', ');
}

export function ConfirmarExclusaoProcedimentoModal({
  open = false,
  procedimentoNome = 'Procedimento',
  pontosCount = 0,
  doseTotal = 0,
  unidadeMedida = '',
  vistasAfetadas = [],
  busy = false,
  onCancel,
  onConfirm,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (!busy) onCancel?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [open, busy, onCancel]);

  if (!open) return null;

  const qtdPontos = Number(pontosCount) || 0;
  const doseNum = Number(doseTotal) || 0;
  const vistasFormatadas = formatarListaVistas(vistasAfetadas);

  const modalNode = (
    <div
      className="fixed inset-0 z-[250] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[2px]"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        if (!busy) onCancel?.();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-excluir-proc-title"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600 border border-rose-200">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h3 id="confirm-excluir-proc-title" className="text-sm font-bold text-slate-900">
                Apagar procedimento e suas marcações?
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                O procedimento <strong className="font-semibold text-slate-800">{procedimentoNome || 'Procedimento'}</strong> possui{' '}
                <strong className="font-semibold text-rose-700">
                  {qtdPontos} {qtdPontos === 1 ? 'marcação' : 'marcações'}
                </strong>{' '}
                no mapa
                {doseNum > 0 ? ` (${doseNum}${unidadeMedida ? ` ${unidadeMedida}` : ''})` : ''}.
              </p>
              {vistasFormatadas ? (
                <p className="mt-1 text-[11px] font-medium text-slate-500">
                  Vistas afetadas: {vistasFormatadas}
                </p>
              ) : null}
              <p className="mt-2 text-xs text-slate-500">
                Ao confirmar, o procedimento e todos os seus pontos e traços serão removidos.
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={busy}
            aria-label="Cancelar exclusão"
            onClick={() => onCancel?.()}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => onCancel?.()}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onConfirm?.()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-rose-700 disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Apagar procedimento e marcações
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document !== 'undefined' && document.body) {
    return createPortal(modalNode, document.body);
  }
  return modalNode;
}

