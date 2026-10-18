import { useCallback, useEffect, useRef } from 'react';
import { atendimentosApi, pacientesGaleriaApi } from '../../services/api';
import { useAviso } from '../../contexts/useAviso.js';
import { PREFIXO_AVISO } from '../../services/avisos/tiposAviso.js';
import { mapLocalPontoToApi } from '../../utils/procedimentoMapaPayload.js';
import { formatGaleriaLegendaForUpload, GALERIA_CATEGORIA, normalizePacienteGaleriaResponse } from '../../utils/pacienteGaleria.js';
import { getVistaLabel } from '../../constants/vistasMapaAplicacao.js';
import { comTentativas } from './useEnvioFotosConsulta.js';

const DEBOUNCE_MS = 700;
const MSG_FALHA = 'Falha ao salvar mapa de aplicação.';

function mensagemDoErro(err) {
  const doCorpo = err?.body && typeof err.body === 'object'
    ? String(err.body.message || err.body.detail || '')
    : '';
  if (err?.status >= 400 && err?.status < 500 && doCorpo) return doCorpo;
  return MSG_FALHA;
}

function marcacoesDo(pontosPorVista) {
  const marcacoes = [];
  for (const [vista, lista] of Object.entries(pontosPorVista || {})) {
    const vistaCodigo = String(vista || '').trim();
    if (!vistaCodigo || !Array.isArray(lista)) continue;
    for (const p of lista) {
      const pt = mapLocalPontoToApi(p);
      marcacoes.push({
        anguloFotoCodigo: vistaCodigo,
        tipoGeometria: pt.tipoGeometria || 'ponto',
        quantidade: pt.quantidade,
        tamanho: pt.tamanho,
        catalogoProcedimentoSaudeId: pt.catalogoProcedimentoSaudeId || pt.catalogoId || null,
        procedimentoIndex: pt.procedimentoIndex != null ? pt.procedimentoIndex : null,
        corHex: pt.cor || pt.corHex || null,
        vertices: pt.vertices?.length ? pt.vertices : [{ ordem: 1, posX: pt.posX, posY: pt.posY }],
      });
    }
  }
  return marcacoes;
}

/** P2: a mesma legenda que a foto da vista ganha hoje no encerrar (persistirMapaAplicacao.js, uploadModeloFoto). */
export const legendaDaFotoDaVista = (vista) =>
  formatGaleriaLegendaForUpload(GALERIA_CATEGORIA.MAPA, getVistaLabel(vista) || vista);

const ehRetorno = (consulta) => String(consulta?.tipoProcedimentoCodigo || '').toLowerCase() === 'retorno';

/**
 * C4: rascunho do mapa de cada item da consulta no servidor, sem procedimento feito. Salva 700 ms depois da última
 * mudança, só o item com vista suja, com as tentativas da fila de fotos (rede e 5xx; 4xx nunca) e o aviso de erro.
 * Hidrata do rascunho do item ao entrar nele e a cada aviso PROCEDIMENTO; a rebusca nunca sobrescreve vista suja.
 * A foto da vista sobe como foto MAPA da consulta só para o rascunho; o estado do mapa não guarda esse id, para o
 * encerrar de hoje seguir igual até a Etapa 3.
 *
 * @param {{
 *   consulta: { id: string, pacienteId: string, tipoProcedimentoCodigo?: string } | null,
 *   itemId: string | null,
 *   mapaState: ReturnType<typeof import('./useMapaAplicacaoState.js').useMapaAplicacaoState>,
 *   roleUserId: string | null,
 *   avisarErro: (mensagem: string) => void,
 *   debounceMs?: number,
 *   esperasMs?: number[],
 * }} opcoes
 */
export function useMapaRascunhoAutosave({
  consulta,
  itemId,
  mapaState,
  roleUserId,
  avisarErro,
  debounceMs = DEBOUNCE_MS,
  esperasMs,
}) {
  const consultaId = consulta && !ehRetorno(consulta) ? consulta.id : null;
  const pacienteId = consulta?.pacienteId ?? null;
  const { pontosPorVista, fotosPorVista, fotoGaleriaIdPorVista } = mapaState;
  const sujas = mapaState.getDirtyVistas();
  const chaveSujas = sujas.join('|');

  const atualRef = useRef(null);
  const timerRef = useRef(null);
  const pendenteRef = useRef(null);
  const filaPorItemRef = useRef(new Map());
  const fotoIdPorBlobRef = useRef(new WeakMap());
  const salvoNoServidorRef = useRef(new Set());
  const hidratadosRef = useRef(new Set());
  const opcoesRef = useRef({ roleUserId, avisarErro, esperasMs, mapaState });

  useEffect(() => {
    atualRef.current = { consultaId, itemId, pontosPorVista, fotosPorVista, fotoGaleriaIdPorVista, sujas };
    opcoesRef.current = { roleUserId, avisarErro, esperasMs, mapaState };
  });

  const fotoDaVista = useCallback(async (tarefa, vista, foto) => {
    if (foto?.fotoGaleriaId) return String(foto.fotoGaleriaId);
    if (!(foto?.blob instanceof Blob)) return tarefa.fotoGaleriaIdPorVista?.[vista] ?? null;
    const conhecido = fotoIdPorBlobRef.current.get(foto.blob);
    if (conhecido) return conhecido;
    const { roleUserId: rid, esperasMs: esperas } = opcoesRef.current;
    const dto = await comTentativas(() => pacientesGaleriaApi.upload(tarefa.pacienteId, foto.blob, {
      roleUserId: rid,
      tipoFotoCodigo: 'MAPA',
      legenda: legendaDaFotoDaVista(vista),
      atendimentoId: tarefa.consultaId,
      atendimentoItemId: tarefa.itemId,
    }), esperas);
    if (!dto?.id) return null;
    fotoIdPorBlobRef.current.set(foto.blob, String(dto.id));
    return String(dto.id);
  }, []);

  const salvar = useCallback(async (tarefa) => {
    const { esperasMs: esperas, avisarErro: avisar, mapaState: ms } = opcoesRef.current;
    try {
      const fotos = {};
      const vistas = new Set([
        ...Object.keys(tarefa.fotosPorVista || {}),
        ...Object.keys(tarefa.fotoGaleriaIdPorVista || {}),
      ]);
      for (const vista of vistas) {
        const id = await fotoDaVista(tarefa, vista, tarefa.fotosPorVista?.[vista]);
        if (id) fotos[vista] = id;
      }
      const marcacoes = marcacoesDo(tarefa.pontosPorVista);
      const chave = `${tarefa.consultaId}:${tarefa.itemId}`;
      if (!marcacoes.length && !Object.keys(fotos).length && !salvoNoServidorRef.current.has(chave)) return;
      await comTentativas(
        () => atendimentosApi.salvarMapa(tarefa.consultaId, tarefa.itemId, { fotoGaleriaIdPorVista: fotos, marcacoes }),
        esperas,
      );
      salvoNoServidorRef.current.add(chave);
      const agora = atualRef.current;
      if (agora?.consultaId !== tarefa.consultaId || agora?.itemId !== tarefa.itemId) return;
      for (const vista of tarefa.sujas) {
        const igual = agora.pontosPorVista?.[vista] === tarefa.pontosPorVista?.[vista]
          && agora.fotosPorVista?.[vista] === tarefa.fotosPorVista?.[vista];
        if (igual) ms.clearDirty(vista);
      }
    } catch (err) {
      console.warn('[consulta] Rascunho do mapa não salvo:', err?.message || err);
      avisar?.(mensagemDoErro(err));
    }
  }, [fotoDaVista]);

  const enfileirar = useCallback((tarefa) => {
    const fila = filaPorItemRef.current;
    const anterior = fila.get(tarefa.itemId) ?? Promise.resolve();
    const proxima = anterior.then(() => salvar(tarefa));
    fila.set(tarefa.itemId, proxima);
    proxima.finally(() => {
      if (fila.get(tarefa.itemId) === proxima) fila.delete(tarefa.itemId);
    });
  }, [salvar]);

  const descarregar = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    const tarefa = pendenteRef.current;
    pendenteRef.current = null;
    if (tarefa) enfileirar(tarefa);
  }, [enfileirar]);

  // Troca de item (aba do lote) ou saída da consulta: o que estava esperando o debounce sai na hora, para o item dele.
  useEffect(() => descarregar, [consultaId, itemId, descarregar]);

  useEffect(() => {
    if (!consultaId || !itemId || !pacienteId || !chaveSujas) return;
    pendenteRef.current = {
      consultaId,
      itemId,
      pacienteId,
      pontosPorVista,
      fotosPorVista,
      fotoGaleriaIdPorVista,
      sujas: chaveSujas.split('|'),
    };
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(descarregar, debounceMs);
  }, [consultaId, itemId, pacienteId, chaveSujas, pontosPorVista, fotosPorVista, fotoGaleriaIdPorVista, debounceMs,
    descarregar]);

  const hidratar = useCallback(async (cid, iid, pid) => {
    let dto;
    try {
      dto = await atendimentosApi.buscarMapa(cid, iid);
    } catch (err) {
      console.warn('[consulta] Falha ao buscar o rascunho do mapa:', err?.message || err);
      return;
    }
    const agora = atualRef.current;
    if (!dto || agora?.consultaId !== cid || agora?.itemId !== iid) return;
    salvoNoServidorRef.current.add(`${cid}:${iid}`);
    const { mapaState: ms } = opcoesRef.current;
    const preservar = new Set(agora.sujas);
    const { applied, data } = ms.hydrateFromApi(dto, { preservarVistas: [...preservar] });
    if (!applied) return;
    const porVista = Object.entries(data.fotoGaleriaIdPorVista || {})
      .filter(([vista, fid]) => !preservar.has(vista) && agora.fotosPorVista?.[vista]?.fotoGaleriaId !== String(fid)
        && fotoIdPorBlobRef.current.get(agora.fotosPorVista?.[vista]?.blob) !== String(fid));
    if (!porVista.length) return;
    let itens = [];
    try {
      itens = normalizePacienteGaleriaResponse(await pacientesGaleriaApi.list(pid));
    } catch {
      itens = [];
    }
    for (const [vista, fid] of porVista) {
      const item = itens.find((i) => String(i.serverId) === String(fid));
      if (!item?.url) continue;
      try {
        const blob = await pacientesGaleriaApi.fetchArquivoBlob(item.url);
        if (atualRef.current?.itemId !== iid || atualRef.current?.sujas.includes(vista)) continue;
        ms.setFotoVista(vista, { displayUrl: URL.createObjectURL(blob), fotoGaleriaId: String(fid), source: 'galeria' });
        ms.clearDirty(vista);
      } catch {
        /* foto indisponível — as marcações já entraram */
      }
    }
  }, []);

  useEffect(() => {
    if (!consultaId || !itemId || !pacienteId) return;
    const chave = `${consultaId}:${itemId}`;
    if (hidratadosRef.current.has(chave)) return;
    hidratadosRef.current.add(chave);
    hidratar(consultaId, itemId, pacienteId);
  }, [consultaId, itemId, pacienteId, hidratar]);

  const aoAvisoDoMapa = useCallback(() => {
    const agora = atualRef.current;
    if (agora?.consultaId && agora?.itemId && pacienteId) hidratar(agora.consultaId, agora.itemId, pacienteId);
  }, [hidratar, pacienteId]);
  useAviso(PREFIXO_AVISO.PROCEDIMENTO, aoAvisoDoMapa);

  /** Salva na hora o que espera o debounce e aguarda os envios do mapa. Usado pelo encerrar e pelo "Apenas sair". */
  const aguardarMapa = useCallback(async () => {
    descarregar();
    while (filaPorItemRef.current.size > 0) {
      await Promise.allSettled([...filaPorItemRef.current.values()]);
    }
  }, [descarregar]);

  return { aguardarMapa };
}
