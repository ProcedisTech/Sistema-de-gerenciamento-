import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, ChevronDown, Calendar, Lock, Plus } from 'lucide-react';
import { useUsuarioLogado } from '../../hooks/useUsuarioLogado.js';
import { useMediaQuery } from '../../hooks/useMediaQuery.js';
import { PacienteSearchInput } from './PacienteSearchInput.jsx';
import { CalendarioMensal } from './CalendarioMensal.jsx';
import { PainelA_SlotsHorario } from './PainelA_SlotsHorario.jsx';
import { ProcedimentoSearchInput } from './ProcedimentoSearchInput.jsx';
import { ProcedimentosMultiSeletor } from './ProcedimentosMultiSeletor.jsx';
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
import {
  formatProcedimentoRaizData,
  nomeProcedimentoRaiz,
} from './retornoOrigemUtils.js';
import {
  TIPO_ATENDIMENTO_AVALIACAO,
  TIPO_ATENDIMENTO_CONSULTA,
  TIPO_ATENDIMENTO_PROCEDIMENTO,
  TIPO_ATENDIMENTO_RETORNO,
} from '../../utils/agendaTipoProcedimento.js';

const TIPO_ATENDIMENTO_OPTIONS = [
  { value: TIPO_ATENDIMENTO_PROCEDIMENTO, label: 'Procedimento' },
  { value: TIPO_ATENDIMENTO_RETORNO, label: 'Retorno' },
  { value: TIPO_ATENDIMENTO_AVALIACAO, label: 'Avaliação' },
  { value: TIPO_ATENDIMENTO_CONSULTA, label: 'Consulta Inicial' },
];

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#14B8A6] focus-visible:ring-offset-1';

const SELECT_TIPO_CLASS =
  `h-[38px] w-full rounded-xl border border-ink-200 bg-white py-2 pl-16 pr-3 text-sm text-ink-800 outline-none focus:border-[#14B8A6] focus:ring-2 focus:ring-[#e6f7f5] disabled:cursor-not-allowed disabled:bg-ink-50 disabled:text-ink-500 ${FOCUS_RING}`;

const FIELD_TAG =
  'pointer-events-none absolute left-2.5 top-1/2 z-[1] -translate-y-1/2 text-[10px] font-bold uppercase tracking-wide text-ink-400';

function formatDataResumida(iso) {
  if (!iso) return '';
  const [y, m, d] = String(iso).split('-');
  if (!y || !m || !d) return '';
  return `${d}/${m}`;
}

function phaseSubtitle(rangePhase, horaInicio) {
  if (rangePhase === 'awaitingEnd' && horaInicio) {
    return `Horários · término após ${String(horaInicio).slice(0, 5)}`;
  }
  if (rangePhase === 'complete') {
    return 'Horários · intervalo definido';
  }
  return 'Horários · selecione o início';
}

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
  const tipo = form.tipoAtendimento || TIPO_ATENDIMENTO_PROCEDIMENTO;
  if (tipo === TIPO_ATENDIMENTO_RETORNO || form.agendamentoTipoRetorno) {
    if (form.retornoOrigemNome) {
      partes.push(`Retorno: ${form.retornoOrigemNome}`);
    } else {
      const pai = (form.procedimentosFeitosRaiz || []).find(
        (r) => String(r.id) === String(form.procedimentoFeitoOrigemId),
      );
      partes.push(pai ? `Retorno: ${pai.catalogoProcedimentoNome || pai.nome}` : 'Retorno');
    }
  } else if (tipo === TIPO_ATENDIMENTO_AVALIACAO) {
    partes.push('Avaliação');
  } else if (tipo === TIPO_ATENDIMENTO_CONSULTA) {
    partes.push('Consulta Inicial');
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
  'mt-2 w-full resize-none rounded-xl border border-ink-200 px-3 py-2 text-sm text-ink-800 outline-none transition-[height] placeholder:text-ink-300 focus:border-vivid-teal-400 focus:ring-2 focus:ring-vivid-teal-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#14B8A6] focus-visible:ring-offset-1';

function ObservacoesField({ value, onChange, className = 'shrink-0', compact = false }) {
  const [expanded, setExpanded] = useState(false);
  const textareaRef = useRef(null);
  const hasText = Boolean(String(value || '').trim());
  const showTextarea = expanded || hasText;

  useEffect(() => {
    if (!expanded || hasText) return undefined;
    const id = requestAnimationFrame(() => textareaRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [expanded, hasText]);

  if (!showTextarea) {
    return (
      <div className={className}>
        <button
          type="button"
          aria-expanded={false}
          onClick={() => setExpanded(true)}
          className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-2 py-2 text-sm font-medium text-[#0f766e] hover:bg-vivid-teal-50 ${FOCUS_RING}`}
        >
          <Plus className="h-4 w-4" aria-hidden />
          {compact ? '+ observação' : 'Adicionar observação'}
        </button>
      </div>
    );
  }

  return (
    <div className={className}>
      {!compact ? (
        <p className="py-1 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
          Observações <span className="font-normal normal-case text-[#6b7280]">(opcional)</span>
        </p>
      ) : null}
      <textarea
        ref={textareaRef}
        value={value || ''}
        onChange={onChange}
        maxLength={500}
        rows={compact ? 2 : 3}
        aria-label="Observações"
        aria-expanded={true}
        placeholder="Observação (opcional)…"
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
  const [procSearchExpanded, setProcSearchExpanded] = useState(false);
  const [retornoOrigemExpanded, setRetornoOrigemExpanded] = useState(false);
  const procSearchWrapRef = useRef(null);
  const modalPanelRef = useRef(null);

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

  const tipoAtendimento = agenda.form.tipoAtendimento || TIPO_ATENDIMENTO_PROCEDIMENTO;
  const tipoAtendimentoLocked = Boolean(agenda.form.tipoAtendimentoLocked);
  const isModoRetorno = tipoAtendimento === TIPO_ATENDIMENTO_RETORNO;
  const isModoProcedimento = tipoAtendimento === TIPO_ATENDIMENTO_PROCEDIMENTO;
  const isRetornoSemSeletorPai =
    isModoRetorno && (agenda.retornoTemVinculoPlano || agenda.retornoPaiPreselecionado);

  const temPaciente = Boolean(String(agenda.form.pacienteId || '').trim());
  const origemId = String(agenda.form.procedimentoFeitoOrigemId || '').trim();
  const raizes = agenda.form.procedimentosFeitosRaiz || [];
  const raizesLoading = Boolean(agenda.form.procedimentosRaizLoading);
  const raizesVazias =
    isModoRetorno &&
    temPaciente &&
    !isRetornoSemSeletorPai &&
    !raizesLoading &&
    !agenda.form.procedimentosRaizError &&
    raizes.length === 0;
  const retornoSemPaciente = isModoRetorno && !temPaciente && !isRetornoSemSeletorPai;

  const confirmDisabled =
    !temPaciente ||
    (isModoProcedimento && !(agenda.form.catalogoProcedimentoSaudeIds?.length > 0)) ||
    (isModoRetorno &&
      !isRetornoSemSeletorPai &&
      (!origemId || retornoSemPaciente || raizesVazias || raizesLoading)) ||
    !agenda.form.data ||
    !agenda.form.horaInicio ||
    !agenda.form.horaFimSlot ||
    !agenda.roleUserIdAgenda;

  // Reset expanders when tipo changes
  useEffect(() => {
    setProcSearchExpanded(false);
    setRetornoOrigemExpanded(false);
  }, [tipoAtendimento]);

  // Auto-collapse procedimento search after selection
  useEffect(() => {
    if (procedimentosSelecionados.length > 0) {
      setProcSearchExpanded(false);
    }
  }, [procedimentosSelecionados.length]);

  // Auto-collapse retorno origem after selection
  useEffect(() => {
    if (origemId) {
      setRetornoOrigemExpanded(false);
    }
  }, [origemId]);

  // Se a duração muda e o dia selecionado deixa de comportar, limpa data + range.
  useEffect(() => {
    const iso = agenda.form.data;
    if (!iso) return;
    const cells = agenda.dispCalendarioHeatmap?.cells;
    if (!Array.isArray(cells) || cells.length === 0) return;
    const cell = cells.find((c) => c?.iso === iso);
    if (!cell || !cell.inCurrentMonth) return;
    if (cell.clickable) return;
    agenda.updateForm('data', '');
    agenda.clearRangeSelection?.();
  }, [agenda.form.data, agenda.dispCalendarioHeatmap, agenda]);

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

  // Foco no input de busca ao expandir procedimentos
  useEffect(() => {
    if (!procSearchExpanded) return undefined;
    const id = requestAnimationFrame(() => {
      procSearchWrapRef.current?.querySelector('input')?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [procSearchExpanded]);

  // Focus trap enquanto o modal está aberto (desktop/mobile shell; sheet é portal filho)
  useEffect(() => {
    if (!modalMode) return undefined;
    const root = modalPanelRef.current;
    if (!root) return undefined;

    const getFocusable = () =>
      [...root.querySelectorAll(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )].filter((el) => el.offsetParent !== null || el === document.activeElement);

    const onKeyDown = (e) => {
      if (e.key !== 'Tab') return;
      const list = getFocusable();
      if (list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first || !root.contains(document.activeElement)) {
          e.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last || !root.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      }
    };

    root.addEventListener('keydown', onKeyDown);
    return () => root.removeEventListener('keydown', onKeyDown);
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

  const dataResumida = formatDataResumida(agenda.form.data);
  const rangeCompleteDesktop = isDesktop && rangePhase === 'complete';
  const selectedTimeLabel =
    rangePhase === 'complete' && agenda.form.horaInicio
      ? `${String(agenda.form.horaInicio).slice(0, 5)}–${String(horaFimReal || agenda.form.horaFimSlot).slice(0, 5)}`
      : rangePhase !== 'idle' && agenda.form.horaInicio
        ? String(agenda.form.horaInicio).slice(0, 5)
        : null;

  const faixaIntervaloLabel =
    rangePhase === 'complete'
      ? [
          `${String(agenda.form.horaInicio).slice(0, 5)}–${String(horaFimReal || agenda.form.horaFimSlot).slice(0, 5)}`,
          `${duracaoTotalMin} min`,
          procedimentosSelecionados.length > 0
            ? procedimentosSelecionados.map((p) => p.nome).join(', ')
            : isModoRetorno
              ? 'Retorno'
              : null,
        ]
          .filter(Boolean)
          .join(' · ')
      : '';

  const confirmLabel =
    rangePhase === 'complete' && agenda.form.horaInicio
      ? `Confirmar ${String(agenda.form.horaInicio).slice(0, 5)}`
      : 'Confirmar';

  function renderProcOuRetornoCard({ compact = false } = {}) {
    if (isModoProcedimento) {
      const chipsOnly =
        procedimentosSelecionados.length > 0 && !procSearchExpanded && !isReagendar && !lockPlanejamento;
      const searching = !isReagendar && !lockPlanejamento && (procSearchExpanded || procedimentosSelecionados.length === 0);

      return (
        <div className={`rounded-xl border border-ink-200 bg-white ${compact ? 'p-2.5' : 'p-3'}`}>
          {!compact ? (
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-500">
              Procedimentos <span className="text-red-500">*</span>
            </p>
          ) : null}
          {isReagendar || lockPlanejamento ? (
            <ProcedimentoSearchInput
              procedimentoOptions={agenda.procedimentoOptions}
              procedimentosSelecionados={procedimentosSelecionados}
              onToggle={handleToggleProc}
              onRemover={handleRemoverProc}
              readOnly
            />
          ) : chipsOnly ? (
            <div className={compact ? 'max-h-[82px] overflow-y-auto' : undefined}>
              <ProcedimentosMultiSeletor
                procedimentos={procedimentosSelecionados}
                onRemover={handleRemoverProc}
                showAdicionar
                onAbrirPainelB={() => setProcSearchExpanded(true)}
              />
            </div>
          ) : searching ? (
            <div ref={procSearchWrapRef} className="space-y-2">
              {procedimentosSelecionados.length > 0 ? (
                <div className={compact ? 'max-h-[82px] overflow-y-auto' : undefined}>
                  <ProcedimentosMultiSeletor
                    procedimentos={procedimentosSelecionados}
                    onRemover={handleRemoverProc}
                    showAdicionar={false}
                  />
                </div>
              ) : null}
              <ProcedimentoSearchInput
                procedimentoOptions={agenda.procedimentoOptions}
                procedimentosSelecionados={procedimentosSelecionados}
                onToggle={handleToggleProc}
                onRemover={handleRemoverProc}
              />
              {procedimentosSelecionados.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setProcSearchExpanded(false)}
                  className={`text-[12px] font-medium text-[#0f766e] hover:underline ${FOCUS_RING}`}
                >
                  Recolher busca
                </button>
              ) : null}
            </div>
          ) : null}
          {agenda.formErrors?.catalogoProcedimentoSaudeIds ? (
            <p className="mt-1 text-[11px] font-bold text-red-600">
              {agenda.formErrors.catalogoProcedimentoSaudeIds}
            </p>
          ) : null}
        </div>
      );
    }

    if (!isModoRetorno) return null;

    const retornoSelectExpanded =
      !retornoSemPaciente &&
      !isRetornoSemSeletorPai &&
      !raizesVazias &&
      (!origemId || retornoOrigemExpanded);

    return (
      <div className={`rounded-xl border border-ink-200 bg-white ${compact ? 'p-2.5' : 'p-3'}`}>
        {!compact ? (
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-500">
            Procedimento de origem <span className="text-red-500">*</span>
          </p>
        ) : null}

        {retornoSemPaciente ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] font-medium text-amber-900">
            Escolha o paciente primeiro. A origem do retorno vem do histórico dele.
          </div>
        ) : isRetornoSemSeletorPai ? (
          agenda.form.retornoOrigemNome ? (
            <div
              role="status"
              aria-label="Procedimento de origem do retorno"
              className="flex items-start gap-2 rounded-xl border-2 border-[#14B8A6] bg-[#e6f7f5] px-2.5 py-2"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[#0f766e]">
                <Lock className="h-3.5 w-3.5" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-semibold text-[#0f766e]">
                  {agenda.form.retornoOrigemNome}
                </p>
                <p className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-500">
                  <Calendar className="h-3 w-3 shrink-0" aria-hidden />
                  <span>
                    {agenda.form.retornoDataPlanejada
                      ? `Agendado para ${formatDataPt(agenda.form.retornoDataPlanejada)}`
                      : 'Data planejada não definida'}
                  </span>
                </p>
              </div>
            </div>
          ) : origemId ? (
            (() => {
              const pai = raizes.find((r) => String(r.id) === origemId);
              const nome = pai ? nomeProcedimentoRaiz(pai) : 'Procedimento de origem';
              return (
                <div
                  role="status"
                  className="flex items-start gap-2 rounded-xl border-2 border-[#14B8A6] bg-[#e6f7f5] px-2.5 py-2"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[#0f766e]">
                    <Lock className="h-3.5 w-3.5" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-semibold text-[#0f766e]">{nome}</p>
                  </div>
                </div>
              );
            })()
          ) : (
            <p className="rounded-xl border border-[#e6f7f5] bg-[#f8fbfb] px-2.5 py-2 text-[12px] font-medium text-[#0f766e]">
              Retorno vinculado ao item do plano — origem automática.
            </p>
          )
        ) : raizesVazias ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] font-medium text-amber-900">
            Sem procedimento realizado. Este paciente ainda não tem histórico para vincular o
            retorno.
          </div>
        ) : origemId && !retornoOrigemExpanded ? (
          (() => {
            const pai = raizes.find((r) => String(r.id) === origemId);
            const nome = pai ? nomeProcedimentoRaiz(pai) : 'Procedimento de origem';
            const dataFmt = pai ? formatProcedimentoRaizData(pai.data) : '';
            return (
              <div className={compact ? 'max-h-[82px] overflow-y-auto' : undefined}>
                <div className="flex items-center gap-2 rounded-xl border-2 border-[#14B8A6] bg-[#e6f7f5] px-2.5 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-semibold text-[#0f766e]">{nome}</p>
                    {dataFmt ? (
                      <p className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-500">
                        <Calendar className="h-3 w-3 shrink-0" aria-hidden />
                        <span>{dataFmt}</span>
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      agenda.updateForm('procedimentoFeitoOrigemId', '');
                      setRetornoOrigemExpanded(true);
                    }}
                    className={`inline-flex min-h-[44px] shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-[#0f766e] hover:bg-white/60 ${FOCUS_RING}`}
                    aria-label="Trocar procedimento de origem"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Trocar
                  </button>
                </div>
              </div>
            );
          })()
        ) : retornoSelectExpanded ? (
          <RetornoOrigemSelect
            value={origemId}
            onChange={(val) => agenda.updateForm('procedimentoFeitoOrigemId', val)}
            options={raizes}
            loading={raizesLoading}
            error={agenda.form.procedimentosRaizError}
            fieldError={agenda.formErrors?.procedimentoFeitoOrigemId}
            flutuante
          />
        ) : null}
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label={modalTitulo}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        onClick={agenda.closeModal}
        aria-label="Fechar modal"
        tabIndex={-1}
      />

      <div
        ref={modalPanelRef}
        className="relative flex max-h-[95vh] w-full max-w-[1320px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl lg:h-[95vh]"
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-ink-100 px-6 py-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h2 className="font-display text-[15.5px] font-black text-ink-900">{modalTitulo}</h2>
            {isReagendar ? (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-semibold text-amber-800">
                Reagendamento
              </span>
            ) : null}
            {lockPlanejamento && !isReagendar ? (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-semibold text-amber-800">
                Do plano
              </span>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {dataResumida ? (
              <span className="px-1 text-[12px] font-semibold tabular-nums text-ink-500">
                {dataResumida}
              </span>
            ) : null}
            <button
              type="button"
              onClick={agenda.closeModal}
              className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl p-2 text-ink-500 hover:bg-ink-100 ${FOCUS_RING}`}
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {agenda.formErrors?._global && (
          <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-6 py-2.5 text-sm font-semibold text-amber-900">
            {agenda.formErrors._global}
          </div>
        )}

        {/* ── Seletores do topo ───────────────────────────────────────────── */}
        <div className="shrink-0 border-b border-ink-100 px-6 py-3">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <div ref={lockPatient ? null : focoInicialRef}>
              <div className="[&_input]:!h-[38px] [&_input]:!py-2 [&_>div]:min-h-[38px]">
                <PacienteSearchInput
                  value={agenda.form.pacienteId}
                  onChange={agenda.selectPaciente}
                  onClear={lockPatient ? undefined : agenda.clearPacienteSelection}
                  locked={lockPatient}
                  displayNome={agenda.form.pacienteNome}
                />
              </div>
              {agenda.formErrors?.pacienteId && (
                <p className="mt-1 text-[11px] font-bold text-red-600">
                  {agenda.formErrors.pacienteId}
                </p>
              )}
            </div>

            <div ref={lockPatient ? focoInicialRef : null} className="relative">
              <span className={FIELD_TAG} aria-hidden>
                Tipo
              </span>
              <select
                value={tipoAtendimento}
                disabled={tipoAtendimentoLocked || isReagendar}
                onChange={(e) => agenda.setTipoAtendimento?.(e.target.value)}
                className={SELECT_TIPO_CLASS}
                aria-label="Tipo de atendimento"
              >
                {TIPO_ATENDIMENTO_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="[&_input]:!h-[38px] [&_input]:!py-2 [&_>div]:min-h-[38px]">
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

          <div className="sr-only" aria-live="polite" aria-atomic="true">
            {TIPO_ATENDIMENTO_OPTIONS.find((o) => o.value === tipoAtendimento)?.label || ''}
          </div>

          {/* Mobile: proc/retorno permanece abaixo dos seletores */}
          {!isDesktop && (isModoProcedimento || isModoRetorno) ? (
            <div className="mt-2.5">{renderProcOuRetornoCard({ compact: false })}</div>
          ) : null}
        </div>

        {/* ── Corpo desktop ───────────────────────────────────────────────── */}
        {isDesktop && (
          <div className="min-h-0 flex-1 overflow-hidden">
            <div
              className={`grid h-full min-h-0 grid-rows-1 ${
                rangeCompleteDesktop ? 'grid-cols-1' : 'grid-cols-[1.9fr_1fr]'
              }`}
            >
              <div
                className={`flex h-full min-h-0 flex-col overflow-hidden px-6 py-3 ${
                  rangeCompleteDesktop ? '' : 'border-r border-ink-100'
                }`}
              >
                {rangeCompleteDesktop ? (
                  <div className="mb-2 flex shrink-0 items-center justify-between gap-2 rounded-xl border border-vivid-teal-200 bg-vivid-teal-50/80 px-3 py-2">
                    <p className="min-w-0 truncate text-[13px] font-semibold text-[#0f766e]">
                      {faixaIntervaloLabel}
                    </p>
                    <button
                      type="button"
                      onClick={agenda.clearRangeSelection}
                      className={`inline-flex min-h-[44px] shrink-0 items-center rounded-lg px-3 text-xs font-semibold text-[#0f766e] hover:bg-white/70 ${FOCUS_RING}`}
                    >
                      alterar
                    </button>
                  </div>
                ) : null}

                <div className="mx-auto flex min-h-0 w-full flex-1 flex-col">
                  <CalendarioMensal
                    heatmap={agenda.dispCalendarioHeatmap}
                    loading={Boolean(roleUserIdFiltro) && agenda.dispMonthLoading}
                    error={roleUserIdFiltro ? agenda.dispMonthError : ''}
                    onPrevMonth={agenda.goDispPrevMonth}
                    onNextMonth={agenda.goDispNextMonth}
                    onRetry={agenda.retryDispMonth}
                    diaSelecionado={agenda.form.data}
                    onSelecionarDia={handleSelecionarDia}
                    showDensityLegend={Boolean(roleUserIdFiltro)}
                    showFechadoLegend={Boolean(roleUserIdFiltro)}
                    linhasAutomaticas
                    compactChrome
                    showVagasCount={Boolean(roleUserIdFiltro)}
                    selectedTimeLabel={selectedTimeLabel}
                  />
                </div>
              </div>

              {!rangeCompleteDesktop ? (
                <div className="mx-auto flex h-full min-h-0 w-full flex-col overflow-hidden px-4 py-3">
                  {(isModoProcedimento || isModoRetorno) ? (
                    <div className="mb-2 shrink-0">{renderProcOuRetornoCard({ compact: true })}</div>
                  ) : null}

                  <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
                    <p
                      className="min-w-0 truncate text-[11px] font-semibold uppercase tracking-wide text-[#6b7280]"
                      aria-live="polite"
                    >
                      {phaseSubtitle(rangePhase, agenda.form.horaInicio)}
                    </p>
                    {rangePhase !== 'idle' && typeof agenda.clearRangeSelection === 'function' ? (
                      <button
                        type="button"
                        onClick={agenda.clearRangeSelection}
                        className={`inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100 ${FOCUS_RING}`}
                        aria-label="Limpar seleção de horário"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>

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
                      colunas={2}
                      hidePhaseBanner
                    />
                    {agenda.formErrors?.horaInicio ? (
                      <p className="mt-2 text-xs font-medium text-red-600" role="alert">
                        {agenda.formErrors.horaInicio}
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* ── Corpo mobile ────────────────────────────────────────────────── */}
        {!isDesktop && (
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 custom-scrollbar">
            <button
              type="button"
              onClick={() => setDispSheetOpen(true)}
              className={`flex w-full items-center justify-between gap-2 rounded-xl border px-4 py-3.5 text-left transition-colors ${FOCUS_RING} ${
                ctaPreenchido
                  ? 'border-vivid-teal-300 bg-vivid-teal-50'
                  : 'border-ink-200 bg-white hover:border-vivid-teal-200 hover:bg-vivid-teal-50'
              }`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <Calendar
                  className={`h-4 w-4 shrink-0 ${ctaPreenchido ? 'text-vivid-teal-600' : 'text-ink-400'}`}
                />
                <span
                  className={`truncate text-sm font-semibold ${
                    ctaPreenchido ? 'text-vivid-teal-700' : 'text-ink-600'
                  }`}
                >
                  {ctaLabel}
                </span>
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 -rotate-90 text-ink-400" />
            </button>
          </div>
        )}

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div className="shrink-0 border-t border-ink-100 px-6 py-3">
          {resultadosSalvar?.some((r) => r.status !== 'ok') && (
            <div className="mb-3 space-y-1 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs">
              {resultadosSalvar
                .filter((r) => r.status !== 'ok')
                .map((r) => {
                  const proc = procedimentosSelecionados.find((p) => p.id === r.id);
                  return (
                    <div key={r.id} className="flex items-center gap-1.5 text-red-700">
                      <X className="h-3 w-3 shrink-0" />
                      <span>
                        <strong>{proc?.nome ?? '—'}</strong>:{' '}
                        {r.status === 'conflito'
                          ? 'horário ocupado — escolha outro slot'
                          : 'cancelado'}
                      </span>
                    </div>
                  );
                })}
              <p className="mt-1 text-red-500">Selecione outro horário e confirme novamente.</p>
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
              {resumoTexto ? (
                <p className="min-w-0 truncate text-sm text-ink-600">{resumoTexto}</p>
              ) : (
                <p className="text-sm text-[#6b7280]">Preencha os campos para confirmar</p>
              )}
              <ObservacoesField
                value={agenda.form.observacao}
                onChange={(e) => agenda.updateForm('observacao', e.target.value)}
                className="shrink-0"
                compact
              />
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={agenda.closeModal}
                className={`rounded-xl border border-ink-200 px-4 py-2.5 text-sm font-bold text-ink-600 hover:bg-ink-50 ${FOCUS_RING}`}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmar}
                disabled={confirmDisabled || submitting}
                className={`rounded-xl bg-vivid-teal-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-vivid-teal-700 disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS_RING}`}
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Salvando…
                  </span>
                ) : (
                  confirmLabel
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {!isDesktop && dispSheetOpen && (
        <AgendaFormDataHoraSheet
          open
          diaSelecionado={agenda.form.data}
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
          showFechadoLegend={Boolean(roleUserIdFiltro)}
          showVagasCount={Boolean(roleUserIdFiltro)}
          onSelecionarDia={handleSelecionarDia}
          onRangeSlotClick={handleSheetSelectSlot}
          onClearRange={agenda.clearRangeSelection}
          onCancel={() => setDispSheetOpen(false)}
          horaInicioError={agenda.formErrors?.horaInicio}
        />
      )}

      {agenda.foraDispModal}
    </div>
  );
}
