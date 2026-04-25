import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import {
  atualizarRelatoAcompanhamento,
  buscarRelatoPorSessao,
  criarRelatoAcompanhamento,
  getApiErrorDetail,
} from '../../services/api.js';

function buildInitialForm(relato = null) {
  return {
    evolucao: relato?.evolucao || '',
    reacoes: relato?.reacoes || '',
    observacoes: relato?.observacoes || '',
    podeProsseguir: Boolean(relato?.podeProsseguir),
  };
}

export function RelatoAcompanhamentoModal({
  isOpen,
  onClose,
  procedimentoFeitoId,
  pacienteId,
  procedures,
  onConfirmProsseguir,
  onAjustarPlano,
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [relato, setRelato] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState(() => buildInitialForm());
  const [selectedProcedimentoFeitoId, setSelectedProcedimentoFeitoId] = useState('');

  const effectiveProcedimentoFeitoId = useMemo(() => {
    if (procedimentoFeitoId != null && String(procedimentoFeitoId).trim() !== '') {
      return String(procedimentoFeitoId).trim();
    }
    const selected = String(selectedProcedimentoFeitoId || '').trim();
    return selected || null;
  }, [procedimentoFeitoId, selectedProcedimentoFeitoId]);

  const procedureOptions = useMemo(() => {
    if (!Array.isArray(procedures)) return [];
    return procedures
      .map((proc) => {
        const id = proc?.id ?? proc?.procedimentoFeitoId ?? proc?.procedimentoId;
        const label = (proc?.procedimentoNome || proc?.nome || '').trim();
        if (id == null || String(id).trim() === '' || !label) return null;
        return { id: String(id), label };
      })
      .filter(Boolean);
  }, [procedures]);

  const canSubmit =
    effectiveProcedimentoFeitoId != null &&
    String(effectiveProcedimentoFeitoId).trim() !== '' &&
    pacienteId != null &&
    String(pacienteId).trim() !== '';
  const isLoading = loading || saving;

  const aptoLabel = useMemo(
    () => (form.podeProsseguir ? 'Apto para próxima sessão' : 'Necessita ajuste no plano'),
    [form.podeProsseguir],
  );

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    setSuccess('');
    setRelato(null);
    setIsEditing(false);
    setForm(buildInitialForm());
    if (procedimentoFeitoId != null && String(procedimentoFeitoId).trim() !== '') {
      setSelectedProcedimentoFeitoId(String(procedimentoFeitoId).trim());
    } else {
      setSelectedProcedimentoFeitoId('');
    }
  }, [isOpen, procedimentoFeitoId]);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    if (!pacienteId) {
      setLoading(false);
      setError('Sessão inválida para acompanhamento. Reabra a sessão e tente novamente.');
      return;
    }

    if (!effectiveProcedimentoFeitoId) {
      setLoading(false);
      setRelato(null);
      setIsEditing(false);
      setForm(buildInitialForm());
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    setRelato(null);
    setIsEditing(false);
    setForm(buildInitialForm());

    buscarRelatoPorSessao(effectiveProcedimentoFeitoId)
      .then((data) => {
        if (cancelled) return;
        console.log('[DEBUG] Relato encontrado: true | Acao no submit sera: PUT');
        setRelato(data || null);
        setForm(buildInitialForm(data));
      })
      .catch((err) => {
        if (cancelled) return;
        if (err?.status === 404) {
          console.log('[DEBUG] Relato encontrado: false | Acao no submit sera: POST');
          setRelato(null);
          setForm(buildInitialForm());
          return;
        }
        const detail = getApiErrorDetail(err);
        setError(detail || err?.message || 'Não foi possível carregar o relato desta sessão.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, pacienteId, effectiveProcedimentoFeitoId]);

  const handleOverlayClick = (event) => {
    if (event.target === event.currentTarget) {
      onClose?.();
    }
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (isLoading) return;
    setError('');
    setSuccess('');

    if (!effectiveProcedimentoFeitoId) {
      setError('Selecione o procedimento');
      return;
    }

    if (!canSubmit) {
      setError('Sessão inválida para salvar o acompanhamento.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        procedimentoFeitoId: String(effectiveProcedimentoFeitoId),
        pacienteId: String(pacienteId),
        evolucao: form.evolucao,
        reacoes: form.reacoes,
        observacoes: form.observacoes,
        podeProsseguir: Boolean(form.podeProsseguir),
      };
      const hasRelato =
        relato?.relatoAcompanhamentoId != null &&
        String(relato.relatoAcompanhamentoId).trim() !== '';

      const saved = hasRelato
        ? await atualizarRelatoAcompanhamento(relato.relatoAcompanhamentoId, payload)
        : await criarRelatoAcompanhamento(payload);

      setRelato(saved || payload);
      setForm(buildInitialForm(saved || payload));
      setIsEditing(false);
      setSuccess(hasRelato ? 'Relato atualizado com sucesso.' : 'Relato salvo com sucesso.');
    } catch (err) {
      const detail = getApiErrorDetail(err);
      setError(detail || err?.message || 'Não foi possível salvar o relato de acompanhamento.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const showReadMode = Boolean(relato) && !isEditing;
  const source = relato || form;

  return (
    <div
      className="fixed inset-0 z-[260] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="relato-acompanhamento-title"
      onMouseDown={handleOverlayClick}
    >
      <div className="absolute inset-0 bg-black/60" />

      <div
        className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-app-border bg-white shadow-xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-app-border p-4">
          <div>
            <h3 id="relato-acompanhamento-title" className="text-[17px] font-bold text-[#0f172a]">
              Relato de acompanhamento
            </h3>
            <p className="mt-0.5 text-[12px] font-medium text-[#64748b]">
              Sessão {effectiveProcedimentoFeitoId ? `#${String(effectiveProcedimentoFeitoId).slice(0, 8)}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-10 w-10 rounded-xl border border-transparent text-[#94a3b8] hover:bg-[#f8fbfb]"
            aria-label="Fechar"
          >
            <X className="mx-auto h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-[#64748b]">
              <Loader2 className="h-5 w-5 animate-spin text-[#00a88e]" />
              <span className="ml-2 text-[13px] font-medium">Carregando relato...</span>
            </div>
          ) : (
            <>
              {error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-[13px] font-bold text-red-700">
                  {error}
                </div>
              ) : null}

              {success ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-[13px] font-bold text-emerald-700">
                  {success}
                </div>
              ) : null}

              {!procedimentoFeitoId ? (
                <label className="block space-y-1.5">
                  <span className="text-[13px] font-bold text-[#00a88e]">Procedimento da sessão</span>
                  <select
                    value={selectedProcedimentoFeitoId}
                    onChange={(event) => {
                      setSelectedProcedimentoFeitoId(event.target.value);
                      setError('');
                      setSuccess('');
                    }}
                    className="w-full appearance-none rounded-xl border border-slate-200 bg-[#f8fbfb] px-4 py-3 text-[14px] font-medium outline-none focus:border-[#00a88e]"
                  >
                    <option value="">Selecione o procedimento...</option>
                    {procedureOptions.map((proc) => (
                      <option key={proc.id} value={proc.id}>
                        {proc.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {showReadMode ? (
                <div className="space-y-3">
                  <div className="rounded-xl border border-slate-200 bg-[#f8fbfb] p-3">
                    <div className="text-[11px] font-bold uppercase tracking-wide text-[#64748b]">
                      Evolução desde a última sessão
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-[13px] text-[#0f172a]">
                      {source.evolucao?.trim() ? source.evolucao : '—'}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-[#f8fbfb] p-3">
                    <div className="text-[11px] font-bold uppercase tracking-wide text-[#64748b]">
                      Reações ou intercorrências
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-[13px] text-[#0f172a]">
                      {source.reacoes?.trim() ? source.reacoes : '—'}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-[#f8fbfb] p-3">
                    <div className="text-[11px] font-bold uppercase tracking-wide text-[#64748b]">
                      Observações gerais
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-[13px] text-[#0f172a]">
                      {source.observacoes?.trim() ? source.observacoes : '—'}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-[#f8fbfb] p-3">
                    <div className="text-[11px] font-bold uppercase tracking-wide text-[#64748b]">
                      Paciente apto para próxima sessão
                    </div>
                    <p className="mt-1 text-[13px] font-bold text-[#0f172a]">
                      {source.podeProsseguir ? 'Sim' : 'Não'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-[13px] font-bold text-[#0f766e] hover:bg-[#f8fbfb]"
                  >
                    Editar
                  </button>
                </div>
              ) : (
                <form className="space-y-3" onSubmit={handleSave}>
                  <label className="block space-y-1.5">
                    <span className="text-[13px] font-bold text-[#00a88e]">Evolução desde a última sessão</span>
                    <textarea
                      value={form.evolucao}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, evolucao: event.target.value }))
                      }
                      rows={4}
                      className="w-full resize-y rounded-xl border border-slate-200 bg-[#f8fbfb] px-4 py-3 text-[14px] font-medium outline-none focus:border-[#00a88e]"
                    />
                  </label>

                  <label className="block space-y-1.5">
                    <span className="text-[13px] font-bold text-[#00a88e]">Reações ou intercorrências</span>
                    <textarea
                      value={form.reacoes}
                      onChange={(event) => setForm((prev) => ({ ...prev, reacoes: event.target.value }))}
                      rows={4}
                      className="w-full resize-y rounded-xl border border-slate-200 bg-[#f8fbfb] px-4 py-3 text-[14px] font-medium outline-none focus:border-[#00a88e]"
                    />
                  </label>

                  <label className="block space-y-1.5">
                    <span className="text-[13px] font-bold text-[#00a88e]">Observações gerais</span>
                    <textarea
                      value={form.observacoes}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, observacoes: event.target.value }))
                      }
                      rows={4}
                      className="w-full resize-y rounded-xl border border-slate-200 bg-[#f8fbfb] px-4 py-3 text-[14px] font-medium outline-none focus:border-[#00a88e]"
                    />
                  </label>

                  <label className="flex items-center justify-between gap-3 rounded-xl border border-app-border bg-[#f8fbfb] px-4 py-3">
                    <div>
                      <div className="text-[13px] font-bold text-[#0f172a]">Paciente apto para próxima sessão</div>
                      <div className="text-[12px] font-medium text-[#64748b]">{aptoLabel}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setForm((prev) => ({ ...prev, podeProsseguir: !prev.podeProsseguir }))
                      }
                      className={`relative h-8 w-14 shrink-0 overflow-hidden rounded-full border-[2px] transition-colors ${
                        form.podeProsseguir
                          ? 'border-[#00a88e] bg-[#00a88e]/80'
                          : 'border-[#cbd5e1] bg-[#e2e8f0]'
                      }`}
                      role="switch"
                      aria-checked={form.podeProsseguir}
                      aria-label="Paciente apto para próxima sessão"
                    >
                      <span
                        className={`absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white transition-transform ${
                          form.podeProsseguir ? 'translate-x-6' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </label>

                  <div className="flex flex-col-reverse justify-end gap-2 pt-1 sm:flex-row">
                    {relato ? (
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditing(false);
                          setForm(buildInitialForm(relato));
                          setError('');
                        }}
                        className="rounded-xl border border-slate-200 px-4 py-3 text-[13px] font-bold text-[#64748b] hover:bg-[#f8fbfb]"
                      >
                        Cancelar edição
                      </button>
                    ) : null}
                    <button
                      type="submit"
                      disabled={!canSubmit || isLoading}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-transparent bg-[#00a88e] px-4 py-3 text-[13px] font-bold text-white hover:bg-[#00967f] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Salvar relato
                    </button>
                  </div>
                </form>
              )}

              {relato ? (
                <div className="border-t border-app-border pt-4">
                  {relato.podeProsseguir ? (
                    <button
                      type="button"
                      onClick={onConfirmProsseguir}
                      className="w-full rounded-xl border border-transparent bg-[#00a88e] px-4 py-3 text-[14px] font-bold text-white hover:bg-[#00967f]"
                    >
                      Prosseguir para Execução
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={onAjustarPlano}
                      className="w-full rounded-xl border border-transparent bg-amber-500 px-4 py-3 text-[14px] font-bold text-white hover:bg-amber-600"
                    >
                      Ajustar Plano
                    </button>
                  )}
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

