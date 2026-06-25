import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, ChevronDown, Calendar, Lock } from 'lucide-react';
import { useUsuarioLogado } from '../../hooks/useUsuarioLogado.js';
import { useMediaQuery } from '../../hooks/useMediaQuery.js';
import { PacienteSearchInput } from './PacienteSearchInput.jsx';
import { CalendarioMensal } from './CalendarioMensal.jsx';
import { PainelA_SlotsHorario } from './PainelA_SlotsHorario.jsx';
import { ProcedimentoSearchInput } from './ProcedimentoSearchInput.jsx';
import { RetornoOrigemSelect } from './RetornoOrigemSelect.jsx';
import { ProfissionalSearchInput } from './ProfissionalSearchInput.jsx';
import { AgendaFormDataHoraSheet } from './AgendaFormDataHoraSheet.jsx';
import { formatAgendaDateTimeCta } from './agendaFormModalUtils.js';
import {
  deriveDuracaoFromRange,
  deriveHoraFimReal,
  deriveRangePhase,
} from '../../utils/agendaRangeSelection.js';
import { formatDataPt } from '../../utils/planejamentoDraftUtils.js';

function resolveProfissionalNome(agenda) {
  const id = String(agenda.roleUserIdAgenda || '').trim();
  if (!id) return '';
  const fromEquipe = (agenda.equipeList || []).find((p) => String(p.roleUserId) === id);
  if (fromEquipe?.nome) return fromEquipe.nome;
  return agenda.editingAppointment?.profissionalNome || '';
}

function buildResumo({ form, agenda, rangePhase, duracaoTotalMin, horaFimReal, procedimentosSelecionados }) {
  const partes = [];
  if (form.pacienteNome) partes.push(form.pacienteNome);
  if (form.agendamentoTipoRetorno) {
    if (form.retornoOrigemNome) {
      partes.push(`Retorno: ${form.retornoOrigemNome}`);
    } else {
      const pai = (form.procedimentosFeitosRaiz || []).find(
        (r) => String(r.id) === String(form.procedimentoFeitoOrigemId),
      );
      partes.push(pai ? `Retorno: ${pai.catalogoProcedimentoNome || pai.nome}` : 'Retorno');
    }
  } else if (procedimentosSelecionados.length > 0) {
    const nomes = procedimentosSelecionados.map((p) => p.nome).join(', ');
    partes.push(nomes);
  }
  if (form.data) {
    const [y, m, d] = form.data.split('-');
    partes.push(`${d}/${m}/${y}`);
  }
  if (rangePhase === 'complete') {
    partes.push(`${form.horaInicio}–${horaFimReal} (${duracaoTotalMin} min)`);
  } else if (form.horaInicio) {
    partes.push(`${form.horaInicio} (selecione o término)`);
  }
  const profNome = resolveProfissionalNome(agenda);
  if (profNome) partes.push(profNome);
  return partes.join(' · ');
}

const OBS_TEXTAREA_CLASS =
  'mt-2 w-full resize-none rounded-xl border border-ink-200 px-3 py-2.5 text-sm text-ink-800 outline-none transition-[height] placeholder:text-ink-300 focus:border-vivid-teal-400 focus:ring-2 focus:ring-vivid-teal-100';

function ObservacoesField({ value, onChange, className = 'mt-4 shrink-0' }) {
  const [focused, setFocused] = useState(false);
  const hasText = Boolean(String(value || '').trim());

  return (
    <div className={className}>
      <p className="py-1 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
        Observações <span className="font-normal normal-case text-ink-400">(opcional)</span>
      </p>
      <textarea
        value={value || ''}
        onChange={onChange}
        maxLength={500}
        rows={focused || hasText ? 3 : 1}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="Informações adicionais sobre o atendimento..."
        className={OBS_TEXTAREA_CLASS}
      />
    </div>
  );
}

export function AgendaFormModal({ agenda }) {
  const { ehProfissionalClinico, roleUserId: roleLogadoId } = useUsuarioLogado();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [dispSheetOpen, setDispSheetOpen] = useState(false);
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
            duracaoSelecionada: existente?.duracaoSelecionada ?? (agenda.grupoReagendarDuracoes?.[id] ?? opt.duracaoMin),
          };
        }
        // Catálogo ainda não chegou — fallback temporário
        return existente ?? { id, nome: '(Procedimento)', tipoCodigo: '', duracaoMin: 45, duracaoSelecionada: 45 };
      })
    );
  }, [agenda.form.catalogoProcedimentoSaudeIds, agenda.procedimentoOptions]); // procedimentosSelecionados fora das deps — lido via setter funcional

  // ── Derivados ───────────────────────────────────────────────────────────────
  const isReagendar = agenda.modalMode === 'reagendar';
  const lockPlanejamento = Boolean(agenda.isModoPlanejamento);
  const lockPatient = Boolean(agenda.patientSelectLocked);
  const profissionalFixado = ehProfissionalClinico || Boolean(agenda.roleUserIdAgenda);
  const roleUserIdFiltro = ehProfissionalClinico ? roleLogadoId : (agenda.roleUserIdAgenda || '');
  const rangePhase = deriveRangePhase(agenda.form.horaInicio, agenda.form.horaFimSlot);
  const duracaoTotalMin =
    rangePhase === 'complete'
      ? deriveDuracaoFromRange(agenda.form.horaInicio, agenda.form.horaFimSlot)
      : 0;
  const horaFimReal =
    rangePhase === 'complete' ? deriveHoraFimReal(agenda.form.horaFimSlot) : '';

  const dayModelForSlots = agenda.form.data && agenda.dispDaySlots ? agenda.dispDaySlots : null;

  const isModoRetorno = Boolean(agenda.form.agendamentoTipoRetorno);
  const isRetornoSemSeletorPai =
    isModoRetorno && (agenda.retornoTemVinculoPlano || agenda.retornoPaiPreselecionado);
  const confirmDisabled =
    !agenda.form.pacienteId ||
    (!isModoRetorno && !(agenda.form.catalogoProcedimentoSaudeIds?.length > 0)) ||
    (isModoRetorno &&
      !isRetornoSemSeletorPai &&
      !String(agenda.form.procedimentoFeitoOrigemId || '').trim()) ||
    !agenda.form.data ||
    !agenda.form.horaInicio ||
    !agenda.form.horaFimSlot ||
    !agenda.roleUserIdAgenda;

  const resumoTexto = buildResumo({
    form: agenda.form,
    agenda,
    rangePhase,
    duracaoTotalMin,
    horaFimReal,
    procedimentosSelecionados,
  });

  // CTA mobile (botão que abre o sheet de data/horário)
  const ctaLabelRaw = formatAgendaDateTimeCta(
    agenda.form.data,
    agenda.form.horaInicio,
    horaFimReal || undefined
  );
  const ctaPreenchido = Boolean(ctaLabelRaw);
  const ctaLabel = ctaLabelRaw || 'Escolher data e horário';

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

  // ── Handlers de calendário/slots/profissional ───────────────────────────────

  const handleSelecionarDia = useCallback(
    (iso) => {
      agenda.selectDispCalendarioDia(iso);
      agenda.updateForm('data', iso);
      agenda.clearRangeSelection();
      setResultadosSalvar(null);
    },
    [agenda]
  );

  const handleSelecionarSlotDireto = useCallback(
    (payload) => {
      const result = agenda.handleRangeSlotClick(payload);
      setResultadosSalvar(null);
      return result;
    },
    [agenda]
  );

  // Fecha o sheet mobile somente quando o range fica completo (2º clique válido).
  const handleSheetSelectSlot = useCallback(
    (payload) => {
      const result = handleSelecionarSlotDireto(payload);
      if (result?.rangeComplete) {
        setDispSheetOpen(false);
      }
    },
    [handleSelecionarSlotDireto]
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
        agenda.closeModal();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [agenda]);

  if (!agenda.modalMode) return null;

  const nProcs = procedimentosSelecionados.length;
  const modalTitulo = isReagendar
    ? `Reagendar — ${nProcs} procedimento${nProcs !== 1 ? 's' : ''}`
    : 'Novo agendamento';

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

      {/* Container do modal — altura fixa no desktop para orçamento vertical estável do calendário */}
      <div className="relative flex max-h-[95vh] w-full max-w-[1320px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl lg:h-[95vh]">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-ink-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <h2 className="font-display text-lg font-black text-ink-900">{modalTitulo}</h2>
            {isReagendar ? (
              <span className="rounded-full bg-amber-100 px-3 py-0.5 text-xs font-semibold text-amber-800">
                Reagendamento
              </span>
            ) : null}
            {lockPlanejamento && !isReagendar ? (
              <span className="rounded-full bg-amber-100 px-3 py-0.5 text-xs font-semibold text-amber-800">
                Do plano
              </span>
            ) : null}
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
                onClear={lockPatient ? undefined : agenda.clearPacienteSelection}
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
                Procedimentos {!isModoRetorno ? <span className="text-red-500">*</span> : null}
              </p>
              {isModoRetorno && !isRetornoSemSeletorPai ? (
                <RetornoOrigemSelect
                  value={agenda.form.procedimentoFeitoOrigemId || ''}
                  onChange={(val) => agenda.updateForm('procedimentoFeitoOrigemId', val)}
                  options={agenda.form.procedimentosFeitosRaiz || []}
                  loading={agenda.form.procedimentosRaizLoading}
                  error={agenda.form.procedimentosRaizError}
                  fieldError={agenda.formErrors?.procedimentoFeitoOrigemId}
                />
              ) : isModoRetorno ? (
                agenda.form.retornoOrigemNome ? (
                  <div
                    role="status"
                    aria-label="Procedimento de origem do retorno"
                    className="flex items-start gap-3 rounded-xl border-2 border-[#00a88e] bg-[#e6f7f5] px-3 py-2.5"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#0f766e]">
                      <Lock className="h-4 w-4" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-[#0f766e]">
                        {agenda.form.retornoOrigemNome}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1 text-[12px] text-ink-500">
                        <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        <span>
                          {agenda.form.retornoDataPlanejada
                            ? `Agendado para ${formatDataPt(agenda.form.retornoDataPlanejada)}`
                            : 'Data planejada não definida'}
                        </span>
                      </p>
                      <p className="mt-1 text-[10px] font-medium text-[#0f766e]/70">
                        Vínculo automático ao item do plano
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="rounded-xl border border-[#e6f7f5] bg-[#f8fbfb] px-3 py-2.5 text-[12px] font-medium text-[#0f766e]">
                    Retorno vinculado ao item do plano — o sistema identifica o procedimento de origem
                    automaticamente.
                  </p>
                )
              ) : (
                <ProcedimentoSearchInput
                  procedimentoOptions={agenda.procedimentoOptions}
                  procedimentosSelecionados={procedimentosSelecionados}
                  onToggle={handleToggleProc}
                  onRemover={handleRemoverProc}
                  readOnly={isReagendar || lockPlanejamento}
                />
              )}
              {agenda.formErrors?.catalogoProcedimentoSaudeIds && !isModoRetorno ? (
                <p className="mt-1 text-[11px] font-bold text-red-600">
                  {agenda.formErrors.catalogoProcedimentoSaudeIds}
                </p>
              ) : null}
            </div>

            {/* Profissional */}
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                Profissional <span className="text-red-500">*</span>
              </p>
              <ProfissionalSearchInput
                roleUserIdAgenda={agenda.roleUserIdAgenda}
                equipeList={agenda.equipeList}
                equipeLoading={agenda.equipeLoading}
                equipeError={agenda.equipeError}
                onSelecionar={(id) => agenda.setRoleUserIdAgenda(id)}
                onClear={() => agenda.setRoleUserIdAgenda('')}
                locked={isReagendar || lockPlanejamento}
              />
            </div>
          </div>
        </div>

        {/* ── Corpo desktop (lg+): 2 colunas. Render condicional que DESMONTA no
            mobile — nunca ter CalendarioMensal/PainelA montados em 2 lugares (anti-loop). ── */}
        {isDesktop && (
        <div className="min-h-0 flex-1 overflow-hidden">
          <div className="grid h-full min-h-0 grid-cols-[7fr_5fr] grid-rows-1">

            {/* Coluna esquerda: calendário + observações */}
            <div className="flex h-full min-h-0 flex-col overflow-hidden border-b border-ink-100 px-6 py-4 lg:border-b-0 lg:border-r lg:py-5">
              <div className="mx-auto flex min-h-0 w-full max-w-[min(100%,560px)] flex-1 flex-col">
                <CalendarioMensal
                  heatmap={agenda.dispCalendarioHeatmap}
                  loading={Boolean(roleUserIdFiltro) && agenda.dispMonthLoading}
                  error={roleUserIdFiltro ? agenda.dispMonthError : ''}
                  onPrevMonth={agenda.goDispPrevMonth}
                  onNextMonth={agenda.goDispNextMonth}
                  onRetry={agenda.retryDispMonth}
                  diaSelecionado={isReagendar ? undefined : agenda.form.data}
                  onSelecionarDia={handleSelecionarDia}
                  showDensityLegend={Boolean(roleUserIdFiltro)}
                />
              </div>

              <ObservacoesField
                value={agenda.form.observacao}
                onChange={(e) => agenda.updateForm('observacao', e.target.value)}
              />
            </div>

            {/* Coluna direita: exclusivamente horários disponíveis — scroll isolado, não afeta altura do calendário */}
            <div className="mx-auto flex h-full min-h-0 w-full max-w-[560px] flex-col overflow-hidden px-5 py-5 lg:py-6">
              <p className="mb-3 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                Horários disponíveis
              </p>

              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
                <PainelA_SlotsHorario
                  diaSelecionado={agenda.form.data}
                  dayModel={dayModelForSlots}
                  roleUserIdFiltro={roleUserIdFiltro}
                  horaInicio={agenda.form.horaInicio}
                  horaFimSlot={agenda.form.horaFimSlot}
                  rangePhase={rangePhase}
                  profissionalFixado={profissionalFixado}
                  onRangeSlotClick={handleSelecionarSlotDireto}
                  onClearRange={agenda.clearRangeSelection}
                />
                {agenda.formErrors?.horaInicio ? (
                  <p className="mt-2 text-xs font-medium text-red-600" role="alert">
                    {agenda.formErrors.horaInicio}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
        )}

        {/* ── Corpo mobile (<lg): seletores já ficam acima; aqui vai o botão que abre
            o sheet de data/horário. CalendarioMensal/PainelA NÃO montam aqui — só no sheet. ── */}
        {!isDesktop && (
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 space-y-4 custom-scrollbar">
            <button
              type="button"
              onClick={() => setDispSheetOpen(true)}
              className={`flex w-full items-center justify-between gap-2 rounded-xl border px-4 py-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vivid-teal-500 ${
                ctaPreenchido
                  ? 'border-vivid-teal-300 bg-vivid-teal-50'
                  : 'border-ink-200 bg-white hover:border-vivid-teal-200 hover:bg-vivid-teal-50'
              }`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <Calendar className={`h-4 w-4 shrink-0 ${ctaPreenchido ? 'text-vivid-teal-600' : 'text-ink-400'}`} />
                <span className={`truncate text-sm font-semibold ${ctaPreenchido ? 'text-vivid-teal-700' : 'text-ink-600'}`}>
                  {ctaLabel}
                </span>
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 -rotate-90 text-ink-400" />
            </button>

            <ObservacoesField
              value={agenda.form.observacao}
              onChange={(e) => agenda.updateForm('observacao', e.target.value)}
              className="shrink-0"
            />
          </div>
        )}

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

      {/* Sheet mobile de data/horário — CalendarioMensal + PainelA montados SÓ aqui
          (e só quando <lg e aberto), nunca junto com o corpo desktop. */}
      {!isDesktop && dispSheetOpen && (
        <AgendaFormDataHoraSheet
          open
          diaSelecionado={isReagendar ? undefined : agenda.form.data}
          dayModel={dayModelForSlots}
          roleUserIdFiltro={roleUserIdFiltro}
          horaInicio={agenda.form.horaInicio}
          horaFimSlot={agenda.form.horaFimSlot}
          rangePhase={rangePhase}
          profissionalFixado={profissionalFixado}
          heatmap={agenda.dispCalendarioHeatmap}
          loading={Boolean(roleUserIdFiltro) && agenda.dispMonthLoading}
          error={roleUserIdFiltro ? agenda.dispMonthError : ''}
          onPrevMonth={agenda.goDispPrevMonth}
          onNextMonth={agenda.goDispNextMonth}
          onRetry={agenda.retryDispMonth}
          showDensityLegend={Boolean(roleUserIdFiltro)}
          onSelecionarDia={handleSelecionarDia}
          onRangeSlotClick={handleSheetSelectSlot}
          onClearRange={agenda.clearRangeSelection}
          onCancel={() => setDispSheetOpen(false)}
          horaInicioError={agenda.formErrors?.horaInicio}
        />
      )}

      {/* Portal para o modal de bypass fora de disponibilidade */}
      {agenda.foraDispModal}
    </div>
  );
}
