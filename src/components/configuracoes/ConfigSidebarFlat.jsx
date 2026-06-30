import React from 'react';

/**
 * Sidebar flat (sem accordion) para a visão de detalhe do Settings Hub.
 * Recebe um array de itens já filtrados por permissão — exibe todos visíveis sem colapsar.
 *
 * @param {object} props
 * @param {Array<{ id: string, label: string, icon: React.ElementType, subtitle?: string }>} props.items
 * @param {string} props.activeSection   — configSection ativo
 * @param {(id: string) => void} props.onSelect
 */
export function ConfigSidebarFlat({ items, activeSection, onSelect }) {
  if (!items || items.length === 0) return null;

  return (
    <aside className="hidden h-full w-[220px] shrink-0 flex-col overflow-y-auto overflow-x-hidden border-b border-[#e2e8f0] bg-[#f8fafc] px-2 py-2 md:flex md:border-b-0 md:border-r">
      <ul className="flex flex-col gap-0.5" role="list">
        {items.map((item) => (
          <li key={item.id}>
            <SidebarFlatItem
              icon={item.icon}
              label={item.label}
              subtitle={item.subtitle}
              active={activeSection === item.id}
              onClick={() => onSelect(item.id)}
            />
          </li>
        ))}
      </ul>
    </aside>
  );
}

function SidebarFlatItem({ icon, label, subtitle, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-medium transition-colors ${
        active
          ? 'bg-white font-semibold text-[#0f172a] ring-1 ring-[#e2e8f0] shadow-sm'
          : 'text-[#64748b] hover:bg-white/60 hover:text-[#0f172a]'
      }`}
    >
      {React.createElement(icon, {
        className: `mt-0.5 h-4 w-4 shrink-0 ${active ? 'text-[#00a88e]' : ''}`,
        strokeWidth: 2,
        'aria-hidden': true,
      })}
      <span className="min-w-0 flex-1">
        <span className="block break-words leading-snug">{label}</span>
        {subtitle && (
          <span className="block text-[10px] font-normal leading-tight text-[#94a3b8] mt-0.5">
            {subtitle}
          </span>
        )}
      </span>
    </button>
  );
}
