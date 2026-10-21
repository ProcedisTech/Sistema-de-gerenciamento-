/**
 * F6b: o atalho (AtalhoConsulta) recebe a Promise do `handleAtalhoEntrar`, que sempre fecha e traduz cada saída
 * silenciosa em aviso: consulta fechada, paciente não encontrado; sucesso entra.
 */
import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { limparAmbienteSnapshot } from '../snapshotConsulta.jsx';
import {
  ATENDIMENTO_ID,
  TIMEOUT,
  assentarMuito,
  clicarBotao,
  consultaDto,
  emConsulta,
  montarApp,
  resumoDto,
} from './appConsulta.jsx';

vi.mock('../../lib/supabaseClient.js', async () => (await import('../encerrar/servidorEncerrarFalso.js')).supabaseFalso());
vi.mock('../../contexts/AvisosProvider.jsx', async () => (await import('./canalAvisosTeste.jsx')).avisosProviderFalso());

const OUTRO_PACIENTE_ID = '44444444-4444-4444-8444-444444444444';

describe('atalho da consulta: saídas com aviso (F6b)', () => {
  afterEach(() => {
    limparAmbienteSnapshot();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('detalhe fechado: avisa que não foi possível abrir e não entra', async () => {
    const minha = consultaDto();
    const fechada = consultaDto({ status: 'encerrado' });
    await montarApp({
      view: 'pacientes',
      rotas: [
        ['GET', /^\/api\/v1\/atendimentos\/minhas$/, () => [resumoDto(minha)]],
        ['GET', new RegExp(`^/api/v1/atendimentos/${ATENDIMENTO_ID}$`), () => fechada],
      ],
    });

    clicarBotao('Voltar à consulta de Maria Souza');
    await assentarMuito(4);

    expect(emConsulta()).toBe(false);
    expect(screen.getAllByText('Não foi possível abrir a consulta. Ela pode ter sido encerrada.').length).toBeGreaterThan(0);
  }, TIMEOUT);

  it('paciente da consulta inexistente: avisa que o paciente não foi encontrado', async () => {
    const minha = consultaDto({ pacienteId: OUTRO_PACIENTE_ID, pacienteCpf: '11144477735', pacienteNome: 'João Lima' });
    await montarApp({
      view: 'pacientes',
      rotas: [
        ['GET', /^\/api\/v1\/atendimentos\/minhas$/, () => [resumoDto(minha)]],
        ['GET', new RegExp(`^/api/v1/atendimentos/${ATENDIMENTO_ID}$`), () => minha],
        ['GET', new RegExp(`^/api/v1/pacientes/${OUTRO_PACIENTE_ID}$`), () => null],
      ],
    });

    clicarBotao('Voltar à consulta de João Lima');
    await assentarMuito(4);

    expect(emConsulta()).toBe(false);
    expect(screen.getAllByText('Paciente da consulta não foi encontrado.').length).toBeGreaterThan(0);
  }, TIMEOUT);

  it('sucesso: entra na consulta e o atalho não mostra aviso de erro', async () => {
    const minha = consultaDto();
    await montarApp({
      view: 'pacientes',
      rotas: [
        ['GET', /^\/api\/v1\/atendimentos\/minhas$/, () => [resumoDto(minha)]],
        ['GET', new RegExp(`^/api/v1/atendimentos/${ATENDIMENTO_ID}$`), () => minha],
      ],
    });

    clicarBotao('Voltar à consulta de Maria Souza');
    await assentarMuito(4);

    expect(emConsulta()).toBe(true);
    expect(screen.queryAllByText(/Não foi possível abrir a consulta/)).toHaveLength(0);
  }, TIMEOUT);
});
