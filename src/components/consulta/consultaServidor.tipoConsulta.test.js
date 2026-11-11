/** Linha do tipo Consulta sem catálogo: marca no linhaDoItemServidor, ehLinhaConsultaSemCatalogo e perguntasDaSessao. */
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../services/api', () => ({ agendasApi: {} }));

const { linhaDoItemServidor, ehLinhaConsultaSemCatalogo, perguntasDaSessao, mesclarSessao } = await import('./consultaServidor.js');

const item = (codigo, extras = {}) => ({
  id: 'item-1', ordem: 1, agendaId: 'ag-1', agendaTipoProcedimentoCodigo: codigo,
  catalogoProcedimentoSaudeId: null, procedimentoNome: null, nomeLivre: null, ...extras,
});
const consultaSemCat = () => linhaDoItemServidor(item('CONSULTA', { id: 'item-c' }));
const deCatalogo = () => linhaDoItemServidor(item('PROCEDIMENTO', {
  id: 'item-p', catalogoProcedimentoSaudeId: 'cat-1', procedimentoNome: 'Botox',
}));

describe('tipo Consulta sem catálogo', () => {
  it('1. linhaDoItemServidor leva tipoAgendaCodigo e ehLinhaConsultaSemCatalogo decide', () => {
    const l = consultaSemCat();
    expect(l.tipoAgendaCodigo).toBe('CONSULTA');
    expect(ehLinhaConsultaSemCatalogo(l)).toBe(true);
    expect(ehLinhaConsultaSemCatalogo(linhaDoItemServidor(item(' consulta ')))).toBe(true);
    expect(ehLinhaConsultaSemCatalogo(linhaDoItemServidor(item('CONSULTA', { catalogoProcedimentoSaudeId: 'cat-1' })))).toBe(false);
    expect(ehLinhaConsultaSemCatalogo(linhaDoItemServidor(item('avaliacao')))).toBe(false);
    expect(ehLinhaConsultaSemCatalogo(linhaDoItemServidor(item(null)))).toBe(false);
  });

  it('3. perguntasDaSessao: Consulta sem catálogo some das perguntas, o de catálogo fica', () => {
    const sessao = [consultaSemCat(), deCatalogo()];
    const { nomesUnicos } = perguntasDaSessao({ procedimentosSessao: sessao, nomeProcedimento: 'Consulta' });
    expect(nomesUnicos).toContain('Botox');
    expect(nomesUnicos).not.toContain('Consulta');
  });

  it('3. sessão só com a Consulta: nomesUnicos vazio (não cai no nomeProcedimento)', () => {
    const { nomesUnicos } = perguntasDaSessao({ procedimentosSessao: [consultaSemCat()], nomeProcedimento: 'Consulta' });
    expect(nomesUnicos).toEqual([]);
  });

  it('3. controle: linha manual com nome fora do catálogo continua', () => {
    const manual = { procedimentoNome: 'Peeling', nomeProcedimento: 'Peeling' };
    const { nomesUnicos } = perguntasDaSessao({ procedimentosSessao: [consultaSemCat(), manual], nomeProcedimento: '' });
    expect(nomesUnicos).toEqual(['Peeling']);
  });

  it('4. mesclarSessao: linha do lote da agenda (sem tipoAgendaCodigo) ganha o código do item CONSULTA', () => {
    const doLote = { agendaId: 'ag-1', procedimentoNome: 'Consulta', nomeProcedimento: 'Consulta', nomeSoDeTela: true };
    expect(doLote.tipoAgendaCodigo).toBeUndefined();
    const { sessao } = mesclarSessao([doLote], [item('CONSULTA')], () => false);
    expect(sessao).toHaveLength(1);
    expect(sessao[0].itemId).toBe('item-1');
    expect(sessao[0].tipoAgendaCodigo).toBe('CONSULTA');
    expect(ehLinhaConsultaSemCatalogo(sessao[0])).toBe(true);
  });
});
