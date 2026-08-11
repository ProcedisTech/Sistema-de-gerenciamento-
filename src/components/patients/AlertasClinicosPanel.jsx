import React, { useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, Loader2 } from 'lucide-react';
import {
  CARD_BORDER_CLASSES,
  CARD_DOT_CLASSES,
  CARD_LABEL_CLASSES,
  COLOR_CLASSES,
} from './alertaSeveridadeStyle.js';
import { buildGroupedChips } from './alertaGrouping.js';

const MAX_SIDEBAR_ITEMS = 6;

/** Corta a lista de grupos em `max` itens no total, preservando a ordem dos campos. */
function capGroups(groups, max) {
  let remaining = max;
  const capped = [];
  for (const group of groups) {
    if (remaining <= 0) break;
    const items = group.items.slice(0, remaining);
    remaining -= items.length;
    capped.push({ ...group, items });
  }
  return capped;
}

/**
 * Grade de cards por campo — um bloco por categoria com borda superior colorida, contagem
 * e itens em lista com marcador. Mesmo componente usado na barra do hub e no modal "Ver
 * todos" (o modal é a versão ampliada dos mesmos cards).
 */
export function AlertasGroupCards({ groups, columns = 'grid-cols-2 sm:grid-cols-4' }) {
  return (
    <div className={`grid gap-2 ${columns}`}>
      {groups.map((group) => {
        const GroupIcon = group.Icon;
        return (
          <div
            key={group.secao}
            className={`rounded-lg border-t-[3px] bg-white p-2.5 shadow-sm ${CARD_BORDER_CLASSES[group.color]}`}
          >
            <div className="mb-1.5 flex items-center justify-between gap-1.5">
              <span
                className={`flex min-w-0 items-center gap-1 text-[10px] font-bold uppercase tracking-wide ${CARD_LABEL_CLASSES[group.color]}`}
              >
                <GroupIcon className="h-3 w-3 shrink-0" strokeWidth={2.5} aria-hidden />
                <span className="truncate">{group.label}</span>
              </span>
              <span className="shrink-0 rounded-full bg-slate-100 px-1.5 text-[10px] font-bold text-[#64748b]">
                {group.items.length}
              </span>
            </div>
            <ul className="flex flex-col gap-1">
              {group.items.map((item) => (
                <li key={item.key} className="flex items-start gap-1.5">
                  <span
                    className={`mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full ${CARD_DOT_CLASSES[group.color]}`}
                    aria-hidden
                  />
                  <span
                    title={item.label}
                    className="min-w-0 break-words text-[11.5px] font-semibold leading-snug text-[#0f172a]"
                  >
                    {item.label}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Bloco de alertas clínicos (perfil clínico + respostas de anamnese em ALERTA/alergia).
 * `variant="sidebar"` devolve só o conteúdo (para embutir no cartão "Alertas" do perfil do
 * paciente) — chips agrupados por campo, com um rótulo curto acima de cada grupo.
 * `variant="hub"` envolve o conteúdo numa barra colapsável fixa no cabeçalho da consulta,
 * com os mesmos dados em cards por campo.
 */
export function AlertasClinicosPanel({
  alertasPerfil = [],
  // alertasAnamnese já inclui os itens de alertasAlergia (ver useAlertasClinicos.js) —
  // aceito aqui apenas por compatibilidade com os call sites existentes.
  alertasAnamnese = [],
  // eslint-disable-next-line no-unused-vars
  alertasAlergia = [],
  isLoading = false,
  variant = 'sidebar',
  onVerTodos,
  defaultCollapsed = false,
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  const groups = useMemo(
    () => buildGroupedChips(alertasPerfil, alertasAnamnese),
    [alertasPerfil, alertasAnamnese]
  );
  const totalCount = useMemo(
    () => groups.reduce((sum, group) => sum + group.items.length, 0),
    [groups]
  );

  if (variant === 'hub') {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50/60 px-3 py-2.5">
        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          aria-expanded={!collapsed}
          className="flex w-full items-center gap-1.5 text-[12px] font-bold text-red-700"
        >
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
          Alertas clínicos
          {totalCount > 0 ? (
            <span className="font-semibold text-red-600">
              {' '}
              — {totalCount} no total, {groups.length} {groups.length === 1 ? 'campo' : 'campos'}
            </span>
          ) : null}
          <ChevronDown
            className={`h-3.5 w-3.5 shrink-0 transition-transform ${collapsed ? '' : 'rotate-180'}`}
            strokeWidth={2.5}
            aria-hidden
          />
        </button>
        {!collapsed ? (
          isLoading ? (
            <span className="mt-2 flex items-center gap-2 text-[11px] font-medium text-[#64748b]">
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-red-600" aria-hidden />
              Carregando alertas…
            </span>
          ) : (
            <div className="mt-2.5">
              <AlertasGroupCards groups={groups} />
            </div>
          )
        ) : null}
      </div>
    );
  }

  const hasVerTodos = typeof onVerTodos === 'function';
  const visibleGroups = hasVerTodos ? capGroups(groups, MAX_SIDEBAR_ITEMS) : groups;

  return (
    <div className="space-y-1.5">
      <span className="text-[10px] font-bold uppercase tracking-wide text-red-700">Alertas clínicos</span>
      {isLoading ? (
        <div className="flex items-center gap-2 text-[11px] font-medium text-[#64748b]">
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-red-600" aria-hidden />
          Carregando alertas…
        </div>
      ) : totalCount === 0 ? (
        <p className="text-[11px] font-medium leading-snug text-[#64748b]">Nenhum alerta clínico registrado.</p>
      ) : (
        <>
          <div className="space-y-2">
            {visibleGroups.map((group) => {
              const GroupIcon = group.Icon;
              return (
                <div key={group.secao}>
                  <p
                    className={`mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide ${CARD_LABEL_CLASSES[group.color]}`}
                  >
                    <GroupIcon className="h-3 w-3 shrink-0" strokeWidth={2.5} aria-hidden />
                    {group.label}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {group.items.map((item) => (
                      <span
                        key={item.key}
                        title={item.label}
                        className={`inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-semibold ${COLOR_CLASSES[group.color]}`}
                      >
                        {item.label}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          {hasVerTodos && totalCount > MAX_SIDEBAR_ITEMS ? (
            <button
              type="button"
              onClick={onVerTodos}
              className="mt-1 flex h-7 w-full items-center justify-center rounded-md border border-red-200 text-[11px] font-semibold text-red-700 transition-colors hover:bg-red-50"
            >
              Ver todos ({totalCount})
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}
