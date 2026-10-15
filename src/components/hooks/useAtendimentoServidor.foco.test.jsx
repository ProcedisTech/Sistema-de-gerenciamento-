/**
 * F6b: campo em foco não é sobrescrito pelo remoto (regra única `pendente(chave) || focado(chave)`).
 * - foco + remoto diferente: não aplica; guarda em espera;
 * - sair com o local mudado: vale o local (1 PATCH) + toast info; sem mudança: vale o remoto, 0 PATCH + toast;
 * - sem remoto em espera: nada; campo sem foco recebe o remoto; trocar de campo limpa o anterior;
 * - `minhasCarregadas` não volta a false com o mesmo dono.
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
    substituirPeloPlano: vi.fn(),
    encerrar: vi.fn(),
  },
}));

const { atendimentosApi } = await import('../../services/api');

const PACIENTE = 'p-maria';
const VAZIOS = { queixa: '', expectativas: '', observacoesAvaliacao: '' };
const AVISO = 'Alterado em outro aparelho';
/** F2: local mexido vence o remoto em espera e o toast diz isso. */
const AVISO_SOBRESCREVEU = 'Sua alteração sobrescreveu a de outro aparelho';

const item = (obs) => ({
  id: 'i-1',
  ordem: 1,
  catalogoProcedimentoSaudeId: 'cat-1',
  procedimentoNome: 'Botox',
  observacaoExecucao: obs,
  orientacoes: null,
});

function dto(extras = {}) {
  return {
    id: 'c-1',
    pacienteId: PACIENTE,
    status: 'aberto',
    modulo: 'hub',
    itens: [item('obs0')],
    queixa: 'q0',
    expectativas: null,
    observacoesAvaliacao: null,
    preenchimentoAnamneseId: null,
    ...extras,
  };
}

const esperar = (ms) => act(async () => {
  await new Promise((r) => setTimeout(r, ms));
});
const assentar = () => act(async () => {
  for (let i = 0; i < 5; i += 1) await new Promise((r) => setTimeout(r, 0));
});

function useTela({ avisar, ...props }) {
  const [sessao, setSessao] = useState([]);
  const [valores, setValores] = useState(VAZIOS);
  const servidor = useAtendimentoServidor({
    ...props,
    procedimentosSessao: sessao,
    aparelho: { setProcedimentosSessao: setSessao },
    avaliacao: { valores, aplicar: setValores },
    avisar,
  });
  return { servidor, sessao, setSessao, valores, setValores };
}

async function montar() {
  vi.mocked(atendimentosApi.abrir).mockResolvedValue(dto());
  const avisos = criarAvisosFalsos();
  const avisar = vi.fn();
  const props = { habilitado: true, orgId: 'org-1', userId: 'u-1', emConsulta: true, pacienteId: PACIENTE, avisar };
  const r = renderHook((p) => useTela(p), { initialProps: props, wrapper: avisos.Wrapper });
  await assentar();
  await act(async () => {
    await r.result.current.servidor.abrir({ pacienteId: PACIENTE });
  });
  await assentar();
  return { ...r, avisos, avisar, props };
}

const campos = [];
function criarCampo(chave, valor) {
  const el = document.createElement('textarea');
  el.setAttribute('data-campo-consulta', chave);
  el.value = valor;
  document.body.appendChild(el);
  campos.push(el);
  return el;
}
const focar = (el) => act(() => {
  el.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
});
const sair = (el) => act(() => {
  el.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
});
const obsDaSessao = (r) => r.result.current.sessao[0]?.observacoesExecucao;

async function remoto(r, extras) {
  vi.mocked(atendimentosApi.detalhe).mockResolvedValue(dto(extras));
  act(() => r.avisos.emitirAviso('ATENDIMENTO.SESSAO_ALTERADA', 'c-1', { atendimentoId: 'c-1' }));
  await esperar(400);
  await assentar();
}

describe('useAtendimentoServidor: campo em foco (F6b)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.mocked(atendimentosApi.minhas).mockResolvedValue([]);
    vi.mocked(atendimentosApi.alterarItem).mockResolvedValue(dto());
    vi.mocked(atendimentosApi.alterarAvaliacaoTexto).mockResolvedValue(dto());
  });
  afterEach(() => {
    campos.splice(0).forEach((el) => el.remove());
    vi.resetAllMocks();
  });

  it('(a) foco em item:obs + remoto diferente: não aplica; sair com local mudado envia 1 PATCH do local e avisa', async () => {
    const r = await montar();
    expect(obsDaSessao(r)).toBe('obs0');
    const el = criarCampo('item:i-1:obs', 'obs0');
    focar(el);

    await remoto(r, { itens: [item('remoto')] });
    expect(obsDaSessao(r)).toBe('obs0');

    el.value = 'local';
    act(() => r.result.current.setSessao((s) => s.map((l) => ({ ...l, observacoesExecucao: 'local' }))));
    sair(el);
    await esperar(1000);
    await assentar();

    expect(atendimentosApi.alterarItem).toHaveBeenCalledTimes(1);
    expect(atendimentosApi.alterarItem).toHaveBeenCalledWith('c-1', 'i-1', { observacaoExecucao: 'local' });
    expect(obsDaSessao(r)).toBe('local');
    // Resposta 2xx do PATCH já chegou (mock resolvido): só agora o toast.
    expect(r.avisar).toHaveBeenCalledWith('info', AVISO_SOBRESCREVEU);
    expect(r.avisar).not.toHaveBeenCalledWith('info', AVISO);
  });

  it('(a) 2xx: o toast "sobrescreveu" só sai depois da resposta do PATCH (resposta segurada)', async () => {
    const r = await montar();
    const el = criarCampo('item:i-1:obs', 'obs0');
    focar(el);
    await remoto(r, { itens: [item('remoto')] });
    let liberar;
    vi.mocked(atendimentosApi.alterarItem).mockImplementation(() => new Promise((res) => {
      liberar = res;
    }));
    el.value = 'local';
    act(() => r.result.current.setSessao((s) => s.map((l) => ({ ...l, observacoesExecucao: 'local' }))));
    sair(el);
    await esperar(1000);
    await assentar();
    expect(atendimentosApi.alterarItem).toHaveBeenCalledTimes(1);
    expect(r.avisar).not.toHaveBeenCalled();
    await act(async () => {
      liberar(dto({ itens: [item('local')] }));
    });
    await assentar();
    expect(r.avisar).toHaveBeenCalledWith('info', AVISO_SOBRESCREVEU);
  });

  it.each([400, 422])('(a) item recusado (%i): toast de erro, zero "sobrescreveu", texto local preservado, sem reenvio', async (status) => {
    const r = await montar();
    const el = criarCampo('item:i-1:obs', 'obs0');
    focar(el);
    await remoto(r, { itens: [item('remoto')] });
    vi.mocked(atendimentosApi.alterarItem).mockRejectedValue(Object.assign(new Error('Dados inválidos'), { status }));
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
    el.value = 'local';
    act(() => r.result.current.setSessao((s) => s.map((l) => ({ ...l, observacoesExecucao: 'local' }))));
    sair(el);
    await esperar(1000);
    await assentar();
    expect(atendimentosApi.alterarItem).toHaveBeenCalledTimes(1);
    expect(r.avisar).not.toHaveBeenCalledWith('info', AVISO_SOBRESCREVEU);
    expect(r.avisar.mock.calls.filter((c) => c[0] === 'error')).toHaveLength(1);
    expect(obsDaSessao(r)).toBe('local');
    // Uma rebusca (outra mudança no servidor) não apaga o texto local não salvo, e nada reenvia em loop.
    await remoto(r, { itens: [item('remoto')], queixa: 'outra' });
    await esperar(1500);
    await assentar();
    aviso.mockRestore();
    expect(obsDaSessao(r)).toBe('local');
    expect(atendimentosApi.alterarItem).toHaveBeenCalledTimes(1);
    expect(r.avisar).not.toHaveBeenCalledWith('info', AVISO_SOBRESCREVEU);
  });

  it('(b) avaliação recusada (422): toast de erro, sem "sobrescreveu", avaliacaoTemNaoSalvo() true e texto local preservado', async () => {
    const r = await montar();
    const el = criarCampo('avaliacao:queixa', 'q0');
    focar(el);
    await remoto(r, { queixa: 'q-remota' });
    vi.mocked(atendimentosApi.alterarAvaliacaoTexto).mockRejectedValue(Object.assign(new Error('Dados inválidos'), { status: 422 }));
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
    el.value = 'q-local';
    act(() => r.result.current.setValores((v) => ({ ...v, queixa: 'q-local' })));
    sair(el);
    await esperar(1000);
    await assentar();
    aviso.mockRestore();
    expect(atendimentosApi.alterarAvaliacaoTexto).toHaveBeenCalledTimes(1);
    expect(r.avisar).not.toHaveBeenCalledWith('info', AVISO_SOBRESCREVEU);
    expect(r.avisar.mock.calls.filter((c) => c[0] === 'error')).toHaveLength(1);
    expect(r.result.current.servidor.avaliacaoTemNaoSalvo()).toBe(true);
    expect(r.result.current.valores.queixa).toBe('q-local');
    await esperar(1500);
    await assentar();
    expect(atendimentosApi.alterarAvaliacaoTexto).toHaveBeenCalledTimes(1);
  });

  it('(a) sair sem mudança local: aplica o remoto, ZERO PATCH, e avisa', async () => {
    const r = await montar();
    const el = criarCampo('item:i-1:obs', 'obs0');
    focar(el);
    await remoto(r, { itens: [item('remoto')] });
    expect(obsDaSessao(r)).toBe('obs0');

    sair(el);
    await esperar(1000);
    await assentar();

    expect(obsDaSessao(r)).toBe('remoto');
    expect(atendimentosApi.alterarItem).not.toHaveBeenCalled();
    expect(r.avisar).toHaveBeenCalledTimes(1);
    expect(r.avisar).toHaveBeenCalledWith('info', AVISO);
  });

  it('sem remoto em espera: sair não avisa nem envia', async () => {
    const r = await montar();
    const el = criarCampo('item:i-1:obs', 'obs0');
    focar(el);
    await remoto(r, {});
    sair(el);
    await esperar(900);
    expect(r.avisar).not.toHaveBeenCalled();
    expect(atendimentosApi.alterarItem).not.toHaveBeenCalled();
    expect(obsDaSessao(r)).toBe('obs0');
  });

  it('(b) avaliação: foco em avaliacao:queixa protege; local mudado envia o local; sem mudança aplica o remoto', async () => {
    const r = await montar();
    expect(r.result.current.valores.queixa).toBe('q0');
    const el = criarCampo('avaliacao:queixa', 'q0');
    focar(el);
    await remoto(r, { queixa: 'q-remota' });
    expect(r.result.current.valores.queixa).toBe('q0');

    el.value = 'q-local';
    act(() => r.result.current.setValores((v) => ({ ...v, queixa: 'q-local' })));
    sair(el);
    await esperar(50);
    await assentar();
    expect(atendimentosApi.alterarAvaliacaoTexto).toHaveBeenCalledTimes(1);
    expect(atendimentosApi.alterarAvaliacaoTexto).toHaveBeenCalledWith('c-1', { queixa: 'q-local' });
    // O toast sai com o 2xx do PATCH (mock resolvido), não ao sair do campo.
    expect(r.avisar).toHaveBeenCalledWith('info', AVISO_SOBRESCREVEU);
    expect(r.avisar).not.toHaveBeenCalledWith('info', AVISO);

    // sem mudança local
    vi.mocked(atendimentosApi.alterarAvaliacaoTexto).mockClear();
    r.avisar.mockClear();
    const el2 = criarCampo('avaliacao:expectativas', '');
    focar(el2);
    await remoto(r, { queixa: 'q-local', expectativas: 'e-remota' });
    expect(r.result.current.valores.expectativas).toBe('');
    sair(el2);
    await esperar(50);
    await assentar();
    expect(r.result.current.valores.expectativas).toBe('e-remota');
    expect(atendimentosApi.alterarAvaliacaoTexto).not.toHaveBeenCalled();
    expect(r.avisar).toHaveBeenCalledWith('info', AVISO);
  });

  it('(c) campo sem foco recebe o remoto normalmente', async () => {
    const r = await montar();
    criarCampo('item:i-1:obs', 'obs0');
    await remoto(r, { itens: [item('remoto')], queixa: 'q-remota' });
    expect(obsDaSessao(r)).toBe('remoto');
    expect(r.result.current.valores.queixa).toBe('q-remota');
    expect(r.avisar).not.toHaveBeenCalled();
  });

  it('(d) trocar de campo limpa o anterior: o campo que perdeu o foco volta a receber o remoto', async () => {
    const r = await montar();
    const obs = criarCampo('item:i-1:obs', 'obs0');
    const queixa = criarCampo('avaliacao:queixa', 'q0');
    focar(obs);
    sair(obs);
    focar(queixa);

    await remoto(r, { itens: [item('remoto')] });
    expect(obsDaSessao(r)).toBe('remoto');
    expect(r.result.current.valores.queixa).toBe('q0');
    sair(queixa);
    expect(r.avisar).not.toHaveBeenCalled();
  });

  it('(F4) avaliacaoTemNaoSalvo: false hidratado e igual à base; true digitado sem blur; true com envio na fila; false depois do PATCH aceito', async () => {
    const r = await montar();
    const tem = () => r.result.current.servidor.avaliacaoTemNaoSalvo();
    expect(r.result.current.valores.queixa).toBe('q0');
    expect(tem()).toBe(false);

    // Digitou sem sair do campo: ainda não está no servidor.
    act(() => r.result.current.setValores((v) => ({ ...v, queixa: 'q1' })));
    expect(tem()).toBe(true);

    // Só espaços a mais não contam (mesmo critério aparado do blur).
    act(() => r.result.current.setValores((v) => ({ ...v, queixa: '  q0  ' })));
    expect(tem()).toBe(false);

    // Expectativas também entram; observações não.
    act(() => r.result.current.setValores((v) => ({ ...v, queixa: 'q0', expectativas: 'e1' })));
    expect(tem()).toBe(true);
    act(() => r.result.current.setValores((v) => ({ ...v, expectativas: '', observacoesAvaliacao: 'obs só' })));
    expect(tem()).toBe(false);

    // Blur enfileira o PATCH: enquanto o envio não termina, continua não salvo; com a resposta aceita, salvo.
    let liberar;
    vi.mocked(atendimentosApi.alterarAvaliacaoTexto).mockImplementation(() => new Promise((res) => {
      liberar = res;
    }));
    act(() => r.result.current.setValores((v) => ({ ...v, queixa: 'q1' })));
    let enfileirou = false;
    act(() => {
      enfileirou = r.result.current.servidor.onCampoAvaliacaoBlur('queixa');
    });
    expect(enfileirou).toBe(true);
    await assentar();
    expect(atendimentosApi.alterarAvaliacaoTexto).toHaveBeenCalledWith('c-1', { queixa: 'q1' });
    expect(tem()).toBe(true);
    await act(async () => {
      liberar(dto({ queixa: 'q1' }));
    });
    await assentar();
    expect(tem()).toBe(false);
  });

  it('(F4) avaliacaoTemNaoSalvo: false sem consulta acompanhada (nada hidratado)', async () => {
    const avisos = criarAvisosFalsos();
    const r = renderHook((p) => useTela(p), {
      initialProps: { habilitado: true, orgId: 'org-1', userId: 'u-1', emConsulta: true, pacienteId: PACIENTE, avisar: vi.fn() },
      wrapper: avisos.Wrapper,
    });
    await assentar();
    act(() => r.result.current.setValores((v) => ({ ...v, queixa: 'digitei' })));
    expect(r.result.current.servidor.avaliacaoTemNaoSalvo()).toBe(false);
  });

  it('(e) minhasCarregadas não volta a false com o mesmo dono; volta com dono diferente', async () => {
    const r = await montar();
    expect(r.result.current.servidor.minhasCarregadas).toBe(true);
    let liberar;
    vi.mocked(atendimentosApi.minhas).mockImplementation(() => new Promise((res) => {
      liberar = res;
    }));

    r.rerender({ ...r.props, habilitado: false });
    await assentar();
    r.rerender({ ...r.props, habilitado: true });
    await assentar();
    expect(r.result.current.servidor.minhasCarregadas).toBe(true);

    r.rerender({ ...r.props, userId: 'u-2' });
    await assentar();
    expect(r.result.current.servidor.minhasCarregadas).toBe(false);
    await act(async () => {
      liberar([]);
    });
    await assentar();
    expect(r.result.current.servidor.minhasCarregadas).toBe(true);
  });
});
