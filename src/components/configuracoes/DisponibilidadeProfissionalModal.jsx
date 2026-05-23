import { useState, useEffect, useCallback } from 'react';
import { X, Save, Loader2 } from 'lucide-react';
import { disponibilidadeApi, getApiErrorToastMessage } from '../../services/api.js';
import { useToast } from '../../contexts/useToast.js';
import { HorarioIntervalosEditor } from './HorarioIntervalosEditor.jsx';

export default function DisponibilidadeProfissionalModal({
  roleUserId,
  nome,
  onClose,
  onSaved,
}) {
  const [disp, setDisp] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { success, error: toastError } = useToast();

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const d = await disponibilidadeApi.buscar(roleUserId);
      setDisp(Array.isArray(d) ? d : []);
    } catch (e) {
      toastError(getApiErrorToastMessage(e, 'Erro ao carregar disponibilidade'));
    } finally {
      setLoading(false);
    }
  }, [roleUserId, toastError]);

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow || 'unset';
    };
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const handleSalvar = async () => {
    const hasInvalid = disp.some((r) => r?.horaInicio && r?.horaFim && String(r.horaFim) <= String(r.horaInicio));
    if (hasInvalid) {
      toastError('Horário final deve ser depois do horário inicial');
      return;
    }
    setSaving(true);
    try {
      const atualizado = await disponibilidadeApi.atualizar(roleUserId, disp);
      setDisp(Array.isArray(atualizado) ? atualizado : disp);
      success('Disponibilidade salva');
      onSaved?.();
    } catch (e) {
      toastError(getApiErrorToastMessage(e, 'Erro ao salvar'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Disponibilidade do profissional</h2>
            {nome ? <p className="text-sm text-slate-500">{nome}</p> : null}
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-[#00a88e]" />
          </div>
        ) : null}

        {!loading && disp ? (
          <>
            <p className="mb-4 text-sm text-slate-600">
              Configure os intervalos fixos de atendimento da semana.
            </p>
            <HorarioIntervalosEditor
              value={disp}
              onChange={setDisp}
              addButtonLabel="Adicionar intervalo"
              emptyStateLabel="Nenhum horário fixo cadastrado."
            />

            <div className="mt-5 flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={handleSalvar}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-[#00a88e] px-4 py-2 text-sm font-bold text-white hover:bg-[#008f78] disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
