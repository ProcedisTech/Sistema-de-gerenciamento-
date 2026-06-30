import React, { useState, useMemo } from 'react';
import { Settings, ChevronDown } from 'lucide-react';
import { ConfigHub } from './ConfigHub';
import { getVisibleCategories, CATEGORY_DEFS, filterCategoryItems } from './configHubDefs';
import { ConfigDetailView } from './ConfigDetailView';

/**
 * Flags granulares de acesso por seção (vindas de usePapel via AppRefactored).
 *
 * @param {object} props
 * @param {boolean} [props.canSeeAnamnese]       — N3+: categorias, perguntas, fichas
 * @param {boolean} [props.canSeeProcedimentos]  — N4+: procedimentos + termos
 * @param {boolean} [props.canSeeTermos]         — N4+
 * @param {boolean} [props.canSeePerfil]         — N4+: perfil profissional
 * @param {boolean} [props.canSeeClinica]        — N5+: dados da clínica
 * @param {boolean} [props.canSeeAgendaConfig]   — N5+: horários, feriados, templates
 * @param {boolean} [props.canSeeEquipe]         — N5+: pacientes inativados
 * @param {string}  props.configSection
 * @param {(s: string) => void} props.setConfigSection
 * @param {(nome: string, logoUrl?: string) => void} [props.onClinicaAtualizada]
 * @param {(data: { nomeCompleto?: string, fotoUrl?: string }) => void} [props.onPerfilAtualizado]
 * @param {() => void} [props.onPacientesCatalogRefresh]
 * @param {(opts?: { roleUserId?: string, scope?: 'all' | 'role' }) => void | Promise<void>} [props.onDisponibilidadeInvalidate]
 * @param {(isDirty: boolean) => void} [props.onDirtyHorariosChange]
 */
export function ConfiguracoesView({
  canSeeAnamnese = false,
  canSeeProcedimentos = false,
  canSeeTermos = false,
  canSeePerfil = false,
  canSeeClinica = false,
  canSeeAgendaConfig = false,
  canSeeEquipe = false,
  onClinicaAtualizada,
  onPerfilAtualizado,
  onPacientesCatalogRefresh,
  onDisponibilidadeInvalidate,
  onDirtyHorariosChange,
  configSection,
  setConfigSection,
}) {
  const flags = { canSeeAnamnese, canSeeProcedimentos, canSeeTermos, canSeePerfil, canSeeClinica, canSeeAgendaConfig, canSeeEquipe };

  // Categoria ativa: null = hub. Inicializa em detalhe se vier um deep-link (configSection não-null do pai).
  const [activeCategory, setActiveCategory] = useState(() => {
    if (!configSection) return null;
    // Encontra a categoria pelo configSection recebido
    const found = CATEGORY_DEFS.find((cat) =>
      cat.items.some((item) => item.id === configSection)
    );
    return found?.key ?? null;
  });

  const displayCategory = configSection == null ? null : activeCategory;

  // Grupos para o mobile dropdown — mantém compatibilidade com MobileSectionDropdown
  const mobileGroups = useMemo(() => {
    const f = {
      canSeeAnamnese,
      canSeeProcedimentos,
      canSeeTermos,
      canSeePerfil,
      canSeeClinica,
      canSeeAgendaConfig,
      canSeeEquipe,
    };
    return getVisibleCategories(f).map((cat) => ({
      key: cat.key,
      label: cat.label,
      items: cat.visibleItems,
    }));
  }, [canSeeAnamnese, canSeeProcedimentos, canSeeTermos, canSeePerfil, canSeeClinica, canSeeAgendaConfig, canSeeEquipe]);

  const handleSelectCategory = (categoryKey) => {
    setActiveCategory(categoryKey);
    // Ao entrar em uma categoria, garantir que a seção ativa seja um item visível
    const catDef = CATEGORY_DEFS.find((c) => c.key === categoryKey);
    if (catDef) {
      const visibleItems = filterCategoryItems(catDef, flags);
      const alreadyInCategory = visibleItems.some((i) => i.id === configSection);
      if (!alreadyInCategory && visibleItems.length > 0) {
        setConfigSection(visibleItems[0].id);
      }
    }
  };

  const handleBackToHub = () => {
    setActiveCategory(null);
  };

  // Label da seção ativa para o subtítulo no header (hub ou detalhe)
  const headerSubtitle = displayCategory
    ? CATEGORY_DEFS.find((c) => c.key === displayCategory)?.description ?? 'Configurações'
    : 'Selecione uma área para configurar';

  return (
    <div className="flex min-h-0 min-w-0 flex-col">
      {/* Header */}
      <div className="mb-5 flex items-start gap-3 border-b border-[#e2e8f0] pb-5 md:mb-6 md:pb-6">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#e2e8f0] bg-[#f8fafc] text-[#64748b]">
          <Settings className="h-5 w-5" strokeWidth={2} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-[18px] font-bold leading-tight text-[#0f172a] sm:text-[21px] md:text-[22px]">
            Configurações
          </h2>
          <p className="mt-0.5 text-[12px] font-medium leading-snug text-[#64748b] sm:text-[13px] md:text-[14px]">
            {headerSubtitle}
          </p>
        </div>
      </div>

      {/* Mobile: dropdown flat quando em detalhe; sem dropdown no hub */}
      {displayCategory && (
        <MobileSectionDropdown
          groups={mobileGroups}
          activeSection={configSection}
          onSelectSection={setConfigSection}
        />
      )}

      {/* Conteúdo — hub ou detalhe, animado com fade */}
      <div key={displayCategory ?? 'hub'} className="animate-config-fade-in flex min-h-0 flex-1 flex-col">
        {displayCategory === null ? (
          <ConfigHub
            canSeeAnamnese={canSeeAnamnese}
            canSeeProcedimentos={canSeeProcedimentos}
            canSeeTermos={canSeeTermos}
            canSeePerfil={canSeePerfil}
            canSeeClinica={canSeeClinica}
            canSeeAgendaConfig={canSeeAgendaConfig}
            canSeeEquipe={canSeeEquipe}
            onSelectCategory={handleSelectCategory}
          />
        ) : (
          <ConfigDetailView
            categoryKey={displayCategory}
            configSection={configSection}
            setConfigSection={setConfigSection}
            onBackToHub={handleBackToHub}
            canSeeAnamnese={canSeeAnamnese}
            canSeeProcedimentos={canSeeProcedimentos}
            canSeeTermos={canSeeTermos}
            canSeePerfil={canSeePerfil}
            canSeeClinica={canSeeClinica}
            canSeeAgendaConfig={canSeeAgendaConfig}
            canSeeEquipe={canSeeEquipe}
            onClinicaAtualizada={onClinicaAtualizada}
            onPerfilAtualizado={onPerfilAtualizado}
            onPacientesCatalogRefresh={onPacientesCatalogRefresh}
            onDisponibilidadeInvalidate={onDisponibilidadeInvalidate}
            onDirtyHorariosChange={onDirtyHorariosChange}
          />
        )}
      </div>
    </div>
  );
}

// ── Mobile section dropdown ───────────────────────────────────────────────────
// Mantido aqui pois é exclusivo de ConfiguracoesView (mobile) e não vale extrair.

function MobileSectionDropdown({ groups, activeSection, onSelectSection }) {
  const [isOpen, setIsOpen] = useState(false);

  const activeLabel = useMemo(() => {
    for (const group of groups) {
      for (const item of group.items) {
        if (item.id === activeSection) return item.label;
      }
    }
    return 'Selecionar seção';
  }, [groups, activeSection]);

  const ActiveIcon = useMemo(() => {
    for (const group of groups) {
      for (const item of group.items) {
        if (item.id === activeSection) return item.icon;
      }
    }
    return Settings;
  }, [groups, activeSection]);

  return (
    <div className="relative mb-4 md:hidden">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-xl border border-[#e2e8f0] bg-white px-4 py-3 text-left shadow-sm transition-colors hover:border-[#00a88e]/30 min-h-[48px]"
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <ActiveIcon className="h-4 w-4 shrink-0 text-[#00a88e]" strokeWidth={2} aria-hidden />
          <span className="text-[14px] font-semibold text-[#0f172a] truncate">{activeLabel}</span>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-[#64748b] shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          strokeWidth={2}
        />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[60vh] overflow-y-auto rounded-xl border border-[#e2e8f0] bg-white shadow-xl [-webkit-overflow-scrolling:touch]">
            {groups.map((group, gi) => (
              <div key={group.key}>
                {gi > 0 && <hr className="border-[#e2e8f0]" />}
                <p className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#94a3b8]">
                  {group.label}
                </p>
                {group.items.map((item) => {
                  const ItemIcon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        onSelectSection(item.id);
                        setIsOpen(false);
                      }}
                      className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[13px] font-medium transition-colors min-h-[44px] ${
                        activeSection === item.id
                          ? 'bg-[#f0fdf9] text-[#0f766e] font-semibold'
                          : 'text-[#475569] hover:bg-[#f8fafc]'
                      }`}
                    >
                      <ItemIcon
                        className={`h-4 w-4 shrink-0 ${activeSection === item.id ? 'text-[#00a88e]' : 'text-[#94a3b8]'}`}
                        strokeWidth={2}
                        aria-hidden
                      />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
