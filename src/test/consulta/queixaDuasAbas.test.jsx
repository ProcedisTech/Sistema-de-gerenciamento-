/**
 * Onda D (F4) em duas abas: queixa, expectativas e observações da avaliação vão ao servidor só ao sair do campo,
 * pelo PATCH /atendimentos/{id}/avaliacao-texto (só o campo), e a outra aba vê o texto pela releitura do aviso
 * ATENDIMENTO.SESSAO_ALTERADA. Molde de duas abas (ver o topo de `test/encerrar/servidorEncerrarFalso.js`):
 * UM servidor falso com `estado` compartilhado, o canal de avisos falso e duas `renderHook` com storages separados.
 * Cada aba guarda os 3 textos num `useState` (como o journeyState do App) e o `aplicar` é espiado.
 */
import { useState } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAtendimentoServidor } from '../../components/hooks/useAtendimentoServidor.js';
import { PERMISSOES } from '../../constants/permissoes.js';
import { setOrgId } from '../../services/api';
import { avisos } from './canalAvisosTeste.jsx';
import { IDS } from '../encerrar/cenariosEncerrar.js';
import {
  criarServidorEncerrarFalso,
  ORG_ID,
  PREENCHIMENTO_ANAMNESE_FALSO_ID,
  ROLE_USER_ID,
  storageFalso,
} from '../encerrar/servidorEncerrarFalso.js';

vi.mock('../../lib/supabaseClient.js', async () => (await import('../encerrar/servidorEncerrarFalso.js')).supabaseFalso());

const USUARIO = 'usr-1';
const ATENDIMENTO_ID = 'c0000000-0000-4000-8000-0000000000ad';
const VAZIOS = { queixa: '', expectativas: '', observacoesAvaliacao: '' };
const ESPERA = { timeout: 3000 };

function consultaDto(extras = {}) {
  return {
    id: ATENDIMENTO_ID,
    pacienteId: IDS.PACIENTE,
    pacienteNome: 'Maria Souza',
    anfitriaoRoleUserId: ROLE_USER_ID,
    status: 'aberto',
    modulo: 'hub',
    tipoProcedimentoCodigo: 'CONSULTA',
    iniciadoEm: '2026-10-06T12:30:00Z',
    itens: [],
    fotos: [],
    consultaAnteriorFechada: null,
    fechadaPor: null,
    queixa: null,
    expectativas: null,
    observacoesAvaliacao: null,
    preenchimentoAnamneseId: null,
    ...extras,
  };
}

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

/** A tela de uma aba: os 3 textos num `useState` e o hook com a opção `avaliacao`. */
function useAbaComAvaliacao({ aplicarEspiao, ...props }) {
  const [valores, setValores] = useState(VAZIOS);
  const servidor = useAtendimentoServidor({
    ...props,
    avaliacao: {
      valores,
      aplicar: (novos) => {
        aplicarEspiao(novos);
        setValores(novos);
      },
    },
  });
  return { servidor, valores, setValores };
}

function montarAba(nome) {
  const aplicarEspiao = vi.fn();
  const props = {
    habilitado: true,
    orgId: ORG_ID,
    userId: USUARIO,
    emConsulta: true,
    pacienteId: IDS.PACIENTE,
    procedimentosSessao: [],
    aparelho: { setProcedimentosSessao: vi.fn() },
    storage: storageFalso(),
    idDaAba: () => `aba-${nome}`,
    raizDeFoco: document.createElement('div'),
    aplicarEspiao,
  };
  const r = renderHook((p) => useAbaComAvaliacao(p), { initialProps: props, wrapper: avisos.Wrapper });
  return { ...r, props, aplicarEspiao };
}

function digitar(aba, campo, valor) {
  act(() => aba.result.current.setValores((v) => ({ ...v, [campo]: valor })));
}

function sair(aba, campo) {
  let enfileirou;
  act(() => {
    enfileirou = aba.result.current.servidor.onCampoAvaliacaoBlur(campo);
  });
  return enfileirou;
}

function emitirAviso() {
  act(() => {
    avisos.emitirAviso('ATENDIMENTO.SESSAO_ALTERADA', ATENDIMENTO_ID, { atendimentoId: ATENDIMENTO_ID });
  });
}

describe('textos da avaliação em duas abas (Onda D / F4)', () => {
  let srv;
  let estado;
  /** Portão opcional do PATCH avaliacao-texto (caso e): enquanto `portao` existe, o fetch espera. */
  let portao;
  let chamadasFetch;

  const patchesAvaliacao = () => srv.escritasConsulta.filter(
    (e) => e.method === 'PATCH' && e.path === `/api/v1/atendimentos/${ATENDIMENTO_ID}/avaliacao-texto`,
  );
  const chamadasAnamnese = () => chamadasFetch.filter((c) => /\/anamnese/i.test(c.url));

  async function montarDuasAbas(dto = consultaDto()) {
    estado.dto = dto;
    const abaA = montarAba('A');
    const abaB = montarAba('B');
    await assentar();
    act(() => {
      abaA.result.current.servidor.adotar(estado.dto);
      abaB.result.current.servidor.adotar(estado.dto);
    });
    await assentar();
    expect(abaA.result.current.servidor.atual?.id).toBe(ATENDIMENTO_ID);
    expect(abaB.result.current.servidor.atual?.id).toBe(ATENDIMENTO_ID);
    return { abaA, abaB };
  }

  beforeEach(() => {
    sessionStorage.clear();
    estado = { dto: null };
    portao = null;
    chamadasFetch = [];
    srv = criarServidorEncerrarFalso({ permissoes: Object.values(PERMISSOES), estado });
    vi.stubGlobal('fetch', async (url, init = {}) => {
      const method = String(init.method || 'GET').toUpperCase();
      chamadasFetch.push({ method, url: String(url) });
      if (portao && method === 'PATCH' && /\/avaliacao-texto$/.test(new URL(String(url), 'http://localhost').pathname)) {
        await portao.promessa;
      }
      return srv.fetchFalso(url, init);
    });
    setOrgId(ORG_ID);
  });
  afterEach(() => {
    portao?.liberar();
    vi.unstubAllGlobals();
    setOrgId(null);
  });

  it('(a) a aba A sai da queixa: 1 PATCH só com a queixa, nada em /anamnese; o aviso faz a aba B aplicar "Manchas"', async () => {
    const { abaA, abaB } = await montarDuasAbas();

    digitar(abaA, 'queixa', 'Manchas');
    expect(sair(abaA, 'queixa')).toBe(true);
    await waitFor(() => {
      expect(patchesAvaliacao()).toHaveLength(1);
    }, ESPERA);
    expect(patchesAvaliacao()[0].body).toEqual({ queixa: 'Manchas' });
    expect(estado.dto.queixa).toBe('Manchas');
    expect(chamadasAnamnese()).toHaveLength(0);
    expect(abaB.result.current.valores.queixa).toBe('');

    emitirAviso();
    await waitFor(() => {
      expect(abaB.aplicarEspiao).toHaveBeenCalledWith(expect.objectContaining({ queixa: 'Manchas' }));
      expect(abaB.result.current.valores.queixa).toBe('Manchas');
    }, ESPERA);

    await esperar(50);
    expect(patchesAvaliacao()).toHaveLength(1);
    expect(chamadasAnamnese()).toHaveLength(0);
  });

  it('(b) a aba B (sem preenchimento) sai das expectativas: 1 PATCH, nenhum POST /anamnese; as duas abas veem o preenchimentoAnamneseId', async () => {
    const { abaA, abaB } = await montarDuasAbas();
    expect(abaA.result.current.servidor.preenchimentoAnamneseId).toBeNull();
    expect(abaB.result.current.servidor.preenchimentoAnamneseId).toBeNull();

    digitar(abaB, 'expectativas', 'Clarear');
    expect(sair(abaB, 'expectativas')).toBe(true);
    await waitFor(() => {
      expect(patchesAvaliacao()).toHaveLength(1);
    }, ESPERA);
    expect(patchesAvaliacao()[0].body).toEqual({ expectativas: 'Clarear' });
    expect(chamadasAnamnese().filter((c) => c.method === 'POST')).toHaveLength(0);
    expect(chamadasAnamnese()).toHaveLength(0);

    emitirAviso();
    await waitFor(() => {
      expect(abaA.result.current.servidor.preenchimentoAnamneseId).toBe(PREENCHIMENTO_ANAMNESE_FALSO_ID);
      expect(abaB.result.current.servidor.preenchimentoAnamneseId).toBe(PREENCHIMENTO_ANAMNESE_FALSO_ID);
      expect(abaA.result.current.valores.expectativas).toBe('Clarear');
    }, ESPERA);
    await esperar(50);
    expect(patchesAvaliacao()).toHaveLength(1);
    expect(chamadasAnamnese()).toHaveLength(0);
  });

  it('(c) a aba A sai das observações: 1 PATCH só com elas, nada em /anamnese; o aviso faz a aba B aplicar', async () => {
    const { abaA, abaB } = await montarDuasAbas();

    digitar(abaA, 'observacoesAvaliacao', 'Pele fina');
    expect(sair(abaA, 'observacoesAvaliacao')).toBe(true);
    await waitFor(() => {
      expect(patchesAvaliacao()).toHaveLength(1);
    }, ESPERA);
    expect(patchesAvaliacao()[0].body).toEqual({ observacoesAvaliacao: 'Pele fina' });
    expect(estado.dto.observacoesAvaliacao).toBe('Pele fina');
    expect(chamadasAnamnese()).toHaveLength(0);

    emitirAviso();
    await waitFor(() => {
      expect(abaB.aplicarEspiao).toHaveBeenCalledWith(expect.objectContaining({ observacoesAvaliacao: 'Pele fina' }));
      expect(abaB.result.current.valores.observacoesAvaliacao).toBe('Pele fina');
    }, ESPERA);
    await esperar(50);
    expect(patchesAvaliacao()).toHaveLength(1);
  });

  it('(d) digitar sem sair do campo (várias renderizações, 1 s) não envia PATCH', async () => {
    const { abaA, abaB } = await montarDuasAbas();

    for (const parcial of ['M', 'Ma', 'Man', 'Manchas']) {
      digitar(abaA, 'queixa', parcial);
      abaA.rerender({ ...abaA.props });
    }
    digitar(abaB, 'expectativas', 'Clar');
    abaB.rerender({ ...abaB.props });
    digitar(abaA, 'observacoesAvaliacao', 'Obs');
    abaA.rerender({ ...abaA.props });
    await esperar(1000);
    await assentar();

    expect(patchesAvaliacao()).toHaveLength(0);
    expect(srv.escritasConsulta.filter((e) => e.method === 'PATCH')).toHaveLength(0);
    expect(chamadasAnamnese()).toHaveLength(0);
    expect(abaA.result.current.valores.queixa).toBe('Manchas');
  });

  it('(e) a aba B com a queixa pendente (PATCH preso) recebe aviso de outra mudança: o texto local não volta ao valor velho', async () => {
    const { abaB } = await montarDuasAbas(consultaDto({ queixa: 'Velho' }));
    expect(abaB.result.current.valores.queixa).toBe('Velho');

    let liberar;
    const promessa = new Promise((r) => {
      liberar = r;
    });
    portao = { promessa, liberar };

    digitar(abaB, 'queixa', 'Texto B');
    expect(sair(abaB, 'queixa')).toBe(true);
    await waitFor(() => {
      expect(chamadasFetch.filter((c) => c.method === 'PATCH' && c.url.endsWith('/avaliacao-texto'))).toHaveLength(1);
    }, ESPERA);
    // Preso no portão: o servidor ainda tem o valor velho.
    expect(patchesAvaliacao()).toHaveLength(0);
    expect(estado.dto.queixa).toBe('Velho');

    // "Outra aba" mudou as observações no servidor; o aviso faz a aba B reler (queixa ainda 'Velho' lá).
    estado.dto = { ...estado.dto, observacoesAvaliacao: 'Obs da outra aba' };
    emitirAviso();
    await waitFor(() => {
      expect(abaB.result.current.valores.observacoesAvaliacao).toBe('Obs da outra aba');
    }, ESPERA);
    expect(abaB.result.current.valores.queixa).toBe('Texto B');
    expect(abaB.aplicarEspiao).not.toHaveBeenCalledWith(expect.objectContaining({ queixa: 'Velho', observacoesAvaliacao: 'Obs da outra aba' }));

    await act(async () => {
      portao.liberar();
    });
    portao = null;
    await waitFor(() => {
      expect(patchesAvaliacao()).toHaveLength(1);
    }, ESPERA);
    expect(patchesAvaliacao()[0].body).toEqual({ queixa: 'Texto B' });
    expect(estado.dto.queixa).toBe('Texto B');
    await assentar();
    expect(abaB.result.current.valores.queixa).toBe('Texto B');
  });
});
