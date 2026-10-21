import { describe, expect, it } from 'vitest';
import { inicioAoEntrarNaConsulta, textoDoApenasSair } from './consultaServidor.js';

const AGORA = '2026-10-06T13:00:00.000Z';
const DO_SERVIDOR = '2026-10-06T12:30:00Z';

describe('inicioAoEntrarNaConsulta (horário de início sem CPF)', () => {
  it('retorno no mesmo dia, dentro da consulta: o início é o iniciadoEm do servidor, não agora', () => {
    expect(inicioAoEntrarNaConsulta({
      retomadaNoMesmoDia: true,
      retorno: true,
      consultaDoServidor: { iniciadoEm: DO_SERVIDOR },
      agoraIso: AGORA,
    })).toBe(DO_SERVIDOR);
  });

  it('entrada nova (consulta ou retorno): o iniciadoEm do servidor', () => {
    for (const retorno of [false, true]) {
      expect(inicioAoEntrarNaConsulta({
        retomadaNoMesmoDia: false,
        retorno,
        consultaDoServidor: { iniciadoEm: DO_SERVIDOR },
        agoraIso: AGORA,
      })).toBe(DO_SERVIDOR);
    }
  });

  it('retomar a mesma consulta no dia sem ser retorno mantém o horário da memória', () => {
    expect(inicioAoEntrarNaConsulta({
      retomadaNoMesmoDia: true,
      retorno: false,
      consultaDoServidor: { iniciadoEm: DO_SERVIDOR },
      agoraIso: AGORA,
    })).toBeUndefined();
  });

  it('sem consulta do servidor (ou sem iniciadoEm), vale agora', () => {
    expect(inicioAoEntrarNaConsulta({ retomadaNoMesmoDia: true, retorno: true, consultaDoServidor: null, agoraIso: AGORA }))
      .toBe(AGORA);
    expect(inicioAoEntrarNaConsulta({ retomadaNoMesmoDia: false, retorno: false, consultaDoServidor: {}, agoraIso: AGORA }))
      .toBe(AGORA);
  });
});

describe('textoDoApenasSair (o toast só promete o que acontece)', () => {
  const SALVO = 'Rascunho salvo com sucesso.';
  const GUARDADO = 'Rascunho guardado neste aparelho. Será enviado quando a conexão voltar.';
  const ITEM_NOVO = 'Procedimento novo guardado neste aparelho. Será enviado quando você abrir esta consulta de novo.';
  const UMA_FOTO = 'Não foi possível enviar 1 foto. Ela não fica guardada: envie de novo.';
  const DUAS_FOTOS = 'Não foi possível enviar 2 fotos. Elas não ficam guardadas: envie de novo.';

  it('sem pendência: salvo com sucesso', () => {
    expect(textoDoApenasSair({ filaEsvaziou: true, tiposPendentes: [], fotosNaoEnviadas: 0 })).toBe(SALVO);
    expect(textoDoApenasSair({ filaEsvaziou: true })).toBe(SALVO);
  });

  it('sobrou só texto (modulo/item): guardado, sai quando a conexão voltar', () => {
    expect(textoDoApenasSair({ filaEsvaziou: false, tiposPendentes: ['item'] })).toBe(GUARDADO);
    expect(textoDoApenasSair({ filaEsvaziou: false, tiposPendentes: ['modulo', 'item'] })).toBe(GUARDADO);
    // A fila não esvaziou e não disse o quê: vale a frase do texto.
    expect(textoDoApenasSair({ filaEsvaziou: false, tiposPendentes: [] })).toBe(GUARDADO);
  });

  it('sobrou procedimento novo: só sai quando a pessoa abrir a consulta de novo (nunca "quando a conexão voltar")', () => {
    const t = textoDoApenasSair({ filaEsvaziou: false, tiposPendentes: ['itemNovo'] });
    expect(t).toBe(ITEM_NOVO);
    expect(t).not.toContain('conexão voltar');
  });

  it('texto e procedimento novo: as duas frases, texto primeiro', () => {
    expect(textoDoApenasSair({ filaEsvaziou: false, tiposPendentes: ['itemNovo', 'item'] })).toBe(`${GUARDADO} ${ITEM_NOVO}`);
  });

  it('foto que não subiu: diz quantas e que não ficam guardadas (singular e plural), sem prometer reenvio', () => {
    expect(textoDoApenasSair({ filaEsvaziou: true, fotosNaoEnviadas: 1 })).toBe(`${SALVO} ${UMA_FOTO}`);
    expect(textoDoApenasSair({ filaEsvaziou: true, fotosNaoEnviadas: 2 })).toBe(`${SALVO} ${DUAS_FOTOS}`);
    expect(textoDoApenasSair({ filaEsvaziou: false, tiposPendentes: ['item'], fotosNaoEnviadas: 2 }))
      .toBe(`${GUARDADO} ${DUAS_FOTOS}`);
    expect(textoDoApenasSair({ filaEsvaziou: false, tiposPendentes: ['item', 'itemNovo'], fotosNaoEnviadas: 1 }))
      .toBe(`${GUARDADO} ${ITEM_NOVO} ${UMA_FOTO}`);
    expect(textoDoApenasSair({ filaEsvaziou: true, fotosNaoEnviadas: 3 })).not.toMatch(/Não feche esta aba/);
  });
});
