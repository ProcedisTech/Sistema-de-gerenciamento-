/**
 * Modal de cancelamento de slot da agenda (Onda 4).
 * Carrega motivos em GET /api/v1/motivos-cancelamento ao montar.
 * onConfirm → { motivoCancelamentoId, motivoCancelamentoTexto? }
 */
import { useState, useEffect } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { motivosCancelamentoApi, getApiErrorToastMessage } from '../../services/api.js';
import { normalizeApiList } from '../../utils/agendaDashboardMapping.js';

function formatDataPt(iso) {
  if (!iso) return '';
  const [y, m, d] = String(iso).split('T')[0].split('-');
  return d && m && y ? `${d}/${m}/${y}` : String(iso);
}

export default function CancelarAgendaModal({
  agenda: _agenda,
  retornosVinculados = [],
  onClose,
  onConfirm,
  isSubmitting = false,
}) {
  const [motivos, setMotivos] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [motivoId, setMotivoId] = useState('');
  const [texto, setTexto] = useState('');
  const [cancelarRetornoJunto, setCancelarRetornoJunto] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError('');
    motivosCancelamentoApi
      .listar()
      .then((list) => {
        if (cancelled) return;
        const arr = normalizeApiList(list).filter((m) => m && (m.ativo !== false));
        setMotivos(arr);
      })
      .catch((e) => {
        if (cancelled) return;
        setLoadError(getApiErrorToastMessage(e, 'Não foi possível carregar os motivos de cancelamento.'));
        setMotivos([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = motivos.find((m) => String(m.motivoCancelamentoId) === String(motivoId));
  const exigeTexto = Boolean(selected?.codigo && String(selected.codigo).toLowerCase() === 'outro');
  const podeConfirmar = Boolean(motivoId) && (!exigeTexto || texto.trim().length > 0);

  const handleConfirm = async () => {
    if (!podeConfirmar) return;
    await onConfirm({
      motivoCancelamentoId: motivoId,
      motivoCancelamentoTexto: texto.trim() ? texto.trim().slice(0, 500) : undefined,
      cancelarRetornos: cancelarRetornoJunto ? retornosVinculados : [],
    });
  };

  return (
    <div className="fixed inset-0 z-[230] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Cancelar agendamento</h2>
          <button type="button" onClick={onClose} className="rounded-full p-1 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {retornosVinculados.length > 0 && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900 space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-amber-950">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <span>Retorno vinculado detectado</span>
            </div>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              Este procedimento possui {retornosVinculados.length === 1 ? '1 retorno agendado' : `${retornosVinculados.length} retornos agendados`} no plano do paciente:
            </p>
            <div className="space-y-1.5 bg-white/80 rounded-lg p-2 border border-amber-200/70 font-medium">
              {retornosVinculados.map((r) => (
                <div key={r.agendaId || r.id} className="flex justify-between items-center text-[11px]">
                  <span>
                    Retorno: <strong>{r.data ? formatDataPt(r.data) : ''}</strong> às {r.horaInicio || ''}
                  </span>
                  <span className="text-[10px] text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded font-bold">
                    Vinculado ao Plano
                  </span>
                </div>
              ))}
            </div>
            <label className="flex items-center gap-2 cursor-pointer pt-1 text-[11px] font-bold text-amber-950">
              <input
                type="checkbox"
                checked={cancelarRetornoJunto}
                onChange={(e) => setCancelarRetornoJunto(e.target.checked)}
                className="rounded text-amber-600 focus:ring-amber-500 h-3.5 w-3.5"
              />
              <span>Cancelar também o{retornosVinculados.length > 1 ? 's retornos' : ' retorno'} com o mesmo motivo</span>
            </label>
          </div>
        )}

        <p className="mb-4 text-sm text-gray-600">Por favor, informe o motivo do cancelamento.</p>

        {loading ? (
          <p className="mb-4 text-sm text-gray-500">Carregando motivos…</p>
        ) : null}
        {loadError ? (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{loadError}</div>
        ) : null}

        <div className="mb-4 max-h-[240px] space-y-2 overflow-y-auto">
          {!loading &&
            motivos.map((m) => (
              <label
                key={m.motivoCancelamentoId}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 p-3 hover:bg-gray-50"
              >
                <input
                  type="radio"
                  name="motivo"
                  value={m.motivoCancelamentoId}
                  checked={motivoId === m.motivoCancelamentoId}
                  onChange={() => setMotivoId(m.motivoCancelamentoId)}
                  className="h-4 w-4 text-emerald-600"
                />
                <span className="text-sm text-gray-900">{m.nome || m.codigo || m.motivoCancelamentoId}</span>
              </label>
            ))}
        </div>

        {exigeTexto ? (
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-gray-700">Descreva o motivo *</label>
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value.slice(0, 500))}
              maxLength={500}
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              placeholder="Explique o motivo do cancelamento"
            />
            <p className="mt-1 text-xs text-gray-500">{texto.length}/500</p>
          </div>
        ) : (
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-gray-700">Comentário (opcional)</label>
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value.slice(0, 500))}
              maxLength={500}
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              placeholder="Detalhes adicionais para a clínica"
            />
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Voltar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!podeConfirmar || isSubmitting || loading}
            className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Cancelando...' : 'Confirmar cancelamento'}
          </button>
        </div>
      </div>
    </div>
  );
}
