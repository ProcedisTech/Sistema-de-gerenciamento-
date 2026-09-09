import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Calendar,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Folder,
  Loader2,
  Plus,
  Save,
  Trash2,
  XCircle,
  MoreVertical,
  AlertTriangle,
  Zap,
  Search,
  X,
  Clock,
  Check,
  ChevronRight,
  User,
} from 'lucide-react';
import { ProcedimentoSearchInput } from '../agenda/ProcedimentoSearchInput.jsx';
import { useProcedimentosOptions } from '../../hooks/useProcedimentosOptions.js';
import { useToast } from '../../contexts/useToast.js';
import { getApiErrorDetail, planejamentosApi, pacientesGaleriaApi, termosApi, pacientesApi, procedimentosApi } from '../../services/api.js';
import { enriquecerPlanosComCatalogo } from '../../utils/planejamentoNormalize.js';
import { calcResumoProtocolo, isRealUuid } from '../../utils/planejamentoDraftUtils.js';
import {
  canDarBaixaItem,
  canReagendarItem,
  getPlanoItemStatusPresentation,
  getPlanoStatusPresentation,
  isItemAgendado,
  isItemPendente,
} from '../../utils/planejamentoStatusUi.js';
import {
  calcSessoesPlano,
  dataReferenciaHistorico,
  motivoEncerramentoPlano,
} from '../../utils/planejamentoProfileMetrics.js';
import { usePlanosPaciente } from './usePlanosPaciente.js';
import { usePlanoDraft } from './usePlanoDraft.js';
import { PlanoItemCard } from './PlanoItemCard.jsx';
import { PlanoRetornoBadge } from './PlanoRetornoBadge.jsx';
import { PlanoProtocoloResumo } from './PlanoProtocoloResumo.jsx';
import { PlanoItemEditModal } from './PlanoItemEditModal.jsx';
import { PlanoConcluirRetornoConfirmModal } from './PlanoConcluirRetornoConfirmModal.jsx';
import { PlanoEncerrarConfirmModal } from './PlanoEncerrarConfirmModal.jsx';
import { ValorOrcadoInput } from './ValorOrcadoInput.jsx';
import { PlanoVisitasTimeline } from './PlanoVisitasTimeline.jsx';
import { PastaAtendimentosAvulsos } from './PastaAtendimentosAvulsos.jsx';
import { resolverFotosEPlanos } from '../../utils/planoGaleriaResolver.js';
import { normalizePacienteGaleriaResponse } from '../../utils/pacienteGaleria.js';
import { mapBackendPatient } from '../../utils/patientMapping.js';
import { calculateAgeFromISODate } from '../utils/formatters.js';
import { titulosFaltantes, procedimentoBloqueadoPorTermos } from '../../utils/termoResolucao.js';
import { toLocalDateIso } from '../../utils/agendaDateUtils.js';

function formatValorBrl(val) {
  if (val == null || val === '') return '—';
  const n = Number(val);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDataPt(iso) {
  if (!iso) return '—';
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

function formatarTempoCadeira(minutos) {
  const m = Number(minutos) || 0;
  if (m <= 0) return '0 min';
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const rest = m % 60;
    return `${h}h${rest ? String(rest).padStart(2, '0') : ''}`;
  }
  return `${m}min`;
}

function formatDataHumana(dataIso) {
  if (!dataIso) return '';
  const d = new Date(String(dataIso).slice(0, 10) + 'T12:00:00');
  const hojeStr = toLocalDateIso();
  const dataStr = String(dataIso).slice(0, 10);

  if (dataStr === hojeStr) return 'Hoje';

  const amanha = new Date();
  amanha.setDate(amanha.getDate() + 1);
  if (dataStr === toLocalDateIso(amanha)) return 'Amanhã';

  return d.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' });
}

function itemReactKey(item) {
  return String(item?.id ?? item?.tempId ?? '');
}

function truncateObservacao(text, max = 60) {
  const s = String(text ?? '').trim();
  if (!s) return '';
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

function ProgressBar({ progresso }) {
  if (progresso == null) return null;
  const pct = Math.round(Math.min(1, Math.max(0, progresso)) * 100);
  return (
    <div className="mt-2">
      <div className="mb-1 flex items-center justify-between text-[11px] font-medium text-[#64748b]">
        <span>Progresso</span>
        <span className="tabular-nums">{pct}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#e2e8f0]">
        <div
          className="h-full rounded-full bg-brand-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function ProgressBarProfileActive({ feitas, total }) {
  const ratio = total > 0 ? feitas / total : 0;
  const pct = Math.round(ratio * 100);
  return (
    <div className="mt-4">
      <div className="mb-1.5 flex items-center justify-between text-[11px] font-medium text-ink-500">
        <span>
          {feitas} de {total} sessões realizadas
        </span>
        <span className="tabular-nums font-semibold">{pct}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-ink-150">
        <div
          className="h-full rounded-full bg-brand-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function PlanoItemRow({
  item,
  plano,
  canCrud,
  canBaixa,
  canReagendar,
  canAgendar,
  mutating,
  onAgendarItem,
  onReagendarItem,
  onIniciarAtendimentoItem,
  onDarBaixa: _onDarBaixa,
  onRemover,
}) {
  const itemStatus = getPlanoItemStatusPresentation(item.statusItem ?? item.statusItemNome);
  const isAtivo = plano.statusCodigo === 'ativo';
  const statusCodigo = item.statusItem ?? item.statusItemNome;
  const pendente = isItemPendente(statusCodigo);
  const agendado = isItemAgendado(statusCodigo) || Boolean(item.sessaoAtiva?.agendaId);

  const showAgendar = canAgendar && pendente && !agendado;
  const agendarEnabled = showAgendar && isAtivo;
  const agendarTooltip = !isAtivo
    ? 'Só é possível agendar itens de um plano ativo'
    : 'Agendar procedimento';

  const showBaixa = canBaixa && canDarBaixaItem(plano, item);
  const showReagendar = canReagendar && canReagendarItem(plano, item);

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-[#e2e8f0] bg-[#f8fbfb] p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-semibold text-[#0f172a]">
          {item.catalogoNome || 'Procedimento'}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[#64748b]">
          <span>{formatValorBrl(item.valorOrcado)}</span>
          {item.dataPlanejada ? (
            <>
              <span>·</span>
              <span>{formatDataPt(item.dataPlanejada)}</span>
            </>
          ) : null}
          {item.sessaoAtiva?.dataAgendamento ? (
            <>
              <span>·</span>
              <span>
                Agendado: {formatDataPt(item.sessaoAtiva.dataAgendamento)}
                {item.sessaoAtiva.horaInicio ? ` ${String(item.sessaoAtiva.horaInicio).slice(0, 5)}` : ''}
              </span>
            </>
          ) : null}
          <span
            className={`rounded-md border-[2px] px-2 py-0.5 text-[10px] font-bold ${itemStatus.pillClass}`}
          >
            {itemStatus.label}
          </span>
        </div>
        {item.sessaoRetornoAtiva?.dataAgendamento ? (
          <PlanoRetornoBadge
            catalogoNome={item.catalogoNome}
            dataAgendamento={item.sessaoRetornoAtiva.dataAgendamento}
            horaInicio={item.sessaoRetornoAtiva.horaInicio}
          />
        ) : null}
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        {showAgendar ? (
          <button
            type="button"
            disabled={mutating || !agendarEnabled}
            title={agendarTooltip}
            onClick={() =>
              agendarEnabled
                ? onAgendarItem?.(
                  {
                    planejamentoItemId: item.id,
                    catalogoProcedimentoSaudeId: item.catalogoId,
                    catalogoNome: item.catalogoNome,
                  },
                  () => { },
                )
                : undefined
            }
            className="inline-flex items-center gap-1.5 rounded-lg border-[2px] border-[#00a88e]/30 bg-[#e6f7f5] px-2.5 py-1.5 text-[11px] font-bold text-[#0f766e] transition-colors hover:bg-[#d2f3ee] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Calendar className="h-3.5 w-3.5" strokeWidth={2.2} />
            Agendar
          </button>
        ) : null}
        {showReagendar ? (
          <button
            type="button"
            disabled={mutating}
            title="Reagendar procedimento"
            onClick={() => onReagendarItem?.(item, plano, () => { })}
            className="inline-flex items-center gap-1.5 rounded-lg border-[2px] border-[#00a88e]/30 bg-white px-2.5 py-1.5 text-[11px] font-bold text-[#0f766e] transition-colors hover:bg-[#e6f7f5] disabled:opacity-60"
          >
            <CalendarClock className="h-3.5 w-3.5" strokeWidth={2.2} />
            Reagendar
          </button>
        ) : null}
        {showBaixa ? (
          <button
            type="button"
            disabled={mutating}
            title="Iniciar atendimento"
            onClick={(e) => {
              e.stopPropagation();
              onIniciarAtendimentoItem?.(item, plano);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border-[2px] border-[#00a88e]/30 bg-[#e6f7f5] px-2.5 py-1.5 text-[11px] font-bold text-[#0f766e] transition-colors hover:bg-[#d2f3ee] disabled:opacity-60"
          >
            <Zap className="h-3.5 w-3.5" strokeWidth={2.2} />
            Iniciar
          </button>
        ) : null}
        {canCrud && plano.statusCodigo === 'ativo' ? (
          <button
            type="button"
            disabled={mutating}
            onClick={() => onRemover?.(plano.id, item.id)}
            className="inline-flex items-center gap-1 rounded-lg border border-[#fecaca] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#dc2626] transition-colors hover:bg-[#fef2f2] disabled:opacity-60"
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
            Remover
          </button>
        ) : null}
      </div>
    </div>
  );
}

function renderItensComIntervalo({
  itens,
  plano,
  canCrud,
  canBaixa,
  canReagendar,
  canAgendar,
  mutating,
  onAgendarItem,
  onAgendarRetornoItem,
  onReagendarItem,
  onIniciarAtendimentoItem,
  onIniciarAtendimentoVisita,
  onDarBaixa,
  onEditItem,
  onRemoverItem,
  selecionados = new Set(),
  onToggleSelecao,
  catalogoOptions = [],
  procedimentosFeitos = [],
}) {
  const catalogoMap = new Map();
  catalogoOptions.forEach((c) => {
    catalogoMap.set(String(c.id), c);
    if (c.catalogoProcedimentoSaudeId) catalogoMap.set(String(c.catalogoProcedimentoSaudeId), c);
  });

  const contagemProcedimentosFeitos = new Map();
  (procedimentosFeitos || []).forEach((proc) => {
    const id = String(proc.catalogoProcedimentoSaudeId || proc.id || '').trim();
    const nome = String(proc.nomeProcedimento || proc.nome || '').trim().toLowerCase();
    if (id) contagemProcedimentosFeitos.set(id, (contagemProcedimentosFeitos.get(id) || 0) + 1);
    if (nome) contagemProcedimentosFeitos.set(nome, (contagemProcedimentosFeitos.get(nome) || 0) + 1);
  });

  const getVezesFeitas = (item) => {
    const id = String(item.catalogoProcedimentoSaudeId || item.catalogoId || '').trim();
    const nome = String(item.catalogoNome || '').trim().toLowerCase();
    return (id && contagemProcedimentosFeitos.get(id)) || (nome && contagemProcedimentosFeitos.get(nome)) || 0;
  };

  const poolSemData = [];
  const gruposPorData = new Map();

  itens.forEach((item) => {
    const dataIso =
      item.sessaoAtiva?.dataAgendamento ||
      item.sessaoRealizada?.dataAgendamento ||
      item.dataPlanejada;
    const dataKey = dataIso ? String(dataIso).slice(0, 10) : null;

    if (!dataKey) {
      poolSemData.push(item);
    } else {
      if (!gruposPorData.has(dataKey)) {
        gruposPorData.set(dataKey, {
          data: dataKey,
          dataHoraInicio:
            item.sessaoAtiva?.horaInicio ||
            item.sessaoRealizada?.horaInicio ||
            item.horaInicio ||
            null,
          itens: [],
        });
      }
      gruposPorData.get(dataKey).itens.push(item);
    }
  });

  const visitasAgrupadas = Array.from(gruposPorData.values()).sort(
    (a, b) => new Date(a.data).getTime() - new Date(b.data).getTime(),
  );

  const duracaoSemData = poolSemData.reduce((acc, it) => {
    const c = catalogoMap.get(String(it.catalogoProcedimentoSaudeId || it.catalogoId));
    return acc + (Number(c?.duracaoMin) || 30);
  }, 0);

  const valorSemData = poolSemData.reduce((acc, it) => acc + (Number(it.valorOrcado) || 0), 0);

  return (
    <div className="space-y-4">
      {/* ── BLOCO 1: "ESCOLHIDOS, SEM DATA" (CONTAINER TRACEJADO V6) ── */}
      {poolSemData.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 px-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
            <span>Escolhidos, sem data</span>
            <span className="font-semibold normal-case text-slate-400">
              {poolSemData.length} procedimento{poolSemData.length !== 1 ? 's' : ''} ·{' '}
              {formatarTempoCadeira(duracaoSemData)} de cadeira · {formatValorBrl(valorSemData)}
            </span>
          </div>

          <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-3 shadow-2xs space-y-2">
            {poolSemData.map((item, idx) => {
              const key = itemReactKey(item);
              const isSel = selecionados.has(String(item.id || key));
              const cat = catalogoMap.get(String(item.catalogoProcedimentoSaudeId || item.catalogoId));
              const vezes = getVezesFeitas(item);

              return (
                <PlanoItemCard
                  key={key}
                  item={item}
                  plano={plano}
                  planoTitulo={plano?.titulo || plano?.nome || 'Plano de Tratamento'}
                  visitaLabel="No plano"
                  canCrud={canCrud}
                  canBaixa={canBaixa}
                  canReagendar={canReagendar}
                  canAgendar={canAgendar}
                  mutating={mutating}
                  onAgendarItem={onAgendarItem}
                  onAgendarRetornoItem={onAgendarRetornoItem}
                  onReagendarItem={onReagendarItem}
                  onIniciarAtendimento={onIniciarAtendimentoItem}
                  onDarBaixa={onDarBaixa}
                  onEdit={onEditItem}
                  onRemover={onRemoverItem}
                  entranceDelayMs={idx * 30}
                  selecionavel={true}
                  selecionado={isSel}
                  onToggleSelecao={() => onToggleSelecao?.(String(item.id || key))}
                  vezesFeitas={vezes}
                  duracaoMin={cat?.duracaoMin}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* ── BLOCO 2: VISITAS AGENDADAS (CRONOGRAMA V6) ── */}
      {visitasAgrupadas.length > 0 && (
        <div className="space-y-3">
          <div className="px-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
            Cronograma de Visitas
          </div>

          <div className="relative pl-4 border-l-2 border-[#00a88e] space-y-4">
            {visitasAgrupadas.map((visita, idx) => {
              const duracaoVisita = visita.itens.reduce((acc, it) => {
                const c = catalogoMap.get(String(it.catalogoProcedimentoSaudeId || it.catalogoId));
                return acc + (Number(c?.duracaoMin) || 30);
              }, 0);

              const todosFinalizados = visita.itens.every((it) => {
                const s = String(it.statusItem || it.statusItemNome || '').toLowerCase();
                return s === 'finalizado' || s === 'realizado';
              });

              return (
                <div key={visita.data} className="relative">
                  <span
                    className={`absolute -left-[21.5px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-white shadow-2xs ${todosFinalizados ? 'bg-emerald-500' : 'bg-[#00a88e]'
                      }`}
                  />

                  <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs space-y-2.5">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-[13px]">
                          Visita {idx + 1} · {formatDataHumana(visita.data)}
                        </span>
                        {visita.dataHoraInicio && (
                          <span className="text-[11px] text-slate-500 font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                            {String(visita.dataHoraInicio).slice(0, 5)}
                          </span>
                        )}
                        <span className="text-[11px] text-slate-400">
                          ({formatarTempoCadeira(duracaoVisita)})
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${todosFinalizados
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-teal-50 text-teal-800 border border-teal-200'
                            }`}
                        >
                          {todosFinalizados
                            ? 'Concluída'
                            : `${visita.itens.length} procedimento${visita.itens.length !== 1 ? 's' : ''}`}
                        </span>

                        {!todosFinalizados && canBaixa && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onIniciarAtendimentoVisita?.(visita, plano);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[11px] font-bold shadow-2xs transition-all"
                          >
                            <Zap className="w-3 h-3" />
                            <span>Iniciar visita</span>
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      {visita.itens.map((item, itemIdx) => {
                        const key = itemReactKey(item);
                        const isSel = selecionados.has(String(item.id || key));
                        const cat = catalogoMap.get(String(item.catalogoProcedimentoSaudeId || item.catalogoId));
                        const vezes = getVezesFeitas(item);

                        return (
                          <PlanoItemCard
                            key={key}
                            item={item}
                            plano={plano}
                            planoTitulo={plano?.titulo || plano?.nome || 'Plano de Tratamento'}
                            visitaLabel={`Visita ${idx + 1}`}
                            visitaData={visita.data}
                            visitaHora={visita.dataHoraInicio}
                            canCrud={canCrud}
                            canBaixa={canBaixa}
                            canReagendar={canReagendar}
                            canAgendar={canAgendar}
                            mutating={mutating}
                            onAgendarItem={onAgendarItem}
                            onAgendarRetornoItem={onAgendarRetornoItem}
                            onReagendarItem={onReagendarItem}
                            onIniciarAtendimento={onIniciarAtendimentoItem}
                            onDarBaixa={onDarBaixa}
                            onEdit={onEditItem}
                            onRemover={onRemoverItem}
                            entranceDelayMs={itemIdx * 30}
                            selecionavel={true}
                            selecionado={isSel}
                            onToggleSelecao={() => onToggleSelecao?.(String(item.id || key))}
                            vezesFeitas={vezes}
                            duracaoMin={cat?.duracaoMin}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function PlanoCard({
  plano,
  expandido,
  onToggle,
  canCrud,
  canBaixa,
  canReagendar,
  canAgendar,
  canConcluirRetorno,
  mutating,
  onAgendarItem,
  onAgendarRetornoItem,
  onReagendarItem,
  onIniciarAtendimentoItem,
  onIniciarAtendimentoVisita,
  onDarBaixa,
  onRemoverItem,
  onEncerrar,
  onConcluir,
  onRequestConcluirRetorno,
  addItemForm,
  isConsultaDraft,
  draftItens,
  draftObservacao,
  onObservacaoChange,
  isDirty,
  saving,
  onSalvar,
  onEditItem,
  onRemoverDraftItem,
  cardEntranceDelayMs,
  selecionados = new Set(),
  onToggleSelecao,
  catalogoOptions = [],
  procedimentosFeitos = [],
}) {
  const statusUi = getPlanoStatusPresentation(plano.statusCodigo, plano.statusNome);
  const isAtivo = plano.statusCodigo === 'ativo';
  const itens = isConsultaDraft ? (draftItens ?? []) : plano.itens;

  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white shadow-2xs transition-all animate-agenda-rise ${isAtivo ? 'border-l-4 border-l-[#00a88e]' : 'border-l-4 border-l-slate-400'
        }`}
      style={cardEntranceDelayMs != null ? { animationDelay: `${cardEntranceDelayMs}ms` } : undefined}
    >
      <div
        className="flex cursor-pointer select-none flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 bg-white transition-colors hover:bg-slate-50/50 rounded-t-xl"
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          }
        }}
        role="button"
        tabIndex={0}
      >
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 font-medium">
            <Calendar className={`w-3.5 h-3.5 ${isAtivo ? 'text-[#00a88e]' : 'text-slate-400'}`} />
            <span>
              {plano.criadoEm ? `Iniciado em ${formatDataPt(plano.criadoEm)}` : 'Plano de Tratamento'}
            </span>
            <span
              className={`px-1.5 py-0.5 rounded font-bold text-[9px] ${isAtivo ? 'bg-teal-50 text-teal-700' : 'bg-slate-100 text-slate-600'
                }`}
            >
              #{String(plano.id).slice(0, 6).toUpperCase()}
            </span>
          </div>

          <h3 className="text-sm font-bold text-slate-900">
            {plano.observacao || 'Protocolo de Tratamento Facial / Corporal'}
          </h3>

          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <span>
              {itens.length} {itens.length === 1 ? 'Procedimento' : 'Procedimentos'}
            </span>
            {plano.valorTotal != null && (
              <>
                <span className="text-slate-300">·</span>
                <span className="font-bold text-slate-700">{formatValorBrl(plano.valorTotal)}</span>
              </>
            )}
          </div>
          <ProgressBar progresso={plano.progresso} />
        </div>

        <div className="flex items-center gap-2.5 self-end sm:self-auto">
          <span
            className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${isAtivo
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-slate-100 text-slate-700 border border-slate-300'
              }`}
          >
            {statusUi.label || (isAtivo ? 'EM ANDAMENTO' : 'FINALIZADO')}
          </span>

          <div className="p-1 rounded-md text-slate-400">
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-200 ${expandido ? 'rotate-180 text-slate-700' : ''
                }`}
            />
          </div>
        </div>
      </div>

      {expandido ? (
        <div className="space-y-3.5 border-t border-slate-100 bg-slate-50/40 p-3.5 animate-agenda-rise">
          {isConsultaDraft && isAtivo ? (
            <textarea
              value={draftObservacao ?? ''}
              disabled={mutating || saving}
              onChange={(e) => onObservacaoChange?.(plano.id, e.target.value)}
              placeholder="Observações do plano…"
              rows={2}
              className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] text-[#475569] outline-none shadow-2xs focus:border-[#00a88e] focus:ring-2 focus:ring-[#00a88e]/10"
            />
          ) : plano.observacao ? (
            <p className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] text-[#475569] shadow-2xs">
              {plano.observacao}
            </p>
          ) : null}

          {itens.length === 0 ? (
            <p className="text-[13px] font-medium text-[#94a3b8]">Nenhum item no plano.</p>
          ) : isConsultaDraft ? (
            <div className="space-y-2">
              {renderItensComIntervalo({
                itens,
                plano,
                canCrud,
                canBaixa,
                canReagendar,
                canAgendar,
                mutating: mutating || saving,
                onAgendarItem,
                onAgendarRetornoItem,
                onReagendarItem,
                onIniciarAtendimentoItem,
                onIniciarAtendimentoVisita,
                onDarBaixa,
                onEditItem,
                onRemoverItem: onRemoverDraftItem,
                selecionados,
                onToggleSelecao,
                catalogoOptions,
                procedimentosFeitos,
              })}
            </div>
          ) : (
            <div className="space-y-2">
              {plano.itens.map((item) => (
                <PlanoItemRow
                  key={item.id}
                  item={item}
                  plano={plano}
                  canCrud={canCrud}
                  canBaixa={canBaixa}
                  canReagendar={canReagendar}
                  canAgendar={canAgendar}
                  mutating={mutating}
                  onAgendarItem={onAgendarItem}
                  onReagendarItem={onReagendarItem}
                  onIniciarAtendimentoItem={onIniciarAtendimentoItem}
                  onDarBaixa={onDarBaixa}
                  onRemover={onRemoverItem}
                />
              ))}
            </div>
          )}

          {canCrud && isAtivo ? addItemForm(plano.id) : null}

          {isConsultaDraft && itens.length > 0 ? (
            <div className="relative z-0">
              <PlanoProtocoloResumo
                itens={itens}
                plano={plano}
                catalogoOptions={catalogoOptions}
              />
            </div>
          ) : null}

          {isConsultaDraft && isAtivo ? (
            <div
              className={`flex flex-wrap items-center justify-between gap-3 rounded-xl px-3 py-2.5 ${isDirty ? 'bg-brand-primaryGhost' : 'bg-ink-50'
                }`}
            >
              <p
                className={`text-[12px] font-medium ${isDirty ? 'text-brand-primaryDark' : 'text-ink-500'
                  }`}
              >
                {isDirty ? (
                  <>
                    <span className="text-brand-primary" aria-hidden>
                      ●{' '}
                    </span>
                    Alterações não salvas — salve para não perder
                  </>
                ) : (
                  <>✓ Tudo salvo</>
                )}
              </p>
              <button
                type="button"
                disabled={!isDirty || saving || mutating}
                onClick={(e) => {
                  e.stopPropagation();
                  onSalvar?.(plano.id);
                }}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-semibold transition-colors disabled:cursor-not-allowed ${isDirty
                  ? 'bg-brand-primary text-white hover:bg-brand-primaryDark disabled:opacity-50'
                  : 'border border-ink-200 bg-white text-ink-400 opacity-50'
                  }`}
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.5} />
                ) : (
                  <Save className="h-3.5 w-3.5" strokeWidth={2.5} />
                )}
                Salvar plano
              </button>
            </div>
          ) : null}

          {canConcluirRetorno && isAtivo ? (
            <div className="rounded-xl border border-ink-200 bg-ink-50/50 p-3.5 animate-agenda-rise">
              <p className="font-display text-[10px] font-extrabold uppercase tracking-wider text-ink-500">
                Encerramento
              </p>
              <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <h3 className="font-display text-[15px] font-extrabold leading-snug text-ink-900">
                    Concluir tratamento com retorno
                  </h3>
                  <p className="mt-1 text-[12px] leading-relaxed text-ink-500">
                    Encerre este plano e agende uma consulta de retorno para dar continuidade ao
                    tratamento em nova fase.
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                  <button
                    type="button"
                    disabled={mutating || saving}
                    onClick={() => onRequestConcluirRetorno?.(plano)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-ink-300 bg-white px-3 py-2 text-[12px] font-semibold text-ink-700 transition-colors hover:bg-ink-100 disabled:opacity-60"
                  >
                    <Calendar className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden />
                    Concluir com retorno
                  </button>
                  <button
                    type="button"
                    disabled={mutating || saving}
                    onClick={() => onEncerrar?.(plano.id)}
                    className="rounded-xl border border-transparent bg-transparent px-2.5 py-2 text-[12px] font-medium text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-700 disabled:opacity-60"
                  >
                    Encerrar
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {!canCrud && !canConcluirRetorno && isAtivo ? (
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                disabled={mutating}
                title="Plano concluído com sucesso"
                onClick={() => onConcluir?.(plano.id)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#00a88e] px-3 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-[#00967f] disabled:opacity-60"
              >
                <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2.2} />
                Concluir
              </button>
              <button
                type="button"
                disabled={mutating}
                title="Interromper plano por intercorrência"
                onClick={() => onEncerrar?.(plano.id)}
                className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] font-semibold text-amber-800 transition-colors hover:bg-amber-100 disabled:opacity-60"
              >
                Encerrar
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function PlanoAtivoProfileCard({
  plano,
  expandido,
  onToggle,
  canBaixa,
  canReagendar,
  canCrud,
  canConcluirRetorno,
  mutating,
  onReagendarItem,
  onIniciarAtendimentoItem,
  onDarBaixa,
  onEncerrar,
  onConcluir,
}) {
  const statusUi = getPlanoStatusPresentation(plano.statusCodigo, plano.statusNome);
  const isAtivo = plano.statusCodigo === 'ativo';
  const itens = Array.isArray(plano.itens) ? plano.itens : [];
  const { feitas, total } = calcSessoesPlano(itens);
  const showAcoesPlano = !canCrud && !canConcluirRetorno && isAtivo;

  return (
    <div className="overflow-hidden rounded-xl border-2 border-brand-primary/25 bg-brand-primaryGhost shadow-app-card">
      <div className="space-y-4 p-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-xl border-[2px] px-2.5 py-0.5 text-[11px] font-bold ${statusUi.pillClass}`}
            >
              {statusUi.label}
            </span>
          </div>
          {plano.criadoEm ? (
            <p className="mt-2 text-[12px] font-medium text-ink-500">
              Criado em {formatDataPt(plano.criadoEm)}
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">
              Procedimentos
            </p>
            <p className="mt-1 font-display text-[20px] font-extrabold tabular-nums text-ink-900">
              {total}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">
              Valor orçado
            </p>
            <p className="mt-1 font-display text-[20px] font-extrabold tabular-nums text-ink-900">
              {formatValorBrl(plano.valorTotal)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">
              Sessões feitas
            </p>
            <p className="mt-1 font-display text-[20px] font-extrabold tabular-nums text-ink-900">
              {feitas}/{total}
            </p>
          </div>
        </div>

        <ProgressBarProfileActive feitas={feitas} total={total} />
      </div>

      {showAcoesPlano ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-brand-primary/15 bg-white/60 px-4 py-3">
          <button
            type="button"
            disabled={mutating}
            onClick={(e) => {
              e.stopPropagation();
              onToggle?.();
            }}
            className="mr-auto inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-semibold text-brand-primary transition-colors hover:bg-brand-primaryGhost"
          >
            <ChevronDown
              className={`h-4 w-4 transition-transform duration-200 ${expandido ? 'rotate-180' : ''}`}
              strokeWidth={2}
            />
            {expandido ? 'Recolher' : 'Ver sessões'}
          </button>
          <button
            type="button"
            disabled={mutating}
            title="Interromper plano por intercorrência"
            onClick={(e) => {
              e.stopPropagation();
              onEncerrar?.(plano.id);
            }}
            className="rounded-xl border border-status-danger/30 bg-white px-3 py-2 text-[12px] font-semibold text-status-danger-ink transition-colors hover:bg-status-danger-bg disabled:opacity-60"
          >
            Encerrar
          </button>
          <button
            type="button"
            disabled={mutating}
            title="Plano concluído com sucesso"
            onClick={(e) => {
              e.stopPropagation();
              onConcluir?.(plano.id);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-primary px-3 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-brand-primaryDark disabled:opacity-60"
          >
            <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2.2} />
            Concluir
          </button>
        </div>
      ) : null}

      {expandido ? (
        <div className="space-y-2 border-t border-brand-primary/15 bg-white px-4 pb-4 pt-3">
          {plano.observacao ? (
            <p className="rounded-xl bg-brand-primaryGhost/50 px-3 py-2 text-[13px] text-ink-600">
              {plano.observacao}
            </p>
          ) : null}
          {itens.length === 0 ? (
            <p className="text-[13px] font-medium text-ink-400">Nenhum item no plano.</p>
          ) : (
            <div className="space-y-2">
              {itens.map((item) => (
                <PlanoItemRow
                  key={item.id}
                  item={item}
                  plano={plano}
                  canCrud={false}
                  canBaixa={canBaixa}
                  canReagendar={canReagendar}
                  canAgendar={false}
                  mutating={mutating}
                  onReagendarItem={onReagendarItem}
                  onIniciarAtendimentoItem={onIniciarAtendimentoItem}
                  onDarBaixa={onDarBaixa}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function PlanoHistoricoProfileCard({
  plano,
  expandido,
  onToggle,
  canBaixa,
  canReagendar,
  mutating,
  onReagendarItem,
  onIniciarAtendimentoItem,
  onDarBaixa,
}) {
  const statusUi = getPlanoStatusPresentation(plano.statusCodigo, plano.statusNome);
  const itens = Array.isArray(plano.itens) ? plano.itens : [];
  const { total } = calcSessoesPlano(itens);
  const titulo =
    truncateObservacao(plano.observacao) || 'Plano de tratamento';
  const motivo = motivoEncerramentoPlano(plano);
  const isEncerrado = plano.statusCodigo === 'encerrado';
  const StatusIcon = plano.statusCodigo === 'concluido' ? CheckCircle2 : XCircle;

  return (
    <div className="overflow-hidden rounded-xl border border-ink-150 bg-white shadow-sm">
      <div
        className="flex cursor-pointer select-none items-center gap-3 px-4 py-3 transition-colors hover:bg-ink-50"
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle?.();
          }
        }}
        role="button"
        tabIndex={0}
      >
        <StatusIcon
          className={`h-5 w-5 shrink-0 ${plano.statusCodigo === 'concluido' ? 'text-brand-primary' : 'text-ink-400'
            }`}
          strokeWidth={2}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-ink-900">{titulo}</p>
          <p className="mt-0.5 text-[11px] font-medium text-ink-500">
            {formatDataPt(dataReferenciaHistorico(plano))} · {total} sessões ·{' '}
            {formatValorBrl(plano.valorTotal)}
          </p>
        </div>
        <span
          className={`hidden shrink-0 rounded-xl border-[2px] px-2 py-0.5 text-[10px] font-bold sm:inline ${statusUi.pillClass}`}
        >
          {statusUi.label}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-ink-400 transition-transform duration-200 ${expandido ? 'rotate-180' : ''
            }`}
          strokeWidth={2}
        />
      </div>

      {expandido ? (
        <div className="space-y-2 border-t border-ink-150 px-4 pb-4 pt-3">
          <span
            className={`inline-flex rounded-xl border-[2px] px-2 py-0.5 text-[10px] font-bold sm:hidden ${statusUi.pillClass}`}
          >
            {statusUi.label}
          </span>
          {isEncerrado && motivo ? (
            <p className="rounded-xl bg-ink-50 px-3 py-2 text-[12px] text-ink-600">{motivo}</p>
          ) : null}
          {plano.observacao ? (
            <p className="rounded-xl bg-ink-50 px-3 py-2 text-[13px] text-ink-600">
              {plano.observacao}
            </p>
          ) : null}
          {itens.length === 0 ? (
            <p className="text-[13px] font-medium text-ink-400">Nenhum item no plano.</p>
          ) : (
            <div className="space-y-2">
              {itens.map((item) => (
                <PlanoItemRow
                  key={item.id}
                  item={item}
                  plano={plano}
                  canCrud={false}
                  canBaixa={canBaixa}
                  canReagendar={canReagendar}
                  canAgendar={false}
                  mutating={mutating}
                  onReagendarItem={onReagendarItem}
                  onIniciarAtendimentoItem={onIniciarAtendimentoItem}
                  onDarBaixa={onDarBaixa}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function PlanosTab({
  pacienteId,
  paciente,
  roleUserId,
  pacienteNome,
  procedimentosFeitos = [],
  galeriaFotosInicial = [],
  onAgendarItem,
  onAgendarRetornoItem,
  onReagendarItem,
  onStartAttendance,
  onSelectProcedimentoParaConsulta,
  onConcluirComRetorno,
  onPlanoConcluido,
  variant = 'profile',
  onVoltar,
}) {
  const isConsulta = variant === 'consulta';
  const canCrud = isConsulta;
  const canBaixa = true;
  const canReagendar = true;
  const canAgendar = true;
  const _canConcluirRetorno = isConsulta;

  const {
    planos,
    loading,
    error,
    mutating,
    refresh,
    criarPlano,
    removerItem,
    alterarStatusPlano,
    darBaixaItem,
    salvarPlano,
    clearError,
  } = usePlanosPaciente({ pacienteId, roleUserId });

  const {
    getDraft,
    hydrateFromPlano,
    initEmptyDraft,
    setObservacao,
    addItem,
    updateItem,
    removeItem,
    isDirty: _isDirty,
    buildPutPayload,
    getRemovedSinceBaseline,
    applyDetalhe,
    rollbackRemoved,
  } = usePlanoDraft();
  const hydratedPlanIdsRef = useRef(new Set());
  const toast = useToast();

  const { options: catalogoOptions, loading: catalogoLoading } = useProcedimentosOptions();
  const [expandidos, setExpandidos] = useState({});
  const [_novoItemPorPlano, _setNovoItemPorPlano] = useState({});
  const [actionError, setActionError] = useState('');
  const [savingPlanoId, setSavingPlanoId] = useState('');
  const [editItemState, setEditItemState] = useState(null);
  const [concluirRetornoModal, setConcluirRetornoModal] = useState(null);
  const [encerrarModalPlanoId, setEncerrarModalPlanoId] = useState(null);
  const [planoMenuAbertoId, setPlanoMenuAbertoId] = useState(null);
  const [galeriaFotos, setGaleriaFotos] = useState(galeriaFotosInicial || []);
  const [filtroStatus, setFiltroStatus] = useState('todos'); // 'todos', 'ativo', 'concluido', 'avulsos'

  // Seleção múltipla para ações em lote ("Agendar juntos", "Fazer agora")
  const [selecionados, setSelecionados] = useState(new Set());
  const [termoBloqueioModal, setTermoBloqueioModal] = useState(null);
  const [popoverAgendarAberto, setPopoverAgendarAberto] = useState(false);
  const [buscaProcedimento, setBuscaProcedimento] = useState('');
  const searchInputRef = useRef(null);

  // Atalho de teclado "/" para focar no campo de busca rápida
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === '/' && document.activeElement !== searchInputRef.current && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fecha menu de opções do plano ao clicar fora
  useEffect(() => {
    function handleClickOutsideMenu() {
      setPlanoMenuAbertoId(null);
    }
    if (planoMenuAbertoId) {
      document.addEventListener('click', handleClickOutsideMenu);
      return () => document.removeEventListener('click', handleClickOutsideMenu);
    }
  }, [planoMenuAbertoId]);

  const toggleSelecao = useCallback((key) => {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const limparSelecao = useCallback(() => {
    setSelecionados(new Set());
    setPopoverAgendarAberto(false);
  }, []);



  const [pacienteData, setPacienteData] = useState(null);
  const [termosFaltantes, setTermosFaltantes] = useState([]);

  useEffect(() => {
    let cancel = false;
    const carregarPaciente = async () => {
      const pid = String(pacienteId ?? '').trim();
      if (!pid) return;
      try {
        const p = await pacientesApi.get(pid);
        if (!cancel) setPacienteData(mapBackendPatient ? mapBackendPatient(p) : p);
      } catch (err) {
        console.warn('Erro ao carregar dados cadastrais do paciente:', err);
      }
    };
    carregarPaciente();
    return () => {
      cancel = true;
    };
  }, [pacienteId]);



  useEffect(() => {
    if (Array.isArray(galeriaFotosInicial) && galeriaFotosInicial.length > 0) {
      setGaleriaFotos(galeriaFotosInicial);
    }
  }, [galeriaFotosInicial]);

  const carregarGaleria = useCallback(async () => {
    const pid = String(pacienteId ?? '').trim();
    if (!pid) return;
    try {
      const res = await pacientesGaleriaApi.list(pid);
      const list = normalizePacienteGaleriaResponse(res);
      setGaleriaFotos(list);
    } catch {
      setGaleriaFotos([]);
    }
  }, [pacienteId]);

  useEffect(() => {
    carregarGaleria();
  }, [carregarGaleria]);

  const [internalProcedimentosFeitos, setInternalProcedimentosFeitos] = useState(
    Array.isArray(procedimentosFeitos) ? procedimentosFeitos : []
  );

  const carregarProcedimentosFeitos = useCallback(async () => {
    const pid = String(pacienteId ?? '').trim();
    if (!pid) return;
    try {
      const res = await procedimentosApi.byPaciente(pid);
      if (Array.isArray(res)) {
        setInternalProcedimentosFeitos(res);
      }
    } catch {
      // no-op silencioso
    }
  }, [pacienteId]);

  useEffect(() => {
    if (Array.isArray(procedimentosFeitos) && procedimentosFeitos.length > 0) {
      setInternalProcedimentosFeitos(procedimentosFeitos);
    } else {
      carregarProcedimentosFeitos();
    }
  }, [procedimentosFeitos, carregarProcedimentosFeitos]);

  const listaProcedimentosFeitos = useMemo(() => {
    if (Array.isArray(procedimentosFeitos) && procedimentosFeitos.length > 0) {
      return procedimentosFeitos;
    }
    return internalProcedimentosFeitos;
  }, [procedimentosFeitos, internalProcedimentosFeitos]);

  const _procedimentoSearchOptions = useMemo(
    () =>
      catalogoOptions.map((o) => ({
        id: o.id,
        nome: o.nomeProcedimento,
        tipoCodigo: o.tipoCodigo,
        duracaoMin: o.duracaoMin,
      })),
    [catalogoOptions],
  );

  const planosEnriquecidos = useMemo(
    () => enriquecerPlanosComCatalogo(planos, catalogoOptions),
    [planos, catalogoOptions],
  );

  const sortedPlanos = useMemo(
    () =>
      [...planosEnriquecidos].sort((a, b) => {
        const da = a.criadoEm ? new Date(a.criadoEm).getTime() : 0;
        const db = b.criadoEm ? new Date(b.criadoEm).getTime() : 0;
        return db - da;
      }),
    [planosEnriquecidos],
  );

  const { fotosPorPlanoId, fotosPorPlanejamentoItemId, fotosAvulsas, atendimentosAvulsos } = useMemo(() => {
    return resolverFotosEPlanos(sortedPlanos, galeriaFotos, listaProcedimentosFeitos);
  }, [sortedPlanos, galeriaFotos, listaProcedimentosFeitos]);

  const displayPlanos = useMemo(
    () =>
      isConsulta
        ? sortedPlanos.filter((p) => p.statusCodigo === 'ativo')
        : sortedPlanos,
    [sortedPlanos, isConsulta],
  );

  const planosAtivos = useMemo(
    () => (isConsulta ? [] : sortedPlanos.filter((p) => p.statusCodigo === 'ativo')),
    [sortedPlanos, isConsulta],
  );

  const planosHistorico = useMemo(
    () =>
      isConsulta
        ? []
        : sortedPlanos.filter(
          (p) => p.statusCodigo === 'concluido' || p.statusCodigo === 'encerrado',
        ),
    [sortedPlanos, isConsulta],
  );

  // Planos filtrados por pill de status
  const planosFiltradosPorPill = useMemo(() => {
    if (filtroStatus === 'ativo') return planosAtivos;
    if (filtroStatus === 'concluido') return planosHistorico;
    if (filtroStatus === 'avulsos') return [];
    return sortedPlanos;
  }, [filtroStatus, planosAtivos, planosHistorico, sortedPlanos]);

  const consultaSemPlanoAtivo = isConsulta && planosEnriquecidos.length > 0 && displayPlanos.length === 0;

  // Resolução contínua de termos do plano ativo
  useEffect(() => {
    let cancel = false;
    const checarTermos = async () => {
      const pid = String(pacienteId ?? '').trim();
      const planoAtivo = displayPlanos[0];
      const itens = planoAtivo?.itens || [];
      const catIds = itens
        .map((it) => it.catalogoProcedimentoSaudeId || it.catalogoId)
        .filter(Boolean);

      if (!pid || catIds.length === 0) {
        if (!cancel) setTermosFaltantes([]);
        return;
      }

      try {
        const resolucao = await termosApi.resolver({
          pacienteId: pid,
          catalogoIds: catIds,
        });
        if (!cancel) {
          setTermosFaltantes(resolucao?.termosFaltantes || resolucao?.faltantes || []);
        }
      } catch (err) {
        console.warn('Erro ao resolver termos do plano:', err);
      }
    };
    checarTermos();
    return () => {
      cancel = true;
    };
  }, [displayPlanos, pacienteId]);

  const toggleExpandido = useCallback(
    (id, plano) => {
      setExpandidos((prev) => {
        const nextOpen = !prev[id];
        if (isConsulta && nextOpen && plano) {
          const planoId = String(id);
          if (!hydratedPlanIdsRef.current.has(planoId)) {
            hydrateFromPlano(plano, catalogoOptions);
            hydratedPlanIdsRef.current.add(planoId);
          }
        }
        return { ...prev, [id]: nextOpen };
      });
    },
    [catalogoOptions, hydrateFromPlano, isConsulta],
  );

  const handleCriarPlano = useCallback(async () => {
    setActionError('');
    try {
      const created = await criarPlano('');
      const id = created?.planejamentoId ?? created?.id;
      if (id) {
        const planoId = String(id);
        setExpandidos((prev) => ({ ...prev, [planoId]: true }));
        if (isConsulta) {
          initEmptyDraft(planoId);
          hydratedPlanIdsRef.current.add(planoId);
        }
      }
    } catch (e) {
      const detail = getApiErrorDetail(e) || e?.message || 'Não foi possível criar o plano.';
      if (e?.status === 409) {
        clearError();
        toast.error(detail || 'Este paciente já possui um plano ativo.');
        return;
      }
      setActionError(detail);
    }
  }, [clearError, criarPlano, initEmptyDraft, isConsulta, toast]);

  const handleSalvarPlano = useCallback(
    async (planoId) => {
      const id = String(planoId ?? '').trim();
      if (!id) return;

      const removedSnapshot = getRemovedSinceBaseline(id);
      setSavingPlanoId(id);
      setActionError('');

      try {
        const body = buildPutPayload(id);
        await salvarPlano(id, body);
        const detalhe = await planejamentosApi.detalhe(id);
        applyDetalhe(id, detalhe, catalogoOptions);
        hydratedPlanIdsRef.current.add(id);
        // refresh atualiza só planos (header); draft já veio do GET detalhe — não re-hidratar
        await refresh();
        carregarGaleria();
        carregarProcedimentosFeitos();
        toast.success('Plano salvo.');
      } catch (e) {
        if (e?.status === 409) {
          rollbackRemoved(id, removedSnapshot);
          toast.error(
            getApiErrorDetail(e) || 'Não foi possível remover item com agenda vinculada.',
          );
          return;
        }
        const detail = getApiErrorDetail(e) || e?.message || 'Erro ao salvar plano.';
        setActionError(detail);
        toast.error(detail);
      } finally {
        setSavingPlanoId('');
      }
    },
    [applyDetalhe, buildPutPayload, catalogoOptions, getRemovedSinceBaseline, refresh, rollbackRemoved, salvarPlano, toast],
  );

  const handleEncerrar = useCallback(
    async (planoId) => {
      setActionError('');
      try {
        await alterarStatusPlano(planoId, 'encerrado');
      } catch (e) {
        setActionError(getApiErrorDetail(e) || e?.message || 'Não foi possível encerrar o plano.');
      }
    },
    [alterarStatusPlano],
  );

  const openEncerrarModal = useCallback((planoId) => {
    setEncerrarModalPlanoId(planoId);
  }, []);

  const handleConfirmEncerrar = useCallback(() => {
    const id = encerrarModalPlanoId;
    setEncerrarModalPlanoId(null);
    if (id) handleEncerrar(id);
  }, [encerrarModalPlanoId, handleEncerrar]);

  const handleDarBaixa = useCallback(
    async (planoId, targetItemOrId) => {
      setActionError('');
      const pid = String(planoId ?? '').trim();
      let it = typeof targetItemOrId === 'object' ? targetItemOrId : null;
      let itemId = it?.id || (typeof targetItemOrId === 'string' ? targetItemOrId : null);

      // Se for item em rascunho sem UUID real no banco, salva o plano antes para gerar o UUID
      if (!isRealUuid(itemId) && pid) {
        try {
          await handleSalvarPlano(pid);
          const detalhe = await planejamentosApi.detalhe(pid);
          const targetCatId = String(it?.catalogoProcedimentoSaudeId || it?.catalogoId || '');
          const match = detalhe?.itens?.find(
            (i) =>
              String(i.catalogoProcedimentoSaudeId || i.catalogoId || '') === targetCatId &&
              i.statusCodigo !== 'concluido',
          );
          const realId = match?.planejamentoItemId || match?.id;
          if (realId) {
            itemId = realId;
            it = { ...match, id: realId, planejamentoItemId: realId };
          }
        } catch (err) {
          setActionError(getApiErrorDetail(err) || 'Salve o plano antes de realizar o procedimento.');
          return;
        }
      }

      if (!itemId) {
        setActionError('Não foi possível identificar o procedimento para conclusão.');
        return;
      }

      // Gatekeeper de Termos de Consentimento
      const planoAlvo = displayPlanos.find((p) => String(p.id) === pid);
      const itemAlvo = it || planoAlvo?.itens?.find((i) => String(i.id) === String(itemId));
      const catId = itemAlvo?.catalogoProcedimentoSaudeId || itemAlvo?.catalogoId;

      if (pacienteId && catId) {
        try {
          const resolucao = await termosApi.resolver({
            pacienteId,
            catalogoIds: [catId],
          });
          if (procedimentoBloqueadoPorTermos(resolucao)) {
            const faltantes = titulosFaltantes(resolucao);
            setTermoBloqueioModal({
              procedimentoNome: itemAlvo?.catalogoNome || 'Procedimento',
              termosFaltantes: faltantes,
            });
            return;
          }
        } catch (e) {
          console.warn('Não foi possível checar os termos de consentimento:', e);
        }
      }

      try {
        await darBaixaItem(pid, itemId);
        toast.success('Procedimento concluído com sucesso!');
        await refresh();
        carregarGaleria();
        carregarProcedimentosFeitos();
        onPlanoConcluido?.();
      } catch (e) {
        setActionError(getApiErrorDetail(e) || e?.message || 'Não foi possível dar baixa no item.');
      }
    },
    [darBaixaItem, displayPlanos, handleSalvarPlano, onPlanoConcluido, pacienteId, refresh, carregarGaleria, carregarProcedimentosFeitos, toast],
  );

  const handleIniciarAtendimentoItem = useCallback(
    (item, _plano) => {
      if (isConsulta) {
        onSelectProcedimentoParaConsulta?.(item);
        return;
      }
      if (typeof onStartAttendance !== 'function') return;
      const catId = String(item.catalogoProcedimentoSaudeId || item.catalogoId || '').trim();
      const nome = item.catalogoNome || 'Procedimento';
      const agendaId = item.sessaoAtiva?.agendaId || null;
      const data = item.sessaoAtiva?.dataAgendamento || null;
      const horaInicio = item.sessaoAtiva?.horaInicio || null;
      const planoItemId = item.id || item.planejamentoItemId || null;
      const pacienteAlvo = paciente || { id: pacienteId, nome: pacienteNome };

      const isItemRetorno = Boolean(
        item.isRetorno ||
        item.tipoProcedimentoCodigo === 'retorno' ||
        item.tipo === 'retorno'
      );

      onStartAttendance(pacienteAlvo, {
        agendaId,
        data,
        horaInicio,
        fromAgendaSlot: Boolean(agendaId),
        procedimentoNome: nome,
        catalogoProcedimentoSaudeId: catId,
        planejamentoItemId: planoItemId,
        tipoProcedimentoCodigo: isItemRetorno ? 'retorno' : (item.tipoProcedimentoCodigo || ''),
        isAgendaRetorno: isItemRetorno,
        lote: [
          {
            agendaId,
            procedimentoNome: nome,
            catalogoProcedimentoSaudeId: catId,
            planejamentoItemId: planoItemId,
          },
        ],
      });
    },
    [isConsulta, onSelectProcedimentoParaConsulta, onStartAttendance, paciente, pacienteId, pacienteNome],
  );

  const handleIniciarAtendimentoVisita = useCallback(
    (visita, _plano) => {
      if (isConsulta) {
        const primeiro = visita?.itens?.[0];
        if (primeiro) onSelectProcedimentoParaConsulta?.(primeiro);
        return;
      }
      if (typeof onStartAttendance !== 'function') return;
      const itens = (visita?.itens || []).filter(Boolean);
      if (itens.length === 0) return;

      const primeiro = itens[0];
      const catId = String(primeiro.catalogoProcedimentoSaudeId || primeiro.catalogoId || '').trim();
      const nome = primeiro.catalogoNome || 'Procedimento';
      const agendaId = primeiro.sessaoAtiva?.agendaId || null;
      const data = primeiro.sessaoAtiva?.dataAgendamento || null;
      const horaInicio = primeiro.sessaoAtiva?.horaInicio || null;
      const planoItemId = primeiro.id || primeiro.planejamentoItemId || null;
      const pacienteAlvo = paciente || { id: pacienteId, nome: pacienteNome };

      const lote = itens.map((it) => ({
        agendaId: it.sessaoAtiva?.agendaId || null,
        procedimentoNome: it.catalogoNome || 'Procedimento',
        catalogoProcedimentoSaudeId: String(it.catalogoProcedimentoSaudeId || it.catalogoId || '').trim(),
        planejamentoItemId: it.id || it.planejamentoItemId || null,
      }));

      const isVisitaRetorno = Boolean(
        visita.isRetornoVisita ||
        primeiro.isRetorno ||
        primeiro.tipoProcedimentoCodigo === 'retorno' ||
        primeiro.tipo === 'retorno'
      );

      onStartAttendance(pacienteAlvo, {
        agendaId,
        data,
        horaInicio,
        fromAgendaSlot: Boolean(agendaId),
        procedimentoNome: nome,
        catalogoProcedimentoSaudeId: catId,
        planejamentoItemId: planoItemId,
        tipoProcedimentoCodigo: isVisitaRetorno ? 'retorno' : (primeiro.tipoProcedimentoCodigo || ''),
        isAgendaRetorno: isVisitaRetorno,
        lote,
      });
    },
    [isConsulta, onSelectProcedimentoParaConsulta, onStartAttendance, paciente, pacienteId, pacienteNome],
  );

  const handleBatchIniciarAtendimento = useCallback(() => {
    if (selecionados.size === 0) return;
    const planoAtivo = displayPlanos[0];
    if (!planoAtivo) return;

    const itensParaIniciar = (planoAtivo.itens || []).filter((it) =>
      selecionados.has(String(it.id || it.tempId)),
    );
    if (itensParaIniciar.length === 0) return;

    if (isConsulta) {
      onSelectProcedimentoParaConsulta?.(itensParaIniciar[0]);
      limparSelecao();
      return;
    }
    if (typeof onStartAttendance !== 'function') return;

    const primeiro = itensParaIniciar[0];
    const catId = String(primeiro.catalogoProcedimentoSaudeId || primeiro.catalogoId || '').trim();
    const nome = primeiro.catalogoNome || 'Procedimento';
    const agendaId = primeiro.sessaoAtiva?.agendaId || null;
    const data = primeiro.sessaoAtiva?.dataAgendamento || null;
    const horaInicio = primeiro.sessaoAtiva?.horaInicio || null;
    const planoItemId = primeiro.id || primeiro.planejamentoItemId || null;
    const pacienteAlvo = paciente || { id: pacienteId, nome: pacienteNome };

    const lote = itensParaIniciar.map((it) => ({
      agendaId: it.sessaoAtiva?.agendaId || null,
      procedimentoNome: it.catalogoNome || 'Procedimento',
      catalogoProcedimentoSaudeId: String(it.catalogoProcedimentoSaudeId || it.catalogoId || '').trim(),
      planejamentoItemId: it.id || it.planejamentoItemId || null,
    }));

    onStartAttendance(pacienteAlvo, {
      agendaId,
      data,
      horaInicio,
      fromAgendaSlot: Boolean(agendaId),
      procedimentoNome: nome,
      catalogoProcedimentoSaudeId: catId,
      planejamentoItemId: planoItemId,
      tipoProcedimentoCodigo: primeiro.tipoProcedimentoCodigo || '',
      isAgendaRetorno: false,
      lote,
    });
    limparSelecao();
  }, [displayPlanos, isConsulta, limparSelecao, onSelectProcedimentoParaConsulta, onStartAttendance, paciente, pacienteId, pacienteNome, selecionados]);

  // Handler de Agendamento em Lote (+0, +1, +7, +15, +30 dias)
  const handleBatchAgendar = useCallback(
    async (diasOffset = 0) => {
      const planoAtivo = displayPlanos[0];
      if (!planoAtivo || selecionados.size === 0) return;

      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + diasOffset);
      const dataIso = toLocalDateIso(targetDate);

      const itensParaAgendar = (planoAtivo.itens || []).filter((it) =>
        selecionados.has(String(it.id || it.tempId)),
      );

      try {
        for (const item of itensParaAgendar) {
          updateItem(
            planoAtivo.id,
            itemReactKey(item),
            { dataPlanejada: dataIso },
            catalogoOptions,
          );
        }
        await handleSalvarPlano(planoAtivo.id);
        toast.success(`${itensParaAgendar.length} procedimentos agendados para ${targetDate.toLocaleDateString('pt-BR')}!`);
        limparSelecao();
      } catch (e) {
        setActionError(getApiErrorDetail(e) || e?.message || 'Erro ao agendar em lote.');
      }
    },
    [catalogoOptions, displayPlanos, handleSalvarPlano, limparSelecao, selecionados, toast, updateItem],
  );

  // Handler de Remoção em Lote
  const handleBatchRemover = useCallback(async () => {
    const planoAtivo = displayPlanos[0];
    if (!planoAtivo || selecionados.size === 0) return;

    const itensParaRemover = (planoAtivo.itens || []).filter((it) =>
      selecionados.has(String(it.id || it.tempId)),
    );

    try {
      for (const item of itensParaRemover) {
        if (isConsulta) {
          removeItem(planoAtivo.id, itemReactKey(item));
        } else {
          await removerItem(planoAtivo.id, item.id);
        }
      }
      toast.success(`${itensParaRemover.length} procedimentos removidos do plano.`);
      limparSelecao();
    } catch (e) {
      setActionError(getApiErrorDetail(e) || e?.message || 'Erro ao remover itens selecionados.');
    }
  }, [displayPlanos, isConsulta, limparSelecao, removeItem, removerItem, selecionados, toast]);

  const handleAgendarItem = useCallback(
    async (item, onSaved, planoId) => {
      const pid = String(planoId ?? '').trim();
      let targetItem = item;

      // Se o item for novo em rascunho (sem UUID), salva o plano primeiro para garantir o UUID
      if (!isRealUuid(targetItem?.id) && pid) {
        try {
          if (targetItem?.dataPlanejada) {
            updateItem(
              pid,
              itemReactKey(targetItem),
              { dataPlanejada: targetItem.dataPlanejada },
              catalogoOptions,
            );
          }
          await handleSalvarPlano(pid);
          const detalhe = await planejamentosApi.detalhe(pid);
          const targetCatId = String(targetItem.catalogoProcedimentoSaudeId || targetItem.catalogoId || '');
          const match = detalhe?.itens?.find(
            (it) => String(it.catalogoProcedimentoSaudeId || it.catalogoId || '') === targetCatId,
          );
          const realId = match?.planejamentoItemId || match?.id;
          if (match && realId) {
            targetItem = {
              ...targetItem,
              id: realId,
              planejamentoItemId: realId,
            };
          }
        } catch (e) {
          console.warn('Falha ao auto-salvar antes de agendar:', e);
        }
      }

      onAgendarItem?.(targetItem, async () => {
        await refresh();
        if (pid) {
          try {
            const detalhe = await planejamentosApi.detalhe(pid);
            applyDetalhe(pid, detalhe, catalogoOptions);
            hydratedPlanIdsRef.current.add(pid);
          } catch (e) {
            console.warn('Falha ao sincronizar plano após agendar:', e);
          }
        }
        onSaved?.();
      });
    },
    [applyDetalhe, catalogoOptions, handleSalvarPlano, onAgendarItem, refresh, updateItem],
  );

  const handleAgendarRetornoItem = useCallback(
    (item, onSaved, planoId) => {
      const pid = String(planoId ?? '').trim();
      onAgendarRetornoItem?.(item, async () => {
        await refresh();
        if (pid) {
          try {
            const detalhe = await planejamentosApi.detalhe(pid);
            applyDetalhe(pid, detalhe, catalogoOptions);
            hydratedPlanIdsRef.current.add(pid);
          } catch (e) {
            console.warn('Falha ao sincronizar plano após agendar retorno:', e);
          }
        }
        onSaved?.();
      });
    },
    [applyDetalhe, catalogoOptions, onAgendarRetornoItem, refresh],
  );

  const handleReagendarItem = useCallback(
    (item, plano, onSaved) => {
      const pid = String(plano?.id ?? displayPlanos?.[0]?.id ?? '').trim();
      onReagendarItem?.(item, plano, async () => {
        await refresh();
        if (pid) {
          try {
            const detalhe = await planejamentosApi.detalhe(pid);
            applyDetalhe(pid, detalhe, catalogoOptions);
            hydratedPlanIdsRef.current.add(pid);
          } catch (e) {
            console.warn('Falha ao sincronizar plano após reagendar:', e);
          }
        }
        onSaved?.();
      });
    },
    [applyDetalhe, catalogoOptions, displayPlanos, onReagendarItem, refresh],
  );

  const handleConcluirComRetorno = useCallback(
    (plano) => {
      onConcluirComRetorno?.(plano, refresh);
    },
    [onConcluirComRetorno, refresh],
  );

  const _openConcluirRetornoModal = useCallback(
    (plano) => {
      const planoDraft = getDraft(plano.id);
      const itens = planoDraft?.itens ?? plano.itens ?? [];
      const resumo = calcResumoProtocolo(itens);
      setConcluirRetornoModal({
        plano,
        totalItens: itens.length,
        valorTotal: plano.valorTotal ?? resumo.valorTotal,
      });
    },
    [getDraft],
  );

  const handleConfirmConcluirRetorno = useCallback(() => {
    const plano = concluirRetornoModal?.plano;
    if (!plano) return;
    setConcluirRetornoModal(null);
    handleConcluirComRetorno(plano);
  }, [concluirRetornoModal, handleConcluirComRetorno]);

  const handleEditItemSave = useCallback(
    (patch) => {
      if (!editItemState) return;
      const { planoId, itemKey: key } = editItemState;
      updateItem(planoId, key, patch, catalogoOptions);
      setEditItemState(null);
    },
    [catalogoOptions, editItemState, updateItem],
  );

  const displayError = actionError || error;

  const renderConsultaPlanosList = () => {
    if (displayPlanos.length === 0) {
      return (
        <div className="rounded-xl border border-dashed border-[#cbd5e1] bg-[#f8fbfb] px-4 py-10 text-center">
          <BookOpen className="mx-auto h-8 w-8 text-[#94a3b8]" strokeWidth={1.75} />
          <p className="mt-2 text-[14px] font-semibold text-[#475569]">
            {consultaSemPlanoAtivo ? 'Nenhum plano ativo' : 'Nenhum plano cadastrado'}
          </p>
          <p className="mt-1 text-[13px] text-[#94a3b8]">
            {consultaSemPlanoAtivo
              ? 'Este paciente possui planos encerrados ou concluídos. Crie um novo plano para o atendimento.'
              : 'Crie um plano e adicione procedimentos do catálogo.'}
          </p>
        </div>
      );
    }

    const planoAtivo = displayPlanos[0];
    const planoDraft = getDraft(planoAtivo?.id);
    const itensPlano = planoDraft?.itens || planoAtivo?.itens || [];
    const planoComDraft = {
      ...planoAtivo,
      itens: itensPlano,
      observacao: planoDraft?.observacao ?? planoAtivo?.observacao ?? '',
    };

    // Itens agendados futuros para o card de próxima visita
    const _hojeStr = new Date().toISOString().slice(0, 10);
    const itensComData = itensPlano.filter(
      (it) => it.dataPlanejada && it.statusCodigo !== 'concluido',
    );
    itensComData.sort((a, b) =>
      String(a.dataPlanejada).localeCompare(String(b.dataPlanejada)),
    );
    const proximoItem = itensComData[0] || null;
    const itensProximaData = proximoItem
      ? itensComData.filter((it) => it.dataPlanejada === proximoItem.dataPlanejada)
      : [];

    // Cálculo dos valores discriminados
    const valorRealizado = itensPlano
      .filter((it) => it.statusCodigo === 'concluido')
      .reduce((acc, it) => acc + (Number(it.valorOrcado) || 0), 0);
    const valorAgendado = itensPlano
      .filter((it) => it.statusCodigo !== 'concluido' && it.dataPlanejada)
      .reduce((acc, it) => acc + (Number(it.valorOrcado) || 0), 0);
    const valorSemData = itensPlano
      .filter((it) => it.statusCodigo !== 'concluido' && !it.dataPlanejada)
      .reduce((acc, it) => acc + (Number(it.valorOrcado) || 0), 0);
    const valorTotalGeral = valorRealizado + valorAgendado + valorSemData;

    // Tempo de cadeira da próxima visita
    const tempoProximaVisitaMin = itensProximaData.reduce((acc, it) => {
      const cat = catalogoOptions.find(
        (c) => String(c.id) === String(it.catalogoProcedimentoSaudeId || it.catalogoId),
      );
      return acc + (Number(cat?.duracaoMinutos || cat?.duracaoPadraoMinutos) || 30);
    }, 0);

    // Formatação de data e idade do paciente
    const rawDataCadastro =
      pacienteData?.createdAt ||
      pacienteData?.criadoEm ||
      pacienteData?.dataCadastro ||
      paciente?.createdAt ||
      paciente?.criadoEm;
    const dataCadastroFormatada = rawDataCadastro
      ? new Date(rawDataCadastro).toLocaleDateString('pt-BR', {
        month: 'short',
        year: 'numeric',
      })
      : null;

    const rawDataNasc = pacienteData?.dataNascimento || paciente?.dataNascimento;
    const rawIdade = pacienteData?.idade ?? paciente?.idade;
    const idadeCalculada = rawDataNasc ? calculateAgeFromISODate(rawDataNasc) : '';
    const idadeFinal =
      rawIdade != null && rawIdade !== ''
        ? rawIdade
        : idadeCalculada !== ''
          ? idadeCalculada
          : null;
    const idadeDisplay = idadeFinal != null ? `${idadeFinal} anos` : 'Idade ñ informada';

    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ── COLUNA PRINCIPAL (8 COLUNAS) ── */}
        <div className="lg:col-span-8 space-y-4">
          {/* BARRA DE PROTOCOLO RESUMO MULTI-SEGMENTO */}
          <PlanoProtocoloResumo
            itens={itensPlano}
            plano={planoComDraft}
            catalogoOptions={catalogoOptions}
          />

          {/* OBSERVAÇÕES CLÍNICAS INLINE COM STATUS SALVO AUTOMÁTICO */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-2xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                Observações Clínicas do Plano
              </span>
              <span className="text-[11px] font-medium text-emerald-600 flex items-center gap-1">
                <Check className="h-3 w-3" />
                <span>Salvo</span>
              </span>
            </div>
            <textarea
              rows={2}
              value={planoDraft?.observacao ?? planoAtivo?.observacao ?? ''}
              onChange={(e) => setObservacao(planoAtivo.id, e.target.value)}
              placeholder="Ex: Paciente sensível na região dos lábios, aplicar anestésico tópico 20 min antes…"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2 text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:border-[#00a88e] focus:bg-white transition-all resize-none"
            />
          </div>

          {/* CRONOGRAMA DE VISITAS (TIMELINE V6: BLOCO 1 SEM DATA + BLOCO 2 VISITAS) */}
          <PlanoVisitasTimeline
            plano={planoComDraft}
            pacienteId={pacienteId}
            fotosDoPlano={fotosPorPlanoId[String(planoAtivo?.id)] || []}
            fotosPorPlanejamentoItemId={fotosPorPlanejamentoItemId}
            canCrud={canCrud}
            canBaixa={canBaixa}
            canReagendar={canReagendar}
            canAgendar={canAgendar}
            mutating={mutating}
            onAgendarItem={handleAgendarItem}
            onAgendarRetornoItem={handleAgendarRetornoItem}
            onReagendarItem={handleReagendarItem}
            onIniciarAtendimentoItem={handleIniciarAtendimentoItem}
            onIniciarAtendimentoVisita={handleIniciarAtendimentoVisita}
            onDarBaixa={handleDarBaixa}
            onEdit={(item) =>
              setEditItemState({
                planoId: planoAtivo.id,
                itemKey: itemReactKey(item),
                item,
              })
            }
            onRemover={async (targetItem, maybeItemId) => {
              setActionError('');
              const it = typeof targetItem === 'object' ? targetItem : null;
              const itemId = it?.id || (typeof targetItem === 'string' ? targetItem : maybeItemId);
              const itemKey = it ? itemReactKey(it) : String(itemId);
              try {
                if (isConsulta) {
                  if (!isRealUuid(itemId)) {
                    removeItem(planoAtivo.id, itemKey);
                    toast.success('Procedimento removido.');
                    return;
                  }
                  await removerItem(planoAtivo.id, itemId);
                  removeItem(planoAtivo.id, itemKey);
                } else {
                  await removerItem(planoAtivo.id, itemId);
                }
                toast.success('Procedimento removido.');
              } catch (e) {
                setActionError(
                  getApiErrorDetail(e) || e?.message || 'Não foi possível remover o item.',
                );
              }
            }}
            catalogoOptions={catalogoOptions}
            selecionados={selecionados}
            onToggleSelecao={toggleSelecao}
            termosFaltantes={termosFaltantes}
            procedimentosFeitos={procedimentosFeitos}
          />
        </div>

        {/* ── SIDEBAR DIREITA (4 COLUNAS) ── */}
        <div className="lg:col-span-4 space-y-4">
          {/* CARD 1: PERFIL RESUMIDO DO PACIENTE */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-[#00a88e] font-bold text-sm border border-teal-100">
                {pacienteNome ? pacienteNome.slice(0, 2).toUpperCase() : <User className="h-5 w-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-bold text-slate-800 truncate">
                  {pacienteNome || 'Paciente'}
                </h4>
                <p className="text-[11px] text-slate-400 font-medium">
                  {idadeDisplay}
                  {dataCadastroFormatada ? ` · Desde ${dataCadastroFormatada}` : ''}
                </p>
              </div>
            </div>
          </div>

          {/* CARD 2: PRÓXIMA VISITA */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                Próxima Visita
              </span>
              {proximoItem ? (
                <span className="rounded-md bg-teal-50 px-2 py-0.5 text-[10px] font-bold text-[#00a88e] border border-teal-100">
                  Agendada
                </span>
              ) : (
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                  Sem data
                </span>
              )}
            </div>

            {proximoItem ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-[#00a88e]" />
                  <span className="text-xs font-bold text-slate-800">
                    {new Date(String(proximoItem.dataPlanejada).slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'long',
                    })}
                  </span>
                </div>

                <div className="rounded-xl bg-slate-50 p-2.5 space-y-1.5 border border-slate-100">
                  <p className="text-xs font-semibold text-slate-700">
                    {itensProximaData.map((it) => it.catalogoNome).join(' + ')}
                  </p>
                  <div className="flex items-center gap-3 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-slate-400" />
                      {tempoProximaVisitaMin} min de cadeira
                    </span>
                    <span className="font-mono font-medium text-slate-600">
                      {formatValorBrl(
                        itensProximaData.reduce((acc, it) => acc + (Number(it.valorOrcado) || 0), 0),
                      )}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-3 text-center">
                <p className="text-xs text-slate-500">Nenhum agendamento futuro no plano.</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Arraste ou agende procedimentos pela barra inferior.
                </p>
              </div>
            )}
          </div>

          {/* CARD 3: DISCRIMINATIVO DE VALORES */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
              Discriminação de Valores
            </span>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Já realizado
                </span>
                <span className="font-mono font-medium text-slate-700">
                  {formatValorBrl(valorRealizado)}
                </span>
              </div>

              <div className="flex items-center justify-between text-slate-600">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-teal-500" />
                  Agendado
                </span>
                <span className="font-mono font-medium text-slate-700">
                  {formatValorBrl(valorAgendado)}
                </span>
              </div>

              <div className="flex items-center justify-between text-slate-600">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-slate-300" />
                  Sem data
                </span>
                <span className="font-mono font-medium text-slate-700">
                  {formatValorBrl(valorSemData)}
                </span>
              </div>

              <div className="pt-2 border-t border-slate-200 flex items-center justify-between font-bold text-slate-900">
                <span>TOTAL DO PLANO</span>
                <span className="font-mono text-sm text-[#00a88e]">
                  {formatValorBrl(valorTotalGeral)}
                </span>
              </div>
            </div>
          </div>

          {/* CARD 4: HISTÓRICO RECENTE DO PACIENTE */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
              Histórico Clínico Recente
            </span>

            {procedimentosFeitos.length > 0 ? (
              <div className="space-y-2">
                {procedimentosFeitos.slice(0, 4).map((proc, idx) => (
                  <div key={idx} className="flex items-start justify-between gap-2 text-xs">
                    <span className="font-medium text-slate-700 truncate">
                      {proc.nomeProcedimento || proc.nome || 'Procedimento'}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono shrink-0">
                      {proc.dataRealizacao
                        ? new Date(proc.dataRealizacao).toLocaleDateString('pt-BR')
                        : 'Realizado'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">
                Nenhum procedimento anterior registrado.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderProfilePlanosList = () => {
    const showAvulsosOnly = filtroStatus === 'avulsos';

    return (
      <div className="space-y-4">
        {/* BARRA DE FILTRO POR PÍLULAS NO ESTILO DO PRONTUÁRIO */}
        <div className="flex items-center justify-between flex-wrap gap-2 pt-1 pb-1">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setFiltroStatus('todos')}
              className={`px-2.5 py-0.5 rounded-full text-xs transition-all ${filtroStatus === 'todos'
                ? 'font-bold bg-[#00a88e] text-white shadow-2xs'
                : 'font-semibold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
            >
              Todos {sortedPlanos.length}
            </button>
            <button
              type="button"
              onClick={() => setFiltroStatus('ativo')}
              className={`px-2.5 py-0.5 rounded-full text-xs transition-all ${filtroStatus === 'ativo'
                ? 'font-bold bg-[#00a88e] text-white shadow-2xs'
                : 'font-semibold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
            >
              Em Andamento {planosAtivos.length}
            </button>
            <button
              type="button"
              onClick={() => setFiltroStatus('concluido')}
              className={`px-2.5 py-0.5 rounded-full text-xs transition-all ${filtroStatus === 'concluido'
                ? 'font-bold bg-[#00a88e] text-white shadow-2xs'
                : 'font-semibold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
            >
              Concluídos {planosHistorico.length}
            </button>
            <button
              type="button"
              onClick={() => setFiltroStatus('avulsos')}
              className={`px-2.5 py-0.5 rounded-full text-xs transition-all ${filtroStatus === 'avulsos'
                ? 'font-bold bg-purple-600 text-white shadow-2xs'
                : 'font-semibold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
            >
              Pasta Avulsos {atendimentosAvulsos.length}
            </button>
          </div>
        </div>

        {/* LISTA DE PLANOS */}
        {!showAvulsosOnly && (
          <div className="space-y-3.5">
            {planosFiltradosPorPill.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 bg-teal-50/20 px-4 py-8 text-center">
                <BookOpen className="mx-auto h-6 w-6 text-slate-400" />
                <p className="mt-1.5 text-xs font-semibold text-slate-700">
                  Nenhum plano encontrado neste filtro.
                </p>
              </div>
            ) : (
              planosFiltradosPorPill.map((plano) => {
                const isAtivo = plano.statusCodigo === 'ativo';
                const isExpandido = expandidos[plano.id] !== undefined ? expandidos[plano.id] : isAtivo;
                const statusUi = getPlanoStatusPresentation(plano.statusCodigo, plano.statusNome);
                const itens = Array.isArray(plano.itens) ? plano.itens : [];
                const fotosPlano = fotosPorPlanoId[String(plano.id)] || [];

                return (
                  <div
                    key={plano.id}
                    className={`bg-white rounded-lg border border-slate-200 shadow-2xs transition-all ${isAtivo ? 'border-l-4 border-l-[#00a88e]' : 'border-l-4 border-l-slate-400'
                      }`}
                  >
                    {/* CABEÇALHO DO PLANO */}
                    <div
                      onClick={() => toggleExpandido(plano.id, plano)}
                      className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white cursor-pointer hover:bg-slate-50/50 transition-colors select-none rounded-t-lg"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
                          <Calendar className={`w-3 h-3 ${isAtivo ? 'text-[#00a88e]' : 'text-slate-400'}`} />
                          <span>
                            {plano.criadoEm ? `Iniciado em ${formatDataPt(plano.criadoEm)}` : 'Plano de Tratamento'}
                          </span>
                          <span className={`px-1 py-0.2 rounded font-bold text-[9px] ${isAtivo ? 'bg-teal-50 text-teal-700' : 'bg-slate-100 text-slate-600'}`}>
                            #{String(plano.id).slice(0, 6).toUpperCase()}
                          </span>
                        </div>

                        <h3 className="text-sm font-bold text-slate-900">
                          {plano.observacao || 'Protocolo de Tratamento Facial / Corporal'}
                        </h3>

                        <div className="flex items-center gap-2 text-[11px] text-slate-500">
                          <span>{itens.length} {itens.length === 1 ? 'Procedimento' : 'Procedimentos'}</span>
                          <span className="text-slate-300">·</span>
                          <span className="font-bold text-slate-700">{formatValorBrl(plano.valorTotal)}</span>
                          {fotosPlano.length > 0 && (
                            <>
                              <span className="text-slate-300">·</span>
                              <span className="text-teal-700 font-medium">{fotosPlano.length} foto(s)</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${isAtivo ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-700 border border-slate-300'
                          }`}>
                          {statusUi.label || (isAtivo ? 'EM ANDAMENTO' : 'FINALIZADO')}
                        </span>

                        {isAtivo && (
                          <div className="relative">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPlanoMenuAbertoId((prev) => (prev === plano.id ? null : plano.id));
                              }}
                              className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                              title="Mais opções do plano"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            {planoMenuAbertoId === plano.id && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="absolute right-0 top-7 z-50 w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-100"
                              >
                                <button
                                  type="button"
                                  disabled={mutating}
                                  onClick={() => {
                                    setPlanoMenuAbertoId(null);
                                    openEncerrarModal(plano.id);
                                  }}
                                  className="w-full text-left px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors flex items-center gap-2"
                                >
                                  <XCircle className="w-4 h-4" />
                                  <span>Encerrar Plano (Desistência)</span>
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="p-1 rounded-md text-slate-400">
                          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpandido ? 'rotate-180 text-slate-700' : ''}`} />
                        </div>
                      </div>
                    </div>

                    {/* CORPO EXPANSÍVEL: VISITAS & FOTOS */}
                    {isExpandido && (
                      <div className="p-3.5 bg-slate-50/40 border-t border-slate-100 space-y-3">
                        <PlanoVisitasTimeline
                          plano={plano}
                          pacienteId={pacienteId}
                          fotosDoPlano={fotosPlano}
                          fotosPorPlanejamentoItemId={fotosPorPlanejamentoItemId}
                          canCrud={canCrud}
                          canBaixa={canBaixa}
                          canReagendar={canReagendar}
                          canAgendar={canAgendar}
                          mutating={mutating}
                          onAgendarItem={handleAgendarItem}
                          onAgendarRetornoItem={handleAgendarRetornoItem}
                          onReagendarItem={handleReagendarItem}
                          onIniciarAtendimentoItem={handleIniciarAtendimentoItem}
                          onIniciarAtendimentoVisita={handleIniciarAtendimentoVisita}
                          onDarBaixa={handleDarBaixa}
                          catalogoOptions={catalogoOptions}
                          selecionados={selecionados}
                          onToggleSelecao={toggleSelecao}
                          procedimentosFeitos={procedimentosFeitos}
                          onEdit={(item) =>
                            setEditItemState({
                              planoId: plano.id,
                              itemKey: itemReactKey(item),
                              item,
                            })
                          }
                          onRemover={async (pid, iid) => {
                            setActionError('');
                            try {
                              await removerItem(pid, iid);
                            } catch (e) {
                              setActionError(getApiErrorDetail(e) || e?.message || 'Não foi possível remover o item.');
                            }
                          }}
                        />
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* PASTA DE ATENDIMENTOS AVULSOS */}
        {(filtroStatus === 'todos' || filtroStatus === 'avulsos') && (
          <PastaAtendimentosAvulsos
            pacienteId={pacienteId}
            atendimentosAvulsos={atendimentosAvulsos}
            fotosAvulsas={fotosAvulsas}
          />
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {variant === 'consulta' ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[18px] font-bold text-[#0f172a] sm:text-[20px]">Planejamento</h2>
          {typeof onVoltar === 'function' ? (
            <button
              type="button"
              onClick={onVoltar}
              className="rounded-xl border border-app-border bg-white px-4 py-2.5 text-[13px] font-semibold text-[#64748b] transition-colors hover:bg-app-nav-hover"
            >
              Voltar ao hub
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        {variant !== 'consulta' ? (
          <h3 className="text-[15px] font-bold text-[#0f172a]">Planos de tratamento</h3>
        ) : null}
        {canCrud ? (
          <button
            type="button"
            disabled={mutating || !pacienteId}
            onClick={handleCriarPlano}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#00a88e] px-3 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-[#00967f] disabled:opacity-60"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            Novo plano
          </button>
        ) : null}
      </div>

      {/* ── BARRA DE BUSCA RÁPIDA (ATALHO "/") + TOP 5 CHIPS FAVORITOS ── */}
      {canCrud && displayPlanos.length > 0 && (
        <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xs">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={buscaProcedimento}
              onChange={(e) => setBuscaProcedimento(e.target.value)}
              placeholder="Buscar procedimento no catálogo ou digite / para atalho…"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-12 text-xs font-medium text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-[#00a88e] focus:bg-white focus:ring-2 focus:ring-[#00a88e]/10"
            />
            <div className="absolute right-2.5 top-2 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-mono text-slate-400">
              /
            </div>
          </div>

          {/* CHIPS DOS TOP 5 PROCEDIMENTOS MAIS COMUNS */}
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span className="text-[11px] font-bold text-slate-400 mr-1">Rápidos:</span>
            {catalogoOptions.slice(0, 5).map((opt) => {
              const planoAtivoId = displayPlanos[0]?.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={mutating || !planoAtivoId}
                  onClick={() => {
                    if (planoAtivoId) {
                      addItem(
                        planoAtivoId,
                        {
                          catalogoProcedimentoSaudeId: String(opt.id),
                          catalogoNome: opt.nomeProcedimento,
                          tipoCodigo: opt.tipoCodigo ?? '',
                          valorOrcado: opt.valorPadrao ?? opt.valorBase ?? 0,
                        },
                        catalogoOptions,
                      );
                      toast.success(`"${opt.nomeProcedimento}" adicionado ao plano!`);
                    }
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-teal-50 hover:border-[#00a88e] hover:text-[#00a88e] px-2 py-1 text-[11px] font-medium text-slate-600 transition-all active:scale-95"
                >
                  <Plus className="h-3 w-3" />
                  <span>{opt.nomeProcedimento}</span>
                </button>
              );
            })}
          </div>

          {/* LISTA FILTRADA DE BUSCA SE HOUVER TEXTO */}
          {buscaProcedimento.trim() && (
            <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-md space-y-0.5">
              {catalogoOptions
                .filter((opt) =>
                  String(opt.nomeProcedimento || '')
                    .toLowerCase()
                    .includes(buscaProcedimento.toLowerCase()),
                )
                .slice(0, 8)
                .map((opt) => {
                  const planoAtivoId = displayPlanos[0]?.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={mutating || !planoAtivoId}
                      onClick={() => {
                        if (planoAtivoId) {
                          addItem(
                            planoAtivoId,
                            {
                              catalogoProcedimentoSaudeId: String(opt.id),
                              catalogoNome: opt.nomeProcedimento,
                              tipoCodigo: opt.tipoCodigo ?? '',
                              valorOrcado: opt.valorPadrao ?? opt.valorBase ?? 0,
                            },
                            catalogoOptions,
                          );
                          setBuscaProcedimento('');
                          toast.success(`"${opt.nomeProcedimento}" adicionado ao plano!`);
                        }
                      }}
                      className="w-full flex items-center justify-between rounded-lg p-2 text-left text-xs font-semibold text-slate-700 hover:bg-teal-50 hover:text-[#00a88e] transition-colors"
                    >
                      <span>{opt.nomeProcedimento}</span>
                      <span className="text-[11px] font-mono text-slate-400">
                        {formatValorBrl(opt.valorPadrao ?? opt.valorBase)}
                      </span>
                    </button>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {displayError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] text-rose-700">
          {displayError}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-[#64748b]">
          <Loader2 className="h-5 w-5 animate-spin text-[#00a88e]" />
          <span className="text-[13px] font-medium">Carregando planos…</span>
        </div>
      ) : isConsulta ? (
        renderConsultaPlanosList()
      ) : (
        renderProfilePlanosList()
      )}

      <PlanoItemEditModal
        open={Boolean(editItemState)}
        item={editItemState?.item}
        catalogoOptions={catalogoOptions}
        catalogoLoading={catalogoLoading}
        mutating={mutating || Boolean(savingPlanoId)}
        onClose={() => setEditItemState(null)}
        onSave={handleEditItemSave}
      />

      <PlanoConcluirRetornoConfirmModal
        open={Boolean(concluirRetornoModal)}
        plano={concluirRetornoModal?.plano}
        pacienteNome={pacienteNome}
        totalItens={concluirRetornoModal?.totalItens}
        valorTotal={concluirRetornoModal?.valorTotal}
        onCancel={() => setConcluirRetornoModal(null)}
        onConfirm={handleConfirmConcluirRetorno}
      />

      <PlanoEncerrarConfirmModal
        open={Boolean(encerrarModalPlanoId)}
        onCancel={() => setEncerrarModalPlanoId(null)}
        onConfirm={handleConfirmEncerrar}
      />

      {/* ── BARRA FLUTUANTE INFERIOR DE AÇÕES EM LOTE ── */}
      {selecionados.size > 0 && (
        <div className="fixed bottom-4 inset-x-4 max-w-2xl mx-auto z-50 animate-agenda-rise">
          <div className="rounded-2xl border border-slate-700 bg-slate-900/95 p-3.5 shadow-2xl backdrop-blur-md text-white flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#00a88e] text-xs font-bold text-white">
                {selecionados.size}
              </span>
              <span className="text-xs font-semibold text-slate-200">
                selecionado{selecionados.size > 1 ? 's' : ''}
              </span>
            </div>

            <div className="flex items-center gap-2 relative">
              {/* BOTÃO COM POPOVER: AGENDAR JUNTOS */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setPopoverAgendarAberto((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs font-bold text-slate-100 transition-all shadow-sm"
                >
                  <Calendar className="h-3.5 w-3.5 text-teal-400" />
                  <span>Agendar juntos</span>
                </button>

                {popoverAgendarAberto && (
                  <div className="absolute bottom-full mb-2 left-0 w-44 rounded-xl border border-slate-700 bg-slate-900 p-1.5 shadow-xl text-xs space-y-1 z-50">
                    <div className="px-2 py-1 text-[10px] font-bold uppercase text-slate-400">
                      Definir data:
                    </div>
                    <button
                      type="button"
                      onClick={() => handleBatchAgendar(0)}
                      className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-slate-800 text-slate-200 transition-colors"
                    >
                      Para hoje (+0 dias)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBatchAgendar(1)}
                      className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-slate-800 text-slate-200 transition-colors"
                    >
                      Para amanhã (+1 dia)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBatchAgendar(7)}
                      className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-slate-800 text-slate-200 transition-colors"
                    >
                      Em 1 semana (+7 dias)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBatchAgendar(15)}
                      className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-slate-800 text-slate-200 transition-colors"
                    >
                      Em 15 dias (+15 dias)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBatchAgendar(30)}
                      className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-slate-800 text-slate-200 transition-colors"
                    >
                      Em 1 mês (+30 dias)
                    </button>
                  </div>
                )}
              </div>

              {/* BOTÃO: INICIAR SELECIONADOS */}
              {canBaixa && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleBatchIniciarAtendimento();
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#00a88e] hover:bg-[#008f79] px-3.5 py-1.5 text-xs font-bold text-white transition-all shadow-sm"
                >
                  <Zap className="h-3.5 w-3.5" />
                  <span>Iniciar selecionados</span>
                </button>
              )}

              {/* BOTÃO: REMOVER DO PLANO */}
              <button
                type="button"
                onClick={handleBatchRemover}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-800/80 bg-rose-950/60 hover:bg-rose-900 px-2.5 py-1.5 text-xs font-bold text-rose-300 transition-all shadow-sm"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="sr-only sm:not-sr-only">Remover</span>
              </button>

              {/* BOTÃO: LIMPAR SELEÇÃO */}
              <button
                type="button"
                onClick={limparSelecao}
                className="p-1.5 text-slate-400 hover:text-white transition-colors"
                title="Desmarcar todos"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL DE BLOQUEIO CLÍNICO POR TERMOS NÃO ASSINADOS ── */}
      {termoBloqueioModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs animate-agenda-rise">
          <div className="w-full max-w-md rounded-2xl border border-amber-200 bg-white p-5 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-bold text-slate-900">
                  Termo de Consentimento Obrigatório Pendente
                </h4>
                <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                  O procedimento <strong className="text-slate-800">{termoBloqueioModal.procedimentoNome}</strong> requer a assinatura prévia do termo de consentimento livre e esclarecido pelo paciente antes de ser realizado.
                </p>
              </div>
            </div>

            {termoBloqueioModal.termosFaltantes?.length > 0 && (
              <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-3 space-y-1">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800">
                  Termo(s) Exigido(s):
                </span>
                <ul className="list-disc pl-4 text-xs text-amber-900 font-medium space-y-0.5">
                  {termoBloqueioModal.termosFaltantes.map((t, idx) => (
                    <li key={idx}>{t}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setTermoBloqueioModal(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Entendido, voltar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
