import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { atendimentosApi, termoAssinaturaApi } from '../../services/api';
import { AvisosContext } from '../../contexts/avisosContext.js';
import { useAviso } from '../../contexts/useAviso.js';
import { idDaAba as idDaAbaDoCanal } from '../../services/avisos/canalAvisos.js';
import { PREFIXO_AVISO } from '../../services/avisos/tiposAviso.js';
import {
  consultaEncerradaPor409,
  contarFilaGuardada,
  criarFilaConsulta,
  lerFilaGuardada,
  removerFilaGuardada,
  temFilaGuardada,
} from '../consulta/filaConsulta.js';
import {
  baseDosItens,
  CAMPOS_AVALIACAO,
  CHAVE_AVALIACAO,
  camposDoItemServidor,
  camposDaLinhaSessao,
  consultaFechada,
  diferencasDosItens,
  mapearItensDaSessao,
  mesmasOrientacoes,
  mesmoProcedimento,
  mesclarAvaliacao,
  mesclarSessao,
  textosDaAvaliacao,
} from '../consulta/consultaServidor.js';

const DEBOUNCE_TEXTO_MS = 700;
/**
 * F6a: esperas (ms) entre as novas tentativas da releitura da consulta quando a rede cai ou o servidor responde 5xx.
 * A partir da 6ª tentativa a espera fica na última (30 s). 403/404 não tentam de novo.
 */
export const ESPERAS_RELEITURA_MS = [1000, 2000, 5000, 10000, 30000];
/** Termos da consulta: são cliques (não digitação), o último estado vence. */
const DEBOUNCE_TERMOS_MS = 300;
const CONSULTA_NAO_ENCONTRADA = 'Consulta não encontrada no servidor. Recarregue a página.';
export const CODIGO_ENVIO_PENDENTE = 'ENVIO_PENDENTE';
export const MENSAGEM_ENVIO_PENDENTE =
  'Há alterações que ainda não chegaram ao servidor. Verifique a conexão e tente encerrar de novo.';

/** Padrões da aba real (os testes de duas abas injetam um por aba). */
const STORAGE_DA_ABA = typeof sessionStorage !== 'undefined' ? sessionStorage : null;
const RAIZ_DE_FOCO_DA_ABA = typeof document !== 'undefined' ? document : null;
/** Id desta aba (UUID por carga da página, o mesmo que o stream de avisos envia em `X-Aba-Id`). */
const ID_DA_ABA_PADRAO = idDaAbaDoCanal;

/** F7: o servidor recusou o encerrar porque outra aba da mesma pessoa tem envios por sair. */
export const CODIGO_ENVIO_PENDENTE_OUTRA_ABA = 'ENVIO_PENDENTE_OUTRA_ABA';
/** F7: `encerrarAguardandoOutraAba` cancelada (trocou/esqueceu a consulta, desmontou ou `cancelarEsperaOutraAba`). */
export const CODIGO_ESPERA_CANCELADA = 'ESPERA_CANCELADA';
/** F7: quanto esperar a mensagem `pendencia-liberada` antes de tentar o encerrar de novo. */
export const ESPERA_OUTRA_ABA_MS = 10000;
const MENSAGEM_AVISO_OUTRA_ABA = 'Há envios pendentes em outro aparelho';
/** F6b: ao sair do campo só focado (sem mexer), o remoto em espera venceu. */
const MENSAGEM_ALTERADO_OUTRO_APARELHO = 'Alterado em outro aparelho';
/** F2: ao sair do campo em que a pessoa mexeu, o local venceu o remoto em espera (PATCH do local saiu). */
const MENSAGEM_SOBRESCREVEU_OUTRO_APARELHO = 'Sua alteração sobrescreveu a de outro aparelho';
const MENSAGEM_NAO_ENTROU_ALTERACAO = 'Sua alteração não foi salva: a consulta foi atualizada. Confira e digite novamente.';
const MENSAGEM_NAO_SALVOU_ALTERACAO ='Não foi possível salvar sua alteração. O texto continua na tela, mas o servidor guardou a versão do outro aparelho.';

/** F7: prefixo da guarda, por pessoa e consulta, das alterações que o servidor recusou por consulta encerrada. */
const PREFIXO_NAO_ENTRARAM = 'procedi_consulta_naoentraram_';
const chaveNaoEntraram = (userId, atendimentoId) => `${PREFIXO_NAO_ENTRARAM}${userId}_${atendimentoId}`;

/** F7: tipos de entrada que a pessoa digitou/escolheu e que vão para "não entraram" (`modulo` é navegação). */
const TIPOS_QUE_NAO_ENTRAM = new Set(['item', 'itemNovo', 'avaliacao', 'termos', 'assinatura']);

/** F7: `seq` da declaração de pendência: crescente em toda a aba (relógio * 1000 + desempate). */
let ultimoSeqPendencia = 0;
function proximoSeqPendencia() {
  ultimoSeqPendencia = Math.max(ultimoSeqPendencia + 1, Date.now() * 1000);
  return ultimoSeqPendencia;
}

function lerNaoEntraram(storage, chave) {
  try {
    const lista = JSON.parse(storage?.getItem(chave) ?? '[]');
    return Array.isArray(lista)
      ? lista.filter((e) => e && typeof e.chave === 'string' && typeof e.rotulo === 'string')
      : [];
  } catch {
    return [];
  }
}

/** Texto digitado por tipo de entrada (o que a pessoa quer copiar). */
function textoDaEntrada(entrada) {
  const d = entrada.dados ?? {};
  switch (entrada.tipo) {
    case 'item':
    case 'itemNovo': {
      const c = entrada.tipo === 'itemNovo' ? d.corpo ?? {} : d.campos ?? {};
      if (Array.isArray(c.orientacoes)) {
        return c.orientacoes.map((o) => `${o?.checado ? '[x]' : '[ ]'} ${o?.descricao ?? ''}`.trim()).join('\n');
      }
      if (c.observacaoExecucao != null) return String(c.observacaoExecucao);
      return String(c.nomeLivre ?? '');
    }
    case 'avaliacao':
      return String(Object.values(d)[0] ?? '');
    case 'termos': {
      const n = (Array.isArray(d.termosPendentesIds) ? d.termosPendentesIds.length : 0)
        + (d.termoSelecionadoId != null ? 1 : 0);
      return `${n} termo(s) escolhido(s)`;
    }
    default:
      return '';
  }
}

/**
 * A consulta no servidor (Fatia 2, Etapa 1): consulta atual, lista "minhas" (atalho V1), hidratação do aparelho
 * (C2) e espelho do que a pessoa muda para as rotas (D4), pela fila. Avisos ATENDIMENTO disparam uma rebusca
 * (R8) que nunca sobrescreve campo com envio pendente (`pendente(chave)`, ponto único da proteção; a F6b soma o
 * foco). Orientações por item (F5b): `orient` de cada linha de `procedimentosSessao` vai no PATCH do item
 * (`item:{id}:orient`, lista inteira; caixa marcada sem espera, texto com debounce) e volta pela mescla; o encerrar
 * não leva `orientacoes` no corpo.
 *
 * Uma fila por consulta, guardada por pessoa (`userId`). Depois de `minhas` carregar, a fila guardada de cada
 * consulta aberta desta pessoa volta em segundo plano (F5, saída e novo login), sem entrar na consulta: só saem
 * `modulo` e `item`; `itemNovo` espera a pessoa entrar (sem a sessão hidratada o POST poderia duplicar um item).
 * Ao entrar, a tela usa a mesma fila (nada sai duas vezes).
 *
 * Onda 0 (molde de duas abas): `storage`, `idDaAba` e `raizDeFoco` são injetáveis, com padrão igual ao da aba
 * real. `storage` vai para a fila e para as leituras do guardado (um storage por aba nos testes). `idDaAba()` é um
 * placeholder que devolve `null` até o canal entregar o id real (F7). `raizDeFoco` (padrão `document`) só fica
 * guardada: a proteção por foco (F6b) vai usá-la.
 *
 * Textos da avaliação (F4, opção `avaliacao`): queixa, expectativas e observações vão ao servidor só ao sair do campo
 * (`onCampoAvaliacaoBlur(campo)`, sem espera; nunca por tecla), uma entrada da fila por campo
 * (`avaliacao:queixa|expectativas|observacoes`, tipo `avaliacao`) e o PATCH leva só aquele campo. A hidratação e a
 * releitura aplicam o texto do servidor pela `mesclarAvaliacao` (campo com envio pendente fica; campo que o servidor
 * não mudou desde a última base também fica, para não apagar o que a pessoa digita antes de sair do campo).
 * `preenchimentoAnamneseId` vem do detalhe (o servidor cria o preenchimento da anamnese uma vez).
 *
 * Pendência (F7): a fila de cada consulta declara ao servidor, na virada vazio/com pendência
 * (`aoMudarPendencia`), `PUT /atendimentos/{id}/pendencia` com `X-Aba-Id` e `seq` crescente; rede/5xx retentam em
 * `esperasReleituraMs` (só a última declaração por consulta vale; 409/403/404 param). A cada `conectado` do canal
 * (AvisosContext) a pendência é redeclarada. `encerrarAguardandoOutraAba` espera `pendencia-liberada` (ou
 * `esperaOutraAbaMs`) e tenta o encerrar de novo quando outra aba da pessoa ainda tem envios.
 *
 * Alterações que não entraram (F7): 409 de consulta encerrada em envio de item/avaliação/termos/assinatura não
 * descarta calado; vai para `alteracoesNaoEntraram` (memória + sessionStorage, por pessoa e consulta). O mesmo vale
 * quando a consulta é encerrada por outro aparelho com envio ainda pendente aqui (`tratarFechada`, status
 * 'encerrado', exceto se foi esta aba que encerrou). `alteracoesNaoEntraram` não depende da consulta acompanhada:
 * continua exposto depois de `esquecer` (a tela navega para Pacientes e ainda mostra o aviso).
 *
 * Termos (Onda E): `termosDaConsulta` é o `termos[]` do detalhe (`[]` se nada). `salvarTermosConsulta({
 * termoSelecionadoId, termoLido, termosPendentesIds })` atualiza a base na hora e enfileira 1 PUT (chave única
 * `termos`, tipo `termos`, 300 ms; o último vence); a resposta (detalhe) volta para `termosDaConsulta`. A releitura
 * só aplica `termos` se não há `pendente('termos')`. `enviarAssinaturaPelaFila(corpo)` põe o POST da assinatura na
 * fila (`assinatura:{termoId}`, 200 e 201 são sucesso). `esperarFilaAvaliacao()` espera o fim dos envios
 * `avaliacao:*` e devolve `{ ok, preenchimentoAnamneseId }` lido da base mais recente (sem depender do render).
 *
 * @param {{
 *   habilitado: boolean,
 *   orgId: string | null,
 *   userId: string | null,
 *   emConsulta: boolean,
 *   pacienteId: string | null,
 *   procedimentosSessao: object[],
 *   aparelho: { setProcedimentosSessao: Function },
 *   onCanceladaPorOutra?: (info: { pacienteNome: string, profissionalNome: string }) => void,
 *   onEncerradaEmOutroAparelho?: (info: { pacienteId: string | null, pacienteCpf: string }) => void,
 *   onAbandonada?: (info: { pendentes: number, descartarPendentes: () => void }) => void,
 *   storage?: Storage | null,
 *   idDaAba?: () => string | null,
 *   raizDeFoco?: Document | HTMLElement | null,
 *   esperasReleituraMs?: number[],
 *   esperaOutraAbaMs?: number,
 *   avaliacao?: {
 *     valores: { queixa: string, expectativas: string, observacoesAvaliacao: string },
 *     aplicar: (valoresNovos: { queixa: string, expectativas: string, observacoesAvaliacao: string }) => void,
 *   } | null,
 * }} opcoes
 */
export function useAtendimentoServidor({
  habilitado,
  orgId,
  userId,
  emConsulta,
  pacienteId,
  procedimentosSessao,
  aparelho,
  onCanceladaPorOutra,
  onEncerradaEmOutroAparelho,
  onAbandonada,
  storage = STORAGE_DA_ABA,
  idDaAba = ID_DA_ABA_PADRAO,
  raizDeFoco = RAIZ_DE_FOCO_DA_ABA,
  esperasReleituraMs = ESPERAS_RELEITURA_MS,
  avaliacao = null,
  avisar = null,
  esperaOutraAbaMs = ESPERA_OUTRA_ABA_MS,
}) {
  const [atual, setAtual] = useState(null);
  const [minhas, setMinhas] = useState([]);
  const [minhasCarregadas, setMinhasCarregadas] = useState(false);
  const [versaoBase, setVersaoBase] = useState(0);
  const [pedidoHidratacao, setPedidoHidratacao] = useState(0);
  const atualId = atual?.id ?? null;
  /** Termos da consulta (linhas do detalhe); a base do espelho de termos. */
  const [termosDaConsulta, setTermosDaConsulta] = useState([]);
  const termosRef = useRef([]);
  /** Resposta das assinaturas enviadas pela fila, por chave (`assinatura:{termoId}`). */
  const assinaturasRef = useRef(new Map());
  /** Último erro do POST da assinatura por chave (rede, 5xx ou 4xx): alimenta `status`/`erro` do envelope. */
  const assinaturasErroRef = useRef(new Map());

  const atualRef = useRef(null);
  /** Fila da consulta acompanhada (a mesma instância que está em `filasRef`). */
  const filaRef = useRef(null);
  /** Uma fila por consulta (atendimentoId → fila), em segundo plano ou da consulta acompanhada. */
  const filasRef = useRef(new Map());
  const userIdRef = useRef(userId ?? null);
  userIdRef.current = userId ?? null;
  const hidratadoRef = useRef(null);
  const pacienteHidratadoRef = useRef(null);
  const suspensoRef = useRef(false);
  const baseItensRef = useRef(new Map());
  const valoresRef = useRef({ procedimentosSessao });
  const aparelhoRef = useRef(aparelho);
  const onCanceladaRef = useRef(onCanceladaPorOutra);
  const onEncerradaRef = useRef(onEncerradaEmOutroAparelho);
  const onAbandonadaRef = useRef(onAbandonada);
  /** ND18: consultas cujo encerrar foi pedido por este aparelho; o aviso ENCERRADO delas não faz a tela sair de novo. */
  const encerradasAquiRef = useRef(new Set());
  const avisosCtx = useContext(AvisosContext);
  /** F7: declaração de pendência por consulta: `{ desejado, ultima, token, timer, tentativas }`. */
  const pendenciasRef = useRef(new Map());
  /** F7: a espera em curso do `encerrarAguardandoOutraAba` (`{ id, cancelado, acordar }`). */
  const esperaRef = useRef(null);
  const [esperandoOutraAba, setEsperandoOutraAba] = useState(false);
  const esperaOutraAbaMsRef = useRef(esperaOutraAbaMs);
  esperaOutraAbaMsRef.current = esperaOutraAbaMs;
  /** F7: alterações recusadas por consulta encerrada: `atendimentoId -> Array<{ chave, tipo, rotulo, texto }>`. */
  const naoEntraramRef = useRef(new Map());
  const [consultaNaoEntraram, setConsultaNaoEntraram] = useState(null);
  const [versaoNaoEntraram, setVersaoNaoEntraram] = useState(0);
  /** Onda 0: dependências injetáveis da aba (storage da fila, id da aba e raiz de foco), sempre as da última renderização. */
  const abaRef = useRef({ storage, idDaAba, raizDeFoco });
  abaRef.current = { storage, idDaAba, raizDeFoco };
  /** F6a: esperas da nova tentativa da releitura (sempre as da última renderização). */
  const esperasRef = useRef(esperasReleituraMs);
  esperasRef.current = Array.isArray(esperasReleituraMs) && esperasReleituraMs.length > 0
    ? esperasReleituraMs
    : ESPERAS_RELEITURA_MS;
  /** F6a: a nova tentativa agendada da releitura (uma só por vez) e quantas já falharam em sequência. */
  const retentativaRef = useRef({ timer: null, tentativas: 0 });
  const cancelarRetentativa = useCallback(() => {
    const r = retentativaRef.current;
    if (r.timer != null) clearTimeout(r.timer);
    r.timer = null;
  }, []);
  /** F6b: `avisar(tipo, mensagem)` (ex.: `(t, m) => toast[t](m)`), sempre o da última renderização. */
  const avisarRef = useRef(avisar);
  avisarRef.current = avisar;
  /** F6b: chave (`data-campo-consulta`) do campo em foco, ou `null`. Com `pendente`, forma a regra única `protegido`. */
  const focoRef = useRef(null);
  /** F6b: o valor local do campo quando ele ganhou o foco (para saber se a pessoa mexeu nele). */
  const valorNoFocoRef = useRef(null);
  /** F6b: último valor remoto que chegou com o campo protegido: `{ [chave]: { valor } }` (o último vence). */
  const remotoEmEsperaRef = useRef({});
  /**
   * F2: entradas que a saída do campo enfileirou para o local vencer o remoto em espera: `chave -> { remoto }`.
   * O toast "sobrescreveu" só sai no 2xx desse PATCH; em 4xx definitivo a base volta ao `remoto` e sai erro.
   */
  const sobrescreveuRef = useRef(new Map());
  /**
   * F2: campo cujo PATCH foi recusado (4xx definitivo): `chave -> JSON dos campos recusados` (item) ou `true`
   * (avaliação). Protege o texto local da mescla e impede o espelho de reenviar o mesmo texto em loop.
   */
  const naoSalvoRef = useRef(new Map());
  // B4: campos que o servidor recusou com 404/410 e cuja releitura está em voo: o texto local fica protegido da mescla
  // até a marca "não salvo" entrar (a marca só entra DEPOIS da releitura).
  const emReleituraRef = useRef(new Set());
  /** F4: valores e setter dos textos da avaliação, sempre os da última renderização (`null` sem a opção). */
  const avaliacaoRef = useRef(avaliacao);
  avaliacaoRef.current = avaliacao;
  /** F4: textos da avaliação como o servidor os tem (última leitura ou envio aceito); `null` antes de hidratar. */
  const baseAvaliacaoRef = useRef(null);

  useEffect(() => {
    valoresRef.current = { procedimentosSessao };
  }, [procedimentosSessao]);
  useEffect(() => {
    aparelhoRef.current = aparelho;
  });
  useEffect(() => {
    onCanceladaRef.current = onCanceladaPorOutra;
  }, [onCanceladaPorOutra]);
  useEffect(() => {
    onEncerradaRef.current = onEncerradaEmOutroAparelho;
  }, [onEncerradaEmOutroAparelho]);
  useEffect(() => {
    onAbandonadaRef.current = onAbandonada;
  }, [onAbandonada]);

  const definirAtual = useCallback((dto) => {
    atualRef.current = dto;
    setAtual(dto);
  }, []);

  const aplicarTermos = useCallback((lista) => {
    const nova = Array.isArray(lista) ? lista : [];
    termosRef.current = nova;
    setTermosDaConsulta(nova);
  }, []);

  /** F7: cancela as novas tentativas da declaração de pendência da consulta `id` (sem PUT). */
  const cancelarPendencia = useCallback((id) => {
    const est = pendenciasRef.current.get(id);
    if (!est) return;
    if (est.timer != null) clearTimeout(est.timer);
    est.timer = null;
    est.token += 1;
  }, []);

  const pararFila = useCallback((id) => {
    cancelarPendencia(id);
    const fila = filasRef.current.get(id);
    if (!fila) return;
    fila.parar();
    filasRef.current.delete(id);
    if (filaRef.current === fila) filaRef.current = null;
  }, [cancelarPendencia]);

  const pararTodas = useCallback(() => {
    pendenciasRef.current.forEach((_, id) => cancelarPendencia(id));
    filasRef.current.forEach((fila) => fila.parar());
    filasRef.current = new Map();
    filaRef.current = null;
  }, [cancelarPendencia]);

  /** F7: acorda e cancela a espera do `encerrarAguardandoOutraAba` (rejeita com `ESPERA_CANCELADA`). */
  const cancelarEsperaOutraAba = useCallback(() => {
    const espera = esperaRef.current;
    if (!espera) return;
    espera.cancelado = true;
    espera.acordar?.();
  }, []);

  const esquecer = useCallback(() => {
    cancelarEsperaOutraAba();
    cancelarRetentativa();
    retentativaRef.current.tentativas = 0;
    if (atualRef.current?.id) pararFila(atualRef.current.id);
    filaRef.current = null;
    hidratadoRef.current = null;
    baseItensRef.current = new Map();
    baseAvaliacaoRef.current = null;
    sobrescreveuRef.current.clear();
    naoSalvoRef.current.clear();
    emReleituraRef.current.clear();
    aplicarTermos([]);
    definirAtual(null);
  }, [aplicarTermos, cancelarEsperaOutraAba, cancelarRetentativa, definirAtual, pararFila]);

  /** Clínica e pessoa donas do que está na tela; resposta de `minhas` de outro dono é descartada. */
  const donoRef = useRef({ orgId, userId: userId ?? null });

  const recarregarMinhas = useCallback(async () => {
    const dono = donoRef.current;
    try {
      const lista = await atendimentosApi.minhas();
      if (donoRef.current !== dono) return;
      setMinhas(Array.isArray(lista) ? lista : []);
    } catch (err) {
      console.warn('[consulta] Falha ao carregar minhas consultas:', err?.message || err);
    } finally {
      setMinhasCarregadas(true);
    }
  }, []);

  // Só a troca de clínica ou de pessoa (a saída limpa as duas) esquece a consulta da tela e para as filas: a fila
  // de quem saiu nunca é enviada com o acesso de outra pessoa. Este efeito também roda de novo com o mesmo dono
  // (sessão revalidada, hot update no dev) e a tela continua na consulta.
  useEffect(() => {
    const dono = donoRef.current;
    if (dono.orgId !== orgId || dono.userId !== (userId ?? null)) {
      donoRef.current = { orgId, userId: userId ?? null };
      esquecer();
      pararTodas();
      // F6b: só a troca real de dono zera a lista; com o mesmo dono ela é revalidada sem sumir (o atalho não pisca).
      setMinhas([]);
      setMinhasCarregadas(false);
    }
    if (!habilitado || !orgId) return;
    recarregarMinhas();
  }, [habilitado, orgId, userId, esquecer, pararTodas, recarregarMinhas]);

  useEffect(() => () => pararTodas(), [pararTodas]);
  // F7: ao desmontar, a espera do encerrar não segue (rejeita com `ESPERA_CANCELADA`).
  useEffect(() => () => cancelarEsperaOutraAba(), [cancelarEsperaOutraAba]);
  // F6a: ao desmontar, a nova tentativa pendente da releitura não dispara.
  useEffect(() => () => cancelarRetentativa(), [cancelarRetentativa]);

  /**
   * F7: declara ao servidor se esta aba tem envio pendente na consulta `id`. Só a última declaração por consulta
   * importa: uma nova cancela a nova tentativa da anterior. Rede/5xx retentam nas esperas de `esperasReleituraMs`;
   * 409 (consulta fechada), 403 e 404 param. É só um PUT, nunca dentro de transação.
   */
  const declararPendencia = useCallback((id, pendente) => {
    let est = pendenciasRef.current.get(id);
    if (!est) {
      est = { desejado: false, ultima: null, token: 0, timer: null, tentativas: 0 };
      pendenciasRef.current.set(id, est);
    }
    if (est.timer != null) clearTimeout(est.timer);
    est.timer = null;
    est.tentativas = 0;
    est.desejado = pendente === true;
    est.token += 1;
    const enviar = async () => {
      const meu = est.token;
      const valor = est.desejado;
      try {
        await atendimentosApi.pendencia?.(id, { pendente: valor, seq: proximoSeqPendencia() }, {
          abaId: abaRef.current.idDaAba?.() ?? null,
        });
        if (est.token === meu) est.ultima = valor;
      } catch (err) {
        if (est.token !== meu) return;
        const s = err?.status;
        if (s === 403 || s === 404 || s === 409) return;
        const esperas = esperasRef.current;
        const espera = esperas[Math.min(est.tentativas, esperas.length - 1)];
        est.tentativas += 1;
        est.timer = setTimeout(() => {
          est.timer = null;
          if (est.token === meu) enviar();
        }, espera);
      }
    };
    enviar();
  }, []);

  // F7: a cada conexão do canal a pendência é redeclarada (o servidor perdeu o que sabia da aba na queda).
  useEffect(() => {
    if (!avisosCtx) return undefined;
    return avisosCtx.assinar((msg) => {
      if (msg?.tipo === 'conectado') {
        filasRef.current.forEach((fila, id) => {
          if (fila.tamanho() > 0) {
            declararPendencia(id, true);
          } else if (pendenciasRef.current.get(id)?.ultima === true) {
            declararPendencia(id, false);
          }
        });
      } else if (msg?.tipo === 'pendencia-liberada') {
        const espera = esperaRef.current;
        if (espera && msg.atendimentoId != null && String(msg.atendimentoId) === String(espera.id)) espera.acordar?.();
      }
    });
  }, [avisosCtx, declararPendencia]);

  const pendente = useCallback((prefixo) => filaRef.current?.temPendente(prefixo) ?? false, []);
  /** F6b: regra única da mescla: o remoto não sobrescreve campo com envio pendente nem campo em foco. */
  const protegido = useCallback(
    (chave) => pendente(chave) || focoRef.current === chave || naoSalvoRef.current.has(chave)
      || emReleituraRef.current.has(chave),
    [pendente],
  );

  /** F6b: `item:<id>:<campo>` → `{ itemId, campo }`; `null` se a chave não é de item. */
  const partesDaChaveDeItem = useCallback((chave) => {
    const m = /^item:(.+):(obs|proc|orient)$/.exec(chave ?? '');
    return m ? { itemId: m[1], campo: m[2] } : null;
  }, []);
  /** F6b: o valor local de um campo de item (texto) para saber se a pessoa mexeu nele desde o foco. */
  const valorLocalDoItem = useCallback((itemId, campo, sessao, itens) => {
    const mapa = mapearItensDaSessao(sessao, itens);
    const idx = mapa.findIndex((id) => String(id) === String(itemId));
    if (idx < 0) return null;
    const c = camposDaLinhaSessao(sessao[idx]);
    if (campo === 'obs') return c.obs;
    if (campo === 'proc') return { cat: c.cat, nome: c.nome };
    return c.orient;
  }, []);
  /**
   * F6b: o item em foco (`obs`/`proc`/`orient`) que o servidor mudou desde a base anterior e que difere do aparelho:
   * guarda o remoto em espera e mantém a base antiga do campo (o espelho não reenvia o local como se fosse mudança).
   */
  const guardarRemotoDoItemEmFoco = useCallback((sessao, itens, baseAnterior) => {
    const partes = partesDaChaveDeItem(focoRef.current);
    if (!partes) return;
    const { itemId, campo } = partes;
    const novo = baseItensRef.current.get(itemId);
    const antigo = baseAnterior?.get(itemId);
    if (!novo || !antigo) return;
    const mudouNoServidor = campo === 'obs' ? novo.obs !== antigo.obs
      : campo === 'orient' ? !mesmasOrientacoes(novo.orient, antigo.orient)
        : !mesmoProcedimento(novo, antigo);
    if (!mudouNoServidor) return;
    const local = valorLocalDoItem(itemId, campo, sessao, itens);
    const remoto = campo === 'proc' ? { cat: novo.cat, nome: novo.nome } : novo[campo];
    // Remoto igual ao que o aparelho já tem: nada a esperar.
    const igualAoLocal = campo === 'obs' ? remoto === local
      : campo === 'orient' ? mesmasOrientacoes(remoto, local)
        : mesmoProcedimento(remoto, local ?? {});
    if (igualAoLocal) return;
    remotoEmEsperaRef.current[focoRef.current] = { valor: remoto };
    if (campo === 'obs') novo.obs = antigo.obs;
    else if (campo === 'orient') novo.orient = antigo.orient;
    else { novo.cat = antigo.cat; novo.nome = antigo.nome; }
  }, [partesDaChaveDeItem, valorLocalDoItem]);
  /** F6b: idem para a avaliação (a base do campo em foco só avança quando a pessoa sai dele). */
  const guardarRemotoDaAvaliacaoEmFoco = useCallback((baseAnterior, servidor) => {
    const campo = CAMPOS_AVALIACAO.find((c) => CHAVE_AVALIACAO[c] === focoRef.current);
    if (!campo || baseAnterior == null) return;
    if (baseAnterior[campo] === servidor[campo]) return;
    const local = String(avaliacaoRef.current?.valores?.[campo] ?? '');
    if (local.trim() === String(servidor[campo] ?? '').trim()) return;
    remotoEmEsperaRef.current[focoRef.current] = { valor: servidor[campo] };
    baseAvaliacaoRef.current = { ...baseAvaliacaoRef.current, [campo]: baseAnterior[campo] };
  }, []);

  /** Mescla não destrutiva do detalhe no aparelho e nova base do espelho. */
  const hidratar = useCallback((dto) => {
    const v = valoresRef.current;
    const ap = aparelhoRef.current;
    const sessao = mesclarSessao(v.procedimentosSessao, dto.itens, protegido);
    if (sessao.mudou) ap.setProcedimentosSessao(sessao.sessao);
    const baseItensAnterior = baseItensRef.current;
    baseItensRef.current = baseDosItens(dto.itens);
    guardarRemotoDoItemEmFoco(v.procedimentosSessao, dto.itens, baseItensAnterior);
    // F4: textos da avaliação. Campo que o servidor não mudou desde a base anterior fica como está no aparelho
    // (digitação ainda sem sair do campo não é apagada por uma releitura causada por outra mudança).
    const baseAnterior = baseAvaliacaoRef.current;
    const servidor = textosDaAvaliacao(dto);
    baseAvaliacaoRef.current = servidor;
    const av = avaliacaoRef.current;
    if (av && typeof av.aplicar === 'function') {
      const semMudancaNoServidor = (chave) => {
        const campo = CAMPOS_AVALIACAO.find((c) => CHAVE_AVALIACAO[c] === chave);
        return baseAnterior != null && campo != null && baseAnterior[campo] === servidor[campo];
      };
      const mescla = mesclarAvaliacao(av.valores, servidor, (chave) => protegido(chave) || semMudancaNoServidor(chave));
      if (mescla.mudou) {
        avaliacaoRef.current = { ...av, valores: mescla.valores };
        av.aplicar(mescla.valores);
      }
    }
    guardarRemotoDaAvaliacaoEmFoco(baseAnterior, servidor);
  }, [protegido, guardarRemotoDaAvaliacaoEmFoco, guardarRemotoDoItemEmFoco]);

  /** F7: grava (memória + storage) a lista de alterações que não entraram da consulta `id`. */
  const gravarNaoEntraram = useCallback((id, lista) => {
    naoEntraramRef.current.set(id, lista);
    const { storage: st } = abaRef.current;
    if (userIdRef.current && st) {
      try {
        if (lista.length === 0) st.removeItem(chaveNaoEntraram(userIdRef.current, id));
        else st.setItem(chaveNaoEntraram(userIdRef.current, id), JSON.stringify(lista));
      } catch {
        /* storage cheio ou indisponível: segue em memória */
      }
    }
    setVersaoNaoEntraram((n) => n + 1);
  }, []);

  /** F7: o rótulo humano da entrada (a sessão da tela ainda existe aqui; depois de encerrar ela pode não existir). */
  const rotuloDaEntrada = useCallback((id, entrada) => {
    const chave = entrada.chave;
    const aval = CAMPOS_AVALIACAO.find((c) => CHAVE_AVALIACAO[c] === chave);
    if (aval) {
      return { queixa: 'Queixa', expectativas: 'Expectativas', observacoesAvaliacao: 'Observações da avaliação' }[aval];
    }
    if (entrada.tipo === 'termos') return 'Termos da consulta';
    if (entrada.tipo === 'assinatura') return 'Assinatura de termo';
    if (entrada.tipo === 'itemNovo') return 'Procedimento adicionado';
    const partes = partesDaChaveDeItem(chave);
    if (!partes) return 'Alteração da consulta';
    let numero = null;
    let nome = '';
    const at = atualRef.current;
    if (at?.id === id) {
      const sessao = valoresRef.current.procedimentosSessao;
      const mapa = mapearItensDaSessao(sessao, at.itens);
      const idx = mapa.findIndex((x) => String(x) === String(partes.itemId));
      if (idx >= 0) {
        numero = idx + 1;
        nome = String(camposDaLinhaSessao(sessao[idx]).nome ?? '').trim();
      }
    }
    if (!nome) nome = String(baseItensRef.current.get(partes.itemId)?.nome ?? '').trim();
    const rotuloNumero = numero != null ? `procedimento ${numero}` : 'procedimento';
    if (partes.campo === 'obs') return `Observação do ${rotuloNumero}`;
    if (partes.campo === 'orient') return nome ? `Orientações de ${nome}` : `Orientações do ${rotuloNumero}`;
    return `Procedimento ${numero ?? ''}`.trim();
  }, [partesDaChaveDeItem]);

  const registrarNaoEntrou = useCallback((id, entrada) => {
    // `modulo` é navegação: não há texto digitado a guardar.
    if (entrada.tipo === 'modulo') return;
    const item = {
      chave: entrada.chave,
      tipo: entrada.tipo,
      rotulo: rotuloDaEntrada(id, entrada),
      texto: textoDaEntrada(entrada),
    };
    const atuais = naoEntraramRef.current.get(id) ?? [];
    gravarNaoEntraram(id, [...atuais.filter((x) => x.chave !== item.chave), item]);
    setConsultaNaoEntraram(id);
  }, [gravarNaoEntraram, rotuloDaEntrada]);

  /**
   * Consulta encerrada por OUTRO aparelho enquanto esta aba ainda tinha envio pendente (ex.: ficou sem internet):
   * junta o que ainda não saiu (fila em memória: entradas + a que está em envio; e o que está guardado no storage
   * desta consulta) dos tipos `item`, `itemNovo`, `avaliacao`, `termos` e `assinatura` (nunca `modulo`) e move para
   * "não entraram" (mesmos rótulo, texto e persistência do 409 em `onNaoEntrou`). Limpa a fila dessa consulta.
   * Não faz nada se a consulta foi encerrada por esta aba (o encerrar já esvaziou a fila) nem se não há nada a
   * mover. Chamar ANTES de `pararFila`/`esquecer`: o rótulo ainda usa a sessão da tela. O estado exposto
   * (`alteracoesNaoEntraram`) é independente da consulta acompanhada: sobrevive ao `esquecer`.
   */
  const moverPendentesParaNaoEntraram = useCallback((id) => {
    if (!id || encerradasAquiRef.current.has(id)) return;
    const fila = filasRef.current.get(id) ?? null;
    const { storage: st } = abaRef.current;
    const todas = [...(fila?.listarPendentes?.() ?? [])];
    for (const g of lerFilaGuardada({ userId: userIdRef.current, atendimentoId: id, storage: st })) {
      if (!todas.some((e) => e.chave === g.chave)) todas.push(g);
    }
    const elegiveis = todas.filter((e) => TIPOS_QUE_NAO_ENTRAM.has(e.tipo));
    if (elegiveis.length === 0) return;
    const atuais = naoEntraramRef.current.get(id) ?? [];
    const novos = elegiveis.map((entrada) => ({
      chave: entrada.chave,
      tipo: entrada.tipo,
      rotulo: rotuloDaEntrada(id, entrada),
      texto: textoDaEntrada(entrada),
    }));
    gravarNaoEntraram(id, [...atuais.filter((x) => !novos.some((n) => n.chave === x.chave)), ...novos]);
    setConsultaNaoEntraram(id);
    if (fila) fila.limpar();
    removerFilaGuardada({ userId: userIdRef.current, atendimentoId: id, storage: st });
  }, [gravarNaoEntraram, rotuloDaEntrada]);

  const tratarFechada = useCallback((dto) => {
    // O encerrar pedido por este aparelho cuida da saída (perguntas, plano concluído e navegação).
    if (dto?.status === 'encerrado' && encerradasAquiRef.current.has(dto.id)) return;
    // Abandonada: conta o que este aparelho ainda não enviou ANTES de esquecer (inclui o que está em retentativa).
    // Nada é apagado aqui: quem recebe decide (a tela apaga só depois de avisar a pessoa).
    let abandonada = null;
    if (dto?.status === 'abandonado') {
      const id = dto.id;
      const dono = userIdRef.current;
      const fila = filasRef.current.get(id) ?? null;
      const { storage: st } = abaRef.current;
      const pendentes = fila ? fila.tamanho() : contarFilaGuardada({ userId: dono, atendimentoId: id, storage: st });
      const descartarPendentes = () => {
        if (fila) fila.limpar();
        else removerFilaGuardada({ userId: dono, atendimentoId: id, storage: st });
      };
      abandonada = { pendentes, descartarPendentes };
    }
    // Encerrada por outro aparelho com envio ainda pendente aqui (ex.: esta aba ficou sem internet): o que a pessoa
    // digitou não pode ficar órfão no storage. Vai para "não entraram" ANTES de parar a fila e esquecer a consulta.
    // 'cancelado'/'abandonado' mantêm o comportamento antigo.
    if (dto?.status === 'encerrado') moverPendentesParaNaoEntraram(dto.id);
    esquecer();
    recarregarMinhas();
    if (abandonada) {
      onAbandonadaRef.current?.(abandonada);
    } else if (dto?.status === 'cancelado') {
      onCanceladaRef.current?.({
        pacienteNome: dto.fechadaPor?.pacienteNome || dto.pacienteNome || '',
        profissionalNome: dto.fechadaPor?.profissionalNome || '',
      });
    } else if (dto?.status === 'encerrado') {
      onEncerradaRef.current?.({ pacienteId: dto.pacienteId ?? null, pacienteCpf: String(dto.pacienteCpf || '') });
    }
  }, [esquecer, moverPendentesParaNaoEntraram, recarregarMinhas]);

  /**
   * Relê o detalhe da consulta acompanhada e aplica (R8). F6a:
   * - falha de rede (sem `status`) ou 5xx agenda UMA nova tentativa com espera crescente (`ESPERAS_RELEITURA_MS`);
   *   403/404 esquecem a consulta e não tentam de novo; outros 4xx só avisam no console;
   * - a nova tentativa some quando a releitura dá certo, a consulta muda/zera (`esquecer`) ou o hook desmonta;
   *   uma releitura pedida de fora (aviso/recarregar) zera a contagem;
   * - releitura velha: se um envio da fila foi aceito enquanto o GET estava em voo, a resposta pode ter o valor
   *   antigo; é descartada e o GET é refeito uma vez, sem espera.
   * @param {{ retentativa?: boolean }} [opcoes] `retentativa` só é usado pela própria nova tentativa agendada.
   */
  const recarregarAtual = useCallback(async (opcoes) => {
    const at = atualRef.current;
    if (!at) return;
    const controle = retentativaRef.current;
    cancelarRetentativa();
    if (opcoes?.retentativa !== true) controle.tentativas = 0;
    let dto = null;
    let refeitas = 0;
    for (;;) {
      const antes = filasRef.current.get(at.id)?.enviosConcluidos?.() ?? 0;
      try {
        dto = await atendimentosApi.detalhe(at.id);
      } catch (err) {
        if (atualRef.current?.id !== at.id) return;
        if (err?.status === 403 || err?.status === 404) {
          esquecer();
          recarregarMinhas();
          return;
        }
        console.warn('[consulta] Falha ao rebuscar a consulta:', err?.message || err);
        const semStatus = err?.status == null;
        if (semStatus || err.status >= 500) {
          const esperas = esperasRef.current;
          const espera = esperas[Math.min(controle.tentativas, esperas.length - 1)];
          controle.tentativas += 1;
          controle.timer = setTimeout(() => {
            controle.timer = null;
            if (atualRef.current?.id === at.id) recarregarAtualRef.current?.({ retentativa: true });
          }, espera);
        }
        return;
      }
      if (atualRef.current?.id !== at.id) return;
      const depois = filasRef.current.get(at.id)?.enviosConcluidos?.() ?? 0;
      if (depois !== antes && refeitas < 1) {
        refeitas += 1;
        continue;
      }
      break;
    }
    controle.tentativas = 0;
    try {
      if (consultaFechada(dto)) {
        tratarFechada(dto);
        return;
      }
      definirAtual(dto);
      // Termos: termo com envio pendente (clique ainda na fila) não é sobrescrito pela releitura.
      if (!filasRef.current.get(dto.id)?.temPendente('termos')) aplicarTermos(dto.termos);
      if (hidratadoRef.current === dto.id) {
        hidratar(dto);
        setVersaoBase((n) => n + 1);
      }
    } catch (err) {
      console.warn('[consulta] Falha ao aplicar a releitura da consulta:', err?.message || err);
    }
  }, [aplicarTermos, cancelarRetentativa, definirAtual, esquecer, hidratar, recarregarMinhas, tratarFechada]);

  // A1: o debounce do useAviso entrega só a última mensagem da janela; um CANCELADO/ENCERRADO da consulta atual
  // pode vir antes de um aviso de outra. Por isso a saída é decidida pelo status da rebusca, nunca pelo tipo.
  const aoAviso = useCallback(() => {
    recarregarMinhas();
    if (atualRef.current) recarregarAtual();
  }, [recarregarAtual, recarregarMinhas]);

  useAviso(PREFIXO_AVISO.ATENDIMENTO, aoAviso);
  // Fotos (C3/B5) de outro aparelho com o mesmo login: a rebusca traz as fotos (Y11). O mapa se rebusca no
  // useMapaRascunhoAutosave. O `recarregar` do canal já é atendido pelo handler de ATENDIMENTO (R8).
  const aoAvisoDeFoto = useCallback((msg) => {
    if (msg?.tipo === 'aviso' && atualRef.current) recarregarAtual();
  }, [recarregarAtual]);
  useAviso(PREFIXO_AVISO.GALERIA, aoAvisoDeFoto);

  const recarregarAtualRef = useRef(recarregarAtual);
  useEffect(() => {
    recarregarAtualRef.current = recarregarAtual;
  }, [recarregarAtual]);

  /**
   * Põe na fila os PATCHes de `diferencasDosItens(...).alterar` e avança a base do espelho. Orientação com só a
   * caixa mudada (`imediato`) sai sem espera; texto e os outros campos esperam o debounce.
   */
  const enfileirarAlteracoes = useCallback((fila, alterar) => {
    if (!fila) return;
    for (const { itemId, campo, campos, imediato } of alterar) {
      fila.enfileirar({
        chave: `item:${itemId}:${campo}`,
        grupo: `item:${itemId}`,
        tipo: 'item',
        dados: { itemId, campos },
        debounceMs: imediato ? 0 : DEBOUNCE_TEXTO_MS,
      });
      const b = baseItensRef.current.get(itemId);
      if (!b) continue;
      // B1: marca SILENCIOSA com a base anterior (o que o servidor ainda tem): 4xx definitivo reverte a base, marca
      // "não salvo" e avisa com erro; em 2xx não sai o toast "sobrescreveu". Não sobrescreve marca já existente.
      const chaveMarca = `item:${itemId}:${campo}`;
      if (!sobrescreveuRef.current.has(chaveMarca)) {
        const remoto = campo === 'obs' ? b.obs : campo === 'orient' ? b.orient : { cat: b.cat, nome: b.nome };
        sobrescreveuRef.current.set(chaveMarca, { remoto, silencioso: true });
      }
      if (campo === 'obs') b.obs = campos.observacaoExecucao;
      else if (campo === 'orient') b.orient = campos.orientacoes;
      else {
        b.cat = campos.catalogoProcedimentoSaudeId;
        b.nome = campos.nomeLivre ?? b.nome;
      }
    }
  }, []);

  /**
   * F4: a resposta do PATCH da avaliação (o detalhe completo) vira a nova base dos textos e traz o
   * `preenchimentoAnamneseId`, só na consulta acompanhada. Campo com outro envio pendente mantém a base que o
   * aparelho já avançou; o campo enviado só avança se a base ainda é o valor enviado (sem envio mais novo dele).
   */
  const aplicarRespostaAvaliacao = useCallback((id, dados, res) => {
    const at = atualRef.current;
    if (!res || typeof res !== 'object' || at?.id !== id) return;
    const servidor = textosDaAvaliacao(res);
    const fila = filasRef.current.get(id);
    const base = { ...(baseAvaliacaoRef.current ?? servidor) };
    const enviados = dados && typeof dados === 'object' ? dados : {};
    for (const campo of CAMPOS_AVALIACAO) {
      if (Object.hasOwn(enviados, campo)) {
        if (base[campo] === String(enviados[campo] ?? '')) base[campo] = servidor[campo];
      } else if (!fila?.temPendente(CHAVE_AVALIACAO[campo])) {
        base[campo] = servidor[campo];
      }
    }
    baseAvaliacaoRef.current = base;
    definirAtual({
      ...at,
      queixa: res.queixa ?? null,
      expectativas: res.expectativas ?? null,
      observacoesAvaliacao: res.observacoesAvaliacao ?? null,
      preenchimentoAnamneseId: res.preenchimentoAnamneseId ?? null,
    });
  }, [definirAtual]);

  /**
   * F2: a resposta do PATCH do item (`AtendimentoItemDTO`) confirma a base só do campo enviado (`obs`/`proc`/
   * `orient`), na consulta acompanhada, e só se a base ainda é o valor enviado (nenhum envio mais novo a avançou) e
   * não há entrada mais nova da mesma chave (`haMaisNova`). Mesmo contrato de `aplicarRespostaAvaliacao`: durante o
   * `onResultado` a própria entrada ainda conta como "em envio" na fila, então `temPendente` da MESMA chave não serve
   * aqui. Resposta que não é o item enviado (outro `id`, ou corpo que não é item) é ignorada.
   */
  const aplicarRespostaItem = useCallback((id, entrada, res, haMaisNova) => {
    if (haMaisNova || !res || typeof res !== 'object' || atualRef.current?.id !== id) return;
    const itemId = entrada?.dados?.itemId;
    if (itemId == null || res.id == null || String(res.id) !== String(itemId)) return;
    const partes = partesDaChaveDeItem(entrada.chave);
    const b = baseItensRef.current.get(itemId) ?? baseItensRef.current.get(String(itemId));
    if (!partes || !b) return;
    const srv = camposDoItemServidor(res);
    const enviados = entrada.dados?.campos ?? {};
    if (partes.campo === 'obs') {
      if (Object.hasOwn(enviados, 'observacaoExecucao') && b.obs === String(enviados.observacaoExecucao ?? '')) {
        b.obs = srv.obs;
      }
    } else if (partes.campo === 'orient') {
      if (Array.isArray(enviados.orientacoes) && mesmasOrientacoes(b.orient, enviados.orientacoes)) b.orient = srv.orient;
    } else if (Object.hasOwn(enviados, 'catalogoProcedimentoSaudeId') || Object.hasOwn(enviados, 'nomeLivre')) {
      const enviado = { cat: enviados.catalogoProcedimentoSaudeId ?? null, nome: enviados.nomeLivre ?? b.nome };
      if (mesmoProcedimento(b, enviado)) {
        b.cat = srv.cat;
        b.nome = srv.nome;
      }
    }
  }, [partesDaChaveDeItem]);

  /** F7: carrega do storage o que não entrou da consulta `id` (F5, consulta que já saiu de `minhas`). */
  const hidratarNaoEntraram = useCallback((id) => {
    const { storage: st } = abaRef.current;
    if (!userIdRef.current || !id) return;
    const guardadas = lerNaoEntraram(st, chaveNaoEntraram(userIdRef.current, id));
    if (guardadas.length === 0) return;
    const memoria = naoEntraramRef.current.get(id) ?? [];
    const uniao = [...guardadas.filter((g) => !memoria.some((m) => m.chave === g.chave)), ...memoria];
    naoEntraramRef.current.set(id, uniao);
    setConsultaNaoEntraram((anterior) => anterior ?? id);
    setVersaoNaoEntraram((n) => n + 1);
  }, []);

  // F7: ao nascer (ou trocar de pessoa), recupera o que a pessoa deixou guardado de consultas já encerradas.
  useEffect(() => {
    const { storage: st } = abaRef.current;
    if (!userId || !st || typeof st.key !== 'function') return;
    const prefixo = `${PREFIXO_NAO_ENTRARAM}${userId}_`;
    try {
      const ids = [];
      for (let i = 0; i < st.length; i += 1) {
        const k = st.key(i);
        if (k && k.startsWith(prefixo)) ids.push(k.slice(prefixo.length));
      }
      ids.forEach(hidratarNaoEntraram);
    } catch {
      /* storage indisponível */
    }
  }, [userId, hidratarNaoEntraram]);

  /** A fila da consulta `id`: a que já existe (segundo plano ou tela) ou uma nova, que retoma o que está guardado. */
  const obterFila = useCallback((id) => {
    const existente = filasRef.current.get(id);
    if (existente) return existente;
    const acompanhada = () => atualRef.current?.id === id;
    const itemDoIndice = (indice) => {
      const mapa = mapearItensDaSessao(valoresRef.current.procedimentosSessao, atualRef.current?.itens);
      return mapa[indice] ?? null;
    };
    const fila = criarFilaConsulta({
      userId: userIdRef.current,
      atendimentoId: id,
      storage: abaRef.current.storage,
      // Em segundo plano só saem módulo e PATCH de item; o item novo precisa da sessão hidratada desta consulta.
      podeEnviar: (entrada) => entrada.tipo !== 'itemNovo' || (acompanhada() && hidratadoRef.current === id),
      executar: ({ tipo, dados }) => {
        switch (tipo) {
          case 'modulo':
            return atendimentosApi.trocarModulo(id, dados.modulo);
          case 'item':
            return atendimentosApi.alterarItem(id, dados.itemId, dados.campos);
          case 'avaliacao':
            // F4: só o campo que a pessoa deixou (`{ queixa }`, `{ expectativas }` ou `{ observacoesAvaliacao }`).
            return atendimentosApi.alterarAvaliacaoTexto(id, dados);
          case 'termos':
            return atendimentosApi.salvarTermos(id, dados);
          case 'assinatura':
            // 200 (já existia) e 201 (nova) são sucesso; 4xx definitivo a fila descarta; rede/5xx ela retenta.
            // O erro fica guardado por chave para o envelope de `enviarAssinaturaPelaFila` (status/erro).
            return termoAssinaturaApi.criar(dados).catch((err) => {
              assinaturasErroRef.current.set(`assinatura:${dados?.termoId}`, err);
              throw err;
            });
          case 'itemNovo': {
            const existenteNoServidor = itemDoIndice(dados.indice);
            return existenteNoServidor
              ? atendimentosApi.alterarItem(id, existenteNoServidor, dados.corpo)
              : atendimentosApi.novoItem(id, dados.corpo);
          }
          default:
            // Tipo que não existe mais (ex.: envio de orientação guardado no sessionStorage por uma versão
            // anterior): sai da fila sem chamar o servidor.
            return Promise.resolve(null);
        }
      },
      onResultado: (entrada, res, { haMaisNova = false } = {}) => {
        // F2: o toast "sobrescreveu" só sai agora, com o 2xx do PATCH que levou o local (nunca antes do resultado).
        const marcaOk = sobrescreveuRef.current.get(entrada.chave);
        if (marcaOk && !haMaisNova) {
          sobrescreveuRef.current.delete(entrada.chave);
          naoSalvoRef.current.delete(entrada.chave);
          if (!marcaOk.silencioso && atualRef.current?.id === id) avisarRef.current?.('info', MENSAGEM_SOBRESCREVEU_OUTRO_APARELHO);
        }
        if (entrada.tipo === 'avaliacao') {
          aplicarRespostaAvaliacao(id, entrada.dados, res);
          return;
        }
        if (entrada.tipo === 'item') {
          aplicarRespostaItem(id, entrada, res, haMaisNova);
          return;
        }
        if (entrada.tipo === 'termos') {
          // O detalhe devolvido vira a base, salvo clique mais novo ainda na fila.
          if (atualRef.current?.id === id && Array.isArray(res?.termos) && !haMaisNova) {
            aplicarTermos(res.termos);
          }
          return;
        }
        if (entrada.tipo === 'assinatura') {
          assinaturasRef.current.set(entrada.chave, res ?? null);
          const termoId = entrada.dados?.termoId;
          if (atualRef.current?.id === id && res?.id && termoId != null) {
            aplicarTermos(termosRef.current.map((t) => (t.termoId === termoId
              ? { ...t, termoAssinaturaId: res.id, statusAssinatura: res.statusCodigo ?? res.status ?? t.statusAssinatura }
              : t)));
          }
          return;
        }
        if (entrada.tipo === 'itemNovo' && res?.id) {
          const at = atualRef.current;
          if (at?.id === id && !(at.itens || []).some((i) => i.id === res.id)) {
            baseItensRef.current.set(res.id, camposDoItemServidor(res));
            definirAtual({ ...at, itens: [...(at.itens || []), res] });
            const sessao = valoresRef.current.procedimentosSessao;
            const indice = entrada.dados?.indice;
            const linha = Array.isArray(sessao) ? sessao[indice] : null;
            if (linha) {
              // O que a linha já tinha e o POST não leva (observação digitada, `orient` carregada antes do item
              // nascer) sai agora, sem espera: ainda dentro do mesmo esvaziar e antes de qualquer rebusca
              // (`pendente` protege o campo até o PATCH chegar).
              const { alterar } = diferencasDosItens([linha], [res.id], baseItensRef.current);
              enfileirarAlteracoes(filasRef.current.get(id), alterar.map((a) => ({ ...a, imediato: true })));
              // A linha que pediu o item guarda o id dele (a mescla e o espelho passam a ligar por `itemId`).
              // O espelho local (`valoresRef`) já vê o id antes da renderização: o encerrar que esvaziou a fila
              // resolve o `itemAtivoId` dessa linha na hora.
              if (linha.itemId == null && acompanhada()) {
                const nova = sessao.map((l, i) => (i === indice ? { ...l, itemId: String(res.id) } : l));
                valoresRef.current = { procedimentosSessao: nova };
                aparelhoRef.current?.setProcedimentosSessao?.(nova);
              }
            }
          }
        }
      },
      onNaoEntrou: (entrada) => {
        console.warn('[consulta] Alteração não entrou (consulta encerrada):', entrada.tipo);
        sobrescreveuRef.current.delete(entrada.chave);
        registrarNaoEntrou(id, entrada);
        if (acompanhada()) recarregarAtualRef.current();
      },
      aoMudarPendencia: (tem) => declararPendencia(id, tem),
      onDescartada: (entrada, err, { haMaisNova = false } = {}) => {
        console.warn('[consulta] Envio recusado pelo servidor:', entrada.tipo, err?.message || err);
        const recarga = err?.status === 403 || err?.status === 409;
        const itemSumiu = err?.status === 404 || err?.status === 410;
        const textoDeConsulta = entrada.tipo === 'avaliacao' || entrada.tipo === 'item' || entrada.tipo === 'itemNovo';
        if (recarga && acompanhada()) {
          recarregarAtualRef.current();
          // B4: 403/409 (consulta não encerrada): recarrega E avisa que o texto NÃO entrou (um toast por descarte).
          if (textoDeConsulta && !haMaisNova) avisarRef.current?.('error', MENSAGEM_NAO_ENTROU_ALTERACAO);
        }
        // F2: o local que ia vencer o remoto foi recusado (4xx definitivo). A base volta ao remoto (o servidor ainda o
        // tem), o campo fica "não salvo" (protegido da mescla, sem reenvio em loop) e a pessoa é avisada.
        const marca = sobrescreveuRef.current.get(entrada.chave);
        if (!marca || haMaisNova) return;
        sobrescreveuRef.current.delete(entrada.chave);
        if (recarga || !acompanhada()) return;
        if (itemSumiu) {
          // B4: 404/410: relê a consulta ANTES de marcar "não salvo" (a base passa a refletir o servidor; item que
          // sumiu na releitura não deixa marca órfã). O texto fica protegido da mescla durante a releitura.
          emReleituraRef.current.add(entrada.chave);
          const depois = () => {
            emReleituraRef.current.delete(entrada.chave);
            if (!acompanhada()) return;
            if (entrada.tipo === 'avaliacao') {
              naoSalvoRef.current.set(entrada.chave, true);
            } else if (entrada.tipo === 'item') {
              const partes = partesDaChaveDeItem(entrada.chave);
              const existe = partes && (baseItensRef.current.has(String(partes.itemId)) || baseItensRef.current.has(partes.itemId));
              if (existe) naoSalvoRef.current.set(entrada.chave, JSON.stringify(entrada.dados?.campos ?? null));
            }
            avisarRef.current?.('error', MENSAGEM_NAO_SALVOU_ALTERACAO);
          };
          Promise.resolve(recarregarAtualRef.current()).then(depois, depois);
          return;
        }
        if (entrada.tipo === 'avaliacao') {
          const campo = CAMPOS_AVALIACAO.find((c) => CHAVE_AVALIACAO[c] === entrada.chave);
          const base = baseAvaliacaoRef.current;
          if (campo && base && String(base[campo] ?? '').trim() === String(entrada.dados?.[campo] ?? '').trim()) {
            baseAvaliacaoRef.current = { ...base, [campo]: String(marca.remoto ?? '') };
          }
          naoSalvoRef.current.set(entrada.chave, true);
        } else if (entrada.tipo === 'item') {
          const partes = partesDaChaveDeItem(entrada.chave);
          const b = partes
            ? (baseItensRef.current.get(String(partes.itemId)) ?? baseItensRef.current.get(partes.itemId))
            : null;
          if (partes && b) {
            if (partes.campo === 'obs') b.obs = marca.remoto;
            else if (partes.campo === 'orient') b.orient = marca.remoto;
            else { b.cat = marca.remoto.cat; b.nome = marca.remoto.nome; }
          }
          naoSalvoRef.current.set(entrada.chave, JSON.stringify(entrada.dados?.campos ?? null));
        }
        avisarRef.current?.('error', MENSAGEM_NAO_SALVOU_ALTERACAO);
      },
    });
    filasRef.current.set(id, fila);
    return fila;
  }, [aplicarRespostaAvaliacao, aplicarRespostaItem, aplicarTermos, declararPendencia, definirAtual, enfileirarAlteracoes, partesDaChaveDeItem, registrarNaoEntrou]);

  // Fila da consulta acompanhada: a mesma instância da fila em segundo plano, se ela já existia.
  useEffect(() => {
    if (!atualId) return undefined;
    const fila = obterFila(atualId);
    filaRef.current = fila;
    return () => {
      if (filaRef.current === fila) filaRef.current = null;
    };
  }, [atualId, obterFila]);

  // Fila em segundo plano: depois de `minhas` carregar, cada consulta aberta desta pessoa com envio guardado
  // (F5, saída e novo login) volta a enviar, sem mudar de tela, sem buscar o detalhe e sem abrir.
  useEffect(() => {
    if (!habilitado || !orgId || !userId || !minhasCarregadas) return;
    for (const c of minhas) {
      if (!c?.id || c.status !== 'aberto' || filasRef.current.has(c.id)) continue;
      if (temFilaGuardada({ userId, atendimentoId: c.id, storage: abaRef.current.storage })) obterFila(c.id);
    }
  }, [habilitado, orgId, userId, minhas, minhasCarregadas, obterFila]);

  // C2: hidrata uma vez por consulta (e de novo ao voltar a ela ou trocar o paciente da tela).
  useEffect(() => {
    if (!emConsulta) {
      hidratadoRef.current = null;
      return;
    }
    if (pacienteHidratadoRef.current !== pacienteId) {
      pacienteHidratadoRef.current = pacienteId;
      hidratadoRef.current = null;
    }
    const at = atualRef.current;
    if (!at || hidratadoRef.current === at.id) return;
    if (pacienteId != null && String(at.pacienteId) !== String(pacienteId)) return;
    hidratar(at);
    hidratadoRef.current = at.id;
    // O item novo que esperava a pessoa entrar na consulta pode sair agora.
    filaRef.current?.reagendar();
    setVersaoBase((n) => n + 1);
  }, [emConsulta, atualId, pacienteId, pedidoHidratacao, hidratar]);

  // D4: espelho do aparelho para as rotas, pela fila.
  useEffect(() => {
    const at = atualRef.current;
    const fila = filaRef.current;
    if (!emConsulta || !at || !fila || hidratadoRef.current !== at.id || suspensoRef.current) return;

    const mapa = mapearItensDaSessao(procedimentosSessao, at.itens);
    const itens = diferencasDosItens(procedimentosSessao, mapa, baseItensRef.current);
    // F2: o texto que o servidor recusou (4xx definitivo) não é reenviado em loop pelo espelho; digitar outra coisa
    // (ou voltar ao valor do servidor) tira o campo de "não salvo".
    const chavesDiff = new Set(itens.alterar.map((a) => `item:${a.itemId}:${a.campo}`));
    for (const k of [...naoSalvoRef.current.keys()]) {
      if (k.startsWith('item:') && !chavesDiff.has(k)) naoSalvoRef.current.delete(k);
    }
    const alterar = itens.alterar.filter((a) => {
      const k = `item:${a.itemId}:${a.campo}`;
      if (emReleituraRef.current.has(k)) return false;
      const recusado = naoSalvoRef.current.get(k);
      if (recusado === undefined) return true;
      if (recusado === JSON.stringify(a.campos)) return false;
      naoSalvoRef.current.delete(k);
      return true;
    });
    enfileirarAlteracoes(fila, alterar);
    for (const novo of itens.criar) {
      fila.enfileirar({
        chave: `item:novo:${novo.indice}`,
        grupo: 'item:novo',
        tipo: 'itemNovo',
        dados: {
          indice: novo.indice,
          corpo: { catalogoProcedimentoSaudeId: novo.catalogoProcedimentoSaudeId, nomeLivre: novo.nomeLivre },
        },
        debounceMs: DEBOUNCE_TEXTO_MS,
      });
    }
  }, [emConsulta, atualId, versaoBase, procedimentosSessao, enfileirarAlteracoes]);

  /** Passa a acompanhar `dto` como a consulta da tela (hidrata ao entrar). */
  const adotar = useCallback((dto) => {
    if (atualRef.current?.id !== dto.id) esquecer();
    hidratadoRef.current = null;
    definirAtual(dto);
    hidratarNaoEntraram(dto.id);
    if (!filasRef.current.get(dto.id)?.temPendente('termos')) aplicarTermos(dto.termos);
    setPedidoHidratacao((n) => n + 1);
  }, [aplicarTermos, definirAtual, esquecer, hidratarNaoEntraram]);

  /** C1: abre (ou retoma) no servidor. Lança o erro do servidor; nada muda no aparelho se falhar. */
  const abrir = useCallback(async (pedido) => {
    const dto = await atendimentosApi.abrir(pedido);
    if (!dto?.id) throw new Error('Não foi possível iniciar o atendimento.');
    adotar(dto);
    recarregarMinhas();
    return dto;
  }, [adotar, recarregarMinhas]);

  const detalhe = useCallback((id) => atendimentosApi.detalhe(id), []);

  /**
   * F4: a pessoa saiu do campo `campo` da avaliação. Se o valor do aparelho (aparado) difere da base do servidor
   * (aparada), põe na fila, sem espera, o PATCH só desse campo e avança a base. Devolve `true` se enfileirou. Sem
   * consulta acompanhada, consulta ainda não hidratada, campo desconhecido ou sem a opção `avaliacao`: nada, `false`.
   * @param {'queixa' | 'expectativas' | 'observacoesAvaliacao'} campo
   * @returns {boolean}
   */
  const onCampoAvaliacaoBlur = useCallback((campo) => {
    const at = atualRef.current;
    if (!at || !Object.hasOwn(CHAVE_AVALIACAO, campo)) return false;
    const av = avaliacaoRef.current;
    if (!av || hidratadoRef.current !== at.id || baseAvaliacaoRef.current == null) return false;
    const valor = String(av.valores?.[campo] ?? '').trim();
    naoSalvoRef.current.delete(CHAVE_AVALIACAO[campo]);
    if (valor === String(baseAvaliacaoRef.current[campo] ?? '').trim()) return false;
    const fila = filaRef.current ?? obterFila(at.id);
    fila.enfileirar({ chave: CHAVE_AVALIACAO[campo], tipo: 'avaliacao', dados: { [campo]: valor }, debounceMs: 0 });
    // B1: marca silenciosa com a base anterior (ver `enfileirarAlteracoes`); não sobrescreve marca já existente.
    if (!sobrescreveuRef.current.has(CHAVE_AVALIACAO[campo])) {
      sobrescreveuRef.current.set(CHAVE_AVALIACAO[campo], { remoto: baseAvaliacaoRef.current[campo], silencioso: true });
    }
    baseAvaliacaoRef.current = { ...baseAvaliacaoRef.current, [campo]: valor };
    return true;
  }, [obterFila]);

  /**
   * F4: `true` se queixa ou expectativas têm texto que ainda não está no servidor: o valor do aparelho (aparado)
   * difere da base (aparada), mesmo critério de `onCampoAvaliacaoBlur`, ou há envio `avaliacao:*` desse campo ainda
   * na fila. `false` sem consulta acompanhada, sem a opção `avaliacao` ou antes de hidratar. Observações da
   * avaliação não entram (não bloqueiam o fluxo que chama isto).
   * @returns {boolean}
   */
  const avaliacaoTemNaoSalvo = useCallback(() => {
    const at = atualRef.current;
    const av = avaliacaoRef.current;
    const base = baseAvaliacaoRef.current;
    if (!at || !av || hidratadoRef.current !== at.id || base == null) return false;
    const fila = filaRef.current;
    for (const campo of ['queixa', 'expectativas']) {
      if (fila?.temPendente(CHAVE_AVALIACAO[campo])) return true;
      if (String(av.valores?.[campo] ?? '').trim() !== String(base[campo] ?? '').trim()) return true;
    }
    return false;
  }, []);

  /** F6b: o valor local do campo `chave` agora (texto do controle; lista/procedimento do item vêm da sessão). */
  const valorLocalDoCampo = useCallback((chave, alvo) => {
    const partes = partesDaChaveDeItem(chave);
    if (partes && partes.campo !== 'obs') {
      const v = valorLocalDoItem(partes.itemId, partes.campo, valoresRef.current.procedimentosSessao, atualRef.current?.itens);
      return JSON.stringify(v ?? null);
    }
    return String(alvo?.value ?? '');
  }, [partesDaChaveDeItem, valorLocalDoItem]);

  /**
   * F6b/F2: a pessoa saiu do campo `chave` com remoto em espera.
   * - Mexeu no campo desde o foco (`mudouLocal`): o local vence e NUNCA fica calado. O texto local é comparado com
   *   o REMOTO em espera (`espera.valor`), não com a base otimista: depois de um PATCH aceito a base já É o texto
   *   local e o diff com ela saía vazio (nenhum PATCH, servidor com o texto do outro aparelho). Diferente → PATCH
   *   imediato do local + (só depois do 2xx desse PATCH) "Sua alteração sobrescreveu a de outro aparelho"; 4xx
   *   definitivo: base volta ao remoto, campo "não salvo" e toast de erro; igual → nada. A base termina no valor
   *   final.
   * - Só focou, sem mexer: vale o remoto (aplica no aparelho, zero PATCH) + "Alterado em outro aparelho".
   */
  const resolverRemotoEmEspera = useCallback((chave, alvo) => {
    const espera = remotoEmEsperaRef.current[chave];
    delete remotoEmEsperaRef.current[chave];
    if (!espera) return;
    const at = atualRef.current;
    if (!at) return;
    const mudouLocal = valorLocalDoCampo(chave, alvo) !== valorNoFocoRef.current;
    const campoAval = CAMPOS_AVALIACAO.find((c) => CHAVE_AVALIACAO[c] === chave);
    const partes = partesDaChaveDeItem(chave);
    if (mudouLocal) {
      let sobrescreveu = false;
      if (campoAval) {
        const local = String(avaliacaoRef.current?.valores?.[campoAval] ?? '').trim();
        const remoto = String(espera.valor ?? '').trim();
        if (local !== remoto) {
          const fila = filaRef.current ?? obterFila(at.id);
          fila.enfileirar({ chave, tipo: 'avaliacao', dados: { [campoAval]: local }, debounceMs: 0 });
          sobrescreveuRef.current.set(chave, { remoto: espera.valor });
          naoSalvoRef.current.delete(chave);
          sobrescreveu = true;
        }
        if (baseAvaliacaoRef.current) {
          baseAvaliacaoRef.current = { ...baseAvaliacaoRef.current, [campoAval]: sobrescreveu ? local : String(espera.valor ?? '') };
        }
      } else if (partes) {
        // A base do campo passa a ser o remoto em espera ANTES do diff: o que o aparelho tem e difere dele sai agora.
        // `diferencasDosItens` já compara com `mesmoProcedimento`/`mesmasOrientacoes` (proc/orient) e por texto (obs).
        const b = baseItensRef.current.get(String(partes.itemId)) ?? baseItensRef.current.get(partes.itemId);
        if (b) {
          if (partes.campo === 'obs') b.obs = espera.valor;
          else if (partes.campo === 'orient') b.orient = espera.valor;
          else { b.cat = espera.valor.cat; b.nome = espera.valor.nome; }
        }
        const sessao = valoresRef.current.procedimentosSessao;
        const mapa = mapearItensDaSessao(sessao, at.itens);
        const { alterar } = diferencasDosItens(sessao, mapa, baseItensRef.current);
        const doCampo = alterar.filter((a) => `item:${a.itemId}:${a.campo}` === chave);
        if (doCampo.length > 0) {
          enfileirarAlteracoes(filaRef.current ?? obterFila(at.id), doCampo.map((a) => ({ ...a, imediato: true })));
          sobrescreveuRef.current.set(chave, { remoto: espera.valor });
          naoSalvoRef.current.delete(chave);
          sobrescreveu = true;
        }
      }
      // O toast "sobrescreveu" não sai aqui: só com o 2xx do PATCH (`onResultado`); em 4xx sai erro (`onDescartada`).
      return;
    }
    if (campoAval) {
      const av = avaliacaoRef.current;
      if (av && typeof av.aplicar === 'function') {
        const valores = { ...av.valores, [campoAval]: espera.valor };
        avaliacaoRef.current = { ...av, valores };
        av.aplicar(valores);
      }
      if (baseAvaliacaoRef.current) baseAvaliacaoRef.current = { ...baseAvaliacaoRef.current, [campoAval]: espera.valor };
    } else if (partes) {
      const sessao = valoresRef.current.procedimentosSessao;
      const mapa = mapearItensDaSessao(sessao, at.itens);
      const idx = mapa.findIndex((id) => String(id) === String(partes.itemId));
      if (idx >= 0) {
        const linha = sessao[idx];
        let nova = linha;
        if (partes.campo === 'obs') nova = { ...linha, observacoesExecucao: espera.valor };
        else if (partes.campo === 'orient') nova = { ...linha, orient: espera.valor };
        else {
          nova = {
            ...linha,
            nomeProcedimento: espera.valor.nome,
            procedimentoNome: espera.valor.nome,
            nomeSoDeTela: false,
            nomeProcedimentoCatalogoId: espera.valor.cat,
            catalogoProcedimentoSaudeId: espera.valor.cat,
          };
        }
        const novaSessao = sessao.map((l, i) => (i === idx ? nova : l));
        valoresRef.current = { procedimentosSessao: novaSessao };
        aparelhoRef.current?.setProcedimentosSessao?.(novaSessao);
        const b = baseItensRef.current.get(String(partes.itemId)) ?? baseItensRef.current.get(partes.itemId);
        if (b) {
          if (partes.campo === 'obs') b.obs = espera.valor;
          else if (partes.campo === 'orient') b.orient = espera.valor;
          else { b.cat = espera.valor.cat; b.nome = espera.valor.nome; }
        }
      }
    }
    avisarRef.current?.('info', MENSAGEM_ALTERADO_OUTRO_APARELHO);
  }, [enfileirarAlteracoes, obterFila, partesDaChaveDeItem, valorLocalDoCampo]);

  // F6b: foco da pessoa em campo da consulta (`data-campo-consulta`): a mescla não o sobrescreve (ver `protegido`).
  useEffect(() => {
    const raiz = abaRef.current.raizDeFoco;
    if (!atualId || !raiz || typeof raiz.addEventListener !== 'function') return undefined;
    const chaveDe = (alvo) => alvo?.closest?.('[data-campo-consulta]')?.getAttribute('data-campo-consulta') ?? null;
    const aoEntrar = (ev) => {
      const chave = chaveDe(ev.target);
      focoRef.current = chave;
      valorNoFocoRef.current = chave ? valorLocalDoCampo(chave, ev.target) : null;
    };
    const aoSair = (ev) => {
      const chave = chaveDe(ev.target);
      if (!chave || chave !== focoRef.current) {
        if (chave) delete remotoEmEsperaRef.current[chave];
        return;
      }
      try {
        resolverRemotoEmEspera(chave, ev.target);
      } finally {
        focoRef.current = null;
        valorNoFocoRef.current = null;
      }
    };
    raiz.addEventListener('focusin', aoEntrar);
    raiz.addEventListener('focusout', aoSair);
    return () => {
      raiz.removeEventListener('focusin', aoEntrar);
      raiz.removeEventListener('focusout', aoSair);
      focoRef.current = null;
      valorNoFocoRef.current = null;
      remotoEmEsperaRef.current = {};
    };
  }, [atualId, resolverRemotoEmEspera, valorLocalDoCampo]);

  /**
   * Termos: grava o estado escolhido (lista final = `termosPendentesIds` + `termoSelecionadoId`). Atualiza a base na
   * hora (otimista, preservando o que as linhas já tinham) e enfileira 1 PUT (`termos`, 300 ms, o último vence).
   * Devolve `true` se enfileirou; `false` sem consulta acompanhada.
   * @param {{ termoSelecionadoId: string | null, termoLido: boolean, termosPendentesIds: string[] }} dados
   * @returns {boolean}
   */
  const salvarTermosConsulta = useCallback((dados) => {
    const at = atualRef.current;
    if (!at) return false;
    const selecionado = dados?.termoSelecionadoId ?? null;
    const termoLido = Boolean(dados?.termoLido);
    const pendentes = Array.isArray(dados?.termosPendentesIds) ? dados.termosPendentesIds.filter((x) => x != null) : [];
    const finais = [...new Set([...pendentes, ...(selecionado != null ? [selecionado] : [])])];
    const agoraIso = new Date().toISOString();
    aplicarTermos(finais.map((termoId, ordem) => {
      const antiga = termosRef.current.find((t) => t.termoId === termoId);
      const ehSel = termoId === selecionado;
      const lido = Boolean(antiga?.lido) || (ehSel && termoLido);
      return {
        termoId,
        ordem,
        lido,
        lidoEm: antiga?.lidoEm ?? (lido ? agoraIso : null),
        escolhido: ehSel,
        termoAssinaturaId: antiga?.termoAssinaturaId ?? null,
        statusAssinatura: antiga?.statusAssinatura ?? null,
      };
    }));
    const fila = filaRef.current ?? obterFila(at.id);
    fila.enfileirar({
      chave: 'termos',
      tipo: 'termos',
      dados: { termoSelecionadoId: selecionado, termoLido, termosPendentesIds: pendentes },
      debounceMs: DEBOUNCE_TERMOS_MS,
    });
    return true;
  }, [aplicarTermos, obterFila]);

  /**
   * Assinatura de termo pela fila (sobrevive a queda de rede e a F5): `corpo` é o do POST /termos/assinaturas (leva
   * `atendimentoId`, que vira o da consulta acompanhada se faltar). Tenta enviar já. Devolve o envelope
   * `{ ok, assinatura, naFila, status, erro, naoEntrou? }`:
   * - sucesso (200/201): `{ ok: true, assinatura: <corpo>, naFila: false, status: null, erro: null }` (o `request`
   *   da api devolve só o corpo, então o código HTTP de sucesso não é exposto: `status` é `null`);
   * - rede/5xx (guardada para retentar): `{ ok: false, assinatura: null, naFila: true, status: <5xx|null>, erro }`;
   * - 4xx definitivo (descartada): `{ ok: false, assinatura: null, naFila: false, status: <4xx>, erro }`;
   * - 409 "Esta consulta já foi fechada." (vai para `alteracoesNaoEntraram`): igual ao 4xx, com `naoEntrou: true`;
   * - sem consulta acompanhada/sem termoId: `{ ok: false, assinatura: null, naFila: false, status: null, erro: null }`.
   * @param {object} corpo
   * @returns {Promise<{ ok: boolean, assinatura: object | null, naFila: boolean, status: number | null, erro: Error | null, naoEntrou?: boolean }>}
   */
  const enviarAssinaturaPelaFila = useCallback(async (corpo) => {
    const at = atualRef.current;
    if (!at || !corpo || corpo.termoId == null) {
      return { ok: false, assinatura: null, naFila: false, status: null, erro: null };
    }
    const chave = `assinatura:${corpo.termoId}`;
    const fila = filaRef.current ?? obterFila(at.id);
    assinaturasRef.current.delete(chave);
    assinaturasErroRef.current.delete(chave);
    fila.enfileirar({
      chave,
      tipo: 'assinatura',
      dados: { ...corpo, atendimentoId: corpo.atendimentoId ?? at.id },
      debounceMs: 0,
    });
    await fila.esvaziar();
    const naFila = fila.temPendente(chave);
    const assinatura = assinaturasRef.current.get(chave) ?? null;
    const ok = !naFila && assinatura != null;
    if (ok) return { ok: true, assinatura, naFila: false, status: null, erro: null };
    const erro = assinaturasErroRef.current.get(chave) ?? null;
    const s = Number(erro?.status);
    const status = Number.isFinite(s) && s > 0 ? s : null;
    const envelope = { ok: false, assinatura: null, naFila, status, erro };
    if (!naFila && consultaEncerradaPor409(erro)) envelope.naoEntrou = true;
    return envelope;
  }, [obterFila]);

  /**
   * Espera os envios `avaliacao:*` saírem (o "Concluir" da anamnese/avaliação não cria segunda ficha). Resolve
   * `{ ok, preenchimentoAnamneseId }`: `ok` é `true` se nada de avaliação ficou pendente; o id vem da base mais
   * recente (a resposta do PATCH já o atualizou), sem depender do render.
   * @returns {Promise<{ ok: boolean, preenchimentoAnamneseId: string | null }>}
   */
  const esperarFilaAvaliacao = useCallback(async () => {
    const fila = filaRef.current;
    if (fila?.temPendente('avaliacao:')) await fila.esvaziar();
    return {
      ok: !(fila?.temPendente('avaliacao:') ?? false),
      preenchimentoAnamneseId: atualRef.current?.preenchimentoAnamneseId ?? null,
    };
  }, []);

  /** Y9: grava o módulo escolhido pela pessoa (o abrir já leva o módulo inicial). */
  const trocarModulo = useCallback((modulo) => {
    if (!modulo || !atualRef.current) return;
    filaRef.current?.enfileirar({ chave: 'modulo', tipo: 'modulo', dados: { modulo } });
  }, []);

  /**
   * "Apenas Sair": espera os envios pendentes e recarrega a barra. A consulta continua aberta no servidor e
   * acompanhada aqui (nenhuma rota de consulta). Não cria procedimento nem mexe em agenda. Lança um erro quando não
   * há consulta acompanhada. Devolve `esvaziou` (`false` se sobrou envio guardado neste aparelho, ex.: sem conexão) e
   * os tipos que sobraram: `modulo`/`item` saem sozinhos quando a conexão volta; `itemNovo` só sai quando a pessoa
   * abrir esta consulta de novo (precisa da sessão hidratada, ver `podeEnviar`).
   * @returns {Promise<{ esvaziou: boolean, tiposPendentes: string[] }>}
   */
  const guardarAntesDeSair = useCallback(async () => {
    const at = atualRef.current;
    if (!at) throw new Error(CONSULTA_NAO_ENCONTRADA);
    const fila = filaRef.current;
    const esvaziou = (await fila?.esvaziar()) ?? true;
    recarregarMinhas();
    return { esvaziou: esvaziou !== false, tiposPendentes: fila?.tiposPendentes() ?? [] };
  }, [recarregarMinhas]);

  /**
   * Envia já o que está na fila da consulta acompanhada. Se algo não chegou ao servidor (sem conexão, 5xx, 401 em
   * retentativa), lança um erro com `codigo: 'ENVIO_PENDENTE'` e nada é apagado: a fila segue tentando.
   */
  const confirmarEnvios = useCallback(async () => {
    const ok = (await filaRef.current?.esvaziar()) ?? true;
    if (ok === false) {
      throw Object.assign(new Error(MENSAGEM_ENVIO_PENDENTE), { codigo: CODIGO_ENVIO_PENDENTE });
    }
  }, []);

  /**
   * Etapa 3: confirma os envios pendentes da fila (`confirmarEnvios`; com pendência, recusa sem chamar o servidor) e
   * encerra no servidor (uma transação). Devolve o EncerramentoResultadoDTO. Lança o erro do servidor; nesse caso a
   * consulta continua acompanhada.
   * Com `indiceItemAtivo` (linha ativa da sessão), o `itemAtivoId` é resolvido DEPOIS de esvaziar a fila: o item
   * dessa linha pode nascer no próprio esvaziar. O índice não vai no corpo. As orientações não vão no corpo (F5b):
   * já estão em cada item pelo PATCH; `orientacoes` no pedido é ignorado. `criarProcedimentos` deixou de ser enviado
   * (F1): o servidor decide pelo `modo` e pelos itens.
   * @param {{ modo?: 'COMPLETO' | 'SOMENTE_FECHAR', pularGateTermos?: boolean, itemAtivoId?: string | null,
   *   indiceItemAtivo?: number }} pedido
   */
  const encerrar = useCallback(async ({ indiceItemAtivo, orientacoes: _ignoradas, ...corpo } = {}) => {
    const at = atualRef.current;
    if (!at) throw new Error(CONSULTA_NAO_ENCONTRADA);
    await confirmarEnvios();
    encerradasAquiRef.current.add(at.id);
    try {
      if (indiceItemAtivo != null) {
        const mapa = mapearItensDaSessao(valoresRef.current.procedimentosSessao, atualRef.current?.itens);
        corpo.itemAtivoId = mapa[indiceItemAtivo] ?? null;
      }
      const abaId = abaRef.current.idDaAba?.() ?? null;
      const resultado = abaId
        ? await atendimentosApi.encerrar(at.id, corpo, { abaId })
        : await atendimentosApi.encerrar(at.id, corpo);
      if (atualRef.current?.id === at.id) esquecer();
      recarregarMinhas();
      return resultado;
    } catch (err) {
      encerradasAquiRef.current.delete(at.id);
      if (
        err?.status === 409
        && (err.body?.error === CODIGO_ENVIO_PENDENTE_OUTRA_ABA
          || /envios pendentes em outro aparelho/i.test(String(err.body?.message ?? '')))
      ) {
        err.codigo = CODIGO_ENVIO_PENDENTE_OUTRA_ABA;
      }
      throw err;
    }
  }, [confirmarEnvios, esquecer, recarregarMinhas]);

  /**
   * F7: como `encerrar` (mesma assinatura), mas quando o servidor recusa por envio pendente em OUTRA aba da pessoa
   * (`codigo === ENVIO_PENDENTE_OUTRA_ABA`) espera a mensagem `pendencia-liberada` da consulta ou `esperaOutraAbaMs`
   * e tenta de novo, repetindo. `esperandoOutraAba` fica `true` durante a espera; o aviso sai uma vez por chamada.
   * Sai com o resultado, com outro erro (propaga) ou com `ESPERA_CANCELADA` (`cancelarEsperaOutraAba`, consulta
   * trocada/esquecida, desmontagem).
   */
  const encerrarAguardandoOutraAba = useCallback(async (...args) => {
    cancelarEsperaOutraAba();
    const espera = { id: atualRef.current?.id ?? null, cancelado: false, acordar: null };
    esperaRef.current = espera;
    const cancelada = () => Object.assign(new Error('Espera cancelada.'), { codigo: CODIGO_ESPERA_CANCELADA });
    let avisou = false;
    try {
      for (;;) {
        if (espera.cancelado) throw cancelada();
        try {
          return await encerrar(...args);
        } catch (err) {
          if (err?.codigo !== CODIGO_ENVIO_PENDENTE_OUTRA_ABA) throw err;
          if (espera.cancelado) throw cancelada();
          if (!avisou) {
            avisou = true;
            setEsperandoOutraAba(true);
            avisarRef.current?.('warning', MENSAGEM_AVISO_OUTRA_ABA);
          }
          await new Promise((resolve) => {
            const timer = setTimeout(resolve, esperaOutraAbaMsRef.current);
            espera.acordar = () => {
              clearTimeout(timer);
              resolve();
            };
          });
          espera.acordar = null;
        }
      }
    } finally {
      if (esperaRef.current === espera) esperaRef.current = null;
      setEsperandoOutraAba(false);
    }
  }, [cancelarEsperaOutraAba, encerrar]);

  /** F7: o que não entrou da consulta (`null` sem nada). */
  const alteracoesNaoEntraram = useMemo(() => {
    const lista = (consultaNaoEntraram != null ? naoEntraramRef.current.get(consultaNaoEntraram) : null) ?? [];
    if (lista.length === 0) return null;
    const itens = lista.map(({ chave, tipo, rotulo, texto }) => ({ chave, tipo, rotulo, texto }));
    const textoParaCopiar = itens
      .map((i) => (i.texto ? `${i.rotulo}:\n${i.texto}` : i.rotulo))
      .join('\n\n');
    return { quantidade: itens.length, itens, textoParaCopiar };
    // `versaoNaoEntraram` invalida o cálculo quando o mapa em memória muda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consultaNaoEntraram, versaoNaoEntraram]);

  /** F7: a pessoa dispensa a lista (limpa memória e storage da consulta mostrada). */
  const descartarAlteracoesNaoEntraram = useCallback(() => {
    const id = consultaNaoEntraram;
    if (id == null) return;
    gravarNaoEntraram(id, []);
    naoEntraramRef.current.delete(id);
    setConsultaNaoEntraram(null);
  }, [consultaNaoEntraram, gravarNaoEntraram]);

  /** F7: copia `textoParaCopiar` para a área de transferência. `true` se copiou, `false` se não foi possível. */
  const copiarAlteracoesNaoEntraram = useCallback(async () => {
    const texto = alteracoesNaoEntraram?.textoParaCopiar ?? '';
    if (!texto) return false;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(texto);
        return true;
      }
    } catch {
      /* cai para o plano B */
    }
    try {
      if (typeof document === 'undefined' || typeof document.execCommand !== 'function') return false;
      const area = document.createElement('textarea');
      area.value = texto;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(area);
      return ok === true;
    } catch {
      return false;
    }
  }, [alteracoesNaoEntraram]);

  /** NDg: "usar item do plano" troca os itens no servidor; o espelho espera a resposta para não enviar a troca. */
  const substituirPeloPlano = useCallback(async (pedido) => {
    const at = atualRef.current;
    if (!at) return null;
    suspensoRef.current = true;
    try {
      await filaRef.current?.esvaziar();
      const dto = await atendimentosApi.substituirPeloPlano(at.id, pedido);
      if (atualRef.current?.id !== at.id || !dto?.id) return null;
      baseItensRef.current = baseDosItens(dto.itens);
      definirAtual(dto);
      return dto;
    } finally {
      suspensoRef.current = false;
      setVersaoBase((n) => n + 1);
    }
  }, [definirAtual]);

  return {
    atual,
    minhas,
    minhasCarregadas,
    abrir,
    adotar,
    detalhe,
    trocarModulo,
    onCampoAvaliacaoBlur,
    /** F4: `true` se queixa/expectativas têm texto ainda não salvo no servidor (digitado sem blur ou envio na fila). */
    avaliacaoTemNaoSalvo,
    /** Termos da consulta acompanhada (`termos[]` do detalhe; `[]` se nada). */
    termosDaConsulta,
    salvarTermosConsulta,
    enviarAssinaturaPelaFila,
    esperarFilaAvaliacao,
    /** F4: id do preenchimento da anamnese da consulta acompanhada (detalhe ou resposta do PATCH); `null` sem ele. */
    preenchimentoAnamneseId: atual?.preenchimentoAnamneseId ?? null,
    guardarAntesDeSair,
    confirmarEnvios,
    encerrar,
    /** F7: `encerrar` que espera a outra aba da pessoa liberar os envios (ver o comentário da função). */
    encerrarAguardandoOutraAba,
    cancelarEsperaOutraAba,
    /** F7: `true` enquanto `encerrarAguardandoOutraAba` espera outra aba. */
    esperandoOutraAba,
    /** F7: `{ quantidade, itens: [{ chave, tipo, rotulo, texto }], textoParaCopiar } | null`. */
    alteracoesNaoEntraram,
    descartarAlteracoesNaoEntraram,
    copiarAlteracoesNaoEntraram,
    substituirPeloPlano,
    recarregarMinhas,
    esquecer,
  };
}
