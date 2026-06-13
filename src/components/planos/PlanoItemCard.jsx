import React from 'react';
import { Calendar, CalendarClock, CalendarPlus, CheckCircle2, CircleDot, Pencil, Stethoscope, Syringe, Trash2 } from 'lucide-react';
import {
  formatDataPt,
  formatValorBrl,
  isRealUuid,
} from '../../utils/planejamentoDraftUtils.js';
import {
  canDarBaixaItem,
  canReagendarItem,
  getPlanoItemStatusPresentation,
} from '../../utils/planejamentoStatusUi.js';
import { PlanoRetornoBadge } from './PlanoRetornoBadge.jsx';

const ICON_BTN = 'h-3.5 w-3.5 shrink-0';
const BTN_BASE =
  'inline-flex items-center justify-center gap-1 rounded-lg min-h-8 min-w-8 px-2 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60';

function ProcedimentoTipoIcon({ tipoCodigo }) {
  const codigo = String(tipoCodigo ?? '').trim().toLowerCase();
  const className = 'h-4 w-4';
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
}) {
  const statusCodigo = item.statusItem ?? item.statusItemNome;
  const itemStatus = getPlanoItemStatusPresentation(statusCodigo);
  const isAtivo = plano.statusCodigo === 'ativo';
  const hasRealId = isRealUuid(item.id);
  const valorLabel = formatValorBrl(item.valorOrcado);
  const showValor = valorLabel !== '—';

  const showAgendar =
    canAgendar && isAtivo && hasRealId && !item.sessaoAtiva?.agendaId;
  const agendarEnabled = showAgendar;
  const showRetorno =
    canAgendar && isAtivo && hasRealId && !item.sessaoRetornoAtiva?.agendaId;
  const agendarTooltip = !hasRealId
    ? 'Salve o plano antes de agendar este procedimento'
    : !isAtivo
      ? 'Só é possível agendar itens de um plano ativo'
      : 'Agendar procedimento';

  const showBaixa = canBaixa && canDarBaixaItem(plano, item);
  const showReagendar = canReagendar && canReagendarItem(plano, item);

  return (
    <div className="rounded-xl border border-[#e2e8f0] bg-white p-2.5 shadow-sm">
      <div className="flex items-start gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#e6f7f5] text-[#0f766e]">
          <ProcedimentoTipoIcon tipoCodigo={item.tipoCodigo} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <h4
                  className="min-w-0 flex-1 truncate text-[13px] font-bold leading-snug text-[#0f172a]"
                  title={item.catalogoNome || 'Procedimento'}
                >
                  {item.catalogoNome || 'Procedimento'}
                </h4>
                {showValor ? (
                  <span className="shrink-0 text-[13px] font-bold tabular-nums text-[#0f766e]">
                    {valorLabel}
                  </span>
                ) : null}
              </div>

              {item.sessaoAtiva?.dataAgendamento ? (
                <div className="mt-0.5 text-[11px] font-medium text-[#64748b]">
                  Agendado em {formatDataPt(item.sessaoAtiva.dataAgendamento)}
                  {item.sessaoAtiva.horaInicio
                    ? ` ${String(item.sessaoAtiva.horaInicio).slice(0, 5)}`
                    : ''}
                </div>
              ) : null}
              {item.sessaoRetornoAtiva?.dataAgendamento ? (
                <PlanoRetornoBadge
                  catalogoNome={item.catalogoNome}
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
                  className={`${BTN_BASE} border-[2px] border-[#00a88e]/30 bg-[#e6f7f5] font-bold text-[#0f766e] hover:bg-[#d2f3ee]`}
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
                      },
                      () => {},
                      plano.id,
                    )
                  }
                  className={`${BTN_BASE} border-[2px] border-[#00a88e]/30 bg-white font-bold text-[#0f766e] hover:bg-[#e6f7f5]`}
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
                  className={`${BTN_BASE} border-[2px] border-[#00a88e]/30 bg-white font-bold text-[#0f766e] hover:bg-[#e6f7f5]`}
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
                  className={`${BTN_BASE} border-[2px] border-[#00a88e]/30 bg-[#e6f7f5] font-bold text-[#0f766e] hover:bg-[#d2f3ee]`}
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
                    className={`${BTN_BASE} border border-[#e2e8f0] bg-white text-[#475569] hover:bg-[#f8fafc]`}
                  >
                    <Pencil className={ICON_BTN} strokeWidth={2} aria-hidden />
                    <ActionLabel>Editar</ActionLabel>
                  </button>
                  <button
                    type="button"
                    disabled={mutating}
                    title="Remover do plano"
                    aria-label="Remover do plano"
                    onClick={() => onRemover?.(item)}
                    className={`${BTN_BASE} border border-[#fecaca] bg-white text-[#dc2626] hover:bg-[#fef2f2]`}
                  >
                    <Trash2 className={ICON_BTN} strokeWidth={2} aria-hidden />
                    <ActionLabel>Remover</ActionLabel>
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
