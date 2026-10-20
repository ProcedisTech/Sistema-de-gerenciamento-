/**
 * Y11 (Etapa 3, F2): depois do F5, cada foto do procedimento volta para o SEU item (aba) e para a MESMA faixa do
 * Step 4 em que estava antes. As fotos sobem pelo envio de hoje (P2: tipo + prefixo da legenda), a tela é desmontada
 * e montada de novo com a consulta e a galeria do servidor, e a faixa de cada foto é conferida na tela.
 */
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { limparAmbienteSnapshot } from '../snapshotConsulta.jsx';
import { IDS } from '../encerrar/cenariosEncerrar.js';
import { arquivoPng, limparMidia, prepararMidia } from '../encerrar/ambienteMidia.js';
import { legendaDaFoto, tipoDaFotoDoProcedimento } from '../../components/hooks/useEnvioFotosConsulta.js';
import { legendaDaFotoDaVista } from '../../components/hooks/useMapaRascunhoAutosave.js';
import { ATENDIMENTO_ID, TIMEOUT, assentarMuito, clicarBotao, consultaDto, montarApp, resumoDto } from './appConsulta.jsx';

vi.mock('../../lib/supabaseClient.js', async () => (await import('../encerrar/servidorEncerrarFalso.js')).supabaseFalso());
vi.mock('../../contexts/AvisosProvider.jsx', async () => (await import('./canalAvisosTeste.jsx')).avisosProviderFalso());

const GALERIA = /^\/api\/v1\/pacientes\/[^/]+\/galeria$/;
const FAIXA = {
  antes: 'Antes',
  depois: 'Depois',
  mapa: 'Mapa de Aplicação (Legado)',
  outras: 'Outras Fotos (Durante / Produtos)',
};

/** AtendimentoItemDTO só com nome (sem catálogo, sem termo). */
function itemDto(id, ordem, nomeLivre) {
  return {
    id,
    ordem,
    agendaId: null,
    agendaTipoProcedimentoCodigo: null,
    agendaProcedimentoFeitoOrigemId: null,
    catalogoProcedimentoSaudeId: null,
    procedimentoNome: null,
    planejamentoItemId: null,
    nomeLivre,
    observacaoExecucao: null,
  };
}
const ITENS = [itemDto('i-a', 0, 'Peeling químico'), itemDto('i-b', 1, 'Limpeza de pele')];

/** Consulta aberta no módulo Procedimento (a barra do topo volta nela pelo `minhas`) e a galeria com URL e legenda. */
function rotasDe(estado) {
  return [
    ['GET', /^\/api\/v1\/atendimentos\/minhas$/, () => [resumoDto(estado.dto)]],
    ['GET', new RegExp(`^/api/v1/atendimentos/${ATENDIMENTO_ID}$`), () => estado.dto],
    ['GET', GALERIA, () => ({ fotos: estado.galeria })],
  ];
}

/** O título (h4) da faixa e as fotos dela, pelo nome do arquivo. */
function fotosDaFaixa(titulo) {
  const h = screen.queryAllByRole('heading', { level: 4, name: titulo });
  if (h.length === 0) return null;
  expect(h).toHaveLength(1);
  return Array.from(h[0].parentElement.querySelectorAll('img')).map((img) => {
    const src = img.getAttribute('src');
    // F5-front: foto do servidor passa pelo fetch autenticado (blob:); o nome vem do conteúdo servido pelo stub.
    return nomesDosBlobs.has(src) ? nomesDosBlobs.get(src) : src.split('/').pop();
  });
}

/** blob: criado pelo card -> nome do arquivo (o stub de fetch serve o nome como conteúdo; ver `servirFotosPeloNome`). */
const nomesDosBlobs = new Map();

/** Depois do F5 o card busca a foto do servidor pelo fetch autenticado; o stub devolve o nome como conteúdo. */
function servirFotosPeloNome() {
  nomesDosBlobs.clear();
  let k = 0;
  URL.createObjectURL = (blob) => {
    k += 1;
    const url = `blob:f5-${k}`;
    void blob.text().then((nome) => nomesDosBlobs.set(url, nome));
    return url;
  };
}

function faixasNaTela() {
  return {
    antes: fotosDaFaixa(FAIXA.antes),
    depois: fotosDaFaixa(FAIXA.depois),
    mapa: fotosDaFaixa(FAIXA.mapa),
    outras: fotosDaFaixa(FAIXA.outras),
  };
}

/** Pela faixa, como a pessoa faz: foca o "Adicionar foto" da faixa e escolhe o arquivo. */
async function adicionarFoto(titulo, nome) {
  const h = screen.getByRole('heading', { level: 4, name: titulo });
  fireEvent.focus(h.parentElement.querySelector('button'));
  const entrada = screen.getByRole('heading', { level: 4, name: 'Fotos e Mapa' }).parentElement.nextElementSibling;
  expect(entrada.getAttribute('type')).toBe('file');
  fireEvent.change(entrada, { target: { files: [arquivoPng(nome)] } });
  await assentarMuito();
}



describe('F5: cada foto volta para o seu item e para a sua faixa (Y11)', () => {
  const createObjectUrlOriginal = URL.createObjectURL;

  afterEach(() => {
    URL.createObjectURL = createObjectUrlOriginal;
    limparMidia();
    limparAmbienteSnapshot();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('fotos de 2 itens em faixas diferentes: depois do F5 cada uma está no seu item e na sua faixa, e a troca de aba mostra as do outro item', async () => {
    const estado = { dto: consultaDto({ modulo: 'procedimento', itens: ITENS }), galeria: [] };

    // 1) Antes do F5: as fotos são tiradas no aparelho, em cada aba, e sobem pelo envio de hoje.
    const srv = await montarApp({ view: 'consulta', rotas: rotasDe(estado) });
    prepararMidia();
    let n = 0;
    URL.createObjectURL = () => {
      n += 1;
      return `blob:foto-${n}`;
    };
    const enviadas = [];
    vi.stubGlobal('fetch', async (url, init = {}) => {
      const metodo = String(init.method || 'GET').toUpperCase();
      const caminho = new URL(String(url), 'http://localhost').pathname;
      const resposta = await srv.fetchFalso(url, init);
      if (metodo === 'POST' && GALERIA.test(caminho)) {
        const fd = init.body;
        const { id } = await resposta.clone().json();
        enviadas.push({
          id,
          nome: fd.get('file').name,
          atendimentoItemId: fd.get('atendimentoItemId'),
          tipoFotoCodigo: fd.get('tipoFotoCodigo'),
          legenda: fd.get('legenda'),
        });
      }
      return resposta;
    });
    clicarBotao('Voltar à consulta de Maria Souza');
    await assentarMuito();

    await adicionarFoto(FAIXA.antes, 'a-antes.png');
    await adicionarFoto(FAIXA.depois, 'a-depois.png');
    expect(faixasNaTela()).toEqual({ antes: ['blob:foto-1'], depois: ['blob:foto-2'], mapa: null, outras: null });

    const porNome = Object.fromEntries(enviadas.map((e) => [e.nome, e]));
    expect(porNome['a-antes.png']).toMatchObject({ tipoFotoCodigo: 'ANTES', legenda: '[antes]' });
    expect(porNome['a-depois.png']).toMatchObject({ tipoFotoCodigo: 'POS_IMEDIATO', legenda: '[depois]' });

    // 2) F5: a tela some e volta com o que o servidor tem. Além das fotos, o servidor tem fotos de outro aparelho
    // (pós-imediato, outros e mapa), com o tipo e a legenda que o envio de hoje dá a essas categorias, e tem a
    // foto da vista do rascunho do mapa (`[mapa] <vista>`), que antes do F5 não está em faixa nenhuma.
    cleanup();
    const deOutroAparelho = ['pos_imediato', 'outro', 'mapa'].map((categoria, i) => ({
      id: `f-outro-aparelho-${i + 1}`,
      nome: `b-${categoria}.png`,
      atendimentoItemId: 'i-b',
      tipoFotoCodigo: tipoDaFotoDoProcedimento({ categoria }),
      legenda: legendaDaFoto('procedimento', { categoria }),
    }));
    const daVista = {
      id: 'f-vista-a',
      nome: 'a-vista-frontal.png',
      atendimentoItemId: 'i-a',
      tipoFotoCodigo: 'MAPA',
      legenda: legendaDaFotoDaVista('frontal'),
    };
    const noServidor = [...enviadas, ...deOutroAparelho, daVista];
    estado.dto = consultaDto({
      modulo: 'procedimento',
      itens: ITENS,
      fotos: noServidor.map((f) => ({ id: f.id, atendimentoItemId: f.atendimentoItemId, tipoFotoCodigo: f.tipoFotoCodigo })),
    });
    estado.galeria = noServidor.map((f) => ({
      id: f.id,
      url: `https://fotos.teste/${f.nome}`,
      legenda: f.legenda,
      tipoFotoCodigo: f.tipoFotoCodigo,
      pacienteId: IDS.PACIENTE,
    }));
    servirFotosPeloNome();
    const srvF5 = await montarApp({ view: 'consulta', rotas: rotasDe(estado) });
    // (o montarApp instala o fetch do servidor falso; a foto do servidor sai por cima dele, com o nome como conteúdo)
    const fetchDoServidor = globalThis.fetch;
    vi.stubGlobal('fetch', async (url, init) => {
      const u = String(url);
      // A foto do servidor vem pelo /arquivo da galeria (url de reserva) ou pela url da galeria; o conteúdo é o nome.
      const doArquivo = /\/galeria\/([^/?]+)\/arquivo/.exec(u);
      const nome = doArquivo
        ? estado.galeria.find((f) => f.id === doArquivo[1])?.url?.split('/').pop()
        : u.startsWith('https://fotos.teste/') ? decodeURIComponent(u.split('/').pop()) : null;
      if (nome) return new Response(nome, { status: 200, headers: { 'Content-Type': 'image/png' } });
      return fetchDoServidor(url, init);
    });
    await assentarMuito(6);
    clicarBotao('Voltar à consulta de Maria Souza');
    await assentarMuito(6);

    expect(srvF5.leituras.some((l) => GALERIA.test(l.path))).toBe(true);
    expect(faixasNaTela()).toEqual({
      antes: ['a-antes.png'],
      depois: ['a-depois.png'],
      mapa: null,
      outras: null,
    });
    // A foto da vista do mapa continua fora das faixas, como antes do F5.
    expect(document.querySelector('img[src$="a-vista-frontal.png"]')).toBeNull();

    expect(srvF5.escritasConsulta.filter((e) => e.method === 'POST' && GALERIA.test(e.path))).toEqual([]);
  }, TIMEOUT);
});
