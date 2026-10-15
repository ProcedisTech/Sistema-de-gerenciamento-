import { useCallback, useEffect, useRef } from 'react';
import { atendimentosApi, pacientesGaleriaApi } from '../../services/api';
import { convertToWebP } from '../../utils/imageUtils.js';
import { mapearItensDaSessao, textoDasFotosNaoEnviadas } from '../consulta/consultaServidor.js';
import { mergeFotosPorId } from '../consulta/mergeFotosPorId.js';
import { formatGaleriaLegendaForUpload, GALERIA_CATEGORIA } from '../../utils/pacienteGaleria.js';

const ESPERAS_MS = [2000, 4000, 8000];

/** Só a anotação não subiu: a foto já está no servidor (não entra no lote das que não foram enviadas). */
const MSG_ANOTACAO_NAO_ENVIADA = 'A foto foi enviada, mas a anotação não. Escreva a anotação de novo.';

/** Só erro de rede e 5xx voltam a ser tentados; 4xx nunca. */
export const deveTentarDeNovo = (err) => !err?.status || err.status >= 500;

/** Mesmo tipo que o encerrar de hoje dá às fotos do procedimento (AppRefactored, uploadProcedureCapturedPhotos). */
export function tipoDaFotoDoProcedimento(meta) {
  const categoria = String(meta?.categoria || 'depois').toLowerCase();
  if (categoria === 'antes') return 'ANTES';
  if (categoria === 'mapa') return 'MAPA';
  return 'POS_IMEDIATO';
}

/**
 * P2: só o prefixo da legenda de hoje (`[categoria]`), para o encerrar no servidor completar com o nome do item.
 * A avaliação vai com `[avaliacao]`; a categoria fora da lista (ex.: `pos_imediato`) vira `[antes]`, como hoje.
 */
export function legendaDaFoto(origem, meta) {
  if (origem === 'avaliacao') return formatGaleriaLegendaForUpload(GALERIA_CATEGORIA.AVALIACAO);
  return formatGaleriaLegendaForUpload(String(meta?.categoria || GALERIA_CATEGORIA.DEPOIS).toLowerCase());
}

const PREFIXO_DA_LEGENDA = /^\s*\[([^\]]+)\]/;
const CATEGORIAS_DO_PREFIXO = new Set([GALERIA_CATEGORIA.DEPOIS, 'pos_imediato', GALERIA_CATEGORIA.OUTRO]);

/**
 * Inverso da P2: a categoria (faixa do Step 4) da foto do procedimento que volta do servidor, pelo tipo e pelo
 * prefixo da legenda. ANTES e MAPA vêm do tipo; o resto volta pelo prefixo (`[depois]`, `[pos_imediato]`, `[outro]`).
 * `[antes]` com POS_IMEDIATO é a `pos_imediato` de hoje (o envio troca a categoria fora da lista por `[antes]`).
 * Sem legenda ou sem prefixo conhecido, a regra da P2: `depois`.
 */
export function categoriaDaFotoDoServidor(tipoFotoCodigo, legenda) {
  const tipo = String(tipoFotoCodigo || '').trim().toUpperCase();
  if (tipo === 'ANTES') return GALERIA_CATEGORIA.ANTES;
  if (tipo === 'MAPA') return GALERIA_CATEGORIA.MAPA;
  const m = typeof legenda === 'string' ? legenda.match(PREFIXO_DA_LEGENDA) : null;
  const prefixo = m ? m[1].trim().toLowerCase() : '';
  if (CATEGORIAS_DO_PREFIXO.has(prefixo)) return prefixo;
  if (prefixo === GALERIA_CATEGORIA.ANTES && tipo === 'POS_IMEDIATO') return 'pos_imediato';
  return GALERIA_CATEGORIA.DEPOIS;
}

/**
 * Foto da vista do rascunho do mapa (`useMapaRascunhoAutosave`, `[mapa] <rótulo da vista>`): fica fora das faixas do
 * Step 4, como antes do F5 (ela só aparece no painel do mapa). A da câmera com categoria mapa sobe só com `[mapa]`.
 */
export function ehFotoDaVistaDoMapa(tipoFotoCodigo, legenda) {
  if (String(tipoFotoCodigo || '').trim().toUpperCase() !== 'MAPA' || typeof legenda !== 'string') return false;
  const m = legenda.match(PREFIXO_DA_LEGENDA);
  return Boolean(m) && m[1].trim().toLowerCase() === GALERIA_CATEGORIA.MAPA && legenda.slice(m[0].length).trim() !== '';
}

export async function comTentativas(fn, esperasMs = ESPERAS_MS) {
  for (let tentativa = 0; ; tentativa += 1) {
    try {
      return await fn();
    } catch (err) {
      if (!deveTentarDeNovo(err) || tentativa >= esperasMs.length) throw err;
      await new Promise((resolve) => setTimeout(resolve, esperasMs[tentativa]));
    }
  }
}

const fotoIdDe = (foto, fotoIdPorBlob) =>
  foto?.meta?.fotoId ?? (foto?.blob ? fotoIdPorBlob.get(foto.blob) : null) ?? null;

const ehRetorno = (consulta) => String(consulta?.tipoProcedimentoCodigo || '').toLowerCase() === 'retorno';
const ehAvaliacao = (f) => String(f?.tipoFotoCodigo || '').toUpperCase() === 'AVALIACAO';

const SEM_LINHAS = [];
/** Dona da foto do servidor quando é a aba ativa (lista ao vivo); as outras abas são o índice da linha. */
const ABA_ATIVA = 'ativa';

/** Grava o fotoId na foto do blob e tira a cópia que uma rebusca tenha trazido antes da resposta do envio. */
function comFotoId(lista, blob, fotoId) {
  if (!Array.isArray(lista) || !lista.some((f) => f?.blob === blob)) return lista;
  return lista
    .filter((f) => f?.blob === blob || f?.blob || f?.meta?.fotoId !== fotoId)
    .map((f) => (f?.blob === blob ? { ...f, meta: { ...(f.meta || {}), fotoId } } : f));
}

/** F1: grava a versão do arquivo (`arquivoAtualizadoEm`) na foto do `fotoId` (pela meta ou pelo blob que a subiu). */
function comVersao(lista, fotoId, versao, fotoIdPorBlob) {
  if (!Array.isArray(lista) || !versao) return lista;
  const daFoto = (f) => String(fotoIdDe(f, fotoIdPorBlob) ?? '') === String(fotoId);
  if (!lista.some((f) => daFoto(f) && f?.meta?.arquivoAtualizadoEm !== versao)) return lista;
  return lista.map((f) => (daFoto(f) ? { ...f, meta: { ...(f.meta || {}), arquivoAtualizadoEm: versao } } : f));
}

/** Resposta de `fotoAnotada` quando a anotação ainda vai subir (foto em envio, ou foto que vai subir já anotada). */
const PENDENTE = Object.freeze({ estado: 'pendente' });

/**
 * C3: cada foto tirada na consulta sobe na hora, pelo aparelho que a tirou, com a consulta, o item e o tipo (Y7).
 * B5: remover e anotar foto já enviada viram ações do servidor (só com `fotoId`, P4).
 * P5: a fila mora no nível do AppRefactored e cada envio leva a consulta de quando a foto foi tirada; se a consulta
 * já fechou, o servidor guarda a foto só na galeria.
 * A consulta de retorno fica de fora: o fluxo do Retorno continua com o envio de hoje (ND12).
 *
 * @param {{
 *   consulta: { id: string, pacienteId: string, tipoProcedimentoCodigo?: string, itens?: object[] } | null,
 *   roleUserId: string | null,
 *   fotosAvaliacao: Array<{ blob?: Blob, meta?: object }>,
 *   fotosProcedimento: Array<{ blob?: Blob, meta?: object }>,
 *   procedimentosSessao?: Array<{ fotosSnapshot?: Array<{ blob?: Blob, meta?: object }> }>,
 *   itemDoProcedimentoAtivo: string | null,
 *   aparelho: { setEvaluationCapturedPhotos: Function, setProcedureCapturedPhotos: Function,
 *     setProcedimentosSessao?: Function },
 *   avisarErro: (mensagem: string) => void,
 *   esperasMs?: number[],
 * }} opcoes
 */
export function useEnvioFotosConsulta({
  consulta,
  roleUserId,
  fotosAvaliacao,
  fotosProcedimento,
  procedimentosSessao = SEM_LINHAS,
  itemDoProcedimentoAtivo,
  aparelho,
  avisarErro,
  esperasMs = ESPERAS_MS,
}) {
  const vistosRef = useRef(new WeakSet());
  const envioPorBlobRef = useRef(new Map());
  const fotoIdPorBlobRef = useRef(new WeakMap());
  const pendentesRef = useRef(new Set());
  /** Fotos cujo envio falhou (depois das tentativas): continuam só no aparelho. */
  const naoEnviadasRef = useRef(new WeakSet());
  /** Lote por origem: envios em andamento e falhas; o aviso sai uma vez, quando o último envio da origem termina. */
  const loteRef = useRef({ avaliacao: { emAndamento: 0, falhas: 0 }, procedimento: { emAndamento: 0, falhas: 0 } });
  const aparelhoRef = useRef(aparelho);
  const avisarRef = useRef(avisarErro);
  const esperasRef = useRef(esperasMs);
  const itemAtivoRef = useRef(itemDoProcedimentoAtivo);
  const fotosRef = useRef({ avaliacao: fotosAvaliacao, procedimento: fotosProcedimento, sessao: procedimentosSessao });
  const idsServidorRef = useRef({ consultaId: null, ids: new Set() });
  /** Fotos da vista do mapa já vistas na galeria: não entram e não fazem buscar a galeria de novo. */
  const foraDasFaixasRef = useRef(new Set());

  useEffect(() => {
    aparelhoRef.current = aparelho;
    avisarRef.current = avisarErro;
    esperasRef.current = esperasMs;
    itemAtivoRef.current = itemDoProcedimentoAtivo;
  });

  const rastrear = useCallback((promessa) => {
    pendentesRef.current.add(promessa);
    promessa.finally(() => pendentesRef.current.delete(promessa)).catch(() => {});
    return promessa;
  }, []);

  const gravarFotoId = useCallback((blob, fotoId) => {
    fotoIdPorBlobRef.current.set(blob, fotoId);
    const ap = aparelhoRef.current;
    ap.setEvaluationCapturedPhotos((prev) => comFotoId(prev, blob, fotoId));
    ap.setProcedureCapturedPhotos((prev) => comFotoId(prev, blob, fotoId));
    ap.setProcedimentosSessao?.((prev) => {
      if (!Array.isArray(prev) || !prev.some((p) => p?.fotosSnapshot?.some((f) => f?.blob === blob))) return prev;
      return prev.map((p) => (p?.fotosSnapshot ? { ...p, fotosSnapshot: comFotoId(p.fotosSnapshot, blob, fotoId) } : p));
    });
  }, []);

  const gravarVersao = useCallback((fotoId, versao) => {
    if (!fotoId || !versao) return;
    const mapa = fotoIdPorBlobRef.current;
    const ap = aparelhoRef.current;
    ap.setEvaluationCapturedPhotos((prev) => comVersao(prev, fotoId, versao, mapa));
    ap.setProcedureCapturedPhotos((prev) => comVersao(prev, fotoId, versao, mapa));
    ap.setProcedimentosSessao?.((prev) => {
      if (!Array.isArray(prev)) return prev;
      let mudou = false;
      const proximo = prev.map((p) => {
        if (!p?.fotosSnapshot) return p;
        const nova = comVersao(p.fotosSnapshot, fotoId, versao, mapa);
        if (nova === p.fotosSnapshot) return p;
        mudou = true;
        return { ...p, fotosSnapshot: nova };
      });
      return mudou ? proximo : prev;
    });
  }, []);

  /**
   * PUT do arquivo anotado (com as tentativas). Relança o erro depois da última tentativa: quem chamou decide o
   * aviso. Devolve a resposta do servidor (`{ id, arquivoAtualizadoEm }`) e grava a versão nova na foto.
   */
  const anotarNoServidor = useCallback(async (envio, fotoId, blob) => {
    const webp = await convertToWebP(blob, 0.85, 1920);
    const r = await comTentativas(() => atendimentosApi.anotarFoto(envio.atendimentoId, fotoId, webp), esperasRef.current);
    const versao = r?.arquivoAtualizadoEm ?? null;
    gravarVersao(fotoId, versao);
    return { estado: 'salva', arquivoAtualizadoEm: versao };
  }, [gravarVersao]);

  const removerNoServidor = useCallback(async (atendimentoId, fotoId) => {
    try {
      await comTentativas(() => atendimentosApi.removerFoto(atendimentoId, fotoId), esperasRef.current);
    } catch (err) {
      console.warn('[consulta] Foto removida no aparelho e não no servidor:', err?.message || err);
    }
  }, []);

  const enviar = useCallback((foto, origem, base) => {
    const blob = foto.blob;
    const envio = {
      atendimentoId: base.atendimentoId,
      origem,
      removida: false,
      anotadaCom: null,
      promessa: null,
    };
    envioPorBlobRef.current.set(blob, envio);
    const lote = loteRef.current[origem];
    lote.emAndamento += 1;
    envio.promessa = rastrear((async () => {
      try {
        const webp = await convertToWebP(blob, 0.85, 1920);
        const dto = await comTentativas(() => pacientesGaleriaApi.upload(base.pacienteId, webp, {
          roleUserId: base.roleUserId,
          tipoFotoCodigo: origem === 'avaliacao' ? 'AVALIACAO' : tipoDaFotoDoProcedimento(foto.meta),
          legenda: legendaDaFoto(origem, foto.meta),
          atendimentoId: base.atendimentoId,
          atendimentoItemId: origem === 'procedimento' ? base.itemId : null,
        }), esperasRef.current);
        const fotoId = dto?.id;
        if (!fotoId) return;
        if (envio.removida) {
          await removerNoServidor(envio.atendimentoId, fotoId);
          return;
        }
        if (envio.anotadaCom) {
          vistosRef.current.add(envio.anotadaCom);
          gravarFotoId(envio.anotadaCom, fotoId);
          // A anotação feita durante o envio: o editor já resolveu 'pendente', então o aviso de falha sai daqui.
          try {
            await anotarNoServidor(envio, fotoId, envio.anotadaCom);
          } catch (err) {
            console.warn('[consulta] Foto anotada não enviada:', err?.message || err);
            avisarRef.current?.(MSG_ANOTACAO_NAO_ENVIADA);
          }
          return;
        }
        gravarFotoId(blob, fotoId);
      } catch (err) {
        console.warn('[consulta] Foto não enviada:', err?.message || err);
        naoEnviadasRef.current.add(envio.anotadaCom ?? blob);
        if (envio.anotadaCom) vistosRef.current.delete(envio.anotadaCom);
        lote.falhas += 1;
      } finally {
        envioPorBlobRef.current.delete(blob);
        lote.emAndamento -= 1;
        if (lote.emAndamento === 0 && lote.falhas > 0) {
          const falhas = lote.falhas;
          lote.falhas = 0;
          avisarRef.current?.(textoDasFotosNaoEnviadas(falhas, origem));
        }
      }
    })());
  }, [anotarNoServidor, gravarFotoId, rastrear, removerNoServidor]);

  const consultaId = consulta && !ehRetorno(consulta) ? consulta.id : null;
  const consultaPacienteId = consulta?.pacienteId ?? null;
  useEffect(() => {
    if (!consultaId || !consultaPacienteId) return;
    const base = { atendimentoId: consultaId, pacienteId: consultaPacienteId, roleUserId };
    const novas = (lista, origem) => {
      for (const foto of Array.isArray(lista) ? lista : []) {
        const blob = foto?.blob;
        if (!blob || vistosRef.current.has(blob)) continue;
        vistosRef.current.add(blob);
        if (foto.meta?.fotoId) continue;
        enviar(foto, origem, { ...base, itemId: itemAtivoRef.current });
      }
    };
    novas(fotosAvaliacao, 'avaliacao');
    novas(fotosProcedimento, 'procedimento');
  }, [consultaId, consultaPacienteId, roleUserId, fotosAvaliacao, fotosProcedimento, enviar]);

  // Y11: a rebusca (F5, outro aparelho, aviso GALERIA) junta as fotos do servidor por fotoId. Cada foto do
  // procedimento vai para a aba do seu item (`atendimentoItemId`): a ativa na lista ao vivo, as outras no
  // `fotosSnapshot` da linha, que a troca de aba restaura. Foto sem item entra na aba ativa, como antes; foto de item
  // sem aba espera a aba existir. A categoria (faixa) volta pelo tipo e pela legenda (inverso da P2). A foto da vista
  // do mapa não entra em faixa nenhuma (antes do F5 ela não estava em nenhuma).
  const fotosServidor = consultaId ? consulta.fotos : null;
  /** Item do servidor de cada linha da sessão; muda só quando a ligação aba ↔ item muda. */
  const chaveAbas = consultaId
    ? mapearItensDaSessao(procedimentosSessao, consulta.itens).map((id) => id ?? '').join('|')
    : '';
  useEffect(() => {
    fotosRef.current = { avaliacao: fotosAvaliacao, procedimento: fotosProcedimento, sessao: procedimentosSessao };
  }, [fotosAvaliacao, fotosProcedimento, procedimentosSessao]);
  useEffect(() => {
    if (!consultaId || !consultaPacienteId || !Array.isArray(fotosServidor)) return undefined;
    let cancelado = false;
    const anteriores = idsServidorRef.current.consultaId === consultaId ? idsServidorRef.current.ids : new Set();
    const itemAtivo = itemDoProcedimentoAtivo != null ? String(itemDoProcedimentoAtivo) : null;
    const abas = chaveAbas.split('|').map((id) => id || null);
    const donaDa = (f) => {
      const item = f.atendimentoItemId != null ? String(f.atendimentoItemId) : null;
      if (!item || item === itemAtivo) return ABA_ATIVA;
      const indice = abas.indexOf(item);
      return indice >= 0 ? indice : null;
    };
    const { avaliacao, procedimento, sessao } = fotosRef.current;
    const locais = [
      ...(avaliacao || []),
      ...(procedimento || []),
      ...(Array.isArray(sessao) ? sessao : []).flatMap((linha) => linha?.fotosSnapshot || []),
    ];
    /** Fotos que o aparelho já tem em alguma aba: nunca entram de novo (nem na aba que a troca vai restaurar). */
    const noAparelho = new Set(locais.map((f) => fotoIdDe(f, fotoIdPorBlobRef.current)).filter(Boolean).map(String));
    /** F1: versão (`arquivoAtualizadoEm`) que o aparelho conhece de cada foto; foto sem versão na meta não conta. */
    const versaoNoAparelho = new Map();
    for (const f of locais) {
      const id = fotoIdDe(f, fotoIdPorBlobRef.current);
      if (id && f?.meta?.arquivoAtualizadoEm) versaoNoAparelho.set(String(id), f.meta.arquivoAtualizadoEm);
    }
    const foraDasFaixas = foraDasFaixasRef.current;
    const versaoMudou = (f) => {
      const local = versaoNoAparelho.get(String(f.id));
      return Boolean(local) && Boolean(f.arquivoAtualizadoEm) && local !== f.arquivoAtualizadoEm;
    };
    const faltam = fotosServidor.some((f) => (!noAparelho.has(String(f.id)) && !foraDasFaixas.has(String(f.id))
      && (ehAvaliacao(f) || donaDa(f) !== null)) || versaoMudou(f));
    (async () => {
      const urls = new Map();
      const legendas = new Map();
      if (faltam) {
        try {
          const r = await pacientesGaleriaApi.list(consultaPacienteId);
          const itens = Array.isArray(r) ? r : (r?.fotos || r?.itens || []);
          for (const item of itens) {
            if (!item?.id) continue;
            if (item.url) urls.set(String(item.id), item.url);
            legendas.set(String(item.id), item.legenda ?? null);
          }
        } catch (err) {
          console.warn('[consulta] Falha ao buscar as URLs das fotos:', err?.message || err);
        }
      }
      if (cancelado) return;
      for (const f of fotosServidor) {
        if (ehFotoDaVistaDoMapa(f.tipoFotoCodigo, legendas.get(String(f.id)))) foraDasFaixas.add(String(f.id));
      }
      const urlDe = (id) => urls.get(id) ?? null;
      const daAba = (aba) => ({
        idsAnteriores: anteriores,
        urlDe,
        entra: (f) => !ehAvaliacao(f) && donaDa(f) === aba && !noAparelho.has(String(f.id))
          && !foraDasFaixas.has(String(f.id)),
        categoriaDe: (f) => categoriaDaFotoDoServidor(f.tipoFotoCodigo, legendas.get(String(f.id)) ?? null),
        pacienteId: consultaPacienteId,
      });
      const ap = aparelhoRef.current;
      ap.setEvaluationCapturedPhotos((prev) => mergeFotosPorId(prev, fotosServidor, {
        idsAnteriores: anteriores,
        urlDe,
        entra: ehAvaliacao,
        pacienteId: consultaPacienteId,
      }));
      ap.setProcedureCapturedPhotos((prev) => mergeFotosPorId(prev, fotosServidor, daAba(ABA_ATIVA)));
      ap.setProcedimentosSessao?.((prev) => {
        if (!Array.isArray(prev)) return prev;
        let mudou = false;
        const proximo = prev.map((linha, indice) => {
          if (!abas[indice] || abas[indice] === itemAtivo) return linha;
          const lista = Array.isArray(linha?.fotosSnapshot) ? linha.fotosSnapshot : [];
          const nova = mergeFotosPorId(lista, fotosServidor, daAba(indice));
          if (nova === lista) return linha;
          mudou = true;
          return { ...linha, fotosSnapshot: nova };
        });
        return mudou ? proximo : prev;
      });
      idsServidorRef.current = { consultaId, ids: new Set(fotosServidor.map((f) => String(f.id))) };
    })();
    return () => {
      cancelado = true;
    };
  }, [consultaId, consultaPacienteId, fotosServidor, itemDoProcedimentoAtivo, chaveAbas]);

  /** B5: chamado pelo botão de remover de hoje, antes de tirar a foto da lista. */
  const fotoRemovida = useCallback((foto) => {
    if (!consultaId || !foto) return;
    const fotoId = fotoIdDe(foto, fotoIdPorBlobRef.current);
    if (fotoId) {
      rastrear(removerNoServidor(consultaId, fotoId));
      return;
    }
    const envio = foto.blob ? envioPorBlobRef.current.get(foto.blob) : null;
    if (envio) envio.removida = true;
  }, [consultaId, rastrear, removerNoServidor]);

  /**
   * B5/F1: chamado pelo editor ANTES de a anotação substituir a foto na lista (o `meta.fotoId` segue para a nova).
   * Devolve uma Promise que:
   * - foto já no servidor (`fotoId`): resolve `{ estado: 'salva', arquivoAtualizadoEm }` só depois do 2xx do PUT
   *   (com as tentativas) e rejeita com o erro depois da última tentativa — sem aviso aqui: quem avisa é o editor;
   * - foto ainda subindo: guarda o blob anotado para subir com o envio e resolve `{ estado: 'pendente' }`;
   * - foto cujo envio falhou (ou sem envio): o blob anotado vai subir como foto nova quando entrar na lista
   *   (decisão 2: exceção ao F5, a tela avisa) e resolve `{ estado: 'pendente' }`.
   * Fora da consulta (retorno, sem consulta) resolve `{ estado: 'pendente' }`: a foto sobe pelo fluxo de hoje.
   * @returns {Promise<{ estado: 'salva' | 'pendente', arquivoAtualizadoEm?: string | null }>}
   */
  const fotoAnotada = useCallback((foto, blobNovo, origem) => {
    if (!consultaId || !foto || !blobNovo) return Promise.resolve(PENDENTE);
    const fotoId = fotoIdDe(foto, fotoIdPorBlobRef.current);
    if (fotoId) {
      vistosRef.current.add(blobNovo);
      fotoIdPorBlobRef.current.set(blobNovo, fotoId);
      const promessa = anotarNoServidor({ atendimentoId: consultaId, origem }, fotoId, blobNovo);
      rastrear(promessa);
      return promessa.catch((err) => {
        console.warn('[consulta] Foto anotada não enviada:', err?.message || err);
        throw err;
      });
    }
    const envio = foto.blob ? envioPorBlobRef.current.get(foto.blob) : null;
    if (envio) {
      vistosRef.current.add(blobNovo);
      envio.anotadaCom = blobNovo;
      return Promise.resolve(PENDENTE);
    }
    // Envio falhou (ou nunca houve): a foto anotada substitui a original e sobe como foto nova.
    if (foto.blob) naoEnviadasRef.current.delete(foto.blob);
    vistosRef.current.delete(blobNovo);
    return Promise.resolve(PENDENTE);
  }, [anotarNoServidor, consultaId, rastrear]);

  /**
   * Espera todos os envios (com as tentativas) terminarem. Usado pelo encerrar e pelo "Apenas sair". Devolve quantas
   * fotos ainda na tela não subiram (o envio falhou e elas ficaram só no aparelho).
   * @returns {Promise<number>}
   */
  const aguardarPendentes = useCallback(async () => {
    while (pendentesRef.current.size > 0) {
      await Promise.allSettled([...pendentesRef.current]);
    }
    const { avaliacao, procedimento, sessao } = fotosRef.current;
    const naTela = [
      ...(avaliacao || []),
      ...(procedimento || []),
      ...(Array.isArray(sessao) ? sessao : []).flatMap((linha) => linha?.fotosSnapshot || []),
    ];
    const naoEnviadas = new Set(
      naTela.filter((f) => f?.blob && !f.meta?.fotoId && naoEnviadasRef.current.has(f.blob)).map((f) => f.blob),
    );
    return naoEnviadas.size;
  }, []);

  return { fotoRemovida, fotoAnotada, aguardarPendentes };
}
