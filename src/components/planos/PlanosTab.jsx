import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Calendar,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Loader2,
  Plus,
  Save,
  Trash2,
  XCircle,
} from 'lucide-react';
import { ProcedimentoSearchInput } from '../agenda/ProcedimentoSearchInput.jsx';
import { useProcedimentosOptions } from '../../hooks/useProcedimentosOptions.js';
import { useToast } from '../../contexts/useToast.js';
import { getApiErrorDetail, planejamentosApi } from '../../services/api.js';
import { enriquecerPlanosComCatalogo } from '../../utils/planejamentoNormalize.js';
import { sortItensPorData, calcResumoProtocolo, parseValorBrlInput } from '../../utils/planejamentoDraftUtils.js';
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
import { PlanoItemIntervalo } from './PlanoItemIntervalo.jsx';
import { PlanoProtocoloResumo } from './PlanoProtocoloResumo.jsx';
import { PlanoItemEditModal } from './PlanoItemEditModal.jsx';
import { PlanoConcluirRetornoConfirmModal } from './PlanoConcluirRetornoConfirmModal.jsx';
import { PlanoEncerrarConfirmModal } from './PlanoEncerrarConfirmModal.jsx';
import { ValorOrcadoInput } from './ValorOrcadoInput.jsx';

function formatValorBrl(val) {
  if (val == null || val === '') return '—';
  const n = Number(val);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDataPt(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
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
  onDarBaixa,
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
                    () => {},
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
            onClick={() => onReagendarItem?.(item, plano, () => {})}
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
            title="Marcar procedimento como concluído"
            onClick={() => onDarBaixa?.(plano.id, item.id)}
            className="inline-flex items-center gap-1.5 rounded-lg border-[2px] border-[#00a88e]/30 bg-[#e6f7f5] px-2.5 py-1.5 text-[11px] font-bold text-[#0f766e] transition-colors hover:bg-[#d2f3ee] disabled:opacity-60"
          >
            <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2.2} />
            Dar baixa
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
  onDarBaixa,
  onEditItem,
  onRemoverItem,
}) {
  const sorted = sortItensPorData(itens);
  const nodes = [];

  sorted.forEach((item, index) => {
    if (index > 0) {
      const prev = sorted[index - 1];
      if (prev.dataPlanejada && item.dataPlanejada) {
        nodes.push(
          <PlanoItemIntervalo
            key={`interval-${itemReactKey(item)}`}
            dataAnterior={prev.dataPlanejada}
            dataAtual={item.dataPlanejada}
          />,
        );
      }
    }
    nodes.push(
      <PlanoItemCard
        key={itemReactKey(item)}
        item={item}
        plano={plano}
        canCrud={canCrud}
        canBaixa={canBaixa}
        canReagendar={canReagendar}
        canAgendar={canAgendar}
        mutating={mutating}
        onAgendarItem={onAgendarItem}
        onAgendarRetornoItem={onAgendarRetornoItem}
        onReagendarItem={onReagendarItem}
        onDarBaixa={onDarBaixa}
        onEdit={onEditItem}
        onRemover={onRemoverItem}
        entranceDelayMs={index * 40}
      />,
    );
  });

  return nodes;
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
}) {
  const statusUi = getPlanoStatusPresentation(plano.statusCodigo, plano.statusNome);
  const isAtivo = plano.statusCodigo === 'ativo';
  const itens = isConsultaDraft ? (draftItens ?? []) : plano.itens;

  return (
    <div
      className="overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-app-card animate-agenda-rise"
      style={cardEntranceDelayMs != null ? { animationDelay: `${cardEntranceDelayMs}ms` } : undefined}
    >
      <div
        className="flex cursor-pointer select-none items-center justify-between p-4 transition-colors hover:bg-[#f8fafc]"
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
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <BookOpen className="h-4 w-4 shrink-0 text-[#00a88e]" strokeWidth={2} />
            <span className="text-[14px] font-bold text-[#0f172a]">Plano de tratamento</span>
            <span
              className={`rounded-md border-[2px] px-2 py-0.5 text-[11px] font-bold ${statusUi.pillClass}`}
            >
              {statusUi.label}
            </span>
          </div>
          <div className="mt-1 text-[12px] text-[#64748b]">
            {itens.length} item{itens.length !== 1 ? 's' : ''}
            {plano.valorTotal != null ? ` · ${formatValorBrl(plano.valorTotal)}` : ''}
            {plano.criadoEm ? ` · ${formatDataPt(plano.criadoEm)}` : ''}
          </div>
          <ProgressBar progresso={plano.progresso} />
        </div>
        <div className="ml-3 flex shrink-0 items-center gap-2">
          <span className="hidden text-[11px] font-medium text-[#94a3b8] sm:inline">
            {expandido ? 'Recolher' : 'Ver itens'}
          </span>
          <ChevronDown
            className={`h-4 w-4 text-[#94a3b8] transition-transform duration-200 ${
              expandido ? 'rotate-180' : ''
            }`}
            strokeWidth={2}
          />
        </div>
      </div>

      {expandido ? (
        <div className="space-y-2 border-t border-[#e2e8f0] px-4 pb-4 pt-3 animate-agenda-rise">
          {isConsultaDraft && isAtivo ? (
            <textarea
              value={draftObservacao ?? ''}
              disabled={mutating || saving}
              onChange={(e) => onObservacaoChange?.(plano.id, e.target.value)}
              placeholder="Observações do plano…"
              rows={2}
              className="w-full resize-y rounded-xl border border-slate-200 bg-[#f8fbfb] px-3 py-2 text-[13px] text-[#475569] outline-none focus:border-[#00a88e] focus:ring-2 focus:ring-[#00a88e]/10"
            />
          ) : plano.observacao ? (
            <p className="rounded-lg bg-[#f8fbfb] px-3 py-2 text-[13px] text-[#475569]">
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
                onDarBaixa,
                onEditItem,
                onRemoverItem: onRemoverDraftItem,
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
                  onDarBaixa={onDarBaixa}
                  onRemover={onRemoverItem}
                />
              ))}
            </div>
          )}

          {canCrud && isAtivo ? addItemForm(plano.id) : null}

          {isConsultaDraft && itens.length > 0 ? (
            <PlanoProtocoloResumo itens={itens} plano={plano} />
          ) : null}

          {isConsultaDraft && isAtivo ? (
            <div
              className={`flex flex-wrap items-center justify-between gap-3 rounded-xl px-3 py-2.5 ${
                isDirty ? 'bg-brand-primaryGhost' : 'bg-ink-50'
              }`}
            >
              <p
                className={`text-[12px] font-medium ${
                  isDirty ? 'text-brand-primaryDark' : 'text-ink-500'
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
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-semibold transition-colors disabled:cursor-not-allowed ${
                  isDirty
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
          className={`h-5 w-5 shrink-0 ${
            plano.statusCodigo === 'concluido' ? 'text-brand-primary' : 'text-ink-400'
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
          className={`h-4 w-4 shrink-0 text-ink-400 transition-transform duration-200 ${
            expandido ? 'rotate-180' : ''
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
  roleUserId,
  pacienteNome,
  onAgendarItem,
  onAgendarRetornoItem,
  onReagendarItem,
  onConcluirComRetorno,
  variant = 'profile',
  onVoltar,
}) {
  const isConsulta = variant === 'consulta';
  const canCrud = isConsulta;
  const canBaixa = !isConsulta;
  const canReagendar = !isConsulta;
  const canAgendar = isConsulta;
  const canConcluirRetorno = isConsulta;

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
    isDirty,
    buildPutPayload,
    getRemovedSinceBaseline,
    applyDetalhe,
    rollbackRemoved,
  } = usePlanoDraft();
  const hydratedPlanIdsRef = useRef(new Set());
  const toast = useToast();
  const { options: catalogoOptions, loading: catalogoLoading } = useProcedimentosOptions();
  const [expandidos, setExpandidos] = useState({});
  const [novoItemPorPlano, setNovoItemPorPlano] = useState({});
  const [actionError, setActionError] = useState('');
  const [savingPlanoId, setSavingPlanoId] = useState('');
  const [editItemState, setEditItemState] = useState(null);
  const [concluirRetornoModal, setConcluirRetornoModal] = useState(null);
  const [encerrarModalPlanoId, setEncerrarModalPlanoId] = useState(null);

  const procedimentoSearchOptions = useMemo(
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

  const consultaSemPlanoAtivo = isConsulta && planosEnriquecidos.length > 0 && displayPlanos.length === 0;

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

  const handleConcluir = useCallback(
    async (planoId) => {
      setActionError('');
      try {
        await alterarStatusPlano(planoId, 'concluido');
      } catch (e) {
        setActionError(getApiErrorDetail(e) || e?.message || 'Não foi possível concluir o plano.');
      }
    },
    [alterarStatusPlano],
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
    async (planoId, itemId) => {
      setActionError('');
      try {
        await darBaixaItem(planoId, itemId);
      } catch (e) {
        setActionError(getApiErrorDetail(e) || e?.message || 'Não foi possível dar baixa no item.');
      }
    },
    [darBaixaItem],
  );

  const handleAgendarItem = useCallback(
    (item, onSaved, planoId) => {
      const pid = String(planoId ?? '').trim();
      onAgendarItem?.(item, async () => {
        await refresh();
        if (isConsulta && pid) {
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
    [applyDetalhe, catalogoOptions, isConsulta, onAgendarItem, refresh],
  );

  const handleAgendarRetornoItem = useCallback(
    (item, onSaved, planoId) => {
      const pid = String(planoId ?? '').trim();
      onAgendarRetornoItem?.(item, async () => {
        await refresh();
        if (isConsulta && pid) {
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
    [applyDetalhe, catalogoOptions, isConsulta, onAgendarRetornoItem, refresh],
  );

  const handleReagendarItem = useCallback(
    (item, plano, onSaved) => {
      onReagendarItem?.(item, plano, async () => {
        await refresh();
        onSaved?.();
      });
    },
    [onReagendarItem, refresh],
  );

  const handleConcluirComRetorno = useCallback(
    (plano) => {
      onConcluirComRetorno?.(plano, refresh);
    },
    [onConcluirComRetorno, refresh],
  );

  const openConcluirRetornoModal = useCallback(
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

  const renderAddItemForm = useCallback(
    (planoId) => {
      const draftForm = novoItemPorPlano[planoId] ?? {
        nome: '',
        catalogoId: '',
        valorDisplay: '',
      };

      const setDraftForm = (patch) =>
        setNovoItemPorPlano((prev) => ({
          ...prev,
          [planoId]: { ...draftForm, ...patch },
        }));

      const disabled = mutating || savingPlanoId === planoId || catalogoLoading;

      const selecionados =
        draftForm.catalogoId && draftForm.nome
          ? procedimentoSearchOptions.filter(
              (p) => String(p.id).trim() === String(draftForm.catalogoId).trim(),
            )
          : [];

      return (
        <div className="rounded-xl border border-dashed border-[#00a88e]/30 bg-[#f8fbfb] p-3 animate-agenda-rise">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#64748b]">
            Adicionar procedimento
          </p>
          <div className="space-y-2">
            <ProcedimentoSearchInput
              selectionMode="single"
              showDuracao={false}
              procedimentoOptions={procedimentoSearchOptions}
              procedimentosSelecionados={selecionados}
              onSelect={(proc) =>
                setDraftForm({ nome: proc.nome, catalogoId: String(proc.id) })
              }
              onToggle={() => {}}
              onRemover={() => setDraftForm({ nome: '', catalogoId: '' })}
            />
            <ValorOrcadoInput
              value={draftForm.valorDisplay}
              disabled={disabled}
              onChange={(valorDisplay) => setDraftForm({ valorDisplay })}
            />
            <button
              type="button"
              disabled={disabled || !draftForm.catalogoId}
              onClick={() => {
                if (isConsulta) {
                  const opt = catalogoOptions.find(
                    (o) => String(o.id).trim() === String(draftForm.catalogoId).trim(),
                  );
                  addItem(
                    planoId,
                    {
                      catalogoProcedimentoSaudeId: draftForm.catalogoId,
                      catalogoNome: draftForm.nome,
                      tipoCodigo: opt?.tipoCodigo ?? '',
                      valorOrcado: parseValorBrlInput(draftForm.valorDisplay),
                    },
                    catalogoOptions,
                  );
                  setNovoItemPorPlano((prev) => {
                    const next = { ...prev };
                    delete next[planoId];
                    return next;
                  });
                  return;
                }
                setActionError('Fluxo de adição direta indisponível nesta variant.');
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#00a88e] px-3 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-[#00967f] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
              Adicionar ao plano
            </button>
          </div>
        </div>
      );
    },
    [
      addItem,
      catalogoLoading,
      catalogoOptions,
      isConsulta,
      mutating,
      novoItemPorPlano,
      procedimentoSearchOptions,
      savingPlanoId,
    ],
  );

  const displayError = actionError || error;

  const profileSemPlanos =
    !loading && !isConsulta && planosAtivos.length === 0 && planosHistorico.length === 0;

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

    return (
      <div className="space-y-3">
        {displayPlanos.map((plano, index) => {
          const planoDraft = getDraft(plano.id);
          return (
            <PlanoCard
              key={plano.id}
              cardEntranceDelayMs={index * 50}
              plano={plano}
              expandido={Boolean(expandidos[plano.id])}
              onToggle={() => toggleExpandido(plano.id, plano)}
              canCrud={canCrud}
              canBaixa={canBaixa}
              canReagendar={canReagendar}
              canAgendar={canAgendar}
              canConcluirRetorno={canConcluirRetorno}
              mutating={mutating}
              onAgendarItem={handleAgendarItem}
              onAgendarRetornoItem={handleAgendarRetornoItem}
              onReagendarItem={handleReagendarItem}
              onDarBaixa={handleDarBaixa}
              onRemoverItem={async (pid, iid) => {
                setActionError('');
                try {
                  await removerItem(pid, iid);
                } catch (e) {
                  setActionError(
                    getApiErrorDetail(e) || e?.message || 'Não foi possível remover o item.',
                  );
                }
              }}
              onEncerrar={openEncerrarModal}
              onConcluir={handleConcluir}
              onRequestConcluirRetorno={openConcluirRetornoModal}
              addItemForm={renderAddItemForm}
              isConsultaDraft={plano.statusCodigo === 'ativo'}
              draftItens={planoDraft?.itens}
              draftObservacao={planoDraft?.observacao}
              onObservacaoChange={setObservacao}
              isDirty={isDirty(plano.id)}
              saving={savingPlanoId === plano.id}
              onSalvar={handleSalvarPlano}
              onEditItem={(item) =>
                setEditItemState({
                  planoId: plano.id,
                  itemKey: itemReactKey(item),
                  item,
                })
              }
              onRemoverDraftItem={(item) => removeItem(plano.id, itemReactKey(item))}
            />
          );
        })}
      </div>
    );
  };

  const renderProfilePlanosList = () => (
    <div className="flex flex-col gap-8">
      <section className="space-y-3">
        <h4 className="font-display text-xs font-extrabold uppercase tracking-wider text-ink-500">
          Plano ativo
        </h4>
        {planosAtivos.length === 0 ? (
          <div className="rounded-xl border border-dashed border-ink-200 bg-brand-primaryGhost/30 px-4 py-10 text-center">
            <BookOpen className="mx-auto h-8 w-8 text-ink-300" strokeWidth={1.75} />
            <p className="mt-2 text-[14px] font-semibold text-ink-600">
              {profileSemPlanos ? 'Nenhum plano cadastrado' : 'Nenhum plano ativo'}
            </p>
            <p className="mt-1 text-[13px] text-ink-400">
              {profileSemPlanos
                ? 'Planos são criados durante o atendimento.'
                : 'Este paciente possui planos no histórico.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {planosAtivos.map((plano) => (
              <PlanoAtivoProfileCard
                key={plano.id}
                plano={plano}
                expandido={Boolean(expandidos[plano.id])}
                onToggle={() => toggleExpandido(plano.id, plano)}
                canBaixa={canBaixa}
                canReagendar={canReagendar}
                canCrud={canCrud}
                canConcluirRetorno={canConcluirRetorno}
                mutating={mutating}
                onReagendarItem={handleReagendarItem}
                onDarBaixa={handleDarBaixa}
                onEncerrar={openEncerrarModal}
                onConcluir={handleConcluir}
              />
            ))}
          </div>
        )}
      </section>

      {planosHistorico.length > 0 ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h4 className="font-display text-xs font-extrabold uppercase tracking-wider text-ink-500">
              Histórico de planos
            </h4>
            <span className="text-[11px] font-medium text-ink-400">
              {planosHistorico.length} plano{planosHistorico.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="space-y-2">
            {planosHistorico.map((plano) => (
              <PlanoHistoricoProfileCard
                key={plano.id}
                plano={plano}
                expandido={Boolean(expandidos[plano.id])}
                onToggle={() => toggleExpandido(plano.id, plano)}
                canBaixa={canBaixa}
                canReagendar={canReagendar}
                mutating={mutating}
                onReagendarItem={handleReagendarItem}
                onDarBaixa={handleDarBaixa}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );

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
    </div>
  );
}
