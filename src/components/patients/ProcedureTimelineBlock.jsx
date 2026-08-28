import React from 'react';
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  Clock,
  FileText,
  Image as ImageIcon,
  Loader2,
  Stethoscope,
  StickyNote,
} from 'lucide-react';

/** Cabeçalho com ícone (referência linha do tempo). */
export function ProcedureTimelineHeading({ title, iconClassName = 'text-[#00a88e]' }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <Clock className={`h-4 w-4 shrink-0 ${iconClassName}`} strokeWidth={2.25} aria-hidden />
      <h4 className="text-[14px] font-bold leading-snug text-[#0f172a]">{title}</h4>
    </div>
  );
}

export function ProcedureTimelineLoading({ message = 'Carregando procedimentos…' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-8 text-[13px] font-medium text-[#64748b]">
      <Loader2 className="h-4 w-4 animate-spin text-[#00a88e]" aria-hidden />
      {message}
    </div>
  );
}

/** Tronco vertical + espaçamento entre itens (`children` devem ser `ProcedureTimelineEntry`). */
export function ProcedureTimelineRail({ children }) {
  if (!React.Children.count(children)) return null;
  return (
    <div className="relative pb-1">
      <div
        className="pointer-events-none absolute bottom-9 left-[13px] top-3 w-px bg-[#e2e8f0] sm:bottom-10 sm:left-[15px] sm:top-3"
        aria-hidden
      />
      <ul className="relative z-[1] m-0 list-none space-y-2.5 p-0 sm:space-y-3">{children}</ul>
    </div>
  );
}

/** Marca teal/sky + linha conectora estilizada. depth > 0 = retorno indentado com conector curvado. */
export function ProcedureTimelineEntry({ children, depth = 0 }) {
  const isChild = depth > 0;
  return (
    <li
      className={`relative grid min-w-0 grid-cols-[24px_minmax(0,1fr)] gap-2.5 sm:grid-cols-[28px_minmax(0,1fr)] ${
        isChild ? 'ml-3 sm:ml-5' : ''
      }`}
    >
      {/* Indicador e Conector em L para retornos (azul claro / sky) */}
      <div className="relative z-[2] flex justify-center pt-3.5">
        {isChild && (
          <div
            className="pointer-events-none absolute -left-3 top-0 h-4 w-3.5 rounded-bl-lg border-b-2 border-l-2 border-sky-300 sm:-left-4 sm:w-4"
            aria-hidden
          />
        )}
        <span
          className={`shrink-0 rounded-full transition-all ${
            isChild
              ? 'h-2.5 w-2.5 bg-sky-500 shadow-[0_0_0_3px_#e0f2fe]'
              : 'h-3 w-3 bg-[#00a88e] shadow-[0_0_0_4px_#e6f7f5]'
          }`}
          aria-hidden
        />
      </div>
      <div className="min-w-0">{children}</div>
    </li>
  );
}

export function RetornoTimelineBadge({ isRetoque }) {
  return (
    <span className="inline-flex items-center gap-1 shrink-0 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-800 shadow-2xs">
      <span>🔄</span>
      <span>{isRetoque ? 'Retoque' : 'Retorno'}</span>
    </span>
  );
}

/** Card do preview lateral (lista pacientes): clique opcional para abrir perfil / prontuário. */
export function ProcedureTimelinePreviewCard({
  dateLabel,
  timeLabel,
  procedureName,
  professionalName,
  onPress,
  depth = 0,
  retornoCount = 0,
  isRetoque = false,
  statusNome = '',
  fotosCount = 0,
  hasTermo = false,
  hasObservacao = false,
  onToggleRetornos,
  isRetornosExpanded = false,
}) {
  const isChild = depth > 0;

  const body = (
    <div className="min-w-0 flex-1 p-3 sm:p-3.5">
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[12px] font-medium text-[#64748b] sm:text-[13px]">
        <Calendar className="h-3.5 w-3.5 shrink-0 text-[#00a88e]" strokeWidth={2} aria-hidden />
        <span className="truncate">
          {dateLabel}
          {timeLabel ? (
            <>
              {' '}
              <span className="text-[#94a3b8]">·</span> {timeLabel}
            </>
          ) : null}
        </span>
        {isChild && <RetornoTimelineBadge isRetoque={isRetoque} />}
        {!isChild && retornoCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50/80 px-2 py-0.2 text-[10px] font-bold text-sky-800">
            <span>🔄</span>
            <span>
              {retornoCount} {retornoCount === 1 ? 'retorno' : 'retornos'}
            </span>
          </span>
        )}
      </div>

      <div className="mt-1 flex items-center justify-between gap-2">
        <p className="text-[13px] font-bold leading-snug text-[#0f172a] sm:text-[14px]" title={procedureName}>
          {procedureName}
        </p>
        {statusNome ? (
          <span className="shrink-0 rounded-full border border-emerald-200/80 bg-emerald-50 px-2 py-0.2 text-[9px] font-bold uppercase tracking-wide text-emerald-800">
            {statusNome}
          </span>
        ) : null}
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-[#64748b]">
        <p className="flex items-center gap-1 truncate font-medium" title={`Realizado por ${professionalName}`}>
          <Stethoscope className="h-3.5 w-3.5 shrink-0 text-[#94a3b8]" strokeWidth={2} aria-hidden />
          <span className="truncate">Realizado por {professionalName}</span>
        </p>
        {fotosCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600">
            <ImageIcon className="h-3 w-3 text-slate-400" />
            {fotosCount}
          </span>
        )}
        {hasTermo && (
          <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200/80 bg-emerald-50 px-1.5 py-0.5 font-semibold text-emerald-700">
            <FileText className="h-3 w-3 text-emerald-600" />
            Termo
          </span>
        )}
        {hasObservacao && (
          <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600">
            <StickyNote className="h-3 w-3 text-slate-400" />
            Obs
          </span>
        )}
      </div>

      {/* Botão explícito de expansão/recolhimento dos retornos no rodapé (paleta azul claro com bom contraste) */}
      {!isChild && retornoCount > 0 && typeof onToggleRetornos === 'function' && (
        <div className="mt-2.5 border-t border-sky-200/80 pt-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleRetornos(e);
            }}
            className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-all ${
              isRetornosExpanded
                ? 'border-2 border-sky-400 bg-sky-100 text-sky-950 shadow-xs'
                : 'border-2 border-sky-300/90 bg-sky-50/90 text-sky-950 shadow-2xs hover:border-sky-400 hover:bg-sky-100'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <span>🔄</span>
              <span>
                {isRetornosExpanded
                  ? `Ocultar ${retornoCount} ${retornoCount === 1 ? 'retorno' : 'retornos'}`
                  : `Ver ${retornoCount} ${retornoCount === 1 ? 'retorno vinculado' : 'retornos vinculados'}`}
              </span>
            </span>
            <span className="flex items-center gap-1 text-[10px] font-bold text-sky-800">
              <span>{isRetornosExpanded ? 'Recolher' : 'Expandir'}</span>
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform duration-200 ${
                  isRetornosExpanded ? 'rotate-180' : ''
                }`}
                strokeWidth={2.5}
              />
            </span>
          </button>
        </div>
      )}

    </div>
  );

  const cardBorderClass = isChild
    ? 'border border-sky-200/80 border-l-4 border-l-sky-500 bg-[#f0f9ff]/40 shadow-2xs hover:shadow-xs'
    : 'border border-[#e2e8f0] border-l-4 border-l-[#00a88e] bg-white shadow-xs hover:shadow-sm';

  const chevron = (
    <div className="flex shrink-0 flex-col justify-center px-2.5 border-l border-[#f1f5f9] sm:px-3">
      <ChevronRight className="h-4 w-4 text-[#94a3b8] transition-transform group-hover:translate-x-0.5" strokeWidth={2.25} aria-hidden />
    </div>
  );

  if (typeof onPress === 'function') {
    return (
      <button
        type="button"
        className={`group flex min-h-[44px] w-full items-stretch overflow-hidden rounded-xl text-left transition-all ${cardBorderClass}`}
        onClick={onPress}
      >
        <span className="sr-only">{`Ver prontuário: ${procedureName}, ${dateLabel}${timeLabel ? ` ${timeLabel}` : ''}`}</span>
        {body}
        {chevron}
      </button>
    );
  }

  return (
    <div className={`flex min-h-[44px] items-stretch overflow-hidden rounded-xl ${cardBorderClass}`}>
      {body}
      {chevron}
    </div>
  );
}

/**
 * Botão desacoplado inferior “Ver mais” (usado abaixo da timeline de procedimentos).
 */
export function ProcedureTimelineProfileVerMaisStrip({ onExpand, label = 'Ver mais procedimentos' }) {
  return (
    <button
      type="button"
      className="flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl border border-[#e2e8f0] bg-white px-4 py-2.5 text-[13px] font-bold text-[#00a88e] shadow-2xs transition-all hover:border-[#cbd5e1] hover:bg-[#f8fafc]"
      onClick={onExpand}
    >
      <span>{label}</span>
      <ChevronDown className="h-4 w-4 shrink-0 text-[#00a88e]" strokeWidth={2.25} aria-hidden />
    </button>
  );
}
