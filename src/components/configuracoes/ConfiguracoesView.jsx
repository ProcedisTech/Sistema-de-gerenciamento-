import React from 'react';
import {
  FileText,
  Tag,
  HelpCircle,
  ClipboardList,
  User,
  Building2,
  Settings,
} from 'lucide-react';
import { authHeadersForFetch } from '../../services/api';
import { AnamneseAdminView } from '../anamnese';
import { TermosManager } from '../termos/TermosManager';
import { DadosClinicaPanel } from './DadosClinicaPanel';
import { PerfilProfissionalPanel } from './PerfilProfissionalPanel';

const SECTION_SUBTITLE = {
  fichas: 'Gerencie fichas de anamnese',
  categorias: 'Organize categorias de perguntas',
  perguntas: 'Banco de perguntas reutilizáveis',
  termos: 'Termos de consentimento',
  perfil: 'Suas informações profissionais',
  clinica: 'Informações da clínica',
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

function SidebarNavItem({ icon: Icon, label, active, onClick, badge }) {
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
      <Icon className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
      <span className="min-w-0 flex-1 break-words leading-snug">{label}</span>
      {badge === 'soon' ? <SoonBadge /> : null}
    </button>
  );
}

/**
 * @param {object} [props]
 * @param {Record<string, unknown>} [props.anamneseAdminProps] — repassadas a {@link AnamneseAdminView}
 * @param {Record<string, unknown>} [props.termosManagerProps] — repassadas a {@link TermosManager}
 * @param {(nome: string, logoUrl?: string) => void} [props.onClinicaAtualizada] — repassada a {@link DadosClinicaPanel}
 * @param {(data: { nomeCompleto?: string, fotoUrl?: string }) => void} [props.onPerfilAtualizado]
 * @param {string} props.configSection
 * @param {(s: string) => void} props.setConfigSection
 */
export function ConfiguracoesView({
  anamneseAdminProps = {},
  termosManagerProps = {},
  onClinicaAtualizada,
  onPerfilAtualizado,
  configSection,
  setConfigSection,
}) {
  const subtitle = SECTION_SUBTITLE[configSection] ?? SECTION_SUBTITLE.fichas;

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

      {/* Mobile (&lt;768px): pills com scroll horizontal (touch-friendly) */}
      <div className="mb-4 md:hidden">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.08em] text-[#94a3b8]">Seção</p>
        <div className="-mx-1 flex gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch] px-1">
          {[
            ['termos', 'Termos'],
            ['categorias', 'Categorias'],
            ['perguntas', 'Perguntas'],
            ['fichas', 'Fichas'],
            ['perfil', 'Perfil'],
            ['clinica', 'Clínica'],
          ].map(([id, short]) => (
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
          <NavGroupLabel>Clínica</NavGroupLabel>
          <SidebarNavItem
            icon={FileText}
            label={
              <>
                Termos de{' '}
                <wbr />
                Consentimento
              </>
            }
            active={configSection === 'termos'}
            onClick={() => setConfigSection('termos')}
          />

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

          <NavGroupLabel>Sistema</NavGroupLabel>
          <SidebarNavItem
            icon={User}
            label="Perfil do Profissional"
            active={configSection === 'perfil'}
            onClick={() => setConfigSection('perfil')}
            badge="soon"
          />
          <SidebarNavItem
            icon={Building2}
            label="Dados da Clínica"
            active={configSection === 'clinica'}
            onClick={() => setConfigSection('clinica')}
            badge="soon"
          />
        </aside>

        {/* Conteúdo */}
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto [-webkit-overflow-scrolling:touch] px-3 py-4 sm:px-5 sm:py-6 md:px-6 md:py-8">
          {configSection === 'termos' && <TermosManager {...termosManagerProps} />}

          {(configSection === 'categorias' ||
            configSection === 'perguntas' ||
            configSection === 'fichas') && (
            <AnamneseAdminView {...anamneseAdminProps} embeddedSection={configSection} />
          )}

          {configSection === 'perfil' && (
            <PerfilProfissionalPanel
              getAuthHeaders={() => authHeadersForFetch({ needsOrg: false })}
              onPerfilAtualizado={onPerfilAtualizado}
            />
          )}

          {configSection === 'clinica' && (
            <DadosClinicaPanel
              getAuthHeaders={() => authHeadersForFetch({ needsOrg: true })}
              onClinicaAtualizada={onClinicaAtualizada}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function PlaceholderPanel({ title, body }) {
  return (
    <div className="rounded-xl border border-dashed border-[#e2e8f0] bg-[#f8fafc] px-5 py-10 text-center">
      <p className="text-[15px] font-semibold text-[#0f172a]">{title}</p>
      <p className="mt-2 text-[13px] font-medium text-[#64748b]">{body}</p>
    </div>
  );
}
