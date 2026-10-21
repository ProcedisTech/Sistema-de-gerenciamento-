import { describe, expect, it } from 'vitest';
import { STATUS_FECHADOS, consultaFechada, textoDaConsultaAbandonada, textoDasFotosNaoEnviadas } from './consultaServidor.js';

describe('textoDasFotosNaoEnviadas (com e sem origem)', () => {
  it('sem origem: o texto de sempre (Apenas Sair não muda)', () => {
    expect(textoDasFotosNaoEnviadas(1)).toBe('Não foi possível enviar 1 foto. Ela não fica guardada: envie de novo.');
    expect(textoDasFotosNaoEnviadas(2)).toBe('Não foi possível enviar 2 fotos. Elas não ficam guardadas: envie de novo.');
  });

  it('avaliação: "de avaliação", singular e plural', () => {
    expect(textoDasFotosNaoEnviadas(1, 'avaliacao'))
      .toBe('Não foi possível enviar 1 foto de avaliação. Ela não fica guardada: envie de novo.');
    expect(textoDasFotosNaoEnviadas(2, 'avaliacao'))
      .toBe('Não foi possível enviar 2 fotos de avaliação. Elas não ficam guardadas: envie de novo.');
  });

  it('procedimento: "do procedimento", singular e plural', () => {
    expect(textoDasFotosNaoEnviadas(1, 'procedimento'))
      .toBe('Não foi possível enviar 1 foto do procedimento. Ela não fica guardada: envie de novo.');
    expect(textoDasFotosNaoEnviadas(2, 'procedimento'))
      .toBe('Não foi possível enviar 2 fotos do procedimento. Elas não ficam guardadas: envie de novo.');
  });

  it('resultado (seção "Foto do resultado" do Retorno): "do resultado", singular e plural', () => {
    expect(textoDasFotosNaoEnviadas(1, 'resultado'))
      .toBe('Não foi possível enviar 1 foto do resultado. Ela não fica guardada: envie de novo.');
    expect(textoDasFotosNaoEnviadas(2, 'resultado'))
      .toBe('Não foi possível enviar 2 fotos do resultado. Elas não ficam guardadas: envie de novo.');
  });

  it('origem desconhecida: cai no texto sem origem', () => {
    expect(textoDasFotosNaoEnviadas(1, 'toString')).toBe(textoDasFotosNaoEnviadas(1));
  });
});

describe('textoDaConsultaAbandonada', () => {
  const BASE = 'Esta consulta foi encerrada por falta de atividade.';

  it('n=0: só a frase base', () => {
    expect(textoDaConsultaAbandonada(0)).toBe(BASE);
  });

  it('n=1: singular ("chegou")', () => {
    expect(textoDaConsultaAbandonada(1))
      .toBe(`${BASE} 1 alteração feita neste aparelho não chegou ao servidor.`);
  });

  it('n≥2: plural ("chegaram")', () => {
    expect(textoDaConsultaAbandonada(2))
      .toBe(`${BASE} 2 alterações feitas neste aparelho não chegaram ao servidor.`);
    expect(textoDaConsultaAbandonada(5))
      .toBe(`${BASE} 5 alterações feitas neste aparelho não chegaram ao servidor.`);
  });
});

describe('STATUS_FECHADOS exportado', () => {
  it('são os três status em que a consulta não está aberta', () => {
    expect([...STATUS_FECHADOS].sort()).toEqual(['abandonado', 'cancelado', 'encerrado']);
    expect(consultaFechada({ status: 'aberto' })).toBe(false);
  });
});
