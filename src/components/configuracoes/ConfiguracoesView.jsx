import React from 'react';
import {
  FileText,
  Tag,
  HelpCircle,
  ClipboardList,
  User,
  UserX,
  Building2,
  Settings,
  Users,
  Clock,
  CalendarDays,
  MessageCircle,
  Stethoscope,
  Globe,
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

const SECTION_SUBTITLE = {
  fichas: 'Gerencie fichas de anamnese',
  categorias: 'Organize categorias de perguntas',
  perguntas: 'Banco de perguntas reutilizáveis',
  termos: 'Termos de consentimento',
  procedimentos: 'Catálogo de procedimentos da clínica',
  perfil: 'Suas informações profissionais',
  clinica: 'Informações da clínica',
  'horarios-funcionamento': 'Horários de funcionamento da clínica',
  'agenda-feriados': 'Feriados em que a clínica não atende',
  'agenda-templates': 'Mensagens automáticas de WhatsApp',
  'pacientes-inativados': 'Pacientes fora da listagem principal',
  'anamnese-publica': 'Configurações de acesso público',
};

function NavGroupLabel({ children }) {
  return (
    <p className="mb-2 mt-5 px-3 text-[10px] font-bold uppercase tracking-[0.08em] text-[#94a3b8] first:mt-0">
      {children}
    </p>
  );
}

function SoonBadge() {
  return (
    <span className="ml-auto shrink-0 rounded-md bg-[#f1f5f9] px-1.5 py-0.5 text-[10px] font-bold text-[#94a3b8]">
      Em breve
    </span>
  );
}

function SidebarNavItem({ icon, label, active, onClick, badge }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`mx-0 flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-medium transition-colors ${
        active
          ? 'bg-white font-semibold text-[#0f172a] ring-1 ring-[#e2e8f0]'
          : 'text-[#64748b] hover:bg-white/60 hover:text-[#0f172a]'
      }`}
    >
      {React.createElement(icon, {
        className: 'mt-0.5 h-4 w-4 shrink-0',
        strokeWidth: 2,
        'aria-hidden': true,
      })}
      <span className="min-w-0 flex-1 break-words leading-snug">{label}</span>
      {badge === 'soon' ? <SoonBadge /> : null}
    </button>
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
  configSection,
  setConfigSection,
}) {
  const subtitle = SECTION_SUBTITLE[configSection] ?? SECTION_SUBTITLE.fichas;

  // Pills para mobile: lista apenas o que o usuário pode ver
  const mobilePills = [
    canSeeProcedimentos && ['procedimentos', 'Procedimentos'],
    canSeeTermos        && ['termos', 'Termos'],
    canSeeAnamnese      && ['categorias', 'Categorias'],
    canSeeAnamnese      && ['perguntas', 'Perguntas'],
    canSeeAnamnese      && ['fichas', 'Fichas'],
    canSeeAnamnese      && ['anamnese-publica', 'Acesso Público'],
    canSeePerfil        && ['perfil', 'Perfil'],
    canSeeClinica       && ['clinica', 'Clínica'],
    canSeeAgendaConfig  && ['horarios-funcionamento', 'Horários'],
    canSeeAgendaConfig  && ['agenda-feriados', 'Feriados'],
    canSeeAgendaConfig  && ['agenda-templates', 'Templates'],
    canSeeEquipe        && ['pacientes-inativados', 'Inativos'],
  ].filter(Boolean);

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

      {/* Mobile (<768px): pills com scroll horizontal */}
      <div className="mb-4 md:hidden">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.08em] text-[#94a3b8]">Seção</p>
        <div className="-mx-1 flex gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch] px-1">
          {mobilePills.map(([id, short]) => (
            <button
              key={id}
              type="button"
              onClick={() => setConfigSection(id)}
              className={`shrink-0 rounded-full border px-3 py-2.5 text-[11px] font-semibold transition-colors min-h-[44px] ${
                configSection === id
                  ? 'border-[#00a88e] bg-[#f0fdf9] text-[#0f766e]'
                  : 'border-[#e2e8f0] bg-white text-[#64748b] active:bg-[#f8fafc]'
              }`}
            >
              {short}
            </button>
          ))}
        </div>
      </div>

      <div className="flex min-h-[min(70dvh,720px)] min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-[#e2e8f0] bg-white md:flex-row">
        {/* Sidebar interna — desktop / tablet */}
        <aside className="hidden h-full w-[220px] shrink-0 flex-col overflow-hidden overflow-x-hidden border-b border-[#e2e8f0] bg-[#f8fafc] px-2 py-2 md:flex md:border-b-0 md:border-r">

          {/* ── Clínica: Procedimentos + Termos (N4+) ─────────────────────── */}
          {canSeeProcedimentos && (
            <>
              <NavGroupLabel>Clínica</NavGroupLabel>
              <SidebarNavItem
                icon={Stethoscope}
                label="Procedimentos"
                active={configSection === 'procedimentos'}
                onClick={() => setConfigSection('procedimentos')}
              />
            </>
          )}
          {canSeeTermos && (
            <SidebarNavItem
              icon={FileText}
              label={<>Termos de{' '}<wbr />Consentimento</>}
              active={configSection === 'termos'}
              onClick={() => setConfigSection('termos')}
            />
          )}

          {/* ── Anamnese: categorias, perguntas, fichas (N3+) ──────────────── */}
          {canSeeAnamnese && (
            <>
              <NavGroupLabel>Anamnese</NavGroupLabel>
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
            </>
          )}

          {/* ── Sistema: Perfil + Dados da Clínica (N4+) ───────────────────── */}
          {canSeePerfil && (
            <>
              <NavGroupLabel>Sistema</NavGroupLabel>
              <SidebarNavItem
                icon={User}
                label="Perfil do Profissional"
                active={configSection === 'perfil'}
                onClick={() => setConfigSection('perfil')}
              />
            </>
          )}
          {canSeeClinica && (
            <SidebarNavItem
              icon={Building2}
              label="Dados da Clínica"
              active={configSection === 'clinica'}
              onClick={() => setConfigSection('clinica')}
            />
          )}

          {/* ── Agenda: horários, feriados, templates (N5+) ────────────────── */}
          {canSeeAgendaConfig && (
            <>
              <NavGroupLabel>Agenda</NavGroupLabel>
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
            </>
          )}

          {/* ── Equipe: usuários, pacientes inativados (N5+) ───────────────── */}
          {canSeeEquipe && (
            <>
              <NavGroupLabel>Equipe</NavGroupLabel>
              <SidebarNavItem
                icon={UserX}
                label="Pacientes Inativados"
                active={configSection === 'pacientes-inativados'}
                onClick={() => setConfigSection('pacientes-inativados')}
              />
            </>
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
          {configSection === 'horarios-funcionamento' && canSeeAgendaConfig && <HorarioClinicaPanel />}
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
