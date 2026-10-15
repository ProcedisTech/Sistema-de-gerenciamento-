/**
 * B-42 F3: o rótulo que a tela inventa para a agenda sem catálogo ("Consulta", "Avaliação", "Retorno") é só de tela.
 * A linha leva a marca `nomeSoDeTela`, o espelho não vê diferença (0 PATCH) e o F5 remonta o mesmo rótulo.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../services/api', () => ({ agendasApi: {} }));

const { mapAgendaDtoToDashboardRow } = await import('../../utils/agendaDashboardMapping.js');
const {
  baseDosItens,
  camposDaLinhaSessao,
  diferencasDosItens,
  linhaDoItemServidor,
  mapearItensDaSessao,
  marcarNomesDeTela,
  mesclarSessao,
  opcoesParaEntrar,
  rotuloDaModalidade,
} = await import('./consultaServidor.js');

const MODALIDADES = [
  ['CONSULTA', 'Consulta'],
  ['avaliacao', 'Avaliação'],
  ['retorno', 'Retorno'],
];

/** Item que o abrir cria para a agenda sem catálogo (AtendimentoService.novoItemDaAgenda): sem nome. */
const itemDaAgenda = (codigo, extras = {}) => ({
  id: 'item-1',
  ordem: 1,
  agendaId: 'ag-1',
  agendaTipoProcedimentoCodigo: codigo,
  agendaProcedimentoFeitoOrigemId: null,
  catalogoProcedimentoSaudeId: null,
  procedimentoNome: null,
  planejamentoItemId: null,
  nomeLivre: null,
  observacaoExecucao: null,
  ...extras,
});

/** Linha do lote como a Agenda monta (AgendaDashboard.jsx, loteAgendasDoPaciente): campos copiados um a um. */
const linhaDoLote = (rotulo, extras = {}) => ({
  agendaId: 'ag-1',
  procedimentoNome: rotulo,
  catalogoProcedimentoSaudeId: '',
  planejamentoItemId: null,
  ...extras,
});

describe('nome só de tela (B-42 F3)', () => {
  it.each(MODALIDADES)('o rótulo de %s é o mesmo que a Agenda mostra para a agenda sem catálogo', (codigo, rotulo) => {
    const linha = mapAgendaDtoToDashboardRow({
      id: 'ag-1',
      dataAgendamento: '2026-10-09',
      horaInicio: '10:00:00',
      horaFim: '10:30:00',
      tipoProcedimentoCodigo: codigo,
      catalogoProcedimentoSaudeId: null,
      catalogoProcedimentoNome: null,
    });
    expect(linha.procedimentoNome).toBe(rotulo);
    expect(rotuloDaModalidade(codigo)).toBe(rotulo);
  });

  it.each(MODALIDADES)('%s sem catálogo: a linha marcada não tem diferença com o item do servidor (0 PATCH)', (codigo, rotulo) => {
    const sessao = marcarNomesDeTela([{ ...linhaDoLote(rotulo), nomeProcedimento: rotulo }]);
    expect(sessao[0].nomeSoDeTela).toBe(true);
    expect(sessao[0].nomeProcedimento).toBe(rotulo);
    expect(camposDaLinhaSessao(sessao[0]).nome).toBe('');

    const itens = [itemDaAgenda(codigo)];
    const dif = diferencasDosItens(sessao, mapearItensDaSessao(sessao, itens), baseDosItens(itens));
    expect(dif).toEqual({ alterar: [], criar: [] });
  });

  it('sem a marca, a mesma linha mandaria o rótulo como nome livre (o defeito de 09/10)', () => {
    const sessao = [{ ...linhaDoLote('Consulta'), nomeProcedimento: 'Consulta' }];
    const itens = [itemDaAgenda('CONSULTA')];
    const dif = diferencasDosItens(sessao, mapearItensDaSessao(sessao, itens), baseDosItens(itens));
    expect(dif.alterar).toEqual([
      { itemId: 'item-1', campo: 'proc', campos: { catalogoProcedimentoSaudeId: null, nomeLivre: 'Consulta' } },
    ]);
  });

  it('marcar: só agenda sem catálogo com o rótulo da modalidade; marca decidida e linha sem mudança ficam iguais', () => {
    const comCatalogo = linhaDoLote('Toxina botulínica', { catalogoProcedimentoSaudeId: 'cat-1' });
    const semAgenda = { procedimentoNome: 'Consulta', nomeProcedimento: 'Consulta' };
    const jaDecidida = { ...linhaDoLote('Consulta'), nomeSoDeTela: false };
    const outroNome = linhaDoLote('Retorno:');
    const linhas = [comCatalogo, semAgenda, jaDecidida, outroNome];

    expect(marcarNomesDeTela(linhas)).toBe(linhas);
    expect(marcarNomesDeTela(undefined)).toBeUndefined();
  });

  it('"Retorno: <nome>" da agenda de retorno sem catálogo também é só de tela (0 PATCH)', () => {
    const rotulo = 'Retorno: Toxina botulínica';
    expect(mapAgendaDtoToDashboardRow({
      id: 'ag-1',
      dataAgendamento: '2026-10-09',
      horaInicio: '10:00:00',
      horaFim: '10:30:00',
      tipoProcedimentoCodigo: 'retorno',
      catalogoProcedimentoSaudeId: null,
      catalogoProcedimentoNome: 'Toxina botulínica',
    }).procedimentoNome).toBe(rotulo);

    const sessao = marcarNomesDeTela([{ ...linhaDoLote(rotulo), nomeProcedimento: rotulo }]);
    expect(sessao[0].nomeSoDeTela).toBe(true);
    const itens = [itemDaAgenda('retorno', { agendaCatalogoProcedimentoNome: 'Toxina botulínica' })];
    const dif = diferencasDosItens(sessao, mapearItensDaSessao(sessao, itens), baseDosItens(itens));
    expect(dif).toEqual({ alterar: [], criar: [] });
  });

  it('F5 de "Retorno: <nome>": o campo do servidor remonta o mesmo rótulo, marcado', () => {
    const item = itemDaAgenda('retorno', {
      agendaProcedimentoFeitoOrigemId: 'pf-origem',
      agendaCatalogoProcedimentoNome: '  Toxina botulínica ',
    });
    const linha = linhaDoItemServidor(item);
    expect(linha.procedimentoNome).toBe('Retorno: Toxina botulínica');
    expect(linha.nomeProcedimento).toBe('Retorno: Toxina botulínica');
    expect(linha.nomeSoDeTela).toBe(true);

    const opcoes = opcoesParaEntrar({ id: 'c-1', agendaPrincipalId: 'ag-1', tipoProcedimentoCodigo: 'retorno', itens: [item] });
    expect(opcoes.procedimentoNome).toBe('Retorno: Toxina botulínica');
    expect(opcoes.lote[0].nomeSoDeTela).toBe(true);

    // item com nome livre gravado (dado antigo): o nome do servidor vale, sem marca
    const antigo = linhaDoItemServidor({ ...item, nomeLivre: 'Retorno: Toxina botulínica' });
    expect(antigo.nomeSoDeTela).toBe(false);
  });

  it('a pessoa muda o nome (marca false): o nome vai para o servidor', () => {
    const sessao = [{ ...linhaDoLote('Consulta'), nomeProcedimento: 'Consulta de rotina', nomeSoDeTela: false }];
    const itens = [itemDaAgenda('CONSULTA')];
    const dif = diferencasDosItens(sessao, mapearItensDaSessao(sessao, itens), baseDosItens(itens));
    expect(dif.alterar).toEqual([
      { itemId: 'item-1', campo: 'proc', campos: { catalogoProcedimentoSaudeId: null, nomeLivre: 'Consulta de rotina' } },
    ]);
  });

  it.each(MODALIDADES)('F5 (%s): o item sem nome volta com o mesmo rótulo e marcado; opções de entrada idem', (codigo, rotulo) => {
    const linha = linhaDoItemServidor(itemDaAgenda(codigo));
    expect(linha.procedimentoNome).toBe(rotulo);
    expect(linha.nomeProcedimento).toBe(rotulo);
    expect(linha.nomeSoDeTela).toBe(true);

    const opcoes = opcoesParaEntrar({ id: 'c-1', agendaPrincipalId: 'ag-1', itens: [itemDaAgenda(codigo)] });
    expect(opcoes.procedimentoNome).toBe(rotulo);
    expect(opcoes.lote[0].procedimentoNome).toBe(rotulo);
    expect(opcoes.lote[0].nomeSoDeTela).toBe(true);
  });

  it('F5: item com nome ou catálogo no servidor volta como está, sem marca', () => {
    const comNome = linhaDoItemServidor(itemDaAgenda('CONSULTA', { nomeLivre: 'Consulta' }));
    expect(comNome.nomeProcedimento).toBe('Consulta');
    expect(comNome.nomeSoDeTela).toBe(false);
    expect(camposDaLinhaSessao(comNome).nome).toBe('Consulta');

    const comCatalogo = linhaDoItemServidor(itemDaAgenda('CONSULTA', {
      catalogoProcedimentoSaudeId: 'cat-1',
      procedimentoNome: 'Toxina botulínica',
    }));
    expect(comCatalogo.nomeProcedimento).toBe('Toxina botulínica');
    expect(comCatalogo.nomeSoDeTela).toBe(false);

    const semAgenda = linhaDoItemServidor(itemDaAgenda(null, { agendaId: null }));
    expect(semAgenda.nomeProcedimento).toBe('');
    expect(semAgenda.nomeSoDeTela).toBe(false);
  });

  it('hidratação: servidor vazio mantém a linha marcada; nome do servidor entra e tira a marca', () => {
    const sessao = marcarNomesDeTela([{ ...linhaDoLote('Consulta'), nomeProcedimento: 'Consulta' }]);
    const semNada = mesclarSessao(sessao, [itemDaAgenda('CONSULTA')], () => false);
    // F5b: a linha ganha o `itemId` do item ligado a ela (só isso muda); o rótulo de tela e a marca ficam.
    expect(semNada.mudou).toBe(true);
    expect(semNada.sessao[0].itemId).toBe(itemDaAgenda('CONSULTA').id);
    expect(semNada.sessao[0].nomeProcedimento).toBe('Consulta');
    expect(semNada.sessao[0].nomeSoDeTela).toBe(true);
    expect(mesclarSessao(semNada.sessao, [itemDaAgenda('CONSULTA')], () => false).mudou).toBe(false);

    const comNome = mesclarSessao(sessao, [itemDaAgenda('CONSULTA', { nomeLivre: 'Consulta de rotina' })], () => false);
    expect(comNome.mudou).toBe(true);
    expect(comNome.sessao[0].nomeProcedimento).toBe('Consulta de rotina');
    expect(comNome.sessao[0].nomeSoDeTela).toBe(false);
    expect(camposDaLinhaSessao(comNome.sessao[0]).nome).toBe('Consulta de rotina');
  });
});
