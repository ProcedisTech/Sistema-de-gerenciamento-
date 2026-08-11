import React, { useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, Loader2 } from 'lucide-react';
import { ANAMNESE_STYLE, COLOR_CLASSES, SECAO_STYLE } from './alertaSeveridadeStyle.js';

const MAX_SIDEBAR_CHIPS = 6;

function buildChipItems(alertasPerfil, alertasAnamnese) {
  // Perfil: o titulo é só o nome genérico da categoria ("Medicamento em uso",
  // "Antecedente"...) — o dado específico (qual medicamento, qual antecedente) está em
  // valor, então é isso que precisa aparecer no chip.
  const chips = alertasPerfil.map((item) => {
    const style = SECAO_STYLE[item.secao] ?? SECAO_STYLE.antecedentes;
    return {
      key: item.key,
      label: item.valor || item.titulo,
      categoria: item.titulo,
      color: style.color,
      Icon: style.Icon,
    };
  });
  // Anamnese: titulo é a pergunta específica ("Alergia a látex?"); valor costuma ser só
  // "Sim"/"Positivo" — o titulo é a parte informativa aqui.
  alertasAnamnese.forEach((item) => {
    chips.push({
      key: item.key,
      label: item.titulo || item.valor,
      categoria: item.valor,
      color: ANAMNESE_STYLE.color,
      Icon: ANAMNESE_STYLE.Icon,
    });
  });
  return chips;
}

function AlertChip(props) {
  const { label, categoria, color } = props;
  const Icon = props.Icon;
  const title = categoria && categoria !== label ? `${categoria}: ${label}` : label;
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold ${COLOR_CLASSES[color]}`}
    >
      <Icon className="h-3 w-3 shrink-0" strokeWidth={2.5} aria-hidden />
      <span>{label}</span>
    </span>
  );
}

/**
 * Bloco de alertas clínicos (perfil clínico + respostas de anamnese em ALERTA/alergia),
 * renderizado como chips compactos coloridos por severidade (vermelho: alergia a
 * princípio ativo / antecedente / anamnese; laranja: alergia alimentar; azul: medicamento
 * em uso). `variant="sidebar"` devolve só o conteúdo (para embutir no card "Alertas" do
 * perfil do paciente). `variant="hub"` envolve o conteúdo numa barra colapsável, pensada
 * para ficar fixa no cabeçalho da consulta.
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

  const chips = useMemo(
    () => buildChipItems(alertasPerfil, alertasAnamnese),
    [alertasPerfil, alertasAnamnese]
  );
  const totalCount = chips.length;

  if (variant === 'hub') {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-red-200 bg-red-50/60 px-3 py-2">
        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          aria-expanded={!collapsed}
          className="flex shrink-0 items-center gap-1.5 text-[12px] font-bold text-red-700"
        >
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
          Alertas clínicos{totalCount > 0 ? ` (${totalCount})` : ''}
          <ChevronDown
            className={`h-3.5 w-3.5 shrink-0 transition-transform ${collapsed ? '' : 'rotate-180'}`}
            strokeWidth={2.5}
            aria-hidden
          />
        </button>
        {!collapsed ? (
          isLoading ? (
            <span className="flex items-center gap-2 text-[11px] font-medium text-[#64748b]">
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-red-600" aria-hidden />
              Carregando alertas…
            </span>
          ) : (
            <div className="flex flex-wrap items-center gap-1.5">
              {chips.map((chip) => (
                <AlertChip key={chip.key} label={chip.label} categoria={chip.categoria} color={chip.color} Icon={chip.Icon} />
              ))}
            </div>
          )
        ) : null}
      </div>
    );
  }

  const hasVerTodos = typeof onVerTodos === 'function';
  const visibleChips = hasVerTodos ? chips.slice(0, MAX_SIDEBAR_CHIPS) : chips;

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
          <div className="flex flex-wrap gap-1.5">
            {visibleChips.map((chip) => (
              <AlertChip key={chip.key} label={chip.label} valor={chip.valor} color={chip.color} Icon={chip.Icon} />
            ))}
          </div>
          {hasVerTodos && totalCount > MAX_SIDEBAR_CHIPS ? (
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
