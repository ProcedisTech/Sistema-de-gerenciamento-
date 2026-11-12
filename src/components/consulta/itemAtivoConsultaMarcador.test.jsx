/**
 * D1 (rodada 2): a linha Consulta sem catálogo (marcador da agenda) nunca é a ativa quando há outra linha.
 * O item do mapa e das fotos é `mapearItensDaSessao(...)[índice]`, como no itemDoProcedimentoAtivo do AppRefactored.
 */
import { describe, expect, it } from 'vitest';
import { indiceAtivoSemMarcador, linhaDoItemServidor, mapearItensDaSessao } from './consultaServidor.js';

const item = (o) => ({
  ordem: 1, agendaId: null, agendaTipoProcedimentoCodigo: null, catalogoProcedimentoSaudeId: null,
  procedimentoNome: null, nomeLivre: null, ...o,
});
const consulta = item({ id: 'item-1', ordem: 1, agendaId: 'ag-1', agendaTipoProcedimentoCodigo: 'CONSULTA' });
const proc = item({ id: 'item-2', ordem: 2, catalogoProcedimentoSaudeId: 'cat-1', procedimentoNome: 'Botox' });

function itemAtivo(itens, indice) {
  const sessao = itens.map(linhaDoItemServidor);
  const ativo = indiceAtivoSemMarcador(sessao, indice);
  return { ativo, itemId: mapearItensDaSessao(sessao, itens)[ativo] ?? null };
}

describe('D1: item ativo com o marcador Consulta', () => {
  it('Consulta + procedimento de catálogo: mapa e fotos vão para o item 2', () => {
    expect(itemAtivo([consulta, proc], 0)).toEqual({ ativo: 1, itemId: 'item-2' });
  });

  it('só a Consulta: o índice ativo fica em 0, no item 1', () => {
    expect(itemAtivo([consulta], 0)).toEqual({ ativo: 0, itemId: 'item-1' });
  });

  it('agenda de procedimento normal (código diferente de CONSULTA): item ativo igual a antes', () => {
    const normal = item({ id: 'item-1', agendaId: 'ag-1', agendaTipoProcedimentoCodigo: 'PROCEDIMENTO' });
    expect(itemAtivo([normal, proc], 0)).toEqual({ ativo: 0, itemId: 'item-1' });
  });
});
