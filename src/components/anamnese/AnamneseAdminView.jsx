import React, { useState } from 'react';
import { ClipboardList, Tag, HelpCircle, FileText } from 'lucide-react';
import { CategoryManager } from './CategoryManager';
import { QuestionManager } from './QuestionManager';
import { FichaBuilder } from './FichaBuilder';

const TABS = [
  { key: 'categorias', label: 'Categorias', icon: Tag },
  { key: 'perguntas', label: 'Banco de Perguntas', icon: HelpCircle },
  { key: 'fichas', label: 'Fichas', icon: FileText },
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

export function AnamneseAdminView() {
  const [activeTab, setActiveTab] = useState('categorias');

  return (
    <div className="flex flex-col lg:flex-row lg:gap-8 xl:gap-10">
      {/* Coluna esquerda: contexto + abas (mobile: topo; desktop: sidebar) */}
      <div className="flex-shrink-0 lg:w-56 xl:w-64 lg:border-r-[3px] lg:border-[#00a88e]/10 lg:pr-8">
        <div className="flex items-center gap-3 sm:gap-4 mb-4 lg:mb-5">
          <div className="bg-[#f3e8ff] p-2.5 sm:p-3 rounded-2xl text-[#a855f7] border-[3px] border-[#a855f7]/25 lg:p-3">
            <ClipboardList className="w-6 h-6 sm:w-7 sm:h-7" strokeWidth={2.5} />
          </div>
          <div className="min-w-0 flex-1 lg:pr-0">
            <h3 className="text-[17px] sm:text-[18px] lg:text-[16px] font-bold text-[#0f172a] leading-tight">Configuração de Anamnese</h3>
            <p className="text-[#64748b] text-[12px] sm:text-[13px] lg:text-[11px] font-medium mt-0.5 leading-snug lg:hidden">
              Categorias, perguntas e fichas reutilizáveis
            </p>
          </div>
        </div>

        <div className="flex border-b-[3px] border-[#00a88e]/10 mb-4 overflow-x-auto lg:hidden -mx-1 px-1">
          {TABS.map(({ key, label, icon }) => (
            <TabButton
              key={key}
              tabKey={key}
              label={label}
              icon={icon}
              active={activeTab === key}
              onSelect={setActiveTab}
            />
          ))}
        </div>

        <nav className="hidden lg:flex lg:flex-col gap-2 sticky top-0">
          {TABS.map(({ key, label, icon }) => (
            <TabButton
              key={key}
              tabKey={key}
              label={label}
              icon={icon}
              active={activeTab === key}
              onSelect={setActiveTab}
              variant="desktop"
            />
          ))}
        </nav>
      </div>

      {/* Área principal: ocupa o restante da largura no desktop */}
      <div className="flex-1 min-w-0 flex flex-col">
        {activeTab === 'categorias' && <CategoryManager />}
        {activeTab === 'perguntas' && <QuestionManager />}
        {activeTab === 'fichas' && <FichaBuilder />}
      </div>
    </div>
  );
}
