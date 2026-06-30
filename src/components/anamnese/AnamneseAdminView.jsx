// ⚠️ APOSENTADO — substituído pelo roteamento direto em ConfigDetailView (PerguntasCategoriasPanel + FichasPanel). Não usar/importar. Remover após validação em produção.
import React, { useState, useCallback, useEffect } from 'react';
import { ClipboardList, Tag, HelpCircle, FileText, X, Settings } from 'lucide-react';
import { CategoryManager } from './CategoryManager';
import { QuestionManager } from './QuestionManager';
import { FichaBuilder } from './FichaBuilder';
import { AnamneseConfigPublicaPanel } from './AnamneseConfigPublicaPanel';

const TABS = [
  { key: 'categorias', label: 'Categorias', icon: Tag },
  { key: 'perguntas', label: 'Banco de Perguntas', icon: HelpCircle },
  { key: 'fichas', label: 'Fichas', icon: FileText },
  { key: 'config', label: 'Acesso Público', icon: Settings },
];

function TabButton({ tabKey, label, icon, active, onSelect, variant }) {
  const Icon = icon;
  if (variant === 'desktop') {
    return (
      <button
        type="button"
        onClick={() => onSelect(tabKey)}
        className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl font-bold text-[13px] text-left transition-all border ${
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

/**
 * @param {object} [props]
 * @param {'categorias' | 'perguntas' | 'fichas'} [props.embeddedSection] — quando definido pela tela pai (ex.: Configurações), oculta a navegação interna e fixa a aba.
 */
export function AnamneseAdminView({ embeddedSection } = {}) {
  const [activeTab, setActiveTab] = useState(() =>
    embeddedSection && ['categorias', 'perguntas', 'fichas'].includes(embeddedSection)
      ? embeddedSection
      : 'categorias'
  );
  const [painelCategoria, setPainelCategoria] = useState(null);

  const embedded = Boolean(
    embeddedSection && ['categorias', 'perguntas', 'fichas'].includes(embeddedSection)
  );

  useEffect(() => {
    if (!embeddedSection || !['categorias', 'perguntas', 'fichas'].includes(embeddedSection)) return;
    setActiveTab(embeddedSection);
  }, [embeddedSection]);

  const handleVerPerguntasDaCategoria = useCallback(({ id, nome }) => {
    setPainelCategoria({ id, nome });
  }, []);

  const fecharPainelCategoria = useCallback(() => {
    setPainelCategoria(null);
  }, []);

  useEffect(() => {
    if (activeTab !== 'categorias') {
      setPainelCategoria(null);
    }
  }, [activeTab]);

  useEffect(() => {
    if (painelCategoria == null || activeTab !== 'categorias') return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') fecharPainelCategoria();
    };
    window.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [painelCategoria, fecharPainelCategoria, activeTab]);

  return (
    <div className={`flex flex-col ${embedded ? '' : 'lg:flex-row lg:gap-8 xl:gap-10'}`}>
      {/* Coluna esquerda: contexto + abas (mobile: topo; desktop: sidebar) — oculto quando embutido em Configurações */}
      {!embedded && (
      <div className="flex-shrink-0 lg:w-56 xl:w-64 lg:border-r-[3px] lg:border-[#00a88e]/10 lg:pr-8">
        <div className="flex items-center gap-3 sm:gap-4 mb-4 lg:mb-5">
          <div className="bg-[#f3e8ff] p-2.5 sm:p-3 rounded-2xl text-[#a855f7] border border-fuchsia-200 lg:p-3">
            <ClipboardList className="w-6 h-6 sm:w-7 sm:h-7" strokeWidth={2.5} />
          </div>
          <div className="min-w-0 flex-1 lg:pr-0">
            <h3 className="text-[17px] sm:text-[18px] lg:text-[16px] font-bold text-[#0f172a] leading-tight">Configuração de Anamnese</h3>
            <p className="text-[#64748b] text-[12px] sm:text-[13px] lg:text-[11px] font-medium mt-0.5 leading-snug lg:hidden">
              Categorias, perguntas e fichas reutilizáveis
            </p>
          </div>
        </div>

        <div className="flex border-b border-app-border mb-4 overflow-x-auto lg:hidden -mx-1 px-1">
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
      )}

      {/* Área principal: ocupa o restante da largura no desktop */}
      <div className="flex-1 min-w-0 flex flex-col">
        {activeTab === 'categorias' && (
          <>
            <CategoryManager onVerPerguntas={handleVerPerguntasDaCategoria} />
            {painelCategoria != null && (
              <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-6">
                <button
                  type="button"
                  aria-label="Fechar painel"
                  className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                  onClick={fecharPainelCategoria}
                />
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="painel-perguntas-categoria-titulo"
                  className="relative z-10 w-full max-w-6xl max-h-[90vh] flex flex-col bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden"
                >
                  <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[#e2e8f0] flex-shrink-0">
                    <h3 id="painel-perguntas-categoria-titulo" className="text-[16px] sm:text-[17px] font-bold text-[#0f172a] leading-snug min-w-0 pr-2">
                      Perguntas — {painelCategoria.nome}
                    </h3>
                    <button
                      type="button"
                      onClick={fecharPainelCategoria}
                      className="p-2 rounded-xl text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#0f172a] flex-shrink-0"
                      aria-label="Fechar"
                    >
                      <X className="w-5 h-5" strokeWidth={2.5} />
                    </button>
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 custom-scrollbar">
                    <QuestionManager
                      embeddedInPanel
                      lockedCategoryId={painelCategoria.id}
                      panelTitle={painelCategoria.nome}
                    />
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        {activeTab === 'perguntas' && <QuestionManager />}
        {activeTab === 'fichas' && <FichaBuilder />}
        {activeTab === 'config' && (
          <div className="p-4 sm:p-6 lg:p-8">
            <AnamneseConfigPublicaPanel />
          </div>
        )}
      </div>
    </div>
  );
}
