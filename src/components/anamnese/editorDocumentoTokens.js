/** Tailwind class bundles mirroring editor-ficha-v6_4.html tokens */

export const TL = {
  DEFAULT: '#0d9488',
  DARK: '#0f766e',
  LIGHT: '#14b8a6',
  BG: '#f0fdfa',
  BORDER: '#99f6e4',
};

export const DOC =
  'w-full min-w-0 overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-[0_4px_12px_rgba(15,23,42,0.06),0_1px_3px_rgba(15,23,42,0.04)]';

export const DOCHEAD =
  'relative bg-gradient-to-b from-[#fbfefe] to-white px-4 pt-6 sm:px-[30px] before:absolute before:inset-x-0 before:top-0 before:h-[3px] before:bg-gradient-to-r before:from-teal-600 before:via-teal-400 before:to-transparent';

export const DOCTITLE =
  'w-full border-0 bg-transparent p-0 pb-0.5 text-[22px] font-bold tracking-[-0.028em] text-[#0f172a] outline-none focus:shadow-[0_2px_0_#14b8a6] focus-visible:shadow-[0_2px_0_#14b8a6] sm:text-[25px]';

export const DOCBACK =
  'mb-3 inline-flex min-h-11 items-center gap-1.5 border-0 bg-transparent p-0 text-[12.5px] text-[#64748b] hover:text-teal-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 sm:min-h-0';

/** Mutuamente exclusivos — nunca concatenar CHIP + CHIP_ON (conflito Tailwind). */
export const CHIP =
  'inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg border border-[#e2e8f0] bg-white px-[11px] py-1.5 text-[12px] font-medium text-[#475569] transition-all duration-[180ms] hover:border-teal-200 hover:bg-teal-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-[0.42] sm:min-h-[30px] sm:py-0';

export const CHIP_ON =
  'inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-[11px] py-1.5 text-[12px] font-semibold text-teal-700 transition-all duration-[180ms] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-[0.42] sm:min-h-[30px] sm:py-0';

export const STATS =
  '-mx-4 mt-4 grid grid-cols-1 gap-x-8 gap-y-3 border-y border-[#f1f5f9] bg-[#fbfcfd] px-4 py-3 sm:-mx-[30px] sm:grid-cols-2 sm:px-[30px] sm:py-4 lg:grid-cols-4';

export const STAT = 'relative min-w-0 py-1 sm:py-1';

export const STAT_DIVIDER = '';

export const STAT_B = 'block text-[20px] font-bold leading-[1.1] tracking-[-0.02em] text-[#0f172a] sm:text-[19px]';

export const STAT_SPAN = 'mt-[3px] block text-[11px] font-medium leading-snug text-[#64748b]';

export const DECL =
  'mx-0 my-4 rounded-xl border border-dashed border-[#cbd5e1] bg-[#fcfdfd] px-3.5 py-3';

export const DECL_LB =
  'mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.09em] text-[#64748b]';

export const SECHEAD =
  'flex flex-wrap items-center gap-2.5 px-4 pb-1.5 pt-5 first:pt-5 sm:px-[30px] [&:not(:first-child)]:mt-2.5 [&:not(:first-child)]:border-t [&:not(:first-child)]:border-[#f1f5f9] [&:not(:first-child)]:pt-7';

export const SECNUM =
  'grid h-6 w-6 shrink-0 place-items-center rounded-[7px] border border-teal-200 bg-teal-50 text-[11.5px] font-bold text-teal-700';

export const SECNAME =
  'secname min-w-0 max-w-full flex-1 border-0 bg-transparent px-1 py-0.5 text-base font-semibold tracking-[-0.015em] text-[#0f172a] outline-none focus:bg-teal-50 placeholder:font-medium placeholder:text-[#cbd5e1] sm:min-w-[120px]';

export const WHOBTN =
  'inline-flex min-h-11 cursor-pointer items-center gap-1 rounded-full border border-dashed border-[#cbd5e1] bg-transparent px-2.5 py-1.5 text-[11px] font-semibold text-[#64748b] transition-all hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-[0.42] sm:min-h-0 sm:py-1';

export const WHOBTN_SET =
  'border-solid border-teal-200 bg-teal-50 text-teal-700';

export const IA =
  'grid h-11 w-11 shrink-0 place-items-center rounded-[7px] border-0 bg-transparent text-[#94a3b8] transition-all hover:bg-[#f1f5f9] hover:text-[#475569] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-[0.42] sm:h-7 sm:w-7';

export const IA_DANGER = 'hover:bg-rose-50 hover:text-rose-600';

export const SECSUM =
  'flex flex-wrap gap-3 px-4 pb-2.5 pl-4 text-[11.5px] text-[#64748b] sm:px-[30px] sm:pl-[64px]';

export const Q_BASE =
  'relative mb-px flex items-start gap-[11px] rounded-[10px] border-l-[3px] border-l-transparent py-3.5 pl-3 pr-2.5 transition-all hover:bg-[#fbfcfd] motion-reduce:transition-none';

export const Q_AT = 'border-l-amber-500 bg-gradient-to-r from-[#fffdf7] to-transparent';

export const Q_CR = 'border-l-rose-600 bg-gradient-to-r from-[#fff8f9] to-transparent';

export const Q_CHILD =
  'relative ml-4 before:absolute before:-left-[14px] before:bottom-[calc(100%-25px)] before:top-[-3px] before:w-3.5 before:rounded-bl-[7px] before:border-b-[1.5px] before:border-l-[1.5px] before:border-teal-200 before:content-[""] sm:ml-9 sm:before:-left-[21px]';

export const QNUM = 'mt-0.5 w-5 shrink-0 text-right text-[11.5px] font-bold tabular-nums text-[#64748b]';

export const QTEXT =
  'w-full min-w-0 resize-none overflow-hidden border-0 bg-transparent p-0 text-base font-medium leading-[1.5] text-[#0f172a] outline-none placeholder:font-normal placeholder:text-[#cbd5e1] sm:text-[14.5px] sm:leading-[1.45]';

export const TAG =
  'inline-flex max-w-full cursor-pointer items-center gap-1 rounded-[7px] border border-[#e2e8f0] bg-white px-2 py-1.5 text-[10.5px] font-semibold text-[#475569] transition-all hover:border-[#cbd5e1] hover:bg-[#f1f5f9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-[0.42]';

export const TAG_ALERTA = 'border-amber-200 bg-amber-50 text-amber-700';

export const TAG_CRITICA = 'border-rose-200 bg-rose-50 text-rose-700';

export const TAG_HIST =
  'cursor-default max-w-full whitespace-normal break-words border-violet-200 bg-violet-50 text-violet-700';

export const TAG_COND = 'cursor-default border-teal-200 bg-teal-50 text-teal-700';

export const COMPOSE =
  'mb-0.5 flex items-start gap-[11px] rounded-[10px] border-l-[3px] border-l-teal-200 bg-teal-50 py-2.5 pl-3 pr-2.5';

/** Mutuamente exclusivo com COMPOSE — pergunta digitada ainda sem Enter. */
export const COMPOSE_PENDING =
  'mb-0.5 flex items-start gap-[11px] rounded-[10px] border border-amber-300 border-l-[3px] border-l-amber-500 bg-amber-50 py-2.5 pl-3 pr-2.5';

export const ADDBTN =
  'my-2 ml-4 inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-[9px] border border-dashed border-teal-200 bg-transparent px-3 py-2 text-[13px] font-semibold text-teal-700 transition-all hover:border-solid hover:bg-teal-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-[0.42] sm:ml-[71px] sm:min-h-0';

export const ADDSEC =
  'mx-4 mt-2.5 flex w-[calc(100%-2rem)] min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[#cbd5e1] bg-transparent px-3.5 py-3.5 text-[13px] font-semibold text-[#64748b] transition-all hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-[0.42] sm:mx-[30px] sm:w-[calc(100%-60px)]';

export const SECEMPTY =
  'ml-4 rounded-xl border border-dashed border-[#cbd5e1] bg-[#fcfdfd] px-4 py-3.5 text-[12.5px] leading-relaxed text-[#64748b] sm:ml-[71px]';

export const SAVEBAR =
  'sticky bottom-0 flex flex-wrap items-center gap-2 border-t border-[#e2e8f0] bg-white/90 px-4 py-[13px] backdrop-blur-[14px] sm:gap-3 sm:px-[30px]';

export const BTN =
  'inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-[10px] border border-[#e2e8f0] bg-white px-4 text-[13px] font-semibold text-[#475569] transition-all hover:border-[#cbd5e1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-[0.42] sm:h-[37px] sm:min-h-0';

export const BTN_PRIMARY =
  'inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-[10px] border border-teal-600 bg-teal-600 px-4 text-[13px] font-semibold text-white shadow-[0_1px_3px_rgba(13,148,136,0.3)] transition-all hover:bg-teal-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-[0.42] sm:h-[37px] sm:min-h-0';

/** Mutuamente exclusivos — nunca concatenar CT + CT_ON (conflito Tailwind bg/text). */
export const CT =
  'inline-flex min-h-11 cursor-pointer items-center gap-1 rounded-[7px] border border-teal-200 bg-white px-2.5 py-2 text-[11px] font-semibold text-[#475569] transition-all hover:bg-[#ccfbf1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-[0.42] sm:min-h-0 sm:py-1.5';

export const CT_ON =
  'inline-flex min-h-11 cursor-pointer items-center gap-1 rounded-[7px] border border-teal-600 bg-teal-600 px-2.5 py-2 text-[11px] font-semibold text-white shadow-[0_1px_4px_rgba(13,148,136,0.3)] transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-[0.42] sm:min-h-0 sm:py-1.5';

export const KBD =
  'rounded border border-teal-200 border-b-2 bg-white px-1.5 py-px font-mono text-[9.5px] font-semibold text-teal-700';

export const TIPOS_ESCOLHA = ['escolha_unica', 'multipla_escolha'];

export function isTipoEscolha(codigo) {
  return TIPOS_ESCOLHA.includes(codigo);
}
