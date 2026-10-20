/**
 * Perfil do paciente ao vivo (B-42, Frente 5) — teste do testador T5:
 * trocar de paciente enquanto uma rebusca por aviso ainda está em voo não mistura dados.
 * A resposta atrasada do paciente anterior (Maria) chega depois que o perfil já mostra o João e é descartada.
 */
import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { limparAmbienteSnapshot } from '../../test/snapshotConsulta.jsx';
import { IDS, pacienteDto } from '../../test/encerrar/cenariosEncerrar.js';
import { TIMEOUT, assentarMuito, clicarBotao, montarApp } from '../../test/consulta/appConsulta.jsx';
import { avisos } from '../../test/consulta/canalAvisosTeste.jsx';
import { AVISO } from '../../services/avisos/tiposAviso.js';

vi.mock('../../lib/supabaseClient.js', async () => (await import('../../test/encerrar/servidorEncerrarFalso.js')).supabaseFalso());
vi.mock('../../contexts/AvisosProvider.jsx', async () => (await import('../../test/consulta/canalAvisosTeste.jsx')).avisosProviderFalso());

const MARIA = IDS.PACIENTE;
const JOAO = '33333333-3333-4333-8333-333333333334';
const joaoDto = {
  id: JOAO,
  nomeCompleto: 'João Pereira',
  cpf: '11144477735',
  telefone: '68999990001',
  sexo: 'M',
  dataNascimento: '1985-03-20',
  ativo: true,
};

const PROC_MARIA = { id: 'PF-MARIA', procedimentoNome: 'Toxina Maria', criadoEm: '2026-10-01T13:00:00Z', profissionalNome: 'Dra X' };
const PROC_JOAO = { id: 'PF-JOAO', procedimentoNome: 'Bioestimulador João', criadoEm: '2026-10-02T13:00:00Z', profissionalNome: 'Dra X' };

const esperar = (ms) => act(async () => {
  await new Promise((resolve) => setTimeout(resolve, ms));
});

describe('Perfil do paciente · troca de paciente durante rebusca por aviso', () => {
  afterEach(() => {
    limparAmbienteSnapshot();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('ATENDIMENTO em voo para a Maria + troca para o João: a resposta velha da Maria não aparece no perfil do João', async () => {
    const srv = await montarApp({
      view: 'pacientes',
      rotas: [
        ['GET', /^\/api\/v1\/pacientes(\/search)?$/, () => ({
          content: [pacienteDto, joaoDto], totalElements: 2, totalPages: 1, number: 0, size: 20,
        })],
        ['GET', new RegExp(`^/api/v1/pacientes/${JOAO}$`), () => joaoDto],
        ['GET', new RegExp(`^/api/v1/procedimentos/paciente/${MARIA}$`), () => [PROC_MARIA]],
        ['GET', new RegExp(`^/api/v1/procedimentos/paciente/${JOAO}$`), () => [PROC_JOAO]],
      ],
    });
    await assentarMuito(4);

    // lista → resumo da Maria → "Ver Perfil" → aba Prontuário
    fireEvent.click(screen.getAllByText('Maria Souza')[0]);
    await assentarMuito();
    clicarBotao(/Ver Perfil/);
    await assentarMuito(4);
    clicarBotao(/^Prontuário Eletrônico$/);
    await assentarMuito(4);
    expect(screen.getAllByRole('button', { name: /Toxina Maria/ }).length).toBeGreaterThan(0);

    // daqui em diante as leituras da Maria (detalhe e procedimentos) ficam penduradas até soltarmos
    let soltarMaria;
    const portaoMaria = new Promise((resolve) => { soltarMaria = resolve; });
    const penduradas = [];
    vi.stubGlobal('fetch', async (...args) => {
      const url = String(args[0]?.url ?? args[0]);
      if (url.includes(`/pacientes/${MARIA}`) || url.includes(`/procedimentos/paciente/${MARIA}`)) {
        penduradas.push(url);
        await portaoMaria;
      }
      return srv.fetchFalso(...args);
    });

    avisos.emitirAviso(AVISO.ATENDIMENTO.ENCERRADO, 'c0000000-0000-4000-8000-0000000000aa');
    await esperar(450); // debounce de 400 ms: a rebusca da Maria sai e fica em voo
    expect(penduradas.some((u) => u.includes(`/procedimentos/paciente/${MARIA}`))).toBe(true);

    // troca para o João pela seta do perfil
    clicarBotao('Próximo paciente');
    await assentarMuito(6);
    await esperar(50);
    await assentarMuito(4);
    expect(screen.getAllByText('João Pereira').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /Bioestimulador João/ }).length).toBeGreaterThan(0);

    // a resposta velha da Maria chega agora: é descartada (nada da Maria no perfil do João)
    soltarMaria();
    await esperar(50);
    await assentarMuito(6);
    expect(screen.queryAllByRole('button', { name: /Toxina Maria/ })).toHaveLength(0);
    expect(screen.getAllByRole('button', { name: /Bioestimulador João/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByText('João Pereira').length).toBeGreaterThan(0);
  }, TIMEOUT);
});
