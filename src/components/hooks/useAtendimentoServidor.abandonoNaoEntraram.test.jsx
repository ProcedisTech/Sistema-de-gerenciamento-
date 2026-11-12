/**
 * 409 CONSULTA_ABANDONADA (corpo real do back, sem mockar consultaEncerradaPor409) em escrita textual: segue o caminho
 * normal (onDescartada -> rebusca -> tratarFechada -> onAbandonada). Ao abandonar, o que não chegou ao servidor se perde
 * (sem painel "não entraram"). Outros 409 (termos obrigatórios) não chegam a tratarFechada.
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
const NAO_ENTRARAM = `procedi_consulta_naoentraram_${USUARIO}_c-1`;
const VAZIOS = { queixa: '', expectativas: '', observacoesAvaliacao: '' };
const CORPO_ABANDONO = {
  error: 'CONSULTA_ABANDONADA',
  message: 'Esta consulta foi abandonada após 4 h sem atividade. Use Iniciar para retomar.',
  status: 409,
};
const erro409 = (body) => Object.assign(new Error(body.message), { status: 409, body });
const dto = (extras) => ({
  id: 'c-1', pacienteId: PACIENTE, status: 'aberto', modulo: 'hub', itens: [{ id: 'item-1', nomeLivre: 'Botox' }],
  queixa: null, expectativas: null, observacoesAvaliacao: null, ...extras,
});

async function assentar() {
  await act(async () => {
    for (let i = 0; i < 5; i += 1) await new Promise((r) => setTimeout(r, 0));
  });
}
async function esperar(ms) {
  await act(async () => { await new Promise((r) => setTimeout(r, ms)); });
}

function useTela(props) {
  const [valores, setValores] = useState(VAZIOS);
  const servidor = useAtendimentoServidor({ ...props, avaliacao: { valores, aplicar: setValores } });
  return { servidor, setValores };
}

async function montar() {
  vi.mocked(atendimentosApi.abrir).mockResolvedValue(dto());
  const avisos = criarAvisosFalsos();
  const onAbandonada = vi.fn();
  const props = {
    habilitado: true, orgId: 'org-1', userId: USUARIO, emConsulta: true, pacienteId: PACIENTE,
    procedimentosSessao: [], aparelho: { setProcedimentosSessao: vi.fn() }, onAbandonada,
  };
  const r = renderHook((p) => useTela(p), { initialProps: props, wrapper: avisos.Wrapper });
  await assentar();
  await act(async () => { await r.result.current.servidor.abrir({ pacienteId: PACIENTE }); });
  await assentar();
  return { ...r, avisos, onAbandonada };
}

/** Digita a queixa e dispara o envio (o back responde `rejeicao`). */
async function enviarQueixa(r, texto) {
  act(() => r.result.current.setValores((v) => ({ ...v, queixa: texto })));
  let ok;
  act(() => { ok = r.result.current.servidor.onCampoAvaliacaoBlur('queixa'); });
  expect(ok).toBe(true);
  await esperar(50);
  await assentar();
}

describe('409 CONSULTA_ABANDONADA em escrita textual', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.mocked(atendimentosApi.minhas).mockResolvedValue([]);
    vi.mocked(atendimentosApi.pendencia).mockResolvedValue(null);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetAllMocks();
    sessionStorage.clear();
  });

  it('corpo real: sai da tela (tratarFechada -> onAbandonada), fila vazia após descartarPendentes e painel nulo', async () => {
    const r = await montar();
    vi.mocked(atendimentosApi.alterarAvaliacaoTexto).mockRejectedValue(erro409(CORPO_ABANDONO));
    vi.mocked(atendimentosApi.detalhe).mockResolvedValue(dto({ status: 'abandonado' }));
    await enviarQueixa(r, 'dor no pescoço');
    await esperar(50);
    await assentar();

    expect(atendimentosApi.detalhe).toHaveBeenCalledWith('c-1');
    expect(r.result.current.servidor.atual).toBeNull();
    expect(r.onAbandonada).toHaveBeenCalledTimes(1);
    const { descartarPendentes, pendentes } = r.onAbandonada.mock.calls[0][0];
    // A entrada que levou o 409 saiu da fila, mas a recusa por abandono conta no aviso.
    expect(pendentes).toBe(1);
    expect(typeof descartarPendentes).toBe('function');
    act(() => descartarPendentes());
    expect(Object.keys(sessionStorage).filter((k) => k.startsWith('procedi_consulta_fila_'))).toEqual([]);
    expect(r.result.current.servidor.alteracoesNaoEntraram).toBeNull();
    expect(sessionStorage.getItem(NAO_ENTRARAM)).toBeNull();
    // Nada reenviado depois (nem a entrada recusada, nem outra) e a consulta não volta a ser relida.
    await esperar(300);
    await assentar();
    expect(atendimentosApi.alterarAvaliacaoTexto).toHaveBeenCalledTimes(1);
    expect(atendimentosApi.detalhe).toHaveBeenCalledTimes(1);
    expect(r.onAbandonada).toHaveBeenCalledTimes(1);
  });

  it('outro 409 (termos obrigatórios) não vira "não entraram" nem chega a tratarFechada', async () => {
    const r = await montar();
    vi.mocked(atendimentosApi.alterarAvaliacaoTexto).mockRejectedValue(
      erro409({ error: 'TERMOS_OBRIGATORIOS', message: 'Faltam termos obrigatórios.', status: 409 }),
    );
    vi.mocked(atendimentosApi.detalhe).mockResolvedValue(dto());
    await enviarQueixa(r, 'dor no pescoço');
    await esperar(50);
    await assentar();

    expect(r.result.current.servidor.alteracoesNaoEntraram).toBeNull();
    expect(sessionStorage.getItem(NAO_ENTRARAM)).toBeNull();
    expect(r.onAbandonada).not.toHaveBeenCalled();
    expect(r.result.current.servidor.atual).not.toBeNull();
  });
});
