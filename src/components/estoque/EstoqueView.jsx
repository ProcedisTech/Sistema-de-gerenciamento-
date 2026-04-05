import React, { useState } from 'react';
import { Package, LayoutList, History } from 'lucide-react';
import { ItensEstoqueManager } from './ItensEstoqueManager';
import { MovimentacoesManager } from './MovimentacoesManager';

const TABS = [
  { key: 'inventario', label: 'Inventário', icon: LayoutList },
  { key: 'historico', label: 'Histórico', icon: History },
];

function TabButton({ tabKey, label, icon, active, onSelect, variant }) {
  const Icon = icon;

  if (variant === 'desktop') {
    return (
      <button
        type="button"
        onClick={() => onSelect(tabKey)}
        className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl font-bold text-[13px] text-left transition-all border-[3px] ${
          active
            ? 'text-[#00a88e] border-[#00a88e] bg-[#f0fdfa] shadow-sm'
            : 'text-[#64748b] border-transparent bg-[#f8fbfb] hover:border-[#00a88e]/20 hover:text-[#0f766e]'
        }`}
      >
        <Icon className="w-5 h-5 flex-shrink-0" strokeWidth={2} />
        <span className="leading-snug">{label}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(tabKey)}
      className={`flex items-center gap-2 px-5 py-4 font-bold text-[13px] whitespace-nowrap transition-all border-b-[3px] -mb-[3px] ${
        active
          ? 'text-[#00a88e] border-[#00a88e] bg-[#f0fdfa]'
          : 'text-[#64748b] border-transparent hover:text-[#00a88e] hover:bg-[#f8fbfb]'
      }`}
    >
      <Icon className="w-4 h-4" /> {label}
    </button>
  );
}

export function EstoqueView() {
  const [activeTab, setActiveTab] = useState('inventario');

  return (
    <div className="flex flex-col flex-1 min-h-0 lg:flex-row lg:gap-8 xl:gap-10">
      <div className="flex-shrink-0 lg:w-56 xl:w-64 lg:border-r-[3px] lg:border-[#00a88e]/10 lg:pr-8">
        <div className="flex items-center gap-3 sm:gap-4 mb-4 lg:mb-5">
          <div className="bg-[#fef3c7] p-2.5 sm:p-3 rounded-2xl text-[#f59e0b] border-[3px] border-[#f59e0b]/25 lg:p-3">
            <Package className="w-6 h-6 sm:w-7 sm:h-7" strokeWidth={2.5} />
          </div>
          <div className="min-w-0 flex-1 lg:pr-0">
            <h3 className="text-[17px] sm:text-[18px] lg:text-[16px] font-bold text-[#0f172a] leading-tight">Gestão de Estoque</h3>
            <p className="text-[#64748b] text-[12px] sm:text-[13px] lg:text-[11px] font-medium mt-0.5 leading-snug lg:hidden">
              FIFO com controle de validade
            </p>
          </div>
        </div>

        <div className="flex border-b-[3px] border-[#00a88e]/10 mb-4 overflow-x-auto lg:hidden -mx-1 px-1">
          {TABS.map(({ key, label, icon }) => (
            <TabButton key={key} tabKey={key} label={label} icon={icon} active={activeTab === key} onSelect={setActiveTab} />
          ))}
        </div>

        <nav className="hidden lg:flex lg:flex-col gap-2 sticky top-0">
          {TABS.map(({ key, label, icon }) => (
            <TabButton key={key} tabKey={key} label={label} icon={icon} active={activeTab === key} onSelect={setActiveTab} variant="desktop" />
          ))}
        </nav>
      </div>

      <div className="flex-1 min-w-0 min-h-0 flex flex-col">
        <div className="flex-1 min-h-0 flex flex-col">
          {activeTab === 'inventario' && <ItensEstoqueManager />}
          {activeTab === 'historico' && <MovimentacoesManager />}
        </div>
      </div>
    </div>
  );
}
