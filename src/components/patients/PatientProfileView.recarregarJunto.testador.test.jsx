/**
 * Testador T6 (B-42 rodada 3, item 6b): "recarregar" + PACIENTE.EDITADO juntos (< 400 ms) não perdem a edição,
 * nas duas ordens; e "recarregar" + ATENDIMENTO juntos não multiplicam o detalhe.
 */
import { act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { limparAmbienteSnapshot } from '../../test/snapshotConsulta.jsx';
import { IDS, pacienteDto } from '../../test/encerrar/cenariosEncerrar.js';
import { TIMEOUT, assentarMuito, montarApp } from '../../test/consulta/appConsulta.jsx';
import { avisos } from '../../test/consulta/canalAvisosTeste.jsx';
import { AVISO } from '../../services/avisos/tiposAviso.js';

vi.mock('../../lib/supabaseClient.js', async () => (await import('../../test/encerrar/servidorEncerrarFalso.js')).supabaseFalso());
vi.mock('../../contexts/AvisosProvider.jsx', async () => (await import('../../test/consulta/canalAvisosTeste.jsx')).avisosProviderFalso());

const P = IDS.PACIENTE;
const RE_PACIENTE = new RegExp(`^/api/v1/pacientes/${P}$`);
const RE_PROC = new RegExp(`^/api/v1/procedimentos/paciente/${P}$`);

const esperar = (ms) => act(async () => {
  await new Promise((resolve) => setTimeout(resolve, ms));
});

async function passarDebounce() {
  await esperar(450);
  await esperar(50);
  await esperar(300);
  await assentarMuito(4);
}

async function abrir(estado) {
  const srv = await montarApp({
    view: 'pacientes',
    rotas: [
      ['GET', RE_PACIENTE, () => estado.dto],
      ['GET', /^\/api\/v1\/pacientes(\/search)?$/, () => ({
        content: [estado.dto], totalElements: 1, totalPages: 1, number: 0, size: 20,
      })],
    ],
    sessao: { selectedPatientCpf: pacienteDto.cpf, patientView: 'profile', patientDetailTab: 'prontuario' },
  });
  await assentarMuito(4);
  vi.stubGlobal('fetch', async (...args) => {
    await new Promise((resolve) => setTimeout(resolve, 150));
    return srv.fetchFalso(...args);
  });
  return srv;
}

const contar = (srv, re) => srv.leituras.filter((l) => re.test(l.path)).length;
const nome = () => document.getElementById('profile-hero-name')?.textContent;

describe('T6 · "recarregar" junto com outro aviso do perfil', () => {
  afterEach(() => {
    limparAmbienteSnapshot();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('PACIENTE.EDITADO e depois "recarregar" (100 ms): o nome novo aparece, detalhe 1 vez', async () => {
    const estado = { dto: pacienteDto };
    const srv = await abrir(estado);
    expect(nome()).toBe('Maria Souza');
    estado.dto = { ...pacienteDto, nomeCompleto: 'Maria Souza Lima' };
    const antes = contar(srv, RE_PACIENTE);
    avisos.emitirAviso(AVISO.PACIENTE.EDITADO, P);
    await esperar(100);
    avisos.emitirRecarregar();
    await passarDebounce();

    expect(nome()).toBe('Maria Souza Lima');
    expect(contar(srv, RE_PACIENTE) - antes).toBe(1);
  }, TIMEOUT);

  it('"recarregar" e depois PACIENTE.EDITADO (100 ms): o nome novo aparece', async () => {
    const estado = { dto: pacienteDto };
    const srv = await abrir(estado);
    expect(nome()).toBe('Maria Souza');
    const antes = contar(srv, RE_PACIENTE);
    avisos.emitirRecarregar();
    await esperar(100);
    estado.dto = { ...pacienteDto, nomeCompleto: 'Maria Souza Lima' };
    avisos.emitirAviso(AVISO.PACIENTE.EDITADO, P);
    await passarDebounce();

    expect(nome()).toBe('Maria Souza Lima');
    // AGENDA (pelo recarregar) + PACIENTE (pelo aviso, que foi o último na janela dele): 2, nunca 3
    expect(contar(srv, RE_PACIENTE) - antes).toBe(2);
  }, TIMEOUT);

  it('ATENDIMENTO e depois "recarregar" (100 ms): detalhe 1 vez (só pelo handler de AGENDA)', async () => {
    const estado = { dto: pacienteDto };
    const srv = await abrir(estado);
    const antesP = contar(srv, RE_PACIENTE);
    const antesProc = contar(srv, RE_PROC);
    avisos.emitirAviso(AVISO.ATENDIMENTO.ENCERRADO, 'c0000000-0000-4000-8000-0000000000aa');
    await esperar(100);
    avisos.emitirRecarregar();
    await passarDebounce();

    expect(contar(srv, RE_PACIENTE) - antesP).toBe(1);
    expect(contar(srv, RE_PROC) - antesProc).toBe(1);
  }, TIMEOUT);
});
