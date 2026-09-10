import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ConfigSidebarFlat } from './ConfigSidebarFlat';
import { ConfigBreadcrumb } from './ConfigBreadcrumb';
import { CATEGORY_DEFS, filterCategoryItems } from './configHubDefs';
import { UnsavedChangesModal } from '../shared/UnsavedChangesModal';

// Painéis de conteúdo
import { AnamneseConfigPublicaPanel, AnamneseFichasHome } from '../anamnese';
import { TermosManager } from '../termos/TermosManager';
import { MetodosAssinaturaPanel } from './MetodosAssinaturaPanel';
import { DadosClinicaPanel } from './DadosClinicaPanel';
import { PerfilProfissionalPanel } from './PerfilProfissionalPanel';
import { HorarioClinicaPanel } from './HorarioClinicaPanel';
import { FeriadosPanel } from './FeriadosPanel';
import { TemplatesMensagemPanel } from './TemplatesMensagemPanel';
import { PacientesInativadosPanel } from './PacientesInativadosPanel';
import { BancoProcedimentosPanel } from './BancoProcedimentosPanel';
import { authHeadersForFetch } from '../../services/api';

/**
 * Visão de detalhe do Settings Hub.
 * Mostra sidebar flat (itens filtrados) + painel do item ativo + breadcrumb.
 * A troca de painel é animada com fade; a sidebar permanece imóvel.
 *
 * @param {object} props
 * @param {string}  props.categoryKey
 * @param {string}  props.configSection
 * @param {(s: string) => void} props.setConfigSection
 * @param {() => void} props.onBackToHub
 * @param {boolean} props.canSeeAnamnese
 * @param {boolean} props.canSeeProcedimentos
 * @param {boolean} props.canSeeTermos
 * @param {boolean} props.canSeePerfil
 * @param {boolean} props.canSeeClinica
 * @param {boolean} props.canSeeAgendaConfig
 * @param {boolean} props.canSeeEquipe
 * @param {(nome: string, logoUrl?: string) => void} [props.onClinicaAtualizada]
 * @param {(data: { nomeCompleto?: string, fotoUrl?: string }) => void} [props.onPerfilAtualizado]
 * @param {() => void} [props.onPacientesCatalogRefresh]
 * @param {(opts?) => void} [props.onDisponibilidadeInvalidate]
 * @param {(isDirty: boolean) => void} [props.onDirtyHorariosChange]
 * @param {(isDirty: boolean) => void} [props.onDirtyFichaChange]
 * @param {React.MutableRefObject<((id: string) => void) | null>} [props.sectionGuardRef]
 */
export function ConfigDetailView({
  categoryKey,
  configSection,
  setConfigSection,
  onBackToHub,
  canSeeAnamnese,
  canSeeProcedimentos,
  canSeeTermos,
  canSeePerfil,
  canSeeClinica,
  canSeeAgendaConfig,
  canSeeEquipe,
  onClinicaAtualizada,
  onPerfilAtualizado,
  onPacientesCatalogRefresh,
  onDisponibilidadeInvalidate,
  onDirtyHorariosChange,
  onDirtyFichaChange,
  sectionGuardRef,
}) {
  const flags = { canSeeAnamnese, canSeeProcedimentos, canSeeTermos, canSeePerfil, canSeeClinica, canSeeAgendaConfig, canSeeEquipe };

  const categoryDef = CATEGORY_DEFS.find((c) => c.key === categoryKey);
  const visibleItems = categoryDef ? filterCategoryItems(categoryDef, flags) : [];

  const effectiveSection =
    visibleItems.find((i) => i.id === configSection)
      ? configSection
      : visibleItems[0]?.id ?? configSection;

  // ── Guard de alterações não salvas ────────────────────────────────────────
  // isDirtyHorarios sobrevive à remontagem do painel (key={effectiveSection} está
  // no <div> interno L90, não neste componente).
  const [isDirtyHorarios, setIsDirtyHorarios] = useState(false);
  const [isDirtyFicha, setIsDirtyFicha] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [fichaDetailLabel, setFichaDetailLabel] = useState(null);
  const pendingAction = useRef(null);
  const fichasHomeRef = useRef(null);

  const handleDirtyHorariosChange = (dirty) => {
    setIsDirtyHorarios(dirty);
    onDirtyHorariosChange?.(dirty);
  };

  const handleDirtyFichaChange = (dirty) => {
    setIsDirtyFicha(dirty);
    onDirtyFichaChange?.(dirty);
  };

  const hasUnsavedChanges = isDirtyHorarios || isDirtyFicha;

  /** Intercepta qualquer navegação quando há alterações não salvas. */
  const guardedNavigate = (action) => {
    if (hasUnsavedChanges) {
      pendingAction.current = action;
      setModalOpen(true);
    } else {
      action();
    }
  };

  const handleModalContinue = () => {
    setModalOpen(false);
    pendingAction.current = null;
  };

  const handleModalDiscard = () => {
    setModalOpen(false);
    setIsDirtyFicha(false);
    setIsDirtyHorarios(false);
    onDirtyFichaChange?.(false);
    onDirtyHorariosChange?.(false);
    const action = pendingAction.current;
    pendingAction.current = null;
    action?.();
  };

  const applySection = (id) => {
    if (id === 'fichas') {
      fichasHomeRef.current?.exitToList?.();
    }
    setConfigSection(id);
  };

  const handleSetConfigSection = (id) => guardedNavigate(() => applySection(id));
  const handleBackToHub = () => guardedNavigate(() => onBackToHub());

  const getPerfilAuthHeaders = useCallback(
    () => authHeadersForFetch({ needsOrg: false }),
    [],
  );

  useEffect(() => {
    if (!sectionGuardRef) return undefined;
    sectionGuardRef.current = handleSetConfigSection;
    return () => {
      sectionGuardRef.current = null;
    };
  });

  return (
    <>
      <UnsavedChangesModal
        isOpen={modalOpen}
        onContinue={handleModalContinue}
        onDiscard={handleModalDiscard}
        message={
          isDirtyFicha && isDirtyHorarios
            ? 'Você tem alterações não salvas na ficha e no horário de atendimento. Deseja sair sem salvar?'
            : isDirtyFicha
              ? 'Você tem alterações não salvas na ficha de anamnese. Deseja sair sem salvar?'
              : undefined
        }
      />

      <div className="flex min-h-0 flex-1 flex-col">
        {/* Breadcrumb */}
        <div className="mb-4">
          <ConfigBreadcrumb
            categoryLabel={categoryDef?.label}
            detailLabel={effectiveSection === 'fichas' ? fichaDetailLabel : null}
            onBackToHub={handleBackToHub}
          />
        </div>

        {/* Layout sidebar + conteúdo */}
        <div className="flex min-h-[min(70dvh,720px)] min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-[#e2e8f0] bg-white md:flex-row">
          {/* Sidebar flat — desktop */}
          <ConfigSidebarFlat
            items={visibleItems}
            activeSection={effectiveSection}
            onSelect={handleSetConfigSection}
          />

          {/* Painel com rise — key força re-mount apenas no painel ao trocar seção */}
          <div
            key={effectiveSection}
            className="animate-agenda-rise min-h-0 min-w-0 flex-1 overflow-y-auto [-webkit-overflow-scrolling:touch] px-3 py-4 sm:px-5 sm:py-6 md:px-6 md:py-8"
          >
            <PainelAtivo
              configSection={effectiveSection}
              canSeeAnamnese={canSeeAnamnese}
              canSeeProcedimentos={canSeeProcedimentos}
              canSeeTermos={canSeeTermos}
              canSeePerfil={canSeePerfil}
              canSeeClinica={canSeeClinica}
              canSeeAgendaConfig={canSeeAgendaConfig}
              canSeeEquipe={canSeeEquipe}
              getPerfilAuthHeaders={getPerfilAuthHeaders}
              onClinicaAtualizada={onClinicaAtualizada}
              onPerfilAtualizado={onPerfilAtualizado}
              onPacientesCatalogRefresh={onPacientesCatalogRefresh}
              onDisponibilidadeInvalidate={onDisponibilidadeInvalidate}
              onDirtyHorariosChange={handleDirtyHorariosChange}
              onDirtyFichaChange={handleDirtyFichaChange}
              onFichaDetailLabelChange={setFichaDetailLabel}
              fichasHomeRef={fichasHomeRef}
            />
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * Renderização condicional dos painéis.
 * Guards de permissão duplicados aqui como segunda linha de defesa.
 */
function PainelAtivo({
  configSection,
  canSeeProcedimentos,
  canSeeTermos,
  canSeeAnamnese,
  canSeePerfil,
  canSeeClinica,
  canSeeAgendaConfig,
  canSeeEquipe,
  getPerfilAuthHeaders,
  onClinicaAtualizada,
  onPerfilAtualizado,
  onPacientesCatalogRefresh,
  onDisponibilidadeInvalidate,
  onDirtyHorariosChange,
  onDirtyFichaChange,
  onFichaDetailLabelChange,
  fichasHomeRef,
}) {
  if (configSection === 'procedimentos' && canSeeProcedimentos) {
    return <BancoProcedimentosPanel />;
  }
  if (configSection === 'termos' && canSeeTermos) {
    return <TermosManager />;
  }
  if (configSection === 'metodos-assinatura' && canSeeTermos) {
    return <MetodosAssinaturaPanel />;
  }
  if (configSection === 'fichas' && canSeeAnamnese) {
    return (
      <AnamneseFichasHome
        ref={fichasHomeRef}
        onFichaNomeChange={onFichaDetailLabelChange}
        onDirtyFichaChange={onDirtyFichaChange}
      />
    );
  }
  if (configSection === 'anamnese-publica' && canSeeAnamnese) {
    return <AnamneseConfigPublicaPanel />;
  }
  if (configSection === 'perfil' && canSeePerfil) {
    return (
      <PerfilProfissionalPanel
        getAuthHeaders={getPerfilAuthHeaders}
        onPerfilAtualizado={onPerfilAtualizado}
      />
    );
  }
  if (configSection === 'clinica' && canSeeClinica) {
    return (
      <DadosClinicaPanel
        getAuthHeaders={() => authHeadersForFetch({ needsOrg: true })}
        onClinicaAtualizada={onClinicaAtualizada}
      />
    );
  }
  if (configSection === 'horarios-funcionamento' && canSeeAgendaConfig) {
    return (
      <HorarioClinicaPanel
        onDisponibilidadeInvalidate={onDisponibilidadeInvalidate}
        onDirtyChange={onDirtyHorariosChange}
      />
    );
  }
  if (configSection === 'agenda-feriados' && canSeeAgendaConfig) {
    return <FeriadosPanel />;
  }
  if (configSection === 'agenda-templates' && canSeeAgendaConfig) {
    return <TemplatesMensagemPanel />;
  }
  if (configSection === 'pacientes-inativados' && canSeeEquipe) {
    return <PacientesInativadosPanel onPacientesCatalogRefresh={onPacientesCatalogRefresh} />;
  }

  return null;
}
