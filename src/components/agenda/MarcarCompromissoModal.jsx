import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, X, Loader2 } from 'lucide-react';
import { pacientesApi } from '../../services/api';
import { mapBackendPatient } from '../../utils/patientMapping';

export function MarcarCompromissoModal({
  isOpen,
  onClose,
  horarioResumo,
  error,
  saving,
  patients,
  patientSearch,
  setPatientSearch,
  selectedPatientCpf,
  setSelectedPatientCpf,
  catalogosList,
  catalogoProcedimentoSaudeId,
  setCatalogoProcedimentoSaudeId,
  observacao,
  setObservacao,
  onConfirm,
  patientPickerLocked = false,
  lockedPatientLabel = '',
}) {
  const [remotePatients, setRemotePatients] = useState([]);

  useEffect(() => {
    if (!isOpen) {
      setRemotePatients([]);
      return undefined;
    }
    if (patientPickerLocked) {
      setRemotePatients([]);
      return undefined;
    }
    const q = patientSearch.trim();
    if (q.length < 2) return undefined;
    let cancelled = false;
    const t = window.setTimeout(() => {
      pacientesApi
        .search(q)
        .then((pageData) => {
          if (cancelled) return;
          const rows = pageData?.content ?? [];
          const mapped = Array.isArray(rows) ? rows.map(mapBackendPatient).filter(Boolean) : [];
          setRemotePatients(mapped);
        })
        .catch(() => {
          if (!cancelled) setRemotePatients([]);
        });
    }, 320);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [isOpen, patientPickerLocked, patientSearch]);

  const displayedPatients = useMemo(() => {
    if (!isOpen) return [];
    const q = patientSearch.trim().toLowerCase();
    const base =
      patientPickerLocked && patients?.length ? patients : q.length >= 2 ? remotePatients : patients || [];
    return base.filter((p) => {
      if (!q) return true;
      return [p.nome, p.cpf, p.telefone].filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
    });
  }, [isOpen, patients, patientPickerLocked, remotePatients, patientSearch]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center p-4" onMouseDown={onClose}>
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        className="relative w-full max-w-lg bg-white rounded-2xl border border-app-border shadow-xl overflow-y-auto max-h-[90vh]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="p-4 flex items-center justify-between border-b border-app-border">
          <div className="flex items-center gap-3">
            <Calendar className="w-6 h-6 text-[#00a88e]" strokeWidth={2.5} />
            <div>
              <h4 className="text-[16px] font-bold text-[#0f172a]">Marcar atendimento</h4>
              <p className="text-[11px] font-medium text-[#94a3b8]">Neste horário da agenda</p>
              <p className="text-[12px] font-medium text-[#64748b] mt-0.5">{horarioResumo}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-xl hover:bg-[#f8fbfb] border border-transparent text-[#94a3b8]"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {error ? (
            <div className="p-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 text-[13px] font-bold">
              {error}
            </div>
          ) : null}

          <div className="space-y-1.5">
            <label className="text-[13px] font-bold text-[#00a88e]">Paciente (cadastro no servidor)</label>
            {patientPickerLocked ? (
              <div className="w-full px-4 py-3 bg-[#f1f5f9] border border-slate-200 rounded-xl text-[14px] font-semibold text-[#0f172a]">
                {lockedPatientLabel || 'Paciente atual'}
              </div>
            ) : (
              <>
                <input
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  placeholder="Buscar nome, CPF ou telefone..."
                  className="w-full px-4 py-3 bg-[#f8fbfb] border border-slate-200 rounded-xl text-[14px] font-medium outline-none focus:border-[#00a88e]"
                />
                <div className="max-h-[160px] overflow-y-auto rounded-xl border border-slate-200">
                  {displayedPatients.length > 0 ? (
                    displayedPatients.map((p) => {
                      const sel = (selectedPatientCpf || '') === String(p.cpf || '').trim();
                      return (
                        <button
                          key={p.id || p.cpf}
                          type="button"
                          onClick={() => setSelectedPatientCpf(String(p.cpf || '').trim())}
                          className={`w-full text-left px-3 py-2.5 text-[13px] border-b border-[#f1f5f9] last:border-0 ${
                            sel ? 'bg-[#e6f7f5] font-bold text-[#0f766e]' : 'hover:bg-[#f8fbfb]'
                          }`}
                        >
                          {p.nome}
                          {!p.id && <span className="text-amber-600 text-[11px] ml-1">(sem ID)</span>}
                        </button>
                      );
                    })
                  ) : !(patients?.length) && patientSearch.trim().length < 2 ? (
                    <p className="px-3 py-2.5 text-[12px] font-medium text-slate-500">
                      Digite o nome do paciente para buscar
                    </p>
                  ) : (
                    <p className="px-3 py-2.5 text-[12px] font-medium text-slate-500">Nenhum paciente encontrado</p>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-[13px] font-bold text-[#00a88e]">Procedimento (catálogo)</label>
            <select
              value={catalogoProcedimentoSaudeId}
              onChange={(e) => setCatalogoProcedimentoSaudeId(e.target.value)}
              className="w-full px-4 py-3 bg-[#f8fbfb] border border-slate-200 rounded-xl text-[14px] font-medium appearance-none outline-none focus:border-[#00a88e]"
            >
              <option value="">Selecione...</option>
              {(catalogosList || []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nomeProcedimento}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[13px] font-bold text-[#00a88e]">Observação (opcional)</label>
            <input
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              className="w-full px-4 py-3 bg-[#f8fbfb] border border-slate-200 rounded-xl text-[14px] font-medium outline-none focus:border-[#00a88e]"
            />
          </div>
        </div>

        <div className="p-4 border-t-[3px] border-[#00a88e]/15 flex flex-col-reverse sm:flex-row gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-5 py-3 rounded-xl font-bold text-[14px] border border-slate-200 text-[#64748b] hover:bg-[#f8fbfb] disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={saving}
            className="px-5 py-3 rounded-xl font-bold text-[14px] bg-[#00a88e] text-white border border-transparent flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
