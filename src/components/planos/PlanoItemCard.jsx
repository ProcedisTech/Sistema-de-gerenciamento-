import React from 'react';
import {
  Calendar,
  CalendarClock,
  CalendarPlus,
  Check,
  CheckCircle2,
  CircleDot,
  Pencil,
  Stethoscope,
  Syringe,
  Trash2,
} from 'lucide-react';
import {
  formatDataPt,
  formatValorBrl,
  isRealUuid,
} from '../../utils/planejamentoDraftUtils.js';
import {
  canDarBaixaItem,
  canReagendarItem,
  getPlanoItemStatusPresentation,
  isItemFinalizado,
} from '../../utils/planejamentoStatusUi.js';
import { PlanoRetornoBadge } from './PlanoRetornoBadge.jsx';

const ICON_BTN = 'h-3.5 w-3.5 shrink-0';
const BTN_BASE =
  'inline-flex items-center justify-center gap-1 rounded-lg min-h-8 min-w-8 px-2 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60';

function ProcedimentoTipoIcon({ tipoCodigo, realizado }) {
  const className = 'h-4 w-4';
  if (realizado) {
    return <Check className={className} strokeWidth={2.2} aria-hidden />;
  }
  const codigo = String(tipoCodigo ?? '').trim().toLowerCase();
  if (codigo === 'seringa') {
    return <Syringe className={className} strokeWidth={2} aria-hidden />;
  }
  if (codigo === 'consulta' || codigo === 'avaliacao') {
    return <Stethoscope className={className} strokeWidth={2} aria-hidden />;
  }
  return <CircleDot className={className} strokeWidth={2} aria-hidden />;
}

function ActionLabel({ children }) {
  return <span className="max-lg:sr-only">{children}</span>;
}

export function PlanoItemCard({
  item,
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
  onEdit,
  onRemover,
  entranceDelayMs,
}) {
  const statusCodigo = item.statusItem ?? item.statusItemNome;
  const itemStatus = getPlanoItemStatusPresentation(statusCodigo);
  const isAtivo = plano.statusCodigo === 'ativo';
  const isRealizado = isItemFinalizado(statusCodigo);
  const hasRealId = isRealUuid(item.id);
  const valorLabel = formatValorBrl(item.valorOrcado);
  const showValor = valorLabel !== '—';

  const showAgendar =
    !isRealizado && canAgendar && isAtivo && hasRealId && !item.sessaoAtiva?.agendaId;
  const agendarEnabled = showAgendar;
  const showRetorno =
    !isRealizado &&
    canAgendar &&
    isAtivo &&
    hasRealId &&
    !item.sessaoRetornoAtiva?.agendaId;
  const agendarTooltip = !hasRealId
    ? 'Salve o plano antes de agendar este procedimento'
    : !isAtivo
      ? 'Só é possível agendar itens de um plano ativo'
      : 'Agendar procedimento';

  const showBaixa = canBaixa && canDarBaixaItem(plano, item);
  const showReagendar = canReagendar && canReagendarItem(plano, item);

  const cardClass = isRealizado
    ? 'rounded-xl border border-ink-200 bg-ink-50/60 p-2.5 shadow-sm'
    : 'rounded-xl border border-ink-200 bg-white p-2.5 shadow-sm';

  const iconTileClass = isRealizado
    ? 'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-primaryGhost text-brand-primary'
    : 'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-500';

  const titleClass = isRealizado
    ? 'min-w-0 flex-1 truncate text-[13px] font-bold leading-snug text-ink-500'
    : 'min-w-0 flex-1 truncate text-[13px] font-bold leading-snug text-ink-900';

  const valorClass = isRealizado
    ? 'shrink-0 text-[13px] font-bold tabular-nums text-ink-500'
    : 'shrink-0 text-[13px] font-bold tabular-nums text-ink-600';

  const iconOnlyBtn = `${BTN_BASE} border border-transparent bg-transparent text-ink-400 hover:bg-ink-100 hover:text-ink-600 px-1.5`;

  return (
    <div
      className={`${cardClass}${
        entranceDelayMs != null ? ' animate-agenda-rise' : ''
      }`}
      style={entranceDelayMs != null ? { animationDelay: `${entranceDelayMs}ms` } : undefined}
    >
      <div className="flex items-start gap-2">
        <div className={iconTileClass}>
          <ProcedimentoTipoIcon tipoCodigo={item.tipoCodigo} realizado={isRealizado} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <h4 className={titleClass} title={item.catalogoNome || 'Procedimento'}>
                  {item.catalogoNome || 'Procedimento'}
                </h4>
                {showValor ? <span className={valorClass}>{valorLabel}</span> : null}
              </div>

              {item.sessaoAtiva?.dataAgendamento ? (
                <div
                  className={`mt-0.5 text-[11px] font-medium tabular-nums ${isRealizado ? 'text-ink-400' : 'text-ink-500'}`}
                >
                  Agendado em {formatDataPt(item.sessaoAtiva.dataAgendamento)}
                  {item.sessaoAtiva.horaInicio
                    ? ` ${String(item.sessaoAtiva.horaInicio).slice(0, 5)}`
                    : ''}
                </div>
              ) : null}
              {item.sessaoRetornoAtiva?.dataAgendamento ? (
                <PlanoRetornoBadge
                  dataAgendamento={item.sessaoRetornoAtiva.dataAgendamento}
                  horaInicio={item.sessaoRetornoAtiva.horaInicio}
                />
              ) : null}
              {item.statusItem || item.statusItemNome ? (
                <div className="mt-0.5">
                  <span
                    className={`rounded-md border-[2px] px-1.5 py-0.5 text-[10px] font-bold ${itemStatus.pillClass}`}
                  >
                    {itemStatus.label}
                  </span>
                </div>
              ) : null}
            </div>

            <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
              {showAgendar ? (
                <button
                  type="button"
                  disabled={mutating || !agendarEnabled}
                  title={agendarTooltip}
                  aria-label={agendarTooltip}
                  onClick={() =>
                    agendarEnabled
                      ? onAgendarItem?.(
                          {
                            planejamentoItemId: item.id,
                            catalogoProcedimentoSaudeId: item.catalogoProcedimentoSaudeId,
                            catalogoNome: item.catalogoNome,
                          },
                          () => {},
                          plano.id,
                        )
                      : undefined
                  }
                  className={`${BTN_BASE} border border-ink-200 bg-white text-ink-600 hover:bg-ink-50`}
                >
                  <Calendar className={ICON_BTN} strokeWidth={2.2} aria-hidden />
                  <ActionLabel>Agendar</ActionLabel>
                </button>
              ) : null}
              {showRetorno ? (
                <button
                  type="button"
                  disabled={mutating}
                  title="Agendar retorno vinculado ao procedimento"
                  aria-label="Agendar retorno vinculado ao procedimento"
                  onClick={() =>
                    onAgendarRetornoItem?.(
                      {
                        planejamentoItemId: item.id,
                        catalogoProcedimentoSaudeId: item.catalogoProcedimentoSaudeId,
                        catalogoNome: item.catalogoNome,
                        dataPlanejada: item.dataPlanejada ?? null,
                      },
                      () => {},
                      plano.id,
                    )
                  }
                  className={`${BTN_BASE} border-[2px] border-brand-primary/30 bg-white font-bold text-brand-primaryDark hover:bg-brand-primaryGhost`}
                >
                  <CalendarPlus className={ICON_BTN} strokeWidth={2.2} aria-hidden />
                  <ActionLabel>+ Retorno</ActionLabel>
                </button>
              ) : null}
              {showReagendar ? (
                <button
                  type="button"
                  disabled={mutating}
                  title="Reagendar procedimento"
                  aria-label="Reagendar procedimento"
                  onClick={() => onReagendarItem?.(item, plano, () => {})}
                  className={`${BTN_BASE} border border-ink-200 bg-white text-ink-600 hover:bg-ink-50`}
                >
                  <CalendarClock className={ICON_BTN} strokeWidth={2.2} aria-hidden />
                  <ActionLabel>Reagendar</ActionLabel>
                </button>
              ) : null}
              {showBaixa ? (
                <button
                  type="button"
                  disabled={mutating}
                  title="Marcar procedimento como concluído"
                  aria-label="Marcar procedimento como concluído"
                  onClick={() => onDarBaixa?.(plano.id, item.id)}
                  className={`${BTN_BASE} border border-ink-200 bg-white text-ink-600 hover:bg-ink-50`}
                >
                  <CheckCircle2 className={ICON_BTN} strokeWidth={2.2} aria-hidden />
                  <ActionLabel>Dar baixa</ActionLabel>
                </button>
              ) : null}
              {canCrud && isAtivo ? (
                <>
                  <button
                    type="button"
                    disabled={mutating}
                    title="Editar procedimento"
                    aria-label="Editar procedimento"
                    onClick={() => onEdit?.(item)}
                    className={
                      isRealizado
                        ? iconOnlyBtn
                        : `${BTN_BASE} border border-ink-200 bg-white text-ink-600 hover:bg-ink-50`
                    }
                  >
                    <Pencil className={ICON_BTN} strokeWidth={2} aria-hidden />
                    {!isRealizado ? <ActionLabel>Editar</ActionLabel> : null}
                  </button>
                  <button
                    type="button"
                    disabled={mutating}
                    title="Remover do plano"
                    aria-label="Remover do plano"
                    onClick={() => onRemover?.(item)}
                    className={
                      isRealizado
                        ? `${iconOnlyBtn} hover:text-status-danger-ink hover:bg-status-danger-bg/40`
                        : `${BTN_BASE} border border-status-danger-bg bg-white text-status-danger-ink hover:bg-status-danger-bg/30`
                    }
                  >
                    <Trash2 className={ICON_BTN} strokeWidth={2} aria-hidden />
                    {!isRealizado ? <ActionLabel>Remover</ActionLabel> : null}
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
