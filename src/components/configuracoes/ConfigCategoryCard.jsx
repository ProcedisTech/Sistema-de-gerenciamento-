import React from 'react';
import { ChevronRight } from 'lucide-react';

/**
 * Card individual de categoria no Settings Hub.
 *
 * @param {object} props
 * @param {React.ElementType} props.icon       — ícone lucide
 * @param {string} props.color                 — cor accent do card (hex)
 * @param {string} props.label                 — nome da categoria
 * @param {string} props.description           — descrição curta
 * @param {number} props.itemCount             — qtd de itens visíveis ao usuário
 * @param {() => void} props.onClick
 * @param {number} [props.entranceDelayMs]     — delay do stagger de entrada (agenda-rise)
 */
export function ConfigCategoryCard({
  icon,
  color,
  label,
  description,
  itemCount,
  badge,
  onClick,
  entranceDelayMs,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group animate-agenda-rise flex w-full flex-col gap-3 rounded-xl border border-[#e2e8f0] bg-white p-5 text-left shadow-app-card transition-all hover:border-[#cbd5e1] hover:shadow-agenda-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00a88e]/50"
      style={entranceDelayMs != null ? { animationDelay: `${entranceDelayMs}ms` } : undefined}
    >
      {/* Ícone + seta */}
      <div className="flex items-start justify-between">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${color}18`, color }}
        >
          {React.createElement(icon, { className: 'h-5 w-5', strokeWidth: 2, 'aria-hidden': true })}
        </div>
        <div className="flex items-center gap-2">
          {badge ? (
            <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700">
              {badge}
            </span>
          ) : null}
          <ChevronRight
            className="h-4 w-4 shrink-0 text-[#94a3b8] transition-transform group-hover:translate-x-0.5 group-hover:text-[#64748b]"
            strokeWidth={2}
            aria-hidden
          />
        </div>
      </div>

      {/* Texto */}
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold leading-snug text-[#0f172a]">{label}</p>
        <p className="mt-0.5 text-[12px] leading-snug text-[#64748b]">{description}</p>
      </div>

      {/* Contagem */}
      <p className="text-[11px] font-medium text-[#94a3b8]">
        {itemCount === 1 ? '1 item' : `${itemCount} itens`}
      </p>
    </button>
  );
}
