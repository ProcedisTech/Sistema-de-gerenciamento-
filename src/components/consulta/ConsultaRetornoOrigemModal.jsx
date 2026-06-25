import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { RetornoOrigemSelect } from '../agenda/RetornoOrigemSelect.jsx';
import { pacientesApi } from '../../services/api.js';
import { normalizeApiList } from '../../utils/agendaDashboardMapping.js';

export function ConsultaRetornoOrigemModal({
  open,
  pacienteId,
  onClose,
  onConfirm,
}) {
  const [selectedId, setSelectedId] = useState('');
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [fieldError, setFieldError] = useState('');

  useEffect(() => {
    if (!open || !pacienteId) return undefined;
    let cancelled = false;
    pacientesApi
      .listarProcedimentosFeitosRaiz(pacienteId)
      .then((raw) => {
        if (cancelled) return;
        setOptions(normalizeApiList(raw));
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message || 'Erro ao carregar procedimentos.');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, pacienteId]);

  if (!open) return null;

  const handleConfirm = () => {
    const id = String(selectedId || '').trim();
    if (!id) {
      setFieldError('Selecione o procedimento de origem do retorno.');
      return;
    }
    onConfirm?.(id);
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-slate-900/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="consulta-retorno-origem-title"
    >
      <div className="w-full max-w-md rounded-xl border border-app-border bg-white p-5 shadow-app-card">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3
              id="consulta-retorno-origem-title"
              className="text-[16px] font-bold text-[#0f172a]"
            >
              Iniciar retorno
            </h3>
            <p className="mt-1 text-[13px] text-[#64748b]">
              Escolha o procedimento anterior que será avaliado neste retorno.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#64748b] hover:bg-app-nav-hover"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <RetornoOrigemSelect
          value={selectedId}
          onChange={(val) => {
            setSelectedId(val);
            setFieldError('');
          }}
          options={options}
          loading={loading}
          error={error}
          fieldError={fieldError}
        />

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-app-border px-4 py-2.5 text-[13px] font-semibold text-[#64748b] hover:bg-app-nav-hover"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading || !selectedId}
            className="rounded-xl bg-[#00a88e] px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-[#00967f] disabled:opacity-60"
          >
            Continuar
          </button>
        </div>
      </div>
    </div>
  );
}
