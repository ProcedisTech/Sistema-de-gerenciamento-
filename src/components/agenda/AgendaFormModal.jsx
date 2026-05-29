import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, ChevronDown, ChevronUp } from 'lucide-react';
import { useUsuarioLogado } from '../../hooks/useUsuarioLogado.js';
import { PacienteSearchInput } from './PacienteSearchInput.jsx';
import { CalendarioMensal } from './CalendarioMensal.jsx';
import { PainelA_SlotsHorario } from './PainelA_SlotsHorario.jsx';
import { ProcedimentosMultiSeletor } from './ProcedimentosMultiSeletor.jsx';
import { ProfissionalSeletor } from './ProfissionalSeletor.jsx';
import { PainelB_SeletorProcedimento } from './PainelB_SeletorProcedimento.jsx';
import { PainelC_SeletorProfissional } from './PainelC_SeletorProfissional.jsx';

// painel ativo no lado direito: 'A' = slots, 'B' = procedimentos, 'C' = profissional
const PAINEL = { A: 'A', B: 'B', C: 'C' };

function resolveProfissionalNome(agenda) {
  const id = String(agenda.roleUserIdAgenda || '').trim();
  if (!id) return '';
  const fromEquipe = (agenda.equipeList || []).find((p) => String(p.roleUserId) === id);
  if (fromEquipe?.nome) return fromEquipe.nome;
  return agenda.editingAppointment?.profissionalNome || '';
}

function buildResumo({ form, agenda, duracaoTotalMin, procedimentosSelecionados }) {
  const partes = [];
  if (form.pacienteNome) partes.push(form.pacienteNome);
  if (procedimentosSelecionados.length > 0) {
    const nomes = procedimentosSelecionados.map((p) => p.nome).join(', ');
    partes.push(nomes);
  }
  if (form.data) {
    const [y, m, d] = form.data.split('-');
    partes.push(`${d}/${m}/${y}`);
  }
  if (form.horaInicio) partes.push(form.horaInicio);
  if (duracaoTotalMin > 0) partes.push(`${duracaoTotalMin} min`);
  const profNome = resolveProfissionalNome(agenda);
  if (profNome) partes.push(profNome);
  return partes.join(' · ');
}

export function AgendaFormModal({ agenda, onExcluirClick }) {
  const { ehProfissionalClinico, roleUserId: roleLogadoId } = useUsuarioLogado();
  const [painelAtivo, setPainelAtivo] = useState(PAINEL.A);
  const [horaPendentePainelC, setHoraPendentePainelC] = useState('');
  const [obsAberta, setObsAberta] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resultadosSalvar, setResultadosSalvar] = useState(null);

  // ── Estado local de procedimentos selecionados ──────────────────────────────
  // Array de { id, nome, tipoCodigo, duracaoMin, duracaoSelecionada }
  // fonte autoritativa de IDs: form.catalogoProcedimentoSaudeIds (sincronizados via handlers)
  const [procedimentosSelecionados, setProcedimentosSelecionados] = useState([]);
  const prevIdsRef = useRef([]);

  // Hidratação: sincroniza chips com form.catalogoProcedimentoSaudeIds
  // Roda quando: (A) ids mudaram OU (B) há chips fallback resolvíveis pelo catálogo
  useEffect(() => {
    const ids = agenda.form.catalogoProcedimentoSaudeIds ?? [];
    const opts = agenda.procedimentoOptions ?? [];
    const prevIds = prevIdsRef.current;

    const idsIguais =
      ids.length === prevIds.length && ids.every((id, i) => id === prevIds[i]);

    // Condição B: chip fallback + catálogo já chegou
    const temFallbackResolvivel =
      idsIguais &&
      procedimentosSelecionados.some(
        (p) => p.nome === '(Procedimento)' && opts.find((o) => String(o.id) === String(p.id))
      );

    if (idsIguais && !temFallbackResolvivel) return;

    prevIdsRef.current = ids;

    if (ids.length === 0) {
      setProcedimentosSelecionados([]);
      return;
    }

    setProcedimentosSelecionados((current) =>
      ids.map((id) => {
        const existente = current.find((p) => p.id === id);
        const opt = opts.find((o) => String(o.id) === String(id));
        if (opt) {
          // Se já existe com nome real, preserva (inclusive duracaoSelecionada editada)
          if (existente && existente.nome !== '(Procedimento)') return existente;
          return {
            id: opt.id,
            nome: opt.nome,
            tipoCodigo: opt.tipoCodigo,
            duracaoMin: opt.duracaoMin,
            duracaoSelecionada: existente?.duracaoSelecionada ?? opt.duracaoMin,
          };
        }
        // Catálogo ainda não chegou — fallback temporário
        return existente ?? { id, nome: '(Procedimento)', tipoCodigo: '', duracaoMin: 45, duracaoSelecionada: 45 };
      })
    );
  }, [agenda.form.catalogoProcedimentoSaudeIds, agenda.procedimentoOptions]); // procedimentosSelecionados fora das deps — lido via setter funcional

  // ── Derivados ───────────────────────────────────────────────────────────────
  const isReagendar = agenda.modalMode === 'reagendar';
  const lockPatient = Boolean(agenda.patientSelectLocked);
  const profissionalFixado = ehProfissionalClinico || Boolean(agenda.roleUserIdAgenda);
  const roleUserIdFiltro = ehProfissionalClinico ? roleLogadoId : (agenda.roleUserIdAgenda || '');
  const duracaoTotalMin = procedimentosSelecionados.reduce((acc, p) => acc + (Number(p.duracaoSelecionada) || 0), 0);

  const confirmDisabled =
    !agenda.form.pacienteId ||
    !(agenda.form.catalogoProcedimentoSaudeIds?.length > 0) ||
    !agenda.form.data ||
    !agenda.form.horaInicio ||
    !agenda.roleUserIdAgenda;

  const resumoTexto = buildResumo({ form: agenda.form, agenda, duracaoTotalMin, procedimentosSelecionados });

  // ── Handlers de procedimentos ───────────────────────────────────────────────

  const handleToggleProc = useCallback(
    (proc) => {
      setProcedimentosSelecionados((current) => {
        const existe = current.find((p) => p.id === proc.id);
        const proximos = existe
          ? current.filter((p) => p.id !== proc.id)
          : [...current, { id: proc.id, nome: proc.nome, tipoCodigo: proc.tipoCodigo, duracaoMin: proc.duracaoMin, duracaoSelecionada: proc.duracaoMin }];
        // Sincroniza IDs com o hook
        agenda.updateForm('catalogoProcedimentoSaudeIds', proximos.map((p) => p.id));
        return proximos;
      });
    },
    [agenda]
  );

  const handleRemoverProc = useCallback(
    (id) => {
      setProcedimentosSelecionados((current) => {
        const proximos = current.filter((p) => p.id !== id);
        agenda.updateForm('catalogoProcedimentoSaudeIds', proximos.map((p) => p.id));
        return proximos;
      });
    },
    [agenda]
  );

  const handleMudarDuracao = useCallback((id, minutos) => {
    setProcedimentosSelecionados((current) =>
      current.map((p) => p.id === id ? { ...p, duracaoSelecionada: Number(minutos) } : p)
    );
    // duracaoSelecionada é estado local; não precisa sincronizar com o hook
  }, []);

  // ── Handlers de calendário/slots/profissional ───────────────────────────────

  const handleSelecionarDia = useCallback(
    (iso) => {
      agenda.selectDispCalendarioDia(iso);
      agenda.updateForm('data', iso);
      agenda.updateForm('horaInicio', '');
      setResultadosSalvar(null);
      setPainelAtivo(PAINEL.A);
    },
    [agenda]
  );

  const handleSelecionarSlotDireto = useCallback(
    ({ hora, profissional }) => {
      agenda.updateForm('horaInicio', hora);
      if (profissional?.roleUserId) {
        agenda.setRoleUserIdAgenda(profissional.roleUserId);
      }
      setResultadosSalvar(null);
      setPainelAtivo(PAINEL.A);
    },
    [agenda]
  );

  const handleAbrirPainelC = useCallback((hora) => {
    setHoraPendentePainelC(hora);
    setPainelAtivo(PAINEL.C);
  }, []);

  const handleSelecionarProfissional = useCallback(
    ({ hora, profissional }) => {
      if (hora) agenda.updateForm('horaInicio', hora);
      if (profissional?.roleUserId) {
        agenda.setRoleUserIdAgenda(profissional.roleUserId);
      }
      setHoraPendentePainelC('');
      setPainelAtivo(PAINEL.A);
    },
    [agenda]
  );

  // ── Foco inicial ao abrir ───────────────────────────────────────────────────
  const focoInicialRef = useRef(null);
  const modalMode = agenda.modalMode; // primitivo — estável por valor, evita dep instável no efeito abaixo
  useEffect(() => {
    if (!modalMode) return;
    const id = requestAnimationFrame(() => {
      if (!focoInicialRef.current) return;
      // Se travado (reagendar), foca o primeiro botão interativo dentro do ref
      // Se livre (criar), foca o input de busca do paciente
      const alvo = focoInicialRef.current.querySelector('input, button');
      alvo?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [modalMode]);

  // ── Handler de submit ───────────────────────────────────────────────────────

  const handleConfirmar = useCallback(async () => {
    setSubmitting(true);
    setResultadosSalvar(null);
    try {
      await agenda.saveAppointment({
        duracoesPorProc: procedimentosSelecionados.map((p) => ({
          id: p.id,
          duracaoSelecionada: p.duracaoSelecionada,
        })),
        onConflictResult: (resultados) => setResultadosSalvar(resultados),
      });
    } finally {
      setSubmitting(false);
    }
  }, [agenda, procedimentosSelecionados]);

  // Fechar com Escape
  useEffect(() => {
    if (!agenda.modalMode) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (painelAtivo !== PAINEL.A) {
          setPainelAtivo(PAINEL.A);
        } else {
          agenda.closeModal();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [agenda, painelAtivo]);

  if (!agenda.modalMode) return null;

  const isEdit = agenda.modalMode === 'edit';
  const nProcs = procedimentosSelecionados.length;
  const modalTitulo = isReagendar
    ? `Reagendar — ${nProcs} procedimento${nProcs !== 1 ? 's' : ''}`
    : isEdit ? 'Editar agendamento' : 'Novo agendamento';

  return (
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label={modalTitulo}
    >
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        onClick={agenda.closeModal}
        aria-label="Fechar modal"
        tabIndex={-1}
      />

      {/* Container do modal */}
      <div className="relative flex max-h-[95vh] w-full max-w-[1320px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-ink-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <h2 className="font-display text-lg font-black text-ink-900">{modalTitulo}</h2>
            {isReagendar && (
              <span className="rounded-full bg-amber-100 px-3 py-0.5 text-xs font-semibold text-amber-800">
                Reagendamento
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={agenda.closeModal}
            className="rounded-xl p-2 text-ink-500 hover:bg-ink-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vivid-teal-500"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ── Erro global ─────────────────────────────────────────────────── */}
        {agenda.formErrors?._global && (
          <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-6 py-2.5 text-sm font-semibold text-amber-900">
            {agenda.formErrors._global}
          </div>
        )}

        {/* ── Seletores do topo (linha de 3 colunas) ──────────────────────── */}
        <div className="shrink-0 border-b border-ink-100 px-6 py-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {/* Paciente */}
            <div ref={lockPatient ? null : focoInicialRef}>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                Paciente <span className="text-red-500">*</span>
              </p>
              <PacienteSearchInput
                value={agenda.form.pacienteId}
                onChange={agenda.selectPaciente}
                locked={lockPatient}
                displayNome={agenda.form.pacienteNome}
              />
              {agenda.formErrors?.pacienteId && (
                <p className="mt-1 text-[11px] font-bold text-red-600">
                  {agenda.formErrors.pacienteId}
                </p>
              )}
            </div>

            {/* Procedimentos */}
            <div ref={lockPatient ? focoInicialRef : null}>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                Procedimentos <span className="text-red-500">*</span>
              </p>
              <ProcedimentosMultiSeletor
                procedimentos={procedimentosSelecionados}
                onRemover={handleRemoverProc}
                onMudarDuracao={handleMudarDuracao}
                onAbrirPainelB={() => setPainelAtivo(PAINEL.B)}
                readOnly={isReagendar}
              />
              {agenda.formErrors?.catalogoProcedimentoSaudeIds && (
                <p className="mt-1 text-[11px] font-bold text-red-600">
                  {agenda.formErrors.catalogoProcedimentoSaudeIds}
                </p>
              )}
            </div>

            {/* Profissional */}
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                Profissional
              </p>
              <ProfissionalSeletor
                roleUserIdAgenda={agenda.roleUserIdAgenda}
                equipeList={agenda.equipeList}
                locked={isReagendar}
                onAbrirPainelC={() => {
                  setHoraPendentePainelC('');
                  setPainelAtivo(PAINEL.C);
                }}
              />
            </div>
          </div>
        </div>

        {/* ── Corpo: 2 colunas — calendário protagonista (7fr) + slots (5fr) ── */}
        <div className="min-h-0 flex-1 overflow-hidden">
          <div className="flex h-full flex-col lg:grid lg:grid-cols-[7fr_5fr]">

            {/* Coluna esquerda: calendário + observações */}
            <div className="overflow-y-auto border-b border-ink-100 px-6 py-6 lg:border-b-0 lg:border-r">
              <CalendarioMensal
                roleUserId={roleUserIdFiltro || undefined}
                diaSelecionado={agenda.form.data}
                onSelecionarDia={handleSelecionarDia}
              />

              {/* Observações colapsável */}
              <div className="mt-6">
                <button
                  type="button"
                  onClick={() => setObsAberta((v) => !v)}
                  className="flex w-full items-center justify-between py-1 text-[11px] font-semibold uppercase tracking-wide text-ink-500 hover:text-ink-700 focus-visible:outline-none"
                >
                  <span>Observações <span className="font-normal normal-case text-ink-400">(opcional)</span></span>
                  {obsAberta ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                </button>
                {obsAberta && (
                  <textarea
                    value={agenda.form.observacao || ''}
                    onChange={(e) => agenda.updateForm('observacao', e.target.value)}
                    maxLength={500}
                    rows={4}
                    placeholder="Informações adicionais sobre o atendimento..."
                    className="mt-2 w-full resize-none rounded-xl border border-ink-200 px-3 py-2.5 text-sm text-ink-800 outline-none placeholder:text-ink-300 focus:border-vivid-teal-400 focus:ring-2 focus:ring-vivid-teal-100"
                  />
                )}
              </div>
            </div>

            {/* Coluna direita: painéis A / B / C */}
            <div className="min-h-0 overflow-y-auto px-5 py-6">
              {/* Rótulo do painel */}
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                {painelAtivo === PAINEL.A && 'Horários disponíveis'}
                {painelAtivo === PAINEL.B && 'Selecionar procedimento'}
                {painelAtivo === PAINEL.C && 'Escolher profissional'}
              </p>

              {painelAtivo === PAINEL.A && (
                <PainelA_SlotsHorario
                  diaSelecionado={agenda.form.data}
                  roleUserIdFiltro={roleUserIdFiltro}
                  duracaoTotalMin={duracaoTotalMin}
                  horaSelecionada={agenda.form.horaInicio}
                  profissionalFixado={profissionalFixado}
                  onSelecionarSlot={handleSelecionarSlotDireto}
                  onAbrirPainelC={handleAbrirPainelC}
                />
              )}

              {painelAtivo === PAINEL.B && (
                <PainelB_SeletorProcedimento
                  procedimentoOptions={agenda.procedimentoOptions}
                  procedimentosSelecionados={procedimentosSelecionados}
                  onToggle={handleToggleProc}
                  onVoltar={() => setPainelAtivo(PAINEL.A)}
                />
              )}

              {painelAtivo === PAINEL.C && (
                <PainelC_SeletorProfissional
                  equipeList={agenda.equipeList}
                  equipeLoading={agenda.equipeLoading}
                  equipeError={agenda.equipeError}
                  horaSelecionandoPendente={horaPendentePainelC}
                  onSelecionarProfissional={handleSelecionarProfissional}
                  onVoltar={() => setPainelAtivo(PAINEL.A)}
                />
              )}
            </div>
          </div>
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div className="shrink-0 border-t border-ink-100 px-6 py-4">
          {/* Feedback de conflito parcial */}
          {resultadosSalvar?.some((r) => r.status !== 'ok') && (
            <div className="mb-3 space-y-1 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs">
              {resultadosSalvar.filter((r) => r.status !== 'ok').map((r) => {
                const proc = procedimentosSelecionados.find((p) => p.id === r.id);
                return (
                  <div key={r.id} className="flex items-center gap-1.5 text-red-700">
                    <X className="h-3 w-3 shrink-0" />
                    <span>
                      <strong>{proc?.nome ?? '—'}</strong>:{' '}
                      {r.status === 'conflito' ? 'horário ocupado — escolha outro slot' : 'cancelado'}
                    </span>
                  </div>
                );
              })}
              <p className="mt-1 text-red-500">Selecione outro horário e confirme novamente.</p>
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Resumo dinâmico */}
            <div className="min-w-0 flex-1">
              {resumoTexto ? (
                <p className="truncate text-sm text-ink-600">{resumoTexto}</p>
              ) : (
                <p className="text-sm text-ink-400">Preencha os campos para confirmar</p>
              )}
            </div>

            {/* Ações */}
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {isEdit && typeof onExcluirClick === 'function' && (
                <button
                  type="button"
                  onClick={onExcluirClick}
                  className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                >
                  Excluir
                </button>
              )}
              <button
                type="button"
                onClick={agenda.closeModal}
                className="rounded-xl border border-ink-200 px-4 py-2.5 text-sm font-bold text-ink-600 hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-400"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmar}
                disabled={confirmDisabled || submitting}
                className="rounded-xl bg-vivid-teal-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-vivid-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vivid-teal-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Salvando…
                  </span>
                ) : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Portal para o modal de bypass fora de disponibilidade */}
      {agenda.foraDispModal}
    </div>
  );
}
