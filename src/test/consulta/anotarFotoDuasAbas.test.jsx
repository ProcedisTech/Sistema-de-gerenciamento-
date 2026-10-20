/**
 * F1 (hub em vários aparelhos): anotar uma foto na aba A troca o arquivo no servidor e a aba B vê a foto nova em
 * até 3 s, sem F5. Molde de duas abas (onda 0): duas "abas" (`useAtendimentoServidor` + `useEnvioFotosConsulta`,
 * cada uma com o seu storage) sobre UM servidor falso com estado compartilhado e o canal de avisos falso.
 *
 * - A Promise de `fotoAnotada` só resolve depois do 2xx do PUT (um PUT que o teste segura prova isso); a resposta é
 *   `{ estado: 'salva', arquivoAtualizadoEm }`. A lista da aba A só muda depois (como o AppRefactored faz).
 * - O servidor sobe a versão e manda GALERIA.FOTO_ANOTADA; a aba B relê o detalhe, percebe a versão diferente e
 *   troca a foto no lugar pela URL de reserva (`?v=<epochMs>`) com `meta.arquivoAtualizadoEm` novo.
 * - PUT 500: a Promise rejeita (depois das tentativas) e a foto local não muda.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAtendimentoServidor } from '../../components/hooks/useAtendimentoServidor.js';
import { useEnvioFotosConsulta } from '../../components/hooks/useEnvioFotosConsulta.js';
import { PERMISSOES } from '../../constants/permissoes.js';
import { setOrgId } from '../../services/api';
import { avisos } from './canalAvisosTeste.jsx';
import { IDS } from '../encerrar/cenariosEncerrar.js';
import {
  arquivoAtualizadoEmDaVersao,
  criarServidorEncerrarFalso,
  ORG_ID,
  ROLE_USER_ID,
  storageFalso,
} from '../encerrar/servidorEncerrarFalso.js';

vi.mock('../../lib/supabaseClient.js', async () => (await import('../encerrar/servidorEncerrarFalso.js')).supabaseFalso());
// O jsdom não tem canvas: o WebP é o próprio blob.
vi.mock('../../utils/imageUtils.js', () => ({ convertToWebP: vi.fn(async (b) => b) }));

const USUARIO = 'usr-1';
const ATENDIMENTO_ID = 'c0000000-0000-4000-8000-0000000000aa';
const FOTO_F = 'f0000000-0000-4000-8000-0000000000f1';
const ROTA_PUT_ARQUIVO = /^\/api\/v1\/atendimentos\/[^/]+\/fotos\/[^/]+\/arquivo$/;

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
    fotos: [{ id: FOTO_F, atendimentoItemId: null, tipoFotoCodigo: 'AVALIACAO', arquivoAtualizadoEm: arquivoAtualizadoEmDaVersao(1) }],
    consultaAnteriorFechada: null,
    fechadaPor: null,
    ...extras,
  };
}

function adiado() {
  let resolver;
  const promessa = new Promise((r) => {
    resolver = r;
  });
  return { promessa, resolver };
}

async function assentar(n = 5) {
  await act(async () => {
    for (let i = 0; i < n; i += 1) await new Promise((r) => setTimeout(r, 2));
  });
}

/**
 * Uma "aba": a consulta no servidor e o envio de fotos, com a lista de fotos da avaliação como estado (o
 * `evaluationCapturedPhotos` do aparelho). `anotar` faz o que o AppRefactored faz no `handleAnnotatedCaptureSaved`:
 * espera `fotoAnotada` e SÓ então troca a foto na lista.
 */
function montarAba(nome) {
  const base = {
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
  };
  const r = renderHook(
    (p) => {
      const servidor = useAtendimentoServidor(p);
      const [avaliacao, setAvaliacao] = useState([]);
      const [procedimento, setProcedimento] = useState([]);
      const envio = useEnvioFotosConsulta({
        consulta: servidor.atual,
        roleUserId: ROLE_USER_ID,
        fotosAvaliacao: avaliacao,
        fotosProcedimento: procedimento,
        itemDoProcedimentoAtivo: null,
        aparelho: { setEvaluationCapturedPhotos: setAvaliacao, setProcedureCapturedPhotos: setProcedimento },
        avisarErro: vi.fn(),
        esperasMs: [1, 1, 1],
      });
      return { servidor, envio, avaliacao, setAvaliacao };
    },
    { initialProps: base, wrapper: avisos.Wrapper },
  );
  const anotar = async (index, blob, newUrl) => {
    const foto = r.result.current.avaliacao[index];
    const resposta = await r.result.current.envio.fotoAnotada(foto, blob, 'avaliacao');
    act(() => {
      r.result.current.setAvaliacao((prev) => prev.map((f, i) => (i === index
        ? { url: newUrl, blob, meta: { ...(f.meta || {}), annotated: true, ...(resposta?.arquivoAtualizadoEm ? { arquivoAtualizadoEm: resposta.arquivoAtualizadoEm } : {}) } }
        : f)));
    });
    return resposta;
  };
  return { ...r, base, anotar };
}

describe('F1: anotar foto em duas abas', () => {
  let srv;
  let estado;
  let portao;

  beforeEach(() => {
    sessionStorage.clear();
    estado = { dto: consultaDto(), fotos: { [FOTO_F]: 1 } };
    portao = adiado();
    srv = criarServidorEncerrarFalso({
      permissoes: Object.values(PERMISSOES),
      estado,
      rotas: [
        // O PUT do arquivo anotado fica preso até o teste liberar o portão; depois faz o que o estado faria.
        ['PUT', ROTA_PUT_ARQUIVO, async ({ path }) => {
          await portao.promessa;
          const fotoId = decodeURIComponent(path.split('/')[6]);
          estado.fotos[fotoId] = (estado.fotos[fotoId] ?? 1) + 1;
          return { id: fotoId, versao: estado.fotos[fotoId], arquivoAtualizadoEm: arquivoAtualizadoEmDaVersao(estado.fotos[fotoId]) };
        }],
      ],
    });
    vi.stubGlobal('fetch', srv.fetchFalso);
    setOrgId(ORG_ID);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    setOrgId(null);
  });

  async function abrirAsDuasAbas() {
    const abaA = montarAba('A');
    const abaB = montarAba('B');
    await assentar();
    act(() => {
      abaA.result.current.servidor.adotar(estado.dto);
      abaB.result.current.servidor.adotar(estado.dto);
    });
    // As duas abas recebem a foto F do servidor (Y11), com a URL da galeria e a versão 1.
    await waitFor(() => {
      expect(abaA.result.current.avaliacao.map((f) => f.meta.fotoId)).toEqual([FOTO_F]);
      expect(abaB.result.current.avaliacao.map((f) => f.meta.fotoId)).toEqual([FOTO_F]);
    }, { timeout: 3000 });
    expect(abaB.result.current.avaliacao[0].meta.arquivoAtualizadoEm).toBe(arquivoAtualizadoEmDaVersao(1));
    return { abaA, abaB };
  }

  const putsDoArquivo = () => srv.fetchFalso.mock.calls.filter(
    ([url, init]) => String(init?.method || 'GET').toUpperCase() === 'PUT' && ROTA_PUT_ARQUIVO.test(new URL(String(url), 'http://localhost').pathname),
  );

  it('a aba A só resolve depois do 2xx do PUT; a aba B vê a foto com a versão nova em até 3 s', async () => {
    const { abaA, abaB } = await abrirAsDuasAbas();
    const fotoAntesEmB = abaB.result.current.avaliacao[0];

    const anotada = new Blob(['desenhada']);
    let resposta = null;
    const promessa = abaA.anotar(0, anotada, 'blob:anotada').then((r) => {
      resposta = r;
      return r;
    });
    // O PUT saiu e está preso no portão: a Promise ainda não resolveu e a lista da aba A ainda é a de antes.
    await waitFor(() => expect(putsDoArquivo()).toHaveLength(1), { timeout: 3000 });
    await assentar();
    expect(resposta).toBeNull();
    expect(abaA.result.current.avaliacao[0].blob).toBeNull();
    expect(estado.fotos[FOTO_F]).toBe(1);

    portao.resolver();
    await act(async () => {
      await promessa;
    });
    expect(resposta).toEqual({ estado: 'salva', arquivoAtualizadoEm: arquivoAtualizadoEmDaVersao(2) });
    expect(putsDoArquivo()).toHaveLength(1);
    expect(srv.escritasConsulta.filter((e) => e.method === 'PUT' && ROTA_PUT_ARQUIVO.test(e.path))).toHaveLength(1);
    expect(estado.fotos[FOTO_F]).toBe(2);
    // A aba A trocou a foto pela anotada (blob) com a versão nova.
    expect(abaA.result.current.avaliacao[0]).toMatchObject({
      url: 'blob:anotada',
      blob: anotada,
      meta: { fotoId: FOTO_F, arquivoAtualizadoEm: arquivoAtualizadoEmDaVersao(2) },
    });
    // A aba B ainda não sabe de nada.
    expect(abaB.result.current.avaliacao[0]).toBe(fotoAntesEmB);

    // O servidor real mandaria GALERIA.FOTO_ANOTADA pelo SSE; aqui o teste emite pelo canal falso.
    avisos.emitirAviso('GALERIA.FOTO_ANOTADA', FOTO_F, { atendimentoId: ATENDIMENTO_ID });

    const versao2 = arquivoAtualizadoEmDaVersao(2);
    await waitFor(() => {
      const [f] = abaB.result.current.avaliacao;
      expect(f.meta.arquivoAtualizadoEm).toBe(versao2);
      expect(f.url).toBe(`/api/v1/pacientes/${IDS.PACIENTE}/galeria/${FOTO_F}/arquivo?v=${Date.parse(versao2)}`);
    }, { timeout: 3000 });
    expect(abaB.result.current.avaliacao).toHaveLength(1);
    expect(abaB.result.current.avaliacao[0].blob).toBeNull();
    expect(abaB.result.current.avaliacao[0].meta.fotoId).toBe(FOTO_F);
    // A aba A, que já tinha a versão nova, não perdeu a foto anotada (blob) nem a trocou pela URL do servidor.
    await assentar();
    expect(abaA.result.current.avaliacao[0]).toMatchObject({ url: 'blob:anotada', blob: anotada });
    expect(srv.escritasConsulta.filter((e) => e.method === 'PUT' && ROTA_PUT_ARQUIVO.test(e.path))).toHaveLength(1);
  });

  it('PUT 500: a Promise rejeita e a foto local não muda', async () => {
    srv = criarServidorEncerrarFalso({
      permissoes: Object.values(PERMISSOES),
      estado,
      rotas: [['PUT', ROTA_PUT_ARQUIVO, () => ({ status: 500, corpo: { message: 'erro' } })]],
    });
    vi.stubGlobal('fetch', srv.fetchFalso);
    const { abaA } = await abrirAsDuasAbas();
    const fotoAntes = abaA.result.current.avaliacao[0];

    const anotada = new Blob(['desenhada']);
    let erro = null;
    await act(async () => {
      await abaA.anotar(0, anotada, 'blob:anotada').catch((e) => {
        erro = e;
      });
    });
    expect(erro).toBeInstanceOf(Error);
    expect(erro.status).toBe(500);
    // 1 tentativa + 3 repetições (só rede e 5xx repetem).
    expect(putsDoArquivo()).toHaveLength(4);
    expect(abaA.result.current.avaliacao).toHaveLength(1);
    expect(abaA.result.current.avaliacao[0]).toBe(fotoAntes);
    expect(abaA.result.current.avaliacao[0].meta.arquivoAtualizadoEm).toBe(arquivoAtualizadoEmDaVersao(1));
    expect(estado.fotos[FOTO_F]).toBe(1);
  });
});
