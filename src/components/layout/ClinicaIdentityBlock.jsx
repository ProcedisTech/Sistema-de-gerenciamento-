import React from 'react';
import { Shield } from 'lucide-react';

const OUTER_CLASSES = {
  'sidebar-desktop': {
    button:
      'flex min-w-0 flex-1 items-center gap-3 rounded-xl py-1 text-left transition-colors hover:bg-app-nav-hover/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/60',
    static: 'flex min-w-0 flex-1 items-center gap-3 py-1',
  },
  'sidebar-tablet': {
    button:
      'flex w-full items-center gap-3 border-b border-app-border px-6 pb-4 pt-2 text-left transition-colors hover:bg-app-nav-hover/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-300/50',
    static: 'flex w-full items-center gap-3 border-b border-app-border px-6 pb-4 pt-2',
  },
  header: {
    button:
      'hidden min-w-0 items-center gap-3 rounded-xl text-left transition-colors hover:bg-app-nav-hover/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/60 xl:flex',
    static: 'hidden min-w-0 items-center gap-3 xl:flex',
  },
};

/**
 * Bloco de identidade da clínica (logo + nome), usado na Sidebar e no GlobalHeader.
 *
 * @param {{
 *   variant?: 'sidebar-desktop' | 'sidebar-tablet' | 'header',
 *   tituloClinica: string,
 *   clinicaLogoResolved?: string,
 *   canSeeConfig?: boolean,
 *   onOpenClinicaSettings?: () => void,
 *   className?: string,
 * }} props
 */
export function ClinicaIdentityBlock({
  variant = 'sidebar-desktop',
  tituloClinica,
  clinicaLogoResolved,
  canSeeConfig,
  onOpenClinicaSettings,
  className = '',
}) {
  const isHeader = variant === 'header';
  const outer = OUTER_CLASSES[variant] || OUTER_CLASSES['sidebar-desktop'];
  const extra = className ? ` ${className}` : '';

  const content = (
    <>
      <div
        className={
          isHeader
            ? 'flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-app-accent shadow-sm ring-1 ring-app-accent/35'
            : 'shrink-0 rounded-xl border border-white/30 bg-[#00a88e] p-2 shadow-sm'
        }
      >
        {clinicaLogoResolved ? (
          <img
            src={clinicaLogoResolved}
            alt="Logo"
            className={isHeader ? 'h-10 w-10 object-cover' : 'h-10 w-10 rounded-xl object-cover'}
          />
        ) : (
          <Shield className="h-6 w-6 text-white" strokeWidth={2} />
        )}
      </div>
      <div className={isHeader ? 'min-w-0 max-w-[120px]' : 'min-w-0 flex-1'}>
        {isHeader ? (
          <h1
            className="line-clamp-2 break-words text-[16px] font-bold leading-tight text-[#0f172a]"
            title={tituloClinica}
          >
            {tituloClinica}
          </h1>
        ) : (
          <h1 className="truncate text-[19px] font-bold leading-tight text-[#0f172a]">{tituloClinica}</h1>
        )}
      </div>
    </>
  );

  if (canSeeConfig) {
    return (
      <button
        type="button"
        onClick={() => onOpenClinicaSettings?.()}
        className={`${outer.button}${extra}`}
        aria-label="Abrir dados da clínica"
      >
        {content}
      </button>
    );
  }

  return (
    <div className={`${outer.static}${extra}`}>
      {content}
    </div>
  );
}
