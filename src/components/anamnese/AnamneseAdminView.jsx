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

export function AnamneseAdminView() {
  const [activeTab, setActiveTab] = useState('categorias');

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <div className="bg-[#f3e8ff] p-3 rounded-2xl text-[#a855f7] border-[3px] border-[#a855f7]/25">
          <ClipboardList className="w-7 h-7" strokeWidth={2.5} />
        </div>
        <div>
          <h3 className="text-[20px] font-bold text-[#0f172a]">Configuração de Anamnese</h3>
          <p className="text-[#64748b] text-[14px] font-medium">Gerencie categorias, perguntas e fichas reutilizáveis</p>
        </div>
      </div>

      <div className="flex border-b-[3px] border-[#00a88e]/10 mb-6 overflow-x-auto">
        {TABS.map(({ key, label, icon }) => {
          const TabIcon = icon;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-5 py-4 font-bold text-[13px] whitespace-nowrap transition-all border-b-[3px] -mb-[3px] ${
                activeTab === key
                  ? 'text-[#00a88e] border-[#00a88e] bg-[#f0fdfa]'
                  : 'text-[#64748b] border-transparent hover:text-[#00a88e] hover:bg-[#f8fbfb]'
              }`}
            >
              <TabIcon className="w-4 h-4" /> {label}
            </button>
          );
        })}
      </div>

      {activeTab === 'categorias' && <CategoryManager />}
      {activeTab === 'perguntas' && <QuestionManager />}
      {activeTab === 'fichas' && <FichaBuilder />}
    </div>
  );
}
