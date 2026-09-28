import React from 'react';
import { displayInitials } from './identityDisplay';

export function UsuarioAvatarInner({ perfilFotoResolved, displayName }) {
  if (perfilFotoResolved) {
    return (
      <img
        src={perfilFotoResolved}
        alt=""
        className="h-full w-full object-cover"
      />
    );
  }
  return displayInitials(displayName);
}

const OUTER_CLASSES = {
  sidebar: {
    button:
      'mx-4 mb-6 mt-4 flex w-[calc(100%-2rem)] items-center gap-3 rounded-[14px] border border-app-border bg-app-nav-active p-3 text-left shadow-app-card transition-colors hover:bg-[#e8f5f3] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/60',
    static:
      'mx-4 mb-6 mt-4 flex w-[calc(100%-2rem)] items-center gap-3 rounded-[14px] border border-app-border bg-app-nav-active p-3 shadow-app-card',
  },
  header: {
    button:
      'flex min-w-0 items-center gap-3 rounded-full p-1.5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/60 lg:p-0 min-[1440px]:bg-app-nav-active min-[1440px]:pr-4 min-[1440px]:shadow-app-card min-[1440px]:ring-1 min-[1440px]:ring-app-border min-[1440px]:hover:bg-[#e8f5f3] min-[1440px]:focus-visible:ring-2 min-[1440px]:focus-visible:ring-emerald-300/60',
    static:
      'flex min-w-0 items-center gap-3 rounded-full p-1.5 lg:p-0 min-[1440px]:bg-app-nav-active min-[1440px]:pr-4 min-[1440px]:shadow-app-card min-[1440px]:ring-1 min-[1440px]:ring-app-border',
  },
};

/**
 * Cartão de identidade do usuário (foto + nome + cargo), usado na Sidebar e no GlobalHeader.
 *
 * @param {{
 *   variant?: 'sidebar' | 'header',
 *   displayName: string,
 *   shortName?: string,
 *   perfilFotoResolved?: string,
 *   roleLabel: string,
 *   canSeeConfig?: boolean,
 *   onOpenPerfilSettings?: () => void,
 * }} props
 */
export function UsuarioIdentityCard({
  variant = 'sidebar',
  displayName,
  shortName,
  perfilFotoResolved,
  roleLabel,
  canSeeConfig,
  onOpenPerfilSettings,
}) {
  const isHeader = variant === 'header';
  const outer = OUTER_CLASSES[variant] || OUTER_CLASSES.sidebar;

  const content = (
    <>
      <div
        className={
          isHeader
            ? 'relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-app-accent text-sm font-bold text-white ring-[1.5px] ring-app-accent ring-offset-2 ring-offset-white lg:h-10 lg:w-10'
            : 'relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#00a88e] text-sm font-bold text-white'
        }
      >
        <UsuarioAvatarInner perfilFotoResolved={perfilFotoResolved} displayName={displayName} />
      </div>
      <div className={isHeader ? 'hidden min-w-0 max-w-[140px] min-[1440px]:block' : 'min-w-0 flex-1'}>
        <h2
          title={displayName}
          aria-label={displayName}
          className="truncate text-[14px] font-bold leading-tight text-app-accent-deep"
        >
          {shortName || displayName}
        </h2>
        <p className="truncate text-[12px] font-medium text-app-accent">{roleLabel}</p>
      </div>
    </>
  );

  if (canSeeConfig) {
    return (
      <button
        type="button"
        onClick={() => onOpenPerfilSettings?.()}
        className={outer.button}
        aria-label="Abrir perfil do profissional"
      >
        {content}
      </button>
    );
  }

  return (
    <div className={outer.static}>
      {content}
    </div>
  );
}
