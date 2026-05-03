import React from 'react';
import { Calendar, ChevronRight, Clock, Loader2 } from 'lucide-react';

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

/** Marca teal + conteúdo à direita. */
export function ProcedureTimelineEntry({ children }) {
  return (
    <li className="grid min-w-0 grid-cols-[26px_minmax(0,1fr)] gap-2 sm:grid-cols-[30px_minmax(0,1fr)]">
      <div className="relative z-[2] mt-[13px] flex justify-center pt-px sm:mt-[14px]">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#00a88e] shadow-[0_0_0_4px_white] sm:h-3 sm:w-3 sm:shadow-[0_0_0_5px_white]"
          aria-hidden
        />
      </div>
      <div className="min-w-0">{children}</div>
    </li>
  );
}

/** Card do preview lateral (lista pacientes): clique opcional para abrir perfil / prontuário. */
export function ProcedureTimelinePreviewCard({
  dateLabel,
  timeLabel,
  procedureName,
  professionalName,
  onPress,
  fusedVerMais = false,
  verMaisLabel = 'Ver mais',
}) {
  const body = (
    <div className="min-w-0 flex-1 px-3 py-2.5 sm:py-3">
      <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12px] font-medium text-[#64748b] sm:text-[13px]">
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
      </div>
      <p className="mt-1 text-[13px] font-bold leading-snug text-[#0f172a] sm:text-[14px]" title={procedureName}>
        {procedureName}
      </p>
      <p
        className="mt-0.5 truncate text-[12px] font-medium leading-snug text-[#64748b]"
        title={`Realizado por ${professionalName}`}
      >
        Realizado por {professionalName}
      </p>
      {fusedVerMais && typeof onPress === 'function' ? (
        <>
          <div className="mt-3 border-t border-dashed border-[#cbd5e1] pt-2.5 pb-px text-center">
            <span className="text-[13px] font-semibold text-[#00a88e]">{verMaisLabel}</span>
            <ChevronRight className="ml-1 inline-block h-4 w-4 align-middle text-[#00a88e]" strokeWidth={2.25} aria-hidden />
          </div>
        </>
      ) : null}
    </div>
  );

  const chevron = (
    <div className={`flex shrink-0 flex-col justify-center px-2.5 sm:px-3 ${fusedVerMais ? 'hidden' : 'border-l border-[#e2e8f0]'}`}>
      <ChevronRight className="h-4 w-4 text-[#94a3b8]" strokeWidth={2.25} aria-hidden />
    </div>
  );

  if (typeof onPress === 'function' && fusedVerMais) {
    return (
      <button
        type="button"
        className="flex min-h-[44px] w-full items-stretch overflow-hidden rounded-lg border border-[#e2e8f0] bg-[#f8fafc] text-left transition-colors hover:border-[#cbd5e1] hover:bg-[#f1f5f9]"
        onClick={onPress}
      >
        <span className="sr-only">
          {`Ver prontuário completo. Último visível: ${procedureName}, ${dateLabel}${timeLabel ? ` ${timeLabel}` : ''}`}
        </span>
        {body}
        <div className="flex shrink-0 flex-col justify-center border-l border-[#e2e8f0] px-2.5 sm:px-3">
          <ChevronRight className="h-4 w-4 text-[#94a3b8]" strokeWidth={2.25} aria-hidden />
        </div>
      </button>
    );
  }

  if (typeof onPress === 'function') {
    return (
      <button
        type="button"
        className="group flex min-h-[44px] w-full items-stretch overflow-hidden rounded-lg border border-[#e2e8f0] bg-[#f8fafc] text-left transition-colors hover:border-[#cbd5e1] hover:bg-[#f1f5f9]"
        onClick={onPress}
      >
        <span className="sr-only">{`Ver prontuário: ${procedureName}, ${dateLabel}${timeLabel ? ` ${timeLabel}` : ''}`}</span>
        {body}
        {chevron}
      </button>
    );
  }

  return (
    <div className="flex min-h-[44px] items-stretch overflow-hidden rounded-lg border border-[#e2e8f0] bg-[#f8fafc]">
      {body}
      {!fusedVerMais ? chevron : null}
    </div>
  );
}

/**
 * Área clicável inferior “Ver mais” (aba Prontuário: expande lista inline).
 */
export function ProcedureTimelineProfileVerMaisStrip({ onExpand, hidden }) {
  if (hidden) return null;
  return (
    <button
      type="button"
      className="-mx-px -mb-px flex min-h-[44px] w-full items-center justify-center gap-1 border-t border-[#e2e8f0] bg-[#f1f5f9]/80 px-3 py-2.5 text-[13px] font-semibold text-[#00a88e] transition-colors hover:bg-[#e6f7f5]"
      onClick={onExpand}
    >
      Ver mais
      <ChevronRight className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
    </button>
  );
}
