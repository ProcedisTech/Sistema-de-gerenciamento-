/**
 * Etapa 0 (Y5): grava o roteiro real do `encerrarAtendimento` de hoje, cenário a cenário, rodando o
 * AppRefactored de verdade (via AppRoot) com o backend falso no `fetch`.
 *
 * - `GRAVAR_ROTEIROS=1 npx vitest run src/test/encerrar/gravarRoteiroEncerrar.test.jsx` grava os JSON em
 *   `../plataforma-procedimentos/backend/src/test/resources/roteiros-encerrar/` (ou `ROTEIROS_ENCERRAR_DIR`).
 * - Depois da Etapa 3 (decisão P1), o encerrar é um único `POST /api/v1/atendimentos/{id}/encerrar`: a prova do
 *   resultado (o que o roteiro de hoje gravava) é o `EncerramentoEquivalenciaIT` do backend. Sem a variável, este
 *   teste confere que a preparação de cada cenário continua a dos JSON gravados, que o roteiro ficou vazio (fica só
 *   a anamnese que o hub salva antes de encerrar) e que o front manda um POST só, com o corpo certo (ou nenhum,
 *   quando o portão do front barra).
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { assentar, limparAmbienteSnapshot, prepararAmbienteSnapshot } from '../snapshotConsulta.jsx';
import { criarServidorEncerrarFalso } from './servidorEncerrarFalso.js';
import { IDS, agendaDto, catalogoClinica, marcar, pacienteDto, tiposProcedimento } from './cenariosEncerrar.js';
import { PNG_A_BASE64, PNG_B_BASE64, arquivoPng, limparMidia, prepararMidia } from './ambienteMidia.js';
import { PERMISSOES } from '../../constants/permissoes.js';
import { ToastProvider } from '../../contexts/ToastContext.jsx';
import AppRoot from '../../components/AppRoot.jsx';

vi.mock('../../lib/supabaseClient.js', async () => (await import('./servidorEncerrarFalso.js')).supabaseFalso());

/**
 * O editor real desenha num canvas e exporta com `toBlob`, que o jsdom não tem. O substituto salva um JPEG
 * fixo pelo mesmo callback do ramo "foto da lista" de `saveAnnotatedPhoto` (F1: `await onAnnotatedCaptureSaved`,
 * que resolve `{ estado }` ou rejeita; não há mais `persistAnnotatedPhotoToGallery`).
 */
vi.mock('../../components/journey/JourneyPhotoAnnotationEditor.jsx', async () => {
  const { blobJpeg } = await import('./ambienteMidia.js');
  function JourneyPhotoAnnotationEditor({
    editingIndex,
    fallbackSelectedPhotoIndex,
    saveListLength,
    photos = [],
    onAnnotatedCaptureSaved,
    setEvaluationAnnotatedPhotoUrl,
    onAfterSaveAnnotated,
    onClose,
  }) {
    const salvar = async () => {
      const blob = blobJpeg();
      const url = URL.createObjectURL(blob);
      const idx = typeof editingIndex === 'number' ? editingIndex : fallbackSelectedPhotoIndex;
      const listLen = typeof saveListLength === 'number' ? saveListLength : photos.length;
      if (typeof idx === 'number' && idx >= 0 && idx < listLen && typeof onAnnotatedCaptureSaved === 'function') {
        try {
          await onAnnotatedCaptureSaved({ index: idx, newUrl: url, blob });
        } catch {
          return;
        }
      }
      setEvaluationAnnotatedPhotoUrl?.(url);
      onAfterSaveAnnotated?.();
    };
    return (
      <div role="dialog" aria-label="Editor de anotação (substituto)">
        <button type="button" onClick={salvar}>Salvar anotação</button>
        <button type="button" onClick={onClose}>Fechar editor</button>
      </div>
    );
  }
  return { JourneyPhotoAnnotationEditor };
});

const DIR =
  process.env.ROTEIROS_ENCERRAR_DIR ||
  path.resolve(process.cwd(), '../plataforma-procedimentos/backend/src/test/resources/roteiros-encerrar');
const GRAVAR = process.env.GRAVAR_ROTEIROS === '1';
/** 06/10/2026 10:00 em America/Sao_Paulo. */
const INSTANTE_PADRAO = '2026-10-06T13:00:00.000Z';
const TIMEOUT = 60000;

const TERMO_FALTANTE = { termoId: IDS.TERMO_1, titulo: 'Termo de toxina botulínica' };

/** Etapa 3: a rota única do encerrar (fica nas escritas da consulta do servidor falso, fora do roteiro). */
const ROTA_ENCERRAR = /^\/api\/v1\/atendimentos\/[^/]+\/encerrar$/;
const ehPostEncerrar = (e) => e.method === 'POST' && ROTA_ENCERRAR.test(e.path);
/**
 * Corpo do POST /encerrar pelo hub ("Finalizar Atendimento" pula o portão). O servidor falso abre a consulta sem itens:
 * o item da linha ativa nasce no esvaziar da fila (1º POST /itens → ...002) e, F5b, a linha guarda o `itemId` dele na
 * hora, então o encerrar resolve o `itemAtivoId` dessa linha. Consulta sem procedimento: `ENCERRAR_SEM_ITEM`.
 */
const ITEM_CRIADO_1 = 'c0000000-0000-4000-8000-000000000002';
const ENCERRAR_PELO_HUB = { modo: 'COMPLETO', pularGateTermos: true, itemAtivoId: ITEM_CRIADO_1 };
const ENCERRAR_SEM_ITEM = { ...ENCERRAR_PELO_HUB, itemAtivoId: null };
/** Corpo do POST /encerrar pelo "Finalizar Atendimento ✓" do módulo Procedimento (passa pelo portão de termos). */
const ENCERRAR_PELO_MODULO = { ...ENCERRAR_PELO_HUB, pularGateTermos: false };

/** 200 do encerrar (EncerramentoResultadoDTO) sem procedimentos devolvidos: nenhuma pergunta depois. */
const encerrarOk = ['POST', ROTA_ENCERRAR, ({ path: p }) => ({
  atendimentoId: p.split('/')[4],
  status: 'encerrado',
  encerradoEm: new Date().toISOString(),
  procedimentos: [],
  orientacoes: [],
})];

/** 409 de termo faltando, no formato do GlobalExceptionHandler (o iniciar do servidor recusa o item). */
const encerrarTermo409 = (nomeProcedimento) => ['POST', ROTA_ENCERRAR, () => ({
  status: 409,
  corpo: {
    error: 'TERMOS_OBRIGATORIOS_PENDENTES',
    status: 409,
    message: 'Assine os termos obrigatórios antes de executar o procedimento.',
    nomeProcedimento,
    termosFaltantes: [TERMO_FALTANTE],
  },
})];

const paginaPacientes = () => ({ content: [pacienteDto], totalElements: 1, totalPages: 1, number: 0, size: 20 });

function rotasBase({ agendas }) {
  return [
    ['GET', /^\/api\/v1\/pacientes(\/search)?$/, paginaPacientes],
    ['GET', new RegExp(`^/api/v1/pacientes/${IDS.PACIENTE}$`), () => pacienteDto],
    ['GET', /^\/api\/v1\/agendas\/(by-range|by-date|ocupacoes|by-profissional)$/, () => agendas],
    ['GET', /^\/api\/v1\/agendas\/[0-9a-f-]{36}$/, ({ path: p }) => {
      const id = p.split('/').pop();
      return agendas.find((a) => a.id === id) || { status: 404, corpo: { message: 'Agenda não encontrada' } };
    }],
    ['GET', /^\/api\/v1\/clinica\/procedimentos$/, () => catalogoClinica],
    ['GET', /^\/api\/v1\/dimensoes\/tipos-procedimento$/, () => tiposProcedimento],
    encerrarOk,
  ];
}

/** Termo do catálogo faltando: a resolução lista o faltante e o `iniciar` real recusa (assertPodeExecutar). */
const rotasTermoFaltante = [
  ['GET', /^\/api\/v1\/termos\/resolucao$/, () => ({
    faltantes: [TERMO_FALTANTE],
    termosExigidos: [TERMO_FALTANTE],
    procedimentosSemVinculo: [],
  })],
  ['POST', /^\/api\/v1\/procedimentos\/iniciar$/, () => ({
    status: 409,
    corpo: { message: 'Assine os termos obrigatórios antes de executar o procedimento.', faltantes: [TERMO_FALTANTE] },
  })],
  encerrarTermo409('Toxina botulínica'),
];

/** Módulo Procedimento → finalização → marca a 1ª orientação (padrão do sistema) → "Finalizar Atendimento ✓". */
async function finalizarPeloModuloProcedimento(srv, { orientacoesMarcadas = 1 } = {}) {
  clicarBotao(/Ir para Finalização e Orientações/);
  await assentarMuito();
  const caixas = screen.getAllByRole('checkbox');
  for (let i = 0; i < orientacoesMarcadas; i += 1) fireEvent.click(caixas[i]);
  await assentar();
  const inicio = srv.escritas.length;
  clicarBotao(/Finalizar Atendimento ✓/);
  await esperarEncerrar(srv);
  return inicio;
}

/**
 * Etapa 3: o encerrar espera a fila da consulta esvaziar (ex.: o item que ainda vai nascer) antes do POST /encerrar.
 * Assenta como antes e, se o POST ainda não saiu, continua assentando (com limite: no (l) ele não sai).
 */
async function esperarEncerrar(srv) {
  await assentarMuito(6);
  for (let i = 0; i < 30 && !srv.escritasConsulta.some(ehPostEncerrar); i += 1) await assentar();
  await assentarMuito();
}

function botoesVisiveis() {
  return Array.from(document.querySelectorAll('button'))
    .map((b) => (b.getAttribute('aria-label') || b.textContent || '').trim())
    .filter(Boolean)
    .join(' | ');
}

function clicarBotao(nome, indice = 0) {
  const lista = screen.queryAllByRole('button', { name: nome });
  if (!lista[indice]) throw new Error(`Botão ${nome} não encontrado. Visíveis: ${botoesVisiveis()}`);
  fireEvent.click(lista[indice]);
}

async function assentarMuito(vezes = 4) {
  for (let i = 0; i < vezes; i += 1) await assentar();
}

async function montarApp({ agendas = [], rotas = [], agora = INSTANTE_PADRAO, view = 'agenda', midia = false }) {
  prepararAmbienteSnapshot();
  if (midia) prepararMidia();
  vi.setSystemTime(new Date(agora));
  sessionStorage.clear();
  localStorage.clear();
  sessionStorage.setItem('activeView', view);
  const srv = criarServidorEncerrarFalso({
    permissoes: Object.values(PERMISSOES),
    rotas: [...rotas, ...rotasBase({ agendas })],
  });
  vi.stubGlobal('fetch', srv.fetchFalso);
  render(
    <ToastProvider>
      <AppRoot />
    </ToastProvider>,
  );
  await assentarMuito(6);
  return srv;
}

/** Card do rail da agenda → "Iniciar atendimento" (lote = grupo de agendas encadeadas do card). */
async function iniciarPelaAgenda() {
  clicarBotao('Iniciar atendimento');
  await assentarMuito();
  expect(screen.getAllByText(/(Consulta|Retorno) em andamento/).length).toBeGreaterThan(0);
}

/** Lista de pacientes → resumo do paciente → "Iniciar Atendimento" (com a agenda do dia, se houver). */
async function iniciarPeloPaciente() {
  fireEvent.click(screen.getAllByText('Maria Souza')[0]);
  await assentarMuito();
  clicarBotao(/Iniciar atendimento/i);
  await assentarMuito();
  screen.getByText(/(Consulta|Retorno) em andamento/);
}

async function abrirModulo(nome) {
  clicarBotao(new RegExp(`(^|sessões|assinatura)${nome}`));
  await assentarMuito();
}

async function voltarAoHub() {
  clicarBotao(/Voltar ao hub/);
  await assentarMuito();
}

/** No módulo Procedimento: escolhe o procedimento do catálogo pela busca. */
async function escolherProcedimentoNoModulo(nome) {
  const busca = screen.getAllByPlaceholderText('Buscar procedimento...')[0];
  fireEvent.focus(busca);
  fireEvent.click(busca);
  await assentar();
  fireEvent.click(screen.getByRole('option', { name: new RegExp(nome) }));
  await assentarMuito();
}

/** "Encerrar consulta" no hub → decisão no modal. Devolve onde o roteiro começa. */
async function encerrarPeloHub(srv, decisao = /^Finalizar Atendimento$/) {
  const inicio = srv.escritas.length;
  clicarBotao(/Encerrar consulta/);
  await assentar();
  clicarBotao(decisao);
  await esperarEncerrar(srv);
  return inicio;
}

/** Painel "Mapa de aplicação" do módulo Procedimento (MapaAplicacaoPanel.jsx:384). */
function painelDoMapa() {
  const titulo = screen.getAllByText('Mapa de aplicação').find((el) => el.tagName === 'H4' && el.closest('.rounded-2xl'));
  if (!titulo) throw new Error(`Painel do mapa não encontrado. Visíveis: ${botoesVisiveis()}`);
  return titulo.closest('.rounded-2xl');
}

/** Upload da foto-modelo da vista (FotoVistaCanvas.jsx:549 → onRequestUpload → ensureReady → setFotoVista). */
async function enviarFotoDoMapa(arquivo) {
  const entrada = painelDoMapa().querySelector('input[type="file"]');
  fireEvent.change(entrada, { target: { files: [arquivo] } });
  await assentarMuito();
}

/** Abre o mapeamento em tela cheia, clica no centro da foto, confirma a quantidade e sai. */
async function marcarPontoNoMapa({ quantidade } = {}) {
  clicarBotao(/Abrir Mapeamento/);
  await assentarMuito();
  const overlay = document.querySelector('.fixed.inset-0.z-\\[140\\]');
  const area = overlay?.querySelector('.cursor-crosshair');
  if (!area) throw new Error('Área de marcação do mapa não encontrada.');

  if (quantidade != null) {
    // Se a barra estiver recolhida em tela estreita, abre o menu
    const btnDrawer = overlay?.querySelector('button[aria-label="Abrir menu de ferramentas"]');
    if (btnDrawer) {
      fireEvent.click(btnDrawer);
      await assentar();
    }
    const labelDose = Array.from(overlay?.querySelectorAll('label') || []).find((l) =>
      /Dose padrão/i.test(l.textContent || ''),
    );
    const inputDose = labelDose?.querySelector('input[type="number"]');
    if (inputDose) {
      fireEvent.change(inputDose, { target: { value: String(quantidade) } });
      await assentar();
    }
  }

  fireEvent.pointerDown(area, { clientX: 400, clientY: 300, pointerId: 1 });
  await assentar();
  const modal = screen.queryByRole('dialog', { name: /Quantidade no ponto/ });
  if (modal) {
    if (quantidade != null) {
      fireEvent.change(within(modal).getByRole('spinbutton'), { target: { value: String(quantidade) } });
    }
    fireEvent.click(within(modal).getByRole('button', { name: /^Confirmar$/ }));
    await assentar();
  }
  // Com a tela "estreita" (matchMedia falso) a barra fica no drawer; Esc fecha (useMapeamentoFullscreenKeyboardShortcuts.js:37).
  fireEvent.keyDown(window, { key: 'Escape' });
  await assentarMuito();
}

/** Desenha no SignatureFullscreenModal aberto (Step4LGPD.jsx:142) e confirma. */
async function assinarNoModal() {
  const canvas = document.querySelector('.fixed.inset-0.z-\\[300\\] canvas');
  if (!canvas) throw new Error('Canvas da assinatura não encontrado.');
  fireEvent.pointerDown(canvas, { clientX: 20, clientY: 20, pointerId: 1 });
  fireEvent.pointerMove(canvas, { clientX: 120, clientY: 60, pointerId: 1 });
  fireEvent.pointerUp(canvas, { pointerId: 1 });
  await assentar();
  clicarBotao(/Confirmar assinatura/);
  await assentarMuito();
}

/**
 * Diferença aceita do B2 (plano, "Diferenças aceitas": (n) e (q)): só as agendas ativas entram no lote.
 * A preparação continua igual à de hoje. Depois da Etapa 3 o roteiro fica vazio (o `iniciar` de cada item é do
 * servidor); o lote é o que o abrir da consulta leva: só `ativas`, e as outras não aparecem.
 */
function soAgendasAtivasNoLote(ativas, foraDoLote) {
  return (hoje, novo, srv) => {
    expect(novo.preparacao).toEqual(hoje.preparacao);
    const abrir = srv.escritasConsulta.filter((e) => e.method === 'POST' && e.path === '/api/v1/atendimentos');
    expect(abrir).toHaveLength(1);
    const lote = marcar(abrir[0].body, srv.marcadores);
    expect(lote.agendaIds).toEqual(ativas);
    const texto = JSON.stringify(lote);
    for (const marca of foraDoLote) expect(texto).not.toContain(marca);
  };
}

/**
 * Na consulta o mapa é rascunho do item: o `/procedimentos/iniciar` que o mapa disparava ao marcar sai da preparação
 * e passa a ser feito pelo encerrar no servidor, um por item do lote (provado no EncerramentoEquivalenciaIT).
 */
function iniciarDoMapaVaiParaOEncerrar() {
  const ehIniciar = (e) => e.path === '/api/v1/procedimentos/iniciar';
  return (hoje, novo) => {
    expect(novo.preparacao).toEqual(hoje.preparacao.filter((e) => !ehIniciar(e)));
  };
}

/**
 * Antes da Decisão 4, o "Encerrar consulta" do hub salvava a anamnese antes de encerrar (confirmEncerrarConsulta →
 * autoSaveAnamneseSilently), fora do encerrar. Com consulta na tela isso não acontece mais (cenário (j)); o filtro
 * segue para os roteiros gravados.
 */
const ehAnamnese = (e) => e.path.startsWith('/api/v1/anamnese/');

/**
 * Etapa 3 (P1): o encerrar virou um único POST /encerrar com o corpo certo (`null` = nenhum POST, o portão do front
 * barrou) e nada do encerrar é gravado fora da consulta: o roteiro fica vazio, tirando a anamnese do hub.
 */
function conferirEncerrarUnico(srv, doc, corpoEsperado) {
  const posts = srv.escritasConsulta.filter(ehPostEncerrar);
  expect(posts.map((e) => e.body)).toEqual(corpoEsperado ? [corpoEsperado] : []);
  expect(doc.roteiro.filter((e) => !ehAnamnese(e))).toEqual([]);
}

/**
 * F5b (orientações por item): as orientações NÃO vão no corpo do POST /encerrar; vão antes, no PATCH do item
 * (`orientacoes`). O esperado no PATCH é a lista que o encerrar de hoje mandava no POST /procedimentos/{id}/orientacoes
 * do roteiro gravado (mesmo texto, checado e ordem). Sem o JSON gravado (modo de gravação), nada a conferir.
 */
function orientacoesDoRoteiroGravado(cenario) {
  const arquivo = path.join(DIR, `${cenario}.json`);
  if (!fs.existsSync(arquivo)) return undefined;
  const hoje = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
  const post = hoje.roteiro.find((e) => e.method === 'POST' && /\/procedimentos\/[^/]+\/orientacoes$/.test(e.path));
  return post?.body;
}

/** O último PATCH do item com `orientacoes` levou a mesma lista que o roteiro de hoje gravava no procedimento. */
function conferirOrientacoesNoItem(srv, itemId, cenario) {
  const esperado = orientacoesDoRoteiroGravado(cenario);
  if (esperado === undefined) return;
  const patches = srv.escritasConsulta.filter(
    (e) => e.method === 'PATCH' && e.path.endsWith(`/itens/${itemId}`) && Array.isArray(e.body?.orientacoes),
  );
  expect(patches.length).toBeGreaterThan(0);
  expect(patches[patches.length - 1].body.orientacoes).toEqual(esperado);
}

/**
 * Decisões 4 (avaliação no servidor): com consulta na tela, a queixa digitada no módulo Anamnese vai no blur pelo
 * PATCH /atendimentos/{id}/avaliacao-texto (o servidor cria o preenchimento), e não mais pelo POST/PATCH de
 * /anamnese/paciente. Sai da preparação o POST da anamnese e sai do roteiro o PATCH de observações do hub.
 */
function anamneseVaiPelaConsulta(queixa) {
  const conferir = (hoje, novo, srv) => {
    expect(novo.preparacao).toEqual(hoje.preparacao.filter((e) => !ehAnamnese(e)));
    expect(novo.roteiro).toEqual([]);
    const textos = srv.escritasConsulta.filter(
      (e) => e.method === 'PATCH' && /\/atendimentos\/[^/]+\/avaliacao-texto$/.test(e.path),
    );
    expect(textos.length).toBeGreaterThan(0);
    expect(textos[textos.length - 1].body).toMatchObject({ queixa });
  };
  conferir.conferiuRoteiro = true;
  return conferir;
}

/** O roteiro novo é só o que o de hoje gravava antes do encerrar (a anamnese do hub). */
function conferirRoteiro(hoje, novo) {
  expect(novo.roteiro).toEqual(hoje.roteiro.filter(ehAnamnese));
}

function semRoteiro({ roteiro: _roteiro, ...resto }) {
  return resto;
}

function registrar(
  cenario,
  descricao,
  srv,
  inicio,
  { agora = INSTANTE_PADRAO, fixture = {}, observacao, diferencaAceita, encerrar = ENCERRAR_PELO_HUB } = {},
) {
  const doc = {
    cenario,
    descricao,
    ...(observacao ? { observacao } : {}),
    agora,
    fixture: marcar(fixture, srv.marcadores),
    preparacao: marcar(srv.escritas.slice(0, inicio), srv.marcadores),
    roteiro: marcar(srv.escritas.slice(inicio), srv.marcadores),
  };
  const arquivo = path.join(DIR, `${cenario}.json`);
  const texto = `${JSON.stringify(doc, null, 2)}\n`;
  if (diferencaAceita) {
    conferirEncerrarUnico(srv, doc, encerrar);
    if (fs.existsSync(arquivo)) {
      const hoje = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
      diferencaAceita(hoje, JSON.parse(texto), srv);
      if (!diferencaAceita.conferiuRoteiro) conferirRoteiro(hoje, JSON.parse(texto));
    }
  } else if (GRAVAR) {
    fs.mkdirSync(DIR, { recursive: true });
    fs.writeFileSync(arquivo, texto, 'utf8');
  } else {
    conferirEncerrarUnico(srv, doc, encerrar);
    // A preparação (e o resto do cenário) continua a gravada; só o roteiro do encerrar mudou.
    if (fs.existsSync(arquivo)) {
      const hoje = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
      expect(semRoteiro(JSON.parse(texto))).toEqual(semRoteiro(hoje));
      conferirRoteiro(hoje, JSON.parse(texto));
    }
  }
  return doc;
}

describe('roteiro de hoje do encerrar (Y5)', () => {
  afterEach(() => {
    limparMidia();
    limparAmbienteSnapshot();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('(a) agenda com 1 procedimento', async () => {
    const agendas = [agendaDto({ id: IDS.AGENDA_1 })];
    const srv = await montarApp({ agendas });
    await iniciarPelaAgenda();
    const inicio = await encerrarPeloHub(srv);
    const doc = registrar('a', 'Agenda confirmada com 1 procedimento do catálogo; Finalizar Atendimento no hub.', srv, inicio, {
      fixture: { agendas },
    });
    expect(doc.roteiro).toEqual([]);
  }, TIMEOUT);

  it('(b) lote com vários itens', async () => {
    const agendas = [
      agendaDto({ id: IDS.AGENDA_1 }),
      agendaDto({
        id: IDS.AGENDA_2,
        horaInicio: '11:00:00',
        horaFim: '12:00:00',
        catalogoId: IDS.CATALOGO_2,
        catalogoNome: 'Preenchimento labial',
      }),
    ];
    const srv = await montarApp({ agendas });
    await iniciarPelaAgenda();
    const inicio = await encerrarPeloHub(srv);
    registrar('b', 'Duas agendas encadeadas 10-11 e 11-12 (lote de 2 catálogos); Finalizar Atendimento no hub.', srv, inicio, {
      fixture: { agendas },
    });
  }, TIMEOUT);

  it('(c) avulso sem agenda, procedimento registrado até a finalização', async () => {
    const srv = await montarApp({ agendas: [], view: 'pacientes' });
    await iniciarPeloPaciente();
    await abrirModulo('Procedimento');
    await escolherProcedimentoNoModulo('Toxina botulínica');
    const inicio = await finalizarPeloModuloProcedimento(srv);
    const ITEM_C = 'c0000000-0000-4000-8000-000000000002';
    registrar('c', 'Sem agenda; procedimento escolhido no módulo, 1 orientação marcada e "Finalizar Atendimento ✓" no fim do módulo.', srv, inicio, {
      encerrar: { ...ENCERRAR_PELO_MODULO, itemAtivoId: ITEM_C },
    });
    conferirOrientacoesNoItem(srv, ITEM_C, 'c');
  }, TIMEOUT);

  it('(d) consulta sem procedimento, com agenda', async () => {
    const agendas = [
      agendaDto({ id: IDS.AGENDA_1, tipoCodigo: 'CONSULTA', tipoNome: 'Consulta', catalogoId: null, catalogoNome: null }),
    ];
    const srv = await montarApp({ agendas });
    await iniciarPelaAgenda();
    const inicio = await encerrarPeloHub(srv);
    registrar('d', 'Agenda do tipo CONSULTA sem catálogo; Finalizar Atendimento no hub.', srv, inicio, {
      fixture: { agendas },
      encerrar: ENCERRAR_SEM_ITEM,
    });
  }, TIMEOUT);

  it('(e) consulta sem procedimento, sem agenda', async () => {
    const srv = await montarApp({ agendas: [], view: 'pacientes' });
    await iniciarPeloPaciente();
    const inicio = await encerrarPeloHub(srv);
    registrar('e', 'Sem agenda e sem procedimento (iniciada pelo paciente); Finalizar Atendimento no hub.', srv, inicio, {
      encerrar: ENCERRAR_SEM_ITEM,
    });
  }, TIMEOUT);

  it('(g) com item de plano', async () => {
    const agendas = [agendaDto({ id: IDS.AGENDA_1, planejamentoItemId: IDS.PLANO_ITEM_1 })];
    const srv = await montarApp({ agendas });
    await iniciarPelaAgenda();
    const inicio = await encerrarPeloHub(srv);
    registrar('g', 'Agenda de item de plano (planejamentoItemId); Finalizar Atendimento no hub.', srv, inicio, {
      fixture: { agendas },
    });
  }, TIMEOUT);

  it('(i) com orientações', async () => {
    const agendas = [agendaDto({ id: IDS.AGENDA_1 })];
    const ITEM_1 = 'c1000000-0000-4000-8000-000000000001';
    const srv = await montarApp({
      agendas,
      rotas: [
        // Etapa 3: o encerrar espera a fila da consulta. O item do servidor real vem ligado à agenda; sem isso o
        // espelho reenfileira o item com debounce e, com o relógio parado do teste, a fila nunca esvazia.
        // O item só nasce no esvaziar da fila; o encerrar lê o item ativo depois de esvaziar: itemAtivoId é o ITEM_1.
        ['POST', /^\/api\/v1\/atendimentos\/[^/]+\/itens$/, ({ body }) => ({ id: ITEM_1, agendaId: IDS.AGENDA_1, ordem: 1, ...body })],
      ],
    });
    await iniciarPelaAgenda();
    await abrirModulo('Procedimento');
    const inicio = await finalizarPeloModuloProcedimento(srv, { orientacoesMarcadas: 2 });
    registrar('i', 'Agenda com 1 procedimento; módulo Procedimento, 2 orientações padrão marcadas, "Finalizar Atendimento ✓".', srv, inicio, {
      fixture: { agendas },
      encerrar: { ...ENCERRAR_PELO_MODULO, itemAtivoId: ITEM_1 },
    });
    conferirOrientacoesNoItem(srv, ITEM_1, 'i');
  }, TIMEOUT);

  it('(j) com anamnese preenchida na consulta', async () => {
    const agendas = [agendaDto({ id: IDS.AGENDA_1 })];
    const srv = await montarApp({
      agendas,
      rotas: [
        ['GET', /^\/api\/v1\/anamnese\/fichas\/basica$/, () => ({ id: IDS.FICHA_BASICA, nome: 'Ficha básica' })],
        ['POST', /^\/api\/v1\/anamnese\/paciente\/[^/]+$/, ({ gerar }) => ({ id: gerar('ANAMNESE') })],
      ],
    });
    await iniciarPelaAgenda();
    await abrirModulo('Anamnese');
    const campo = screen.getAllByPlaceholderText(/O que trouxe o paciente|Descreva o motivo da consulta/)[0];
    fireEvent.change(campo, { target: { value: 'Rugas na testa' } });
    fireEvent.blur(campo);
    await assentarMuito();
    await voltarAoHub();
    const inicio = await encerrarPeloHub(srv);
    registrar('j', 'Agenda com 1 procedimento; queixa digitada no módulo Anamnese (onBlur), volta ao hub e Finalizar Atendimento.', srv, inicio, {
      fixture: { agendas },
      diferencaAceita: anamneseVaiPelaConsulta('Rugas na testa'),
    });
  }, TIMEOUT);

  it('(k) modal com termo pendente', async () => {
    const agendas = [agendaDto({ id: IDS.AGENDA_1 })];
    const srv = await montarApp({ agendas, rotas: rotasTermoFaltante });
    await iniciarPelaAgenda();
    const inicio = await encerrarPeloHub(srv);
    registrar('k', 'Agenda com 1 procedimento cujo termo falta; Finalizar Atendimento no modal do hub (pula o gate).', srv, inicio, {
      fixture: { agendas, termosFaltantes: [TERMO_FALTANTE] },
    });
  }, TIMEOUT);

  it('(l) "Finalizar Atendimento ✓" com termo pendente', async () => {
    const agendas = [agendaDto({ id: IDS.AGENDA_1 })];
    const srv = await montarApp({ agendas, rotas: rotasTermoFaltante });
    await iniciarPelaAgenda();
    await abrirModulo('Procedimento');
    const inicio = srv.escritas.length;
    const continuar = screen.queryAllByRole('button', { name: /Ir para Finalização e Orientações/ })[0];
    const bloqueado = !continuar || continuar.disabled;
    if (!bloqueado) await finalizarPeloModuloProcedimento(srv);
    registrar('l', 'Agenda com 1 procedimento cujo termo falta; tenta "Finalizar Atendimento ✓" pelo módulo Procedimento.', srv, inicio, {
      fixture: { agendas, termosFaltantes: [TERMO_FALTANTE] },
      observacao: bloqueado
        ? 'Hoje o módulo trava a execução: "Ir para Finalização e Orientações" fica desabilitado e "Finalizar Atendimento ✓" não é alcançável; nada é gravado.'
        : undefined,
      // O portão de termos do front barra: nenhum POST /encerrar.
      encerrar: null,
    });
  }, TIMEOUT);

  it('(o) "Encerrar consulta" numa sessão de retorno', async () => {
    const agendas = [
      agendaDto({
        id: IDS.AGENDA_1,
        tipoCodigo: 'retorno',
        tipoNome: 'Retorno',
        procedimentoFeitoOrigemId: IDS.PF_ORIGEM,
      }),
    ];
    const srv = await montarApp({ agendas });
    await iniciarPelaAgenda();
    const inicio = await encerrarPeloHub(srv);
    registrar('o', 'Agenda do tipo retorno (procedimentoFeitoOrigemId); "Encerrar consulta" no hub → Finalizar Atendimento.', srv, inicio, {
      fixture: { agendas, procedimentoOrigem: IDS.PF_ORIGEM },
    });
  }, TIMEOUT);

  it('(r) termo faltando em outro item do lote', async () => {
    const agendas = [
      agendaDto({ id: IDS.AGENDA_1 }),
      agendaDto({
        id: IDS.AGENDA_2,
        horaInicio: '11:00:00',
        horaFim: '12:00:00',
        catalogoId: IDS.CATALOGO_2,
        catalogoNome: 'Preenchimento labial',
      }),
    ];
    const srv = await montarApp({
      agendas,
      rotas: [
        ['GET', /^\/api\/v1\/termos\/resolucao$/, ({ query }) => (query.includes(IDS.CATALOGO_2)
          ? { faltantes: [TERMO_FALTANTE], termosExigidos: [TERMO_FALTANTE], procedimentosSemVinculo: [] }
          : { faltantes: [], termosExigidos: [], procedimentosSemVinculo: [] })],
        ['POST', /^\/api\/v1\/procedimentos\/iniciar$/, ({ body, gerar }) => (body?.catalogoProcedimentoSaudeId === IDS.CATALOGO_2
          ? { status: 409, corpo: { message: 'Assine os termos obrigatórios antes de executar o procedimento.', faltantes: [TERMO_FALTANTE] } }
          : { id: gerar('PF'), statusCodigo: 'em_andamento', ...body })],
        encerrarTermo409('Preenchimento labial'),
      ],
    });
    await iniciarPelaAgenda();
    const inicio = await encerrarPeloHub(srv);
    registrar('r', 'Lote de 2 agendas encadeadas; só o 2º catálogo (Preenchimento labial) tem termo faltando; Finalizar Atendimento no hub.', srv, inicio, {
      fixture: { agendas, termosFaltantes: { [IDS.CATALOGO_2]: [TERMO_FALTANTE] } },
    });
  }, TIMEOUT);

  it('(y) agenda + "Iniciar" no item do plano (módulo Planejamento)', async () => {
    const agendas = [
      agendaDto({ id: IDS.AGENDA_1, tipoCodigo: 'CONSULTA', tipoNome: 'Consulta', catalogoId: null, catalogoNome: null }),
    ];
    const plano = {
      id: IDS.PLANO_1,
      titulo: 'Rejuvenescimento facial',
      statusCodigo: 'ATIVO',
      statusNome: 'Ativo',
      criadoEm: '2026-09-01T13:00:00.000Z',
      valorTotal: 1500,
      progresso: 0,
      itens: [
        {
          id: IDS.PLANO_ITEM_1,
          planejamentoItemId: IDS.PLANO_ITEM_1,
          planejamentoId: IDS.PLANO_1,
          catalogoProcedimentoSaudeId: IDS.CATALOGO_1,
          catalogoNome: 'Toxina botulínica',
          dataPlanejada: '2026-10-06',
          statusItem: 'PLANEJADO',
          statusItemNome: 'Planejado',
          valorOrcado: 1500,
          sessaoAtiva: null,
          sessaoRealizada: null,
          sessaoRetornoAtiva: null,
        },
      ],
    };
    const srv = await montarApp({
      agendas,
      rotas: [
        ['GET', /^\/api\/v1\/planejamentos$/, () => [plano]],
        ['GET', /^\/api\/v1\/planejamentos\/[^/]+$/, () => plano],
        // Lista aqui mantém o laço de PlanosTab.jsx:1267 (procedimentosFeitos=[] novo a cada render, AppRefactored.jsx:4572).
        ['GET', /^\/api\/v1\/procedimentos\/paciente\/[^/]+$/, () => ({})],
      ],
    });
    await iniciarPelaAgenda();
    await abrirModulo('Planejamento');
    clicarBotao(/^Iniciar$/);
    await assentarMuito();
    if (screen.queryAllByRole('button', { name: /Voltar ao hub/ }).length > 0) await voltarAoHub();
    const inicio = await encerrarPeloHub(srv);
    registrar('y', 'Agenda CONSULTA sem catálogo; no módulo Planejamento, "Iniciar" no item do plano; volta ao hub e Finalizar Atendimento.', srv, inicio, {
      fixture: { agendas, planos: [plano] },
      // B-42 F3: a linha "Consulta" da agenda sem catálogo não manda mais o rótulo como nome livre (antes, aqui, um
      // POST /itens {nomeLivre:'Consulta'} levava o id ...002); o item do plano é o primeiro POST /itens: ...002.
      encerrar: { ...ENCERRAR_PELO_HUB, itemAtivoId: 'c0000000-0000-4000-8000-000000000002' },
    });
  }, TIMEOUT);

  it('(m) sem agenda, procedimento escolhido no módulo e encerrado pelo hub', async () => {
    const srv = await montarApp({ agendas: [], view: 'pacientes' });
    await iniciarPeloPaciente();
    await abrirModulo('Procedimento');
    await escolherProcedimentoNoModulo('Toxina botulínica');
    await voltarAoHub();
    const inicio = await encerrarPeloHub(srv);
    registrar('m', 'Sem agenda; procedimento escolhido no módulo, volta ao hub e Finalizar Atendimento no modal.', srv, inicio, {
      encerrar: { ...ENCERRAR_PELO_HUB, itemAtivoId: 'c0000000-0000-4000-8000-000000000002' },
    });
  }, TIMEOUT);

  it('(n) lote com agenda cancelada, reagendada e realizada', async () => {
    const agendas = [
      agendaDto({ id: IDS.AGENDA_4, horaInicio: '09:00:00', horaFim: '10:00:00', status: 'realizado', catalogoId: IDS.CATALOGO_2, catalogoNome: 'Preenchimento labial' }),
      agendaDto({ id: IDS.AGENDA_1 }),
      agendaDto({ id: IDS.AGENDA_2, horaInicio: '11:00:00', horaFim: '12:00:00', status: 'cancelado', catalogoId: IDS.CATALOGO_2, catalogoNome: 'Preenchimento labial' }),
      agendaDto({ id: IDS.AGENDA_3, horaInicio: '12:00:00', horaFim: '13:00:00', status: 'reagendado', catalogoId: IDS.CATALOGO_2, catalogoNome: 'Preenchimento labial' }),
    ];
    const srv = await montarApp({ agendas, view: 'pacientes' });
    await iniciarPeloPaciente();
    const inicio = await encerrarPeloHub(srv);
    registrar('n', 'Pelo resumo do paciente: no dia há 1 realizada, 1 confirmada, 1 cancelada e 1 reagendada; Finalizar no hub.', srv, inicio, {
      fixture: { agendas },
      observacao: 'O card da agenda não oferece "Iniciar atendimento" para esse grupo; o lote misto só nasce pelo resumo do paciente (AppRefactored.jsx:1852-1872).',
      diferencaAceita: soAgendasAtivasNoLote(['${AGENDA_1}'], ['${AGENDA_2}', '${AGENDA_3}', '${AGENDA_4}']),
    });
  }, TIMEOUT);

  it('(q) 2ª visita no mesmo dia', async () => {
    const agendas = [
      agendaDto({ id: IDS.AGENDA_2, horaInicio: '08:00:00', horaFim: '09:00:00', status: 'realizado' }),
      agendaDto({ id: IDS.AGENDA_1 }),
    ];
    const srv = await montarApp({ agendas, view: 'pacientes' });
    await iniciarPeloPaciente();
    const inicio = await encerrarPeloHub(srv);
    registrar('q', 'Pelo resumo do paciente: visita das 08:00 já realizada e a das 10:00 confirmada; Finalizar no hub.', srv, inicio, {
      fixture: { agendas },
      diferencaAceita: soAgendasAtivasNoLote(['${AGENDA_1}'], ['${AGENDA_2}']),
    });
  }, TIMEOUT);

  it('(s) avulsa em conflito de horário', async () => {
    const srv = await montarApp({
      agendas: [],
      view: 'pacientes',
      // A trigger estoura no commit, fora do serviço: o GlobalExceptionHandler responde 500, não 409.
      rotas: [['POST', /^\/api\/v1\/agendas$/, () => ({ status: 500, corpo: { status: 500, error: 'Conflito de agenda: profissional já possui horário sobreposto no dia 2026-10-06' } })]],
    });
    await iniciarPeloPaciente();
    await abrirModulo('Procedimento');
    await escolherProcedimentoNoModulo('Toxina botulínica');
    await voltarAoHub();
    const inicio = await encerrarPeloHub(srv);
    registrar('s', 'Como (m), mas o POST da agenda avulsa falha na trigger de conflito (500 no backend real).', srv, inicio, {
      fixture: {
        respostas: { 'POST /api/v1/agendas': 500 },
        // Agenda ativa de outra paciente com a mesma profissional: com forcar=true só a trigger fn_validar_conflito_agenda barra.
        conflitoProfissional: { dataAgendamento: '2026-10-06', horaInicio: '09:30:00', horaFim: '10:30:00' },
      },
      encerrar: { ...ENCERRAR_PELO_HUB, itemAtivoId: 'c0000000-0000-4000-8000-000000000002' },
    });
  }, TIMEOUT);

  it('(u) enriquecer com conflito Java', async () => {
    const agendas = [agendaDto({ id: IDS.AGENDA_1 })];
    const srv = await montarApp({
      agendas,
      rotas: [['PUT', /^\/api\/v1\/agendas\/[^/]+$/, () => ({ status: 409, corpo: { message: 'Conflito de horário com outro agendamento.' } })]],
    });
    await iniciarPelaAgenda();
    const inicio = await encerrarPeloHub(srv);
    registrar('u', 'Agenda com 1 procedimento; o PUT que enriquece a agenda recebe 409 (conflito Java).', srv, inicio, {
      fixture: { agendas, respostas: { 'PUT /api/v1/agendas/{id}': 409 } },
    });
  }, TIMEOUT);

  it('(v) D3: iniciada 23:50, encerrada 00:10', async () => {
    const inicioSessao = '2026-10-07T02:50:00.000Z';
    const fim = '2026-10-07T03:10:00.000Z';
    const srv = await montarApp({ agendas: [], view: 'pacientes', agora: inicioSessao });
    await iniciarPeloPaciente();
    await abrirModulo('Procedimento');
    await escolherProcedimentoNoModulo('Toxina botulínica');
    await voltarAoHub();
    vi.setSystemTime(new Date(fim));
    const inicio = await encerrarPeloHub(srv);
    registrar('v', 'Como (m), iniciada 06/10 23:50 e encerrada 07/10 00:10 (horário da clínica).', srv, inicio, {
      agora: fim,
      fixture: { iniciadaEm: inicioSessao },
      encerrar: { ...ENCERRAR_PELO_HUB, itemAtivoId: 'c0000000-0000-4000-8000-000000000002' },
    });
  }, TIMEOUT);

  it('(w) D3: retomada 3 dias depois', async () => {
    const fim = '2026-10-09T13:00:00.000Z';
    const srv = await montarApp({ agendas: [], view: 'pacientes' });
    await iniciarPeloPaciente();
    await abrirModulo('Procedimento');
    await escolherProcedimentoNoModulo('Toxina botulínica');
    await voltarAoHub();
    vi.setSystemTime(new Date(fim));
    const inicio = await encerrarPeloHub(srv);
    registrar('w', 'Como (m), iniciada 06/10 10:00 e encerrada 09/10 10:00 na mesma sessão do aparelho.', srv, inicio, {
      agora: fim,
      fixture: { iniciadaEm: INSTANTE_PADRAO },
      encerrar: { ...ENCERRAR_PELO_HUB, itemAtivoId: 'c0000000-0000-4000-8000-000000000002' },
    });
  }, TIMEOUT);

  it('(mapa1) mapa de aplicação em 1 item', async () => {
    const agendas = [agendaDto({ id: IDS.AGENDA_1 })];
    const srv = await montarApp({ agendas, midia: true });
    await iniciarPelaAgenda();
    await abrirModulo('Procedimento');
    await enviarFotoDoMapa(arquivoPng('mapa-frontal.png', PNG_A_BASE64));
    await marcarPontoNoMapa();
    await voltarAoHub();
    const inicio = await encerrarPeloHub(srv);
    registrar('mapa1', 'Agenda com 1 procedimento; no módulo Procedimento, upload da foto da vista frontal e 1 ponto (quantidade padrão); volta ao hub e Finalizar Atendimento.', srv, inicio, {
      fixture: { agendas },
      diferencaAceita: iniciarDoMapaVaiParaOEncerrar(),
    });
  }, TIMEOUT);

  it('(mapa2) mapa em 2 itens do lote', async () => {
    const agendas = [
      agendaDto({ id: IDS.AGENDA_1 }),
      agendaDto({
        id: IDS.AGENDA_2,
        horaInicio: '11:00:00',
        horaFim: '12:00:00',
        catalogoId: IDS.CATALOGO_2,
        catalogoNome: 'Preenchimento labial',
      }),
    ];
    const srv = await montarApp({ agendas, midia: true });
    await iniciarPelaAgenda();
    await abrirModulo('Procedimento');
    await enviarFotoDoMapa(arquivoPng('mapa-item-1.png', PNG_A_BASE64));
    await marcarPontoNoMapa();
    clicarBotao(/^(2\.\s*)?Preenchimento labial/);
    await assentarMuito();
    await enviarFotoDoMapa(arquivoPng('mapa-item-2.png', PNG_B_BASE64));
    await marcarPontoNoMapa();
    await voltarAoHub();
    const inicio = await encerrarPeloHub(srv);
    registrar('mapa2', 'Lote de 2 agendas encadeadas (como (b)); foto e 1 ponto no mapa do item 1, troca para a aba do item 2, foto e 1 ponto; volta ao hub e Finalizar Atendimento.', srv, inicio, {
      fixture: { agendas },
      // Hoje o iniciar do mapa do item 2 levava a agenda do item 1; no encerrar do servidor cada item leva a sua.
      diferencaAceita: iniciarDoMapaVaiParaOEncerrar(),
      // Na sessão unificada sem abas fragmentadas, o item ativo do encerramento é o item raiz (...002).
      encerrar: { ...ENCERRAR_PELO_HUB, itemAtivoId: 'c0000000-0000-4000-8000-000000000002' },
    });
  }, TIMEOUT);

  it('(x) mapa inválido para criarMapa', async () => {
    const agendas = [agendaDto({ id: IDS.AGENDA_1 })];
    const srv = await montarApp({
      agendas,
      midia: true,
      // tb_mapa_marcacao.quantidade é numeric(8,2): 1.000.000 passa no modal e no @Positive e estoura no flush (500).
      rotas: [['POST', /^\/api\/v1\/mapas$/, () => ({ status: 500, corpo: { status: 500, error: 'Internal Server Error' } })]],
    });
    await iniciarPelaAgenda();
    await abrirModulo('Procedimento');
    await enviarFotoDoMapa(arquivoPng('mapa-frontal.png', PNG_A_BASE64));
    await marcarPontoNoMapa({ quantidade: 1000000 });
    await voltarAoHub();
    const inicio = await encerrarPeloHub(srv);
    registrar('x', 'Como (mapa1), mas o ponto tem quantidade 1000000 (aceita pelo modal; tb_mapa_marcacao.quantidade numeric(8,2) recusa).', srv, inicio, {
      fixture: { agendas, respostas: { 'POST /api/v1/mapas': 500 } },
      diferencaAceita: iniciarDoMapaVaiParaOEncerrar(),
    });
  }, TIMEOUT);

  it('(h) termo assinado na consulta', async () => {
    const agendas = [agendaDto({ id: IDS.AGENDA_1 })];
    const termo = {
      id: IDS.TERMO_1,
      titulo: TERMO_FALTANTE.titulo,
      conteudo: 'Declaro estar ciente dos riscos do procedimento.',
      ativo: true,
      autoAssinarProfissional: false,
    };
    let assinado = false;
    const srv = await montarApp({
      agendas,
      midia: true,
      rotas: [
        ['GET', /^\/api\/v1\/termos$/, () => [termo]],
        ['GET', /^\/api\/v1\/termos\/resolucao$/, () => (assinado
          ? { faltantes: [], termosExigidos: [TERMO_FALTANTE], procedimentosSemVinculo: [] }
          : { faltantes: [TERMO_FALTANTE], termosExigidos: [TERMO_FALTANTE], procedimentosSemVinculo: [] })],
        ['POST', /^\/api\/v1\/termos\/assinaturas$/, ({ body, gerar }) => {
          assinado = true;
          return { id: gerar('ASSINATURA'), statusCodigo: 'ASSINADO', ...body };
        }],
        ['GET', /^\/api\/v1\/perfil\/assinatura$/, () => ({ assinaturaPadrao: null })],
        ['GET', /^\/$/, () => ({ ip: '203.0.113.10' })],
      ],
    });
    await iniciarPelaAgenda();
    await abrirModulo('Termos');
    if (screen.queryAllByRole('button', { name: /Ler e Assinar/ }).length > 0) {
      clicarBotao(/Ler e Assinar/);
      await assentarMuito();
    }
    clicarBotao(/Assinar como Profissional/);
    await assentar();
    await assinarNoModal();
    if (screen.queryAllByRole('button', { name: /Agora não/ }).length > 0) {
      clicarBotao(/Agora não/);
      await assentar();
    }
    clicarBotao(/Solicitar Assinatura/);
    await assentar();
    clicarBotao(/Neste Dispositivo/);
    await assentar();
    await assinarNoModal();
    await voltarAoHub();
    const inicio = await encerrarPeloHub(srv);
    registrar('h', 'Agenda com 1 procedimento cujo termo falta; no módulo Termos, assinatura do profissional e do paciente ("Neste Dispositivo"); volta ao hub e Finalizar Atendimento.', srv, inicio, {
      fixture: { agendas, termosFaltantes: [TERMO_FALTANTE] },
    });
  }, TIMEOUT);

  it('(p) foto da avaliação removida e foto anotada', async () => {
    const agendas = [agendaDto({ id: IDS.AGENDA_1 })];
    const srv = await montarApp({ agendas, midia: true });
    await iniciarPelaAgenda();
    await abrirModulo('Avaliação');
    const secao = screen.getByText('Fotos da avaliação').closest('.mb-2').parentElement;
    fireEvent.change(secao.querySelector('input[type="file"]'), {
      target: { files: [arquivoPng('avaliacao-1.png', PNG_A_BASE64), arquivoPng('avaliacao-2.png', PNG_B_BASE64)] },
    });
    await assentarMuito();
    clicarBotao(/^Anotar$/, 0);
    await assentarMuito();
    clicarBotao(/Salvar anotação/);
    await assentarMuito();
    if (screen.queryAllByRole('button', { name: /Fechar editor/ }).length > 0) {
      clicarBotao(/Fechar editor/);
      await assentarMuito();
    }
    clicarBotao(/Remover imagem/, 1);
    await assentarMuito();
    clicarBotao(/Concluir Avaliação/);
    await assentarMuito();
    const inicio = await encerrarPeloHub(srv);
    registrar('p', 'Agenda com 1 procedimento; no módulo Avaliação, upload de 2 fotos, anota a 1ª (editor devolve JPEG fixo) e remove a 2ª; Concluir Avaliação e Finalizar Atendimento.', srv, inicio, {
      fixture: { agendas },
    });
  }, TIMEOUT);
});
