import { useMemo } from 'react';
import { matchRoutes, useLocation } from 'react-router';
import { ABAS_PACIENTE, ROTAS, SECAO_DO_SLUG, SECAO_LEGADA, SLUG_DA_SECAO } from './tabela';
import { caminhos, lerQueryPacientes } from './caminhos';

// Mesmos prefixos de AppRefactored.jsx:4874-4879 (páginas públicas fora do shell).
const PREFIXOS_PUBLICOS = ['/c/', '/anamnese', '/assinar'];

const VIEW = {
  entrar: 'pacientes',
  consulta: 'consulta',
  notificacoes: 'notificacoes',
  pacientes: 'pacientes',
  pacienteNovo: 'pacientes',
  paciente: 'pacientes',
  pacienteAba: 'pacientes',
  pacienteAnamnese: 'pacientes',
  pacienteAnamneseEditar: 'pacientes',
  pacientePlano: 'pacientes',
  agenda: 'agenda',
  agendaItem: 'agenda',
  equipe: 'gestao-equipe',
  equipePerfis: 'gestao-equipe',
  equipeAuditoria: 'gestao-equipe',
  membro: 'gestao-equipe',
  configuracoes: 'configuracoes',
  termoNovo: 'configuracoes',
  termo: 'configuracoes',
  ficha: 'configuracoes',
  secao: 'configuracoes',
};
const PATIENT_VIEW = {
  pacientes: 'list',
  pacienteNovo: 'create',
  paciente: 'profile',
  pacienteAba: 'profile',
  pacienteAnamnese: 'profile',
  pacienteAnamneseEditar: 'profile',
  pacientePlano: 'profile',
};
const EQUIPE_ABA = { equipe: 'membros', membro: 'membros', equipePerfis: 'perfis', equipeAuditoria: 'auditoria' };

export function lerRota(pathname, search = '') {
  const r = {
    rotaId: null, pathname, search, entrar: false, publico: false,
    activeView: null, patientView: null, pacienteId: null, patientDetailTab: null,
    anamneseId: null, editar: false, planejamentoId: null, agendaId: null,
    equipeAba: null, membroId: null, configSection: null,
    termoNovo: false, termoId: null, fichaId: null,
    query: lerQueryPacientes(''), redirecionar: null, naoEncontrado: false,
  };
  if (PREFIXOS_PUBLICOS.some((p) => pathname.startsWith(p))) return { ...r, publico: true };
  if (pathname === '/') return r;
  const m = matchRoutes(ROTAS, pathname);
  if (!m) return { ...r, naoEncontrado: true };

  const id = m[0].route.id;
  const p = m[0].params;
  Object.assign(r, {
    rotaId: id,
    entrar: id === 'entrar',
    activeView: VIEW[id],
    patientView: PATIENT_VIEW[id] ?? null,
    pacienteId: p.pacienteId ?? null,
    anamneseId: p.anamneseId ?? null,
    editar: id === 'pacienteAnamneseEditar',
    planejamentoId: p.planejamentoId ?? null,
    agendaId: p.agendaId ?? null,
    equipeAba: EQUIPE_ABA[id] ?? null,
    membroId: p.membroId ?? null,
    termoNovo: id === 'termoNovo',
    termoId: p.termoId ?? null,
    fichaId: p.fichaId ?? null,
  });
  if (id === 'pacientes') r.query = lerQueryPacientes(search);
  if (id.startsWith('pacienteAnamnese')) r.patientDetailTab = 'anamnese';
  if (id === 'pacientePlano') r.patientDetailTab = 'planos';
  if (id === 'termoNovo' || id === 'termo') r.configSection = 'termos';
  if (id === 'ficha') r.configSection = 'fichas';

  if (id === 'pacienteAba') {
    if (ABAS_PACIENTE.includes(p.aba)) r.patientDetailTab = p.aba;
    else if (p.aba === 'planos') r.redirecionar = caminhos.paciente(p.pacienteId);
    else r.naoEncontrado = true;
  }
  if (id === 'secao') {
    const slug = p.secao;
    if (SECAO_DO_SLUG[slug]) r.configSection = SECAO_DO_SLUG[slug];
    else if (slug === 'gestao-equipe' || SECAO_LEGADA[slug] === 'gestao-equipe') r.redirecionar = caminhos.equipe();
    else if (SECAO_LEGADA[slug]) r.redirecionar = caminhos.configuracoes(SECAO_LEGADA[slug]);
    else if (SLUG_DA_SECAO[slug]) r.redirecionar = caminhos.configuracoes(slug);
    else r.naoEncontrado = true;
  }
  return r;
}

export function useRotaAtual() {
  const { pathname, search } = useLocation();
  return useMemo(() => lerRota(pathname, search), [pathname, search]);
}
