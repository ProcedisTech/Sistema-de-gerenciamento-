/**
 * Backend falso, no nível do `fetch`, para gravar o roteiro real do encerrar de hoje (Etapa 0, Y5).
 * Responde ao bootstrap do app e às rotas do encerrar e grava cada escrita (método, rota, body).
 * Ids criados pelo "servidor" têm forma de UUID e um marcador (`PF_1`, `AGENDA_NOVA_1`...), para o
 * replay no backend ligar a resposta real a quem a usa depois.
 *
 * Molde de duas abas (onda 0; prova em `test/consulta/moldeDuasAbas.test.jsx`):
 *   1. UM servidor falso com estado compartilhado: `criarServidorEncerrarFalso({ permissoes, estado })`, onde
 *      `estado = { dto, fotos }` é mutável pelo teste ("a outra aba gravou" = mudar `estado.dto` na mão).
 *      - GET /atendimentos/{id} devolve `estado.dto` (404 se nulo);
 *      - PATCH /atendimentos/{id}/itens/{itemId} e PATCH .../modulo aplicam no `estado.dto`;
 *      - PATCH /atendimentos/{id}/avaliacao-texto (F4) grava em `estado.dto` só os campos PRESENTES no corpo
 *        (`queixa`, `expectativas`, `observacoesAvaliacao`; `''` grava `null`); na 1ª queixa ou expectativa não vazia
 *        cria `estado.dto.preenchimentoAnamneseId = PREENCHIMENTO_ANAMNESE_FALSO_ID` (uma vez) e devolve `estado.dto`
 *        (o detalhe inteiro, como o servidor real). O GET do detalhe já devolve esses campos;
 *      - rotas de foto (POST galeria, PUT .../fotos/{fotoId}/arquivo, GET galeria, DELETE foto) guardam uma versão
 *        por fotoId em `estado.fotos`; o GET da galeria devolve `url` com `?v=<versao>`; o PUT devolve
 *        `{ id, versao, arquivoAtualizadoEm }` e o GET do detalhe devolve `fotos[].arquivoAtualizadoEm`, ambos
 *        derivados da versão por `arquivoAtualizadoEmDaVersao` (F1: o front troca a foto quando a versão muda).
 *      - um handler de `rotas` pode ser `async` (o `fetch` espera): serve para um PUT que o teste segura.
 *   2. O canal falso de `test/consulta/canalAvisosTeste.jsx` (`avisos.Wrapper` + `avisos.emitirAviso`): o teste
 *      emite o aviso que o servidor real mandaria pelo SSE.
 *   3. Duas `renderHook(useAtendimentoServidor)` com `storage` (um `storageFalso()` por aba), `idDaAba` e
 *      `raizDeFoco` injetados; o `fetch` global é o `fetchFalso` do servidor (`vi.stubGlobal`) e o `supabaseClient`
 *      é o `supabaseFalso()`; `setOrgId(ORG_ID)` antes de montar.
 *   4. `waitFor(..., { timeout: 3000 })` para a aba que relê (debounce do aviso + debounce da fila).
 *   5. Pendência de envio e consulta encerrada (F7), só com `estado`:
 *      - PUT /atendimentos/{id}/pendencia (cabeçalho `X-Aba-Id`, corpo `{ pendente, seq }`) guarda
 *        `estado.pendencias[abaId] = true|false` e `estado.seqPendencias[abaId]` (seq menor ou igual ao já guardado é
 *        ignorado, 204 do mesmo jeito); cada chamada é registrada em `estado.chamadasPendencia`;
 *      - POST /atendimentos/{id}/encerrar com `X-Aba-Id`: se OUTRA aba tem `estado.pendencias[outra] === true`,
 *        409 `{ error: 'ENVIO_PENDENTE_OUTRA_ABA', message: 'Há envios pendentes em outro aparelho', status: 409 }`;
 *        senão 204 (sem mudar `estado.dto`: o teste decide o que o encerrar deixa);
 *      - com `estado.dto.status === 'encerrado'`, os PATCH de item e de avaliação-texto, o PUT de termos e o POST de
 *        assinatura (com `atendimentoId`) devolvem 409 na forma real do AtendimentoGuard:
 *        `{ error: 'Esta consulta já foi fechada.', status: 409 }`.
 *      Os handlers de `rotas` recebem também `ctx.headers` (nomes em minúsculas).
 * Sem `estado`, o comportamento é idêntico ao de antes (os testes do roteiro do encerrar não passam `estado`).
 */
import { vi } from 'vitest';

export const ORG_ID = '11111111-1111-4111-8111-111111111111';
export const ROLE_USER_ID = '22222222-2222-4222-8222-222222222222';

const PREFIXO_POR_TIPO = {
  PF: 'a0000000',
  AGENDA_NOVA: 'a1000000',
  MAPA: 'a2000000',
  FOTO: 'a3000000',
  ASSINATURA: 'a4000000',
  ANAMNESE: 'a5000000',
};

function json(status, corpo) {
  return new Response(corpo === undefined || status === 204 ? null : JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function caminhoDe(url) {
  const u = new URL(String(url), 'http://localhost');
  return { path: u.pathname, query: u.search };
}

async function base64De(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

/** Multipart vira `{ __multipart: { campo: texto | { __arquivo: { nome, tipo, base64 } } } }`: o replay reenvia os mesmos bytes. */
async function lerBody(init) {
  const b = init?.body;
  if (b == null) return null;
  if (typeof b === 'string') {
    try {
      return JSON.parse(b);
    } catch {
      return b;
    }
  }
  if (typeof FormData !== 'undefined' && b instanceof FormData) {
    const obj = {};
    for (const [k, v] of b.entries()) {
      obj[k] = typeof v === 'string'
        ? v
        : { __arquivo: { nome: v?.name || 'blob', tipo: v?.type || '', base64: await base64De(v) } };
    }
    return { __multipart: obj };
  }
  return '<corpo-binário>';
}

/**
 * Storage em memória com a cara do `sessionStorage` (um por "aba" nos testes de duas abas).
 * @returns {Storage}
 */
export function storageFalso() {
  const mapa = new Map();
  return {
    get length() {
      return mapa.size;
    },
    key: (i) => Array.from(mapa.keys())[i] ?? null,
    getItem: (k) => (mapa.has(String(k)) ? mapa.get(String(k)) : null),
    setItem: (k, v) => {
      mapa.set(String(k), String(v));
    },
    removeItem: (k) => {
      mapa.delete(String(k));
    },
    clear: () => mapa.clear(),
  };
}

/** Instante-base das versões das fotos do molde de duas abas (15/10/2026 12:30:00.000 UTC). */
const BASE_VERSAO_MS = Date.UTC(2026, 9, 15, 12, 30, 0, 0);

/**
 * `AtendimentoFotoDTO.arquivoAtualizadoEm` (ISO UTC com ms) derivado da versão inteira da foto no `estado.fotos`:
 * a versão N vira base + N s + N ms (ex.: versão 2 → "2026-10-15T12:30:02.002Z").
 */
export function arquivoAtualizadoEmDaVersao(versao) {
  const n = Number(versao ?? 1);
  return new Date(BASE_VERSAO_MS + n * 1000 + n).toISOString();
}

/** Id do preenchimento da anamnese que o servidor falso cria na 1ª queixa/expectativa não vazia (F4). */
export const PREENCHIMENTO_ANAMNESE_FALSO_ID = '00000000-0000-0000-0000-0000000000a1';
const CAMPOS_AVALIACAO_FALSO = ['queixa', 'expectativas', 'observacoesAvaliacao'];

/** Rotas que leem e escrevem no `estado` compartilhado (molde de duas abas). Só entram quando `estado` é passado. */
function rotasComEstado(estado) {
  const itemDoCaminho = (path) => decodeURIComponent(path.split('/')[6] || '');
  const fotoDoCaminho = (path) => decodeURIComponent(path.split('/')[6] || '');
  const urlDaFoto = (pacienteId, fotoId) =>
    `/api/v1/pacientes/${pacienteId}/galeria/${fotoId}/arquivo?v=${estado.fotos[fotoId] ?? 1}`;
  /** O detalhe devolve `fotos[].arquivoAtualizadoEm` pela versão que o estado guarda (foto sem versão fica como está). */
  const detalhe = () => {
    if (!estado.dto) return { status: 404, corpo: {} };
    // Termos da consulta: o detalhe sempre traz `termos` (lista, nunca nulo).
    const comTermos = Array.isArray(estado.dto.termos) ? estado.dto : { ...estado.dto, termos: [] };
    if (!Array.isArray(estado.dto.fotos)) return comTermos;
    return {
      ...comTermos,
      fotos: estado.dto.fotos.map((f) => (f?.id != null && estado.fotos[f.id] != null
        ? { ...f, arquivoAtualizadoEm: arquivoAtualizadoEmDaVersao(estado.fotos[f.id]) }
        : f)),
    };
  };
  /** AtendimentoGuard: consulta encerrada recusa escrita com 409 e o texto no campo `error` (sem código). */
  const fechada = () => (estado.dto?.status === 'encerrado'
    ? { status: 409, corpo: { error: 'Esta consulta já foi fechada.', status: 409 } }
    : null);
  estado.pendencias = estado.pendencias || {};
  estado.seqPendencias = estado.seqPendencias || {};
  estado.chamadasPendencia = estado.chamadasPendencia || [];
  return [
    ['GET', /^\/api\/v1\/atendimentos\/[^/]+$/, detalhe],
    ['PUT', /^\/api\/v1\/atendimentos\/[^/]+\/pendencia$/, ({ body, headers }) => {
      const abaId = headers['x-aba-id'];
      const corpo = body && typeof body === 'object' ? body : {};
      estado.chamadasPendencia.push({ abaId, pendente: corpo.pendente, seq: corpo.seq });
      if (!abaId) return { status: 400, corpo: { error: 'X-Aba-Id obrigatório', status: 400 } };
      if (fechada()) return fechada();
      if (Number(corpo.seq) > Number(estado.seqPendencias[abaId] ?? -1)) {
        estado.seqPendencias[abaId] = Number(corpo.seq);
        estado.pendencias[abaId] = corpo.pendente === true;
      }
      return { status: 204, corpo: null };
    }],
    ['POST', /^\/api\/v1\/atendimentos\/[^/]+\/encerrar$/, ({ headers }) => {
      const abaId = headers['x-aba-id'];
      const outraComPendencia = Object.entries(estado.pendencias).some(([id, v]) => id !== abaId && v === true);
      if (outraComPendencia) {
        return {
          status: 409,
          corpo: { error: 'ENVIO_PENDENTE_OUTRA_ABA', message: 'Há envios pendentes em outro aparelho', status: 409 },
        };
      }
      return { status: 204, corpo: null };
    }],
    ['PATCH', /^\/api\/v1\/atendimentos\/[^/]+\/itens\/[^/]+$/, ({ path, body }) => {
      if (fechada()) return fechada();
      const itemId = itemDoCaminho(path);
      const itens = Array.isArray(estado.dto?.itens) ? estado.dto.itens : [];
      const indice = itens.findIndex((i) => String(i.id) === itemId);
      if (indice < 0) return { status: 404, corpo: {} };
      const atualizado = { ...itens[indice], ...(body && typeof body === 'object' ? body : {}) };
      estado.dto = { ...estado.dto, itens: itens.map((i, k) => (k === indice ? atualizado : i)) };
      return atualizado;
    }],
    ['PATCH', /^\/api\/v1\/atendimentos\/[^/]+\/avaliacao-texto$/, ({ body }) => {
      if (fechada()) return fechada();
      if (!estado.dto) return { status: 404, corpo: {} };
      const corpo = body && typeof body === 'object' ? body : {};
      const novo = { ...estado.dto };
      for (const campo of CAMPOS_AVALIACAO_FALSO) {
        if (Object.hasOwn(corpo, campo)) novo[campo] = corpo[campo] === '' ? null : corpo[campo];
      }
      const temTexto = (v) => typeof v === 'string' && v.trim() !== '';
      if (!novo.preenchimentoAnamneseId && (temTexto(novo.queixa) || temTexto(novo.expectativas))) {
        novo.preenchimentoAnamneseId = PREENCHIMENTO_ANAMNESE_FALSO_ID;
      }
      estado.dto = novo;
      return estado.dto;
    }],
    ['PATCH', /^\/api\/v1\/atendimentos\/[^/]+\/modulo$/, ({ body }) => {
      if (!estado.dto) return { status: 404, corpo: {} };
      estado.dto = { ...estado.dto, modulo: body?.modulo ?? estado.dto.modulo };
      return estado.dto;
    }],
    ['PUT', /^\/api\/v1\/atendimentos\/[^/]+\/fotos\/[^/]+\/arquivo$/, ({ path }) => {
      const fotoId = fotoDoCaminho(path);
      estado.fotos[fotoId] = (estado.fotos[fotoId] ?? 1) + 1;
      return { id: fotoId, versao: estado.fotos[fotoId], arquivoAtualizadoEm: arquivoAtualizadoEmDaVersao(estado.fotos[fotoId]) };
    }],
    ['PUT', /^\/api\/v1\/atendimentos\/[^/]+\/termos$/, ({ body }) => {
      if (fechada()) return fechada();
      if (!estado.dto) return { status: 404, corpo: {} };
      const corpo = body && typeof body === 'object' ? body : {};
      const selecionado = corpo.termoSelecionadoId ?? null;
      const finais = [];
      for (const id of [...(Array.isArray(corpo.termosPendentesIds) ? corpo.termosPendentesIds : []), selecionado]) {
        if (id != null && !finais.includes(id)) finais.push(id);
      }
      const antigas = Array.isArray(estado.dto.termos) ? estado.dto.termos : [];
      const termos = finais.map((termoId, ordem) => {
        const antiga = antigas.find((t) => t.termoId === termoId);
        const ehSelecionado = termoId === selecionado;
        return {
          termoId,
          ordem,
          // `lido_em` só nasce com `termoLido` no selecionado e nunca é desmarcado.
          lido: Boolean(antiga?.lido) || (ehSelecionado && Boolean(corpo.termoLido)),
          lidoEm: antiga?.lidoEm ?? (ehSelecionado && corpo.termoLido ? new Date().toISOString() : null),
          escolhido: ehSelecionado,
          termoAssinaturaId: antiga?.termoAssinaturaId ?? null,
          statusAssinatura: antiga?.statusAssinatura ?? null,
        };
      });
      estado.dto = { ...estado.dto, termos };
      return detalhe();
    }],
    ['POST', /^\/api\/v1\/termos\/assinaturas$/, ({ body, gerar }) => {
      const corpo = body && typeof body === 'object' ? body : {};
      const novaPadrao = () => ({ id: gerar('ASSINATURA'), ...corpo });
      if (corpo.atendimentoId && fechada()) return fechada();
      if (!corpo.atendimentoId || !estado.dto) return novaPadrao();
      // Idempotente por (consulta, termo): 200 com a existente, 201 com a nova.
      estado.assinaturas = estado.assinaturas || {};
      const chave = `${corpo.atendimentoId}:${corpo.termoId}`;
      const existente = estado.assinaturas[chave];
      if (existente) return { status: 200, corpo: { ...existente, jaExistia: true } };
      const criada = { ...novaPadrao(), statusCodigo: corpo.statusCodigo ?? 'PENDENTE' };
      estado.assinaturas[chave] = criada;
      const linhas = Array.isArray(estado.dto.termos) ? estado.dto.termos : [];
      estado.dto = {
        ...estado.dto,
        termos: linhas.map((t) => (t.termoId === corpo.termoId
          ? { ...t, termoAssinaturaId: criada.id, statusAssinatura: criada.statusCodigo }
          : t)),
      };
      return { status: 201, corpo: criada };
    }],
    ['DELETE', /^\/api\/v1\/atendimentos\/[^/]+\/fotos\/[^/]+$/, ({ path }) => {
      delete estado.fotos[fotoDoCaminho(path)];
      return { status: 204, corpo: null };
    }],
    ['GET', /^\/api\/v1\/pacientes\/[^/]+\/galeria$/, ({ path }) => {
      const pacienteId = path.split('/')[4];
      return { fotos: Object.keys(estado.fotos).map((id) => ({ id, url: urlDaFoto(pacienteId, id) })) };
    }],
    ['DELETE', /^\/api\/v1\/pacientes\/[^/]+\/galeria\/[^/]+$/, ({ path }) => {
      delete estado.fotos[fotoDoCaminho(path)];
      return { status: 204, corpo: null };
    }],
  ];
}

/**
 * @param {{
 *   permissoes: string[],
 *   rotas?: Array<[string, RegExp, (ctx) => any]>,
 *   estado?: { dto?: object | null, fotos?: Record<string, number> },
 * }} opcoes
 *   `rotas`: respostas do cenário, testadas antes das padrão. O handler devolve
 *   `{ status, corpo }` ou só o corpo (status 200). `ctx.gerar(tipo)` cria um id marcado.
 *   `estado`: estado compartilhado do molde de duas abas (ver o topo do arquivo); sem ele, nada muda.
 */
export function criarServidorEncerrarFalso({ permissoes, rotas = [], estado = null }) {
  if (estado) {
    if (!('dto' in estado)) estado.dto = null;
    if (!estado.fotos || typeof estado.fotos !== 'object') estado.fotos = {};
  }
  const escritas = [];
  const leituras = [];
  /** Escritas da consulta no servidor (Fatia 2): ficam fora do roteiro do encerrar de hoje. */
  const escritasConsulta = [];
  let consulta = null;
  let seqConsulta = 0;
  const idConsulta = () => {
    seqConsulta += 1;
    return `c0000000-0000-4000-8000-${String(seqConsulta).padStart(12, '0')}`;
  };
  let seqFotoConsulta = 0;
  const idFotoConsulta = () => {
    seqFotoConsulta += 1;
    return `f0000000-0000-4000-8000-${String(seqFotoConsulta).padStart(12, '0')}`;
  };
  /** uuid gerado → marcador */
  const marcadores = new Map();
  const contagem = {};

  const gerar = (tipo) => {
    contagem[tipo] = (contagem[tipo] || 0) + 1;
    const n = contagem[tipo];
    const id = `${PREFIXO_POR_TIPO[tipo]}-0000-4000-8000-${String(n).padStart(12, '0')}`;
    marcadores.set(id, `${tipo}_${n}`);
    return id;
  };

  const me = {
    id: 'usr-1',
    nomeCompleto: 'Beatriz Lima',
    email: 'beatriz@teste.com',
    organizacaoId: ORG_ID,
    roleUserId: ROLE_USER_ID,
    perfilAcessoCodigo: 'DONO',
    permissoes,
    apareceNaAgenda: true,
    fusoHorario: 'America/Sao_Paulo',
    accessToken: 'token-teste',
  };

  const rotasConsulta = [
    ['POST', /^\/api\/v1\/atendimentos$/, ({ body }) => {
      consulta = {
        id: idConsulta(),
        pacienteId: body?.pacienteId ?? null,
        anfitriaoRoleUserId: ROLE_USER_ID,
        status: 'aberto',
        modulo: body?.modulo || 'hub',
        tipoProcedimentoCodigo: body?.tipoProcedimentoCodigo ?? null,
        procedimentoFeitoOrigemId: body?.procedimentoFeitoOrigemId ?? null,
        agendaPrincipalId: body?.agendaClicadaId ?? null,
        iniciadoEm: null,
        itens: [],
        fotos: [],
        consultaAnteriorFechada: null,
        fechadaPor: null,
      };
      if (estado) estado.dto = consulta;
      return consulta;
    }],
    ['GET', /^\/api\/v1\/atendimentos\/minhas$/, () => []],
    ['GET', /^\/api\/v1\/atendimentos\/[^/]+$/, () => consulta ?? { status: 404, corpo: {} }],
    ['POST', /^\/api\/v1\/atendimentos\/[^/]+\/itens$/, ({ body }) => ({ id: idConsulta(), ...body })],
    ['PUT', /^\/api\/v1\/atendimentos\/[^/]+\/itens\/plano$/, () => consulta],
    ['POST', /^\/api\/v1\/atendimentos\//, () => ({ status: 204, corpo: null })],
    ['PATCH', /^\/api\/v1\/atendimentos\//, () => ({})],
    ['PUT', /^\/api\/v1\/atendimentos\//, () => ({ status: 204, corpo: null })],
    ['DELETE', /^\/api\/v1\/atendimentos\//, () => ({ status: 204, corpo: null })],
  ];

  const padrao = [
    ['GET', /^\/api\/auth\/me$/, () => me],
    ['GET', /^\/api\/v1\/organizacoes\/minhas$/, () => [{ id: ORG_ID, nome: 'Clínica Teste', slug: 'clinica-teste' }]],
    ['GET', /^\/api\/v1\/clinica$/, () => ({ nome: 'Clínica Teste', cnpj: '00000000000191', telefone: '1133330000' })],
    ['GET', /^\/api\/v1\/notificacoes\/count-nao-lidas$/, () => ({ count: 0 })],
    ['POST', /^\/api\/v1\/procedimentos\/iniciar$/, ({ body }) => ({ id: gerar('PF'), statusCodigo: 'em_andamento', ...body })],
    ['POST', /^\/api\/v1\/procedimentos\/paciente\/[^/]+\/manual$/, ({ body }) => ({ id: gerar('PF'), statusCodigo: 'em_andamento', ...body })],
    ['POST', /^\/api\/v1\/procedimentos$/, ({ body }) => ({ id: gerar('PF'), ...body })],
    ['PATCH', /^\/api\/v1\/procedimentos\/[^/]+\/finalizar$/, ({ path }) => ({
      id: path.split('/')[4],
      statusCodigo: 'finalizado',
      planejamentoConcluido: false,
    })],
    ['POST', /^\/api\/v1\/agendas$/, ({ body }) => ({ id: gerar('AGENDA_NOVA'), statusCodigo: 'pendente', ...body })],
    ['POST', /^\/api\/v1\/mapas$/, ({ body }) => ({ id: gerar('MAPA'), ...body })],
    ['POST', /^\/api\/v1\/pacientes\/[^/]+\/galeria$/, () => ({ id: gerar('FOTO') })],
    ['POST', /^\/api\/v1\/termos\/assinaturas$/, ({ body }) => ({ id: gerar('ASSINATURA'), ...body })],
    ['POST', /anamnese/i, ({ body }) => ({ id: gerar('ANAMNESE'), ...(body && typeof body === 'object' ? body : {}) })],
  ];

  const fetchFalso = vi.fn(async (url, init = {}) => {
    const method = String(init.method || 'GET').toUpperCase();
    const { path, query } = caminhoDe(url);
    const body = await lerBody(init);
    const headers = {};
    for (const [k, v] of Object.entries(init.headers || {})) headers[String(k).toLowerCase()] = v;
    const ctx = { method, path, query, body, gerar, headers };

    // C3: a foto enviada na hora pela consulta não entra no roteiro do encerrar de hoje nem consome os marcadores.
    const fotoDaConsulta = method === 'POST' && /^\/api\/v1\/pacientes\/[^/]+\/galeria$/.test(path)
      && Boolean(body?.__multipart?.atendimentoId);
    let resposta = fotoDaConsulta
      ? { status: 200, corpo: { id: idFotoConsulta(), atendimentoId: body.__multipart.atendimentoId } }
      : null;
    const comEstado = estado ? rotasComEstado(estado) : [];
    for (const [m, re, handler] of fotoDaConsulta ? [] : [...rotas, ...comEstado, ...rotasConsulta, ...padrao]) {
      if (m !== method || !re.test(path)) continue;
      // O handler pode ser assíncrono (ex.: um PUT que o teste segura até liberar).
      const r = await handler(ctx);
      resposta = r && typeof r === 'object' && 'status' in r && 'corpo' in r ? r : { status: 200, corpo: r };
      break;
    }
    // Molde de duas abas: toda foto que nasce no POST da galeria ganha a versão 1 no estado compartilhado.
    if (estado && method === 'POST' && /^\/api\/v1\/pacientes\/[^/]+\/galeria$/.test(path) && resposta?.corpo?.id) {
      estado.fotos[resposta.corpo.id] = 1;
    }
    if (!resposta) {
      if (method === 'GET') resposta = { status: 200, corpo: [] };
      else if (method === 'DELETE') resposta = { status: 204, corpo: null };
      else resposta = { status: 200, corpo: {} };
    }

    if (method === 'GET') {
      leituras.push({ method, path: path + query });
    } else if (path.startsWith('/api/v1/atendimentos') || fotoDaConsulta) {
      escritasConsulta.push({ method, path: path + query, body, status: resposta.status });
    } else {
      const idResposta = resposta.corpo && typeof resposta.corpo === 'object' ? resposta.corpo.id : null;
      escritas.push({
        method,
        path: path + query,
        body: semVinculoDaConsulta(path, body),
        status: resposta.status,
        ...(idResposta && marcadores.has(idResposta) ? { captura: marcadores.get(idResposta) } : {}),
      });
    }
    return json(resposta.status, resposta.corpo);
  });

  return { fetchFalso, escritas, escritasConsulta, leituras, me, marcadores };
}

/**
 * O `atendimentoId` da assinatura (Fatia 2) aponta para a consulta do servidor falso, que o replay não cria;
 * o roteiro do encerrar de hoje fica sem ele.
 */
function semVinculoDaConsulta(path, body) {
  if (!/^\/api\/v1\/termos\/assinaturas$/.test(path) || !body || typeof body !== 'object' || !('atendimentoId' in body)) {
    return body;
  }
  const { atendimentoId: _atendimentoId, ...resto } = body;
  return resto;
}

/** Sessão do Supabase simulada (o app só lê `getSession` e assina `onAuthStateChange`). */
export function supabaseFalso() {
  const session = { access_token: 'token-teste', user: { id: 'usr-1', email: 'beatriz@teste.com' } };
  return {
    supabase: {
      auth: {
        getSession: async () => ({ data: { session } }),
        refreshSession: async () => ({ data: { session }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        signOut: async () => ({ error: null }),
        signInWithPassword: async () => ({ data: { session }, error: null }),
      },
    },
  };
}
