/**
 * F2 (testador independente): campo em foco em duas abas, cenários adversariais.
 * Mesmo harness de `atalhoEFocoDuasAbas.test.jsx` (duas `renderHook`, DOM real com `data-campo-consulta`, servidor
 * falso com `estado` compartilhado). Aqui a aba testada é a A (a que digita e sai do campo); "B grava" é o
 * servidor mudando e o aviso `ATENDIMENTO.SESSAO_ALTERADA` chegando na A.
 *
 * Campos de item cobertos: observação (obs), orientações (orient) e procedimento (proc: catálogo + nome).
 * O servidor falso do arquivo tem um PATCH de item controlável (segurar a resposta, recusar, cair a rede).
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
  ROLE_USER_ID,
  storageFalso,
} from '../encerrar/servidorEncerrarFalso.js';
import { ATENDIMENTO_ID } from './appConsulta.jsx';

vi.mock('../../lib/supabaseClient.js', async () => (await import('../encerrar/servidorEncerrarFalso.js')).supabaseFalso());
vi.mock('../../contexts/AvisosProvider.jsx', async () => (await import('./canalAvisosTeste.jsx')).avisosProviderFalso());

const ESPERA = { timeout: 3000 };
const AVISO = 'Alterado em outro aparelho';
const AVISO_SOBRESCREVEU = 'Sua alteração sobrescreveu a de outro aparelho';
const USUARIO = 'usr-1';
const VAZIOS = { queixa: '', expectativas: '', observacoesAvaliacao: '' };

const orientDe = (descricao) => [{ descricao, ordem: 1, checado: false }];

/** DTO de item do servidor. `proc` é um nome; o catálogo é `cat-<nome>`. */
function itemDto({ obs = 'obs0', orient = 'o0', proc = 'P0' } = {}) {
  return {
    id: 'i-1',
    ordem: 1,
    catalogoProcedimentoSaudeId: `cat-${proc}`,
    procedimentoNome: proc,
    observacaoExecucao: obs,
    orientacoes: orientDe(orient),
  };
}

function dtoCon(extras = {}) {
  return {
    id: ATENDIMENTO_ID,
    pacienteId: IDS.PACIENTE,
    pacienteNome: 'Maria Souza',
    anfitriaoRoleUserId: ROLE_USER_ID,
    status: 'aberto',
    modulo: 'hub',
    tipoProcedimentoCodigo: 'CONSULTA',
    iniciadoEm: '2026-10-06T12:30:00Z',
    itens: [itemDto()],
    fotos: [],
    consultaAnteriorFechada: null,
    fechadaPor: null,
    queixa: 'q0',
    expectativas: null,
    observacoesAvaliacao: null,
    preenchimentoAnamneseId: null,
    ...extras,
  };
}

/** O que cada campo de item sabe fazer: chave do foco, mudança local, DTO remoto, leitura local e do servidor. */
const CAMPOS = {
  obs: {
    chave: 'item:i-1:obs',
    inicial: 'obs0',
    dtoRemoto: (v) => itemDto({ obs: v }),
    local: (linha, v) => ({ ...linha, observacoesExecucao: v }),
    lerLocal: (linha) => linha.observacoesExecucao,
    lerServidor: (item) => item.observacaoExecucao,
    lerCorpo: (body) => body.observacaoExecucao,
  },
  orient: {
    chave: 'item:i-1:orient',
    inicial: 'o0',
    dtoRemoto: (v) => itemDto({ orient: v }),
    local: (linha, v) => ({ ...linha, orient: orientDe(v) }),
    lerLocal: (linha) => linha.orient?.[0]?.descricao,
    lerServidor: (item) => item.orientacoes?.[0]?.descricao,
    lerCorpo: (body) => body.orientacoes?.[0]?.descricao,
  },
  proc: {
    chave: 'item:i-1:proc',
    inicial: 'P0',
    dtoRemoto: (v) => itemDto({ proc: v }),
    local: (linha, v) => ({
      ...linha,
      nomeProcedimento: v,
      procedimentoNome: v,
      nomeProcedimentoCatalogoId: `cat-${v}`,
      catalogoProcedimentoSaudeId: `cat-${v}`,
      nomeSoDeTela: false,
    }),
    lerLocal: (linha) => linha.nomeProcedimento,
    lerServidor: (item) => String(item.catalogoProcedimentoSaudeId).replace(/^cat-/, ''),
    lerCorpo: (body) => String(body.catalogoProcedimentoSaudeId).replace(/^cat-/, ''),
  },
};

const assentar = () => act(async () => {
  for (let i = 0; i < 5; i += 1) await new Promise((r) => setTimeout(r, 0));
});
const esperar = (ms) => act(async () => {
  await new Promise((r) => setTimeout(r, ms));
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

describe('campo em foco: cenários adversariais (F2)', () => {
  let srv;
  let estado;
  /** Controle do PATCH de item do servidor falso deste arquivo. */
  let ctl;
  const campos = [];

  const patchesItem = () => srv.escritasConsulta.filter((e) => e.method === 'PATCH' && /\/itens\/i-1$/.test(e.path));
  const servidorItem = () => estado.dto.itens[0];

  async function montarA() {
    const avisar = vi.fn();
    const props = {
      habilitado: true,
      orgId: ORG_ID,
      userId: USUARIO,
      emConsulta: true,
      pacienteId: IDS.PACIENTE,
      avisar,
      storage: storageFalso(),
      idDaAba: () => 'aba-A',
      raizDeFoco: document.body,
    };
    const r = renderHook((p) => useTela(p), { initialProps: props, wrapper: avisos.Wrapper });
    await assentar();
    act(() => r.result.current.servidor.adotar(estado.dto));
    await assentar();
    expect(r.result.current.servidor.atual?.id).toBe(ATENDIMENTO_ID);
    return { ...r, avisar, props };
  }

  function criarCampo(chave) {
    const el = document.createElement('textarea');
    el.setAttribute('data-campo-consulta', chave);
    el.value = CAMPOS.obs.inicial;
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
  const emitir = () => act(() => {
    avisos.emitirAviso('ATENDIMENTO.SESSAO_ALTERADA', ATENDIMENTO_ID, { atendimentoId: ATENDIMENTO_ID });
  });
  /** A outra aba grava no servidor e avisa; espera o debounce do aviso e a releitura. */
  async function bGrava(item) {
    estado.dto = { ...estado.dto, itens: [item] };
    emitir();
    await esperar(400);
    await assentar();
  }
  /** A pessoa digita: muda a linha da sessão da A (o espelho enfileira o PATCH com debounce). */
  const digitar = (a, campo, valor) => act(() => {
    // Observação: o valor local que o hook lê ao sair é o do próprio textarea (como no navegador).
    if (campo === 'obs') campos.forEach((el) => { el.value = valor; });
    a.result.current.setSessao((s) => s.map((l) => CAMPOS[campo].local(l, valor)));
  });
  const localDe = (a, campo) => CAMPOS[campo].lerLocal(a.result.current.sessao[0]);
  const escritaDe = (campo, i) => CAMPOS[campo].lerCorpo(patchesItem()[i].body);
  const toastsSobrescreveu = (a) => a.avisar.mock.calls.filter((c) => c[1] === AVISO_SOBRESCREVEU).length;
  const toastsAlterado = (a) => a.avisar.mock.calls.filter((c) => c[1] === AVISO).length;

  beforeEach(() => {
    sessionStorage.clear();
    estado = { dto: dtoCon() };
    ctl = {
      modo: null, segurar: 0, liberar: [], chegadas: 0, modoAval: null, chegadasAval: 0,
      // B4: GET do detalhe controlável (segurar a resposta para provar a ordem "relê, depois marca").
      segurarGet: false, liberarGet: [], gets: 0,
    };
    const patchItem = async ({ body }) => {
      ctl.chegadas += 1;
      if (ctl.modo === 'rede') throw new TypeError('Failed to fetch');
      if (ctl.modo === 'recusa') {
        const st = ctl.statusRecusa ?? 422;
        return { status: st, corpo: { error: 'Dados inválidos', status: st } };
      }
      if (estado.dto.status === 'encerrado') return { status: 409, corpo: { error: 'Esta consulta já foi fechada.', status: 409 } };
      const itens = estado.dto.itens;
      const atualizado = { ...itens[0], ...(body && typeof body === 'object' ? body : {}) };
      // Servidor que normaliza a observação (apara): o valor guardado difere do enviado.
      if (ctl.aparar && typeof atualizado.observacaoExecucao === 'string') {
        atualizado.observacaoExecucao = atualizado.observacaoExecucao.trim();
      }
      estado.dto = { ...estado.dto, itens: [atualizado] };
      if (ctl.segurar > 0) {
        ctl.segurar -= 1;
        await new Promise((r) => ctl.liberar.push(r));
      }
      return atualizado;
    };
    srv = criarServidorEncerrarFalso({
      permissoes: Object.values(PERMISSOES),
      estado,
      rotas: [
        ['GET', /^\/api\/v1\/atendimentos\/[^/]+$/, async () => {
          ctl.gets += 1;
          if (ctl.segurarGet) await new Promise((r) => ctl.liberarGet.push(r));
          return estado.dto;
        }],
        ['PATCH', /^\/api\/v1\/atendimentos\/[^/]+\/itens\/[^/]+$/, patchItem],
        // B1: PATCH da avaliação controlável (recusa com status escolhido, ou aceita gravando os campos do corpo).
        ['PATCH', /^\/api\/v1\/atendimentos\/[^/]+\/avaliacao-texto$/, ({ body }) => {
          ctl.chegadasAval += 1;
          if (ctl.modoAval === 'recusa') {
            const st = ctl.statusAval ?? 422;
            return { status: st, corpo: { error: 'Dados inválidos', status: st } };
          }
          estado.dto = { ...estado.dto, ...(body && typeof body === 'object' ? body : {}) };
          return estado.dto;
        }],
      ],
    });
    vi.stubGlobal('fetch', srv.fetchFalso);
    setOrgId(ORG_ID);
  });
  afterEach(() => {
    campos.splice(0).forEach((el) => el.remove());
    vi.unstubAllGlobals();
    setOrgId(null);
  });

  // ------------------------------------------------------------------ (1) obs, orientações, procedimento
  describe.each(['obs', 'orient', 'proc'])('(1) campo %s: A digita, PATCH aceito, B grava, A sai', (campo) => {
    const C = CAMPOS[campo];

    it('o local vence: 2º PATCH imediato com o texto local, 1 toast de sobrescrita, servidor com o local', async () => {
      const a = await montarA();
      const el = criarCampo(C.chave);
      focar(el);
      digitar(a, campo, 'A1');
      await esperar(800);
      await assentar();
      await waitFor(() => expect(patchesItem()).toHaveLength(1), ESPERA);
      expect(escritaDe(campo, 0)).toBe('A1');
      expect(C.lerServidor(servidorItem())).toBe('A1');

      await bGrava(C.dtoRemoto('B1'));
      expect(localDe(a, campo)).toBe('A1');
      expect(patchesItem()).toHaveLength(1);
      expect(a.avisar).not.toHaveBeenCalled();

      sair(el);
      await waitFor(() => expect(patchesItem()).toHaveLength(2), ESPERA);
      expect(escritaDe(campo, 1)).toBe('A1');
      expect(toastsSobrescreveu(a)).toBe(1);
      expect(toastsAlterado(a)).toBe(0);
      expect(C.lerServidor(servidorItem())).toBe('A1');
      await esperar(1000);
      await assentar();
      expect(patchesItem()).toHaveLength(2);
      expect(localDe(a, campo)).toBe('A1');
    });

    it('só focou, sem digitar: o remoto vence, zero PATCH, toast "Alterado em outro aparelho"', async () => {
      const a = await montarA();
      const el = criarCampo(C.chave);
      focar(el);
      await bGrava(C.dtoRemoto('B1'));
      expect(localDe(a, campo)).toBe(C.inicial);
      sair(el);
      await esperar(1000);
      await assentar();
      expect(localDe(a, campo)).toBe('B1');
      expect(patchesItem()).toHaveLength(0);
      expect(toastsAlterado(a)).toBe(1);
      expect(toastsSobrescreveu(a)).toBe(0);
      expect(C.lerServidor(servidorItem())).toBe('B1');
    });
  });

  // ------------------------------------------------------------------ (2) voltar ao campo e sair sem digitar
  describe.each(['obs', 'orient', 'proc'])('(2) campo %s: depois do local vencer, voltar e sair sem digitar', (campo) => {
    it('nenhum PATCH extra e nenhum toast novo', async () => {
      const C = CAMPOS[campo];
      const a = await montarA();
      const el = criarCampo(C.chave);
      focar(el);
      digitar(a, campo, 'A1');
      await esperar(800);
      await assentar();
      await waitFor(() => expect(patchesItem()).toHaveLength(1), ESPERA);
      await bGrava(C.dtoRemoto('B1'));
      sair(el);
      await waitFor(() => expect(patchesItem()).toHaveLength(2), ESPERA);
      await esperar(500);
      await assentar();
      expect(toastsSobrescreveu(a)).toBe(1);

      focar(el);
      await esperar(200);
      sair(el);
      await esperar(1200);
      await assentar();
      expect(patchesItem()).toHaveLength(2);
      expect(toastsSobrescreveu(a)).toBe(1);
      expect(toastsAlterado(a)).toBe(0);
      expect(a.avisar).toHaveBeenCalledTimes(1);
      expect(localDe(a, campo)).toBe('A1');
      expect(C.lerServidor(servidorItem())).toBe('A1');
    });
  });

  // ------------------------------------------------------------------ (3) dois PATCHes de item em voo
  describe.each(['obs', 'orient', 'proc'])('(3) campo %s: dois envios seguidos', (campo) => {
    it('a resposta do 1º não regride a base e o servidor termina com o último digitado', async () => {
      const C = CAMPOS[campo];
      const a = await montarA();
      const el = criarCampo(C.chave);
      focar(el);
      ctl.segurar = 1; // o 1º PATCH fica em voo
      digitar(a, campo, 'um');
      await waitFor(() => expect(ctl.chegadas).toBe(1), ESPERA);
      expect(C.lerServidor(servidorItem())).toBe('um');

      // Em voo: a pessoa digita de novo (entrada mais nova da mesma chave) e só então a resposta do 1º chega.
      digitar(a, campo, 'dois');
      ctl.liberar.splice(0).forEach((f) => f());
      await assentar();
      await waitFor(() => expect(patchesItem()).toHaveLength(2), ESPERA);
      expect(escritaDe(campo, 0)).toBe('um');
      expect(escritaDe(campo, 1)).toBe('dois');
      await esperar(1200);
      await assentar();
      expect(C.lerServidor(servidorItem())).toBe('dois');
      expect(localDe(a, campo)).toBe('dois');
      expect(patchesItem()).toHaveLength(2);

      // Nada em espera, nada a reenviar: sair do campo e uma releitura sem mudança não geram PATCH nem toast.
      sair(el);
      await bGrava(estado.dto.itens[0]);
      await esperar(1000);
      await assentar();
      expect(patchesItem()).toHaveLength(2);
      expect(a.avisar).not.toHaveBeenCalled();
      expect(C.lerServidor(servidorItem())).toBe('dois');
    });
  });

  // ------------------------------------------------------------------ (4) remoto igual ao local
  describe.each(['obs', 'orient', 'proc'])('(4) campo %s: remoto igual ao texto local', (campo) => {
    const C = CAMPOS[campo];

    it('B grava exatamente o que A digitou (PATCH da A ainda não saiu): zero PATCH de saída e zero toast', async () => {
      const a = await montarA();
      const el = criarCampo(C.chave);
      focar(el);
      digitar(a, campo, 'igual');
      // B grava o MESMO valor antes do debounce da A.
      await bGrava(C.dtoRemoto('igual'));
      sair(el);
      // O que está na fila (debounce da digitação) pode sair uma vez; o que não pode é toast nem duplicata.
      await esperar(1500);
      await assentar();
      expect(toastsSobrescreveu(a)).toBe(0);
      expect(toastsAlterado(a)).toBe(0);
      expect(a.avisar).not.toHaveBeenCalled();
      expect(patchesItem().length).toBeLessThanOrEqual(1);
      expect(C.lerServidor(servidorItem())).toBe('igual');
      expect(localDe(a, campo)).toBe('igual');
    });

    it('A digita X, PATCH aceito, B grava Y e a pessoa volta a digitar Y: ao sair, sem toast de sobrescrita', async () => {
      const a = await montarA();
      const el = criarCampo(C.chave);
      focar(el);
      digitar(a, campo, 'X');
      await esperar(800);
      await assentar();
      await waitFor(() => expect(patchesItem()).toHaveLength(1), ESPERA);
      await bGrava(C.dtoRemoto('Y'));
      digitar(a, campo, 'Y');
      // O PATCH debounced do "Y" é da digitação (servidor já tem Y): pode sair, mas saída não pode brigar nem avisar.
      await esperar(900);
      await assentar();
      const antesDeSair = patchesItem().length;
      sair(el);
      await esperar(1200);
      await assentar();
      expect(patchesItem()).toHaveLength(antesDeSair);
      expect(toastsSobrescreveu(a)).toBe(0);
      expect(C.lerServidor(servidorItem())).toBe('Y');
      expect(localDe(a, campo)).toBe('Y');
    });
  });

  // ------------------------------------------------------------------ (5) B grava duas vezes seguidas
  describe.each(['obs', 'orient', 'proc'])('(5) campo %s: B grava duas vezes com A em foco', (campo) => {
    const C = CAMPOS[campo];

    it('A só focou: vale o ÚLTIMO remoto, zero PATCH', async () => {
      const a = await montarA();
      const el = criarCampo(C.chave);
      focar(el);
      await bGrava(C.dtoRemoto('B1'));
      await bGrava(C.dtoRemoto('B2'));
      expect(localDe(a, campo)).toBe(C.inicial);
      sair(el);
      await esperar(1000);
      await assentar();
      expect(localDe(a, campo)).toBe('B2');
      expect(patchesItem()).toHaveLength(0);
      expect(toastsAlterado(a)).toBe(1);
      expect(C.lerServidor(servidorItem())).toBe('B2');
    });

    it('A digitou: o local vence os dois remotos (1 PATCH do local, 1 toast), servidor com o local', async () => {
      const a = await montarA();
      const el = criarCampo(C.chave);
      focar(el);
      digitar(a, campo, 'A1');
      await esperar(800);
      await assentar();
      await waitFor(() => expect(patchesItem()).toHaveLength(1), ESPERA);
      await bGrava(C.dtoRemoto('B1'));
      await bGrava(C.dtoRemoto('B2'));
      expect(localDe(a, campo)).toBe('A1');
      expect(patchesItem()).toHaveLength(1);
      sair(el);
      await waitFor(() => expect(patchesItem()).toHaveLength(2), ESPERA);
      expect(escritaDe(campo, 1)).toBe('A1');
      expect(toastsSobrescreveu(a)).toBe(1);
      await esperar(1000);
      await assentar();
      expect(patchesItem()).toHaveLength(2);
      expect(C.lerServidor(servidorItem())).toBe('A1');
    });

    it('A digitou "B2" depois dos dois remotos: igual ao ÚLTIMO remoto, sem toast de sobrescrita', async () => {
      const a = await montarA();
      const el = criarCampo(C.chave);
      focar(el);
      digitar(a, campo, 'A1');
      await esperar(800);
      await assentar();
      await waitFor(() => expect(patchesItem()).toHaveLength(1), ESPERA);
      await bGrava(C.dtoRemoto('B1'));
      await bGrava(C.dtoRemoto('B2'));
      digitar(a, campo, 'B2');
      await esperar(900);
      await assentar();
      const antes = patchesItem().length;
      sair(el);
      await esperar(1200);
      await assentar();
      expect(patchesItem()).toHaveLength(antes);
      expect(toastsSobrescreveu(a)).toBe(0);
      expect(C.lerServidor(servidorItem())).toBe('B2');
      expect(localDe(a, campo)).toBe('B2');
    });
  });

  // ------------------------------------------------------------------ (7) a resposta do PATCH confirma a base
  it('(7) obs: servidor aparou o texto no PATCH aceito; uma releitura com o campo em foco não vira "mudou em outro aparelho"', async () => {
    ctl.aparar = true;
    const a = await montarA();
    const el = criarCampo(CAMPOS.obs.chave);
    focar(el);
    digitar(a, 'obs', 'texto   ');
    await esperar(800);
    await assentar();
    await waitFor(() => expect(patchesItem()).toHaveLength(1), ESPERA);
    expect(patchesItem()[0].body).toEqual({ observacaoExecucao: 'texto   ' });
    expect(servidorItem().observacaoExecucao).toBe('texto');

    // Outra coisa mudou no servidor (queixa): a A relê o detalhe com o item como o servidor o guardou.
    estado.dto = { ...estado.dto, queixa: 'queixa da B' };
    emitir();
    await esperar(400);
    await assentar();
    expect(a.result.current.valores.queixa).toBe('queixa da B');
    sair(el);
    await esperar(1200);
    await assentar();
    // Sem toast de "sobrescreveu" falso: a resposta do PATCH aceito já é a base. (Achado do testador: com a base
    // vinda do servidor aparado, o espelho ainda reenvia o texto local uma vez; é idempotente, então só se exige
    // que todo envio extra leve o mesmo texto e que nunca passe de 1 envio extra.)
    expect(a.avisar).not.toHaveBeenCalled();
    expect(patchesItem().length).toBeLessThanOrEqual(2);
    patchesItem().forEach((p) => expect(p.body).toEqual({ observacaoExecucao: 'texto   ' }));
  });

  // ------------------------------------------------------------------ (6) PATCH da saída falha
  describe('(6) o PATCH disparado ao sair do campo falha', () => {
    async function ateASaida(campo) {
      const C = CAMPOS[campo];
      const a = await montarA();
      const el = criarCampo(C.chave);
      focar(el);
      digitar(a, campo, 'A1');
      await esperar(800);
      await assentar();
      await waitFor(() => expect(patchesItem()).toHaveLength(1), ESPERA);
      await bGrava(C.dtoRemoto('B1'));
      return { a, el, C };
    }

    it('rede cai: o texto local fica na tela, a entrada fica na fila (storage) e reenvia quando a rede volta', async () => {
      const campo = 'obs';
      const { a, el, C } = await ateASaida(campo);
      ctl.modo = 'rede';
      sair(el);
      await waitFor(() => expect(ctl.chegadas).toBeGreaterThanOrEqual(2), ESPERA);
      await assentar();
      // Rede caiu: nenhum toast ("sobrescreveu" só sai com o 2xx); o servidor ainda tem o texto do outro aparelho e
      // a fila segura o envio.
      expect(localDe(a, campo)).toBe('A1');
      expect(C.lerServidor(servidorItem())).toBe('B1');
      // A entrada segue guardada no storage da aba (sobrevive a F5) enquanto o servidor não aceita.
      const chavesFila = Array.from({ length: a.props.storage.length }, (_, k) => a.props.storage.key(k))
        .filter((k) => k.includes(ATENDIMENTO_ID));
      expect(chavesFila.length).toBeGreaterThan(0);
      expect(chavesFila.some((k) => (a.props.storage.getItem(k) ?? '').includes('A1'))).toBe(true);

      ctl.modo = null;
      // Retentativa da fila (3 s).
      await waitFor(() => expect(C.lerServidor(servidorItem())).toBe('A1'), { timeout: 6000 });
      expect(localDe(a, campo)).toBe('A1');
    }, 20000);

    it.each([422, 400])('servidor recusa (%i): toast de ERRO, zero "sobrescreveu", base não avança e texto local preservado', async (status) => {
      const campo = 'obs';
      const { a, el, C } = await ateASaida(campo);
      const avisosAntes = a.avisar.mock.calls.length;
      ctl.modo = 'recusa';
      ctl.statusRecusa = status;
      const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
      sair(el);
      await waitFor(() => expect(ctl.chegadas).toBeGreaterThanOrEqual(2), ESPERA);
      await esperar(500);
      await assentar();
      const chegadasAposRecusa = ctl.chegadas;
      // Nada reenvia em loop: espera mais que o debounce do espelho e a retentativa da fila.
      await esperar(3500);
      await assentar();
      const chamadas = a.avisar.mock.calls.slice(avisosAntes);
      aviso.mockRestore();
      // O texto local continua na tela e o servidor continua com o do outro aparelho.
      expect(localDe(a, campo)).toBe('A1');
      expect(C.lerServidor(servidorItem())).toBe('B1');
      // Decisão do Johnn: o toast "sobrescreveu" só sai depois de 2xx. Em 4xx definitivo sai erro, e só ele.
      expect(chamadas.map((c) => c[1])).not.toContain(AVISO_SOBRESCREVEU);
      expect(chamadas.filter((c) => c[0] === 'error')).toHaveLength(1);
      expect(chamadas).toHaveLength(1);
      expect(ctl.chegadas).toBe(chegadasAposRecusa);
    }, 20000);

    it('2xx: o toast "sobrescreveu" só sai depois da resposta do PATCH (resposta segurada)', async () => {
      const campo = 'obs';
      const { a, el } = await ateASaida(campo);
      ctl.segurar = 1;
      const avisosAntes = a.avisar.mock.calls.length;
      sair(el);
      await waitFor(() => expect(ctl.chegadas).toBeGreaterThanOrEqual(2), ESPERA);
      await assentar();
      // PATCH em voo, resposta ainda não chegou: nenhum toast.
      expect(toastsSobrescreveu(a)).toBe(0);
      expect(a.avisar.mock.calls.length).toBe(avisosAntes);
      ctl.liberar.splice(0).forEach((f) => f());
      await assentar();
      await waitFor(() => expect(toastsSobrescreveu(a)).toBe(1), ESPERA);
    }, 20000);

    it('consulta encerrada (409) após sair: o texto vai para "não entraram" (não some calado)', async () => {
      const campo = 'obs';
      const { a, el } = await ateASaida(campo);
      estado.dto = { ...estado.dto, status: 'encerrado' };
      sair(el);
      await waitFor(() => expect(ctl.chegadas).toBeGreaterThanOrEqual(2), ESPERA);
      await esperar(500);
      await assentar();
      const lista = a.result.current.servidor.alteracoesNaoEntraram?.itens ?? [];
      expect(lista.some((x) => x.texto === 'A1')).toBe(true);
    }, 20000);
  });

  // ------------------------------------------------------------------ (7) B1: 4xx sem remoto em espera
  describe('(7) B1: envio recusado sem remoto em espera (blur da avaliação e espelho D4)', () => {
    const toastsErro = (a) => a.avisar.mock.calls.filter((c) => c[0] === 'error');
    const tela = (a) => a.avisar.mock.calls.map((c) => c[1]);

    /** A digita a queixa e a tela chama o blur da avaliação (sem remoto em espera). */
    async function digitarQueixaEBlur(a, texto) {
      act(() => a.result.current.setValores((v) => ({ ...v, queixa: texto })));
      await assentar();
      let enfileirou = false;
      act(() => {
        enfileirou = a.result.current.servidor.onCampoAvaliacaoBlur('queixa');
      });
      expect(enfileirou).toBe(true);
    }

    it.each([422, 400])('avaliação recusada (%i): 1 toast de erro, zero "sobrescreveu", texto preservado, "não salvo", sem loop', async (status) => {
      const a = await montarA();
      expect(a.result.current.valores.queixa).toBe('q0');
      ctl.modoAval = 'recusa';
      ctl.statusAval = status;
      const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await digitarQueixaEBlur(a, 'A digitou');
      await waitFor(() => expect(ctl.chegadasAval).toBeGreaterThanOrEqual(1), ESPERA);
      await esperar(500);
      await assentar();
      const chegadas = ctl.chegadasAval;
      await esperar(3500);
      await assentar();
      aviso.mockRestore();
      expect(toastsErro(a)).toHaveLength(1);
      expect(tela(a)).not.toContain(AVISO_SOBRESCREVEU);
      expect(a.avisar).toHaveBeenCalledTimes(1);
      expect(a.result.current.valores.queixa).toBe('A digitou');
      expect(a.result.current.servidor.avaliacaoTemNaoSalvo()).toBe(true);
      expect(ctl.chegadasAval).toBe(chegadas);
    }, 20000);

    it.each([422, 400])('item (obs) recusado pelo espelho D4 (%i): 1 toast de erro, texto preservado, sem loop', async (status) => {
      const a = await montarA();
      ctl.modo = 'recusa';
      ctl.statusRecusa = status;
      const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
      digitar(a, 'obs', 'A1');
      await esperar(800);
      await assentar();
      await waitFor(() => expect(ctl.chegadas).toBeGreaterThanOrEqual(1), ESPERA);
      await esperar(500);
      await assentar();
      const chegadas = ctl.chegadas;
      await esperar(3500);
      await assentar();
      aviso.mockRestore();
      expect(toastsErro(a)).toHaveLength(1);
      expect(tela(a)).not.toContain(AVISO_SOBRESCREVEU);
      expect(a.avisar).toHaveBeenCalledTimes(1);
      expect(localDe(a, 'obs')).toBe('A1');
      expect(servidorItem().observacaoExecucao).toBe('obs0');
      expect(ctl.chegadas).toBe(chegadas);
    }, 20000);

    it('2xx nesses caminhos não emite "sobrescreveu" nem outro toast (avaliação e item)', async () => {
      const a = await montarA();
      await digitarQueixaEBlur(a, 'A digitou');
      await waitFor(() => expect(ctl.chegadasAval).toBe(1), ESPERA);
      digitar(a, 'obs', 'A1');
      await esperar(800);
      await assentar();
      await waitFor(() => expect(patchesItem()).toHaveLength(1), ESPERA);
      await esperar(1000);
      await assentar();
      expect(a.avisar).not.toHaveBeenCalled();
      expect(estado.dto.queixa).toBe('A digitou');
      expect(servidorItem().observacaoExecucao).toBe('A1');
      expect(a.result.current.servidor.avaliacaoTemNaoSalvo()).toBe(false);
    }, 20000);

    it.each([401, 429])('avaliação com %i continua em retentativa (sem erro) e chega quando o servidor volta', async (status) => {
      const a = await montarA();
      ctl.modoAval = 'recusa';
      ctl.statusAval = status;
      await digitarQueixaEBlur(a, 'A digitou');
      await waitFor(() => expect(ctl.chegadasAval).toBeGreaterThanOrEqual(1), ESPERA);
      await assentar();
      expect(toastsErro(a)).toHaveLength(0);
      ctl.modoAval = null;
      await waitFor(() => expect(estado.dto.queixa).toBe('A digitou'), { timeout: 8000 });
      expect(toastsErro(a)).toHaveLength(0);
      expect(tela(a)).not.toContain(AVISO_SOBRESCREVEU);
    }, 20000);

    // B4 (ordem do Johnn): antes este teste afirmava "sem toast de erro" em 403/409; agora a recarga E o toast de erro
    // que diz que o texto NÃO entrou são obrigatórios (1 toast por descarte).
    const MSG_NAO_ENTROU = 'Sua alteração não foi salva: a consulta foi atualizada. Confira e digite novamente.';
    it.each([403, 409])('avaliação com %i: recarrega a consulta E 1 toast de erro dizendo que o texto não entrou', async (status) => {
      const a = await montarA();
      ctl.modoAval = 'recusa';
      ctl.statusAval = status;
      const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const getsAntes = ctl.gets;
      await digitarQueixaEBlur(a, 'A digitou');
      await waitFor(() => expect(ctl.chegadasAval).toBeGreaterThanOrEqual(1), ESPERA);
      await waitFor(() => expect(ctl.gets).toBeGreaterThan(getsAntes), ESPERA);
      await esperar(500);
      await assentar();
      aviso.mockRestore();
      expect(toastsErro(a)).toHaveLength(1);
      expect(toastsErro(a)[0][1]).toBe(MSG_NAO_ENTROU);
      expect(tela(a)).not.toContain(AVISO_SOBRESCREVEU);
      expect(a.avisar).toHaveBeenCalledTimes(1);
    }, 20000);

    it.each([403, 409])('item (obs) com %i: recarrega a consulta E 1 toast de erro dizendo que o texto não entrou', async (status) => {
      const a = await montarA();
      ctl.modo = 'recusa';
      ctl.statusRecusa = status;
      const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const getsAntes = ctl.gets;
      digitar(a, 'obs', 'A1');
      await esperar(800);
      await assentar();
      await waitFor(() => expect(ctl.chegadas).toBeGreaterThanOrEqual(1), ESPERA);
      await waitFor(() => expect(ctl.gets).toBeGreaterThan(getsAntes), ESPERA);
      await esperar(500);
      await assentar();
      const chegadas = ctl.chegadas;
      await esperar(2500);
      await assentar();
      aviso.mockRestore();
      expect(toastsErro(a)).toHaveLength(1);
      expect(toastsErro(a)[0][1]).toBe(MSG_NAO_ENTROU);
      expect(a.avisar).toHaveBeenCalledTimes(1);
      expect(ctl.chegadas).toBe(chegadas);
    }, 20000);

    it('409 de consulta ENCERRADA em item: caminho "não entrou", sem toast de erro novo', async () => {
      const a = await montarA();
      const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
      digitar(a, 'obs', 'A1');
      estado.dto = { ...estado.dto, status: 'encerrado' };
      await waitFor(() => expect(ctl.chegadas).toBeGreaterThanOrEqual(1), ESPERA);
      await esperar(800);
      await assentar();
      aviso.mockRestore();
      expect(toastsErro(a)).toHaveLength(0);
      expect(tela(a)).not.toContain(MSG_NAO_ENTROU);
      const lista = a.result.current.servidor.alteracoesNaoEntraram?.itens ?? [];
      expect(lista.some((x) => x.texto === 'A1')).toBe(true);
    }, 20000);

    // B4: 404/410 relê a consulta ANTES de marcar "não salvo" (e só então avisa).
    it.each([404, 410])('avaliação com %i: relê ANTES de marcar "não salvo"; 1 toast de erro só depois da releitura', async (status) => {
      const a = await montarA();
      ctl.modoAval = 'recusa';
      ctl.statusAval = status;
      const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
      ctl.segurarGet = true;
      const getsAntes = ctl.gets;
      await digitarQueixaEBlur(a, 'A digitou');
      await waitFor(() => expect(ctl.chegadasAval).toBeGreaterThanOrEqual(1), ESPERA);
      await waitFor(() => expect(ctl.gets).toBeGreaterThan(getsAntes), ESPERA);
      await esperar(300);
      await assentar();
      // GET do detalhe em voo: ainda não pode haver toast nem marca; o texto local segue na tela.
      expect(toastsErro(a)).toHaveLength(0);
      expect(a.result.current.valores.queixa).toBe('A digitou');
      ctl.segurarGet = false;
      ctl.liberarGet.splice(0).forEach((f) => f());
      await esperar(500);
      await assentar();
      aviso.mockRestore();
      expect(toastsErro(a)).toHaveLength(1);
      expect(toastsErro(a)[0][1]).not.toBe(MSG_NAO_ENTROU);
      expect(a.result.current.valores.queixa).toBe('A digitou');
      expect(a.result.current.servidor.avaliacaoTemNaoSalvo()).toBe(true);
      const chegadas = ctl.chegadasAval;
      await esperar(2500);
      await assentar();
      expect(ctl.chegadasAval).toBe(chegadas);
    }, 20000);

    it.each([404, 410])('item (obs) com %i: relê ANTES de marcar; 1 toast de erro, texto preservado, sem loop', async (status) => {
      const a = await montarA();
      ctl.modo = 'recusa';
      ctl.statusRecusa = status;
      const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
      ctl.segurarGet = true;
      const getsAntes = ctl.gets;
      digitar(a, 'obs', 'A1');
      await esperar(800);
      await assentar();
      await waitFor(() => expect(ctl.chegadas).toBeGreaterThanOrEqual(1), ESPERA);
      await waitFor(() => expect(ctl.gets).toBeGreaterThan(getsAntes), ESPERA);
      await assentar();
      expect(toastsErro(a)).toHaveLength(0);
      expect(localDe(a, 'obs')).toBe('A1');
      ctl.segurarGet = false;
      ctl.liberarGet.splice(0).forEach((f) => f());
      await esperar(500);
      await assentar();
      const chegadas = ctl.chegadas;
      await esperar(3500);
      await assentar();
      aviso.mockRestore();
      expect(toastsErro(a)).toHaveLength(1);
      expect(a.avisar).toHaveBeenCalledTimes(1);
      expect(localDe(a, 'obs')).toBe('A1');
      expect(ctl.chegadas).toBe(chegadas);
    }, 20000);

    it('item removido na releitura (404): 1 toast de erro, sem reenvio em loop e sem marca órfã', async () => {
      const a = await montarA();
      ctl.modo = 'recusa';
      ctl.statusRecusa = 404;
      const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
      digitar(a, 'obs', 'A1');
      // Outro aparelho removeu o item antes do PATCH sair.
      estado.dto = { ...estado.dto, itens: [] };
      await esperar(800);
      await assentar();
      await waitFor(() => expect(ctl.chegadas).toBeGreaterThanOrEqual(1), ESPERA);
      await esperar(500);
      await assentar();
      const chegadas = ctl.chegadas;
      await esperar(3500);
      await assentar();
      aviso.mockRestore();
      expect(toastsErro(a)).toHaveLength(1);
      expect(ctl.chegadas).toBe(chegadas);
      expect(patchesItem().length).toBe(chegadas);
    }, 20000);

    it.each([[400, 'recusa'], [422, 'recusa']])('(%i) continua pelo caminho de sempre: 1 toast "não foi possível salvar", sem recarga', async (status) => {
      const a = await montarA();
      ctl.modoAval = 'recusa';
      ctl.statusAval = status;
      const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const getsAntes = ctl.gets;
      await digitarQueixaEBlur(a, 'A digitou');
      await waitFor(() => expect(ctl.chegadasAval).toBeGreaterThanOrEqual(1), ESPERA);
      await esperar(500);
      await assentar();
      aviso.mockRestore();
      expect(toastsErro(a)).toHaveLength(1);
      expect(toastsErro(a)[0][1]).not.toBe(MSG_NAO_ENTROU);
      expect(ctl.gets).toBe(getsAntes);
    }, 20000);
  });
});
