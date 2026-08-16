import { aplicarMudancaResposta, perguntaFilhaVisivel } from './anamneseCondicional.js';

describe('aplicarMudancaResposta', () => {
  const pai = { id: 'pai-1', tipoResposta: 'sim_nao_naosei' };
  const filha = { id: 'filha-1', perguntaPaiId: 'pai-1', tipoResposta: 'catalogo_principio_ativo' };

  it('apaga a filha quando o pai deixa de ser SIM', () => {
    const respostas = {
      'pai-1': { perguntaId: 'pai-1', respostaTrivalente: 'SIM' },
      'filha-1': { perguntaId: 'filha-1', catalogoItens: [{ id: 'x' }] },
    };
    const next = aplicarMudancaResposta(respostas, [pai, filha], {
      perguntaId: 'pai-1',
      respostaTrivalente: 'NAO',
    });
    expect(next['filha-1']).toBeUndefined();
    expect(next['pai-1'].respostaTrivalente).toBe('NAO');
  });

  it('mantém a filha visível só se o pai for SIM', () => {
    expect(perguntaFilhaVisivel(filha, { 'pai-1': { respostaTrivalente: 'SIM' } })).toBe(true);
    expect(perguntaFilhaVisivel(filha, { 'pai-1': { respostaTrivalente: 'NAO_SEI' } })).toBe(false);
    expect(perguntaFilhaVisivel(filha, {})).toBe(false);
  });
});
