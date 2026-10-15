/**
 * Perfil do paciente ao vivo pelo canal de avisos (B-42, Frente 5): uma rebusca por bloco, silenciosa.
 * AGENDA → detalhe (paciente + procedimentos) e próximo retorno; ATENDIMENTO → detalhe; GALERIA → galeria;
 * TERMOS → assinaturas de termos (e a lista da aba Documentos); ANAMNESE → lista de anamneses da aba Anamnese.
 * Nenhuma rebusca por aviso mostra "Sincronizando com o servidor..." nem busca o bloco dos outros.
 */
import { act, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { limparAmbienteSnapshot } from '../../test/snapshotConsulta.jsx';
import { IDS, agendaDto, pacienteDto } from '../../test/encerrar/cenariosEncerrar.js';
import { TIMEOUT, assentarMuito, clicarBotao, montarApp } from '../../test/consulta/appConsulta.jsx';
import { avisos } from '../../test/consulta/canalAvisosTeste.jsx';
import { AVISO } from '../../services/avisos/tiposAviso.js';

vi.mock('../../lib/supabaseClient.js', async () => (await import('../../test/encerrar/servidorEncerrarFalso.js')).supabaseFalso());
vi.mock('../../contexts/AvisosProvider.jsx', async () => (await import('../../test/consulta/canalAvisosTeste.jsx')).avisosProviderFalso());

const P = IDS.PACIENTE;
/** Leituras de cada bloco do perfil (caminho + query, como o servidor falso registra). */
const BLOCOS = {
  paciente: new RegExp(`^/api/v1/pacientes/${P}$`),
  procedimentos: new RegExp(`^/api/v1/procedimentos/paciente/${P}$`),
  notas: /notas/,
  // próximo retorno: hoje (06/10/2026) até +366 dias; a agenda de hoje dos contadores é outra janela
  proximoRetorno: /^\/api\/v1\/agendas\/by-range\?start=2026-10-06&end=2027-10-07/,
  galeria: new RegExp(`^/api/v1/pacientes/${P}/galeria`),
  termos: new RegExp(`^/api/v1/termos/assinaturas/paciente/${P}$`),
  anamnese: new RegExp(`^/api/v1/anamnese/paciente/${P}$`),
  documentos: new RegExp(`^/api/v1/pacientes/${P}/documentos-assinados$`),
};

const PROC = { id: 'PF-1', procedimentoNome: 'Toxina', criadoEm: '2026-10-01T13:00:00Z', profissionalNome: 'Dra X' };

function contar(srv) {
  const out = {};
  for (const [nome, re] of Object.entries(BLOCOS)) out[nome] = srv.leituras.filter((l) => re.test(l.path)).length;
  return out;
}

function diferenca(depois, antes) {
  const out = {};
  for (const k of Object.keys(depois)) out[k] = depois[k] - antes[k];
  return out;
}

/** Observa o DOM: `true` se o "Sincronizando com o servidor..." aparecer em qualquer momento. */
function vigiarSincronizando() {
  const estado = { viu: false };
  const olhar = () => {
    if (document.body.textContent.includes('Sincronizando com o servidor')) estado.viu = true;
  };
  const obs = new MutationObserver(olhar);
  obs.observe(document.body, { childList: true, subtree: true, characterData: true });
  return {
    estado,
    parar: () => {
      olhar();
      obs.disconnect();
    },
  };
}

const esperar = (ms) => act(async () => {
  await new Promise((resolve) => setTimeout(resolve, ms));
});

/**
 * Espera o debounce de 400 ms (timers reais; só o Date é falso) e deixa as buscas assentarem.
 * As respostas do servidor atrasam 150 ms (ver `abrirPerfil`): a tela renderiza com a busca em voo, e um
 * "carregando" ligado pela rebusca apareceria no DOM.
 */
async function passarDebounce() {
  await esperar(450);
  await esperar(50);
  await esperar(300);
  await assentarMuito(4);
}

async function abrirPerfil({ aba, agendas = [], rotas = [] }) {
  const srv = await montarApp({
    view: 'pacientes',
    agendas,
    rotas: [['GET', BLOCOS.procedimentos, () => [PROC]], ...rotas],
    sessao: { selectedPatientCpf: pacienteDto.cpf, patientView: 'profile', patientDetailTab: aba },
  });
  await assentarMuito(4);
  // daqui em diante o servidor responde com atraso, para a tela renderizar enquanto a rebusca está em voo
  vi.stubGlobal('fetch', async (...args) => {
    await new Promise((resolve) => setTimeout(resolve, 150));
    return srv.fetchFalso(...args);
  });
  return srv;
}

const ZERO = {
  paciente: 0,
  procedimentos: 0,
  notas: 0,
  proximoRetorno: 0,
  galeria: 0,
  termos: 0,
  anamnese: 0,
  documentos: 0,
};

/** Documento assinado como `GET /pacientes/{id}/documentos-assinados` devolve (o essencial da aba). */
const documentoAssinado = (id, titulo) => ({
  id,
  titulo,
  dataAssinatura: '2026-10-06T12:55:00Z',
  ipOrigem: null,
  vigente: true,
  expiradaEm: null,
  conteudoSnapshot: '<p>Termo</p>',
});

/** Spinner da aba Documentos (carga inicial). */
const spinnerDocumentos = () => document.querySelector('.animate-spin.text-teal-600') != null;

describe('Perfil do paciente · uma rebusca silenciosa por bloco a cada aviso', () => {
  afterEach(() => {
    limparAmbienteSnapshot();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('AGENDA: rebusca detalhe e próximo retorno (uma vez para vários avisos juntos) e mostra o novo retorno', async () => {
    const agendas = [];
    const srv = await abrirPerfil({ aba: 'prontuario', agendas });
    expect(screen.getByText('Prontuário eletrônico')).toBeTruthy();
    const semAgendamentoAntes = screen.queryAllByText('Sem agendamento').length;
    expect(semAgendamentoAntes).toBeGreaterThan(0);

    // no servidor nasce um retorno confirmado para 09/10
    agendas.push(agendaDto({ id: 'AG-RET', data: '2026-10-09', horaInicio: '14:30:00', horaFim: '15:00:00' }));
    const antes = contar(srv);
    const vigia = vigiarSincronizando();
    avisos.emitirAviso(AVISO.AGENDA.CRIADO, 'AG-RET');
    avisos.emitirAviso(AVISO.AGENDA.STATUS_ALTERADO, 'AG-RET');
    await passarDebounce();
    vigia.parar();

    expect(diferenca(contar(srv), antes)).toEqual({ ...ZERO, paciente: 1, procedimentos: 1, proximoRetorno: 1 });
    expect(vigia.estado.viu).toBe(false);
    expect(screen.queryAllByText('Sem agendamento').length).toBeLessThan(semAgendamentoAntes);
    // os dados que já estavam na tela continuam (sem limpar antes)
    expect(screen.getByText('Prontuário eletrônico')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /Toxina/ }).length).toBeGreaterThan(0);
  }, TIMEOUT);

  it('ATENDIMENTO: rebusca só o detalhe (paciente + procedimentos)', async () => {
    const srv = await abrirPerfil({ aba: 'prontuario' });
    const antes = contar(srv);
    const vigia = vigiarSincronizando();
    avisos.emitirAviso(AVISO.ATENDIMENTO.ENCERRADO, 'c0000000-0000-4000-8000-0000000000aa');
    await passarDebounce();
    vigia.parar();

    expect(diferenca(contar(srv), antes)).toEqual({ ...ZERO, paciente: 1, procedimentos: 1 });
    expect(vigia.estado.viu).toBe(false);
  }, TIMEOUT);

  it('GALERIA: rebusca só a galeria (na aba que mostra a galeria), sem "carregando"', async () => {
    const srv = await abrirPerfil({ aba: 'prontuario' });
    const antes = contar(srv);
    const vigia = vigiarSincronizando();
    avisos.emitirAviso(AVISO.GALERIA.FOTO_ADICIONADA, 'F-9');
    await passarDebounce();
    vigia.parar();

    expect(diferenca(contar(srv), antes)).toEqual({ ...ZERO, galeria: 1 });
    expect(vigia.estado.viu).toBe(false);
  }, TIMEOUT);

  it('TERMOS: rebusca só as assinaturas de termos do paciente', async () => {
    const srv = await abrirPerfil({ aba: 'prontuario' });
    const antes = contar(srv);
    const vigia = vigiarSincronizando();
    avisos.emitirAviso(AVISO.TERMOS.ASSINATURA_REMOTA_ALTERADA, 'S-1');
    await passarDebounce();
    vigia.parar();

    expect(diferenca(contar(srv), antes)).toEqual({ ...ZERO, termos: 1 });
    expect(vigia.estado.viu).toBe(false);
  }, TIMEOUT);

  it('TERMOS na aba Documentos: a aba rebusca a lista 1 vez, sem spinner, e o documento novo aparece', async () => {
    const docs = [documentoAssinado('DOC-1', 'Termo de Consentimento Toxina')];
    const srv = await abrirPerfil({
      aba: 'documentos',
      rotas: [['GET', BLOCOS.documentos, () => docs]],
    });
    expect(screen.getByText('Termo de Consentimento Toxina')).toBeTruthy();
    expect(spinnerDocumentos()).toBe(false);

    // a paciente assinou outro termo pelo link
    docs.push(documentoAssinado('DOC-2', 'Termo de Uso de Imagem'));
    const antes = contar(srv);
    let viuSpinner = false;
    const obs = new MutationObserver(() => {
      if (spinnerDocumentos()) viuSpinner = true;
    });
    obs.observe(document.body, { childList: true, subtree: true, attributes: true });
    avisos.emitirAviso(AVISO.TERMOS.ASSINATURA_REMOTA_ALTERADA, 'S-2');
    avisos.emitirAviso(AVISO.TERMOS.ASSINATURA_REMOTA_ALTERADA, 'S-2');
    await passarDebounce();
    obs.disconnect();

    // a aba (documentos) e o bloco de assinaturas do perfil (termos) rebuscam, cada um 1 vez; o resto não
    expect(diferenca(contar(srv), antes)).toEqual({ ...ZERO, termos: 1, documentos: 1 });
    expect(viuSpinner).toBe(false);
    // o que já estava continua e o novo aparece
    expect(screen.getByText('Termo de Consentimento Toxina')).toBeTruthy();
    expect(screen.getByText('Termo de Uso de Imagem')).toBeTruthy();
  }, TIMEOUT);

  it('aba Documentos: aviso de outro módulo (ANAMNESE, GALERIA) não rebusca a lista da aba', async () => {
    const srv = await abrirPerfil({
      aba: 'documentos',
      rotas: [['GET', BLOCOS.documentos, () => [documentoAssinado('DOC-1', 'Termo de Consentimento Toxina')]]],
    });
    expect(screen.getByText('Termo de Consentimento Toxina')).toBeTruthy();
    const antes = contar(srv);
    avisos.emitirAviso(AVISO.ANAMNESE.ENVIO_ALTERADO, 'ENV-1');
    avisos.emitirAviso(AVISO.GALERIA.FOTO_ADICIONADA, 'F-9');
    await passarDebounce();

    expect(diferenca(contar(srv), antes).documentos).toBe(0);
    expect(screen.getByText('Termo de Consentimento Toxina')).toBeTruthy();
  }, TIMEOUT);

  it('PACIENTE.EDITADO do paciente aberto: rebusca o detalhe 1 vez e o cabeçalho mostra o nome novo, sem "Sincronizando"', async () => {
    // o servidor passa a devolver o nome editado em outro aparelho (mesmo CPF)
    let dtoAtual = pacienteDto;
    const srv = await abrirPerfil({
      aba: 'prontuario',
      rotas: [
        ['GET', BLOCOS.paciente, () => dtoAtual],
        ['GET', /^\/api\/v1\/pacientes(\/search)?$/, () => ({
          content: [dtoAtual], totalElements: 1, totalPages: 1, number: 0, size: 20,
        })],
      ],
    });
    const nomeNoCabecalho = () => document.getElementById('profile-hero-name')?.textContent;
    expect(nomeNoCabecalho()).toBe('Maria Souza');

    dtoAtual = { ...pacienteDto, nomeCompleto: 'Maria Souza Lima' };
    const antes = contar(srv);
    const vigia = vigiarSincronizando();
    avisos.emitirAviso(AVISO.PACIENTE.EDITADO, P);
    avisos.emitirAviso(AVISO.PACIENTE.EDITADO, P);
    await passarDebounce();
    vigia.parar();

    expect(nomeNoCabecalho()).toBe('Maria Souza Lima');
    expect(vigia.estado.viu).toBe(false);
    // detalhe 1 vez; o próximo retorno é rebuscado 1 vez porque a busca dele usa o nome, que mudou
    expect(diferenca(contar(srv), antes)).toEqual({ ...ZERO, paciente: 1, procedimentos: 1, proximoRetorno: 1 });
    // o que já estava continua (sem limpar antes)
    expect(screen.getByText('Prontuário eletrônico')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /Toxina/ }).length).toBeGreaterThan(0);
  }, TIMEOUT);

  // T-FB-front: com o cadastro aberto em edição, o aviso atualiza o cabeçalho e NÃO apaga o que a pessoa digitou.
  it('PACIENTE.EDITADO com o cadastro aberto em edição: o cabeçalho atualiza e o texto digitado fica (T-FB-front)', async () => {
    let dtoAtual = pacienteDto;
    const srv = await abrirPerfil({
      aba: 'prontuario',
      rotas: [
        ['GET', BLOCOS.paciente, () => dtoAtual],
        ['GET', /^\/api\/v1\/pacientes(\/search)?$/, () => ({
          content: [dtoAtual], totalElements: 1, totalPages: 1, number: 0, size: 20,
        })],
      ],
    });
    const nomeNoCabecalho = () => document.getElementById('profile-hero-name')?.textContent;
    expect(nomeNoCabecalho()).toBe('Maria Souza');

    clicarBotao(/Cadastro/);
    await assentarMuito(2);
    clicarBotao(/^Editar$/);
    await assentarMuito(2);
    const dialogo = screen.getByRole('dialog');
    const campoNome = () => within(dialogo).getAllByPlaceholderText('Nome completo do paciente').find((el) => !el.disabled);
    fireEvent.change(campoNome(), { target: { value: 'Maria Digitada' } });
    expect(campoNome().value).toBe('Maria Digitada');

    dtoAtual = { ...pacienteDto, nomeCompleto: 'Maria Souza Lima' };
    const antes = contar(srv);
    avisos.emitirAviso(AVISO.PACIENTE.EDITADO, P);
    await passarDebounce();

    expect(diferenca(contar(srv), antes).paciente).toBe(1);
    expect(nomeNoCabecalho()).toBe('Maria Souza Lima');
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(campoNome().value).toBe('Maria Digitada');
  }, TIMEOUT);

  it('PACIENTE.EDITADO / CRIADO de outro paciente: o perfil aberto não rebusca nada', async () => {
    const srv = await abrirPerfil({ aba: 'prontuario' });
    const antes = contar(srv);
    const vigia = vigiarSincronizando();
    avisos.emitirAviso(AVISO.PACIENTE.EDITADO, '99999999-9999-4999-8999-999999999999');
    avisos.emitirAviso(AVISO.PACIENTE.CRIADO, '88888888-8888-4888-8888-888888888888');
    await passarDebounce();
    vigia.parar();

    expect(diferenca(contar(srv), antes)).toEqual(ZERO);
    expect(vigia.estado.viu).toBe(false);
    expect(document.getElementById('profile-hero-name')?.textContent).toBe('Maria Souza');
  }, TIMEOUT);

  it('"recarregar" do canal: cada bloco rebusca 1 vez (o detalhe só pelo handler de AGENDA, não 3)', async () => {
    const srv = await abrirPerfil({ aba: 'prontuario' });
    const antes = contar(srv);
    const vigia = vigiarSincronizando();
    avisos.emitirRecarregar();
    await passarDebounce();
    vigia.parar();

    expect(diferenca(contar(srv), antes)).toEqual({
      ...ZERO,
      paciente: 1,
      procedimentos: 1,
      proximoRetorno: 1,
      galeria: 1,
      termos: 1,
    });
    expect(vigia.estado.viu).toBe(false);
  }, TIMEOUT);

  it('PACIENTE.EDITADO sozinho (sem mudar o nome): rebusca só o detalhe, 1 vez', async () => {
    const srv = await abrirPerfil({ aba: 'prontuario' });
    const antes = contar(srv);
    avisos.emitirAviso(AVISO.PACIENTE.EDITADO, P);
    await passarDebounce();

    expect(diferenca(contar(srv), antes)).toEqual({ ...ZERO, paciente: 1, procedimentos: 1 });
  }, TIMEOUT);

  it('ANAMNESE: na aba Anamnese rebusca só a lista, sem "Carregando anamneses..." e mostra a nova', async () => {
    const lista = [];
    const srv = await abrirPerfil({
      aba: 'anamnese',
      rotas: [['GET', BLOCOS.anamnese, () => lista]],
    });
    expect(screen.getByText('Nenhuma anamnese preenchida')).toBeTruthy();

    // a paciente terminou a anamnese pelo link
    lista.push({
      id: 'AN-1',
      anamneseId: 'FICHA-1',
      anamneseNome: 'Anamnese Estética',
      dataHora: '2026-10-06T12:50:00Z',
      respostas: [],
    });
    const antes = contar(srv);
    let viuCarregando = false;
    const obs = new MutationObserver(() => {
      if (document.body.textContent.includes('Carregando anamneses')) viuCarregando = true;
    });
    obs.observe(document.body, { childList: true, subtree: true, characterData: true });
    avisos.emitirAviso(AVISO.ANAMNESE.ENVIO_ALTERADO, 'ENV-1');
    await passarDebounce();
    obs.disconnect();

    expect(diferenca(contar(srv), antes)).toMatchObject({
      paciente: 0,
      procedimentos: 0,
      proximoRetorno: 0,
      galeria: 0,
      termos: 0,
      anamnese: 1,
    });
    expect(viuCarregando).toBe(false);
    expect(screen.queryByText('Nenhuma anamnese preenchida')).toBeNull();
  }, TIMEOUT);
});
