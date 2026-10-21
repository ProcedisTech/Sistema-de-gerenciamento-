/**
 * F7 (lacuna da Decisão 3): a aba sem internet, com envios pendentes, enquanto outra aba encerra. Quando volta, o
 * primeiro sinal é o aviso/releitura com status 'encerrado' (não o 409 do envio). As entradas pendentes de
 * item/avaliação/termos/assinatura vão para `alteracoesNaoEntraram` em vez de ficarem órfãs no storage.
 */
import { useState } from 'react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarAvisosFalsos } from '../../test/avisosFalsos.jsx';
import { useAtendimentoServidor } from './useAtendimentoServidor.js';

vi.mock('../../services/api', () => ({
  atendimentosApi: {
    abrir: vi.fn(),
    minhas: vi.fn(),
    detalhe: vi.fn(),
    trocarModulo: vi.fn(),
    novoItem: vi.fn(),
    alterarItem: vi.fn(),
    alterarAvaliacaoTexto: vi.fn(),
    salvarTermos: vi.fn(),
    substituirPeloPlano: vi.fn(),
    encerrar: vi.fn(),
    pendencia: vi.fn(),
  },
  termoAssinaturaApi: { criar: vi.fn() },
}));

const { atendimentosApi } = await import('../../services/api');

const PACIENTE = 'p-maria';
const USUARIO = 'u-1';
const FILA = `procedi_consulta_fila_${USUARIO}_c-1`;
const NAO_ENTRARAM = `procedi_consulta_naoentraram_${USUARIO}_c-1`;
const VAZIOS = { queixa: '', expectativas: '', observacoesAvaliacao: '' };
const erroRede = () => new Error('Failed to fetch');
const dto = (extras) => ({
  id: 'c-1',
  pacienteId: PACIENTE,
  status: 'aberto',
  modulo: 'hub',
  itens: [{ id: 'item-1', nomeLivre: 'Botox' }],
  queixa: null,
  expectativas: null,
  observacoesAvaliacao: null,
  ...extras,
});
const ENVIO_OBS = {
  chave: 'item:item-1:obs',
  grupo: 'item:item-1',
  tipo: 'item',
  dados: { itemId: 'item-1', campos: { observacaoExecucao: 'obs sem internet' } },
};
const ENVIO_MODULO = { chave: 'modulo', grupo: 'modulo', tipo: 'modulo', dados: { modulo: 'anamnese' } };

async function assentar() {
  await act(async () => {
    for (let i = 0; i < 5; i += 1) await new Promise((r) => setTimeout(r, 0));
  });
}
async function esperar(ms) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}

function useTela(props) {
  const [valores, setValores] = useState(VAZIOS);
  const servidor = useAtendimentoServidor({ ...props, avaliacao: { valores, aplicar: setValores } });
  return { servidor, valores, setValores };
}

async function montar({ entradasGuardadas = [ENVIO_OBS] } = {}) {
  if (entradasGuardadas.length > 0) sessionStorage.setItem(FILA, JSON.stringify(entradasGuardadas));
  vi.mocked(atendimentosApi.abrir).mockResolvedValue(dto());
  const avisos = criarAvisosFalsos();
  const props = {
    habilitado: true,
    orgId: 'org-1',
    userId: USUARIO,
    emConsulta: true,
    pacienteId: PACIENTE,
    procedimentosSessao: [],
    aparelho: { setProcedimentosSessao: vi.fn() },
  };
  const r = renderHook((p) => useTela(p), { initialProps: props, wrapper: avisos.Wrapper });
  await assentar();
  await act(async () => {
    await r.result.current.servidor.abrir({ pacienteId: PACIENTE });
  });
  await assentar();
  return { ...r, avisos };
}

/** Põe a queixa na fila, offline (a entrada fica pendente). */
async function digitarQueixaOffline(r) {
  act(() => r.result.current.setValores((v) => ({ ...v, queixa: 'dor no pescoço' })));
  let enfileirou;
  act(() => {
    enfileirou = r.result.current.servidor.onCampoAvaliacaoBlur('queixa');
  });
  expect(enfileirou).toBe(true);
  await assentar();
}

async function avisoDeFechada(r) {
  act(() => r.avisos.emitirAviso('ATENDIMENTO.ENCERRADO', 'c-1', { atendimentoId: 'c-1' }));
  await esperar(400);
  await assentar();
}

describe('useAtendimentoServidor: pendentes de consulta encerrada por outro aparelho (F7, Decisão 3)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.mocked(atendimentosApi.minhas).mockResolvedValue([]);
    vi.mocked(atendimentosApi.pendencia).mockResolvedValue(null);
    vi.mocked(atendimentosApi.alterarItem).mockRejectedValue(erroRede());
    vi.mocked(atendimentosApi.alterarAvaliacaoTexto).mockRejectedValue(erroRede());
    vi.mocked(atendimentosApi.trocarModulo).mockRejectedValue(erroRede());
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetAllMocks();
    sessionStorage.clear();
  });

  it('a: 2 entradas pendentes (obs do item e queixa) + aviso com status encerrado -> não entraram, fila limpa', async () => {
    const r = await montar({ entradasGuardadas: [ENVIO_OBS, ENVIO_MODULO] });
    await digitarQueixaOffline(r);
    expect(sessionStorage.getItem(FILA)).not.toBeNull();
    expect(r.result.current.servidor.alteracoesNaoEntraram).toBeNull();

    vi.mocked(atendimentosApi.detalhe).mockResolvedValue(dto({ status: 'encerrado' }));
    await avisoDeFechada(r);

    const ne = r.result.current.servidor.alteracoesNaoEntraram;
    expect(ne.quantidade).toBe(2);
    const porChave = Object.fromEntries(ne.itens.map((i) => [i.chave, i]));
    expect(porChave['item:item-1:obs']).toMatchObject({
      tipo: 'item',
      rotulo: expect.stringMatching(/^Observação do procedimento/),
      texto: 'obs sem internet',
    });
    expect(porChave['avaliacao:queixa']).toMatchObject({ tipo: 'avaliacao', rotulo: 'Queixa', texto: 'dor no pescoço' });
    expect(ne.textoParaCopiar).toContain('obs sem internet');
    // `modulo` não entra; a fila guardada da consulta some; a lista fica guardada em outra chave.
    expect(sessionStorage.getItem(FILA)).toBeNull();
    expect(JSON.parse(sessionStorage.getItem(NAO_ENTRARAM))).toHaveLength(2);
    // A consulta foi esquecida, mas o estado dos não entraram continua exposto.
    expect(r.result.current.servidor.atual).toBeNull();
  });

  it('b: consulta encerrada por esta mesma aba -> quantidade 0 (nada vai para não entraram)', async () => {
    const r = await montar({ entradasGuardadas: [] });
    let liberar;
    vi.mocked(atendimentosApi.encerrar).mockReturnValue(new Promise((res) => { liberar = res; }));
    let promessa;
    await act(async () => {
      promessa = r.result.current.servidor.encerrar({ modo: 'COMPLETO' });
      await new Promise((res) => setTimeout(res, 0));
    });
    // Durante o encerrar desta aba entra uma entrada nova (ainda pendente, sem internet) e chega o aviso.
    await digitarQueixaOffline(r);
    vi.mocked(atendimentosApi.detalhe).mockResolvedValue(dto({ status: 'encerrado' }));
    await avisoDeFechada(r);
    expect(r.result.current.servidor.alteracoesNaoEntraram).toBeNull();
    expect(sessionStorage.getItem(NAO_ENTRARAM)).toBeNull();

    await act(async () => {
      liberar({ id: 'c-1' });
      await promessa;
    });
    expect(r.result.current.servidor.alteracoesNaoEntraram).toBeNull();
  });

  it('c: consulta cancelada -> comportamento antigo, sem não entraram', async () => {
    const r = await montar();
    await digitarQueixaOffline(r);
    vi.mocked(atendimentosApi.detalhe).mockResolvedValue(dto({ status: 'cancelado' }));
    await avisoDeFechada(r);
    expect(r.result.current.servidor.alteracoesNaoEntraram).toBeNull();
    expect(sessionStorage.getItem(NAO_ENTRARAM)).toBeNull();
    // As entradas guardadas continuam como antes (nada foi movido nem apagado aqui).
    expect(sessionStorage.getItem(FILA)).not.toBeNull();
  });

  it('d: descartarAlteracoesNaoEntraram limpa estado e storage', async () => {
    const r = await montar();
    await digitarQueixaOffline(r);
    vi.mocked(atendimentosApi.detalhe).mockResolvedValue(dto({ status: 'encerrado' }));
    await avisoDeFechada(r);
    expect(r.result.current.servidor.alteracoesNaoEntraram.quantidade).toBe(2);
    act(() => r.result.current.servidor.descartarAlteracoesNaoEntraram());
    expect(r.result.current.servidor.alteracoesNaoEntraram).toBeNull();
    expect(sessionStorage.getItem(NAO_ENTRARAM)).toBeNull();
  });

  it('e: sobrevive ao remount do hook (storage)', async () => {
    const r = await montar();
    await digitarQueixaOffline(r);
    vi.mocked(atendimentosApi.detalhe).mockResolvedValue(dto({ status: 'encerrado' }));
    await avisoDeFechada(r);
    expect(r.result.current.servidor.alteracoesNaoEntraram.quantidade).toBe(2);
    r.unmount();

    const avisos = criarAvisosFalsos();
    const r2 = renderHook((p) => useTela(p), {
      initialProps: {
        habilitado: true,
        orgId: 'org-1',
        userId: USUARIO,
        emConsulta: false,
        pacienteId: null,
        procedimentosSessao: [],
        aparelho: { setProcedimentosSessao: vi.fn() },
      },
      wrapper: avisos.Wrapper,
    });
    await assentar();
    expect(r2.result.current.servidor.alteracoesNaoEntraram.quantidade).toBe(2);
    expect(r2.result.current.servidor.alteracoesNaoEntraram.itens.map((i) => i.texto).sort())
      .toEqual(['dor no pescoço', 'obs sem internet']);
  });
});
