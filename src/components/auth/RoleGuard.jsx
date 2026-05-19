import React from 'react';
import { usePapel } from '../../hooks/usePapel';
import { ShieldAlert } from 'lucide-react';

/**
 * @param {{
 *   allowedRoles?: string[],
 *   minLevel?: 'DONO'|'NIVEL_5'|'NIVEL_4'|'NIVEL_3'|'NIVEL_2'|'NIVEL_1',
 *   fallback?: React.ReactNode,
 *   showError?: boolean,
 *   children: React.ReactNode
 * }} props
 */
export function RoleGuard({ 
  allowedRoles, 
  minLevel, 
  fallback = null, 
  showError = false, 
  children 
}) {
  const { papel, isAtLeast } = usePapel();

  let isAuthorized = true;

  if (allowedRoles && !allowedRoles.includes(papel)) {
    isAuthorized = false;
  }

  if (minLevel && !isAtLeast(minLevel)) {
    isAuthorized = false;
  }

  if (!isAuthorized) {
    if (showError) {
      return (
        <div className="flex flex-col items-center justify-center p-8 rounded-2xl border border-app-border bg-white shadow-sm text-center">
          <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-4">
            <ShieldAlert className="h-6 w-6 text-red-500" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-1">Acesso Restrito</h3>
          <p className="text-sm text-slate-500 max-w-[280px]">
            Você não possui permissão para acessar esta funcionalidade.
          </p>
        </div>
      );
    }
    return fallback;
  }

  return <>{children}</>;
}
