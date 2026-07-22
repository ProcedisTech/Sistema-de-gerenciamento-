import React, { useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, Loader2 } from 'lucide-react';

/**
 * Bloco de alertas clínicos (perfil clínico + respostas de anamnese em ALERTA/alergia).
 * `variant="sidebar"` renderiza só o conteúdo (para embutir dentro do card "Alertas" já
 * existente no perfil do paciente). `variant="hub"` envolve o conteúdo no próprio card
 * vermelho, para uso standalone (ex.: topo do Hub de consulta).
 */
export function AlertasClinicosPanel({
  alertasPerfil = [],
  alertasAnamnese = [],
  alertasAlergia = [],
  isLoading = false,
  variant = 'sidebar',
  onVerTodos,
  defaultCollapsed = false,
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const alertasSidebarGeral = useMemo(() => {
    const keys = new Set(alertasAlergia.map((x) => x.key));
    return alertasAnamnese.filter((row) => !keys.has(row.key));
  }, [alertasAnamnese, alertasAlergia]);

  const totalCount = alertasPerfil.length + alertasAnamnese.length;

  const content = (
    <div className="space-y-1.5">
      <span className="text-[10px] font-bold uppercase tracking-wide text-[#dc2626]">Alertas clínicos</span>
      {isLoading ? (
        <div className="flex items-center gap-2 text-[11px] font-medium text-[#64748b]">
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[#dc2626]" aria-hidden />
          Carregando alertas…
        </div>
      ) : alertasPerfil.length === 0 && alertasAnamnese.length === 0 ? (
        <p className="text-[11px] font-medium leading-snug text-[#64748b]">Nenhum alerta clínico registrado.</p>
      ) : (
        <>
          {alertasPerfil.length > 0 && (
            <div className="space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-[#64748b]">
                Perfil clínico
              </span>
              {alertasPerfil.map((item) => (
                <div key={item.key} className="rounded-md border border-[#fecaca] bg-[#fef2f2] px-2 py-1.5">
                  <p className="line-clamp-1 text-[10px] font-bold uppercase tracking-wide text-[#dc2626]">
                    {item.titulo}
                  </p>
                  <p className="line-clamp-2 text-[12px] font-semibold text-[#0f172a]">{item.valor}</p>
                </div>
              ))}
            </div>
          )}
          {alertasAnamnese.length > 0 && (
            <div className="space-y-1">
              {alertasPerfil.length > 0 && (
                <span className="text-[10px] font-semibold uppercase tracking-wide text-[#64748b]">Anamnese</span>
              )}
              {alertasAlergia.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-[#dc2626]">
                    Alergias registradas
                  </span>
                  {alertasAlergia.map((item) => (
                    <div key={item.key} className="rounded-md border border-[#fecaca] bg-[#fef2f2] px-2 py-1.5">
                      <p className="line-clamp-2 text-[11px] font-bold text-[#dc2626]">{item.titulo}</p>
                      <p className="line-clamp-3 text-[12px] font-semibold text-[#0f172a]">{item.valor}</p>
                    </div>
                  ))}
                </div>
              )}
              {alertasSidebarGeral.slice(0, 3).map((row) => (
                <div key={row.key} className="rounded-md border border-[#fecaca] bg-[#fef2f2]/80 px-2 py-1.5">
                  <p className="line-clamp-2 text-[11px] font-bold uppercase tracking-wide text-[#dc2626]">
                    {row.titulo}
                  </p>
                  <p className="mt-0.5 line-clamp-3 break-words text-[12px] font-semibold text-[#0f172a]">
                    {row.valor}
                  </p>
                </div>
              ))}
            </div>
          )}
          {typeof onVerTodos === 'function' && totalCount > 3 ? (
            <button
              type="button"
              onClick={onVerTodos}
              className="mt-1 flex h-7 w-full items-center justify-center rounded-md border border-[#fecaca] text-[11px] font-semibold text-[#dc2626] transition-colors hover:bg-[#fef2f2]"
            >
              Ver todos ({totalCount})
            </button>
          ) : null}
        </>
      )}
    </div>
  );

  if (variant === 'hub') {
    return (
      <div className="overflow-hidden rounded-[14px] border border-[#fecaca] shadow-md">
        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          aria-expanded={!collapsed}
          className="flex w-full items-center justify-between gap-2 bg-[#fef2f2] px-3 py-2 text-left"
        >
          <span className="flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-[#dc2626]" strokeWidth={2.5} aria-hidden />
            <h5 className="text-[12px] font-bold text-[#dc2626]">
              Alertas clínicos{totalCount > 0 ? ` (${totalCount})` : ''}
            </h5>
          </span>
          <ChevronDown
            className={`h-3.5 w-3.5 shrink-0 text-[#dc2626] transition-transform ${collapsed ? '' : 'rotate-180'}`}
            strokeWidth={2.5}
            aria-hidden
          />
        </button>
        {!collapsed && <div className="bg-white p-2.5">{content}</div>}
      </div>
    );
  }

  return content;
}
