import React, { useState, useMemo } from 'react';
import {
  FileText,
  Tag,
  HelpCircle,
  ClipboardList,
  User,
  UserX,
  Building2,
  Settings,
  Clock,
  CalendarDays,
  MessageCircle,
  Stethoscope,
  Globe,
  ChevronDown,
} from 'lucide-react';
import { AuditoriaView } from './AuditoriaView';
import { AnamneseAdminView, AnamneseConfigPublicaPanel } from '../anamnese';
import { TermosManager } from '../termos/TermosManager';
import { DadosClinicaPanel } from './DadosClinicaPanel';
import { PerfilProfissionalPanel } from './PerfilProfissionalPanel';
import { HorarioClinicaPanel } from './HorarioClinicaPanel';
import { FeriadosPanel } from './FeriadosPanel';
import { TemplatesMensagemPanel } from './TemplatesMensagemPanel';
import { PacientesInativadosPanel } from './PacientesInativadosPanel';
import { BancoProcedimentosPanel } from './BancoProcedimentosPanel';
import { authHeadersForFetch } from '../../services/api';
import { readCollapsedGroups, persistCollapsedGroups } from './configSectionStorage';

const SECTION_SUBTITLE = {
  fichas: 'Gerencie fichas de anamnese',
  categorias: 'Organize categorias de perguntas',
  perguntas: 'Banco de perguntas reutilizáveis',
  termos: 'Termos de consentimento',
  procedimentos: 'Catálogo de procedimentos da clínica',
  perfil: 'Suas informações e assinatura profissional',
  clinica: 'Informações, logo e endereço da organização',
  'horarios-funcionamento': 'Horários de funcionamento da clínica',
  'agenda-feriados': 'Feriados em que a clínica não atende',
  'agenda-templates': 'Mensagens automáticas de WhatsApp',
  'pacientes-inativados': 'Pacientes fora da listagem principal',
  'anamnese-publica': 'Configurações de acesso público',
};

// ── Map each section to its group key (used for auto-expand) ─────────────────
const SECTION_TO_GROUP = {
  procedimentos: 'clinica-group',
  termos: 'clinica-group',
  categorias: 'anamnese',
  perguntas: 'anamnese',
  fichas: 'anamnese',
  'anamnese-publica': 'anamnese',
  perfil: 'meu-perfil',
  clinica: 'organizacao',
  'horarios-funcionamento': 'agenda',
  'agenda-feriados': 'agenda',
  'agenda-templates': 'agenda',
  'pacientes-inativados': 'equipe',
};

const ALL_GROUP_KEYS = ['clinica-group', 'anamnese', 'meu-perfil', 'organizacao', 'agenda', 'equipe'];

// ── Collapsible Nav Group ─────────────────────────────────────────────────────

function CollapsibleNavGroup({ groupKey, label, isOpen, onToggle, children }) {
  if (!children || (Array.isArray(children) && children.filter(Boolean).length === 0)) return null;

  return (
    <div className="mb-1">
      <button
        type="button"
        onClick={() => onToggle(groupKey)}
        className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left group hover:bg-white/40 transition-colors"
      >
        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#94a3b8] group-hover:text-[#64748b] transition-colors">
          {label}
        </p>
        <ChevronDown
          className={`h-3 w-3 text-[#94a3b8] group-hover:text-[#64748b] transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
          strokeWidth={2.5}
        />
      </button>
      {isOpen && (
        <div className="mt-0.5">
          {children}
        </div>
      )}
    </div>
  );
}

function SidebarNavItem({ icon, label, subtitle, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`mx-0 flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-medium transition-colors ${
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
          <span className="block text-[10px] font-normal leading-tight text-[#94a3b8] mt-0.5">{subtitle}</span>
        )}
      </span>
    </button>
  );
}

// ── Mobile section dropdown ───────────────────────────────────────────────────

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
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          {/* Menu */}
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
 * @param {boolean} [props.canSeeEquipe]         — N5+: usuários, pacientes inativados
 * @param {string}  props.configSection
 * @param {(s: string) => void} props.setConfigSection
 * @param {(nome: string, logoUrl?: string) => void} [props.onClinicaAtualizada]
 * @param {(data: { nomeCompleto?: string, fotoUrl?: string }) => void} [props.onPerfilAtualizado]
 * @param {() => void} [props.onPacientesCatalogRefresh]
 * @param {(opts?: { roleUserId?: string, scope?: 'all' | 'role' }) => void | Promise<void>} [props.onDisponibilidadeInvalidate]
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
  configSection,
  setConfigSection,
}) {
  const subtitle = SECTION_SUBTITLE[configSection] ?? SECTION_SUBTITLE.fichas;

  // ── Collapsible sidebar state ──────────────────────────────────────────────
  const activeGroup = SECTION_TO_GROUP[configSection] || '';

  // openGroups tracks which groups are open as { key: true/false }
  // Default: only the active group is open, all others collapsed
  const [openGroups, setOpenGroups] = useState(() => {
    const stored = readCollapsedGroups();
    if (stored.size > 0) {
      // Stored = set of collapsed group keys. Invert to get open state.
      const open = {};
      ALL_GROUP_KEYS.forEach((k) => { open[k] = !stored.has(k); });
      // Always force active group open on load
      if (activeGroup) open[activeGroup] = true;
      return open;
    }
    // First visit: only active group is open
    const open = {};
    ALL_GROUP_KEYS.forEach((k) => { open[k] = false; });
    if (activeGroup) open[activeGroup] = true;
    return open;
  });

  // When active section changes, ensure its group is open
  React.useEffect(() => {
    if (activeGroup) {
      setOpenGroups((prev) => {
        if (prev[activeGroup]) return prev; // already open, no change
        return { ...prev, [activeGroup]: true };
      });
    }
  }, [activeGroup]);

  const isGroupOpen = (groupKey) => !!openGroups[groupKey];

  const toggleGroup = (groupKey) => {
    // Não permite colapsar o grupo da seção ativa
    if (groupKey === activeGroup) return;

    setOpenGroups((prev) => {
      const next = { ...prev, [groupKey]: !prev[groupKey] };
      // Persist as collapsed set (keys that are closed)
      const collapsed = new Set();
      ALL_GROUP_KEYS.forEach((k) => {
        if (!next[k]) collapsed.add(k);
      });
      persistCollapsedGroups(collapsed);
      return next;
    });
  };

  // ── Build mobile-friendly groups ─────────────────────────────────────────
  const mobileGroups = useMemo(() => {
    const groups = [];

    if (canSeeProcedimentos || canSeeTermos) {
      const items = [];
      if (canSeeProcedimentos) items.push({ id: 'procedimentos', label: 'Procedimentos', icon: Stethoscope });
      if (canSeeTermos) items.push({ id: 'termos', label: 'Termos de Consentimento', icon: FileText });
      groups.push({ key: 'clinica-group', label: 'Clínica', items });
    }

    if (canSeeAnamnese) {
      groups.push({
        key: 'anamnese',
        label: 'Anamnese',
        items: [
          { id: 'categorias', label: 'Categorias', icon: Tag },
          { id: 'perguntas', label: 'Banco de Perguntas', icon: HelpCircle },
          { id: 'fichas', label: 'Fichas', icon: ClipboardList },
          { id: 'anamnese-publica', label: 'Acesso Público', icon: Globe },
        ],
      });
    }

    if (canSeePerfil) {
      groups.push({
        key: 'meu-perfil',
        label: 'Meu Perfil',
        items: [{ id: 'perfil', label: 'Meus Dados', icon: User }],
      });
    }

    if (canSeeClinica) {
      groups.push({
        key: 'organizacao',
        label: 'Dados da Organização',
        items: [{ id: 'clinica', label: 'Dados da Clínica', icon: Building2 }],
      });
    }

    if (canSeeAgendaConfig) {
      groups.push({
        key: 'agenda',
        label: 'Agenda',
        items: [
          { id: 'horarios-funcionamento', label: 'Horário de atendimento', icon: Clock },
          { id: 'agenda-feriados', label: 'Feriados', icon: CalendarDays },
          { id: 'agenda-templates', label: 'Templates de mensagem', icon: MessageCircle },
        ],
      });
    }

    if (canSeeEquipe) {
      groups.push({
        key: 'equipe',
        label: 'Equipe',
        items: [{ id: 'pacientes-inativados', label: 'Pacientes Inativados', icon: UserX }],
      });
    }

    return groups;
  }, [canSeeAnamnese, canSeeProcedimentos, canSeeTermos, canSeePerfil, canSeeClinica, canSeeAgendaConfig, canSeeEquipe]);

  return (
    <div className="flex min-h-0 min-w-0 flex-col">
      <div className="mb-5 flex items-start gap-3 border-b border-[#e2e8f0] pb-5 md:mb-6 md:pb-6">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#e2e8f0] bg-[#f8fafc] text-[#64748b]">
          <Settings className="h-5 w-5" strokeWidth={2} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-[18px] font-bold leading-tight text-[#0f172a] sm:text-[21px] md:text-[22px]">
            Configurações
          </h2>
          <p className="mt-0.5 text-[12px] font-medium leading-snug text-[#64748b] sm:text-[13px] md:text-[14px]">
            {subtitle}
          </p>
        </div>
      </div>

      {/* Mobile (<768px): dropdown agrupado */}
      <MobileSectionDropdown
        groups={mobileGroups}
        activeSection={configSection}
        onSelectSection={setConfigSection}
      />

      <div className="flex min-h-[min(70dvh,720px)] min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-[#e2e8f0] bg-white md:flex-row">
        {/* Sidebar interna — desktop / tablet */}
        <aside className="hidden h-full w-[220px] shrink-0 flex-col overflow-y-auto overflow-x-hidden border-b border-[#e2e8f0] bg-[#f8fafc] px-2 py-2 md:flex md:border-b-0 md:border-r">

          {/* ── Clínica: Procedimentos + Termos (N4+) ─────────────────────── */}
          {(canSeeProcedimentos || canSeeTermos) && (
            <CollapsibleNavGroup
              groupKey="clinica-group"
              label="Clínica"
              isOpen={isGroupOpen('clinica-group')}
              onToggle={toggleGroup}
            >
              {canSeeProcedimentos && (
                <SidebarNavItem
                  icon={Stethoscope}
                  label="Procedimentos"
                  subtitle="Catálogo de serviços"
                  active={configSection === 'procedimentos'}
                  onClick={() => setConfigSection('procedimentos')}
                />
              )}
              {canSeeTermos && (
                <SidebarNavItem
                  icon={FileText}
                  label={<>Termos de{' '}<wbr />Consentimento</>}
                  subtitle="Documentos legais"
                  active={configSection === 'termos'}
                  onClick={() => setConfigSection('termos')}
                />
              )}
            </CollapsibleNavGroup>
          )}

          {/* ── Anamnese: categorias, perguntas, fichas (N3+) ──────────────── */}
          {canSeeAnamnese && (
            <CollapsibleNavGroup
              groupKey="anamnese"
              label="Anamnese"
              isOpen={isGroupOpen('anamnese')}
              onToggle={toggleGroup}
            >
              <SidebarNavItem
                icon={Tag}
                label="Categorias"
                active={configSection === 'categorias'}
                onClick={() => setConfigSection('categorias')}
              />
              <SidebarNavItem
                icon={HelpCircle}
                label="Banco de Perguntas"
                active={configSection === 'perguntas'}
                onClick={() => setConfigSection('perguntas')}
              />
              <SidebarNavItem
                icon={ClipboardList}
                label="Fichas"
                active={configSection === 'fichas'}
                onClick={() => setConfigSection('fichas')}
              />
              <SidebarNavItem
                icon={Globe}
                label="Acesso Público"
                active={configSection === 'anamnese-publica'}
                onClick={() => setConfigSection('anamnese-publica')}
              />
            </CollapsibleNavGroup>
          )}

          {/* ── Meu Perfil (N4+) ────────────────────────────────────────────── */}
          {canSeePerfil && (
            <CollapsibleNavGroup
              groupKey="meu-perfil"
              label="Meu Perfil"
              isOpen={isGroupOpen('meu-perfil')}
              onToggle={toggleGroup}
            >
              <SidebarNavItem
                icon={User}
                label="Meus Dados"
                subtitle="Informações e assinatura"
                active={configSection === 'perfil'}
                onClick={() => setConfigSection('perfil')}
              />
            </CollapsibleNavGroup>
          )}

          {/* ── Dados da Organização (N5+) ──────────────────────────────────── */}
          {canSeeClinica && (
            <CollapsibleNavGroup
              groupKey="organizacao"
              label="Dados da Organização"
              isOpen={isGroupOpen('organizacao')}
              onToggle={toggleGroup}
            >
              <SidebarNavItem
                icon={Building2}
                label="Dados da Clínica"
                subtitle="Logo, endereço, CNPJ"
                active={configSection === 'clinica'}
                onClick={() => setConfigSection('clinica')}
              />
            </CollapsibleNavGroup>
          )}

          {/* ── Agenda: horários, feriados, templates (N5+) ────────────────── */}
          {canSeeAgendaConfig && (
            <CollapsibleNavGroup
              groupKey="agenda"
              label="Agenda"
              isOpen={isGroupOpen('agenda')}
              onToggle={toggleGroup}
            >
              <SidebarNavItem
                icon={Clock}
                label="Horário de atendimento"
                active={configSection === 'horarios-funcionamento'}
                onClick={() => setConfigSection('horarios-funcionamento')}
              />
              <SidebarNavItem
                icon={CalendarDays}
                label="Feriados"
                active={configSection === 'agenda-feriados'}
                onClick={() => setConfigSection('agenda-feriados')}
              />
              <SidebarNavItem
                icon={MessageCircle}
                label="Templates de mensagem"
                active={configSection === 'agenda-templates'}
                onClick={() => setConfigSection('agenda-templates')}
              />
            </CollapsibleNavGroup>
          )}

          {/* ── Equipe: pacientes inativados (N5+) ─────────────────────────── */}
          {canSeeEquipe && (
            <CollapsibleNavGroup
              groupKey="equipe"
              label="Equipe"
              isOpen={isGroupOpen('equipe')}
              onToggle={toggleGroup}
            >
              <SidebarNavItem
                icon={UserX}
                label="Pacientes Inativados"
                active={configSection === 'pacientes-inativados'}
                onClick={() => setConfigSection('pacientes-inativados')}
              />
            </CollapsibleNavGroup>
          )}
        </aside>

        {/* Conteúdo principal */}
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto [-webkit-overflow-scrolling:touch] px-3 py-4 sm:px-5 sm:py-6 md:px-6 md:py-8">

          {/* Procedimentos — N4+ */}
          {configSection === 'procedimentos' && canSeeProcedimentos && <BancoProcedimentosPanel />}

          {/* Termos — N4+ */}
          {configSection === 'termos' && canSeeTermos && <TermosManager />}

          {/* Anamnese — N3+ */}
          {(configSection === 'categorias' || configSection === 'perguntas' || configSection === 'fichas') &&
            canSeeAnamnese && (
              <AnamneseAdminView embeddedSection={configSection} />
            )}
          {configSection === 'anamnese-publica' && canSeeAnamnese && (
            <AnamneseConfigPublicaPanel />
          )}

          {/* Perfil — N4+ */}
          {configSection === 'perfil' && canSeePerfil && (
            <PerfilProfissionalPanel
              getAuthHeaders={() => authHeadersForFetch({ needsOrg: false })}
              onPerfilAtualizado={onPerfilAtualizado}
            />
          )}

          {/* Dados da Clínica — N5+ */}
          {configSection === 'clinica' && canSeeClinica && (
            <DadosClinicaPanel
              getAuthHeaders={() => authHeadersForFetch({ needsOrg: true })}
              onClinicaAtualizada={onClinicaAtualizada}
            />
          )}

          {/* Agenda — N5+ */}
          {configSection === 'horarios-funcionamento' && canSeeAgendaConfig && (
            <HorarioClinicaPanel onDisponibilidadeInvalidate={onDisponibilidadeInvalidate} />
          )}
          {configSection === 'agenda-feriados'        && canSeeAgendaConfig && <FeriadosPanel />}
          {configSection === 'agenda-templates'       && canSeeAgendaConfig && <TemplatesMensagemPanel />}

          {/* Pacientes Inativados — N5+ */}
          {configSection === 'pacientes-inativados' && canSeeEquipe && (
            <PacientesInativadosPanel onPacientesCatalogRefresh={onPacientesCatalogRefresh} />
          )}
        </div>
      </div>
    </div>
  );
}
