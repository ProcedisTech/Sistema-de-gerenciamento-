import React from 'react';
import {
  Users,
  AlertCircle,
  BadgeCheck,
  UserPlus,
  Cake,
} from 'lucide-react';

const CARDS = [
  {
    id: 'ativos',
    label: 'Todos ativos',
    icon: Users,
    iconBg: 'bg-[#e6f7f5]',
    iconColor: 'text-[#00a88e]',
    valueBorder: 'border-[#00a88e]/20',
    activeBorder: 'ring-2 ring-[#00a88e]/40',
  },
  {
    id: 'risco',
    label: 'Em risco',
    sublabel: 'sem retorno 60d+',
    icon: AlertCircle,
    iconBg: 'bg-red-50',
    iconColor: 'text-red-500',
    valueBorder: 'border-red-100',
    activeBorder: 'ring-2 ring-red-300/50',
  },
  {
    id: 'planos',
    label: 'Planos ativos',
    icon: BadgeCheck,
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-500',
    valueBorder: 'border-blue-100',
    activeBorder: 'ring-2 ring-blue-300/50',
  },
  {
    id: 'novos',
    label: 'Novos',
    sublabel: 'este mês',
    icon: UserPlus,
    iconBg: 'bg-[#e6f7f5]',
    iconColor: 'text-[#047857]',
    valueBorder: 'border-[#00a88e]/20',
    activeBorder: 'ring-2 ring-[#00a88e]/40',
  },
  {
    id: 'aniversariantes',
    label: 'Aniversariantes',
    sublabel: 'deste mês',
    icon: Cake,
    iconBg: 'bg-pink-50',
    iconColor: 'text-pink-500',
    valueBorder: 'border-pink-100',
    activeBorder: 'ring-2 ring-pink-300/50',
  },
];

function getTotal(kpi, id) {
  switch (id) {
    case 'ativos': return kpi?.totalAtivos ?? null;
    case 'risco': return kpi?.totalEmRisco ?? null;
    case 'planos': return kpi?.totalPlanosAtivos ?? null;
    case 'novos': return kpi?.totalNovos ?? null;
    case 'aniversariantes': return kpi?.totalAniversariantes ?? null;
    default: return null;
  }
}

/**
 * 5 cards de KPI clicáveis acima da lista de pacientes.
 *
 * Props:
 *   kpi            — objeto retornado por usePatientsKpi
 *   loading        — boolean
 *   activeCard     — id do card ativo (string | null)
 *   onActivateFilter — (cardId: string) => void
 */
export function KpiCards({ kpi, loading, activeCard, onActivateFilter }) {
  return (
    <div className="hidden lg:grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {CARDS.map((card) => {
        const Icon = card.icon;
        const total = getTotal(kpi, card.id);
        const isActive = activeCard === card.id;

        return (
          <button
            key={card.id}
            type="button"
            onClick={() => onActivateFilter && onActivateFilter(card.id)}
            className={`flex flex-col gap-2 rounded-xl border bg-white p-4 text-left transition-all hover:border-[#cbd5e1] hover:shadow-sm ${
              isActive
                ? `border-[#00a88e]/40 shadow-sm ${card.activeBorder}`
                : 'border-[#e2e8f0]'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748b]">
                {card.label}
              </p>
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${card.iconBg}`}>
                <Icon className={`h-3.5 w-3.5 ${card.iconColor}`} strokeWidth={2.2} aria-hidden />
              </span>
            </div>

            {loading ? (
              <div className="h-8 w-16 animate-pulse rounded-md bg-[#e2e8f0]" />
            ) : (
              <p className="text-[28px] font-bold leading-none tracking-tight text-[#0f172a]">
                {total !== null ? total.toLocaleString('pt-BR') : '—'}
              </p>
            )}

            {card.sublabel ? (
              <p className="text-[11px] text-[#94a3b8]">{card.sublabel}</p>
            ) : (
              <p className="text-[11px] text-transparent select-none">·</p>
            )}
          </button>
        );
      })}
    </div>
  );
}
