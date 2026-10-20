/**
 * Fila dos envios da consulta (D4/P3): uma entrada por `chave` (a mais nova substitui a anterior), cada uma
 * pronta depois do seu `debounceMs`, enviadas uma de cada vez. Entradas do mesmo `grupo` saem na ordem em que
 * entraram (o POST de um item antes do PATCH dele). O sessionStorage guarda só o que ainda não foi enviado, numa
 * chave por pessoa e consulta: outra pessoa na mesma aba nunca lê nem envia a fila de quem saiu.
 */

const PREFIXO = 'procedi_consulta_fila_';
const ESPERA_RETENTATIVA_MS = 3000;

export function chaveDaFila(userId, atendimentoId) {
  return `${PREFIXO}${userId}_${atendimentoId}`;
}

/**
 * Remove as filas no formato antigo (`procedi_consulta_fila_<atendimentoId>`, sem a pessoa): ninguém sabe de quem
 * eram, então não são lidas nem enviadas.
 */
export function removerFilasAntigas(storage = typeof sessionStorage !== 'undefined' ? sessionStorage : null) {
  if (!storage || typeof storage.key !== 'function') return;
  try {
    const antigas = [];
    for (let i = 0; i < storage.length; i += 1) {
      const k = storage.key(i);
      if (k && k.startsWith(PREFIXO) && !k.slice(PREFIXO.length).includes('_')) antigas.push(k);
    }
    antigas.forEach((k) => storage.removeItem(k));
  } catch {
    /* storage indisponível */
  }
}

/** `true` se esta pessoa tem envio guardado (de antes de um F5 ou de uma saída) para a consulta. */
export function temFilaGuardada({
  userId,
  atendimentoId,
  storage = typeof sessionStorage !== 'undefined' ? sessionStorage : null,
}) {
  if (!userId || !atendimentoId) return false;
  removerFilasAntigas(storage);
  return lerGuardado(storage, chaveDaFila(userId, atendimentoId)).length > 0;
}

/** Quantas entradas esta pessoa tem guardadas (sem instância da fila) para a consulta. */
export function contarFilaGuardada({
  userId,
  atendimentoId,
  storage = typeof sessionStorage !== 'undefined' ? sessionStorage : null,
}) {
  if (!userId || !atendimentoId) return 0;
  return lerGuardado(storage, chaveDaFila(userId, atendimentoId)).length;
}

/** As entradas que esta pessoa tem guardadas (sem instância da fila) para a consulta; `[]` sem nada. */
export function lerFilaGuardada({
  userId,
  atendimentoId,
  storage = typeof sessionStorage !== 'undefined' ? sessionStorage : null,
}) {
  if (!userId || !atendimentoId) return [];
  return lerGuardado(storage, chaveDaFila(userId, atendimentoId));
}

/** Apaga o que esta pessoa tem guardado (sem instância da fila) para a consulta. */
export function removerFilaGuardada({
  userId,
  atendimentoId,
  storage = typeof sessionStorage !== 'undefined' ? sessionStorage : null,
}) {
  if (!userId || !atendimentoId) return;
  try {
    storage?.removeItem(chaveDaFila(userId, atendimentoId));
  } catch {
    /* storage indisponível */
  }
}

/**
 * 4xx que não muda com nova tentativa: a entrada sai da fila. 401 nunca: é tratado como falha de rede (a entrada fica,
 * mesma chave e versão, e a fila tenta de novo depois de `ESPERA_RETENTATIVA_MS`; a renovação da sessão pode ter saído
 * nesse meio-tempo). Se a sessão acabou de vez, a saída troca a pessoa e a fila é parada com o storage intacto.
 */
function erroDefinitivo(err) {
  const s = Number(err?.status);
  return Number.isFinite(s) && s >= 400 && s < 500 && s !== 401 && s !== 408 && s !== 429;
}

/** Tipos de envio que, ao bater numa consulta já encerrada (409), viram "não entraram" em vez de sumir calados. */
const TIPOS_QUE_NAO_ENTRAM = new Set(['item', 'itemNovo', 'avaliacao', 'termos', 'assinatura', 'modulo']);

/**
 * 409 de consulta encerrada (AtendimentoGuard: "Esta consulta já foi fechada."). O backend não manda código: só o
 * texto em `error`/`message`. Outros 409 (ex.: termos obrigatórios) não são este.
 */
export function consultaEncerradaPor409(err) {
  if (Number(err?.status) !== 409) return false;
  const body = err?.body && typeof err.body === 'object' ? err.body : {};
  const texto = [body.error, body.message, err?.message].filter((t) => typeof t === 'string').join(' ');
  return /consulta j[aá] foi fechada/i.test(texto);
}

function lerGuardado(storage, chave) {
  try {
    const raw = storage?.getItem(chave);
    const lista = raw ? JSON.parse(raw) : [];
    return Array.isArray(lista) ? lista.filter((e) => e && typeof e.chave === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Sem `userId` a fila fica só em memória (nunca grava numa chave que outra pessoa possa ler). `podeEnviar` segura
 * uma entrada na fila sem enviá-la (ex.: `itemNovo` enquanto a pessoa não entrou na consulta); quando a condição
 * muda, `reagendar()` reavalia.
 *
 * `storage` é injetável (padrão: o `sessionStorage` da aba): os testes de duas abas passam um storage por aba.
 * `aoMudarPendencia(temPendencia)` (onda 0, usado pela pendência F7) dispara só na virada vazio ↔ com pendência,
 * contando o que está em envio; a fila que nasce com entradas guardadas (F5) dispara `true` ao nascer.
 * `onNaoEntrou(entrada, erro)` (F7): 409 de consulta encerrada em `item`/`itemNovo`/`avaliacao`/`termos`/`assinatura`/
 * `modulo`: a entrada sai da fila (sem nova tentativa) e vai para quem a recebe, em vez de `onDescartada` (o que a
 * pessoa digitou não some calado). Sem a opção, vale o `onDescartada` de sempre.
 * `enviosConcluidos()` conta os envios que o servidor aceitou (usado pela F6a para descartar uma releitura que
 * começou antes de um envio terminar). Sem essas opções, nada muda.
 * @param {{
 *   userId: string | null,
 *   atendimentoId: string,
 *   executar: (entrada: { chave: string, grupo: string, tipo: string, dados: any }) => Promise<any>,
 *   onResultado?: (entrada: object, resultado: any) => void,
 *   onDescartada?: (entrada: object, erro: any) => void,
 *   onNaoEntrou?: (entrada: object, erro: any) => void,
 *   podeEnviar?: (entrada: { chave: string, grupo: string, tipo: string }) => boolean,
 *   aoMudarPendencia?: (temPendencia: boolean) => void,
 *   storage?: Storage | null,
 *   agora?: () => number,
 * }} opcoes
 */
export function criarFilaConsulta({
  userId,
  atendimentoId,
  executar,
  onResultado,
  onDescartada,
  onNaoEntrou,
  podeEnviar = () => true,
  aoMudarPendencia,
  storage: storageDaAba = typeof sessionStorage !== 'undefined' ? sessionStorage : null,
  agora = () => Date.now(),
}) {
  const storage = userId ? storageDaAba : null;
  removerFilasAntigas(storageDaAba);
  const chaveStorage = userId ? chaveDaFila(userId, atendimentoId) : null;
  /** @type {Array<{ chave: string, grupo: string, tipo: string, dados: any, prontoEm: number, versao: number }>} */
  let entradas = lerGuardado(storage, chaveStorage).map((e) => ({ ...e, prontoEm: 0, versao: 0 }));
  let emEnvio = null;
  let timer = null;
  let parada = false;
  let esperandoRetentativaAte = 0;
  let versao = 0;
  const quemEspera = [];
  /** Envios aceitos pelo servidor desde que a fila nasceu. */
  let concluidos = 0;
  /** Último valor entregue a `aoMudarPendencia` (só a virada dispara). */
  let pendenciaAvisada = false;

  const temPendencia = () => entradas.length > 0 || emEnvio != null;

  const avisarPendencia = () => {
    if (!aoMudarPendencia) return;
    const agoraTem = temPendencia();
    if (agoraTem === pendenciaAvisada) return;
    pendenciaAvisada = agoraTem;
    try {
      aoMudarPendencia(agoraTem);
    } catch (err) {
      console.warn('[consulta] aoMudarPendencia falhou:', err?.message || err);
    }
  };

  const guardar = () => {
    if (!storage) return;
    try {
      const pendentes = entradas.map(({ chave, grupo, tipo, dados }) => ({ chave, grupo, tipo, dados }));
      if (pendentes.length === 0) storage.removeItem(chaveStorage);
      else storage.setItem(chaveStorage, JSON.stringify(pendentes));
    } catch {
      /* storage cheio ou indisponível: a fila segue em memória */
    }
  };

  const avisarVazia = (ok) => {
    if (entradas.length > 0 || emEnvio) return;
    while (quemEspera.length) quemEspera.shift()(ok);
  };

  /** A primeira entrada de cada grupo, se ela pode sair agora (as seguintes do grupo esperam por ela). */
  const candidatas = () => {
    const grupos = new Set();
    const lista = [];
    for (const e of entradas) {
      if (grupos.has(e.grupo)) continue;
      grupos.add(e.grupo);
      if (podeEnviar(e)) lista.push(e);
    }
    return lista;
  };

  const proxima = () => {
    const t = agora();
    return candidatas().find((e) => e.prontoEm <= t) ?? null;
  };

  const agendar = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    if (parada || emEnvio || entradas.length === 0) return;
    const prontas = candidatas();
    if (prontas.length === 0) {
      // Só há entradas seguradas por `podeEnviar`: quem espera o esvaziar não fica preso.
      while (quemEspera.length) quemEspera.shift()(false);
      return;
    }
    const t = agora();
    const quando = Math.max(esperandoRetentativaAte, Math.min(...prontas.map((e) => e.prontoEm)));
    timer = setTimeout(bombear, Math.max(0, quando - t));
  };

  async function bombear() {
    timer = null;
    if (parada || emEnvio) return;
    if (esperandoRetentativaAte > agora()) {
      agendar();
      return;
    }
    const e = proxima();
    if (!e) {
      agendar();
      return;
    }
    emEnvio = e;
    // `enfileirar` muda a própria entrada (mesmo objeto) se a chave volta durante o envio: guarda o que saiu.
    const versaoEnviada = e.versao;
    const dadosEnviados = e.dados;
    try {
      const resultado = await executar({ chave: e.chave, grupo: e.grupo, tipo: e.tipo, dados: dadosEnviados });
      const atual = entradas.find((x) => x.chave === e.chave);
      if (atual?.versao === versaoEnviada) {
        entradas = entradas.filter((x) => x.chave !== e.chave);
      }
      // Entrada mais nova da mesma chave (clique durante o envio): continua na fila e sai depois.
      const haMaisNova = Boolean(atual) && atual.versao !== versaoEnviada;
      concluidos += 1;
      guardar();
      onResultado?.({ ...e, dados: dadosEnviados, versao: versaoEnviada }, resultado, { haMaisNova });
    } catch (err) {
      if (erroDefinitivo(err)) {
        // Entrada mais nova da mesma chave (digitou durante o envio): continua na fila; `onDescartada` recebe `haMaisNova`.
        const haMaisNova = entradas.some((x) => x.chave === e.chave && x.versao !== versaoEnviada);
        entradas = entradas.filter((x) => !(x.chave === e.chave && x.versao === versaoEnviada));
        guardar();
        const saiu = { ...e, dados: dadosEnviados, versao: versaoEnviada };
        if (onNaoEntrou && TIPOS_QUE_NAO_ENTRAM.has(e.tipo) && consultaEncerradaPor409(err)) {
          onNaoEntrou(saiu, err);
        } else {
          onDescartada?.(saiu, err, { haMaisNova });
        }
      } else {
        // Rede, 5xx, 408/429 e 401: a entrada fica (mesma chave e versão) e sai de novo depois da espera.
        esperandoRetentativaAte = agora() + ESPERA_RETENTATIVA_MS;
        emEnvio = null;
        while (quemEspera.length) quemEspera.shift()(false);
        agendar();
        return;
      }
    }
    emEnvio = null;
    avisarPendencia();
    avisarVazia(true);
    agendar();
  }

  const fila = {
    /** Põe (ou substitui) a entrada da `chave`. Mesmos `dados` não reiniciam a espera. */
    enfileirar({ chave, grupo = chave, tipo, dados, debounceMs = 0 }) {
      if (parada) return;
      const prontoEm = agora() + debounceMs;
      const atual = entradas.find((x) => x.chave === chave);
      versao += 1;
      if (atual) {
        const iguais = JSON.stringify(atual.dados) === JSON.stringify(dados);
        atual.dados = dados;
        atual.tipo = tipo;
        atual.versao = versao;
        if (!iguais) atual.prontoEm = prontoEm;
      } else {
        entradas.push({ chave, grupo, tipo, dados, prontoEm, versao });
      }
      guardar();
      avisarPendencia();
      agendar();
    },
    /** Tira da fila as entradas cuja chave começa com `prefixo` (ex.: linha removida antes de enviar). */
    descartar(prefixo) {
      entradas = entradas.filter((x) => !x.chave.startsWith(prefixo));
      guardar();
      avisarPendencia();
      agendar();
    },
    /** Quantos envios o servidor aceitou desde que a fila nasceu (releitura mais velha que isso é descartada). */
    enviosConcluidos() {
      return concluidos;
    },
    /** `true` se há entrada pendente (ou em envio) com a chave começando por `prefixo`. */
    temPendente(prefixo) {
      return (
        (emEnvio != null && emEnvio.chave.startsWith(prefixo))
        || entradas.some((x) => x.chave.startsWith(prefixo))
      );
    },
    /** Tipos (`modulo`, `item`, `itemNovo`...) do que ainda não saiu, sem repetição. */
    tiposPendentes() {
      const lista = emEnvio && !entradas.includes(emEnvio) ? [...entradas, emEnvio] : entradas;
      return [...new Set(lista.map((x) => x.tipo))];
    },
    /**
     * Cópia do que ainda não saiu (entradas e a que está em envio), com `chave`, `grupo`, `tipo` e `dados`.
     * Não muda a fila. Serve a quem precisa guardar o texto antes de esquecer a fila (consulta fechada).
     */
    listarPendentes() {
      const lista = emEnvio && !entradas.includes(emEnvio) ? [...entradas, emEnvio] : entradas;
      return lista.map(({ chave, grupo, tipo, dados }) => ({ chave, grupo, tipo, dados }));
    },
    tamanho() {
      return entradas.length + (emEnvio && !entradas.includes(emEnvio) ? 1 : 0);
    },
    /** Envia tudo já, sem esperar o debounce. Resolve `true` quando esvazia; `false` se um envio falhou. */
    esvaziar() {
      if (entradas.length === 0 && !emEnvio) return Promise.resolve(true);
      entradas.forEach((x) => { x.prontoEm = 0; });
      esperandoRetentativaAte = 0;
      const p = new Promise((resolve) => quemEspera.push(resolve));
      agendar();
      return p;
    },
    /** Reavalia o que pode sair (ex.: `podeEnviar` passou a liberar uma entrada segurada). */
    reagendar() {
      agendar();
    },
    /** Para os timers; o que ficou pendente continua no sessionStorage para a próxima vez. */
    parar() {
      parada = true;
      if (timer) clearTimeout(timer);
      timer = null;
      while (quemEspera.length) quemEspera.shift()(false);
    },
    /** Esquece tudo (consulta fechada): limpa memória e storage. */
    limpar() {
      entradas = [];
      guardar();
      this.parar();
      // O envio em curso (se houver) termina sozinho; a pendência que se conta aqui é a da fila esquecida.
      if (!emEnvio) avisarPendencia();
    },
  };

  // O que veio do storage (F5, ou saída e novo login da mesma pessoa) sai sozinho, sem esperar novo envio.
  if (entradas.length > 0) {
    avisarPendencia();
    agendar();
  }

  return fila;
}
