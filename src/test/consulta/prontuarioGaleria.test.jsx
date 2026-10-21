/**
 * Camada 2 (hub da consulta): a aba Prontuário do perfil busca a galeria do paciente (GET /pacientes/{id}/galeria),
 * no F5 e quando aberta pela lista, e mostra as fotos ligadas ao procedimento feito. Trocar de aba busca uma vez por
 * troca, sem rajada.
 */
import { fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { limparAmbienteSnapshot } from '../snapshotConsulta.jsx';
import { IDS, pacienteDto } from '../encerrar/cenariosEncerrar.js';
import { TIMEOUT, assentarMuito, clicarBotao, montarApp } from './appConsulta.jsx';

vi.mock('../../lib/supabaseClient.js', async () => (await import('../encerrar/servidorEncerrarFalso.js')).supabaseFalso());
vi.mock('../../contexts/AvisosProvider.jsx', async () => (await import('./canalAvisosTeste.jsx')).avisosProviderFalso());

const GALERIA_GET = /^\/api\/v1\/pacientes\/[^/]+\/galeria(\?.*)?$/;
const PROC = { id: 'PF-1', procedimentoNome: 'Toxina', criadoEm: '2026-10-01T13:00:00Z', profissionalNome: 'Dra X' };
const FOTO = {
  id: 'F-1',
  url: 'https://fotos.teste/a.webp',
  procedimentoFeitoId: 'PF-1',
  tipoFotoCodigo: 'ANTES',
  pacienteId: IDS.PACIENTE,
};

const rotas = [
  ['GET', /^\/api\/v1\/procedimentos\/paciente\/[^/]+$/, () => [PROC]],
  ['GET', /^\/api\/v1\/pacientes\/[^/]+\/galeria$/, () => ({ fotos: [FOTO] })],
];

const getsDeGaleria = (srv) => srv.leituras.filter((l) => GALERIA_GET.test(l.path)).length;

/** Expande a linha do procedimento no Prontuário (botão com aria-expanded). */
async function expandirLinhaToxina() {
  const linha = screen
    .getAllByRole('button', { name: /Toxina/ })
    .find((b) => b.hasAttribute('aria-expanded'));
  expect(linha).toBeTruthy();
  fireEvent.click(linha);
  await assentarMuito();
}

function conferirFotoNaSecao() {
  expect(screen.getByText('Fotos e Registros Visuais da Sessão (1)')).toBeTruthy();
  expect(screen.queryByText('Nenhuma foto vinculada a este procedimento.')).toBeNull();
}

describe('Prontuário do perfil busca a galeria (Camada 2)', () => {
  afterEach(() => {
    limparAmbienteSnapshot();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('(a) depois do F5 na aba Prontuário: busca a galeria, mostra o selo "1 foto" e a foto na seção', async () => {
    const srv = await montarApp({
      view: 'pacientes',
      rotas,
      sessao: { selectedPatientCpf: pacienteDto.cpf, patientView: 'profile', patientDetailTab: 'prontuario' },
    });
    await assentarMuito(4);

    expect(screen.getByText('Prontuário eletrônico')).toBeTruthy();
    expect(getsDeGaleria(srv)).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('1 foto')).toBeTruthy();

    await expandirLinhaToxina();
    conferirFotoNaSecao();
  }, TIMEOUT);

  it('(b) aberta pela linha do tempo da lista: a galeria é buscada uma vez a mais e a seção mostra (1)', async () => {
    const srv = await montarApp({ view: 'pacientes', rotas });
    fireEvent.click(screen.getAllByText('Maria Souza')[0]);
    await assentarMuito();

    const entrada = screen.getAllByRole('button', { name: /Ver prontuário: Toxina/ })[0];
    const antes = getsDeGaleria(srv);
    fireEvent.click(entrada);
    await assentarMuito(4);

    expect(screen.getByText('Prontuário eletrônico')).toBeTruthy();
    expect(getsDeGaleria(srv)).toBe(antes + 1);
    expect(screen.getByText('1 foto')).toBeTruthy();

    await expandirLinhaToxina();
    conferirFotoNaSecao();
  }, TIMEOUT);

  it('(c) Planos → Prontuário: +1 GET de galeria; volta Prontuário → Planos: +2 (trava do comportamento de hoje)', async () => {
    const srv = await montarApp({
      view: 'pacientes',
      rotas,
      sessao: { selectedPatientCpf: pacienteDto.cpf, patientView: 'profile', patientDetailTab: 'planos' },
    });
    await assentarMuito(4);
    const inicial = getsDeGaleria(srv);
    expect(inicial, 'abrir o perfil na aba Planos deve buscar a galeria ao menos 1 vez').toBeGreaterThanOrEqual(1);

    clicarBotao('Prontuário Eletrônico');
    await assentarMuito(4);
    expect(screen.getByText('Prontuário eletrônico')).toBeTruthy();
    const depoisProntuario = getsDeGaleria(srv);
    expect(depoisProntuario - inicial, 'Planos→Prontuário deve gerar 1 GET da galeria').toBe(1);

    // Volta: 2 GETs = 1 do efeito do perfil (PatientProfileView) + 1 da própria aba Planos (PlanosTab.carregarGaleria).
    // A busca dupla já existia antes da correção e é card separado. Travado em exatamente 2: se um laço voltar, quebra.
    clicarBotao('Planos de Tratamento & Evolução Fotográfica');
    await assentarMuito(4);
    expect(
      getsDeGaleria(srv) - depoisProntuario,
      'Prontuário→Planos: 2 GETs (perfil + aba Planos; busca dupla conhecida, card separado)',
    ).toBe(2);
  }, TIMEOUT);
});
