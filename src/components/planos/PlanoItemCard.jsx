import React, { useState, useRef, useEffect } from 'react';
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
  Zap,
  RotateCcw,
} from 'lucide-react';
import {
  formatDataPt,
  formatValorBrl,
} from '../../utils/planejamentoDraftUtils.js';
import { toLocalDateIso } from '../../utils/agendaDateUtils.js';
import {
  canReagendarItem,
  getPlanoItemStatusPresentation,
  isItemFinalizado,
} from '../../utils/planejamentoStatusUi.js';
import { PlanoRetornoBadge } from './PlanoRetornoBadge.jsx';

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
  onIniciarAtendimento,
  onDarBaixa: _onDarBaixa,
  onEdit: _onEdit,
  onRemover,
  entranceDelayMs,
  selecionavel = false,
  selecionado = false,
  onToggleSelecao,
  vezesFeitas = 0,
  temTermoPendente = false,
  duracaoMin = null,
  planoTitulo,
  visitaLabel,
  visitaData: _visitaData,
  visitaHora: _visitaHora,
}) {
  const [showDataMenu, setShowDataMenu] = useState(false);
  const dataMenuRef = useRef(null);
  const [showRetornoMenu, setShowRetornoMenu] = useState(false);
  const retornoMenuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dataMenuRef.current && !dataMenuRef.current.contains(e.target)) {
        setShowDataMenu(false);
      }
      if (retornoMenuRef.current && !retornoMenuRef.current.contains(e.target)) {
        setShowRetornoMenu(false);
      }
    }
    if (showDataMenu || showRetornoMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showDataMenu, showRetornoMenu]);

  const statusCodigo = item.statusItem ?? item.statusItemNome;
  const itemStatus = getPlanoItemStatusPresentation(statusCodigo);
  const isAtivo = plano?.statusCodigo === 'ativo';
  const isRealizado = isItemFinalizado(statusCodigo);
  const hasDataOuRealizado = Boolean(
    item.sessaoAtiva?.dataAgendamento ||
    item.sessaoRealizada?.dataAgendamento ||
    item.dataRealizacao ||
    isRealizado
  );
  const valorLabel = formatValorBrl(item.valorOrcado);
  const showReagendar = Boolean(canReagendar && isAtivo && canReagendarItem(plano, item));
  const showAgendar = Boolean(canAgendar && isAtivo && !showReagendar);

  const handleEscolherOffset = (diasOffset) => {
    setShowDataMenu(false);
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + diasOffset);
    const dataIso = toLocalDateIso(targetDate);
    const resolvedId = item.planejamentoItemId || item.id;
    onAgendarItem?.(
      {
        ...item,
        id: resolvedId,
        planejamentoItemId: resolvedId,
        catalogoProcedimentoSaudeId: item.catalogoProcedimentoSaudeId || item.catalogoId,
        catalogoNome: item.catalogoNome,
        dataPlanejada: dataIso,
        data: dataIso,
      },
      () => {},
      plano?.id,
    );
  };

  const handleEscolherRetornoOffset = (diasOffset) => {
    setShowRetornoMenu(false);

    // Data base para o retorno:
    // Se o procedimento tem data planejada/agendada futura ou hoje, usamos ela como âncora;
    // caso contrário, usamos a data de hoje.
    const procDataStr =
      item.dataRealizacao ||
      item.sessaoAtiva?.dataAgendamento ||
      item.dataPlanejada ||
      item.data;

    let baseDate = new Date();
    if (procDataStr && typeof procDataStr === 'string') {
      const parsed = new Date(procDataStr.slice(0, 10) + 'T12:00:00');
      if (!isNaN(parsed.getTime())) {
        baseDate = parsed;
      }
    }

    const targetDate = new Date(baseDate);
    targetDate.setDate(targetDate.getDate() + diasOffset);

    // Se por acaso a data alvo calculada ficar no passado, usa hoje + diasOffset
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const targetCheck = new Date(targetDate);
    targetCheck.setHours(0, 0, 0, 0);

    let finalDate = targetDate;
    if (targetCheck < hoje) {
      finalDate = new Date();
      finalDate.setDate(finalDate.getDate() + diasOffset);
    }

    const dataIso = toLocalDateIso(finalDate);
    const resolvedId = item.planejamentoItemId || item.id;

    onAgendarRetornoItem?.(
      {
        ...item,
        id: resolvedId,
        planejamentoItemId: resolvedId,
        catalogoProcedimentoSaudeId: item.catalogoProcedimentoSaudeId || item.catalogoId,
        catalogoNome: item.catalogoNome,
        dataRetornoSugerida: dataIso,
        data: dataIso,
        planoTitulo: planoTitulo || plano?.titulo || plano?.nome || 'Plano de Tratamento',
        visitaLabel: visitaLabel || (item.sessaoAtiva ? 'Visita agendada' : 'No plano'),
        dataPaiReal: item.sessaoAtiva?.dataAgendamento || item.sessaoRealizada?.dataAgendamento || item.dataRealizacao || item.dataPlanejada || null,
        horaPaiReal: item.sessaoAtiva?.horaInicio || item.sessaoRealizada?.horaInicio || null,
        statusPai: isRealizado ? 'realizado' : (item.sessaoAtiva ? 'agendado' : 'planejado'),
      },
      () => {},
      plano?.id,
    );
  };

  const handleAbrirAgendaRetorno = () => {
    setShowRetornoMenu(false);
    const resolvedId = item.planejamentoItemId || item.id;
    onAgendarRetornoItem?.(
      {
        ...item,
        id: resolvedId,
        planejamentoItemId: resolvedId,
        catalogoProcedimentoSaudeId: item.catalogoProcedimentoSaudeId || item.catalogoId,
        catalogoNome: item.catalogoNome,
        dataPlanejada: item.dataPlanejada ?? null,
        planoTitulo: planoTitulo || plano?.titulo || plano?.nome || 'Plano de Tratamento',
        visitaLabel: visitaLabel || (item.sessaoAtiva ? 'Visita agendada' : 'No plano'),
        dataPaiReal: item.sessaoAtiva?.dataAgendamento || item.sessaoRealizada?.dataAgendamento || item.dataRealizacao || item.dataPlanejada || null,
        horaPaiReal: item.sessaoAtiva?.horaInicio || item.sessaoRealizada?.horaInicio || null,
        statusPai: isRealizado ? 'realizado' : (item.sessaoAtiva ? 'agendado' : 'planejado'),
      },
      () => {},
      plano?.id,
    );
  };

  const handleAbrirAgendaItem = () => {
    setShowDataMenu(false);
    const resolvedId = item.planejamentoItemId || item.id;
    onAgendarItem?.(
      {
        ...item,
        id: resolvedId,
        planejamentoItemId: resolvedId,
        catalogoProcedimentoSaudeId: item.catalogoProcedimentoSaudeId || item.catalogoId,
        catalogoNome: item.catalogoNome,
        dataPlanejada: item.dataPlanejada || null,
        data: item.dataPlanejada || null,
        planoTitulo: planoTitulo || plano?.titulo || plano?.nome || 'Plano de Tratamento',
        visitaLabel: visitaLabel || (item.sessaoAtiva ? 'Visita agendada' : 'No plano'),
      },
      () => {},
      plano?.id,
    );
  };

  const cardClass = isRealizado
    ? 'rounded-xl border border-slate-200 bg-slate-50/70 p-3 shadow-2xs'
    : selecionado
      ? 'rounded-xl border-2 border-[#00a88e] bg-teal-50/40 p-3 shadow-2xs'
      : 'rounded-xl border border-slate-200 bg-white p-3 shadow-2xs hover:border-slate-300 transition-colors';

  return (
    <div
      className={`${cardClass} ${
        showRetornoMenu || showDataMenu ? 'relative z-40' : ''
      }${
        entranceDelayMs != null ? ' animate-agenda-rise' : ''
      }`}
      style={entranceDelayMs != null ? { animationDelay: `${entranceDelayMs}ms` } : undefined}
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 lg:gap-4">
        {/* LADO ESQUERDO: CHECKBOX + INFOS */}
        <div className="flex items-start sm:items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
          {selecionavel && !isRealizado && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleSelecao?.(item);
              }}
              aria-label={selecionado ? 'Desmarcar procedimento' : 'Selecionar procedimento'}
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all ${
                selecionado
                  ? 'border-[#00a88e] bg-[#00a88e] text-white shadow-2xs'
                  : 'border-slate-300 bg-white hover:border-[#00a88e]'
              }`}
            >
              {selecionado ? (
                <Check className="h-3.5 w-3.5" strokeWidth={2.8} />
              ) : (
                <span className="h-2 w-2 rounded-full bg-slate-200" />
              )}
            </button>
          )}

          {/* ÍCONE TIPO PROCEDIMENTO */}
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              isRealizado
                ? 'bg-slate-100 text-slate-400'
                : item.isRetorno
                  ? 'bg-cyan-50 text-cyan-700'
                  : 'bg-teal-50 text-[#00a88e]'
            }`}
          >
            {isRealizado ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : item.isRetorno ? (
              <RotateCcw className="w-4 h-4" strokeWidth={2.4} />
            ) : item.tipo === 'followup' ? (
              <Stethoscope className="w-4 h-4" />
            ) : (
              <Syringe className="w-4 h-4" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span
                className={`text-sm font-semibold ${
                  isRealizado
                    ? 'line-through text-slate-400'
                    : 'text-slate-800'
                }`}
              >
                {item.catalogoNome || 'Procedimento'}
              </span>
            </div>

            {/* METADADOS COMPACTOS */}
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
              <span className={`px-1.5 py-0.2 rounded font-medium ${itemStatus.pillClass}`}>
                {itemStatus.label}
              </span>
              <span>·</span>
              {duracaoMin ? (
                <>
                  <span>{duracaoMin} min</span>
                  <span>·</span>
                </>
              ) : null}
              {vezesFeitas > 0 ? (
                <span className="font-semibold text-teal-700">
                  {vezesFeitas + 1}ª vez
                </span>
              ) : (
                <span>1ª vez</span>
              )}
              {temTermoPendente && (
                <>
                  <span>·</span>
                  <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-0.2 text-[10px] font-bold text-amber-800">
                    termo pendente
                  </span>
                </>
              )}
              {isRealizado && (item.sessaoRealizada?.dataAgendamento || item.sessaoAtiva?.dataAgendamento) ? (
                <>
                  <span>·</span>
                  <span className="text-slate-500 font-medium">
                    Realizado em {formatDataPt(item.sessaoRealizada?.dataAgendamento || item.sessaoAtiva?.dataAgendamento)}
                    {(item.sessaoRealizada?.horaInicio || item.sessaoAtiva?.horaInicio)
                      ? ` às ${String(item.sessaoRealizada?.horaInicio || item.sessaoAtiva?.horaInicio).slice(0, 5)}`
                      : ''}
                  </span>
                </>
              ) : item.sessaoAtiva?.dataAgendamento ? (
                <>
                  <span>·</span>
                  <span className="text-teal-700 font-medium">
                    Agendado em {formatDataPt(item.sessaoAtiva.dataAgendamento)}
                    {item.sessaoAtiva.horaInicio ? ` às ${String(item.sessaoAtiva.horaInicio).slice(0, 5)}` : ''}
                  </span>
                </>
              ) : null}
            </div>

            {item.sessaoRetornoAtiva?.dataAgendamento && (
              <div className="mt-1">
                <PlanoRetornoBadge
                  dataAgendamento={item.sessaoRetornoAtiva.dataAgendamento}
                  horaInicio={item.sessaoRetornoAtiva.horaInicio}
                />
              </div>
            )}
          </div>
        </div>

        {/* LADO DIREITO: VALOR + AÇÕES V6 */}
        <div className="flex items-center justify-between lg:justify-end gap-2.5 sm:gap-3 shrink-0 flex-wrap sm:flex-nowrap border-t lg:border-t-0 border-slate-100 pt-2.5 lg:pt-0 mt-0.5 lg:mt-0">
          <div className="text-left lg:text-right shrink-0">
            <div className="text-sm font-bold text-slate-800 tabular-nums">
              {item.isRetorno ? 'Incluso' : valorLabel}
            </div>
            <div className="text-[10px] text-slate-400 font-medium">
              {item.isRetorno
                ? 'retorno'
                : isRealizado
                  ? 'concluído'
                  : item.sessaoAtiva?.dataAgendamento
                    ? 'agendado'
                    : item.dataPlanejada
                      ? 'planejado'
                      : 'sem data'}
            </div>
          </div>

          {/* TRIO DE AÇÕES V6 */}
          {!isRealizado ? (
            <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap relative">
              {/* REAGENDAR PROCEDIMENTO (JÁ AGENDADO) */}
              {showReagendar && (
                <button
                  type="button"
                  disabled={mutating}
                  title="Mudar data do procedimento"
                  onClick={(e) => {
                    e.stopPropagation();
                    onReagendarItem?.(item, plano);
                  }}
                  className="inline-flex h-9 sm:h-10 items-center gap-1.5 px-2.5 sm:px-3 rounded-xl border border-teal-200 bg-teal-50/70 text-teal-700 text-xs font-semibold hover:bg-teal-100 hover:border-teal-400 active:scale-95 shadow-2xs transition-all shrink-0 whitespace-nowrap select-none"
                >
                  <CalendarClock className="w-3.5 h-3.5 shrink-0" strokeWidth={2.2} />
                  <span>Mudar data</span>
                </button>
              )}

              {/* AGENDAR PROCEDIMENTO (SEM AGENDAMENTO ATIVO) */}
              {showAgendar && (
                <div className="relative" ref={dataMenuRef}>
                  <button
                    type="button"
                    disabled={mutating}
                    title={item.dataPlanejada ? 'Mudar data planejada' : 'Agendar procedimento'}
                    onClick={() => setShowDataMenu((prev) => !prev)}
                    className="inline-flex h-9 sm:h-10 items-center gap-1.5 px-2.5 sm:px-3 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs font-semibold hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700 active:scale-95 shadow-2xs transition-all shrink-0 whitespace-nowrap select-none"
                  >
                    <Calendar className="w-3.5 h-3.5 shrink-0" strokeWidth={2.2} />
                    <span>{item.dataPlanejada ? 'Mudar data' : 'Agendar'}</span>
                  </button>

                  {showDataMenu && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute right-0 top-12 z-50 w-64 rounded-xl border border-slate-200 bg-white p-2.5 shadow-xl animate-in fade-in zoom-in-95 duration-100 text-left"
                    >
                      <div className="flex items-center justify-between px-2 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                        <span>Agendar para quando?</span>
                        <span className="text-[9px] font-bold text-teal-600 bg-teal-50 px-1.5 py-0.2 rounded border border-teal-200">
                          Vinculado ao Plano
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-1 my-1.5">
                        <button
                          type="button"
                          onClick={() => handleEscolherOffset(0)}
                          className="px-2.5 py-1.5 text-left text-xs font-semibold text-slate-700 rounded-lg hover:bg-teal-50 hover:text-teal-800 transition-colors"
                        >
                          Hoje <span className="block text-[9px] text-slate-400 font-normal">agora</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEscolherOffset(1)}
                          className="px-2.5 py-1.5 text-left text-xs font-semibold text-slate-700 rounded-lg hover:bg-teal-50 hover:text-teal-800 transition-colors"
                        >
                          Amanhã <span className="block text-[9px] text-slate-400 font-normal">+1 dia</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEscolherOffset(7)}
                          className="px-2.5 py-1.5 text-left text-xs font-semibold text-slate-700 rounded-lg hover:bg-teal-50 hover:text-teal-800 transition-colors"
                        >
                          Em 7 dias <span className="block text-[9px] text-slate-400 font-normal">próx. semana</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEscolherOffset(15)}
                          className="px-2.5 py-1.5 text-left text-xs font-semibold text-slate-700 rounded-lg hover:bg-teal-50 hover:text-teal-800 transition-colors"
                        >
                          Em 15 dias <span className="block text-[9px] text-slate-400 font-normal">+15 dias</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEscolherOffset(30)}
                          className="col-span-2 px-2.5 py-1.5 text-left text-xs font-semibold text-slate-700 rounded-lg hover:bg-teal-50 hover:text-teal-800 transition-colors"
                        >
                          Em 30 dias <span className="text-[10px] text-slate-400 font-normal ml-1">retorno</span>
                        </button>
                      </div>
                      <div className="border-t border-slate-100 pt-2 mt-1">
                        <button
                          type="button"
                          onClick={handleAbrirAgendaItem}
                          className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg bg-[#00a88e] text-white text-xs font-semibold hover:bg-[#008f79] active:scale-98 transition-colors shadow-2xs"
                        >
                          <Calendar className="w-3.5 h-3.5" />
                          <span>Escolher na Agenda...</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* AGENDAR RETORNO: Apenas para procedimentos com data agendada ou já realizados */}
              {!item.isRetorno && onAgendarRetornoItem && isAtivo && !item.sessaoRetornoAtiva?.agendaId && hasDataOuRealizado && (
                <div className="relative" ref={retornoMenuRef}>
                  <button
                    type="button"
                    disabled={mutating}
                    title="Agendar retorno clínico do procedimento"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowRetornoMenu((prev) => !prev);
                    }}
                    className="inline-flex h-9 sm:h-10 items-center gap-1.5 rounded-xl border border-teal-200/90 bg-teal-50/70 px-2.5 text-xs font-bold text-teal-700 hover:border-teal-400 hover:bg-teal-100/80 active:scale-95 shadow-2xs transition-all shrink-0 whitespace-nowrap select-none"
                  >
                    <RotateCcw className="w-3.5 h-3.5 shrink-0" strokeWidth={2.4} />
                    <span>+ Retorno</span>
                  </button>

                  {showRetornoMenu && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute right-0 top-12 z-50 w-64 rounded-xl border border-slate-200 bg-white p-2.5 shadow-xl animate-in fade-in zoom-in-95 duration-100 text-left"
                    >
                      <div className="flex items-center justify-between px-2 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                        <span>Agendar Retorno</span>
                        <span className="text-[9px] font-bold text-teal-600 bg-teal-50 px-1.5 py-0.2 rounded border border-teal-200">
                          Vinculado ao Plano
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-1 my-1.5">
                        <button
                          type="button"
                          onClick={() => handleEscolherRetornoOffset(15)}
                          className="col-span-2 px-2.5 py-2 text-left text-xs font-semibold text-teal-900 bg-teal-50/80 rounded-lg border border-teal-200/80 hover:bg-teal-100 transition-colors"
                        >
                          Em 15 dias
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEscolherRetornoOffset(30)}
                          className="px-2.5 py-1.5 text-left text-xs font-semibold text-slate-700 rounded-lg hover:bg-teal-50 hover:text-teal-800 transition-colors"
                        >
                          Em 30 dias <span className="block text-[9px] text-slate-400 font-normal">Controle</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEscolherRetornoOffset(7)}
                          className="px-2.5 py-1.5 text-left text-xs font-semibold text-slate-700 rounded-lg hover:bg-teal-50 hover:text-teal-800 transition-colors"
                        >
                          Em 7 dias <span className="block text-[9px] text-slate-400 font-normal">Avaliação</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEscolherRetornoOffset(1)}
                          className="col-span-2 px-2.5 py-1.5 text-left text-xs font-semibold text-slate-700 rounded-lg hover:bg-teal-50 hover:text-teal-800 transition-colors"
                        >
                          Amanhã <span className="text-[9px] text-slate-400 font-normal ml-1">+1 dia</span>
                        </button>
                      </div>
                      <div className="border-t border-slate-100 pt-2 mt-1">
                        <button
                          type="button"
                          onClick={handleAbrirAgendaRetorno}
                          className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg bg-[#00a88e] text-white text-xs font-semibold hover:bg-[#008f79] active:scale-98 transition-colors shadow-2xs"
                        >
                          <Calendar className="w-3.5 h-3.5" />
                          <span>Escolher na Agenda...</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* INICIAR ATENDIMENTO */}
              {canBaixa && (
                <button
                  type="button"
                  disabled={mutating}
                  title={item.isRetorno ? 'Iniciar Retorno' : 'Iniciar atendimento'}
                  onClick={(e) => {
                    e.stopPropagation();
                    onIniciarAtendimento?.(item, plano);
                  }}
                  className="inline-flex h-9 sm:h-10 items-center gap-1.5 px-2.5 sm:px-3 rounded-xl bg-[#00a88e] text-white text-xs font-bold hover:bg-[#008f79] active:scale-95 shadow-2xs transition-all shrink-0 whitespace-nowrap select-none"
                >
                  <Zap className="w-3.5 h-3.5 shrink-0" strokeWidth={2.4} />
                  <span>{item.isRetorno ? 'Iniciar Retorno' : 'Iniciar'}</span>
                </button>
              )}

              {/* REMOVER DO PLANO */}
              {canCrud && (
                <button
                  type="button"
                  disabled={mutating}
                  title="Remover do plano"
                  onClick={() => onRemover?.(item)}
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl border border-slate-200 bg-white text-slate-400 flex items-center justify-center hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 active:scale-95 shadow-2xs transition-all shrink-0 select-none"
                >
                  <Trash2 className="w-4 h-4" strokeWidth={2} />
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
              {onAgendarRetornoItem && !item.sessaoRetornoAtiva?.agendaId && (
                <button
                  type="button"
                  disabled={mutating}
                  title="Agendar retorno"
                  onClick={() =>
                    onAgendarRetornoItem?.(
                      {
                        ...item,
                        planejamentoItemId: item.id,
                        catalogoProcedimentoSaudeId: item.catalogoProcedimentoSaudeId || item.catalogoId,
                        catalogoNome: item.catalogoNome,
                        dataPlanejada: item.dataPlanejada ?? null,
                        planoTitulo: planoTitulo || plano?.titulo || plano?.nome || 'Plano de Tratamento',
                        visitaLabel: visitaLabel || (item.sessaoAtiva ? 'Visita agendada' : 'No plano'),
                        dataPaiReal: item.sessaoAtiva?.dataAgendamento || item.sessaoRealizada?.dataAgendamento || item.dataRealizacao || item.dataPlanejada || null,
                        horaPaiReal: item.sessaoAtiva?.horaInicio || item.sessaoRealizada?.horaInicio || null,
                        statusPai: isRealizado ? 'realizado' : (item.sessaoAtiva ? 'agendado' : 'planejado'),
                      },
                      () => {},
                      plano.id,
                    )
                  }
                  className="inline-flex h-9 sm:h-10 items-center gap-1.5 px-2.5 sm:px-3 rounded-xl border border-teal-200 bg-teal-50 text-teal-700 text-xs font-bold hover:bg-teal-100 active:scale-95 shadow-2xs transition-all shrink-0 whitespace-nowrap select-none"
                >
                  <CalendarPlus className="w-3.5 h-3.5 shrink-0" strokeWidth={2.2} />
                  <span>Agendar retorno</span>
                </button>
              )}
              {canCrud && (
                <button
                  type="button"
                  disabled={mutating}
                  title="Remover histórico"
                  onClick={() => onRemover?.(item)}
                  className="w-8 h-8 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-all select-none"
                >
                  <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
