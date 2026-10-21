/**
 * Monta o AppRefactored real (via AppRoot) com o backend falso do roteiro e um canal de avisos controlado,
 * para os testes de tela da consulta no servidor (Fatia 2, Etapa 1).
 *
 * Cada arquivo de teste precisa declarar os mocks (o vi.mock é içado por arquivo):
 *   vi.mock('../../lib/supabaseClient.js', async () => (await import('../encerrar/servidorEncerrarFalso.js')).supabaseFalso());
 *   vi.mock('../../contexts/AvisosProvider.jsx', async () => (await import('./canalAvisosTeste.jsx')).avisosProviderFalso());
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, vi } from 'vitest';
import { assentar, prepararAmbienteSnapshot } from '../snapshotConsulta.jsx';
import { criarServidorEncerrarFalso, ROLE_USER_ID } from '../encerrar/servidorEncerrarFalso.js';
import { IDS, catalogoClinica, pacienteDto, tiposProcedimento } from '../encerrar/cenariosEncerrar.js';
import { PERMISSOES } from '../../constants/permissoes.js';
import { ToastProvider } from '../../contexts/ToastContext.jsx';
import AppRoot from '../../components/AppRoot.jsx';
/** 06/10/2026 10:00 em America/Sao_Paulo. */
export const AGORA = '2026-10-06T13:00:00.000Z';
export const TIMEOUT = 60000;
export const ATENDIMENTO_ID = 'c0000000-0000-4000-8000-0000000000aa';

const paginaPacientes = () => ({ content: [pacienteDto], totalElements: 1, totalPages: 1, number: 0, size: 20 });

function rotasBase({ agendas }) {
  return [
    ['GET', /^\/api\/v1\/pacientes(\/search)?$/, paginaPacientes],
    ['GET', new RegExp(`^/api/v1/pacientes/${IDS.PACIENTE}$`), () => pacienteDto],
    ['GET', /^\/api\/v1\/agendas\/(by-range|by-date|ocupacoes|by-profissional)$/, () => agendas],
    ['GET', /^\/api\/v1\/clinica\/procedimentos$/, () => catalogoClinica],
    ['GET', /^\/api\/v1\/dimensoes\/tipos-procedimento$/, () => tiposProcedimento],
  ];
}

/** AtendimentoDTO como o servidor devolve (AtendimentoDTO.java). */
export function consultaDto(extras = {}) {
  return {
    id: ATENDIMENTO_ID,
    pacienteId: IDS.PACIENTE,
    pacienteNome: 'Maria Souza',
    pacienteCpf: pacienteDto.cpf,
    anfitriaoRoleUserId: ROLE_USER_ID,
    status: 'aberto',
    modulo: 'hub',
    tipoProcedimentoCodigo: 'CONSULTA',
    procedimentoFeitoOrigemId: null,
    agendaPrincipalId: null,
    iniciadoEm: '2026-10-06T12:30:00Z',
    encerradoEm: null,
    atualizadoEm: '2026-10-06T12:30:00Z',
    itens: [],
    fotos: [],
    consultaAnteriorFechada: null,
    fechadaPor: null,
    ...extras,
  };
}

/** AtendimentoResumoDTO (lista "minhas"). */
export function resumoDto(dto) {
  return {
    id: dto.id,
    pacienteId: dto.pacienteId,
    pacienteNome: dto.pacienteNome,
    pacienteCpf: dto.pacienteCpf,
    status: dto.status,
    modulo: dto.modulo,
    tipoProcedimentoCodigo: dto.tipoProcedimentoCodigo,
    iniciadoEm: dto.iniciadoEm,
  };
}

export async function assentarMuito(vezes = 4) {
  for (let i = 0; i < vezes; i += 1) await assentar();
}

function botoesVisiveis() {
  return Array.from(document.querySelectorAll('button'))
    .map((b) => (b.getAttribute('aria-label') || b.textContent || '').trim())
    .filter(Boolean)
    .join(' | ');
}

export function clicarBotao(nome, indice = 0) {
  const lista = screen.queryAllByRole('button', { name: nome });
  if (!lista[indice]) throw new Error(`Botão ${nome} não encontrado. Visíveis: ${botoesVisiveis()}`);
  fireEvent.click(lista[indice]);
}

/**
 * @param {{ agendas?: object[], rotas?: Array, agora?: string, view?: string, sessao?: Record<string,string>, permissoes?: string[] }} opcoes
 */
export async function montarApp({
  agendas = [],
  rotas = [],
  agora = AGORA,
  view = 'pacientes',
  sessao = {},
  permissoes = Object.values(PERMISSOES),
} = {}) {
  prepararAmbienteSnapshot();
  vi.setSystemTime(new Date(agora));
  sessionStorage.clear();
  localStorage.clear();
  sessionStorage.setItem('activeView', view);
  for (const [k, v] of Object.entries(sessao)) sessionStorage.setItem(k, v);
  const srv = criarServidorEncerrarFalso({ permissoes, rotas: [...rotas, ...rotasBase({ agendas })] });
  vi.stubGlobal('fetch', srv.fetchFalso);
  render(
    <ToastProvider>
      <AppRoot />
    </ToastProvider>,
  );
  await assentarMuito(6);
  return srv;
}

export function emConsulta() {
  return screen.queryAllByText(/(Consulta|Retorno) em andamento/).length > 0;
}

/** Lista de pacientes → resumo do paciente → "Iniciar atendimento". */
export async function iniciarPeloPaciente() {
  fireEvent.click(screen.getAllByText('Maria Souza')[0]);
  await assentarMuito();
  clicarBotao(/Iniciar atendimento/i);
  await assentarMuito();
}

/** Card do rail da agenda → "Iniciar atendimento". */
export async function iniciarPelaAgenda() {
  clicarBotao('Iniciar atendimento');
  await assentarMuito();
}

export function escritasDe(srv, metodo, re) {
  return srv.escritasConsulta.filter((e) => e.method === metodo && re.test(e.path));
}

export function esperarEmConsulta() {
  expect(emConsulta()).toBe(true);
}
