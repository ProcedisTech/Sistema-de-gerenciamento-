import {
  aplicarMudancaResposta,
  ehTipoPaiCondicional,
  isPaiSim,
  perguntaFilhaVisivel,
} from './anamneseCondicional.js';

describe('ehTipoPaiCondicional', () => {
  it('aceita sim_nao_naosei e booleano', () => {
    expect(ehTipoPaiCondicional('sim_nao_naosei')).toBe(true);
    expect(ehTipoPaiCondicional('booleano')).toBe(true);
    expect(ehTipoPaiCondicional('texto')).toBe(false);
  });
});

describe('isPaiSim', () => {
  it('trivalente SIM ganha de boolean', () => {
    expect(isPaiSim({ respostaTrivalente: 'SIM', respostaBoolean: false })).toBe(true);
    expect(isPaiSim({ respostaTrivalente: 'NAO', respostaBoolean: true })).toBe(false);
  });

  it('boolean só vale se não houver trivalente', () => {
    expect(isPaiSim({ respostaBoolean: true })).toBe(true);
    expect(isPaiSim({ respostaBoolean: false })).toBe(false);
    expect(isPaiSim({ respostaBoolean: null })).toBe(false);
    expect(isPaiSim({})).toBe(false);
  });
});

describe('aplicarMudancaResposta', () => {
  const paiTri = { id: 'pai-1', tipoResposta: 'sim_nao_naosei' };
  const paiBool = { id: 'pai-2', tipoResposta: 'booleano' };
  const filha = { id: 'filha-1', perguntaPaiId: 'pai-1', tipoResposta: 'catalogo_principio_ativo' };
  const filhaBool = { id: 'filha-2', perguntaPaiId: 'pai-2', tipoResposta: 'texto' };

  it('apaga a filha quando o pai trivalente deixa de ser SIM', () => {
    const respostas = {
      'pai-1': { perguntaId: 'pai-1', respostaTrivalente: 'SIM' },
      'filha-1': { perguntaId: 'filha-1', catalogoItens: [{ id: 'x' }] },
    };
    const next = aplicarMudancaResposta(respostas, [paiTri, filha], {
      perguntaId: 'pai-1',
      respostaTrivalente: 'NAO',
    });
    expect(next['filha-1']).toBeUndefined();
    expect(next['pai-1'].respostaTrivalente).toBe('NAO');
  });

  it('apaga a filha quando o pai booleano deixa de ser true', () => {
    const respostas = {
      'pai-2': { perguntaId: 'pai-2', respostaBoolean: true },
      'filha-2': { perguntaId: 'filha-2', respostaTexto: 'detalhe' },
    };
    const next = aplicarMudancaResposta(respostas, [paiBool, filhaBool], {
      perguntaId: 'pai-2',
      respostaBoolean: false,
    });
    expect(next['filha-2']).toBeUndefined();
  });

  it('apaga a filha quando o pai booleano volta para null', () => {
    const respostas = {
      'pai-2': { perguntaId: 'pai-2', respostaBoolean: true },
      'filha-2': { perguntaId: 'filha-2', respostaTexto: 'detalhe' },
    };
    const next = aplicarMudancaResposta(respostas, [paiBool, filhaBool], {
      perguntaId: 'pai-2',
      respostaBoolean: null,
    });
    expect(next['filha-2']).toBeUndefined();
  });

  it('mantém a filha visível só se o pai for SIM', () => {
    expect(perguntaFilhaVisivel(filha, { 'pai-1': { respostaTrivalente: 'SIM' } })).toBe(true);
    expect(perguntaFilhaVisivel(filha, { 'pai-1': { respostaTrivalente: 'NAO_SEI' } })).toBe(false);
    expect(perguntaFilhaVisivel(filha, {})).toBe(false);
    expect(perguntaFilhaVisivel(filhaBool, { 'pai-2': { respostaBoolean: true } })).toBe(true);
    expect(perguntaFilhaVisivel(filhaBool, { 'pai-2': { respostaBoolean: false } })).toBe(false);
  });
});
