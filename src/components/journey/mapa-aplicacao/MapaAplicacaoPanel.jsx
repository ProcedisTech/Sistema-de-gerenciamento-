import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, Loader2, MapPin } from 'lucide-react';
import { useToast } from '../../../contexts/useToast.js';
import {
  catalogosApi,
  pacientesGaleriaApi,
  planejamentosApi,
  mapasApi,
} from '../../../services/api.js';
import {
  getPresetsForUnidade,
  getPassoFallback,
  normalizeUnidadeMedida,
} from '../../../constants/quantidadePresets.js';
import {
  VISTAS_MAPA_APLICACAO,
  getVistaLabel,
} from '../../../constants/vistasMapaAplicacao.js';
import { mapApiPontoToLocal } from '../../hooks/useMapeamentoFacialState.js';
import { normalizePacienteGaleriaResponse } from '../../../utils/pacienteGaleria.js';
import { FotoVistaCanvas, GaleriaVistaPickerModal } from '../mapeamento/FotoVistaCanvas.jsx';
import { PontosResumoPanel } from '../mapeamento/PontosResumoPanel.jsx';
import { VistaChipsBar, VistaAtivaHeader } from '../mapeamento/VistaChipsBar.jsx';
import { MapeamentoFullscreenOverlay } from '../mapeamento/MapeamentoFullscreenOverlay.jsx';
import { UnidadeMedidaSelect } from '../mapeamento/UnidadeMedidaSelect.jsx';
import { corParaProcedimento } from '../../../constants/mapeamentoPaletaCores.js';

function EscolherVistaMapaModal({ open, vistasDisponiveis, onSelect, onClose, hasFoto, countPontosVista }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[145] flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-app-border bg-white shadow-app-card"
      >
        <div className="flex items-center justify-between border-b border-[#e2e8f0] px-5 py-4">
          <h3 className="text-[17px] font-bold text-app-ink">Escolher vista</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-[12px] font-semibold text-[#64748b] hover:bg-slate-100"
          >
            Cancelar
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {vistasDisponiveis.map((v) => {
              const comFoto = typeof hasFoto === 'function' ? hasFoto(v.codigo) : false;
              const pontos = typeof countPontosVista === 'function' ? countPontosVista(v.codigo) : 0;
              return (
                <button
                  key={v.codigo}
                  type="button"
                  onClick={() => onSelect?.(v.codigo)}
                  className="rounded-xl border border-[#e2e8f0] bg-white px-4 py-3 text-left hover:border-app-accent hover:bg-app-nav-active"
                >
                  <span className="block text-[13px] font-bold text-app-ink">{v.label || getVistaLabel(v.codigo)}</span>
                  <span className="text-[11px] font-medium text-[#94a3b8]">
                    {comFoto ? 'Com foto' : 'Sem foto'}
                    {pontos > 0 ? ` · ${pontos} ponto(s)` : ''}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function resolvePontosPlanoVista(procedimentosComPontos, catalogoId, vista) {
  const proc = (procedimentosComPontos || []).find(
    (p) => String(p.catalogoProcedimentoSaudeId) === String(catalogoId),
  );
  const lista = proc?.pontosPorVista?.[vista];
  return Array.isArray(lista) && lista.length > 0 ? lista : null;
}

async function fetchPontosPlanoVista(planejamentoId, planejamentoItemId, vista) {
  const det = await planejamentosApi.detalhe(planejamentoId);
  const item = (det?.itens ?? []).find(
    (i) => String(i.planejamentoItemId ?? i.id) === String(planejamentoItemId),
  );
  if (!item) return [];

  const porVista = item.pontosPorVista || item.pontosPorAngulo;
  if (porVista && typeof porVista === 'object' && Array.isArray(porVista[vista])) {
    return porVista[vista];
  }

  const lista = Array.isArray(item.pontos) ? item.pontos : [];
  return lista
    .filter((p) => String(p?.anguloFotoCodigo || p?.vista || '').trim() === vista)
    .map((p, idx) => mapApiPontoToLocal(p, idx + 1));
}

export function MapaAplicacaoPanel({
  mapaState,
  pacienteId,
  roleUserId: _roleUserId,
  procedimentoFeitoId,
  catalogoId,
  nomeProcedimento,
  procedimentosSessao = [],
  planejamentoItemId,
  planejamentoId,
  procedimentosComPontos = [],

  pendingCapture,
  onCaptureConsumed,
  onPrepareCapture,
  onEnsureProcedimento,
  onMudarCorProcedimento,
  disabled = false,
  disabledHint = 'Preencha o nome do procedimento (com item do catálogo) para habilitar o mapa.',
}) {
  const toast = useToast();

  const handleMudarCorProcedimento = useCallback((procId, novaCor, outroProcId, corAntiga) => {
    mapaState.atualizarCorProcedimento?.(procId, novaCor, outroProcId, corAntiga);
    onMudarCorProcedimento?.(procId, novaCor, outroProcId, corAntiga);
  }, [mapaState, onMudarCorProcedimento]);
  const [galeriaOpen, setGaleriaOpen] = useState(false);
  const [galeriaItems, setGaleriaItems] = useState([]);
  const [galeriaLoading, setGaleriaLoading] = useState(false);
  const [galeriaSelecting, setGaleriaSelecting] = useState(false);
  const [photoActionBusy, setPhotoActionBusy] = useState(false);
  const [vistaModalOpen, setVistaModalOpen] = useState(false);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [hydrating, setHydrating] = useState(false);
  const [unidadeMedida, setUnidadeMedida] = useState('un');
  const [passo, setPasso] = useState(1);
  const loadGaleriaInFlightRef = useRef(false);
  const selectGaleriaInFlightRef = useRef(false);

  const mediaBusy = galeriaLoading || galeriaSelecting || photoActionBusy;

  // Lista normalizada de procedimentos da sessão
  const listaProcedimentosSessao = useMemo(() => {
    const isPlaceholder = (nome) => !nome || /^Procedimento\s*\d*$/i.test(String(nome).trim());

    if (Array.isArray(procedimentosSessao) && procedimentosSessao.length > 0) {
      const validos = procedimentosSessao.filter((p) => {
        const cid = p.catalogoProcedimentoSaudeId || p.nomeProcedimentoCatalogoId || p.catalogoId;
        const nome = p.nomeProcedimento || p.procedimentoNome || p.nome;
        return Boolean((cid && String(cid).trim()) || (nome && String(nome).trim() && !isPlaceholder(nome)));
      });
      if (validos.length > 0) {
        return validos
          .map((p, idx) => {
            const rawNome = p.nomeProcedimento || p.procedimentoNome || p.nome;
            const cid = p.catalogoProcedimentoSaudeId || p.nomeProcedimentoCatalogoId || p.catalogoId || p.id;
            return {
              id: String(cid || `idx_${idx}`),
              nome: rawNome,
              unidadeMedida: p.unidadeMedida || 'u',
              corHex: p.corHex || (cid ? corParaProcedimento(cid) : null),
              index: idx,
            };
          })
          .filter((item) => item.nome && !isPlaceholder(item.nome));
      }
    }
    if (catalogoId && nomeProcedimento && String(nomeProcedimento).trim() && !isPlaceholder(nomeProcedimento)) {
      return [{
        id: String(catalogoId),
        nome: String(nomeProcedimento),
        unidadeMedida: 'u',
        corHex: corParaProcedimento(catalogoId),
        index: 0,
      }];
    }
    return [];
  }, [procedimentosSessao, catalogoId, nomeProcedimento]);

  const [procedimentoArmadoId, setProcedimentoArmadoId] = useState(() => {
    return listaProcedimentosSessao[0]?.id || (catalogoId ? String(catalogoId) : null);
  });

  useEffect(() => {
    if (listaProcedimentosSessao.length > 0) {
      const existe = listaProcedimentosSessao.some((p) => p.id === procedimentoArmadoId);
      if (!existe) {
        setProcedimentoArmadoId(listaProcedimentosSessao[0].id);
      }
    }
  }, [listaProcedimentosSessao, procedimentoArmadoId]);

  const procedimentoArmado = useMemo(() => {
    const proc = listaProcedimentosSessao.find((p) => p.id === procedimentoArmadoId);
    if (proc) return proc;
    return listaProcedimentosSessao[0] || (catalogoId ? { id: String(catalogoId), nome: String(nomeProcedimento || '') } : null);
  }, [listaProcedimentosSessao, procedimentoArmadoId, catalogoId, nomeProcedimento]);

  const hasProcedimentoValido = useMemo(() => {
    if (listaProcedimentosSessao.length > 0) return true;
    if (catalogoId && nomeProcedimento && String(nomeProcedimento).trim() && !(/^Procedimento\s*\d*$/i.test(String(nomeProcedimento).trim()))) {
      return true;
    }
    return false;
  }, [listaProcedimentosSessao, catalogoId, nomeProcedimento]);

  const isPanelDisabled = disabled || !hasProcedimentoValido;

  const presets = useMemo(() => getPresetsForUnidade(unidadeMedida), [unidadeMedida]);

  const handleUnidadeMedidaChange = useCallback((unit) => {
    const u = normalizeUnidadeMedida(unit);
    setUnidadeMedida(u);
    setPasso(getPassoFallback(u, undefined));
  }, []);

  const vistasPreenchidas = mapaState.getVistasPreenchidas();
  const vistaAtual = mapaState.vistaAtual;
  const fotoAtual = mapaState.getFotoVista(vistaAtual);
  const gruposPontos = mapaState.getPontosVista(
    vistaAtual,
    procedimentoArmado?.id || catalogoId,
    procedimentoArmado?.nome || nomeProcedimento,
    listaProcedimentosSessao,
  );
  const setFotoVista = mapaState.setFotoVista;
  const setVistaAtual = mapaState.setVistaAtual;
  const shouldHydrateFromServer = mapaState.shouldHydrateFromServer;
  const markHydratedFromServer = mapaState.markHydratedFromServer;
  const hydrateFromApi = mapaState.hydrateFromApi;
  const clearAllDirty = mapaState.clearAllDirty;

  // gruposSessao: para o PontosResumoPanel mostrar totais de todas as vistas da sessão
  const gruposSessao = useMemo(() => {
    const pontosPorVista = mapaState.pontosPorVista || {};
    if (Object.keys(pontosPorVista).length === 0) return [];
    const todosPontos = Object.values(pontosPorVista).flat();
    if (todosPontos.length === 0) return [];

    if (listaProcedimentosSessao.length > 0) {
      return listaProcedimentosSessao.map((proc) => {
        const procPontosPorVista = {};
        Object.entries(pontosPorVista).forEach(([vista, pts]) => {
          if (Array.isArray(pts)) {
            const filtrados = pts.filter((p) => {
              if (p.catalogoProcedimentoSaudeId || p.catalogoId) {
                return String(p.catalogoProcedimentoSaudeId || p.catalogoId) === proc.id;
              }
              return proc.index === 0;
            });
            if (filtrados.length > 0) {
              procPontosPorVista[vista] = filtrados;
            }
          }
        });

        return {
          catalogoProcedimentoSaudeId: proc.id,
          nomeProcedimento: proc.nome,
          unidadeMedida: proc.unidadeMedida || 'u',
          pontosPorVista: procPontosPorVista,
        };
      });
    }

    if (!catalogoId) return [];
    return [{
      catalogoProcedimentoSaudeId: String(catalogoId),
      nomeProcedimento: String(nomeProcedimento || ''),
      unidadeMedida: unidadeMedida || 'u',
      pontosPorVista,
    }];
  }, [mapaState.pontosPorVista, listaProcedimentosSessao, catalogoId, nomeProcedimento, unidadeMedida]);

  const handleAddPontoComProcedimento = useCallback(
    (vista, pontoData) => {
      const targetProcId = pontoData?.catalogoProcedimentoSaudeId || pontoData?.catalogoId || procedimentoArmado?.id || catalogoId;
      const targetProc = (listaProcedimentosSessao || []).find((p) => String(p.id) === String(targetProcId)) || procedimentoArmado;
      return mapaState.adicionarPonto(vista, {
        ...pontoData,
        catalogoProcedimentoSaudeId: targetProc?.id || targetProcId,
        catalogoId: targetProc?.id || targetProcId,
        procedimentoIndex: targetProc?.index ?? 0,
        nomeProcedimento: targetProc?.nome || pontoData?.nomeProcedimento || nomeProcedimento,
        cor: targetProc?.corHex || pontoData?.cor || (targetProcId ? corParaProcedimento(targetProcId) : null),
      });
    },
    [mapaState, procedimentoArmado, catalogoId, nomeProcedimento, listaProcedimentosSessao],
  );

  useEffect(() => {
    const targetCatId = procedimentoArmado?.id || catalogoId;
    if (!targetCatId) {
      setUnidadeMedida('un');
      setPasso(1);
      return;
    }
    let cancelled = false;
    catalogosApi
      .get(targetCatId)
      .then((cat) => {
        if (cancelled) return;
        const unit = normalizeUnidadeMedida(cat?.unidadeMedida);
        setUnidadeMedida(unit);
        setPasso(getPassoFallback(unit, cat?.passo));
      })
      .catch(() => {
        if (!cancelled) {
          setUnidadeMedida('un');
          setPasso(1);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [catalogoId, procedimentoArmado?.id]);

  useEffect(() => {
    if (!pendingCapture?.blob || !pendingCapture?.vista) return;
    const url = URL.createObjectURL(pendingCapture.blob);
    setFotoVista(pendingCapture.vista, {
      displayUrl: url,
      blob: pendingCapture.blob,
      source: 'capture',
    });
    setVistaAtual(pendingCapture.vista);
    onCaptureConsumed?.();
  }, [pendingCapture, setFotoVista, setVistaAtual, onCaptureConsumed]);

  useEffect(() => {
    if (!procedimentoFeitoId || !pacienteId) return undefined;
    if (typeof shouldHydrateFromServer === 'function' && !shouldHydrateFromServer(procedimentoFeitoId)) {
      return undefined;
    }
    let cancelled = false;
    setHydrating(true);
    Promise.all([
      mapasApi.buscarPorProcedimento(procedimentoFeitoId).catch(() => null),
    ]).then(async ([mapaResp]) => {
      if (cancelled) return;
      if (mapaResp == null) return;

      const { applied, data } = hydrateFromApi(mapaResp);
      if (!applied || !data) return;

      if (!cancelled) {
        markHydratedFromServer?.(procedimentoFeitoId);
      }
      if (!cancelled && data.unidadeMedida) {
        setUnidadeMedida(normalizeUnidadeMedida(data.unidadeMedida));
        setPasso(getPassoFallback(data.unidadeMedida, data.passo));
      }
      const ids = Object.entries(data.fotoGaleriaIdPorVista || {});
      if (!ids.length) return;

      let items = [];
      try {
        const raw = await pacientesGaleriaApi.list(pacienteId, { procedimentoFeitoId });
        items = normalizePacienteGaleriaResponse(raw);
      } catch {
        items = [];
      }

      await Promise.all(
        ids.map(async ([vista, fid]) => {
          const item = items.find((i) => String(i.serverId) === String(fid));
          if (!item?.url) return;
          try {
            const blob = await pacientesGaleriaApi.fetchArquivoBlob(item.url);
            if (cancelled) return;
            setFotoVista(vista, {
              displayUrl: URL.createObjectURL(blob),
              fotoGaleriaId: String(fid),
              source: 'galeria',
            });
          } catch {
            /* foto indisponível — pontos ainda carregam */
          }
        }),
      );
      if (!cancelled) clearAllDirty?.();
    })
      .catch((e) => {
        if (!cancelled) console.warn('Falha ao hidratar mapa:', e);
      })
      .finally(() => {
        if (!cancelled) setHydrating(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate gated by hook guard per procedimentoFeitoId
  }, [procedimentoFeitoId, pacienteId]);

  const ensureReady = useCallback(async () => {
    if (isPanelDisabled || !hasProcedimentoValido) {
      toast.warning('Selecione um procedimento do catálogo para habilitar o mapa de aplicação.');
      return false;
    }
    try {
      await onEnsureProcedimento?.();
      return true;
    } catch (e) {
      toast.error(e?.message || 'Não foi possível registrar o procedimento.');
      return false;
    }
  }, [isPanelDisabled, hasProcedimentoValido, onEnsureProcedimento, toast]);

  const loadGaleria = useCallback(async () => {
    if (!pacienteId) {
      toast.warning('Paciente sem ID no servidor — não é possível abrir a galeria.');
      return;
    }
    if (loadGaleriaInFlightRef.current) return;
    loadGaleriaInFlightRef.current = true;
    setGaleriaLoading(true);
    try {
      if (!(await ensureReady())) return;
      const raw = await pacientesGaleriaApi.list(pacienteId);
      const normalized = normalizePacienteGaleriaResponse(raw);
      setGaleriaItems(normalized);
      setGaleriaOpen(true);
    } catch (e) {
      toast.error(e?.message || 'Não foi possível carregar a galeria.');
    } finally {
      loadGaleriaInFlightRef.current = false;
      setGaleriaLoading(false);
    }
  }, [pacienteId, ensureReady, toast]);

  const handleGaleriaSelect = useCallback(
    async (item) => {
      if (!item?.serverId || !vistaAtual) return;
      if (selectGaleriaInFlightRef.current) return;
      selectGaleriaInFlightRef.current = true;
      setGaleriaSelecting(true);
      try {
        const blob = await pacientesGaleriaApi.fetchArquivoBlob(item.url);
        mapaState.setFotoVista(vistaAtual, {
          displayUrl: URL.createObjectURL(blob),
          fotoGaleriaId: item.serverId,
          source: 'galeria',
        });
        setGaleriaOpen(false);
      } catch (e) {
        toast.error(e?.message || 'Não foi possível carregar a foto.');
      } finally {
        selectGaleriaInFlightRef.current = false;
        setGaleriaSelecting(false);
      }
    },
    [mapaState, toast, vistaAtual],
  );

  const handleImportPlano = useCallback(async () => {
    if (!planejamentoItemId || !vistaAtual) return;
    if (!(await ensureReady())) return;
    setImporting(true);
    try {
      let pontos = resolvePontosPlanoVista(procedimentosComPontos, catalogoId, vistaAtual);
      if (!pontos && planejamentoId) {
        pontos = await fetchPontosPlanoVista(planejamentoId, planejamentoItemId, vistaAtual);
      }
      if (!pontos?.length) {
        toast.info('Nenhum ponto do plano nesta vista.');
        return;
      }
      mapaState.importarPontosDoPlano(pontos, vistaAtual);
      toast.success('Pontos importados do plano (sem foto).');
    } catch (e) {
      toast.error(e?.message || 'Falha ao importar pontos do plano.');
    } finally {
      setImporting(false);
    }
  }, [
    planejamentoItemId,
    vistaAtual,
    ensureReady,
    procedimentosComPontos,
    catalogoId,
    planejamentoId,
    mapaState,
    toast,
  ]);

  const vistasDisponiveis = VISTAS_MAPA_APLICACAO.filter(
    (v) => !vistasPreenchidas.includes(v.codigo) || v.codigo === vistaAtual,
  );

  const handleSelectVista = (codigo) => {
    mapaState.setVistaAtual(codigo);
    setVistaModalOpen(false);
  };

  if (isPanelDisabled) {
    return (
      <div className="mb-6 rounded-2xl border border-dashed border-[#cbd5e1] bg-[#f8fafc] p-6 text-center">
        <MapPin className="mx-auto h-8 w-8 text-[#94a3b8]" strokeWidth={1.5} />
        <h4 className="mt-3 text-[15px] font-bold text-app-ink">Mapa de aplicação</h4>
        <p className="mt-1 text-[13px] font-medium text-[#64748b]">{disabledHint}</p>
        {!hasProcedimentoValido && (
          <button
            type="button"
            onClick={() => {
              const el = document.querySelector('input[placeholder*="Buscar procedimento"], [data-testid="procedimento-search"]');
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el.focus();
              }
            }}
            className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-teal-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-teal-700 shadow-2xs hover:bg-teal-50 transition-colors cursor-pointer"
          >
            <span>Selecionar Procedimento</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-2xl border border-[#00a88e]/25 bg-white p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-[16px] font-bold text-[#0f172a]">Mapa de aplicação</h4>
          <p className="text-[13px] font-medium text-[#64748b]">
            Marque pontos na foto-modelo por vista (separado das fotos Antes/Depois).
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label htmlFor="mapa-unidade-medida" className="shrink-0 text-[12px] font-semibold text-[#64748b]">
              Unidade:
            </label>
            <UnidadeMedidaSelect
              id="mapa-unidade-medida"
              className="w-[5.5rem]"
              value={unidadeMedida}
              onChange={handleUnidadeMedidaChange}
            />
          </div>
          <p className="mt-1 text-[11px] font-medium text-[#94a3b8]">
            Unidade aplicada a todos os pontos deste procedimento.
          </p>
          {listaProcedimentosSessao.length > 1 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-[12px] font-bold uppercase tracking-wider text-slate-500">
                Procedimento Marcador:
              </span>
              {listaProcedimentosSessao.map((proc) => {
                const isArmado = proc.id === procedimentoArmado?.id;
                const cor = proc.corHex || corParaProcedimento(proc.id);
                return (
                  <button
                    key={proc.id}
                    type="button"
                    onClick={() => setProcedimentoArmadoId(proc.id)}
                    className={`inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-bold transition-all shadow-xs cursor-pointer ${
                      isArmado
                        ? 'border-2 text-slate-900 bg-white ring-2 ring-teal-500/20 shadow-md'
                        : 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-white hover:text-slate-900'
                    }`}
                    style={isArmado ? { borderColor: cor } : {}}
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: cor }}
                      aria-hidden
                    />
                    <span>{proc.nome}</span>
                    {isArmado && (
                      <span className="ml-1 text-[10px] font-black uppercase text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded">
                        Ativo
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {planejamentoItemId ? (
            <button
              type="button"
              disabled={importing || hydrating}
              onClick={handleImportPlano}
              className="inline-flex items-center gap-1.5 rounded-xl border border-app-accent/40 bg-app-nav-active px-3 py-2 text-[12px] font-semibold text-[#0f766e] hover:bg-[#d1fae5] disabled:opacity-60"
            >
              {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              Importar pontos do plano
            </button>
          ) : null}
        </div>
      </div>

      {hydrating ? (
        <div className="mb-3 flex items-center gap-2 text-[13px] font-medium text-[#64748b]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando mapa salvo…
        </div>
      ) : null}

      <VistaChipsBar
        vistasPreenchidas={vistasPreenchidas.length ? vistasPreenchidas : [vistaAtual]}
        vistaAtual={vistaAtual}
        onSelectVista={(v) => mapaState.setVistaAtual(v)}
        onAdicionarVista={() => setVistaModalOpen(true)}
        countPontosVista={mapaState.countPontosVista}
      />

      <div className="mt-4 grid min-h-0 gap-4 lg:grid-cols-[1fr_320px]">
        <div className="min-h-0 min-w-0">
          <VistaAtivaHeader vistaAtual={vistaAtual} />
          <FotoVistaCanvas
            vistaAtual={vistaAtual}
            foto={fotoAtual}
            procedimentoArmado={procedimentoArmado}
            pontosVista={gruposPontos}
            unidadeMedida={unidadeMedida}
            onUnidadeMedidaChange={handleUnidadeMedidaChange}
            presets={presets}
            passo={passo}
            pacienteId={pacienteId}
            catalogoId={catalogoId}
            isRetorno={procedimentoArmado?.id && false /* Aqui pode ser checado se é retorno, mas a prop isRetorno/pacienteId é suficiente */}
            onAddPonto={handleAddPontoComProcedimento}
            onEditarPonto={(_catId, vista, localId, patch) =>
              mapaState.editarPonto(vista, localId, patch)
            }
            onRemovePonto={(_catId, vista, localId) => mapaState.removerPonto(vista, localId)}
            onOpenGaleria={loadGaleria}
            mediaBusy={mediaBusy}
            onRequestCapture={async () => {
              if (photoActionBusy) return;
              setPhotoActionBusy(true);
              try {
                if (!(await ensureReady())) return;
                onPrepareCapture?.(vistaAtual);
                toast.info('Use o botão da câmera flutuante para capturar a foto desta vista.');
              } finally {
                setPhotoActionBusy(false);
              }
            }}
            onRequestUpload={(file) => {
              if (photoActionBusy || !file) return;
              setPhotoActionBusy(true);
              ensureReady()
                .then((ok) => {
                  if (!ok) return;
                  mapaState.setFotoVista(vistaAtual, {
                    displayUrl: URL.createObjectURL(file),
                    blob: file,
                    source: 'upload',
                  });
                })
                .finally(() => setPhotoActionBusy(false));
            }}
            onRequestFullscreen={() => setFullscreenOpen(true)}
            previewMode={true}
            maxHeightClass="max-h-[82dvh]"
            canUpload={hasProcedimentoValido && !isPanelDisabled}
          />
        </div>
        <PontosResumoPanel
          vistaAtual={vistaAtual}
          gruposPontos={gruposPontos}
          gruposSessao={gruposSessao}
          unidadeMedida={unidadeMedida}
        />
      </div>

      <GaleriaVistaPickerModal
        open={galeriaOpen}
        items={galeriaItems}
        loading={galeriaLoading}
        selecting={galeriaSelecting}
        onSelect={handleGaleriaSelect}
        onClose={() => {
          if (galeriaSelecting) return;
          setGaleriaOpen(false);
        }}
      />

      <EscolherVistaMapaModal
        open={vistaModalOpen}
        vistasDisponiveis={vistasDisponiveis}
        onSelect={handleSelectVista}
        onClose={() => setVistaModalOpen(false)}
        hasFoto={(codigo) => Boolean(mapaState.getFotoVista(codigo)?.displayUrl)}
        countPontosVista={mapaState.countPontosVista}
      />

      <MapeamentoFullscreenOverlay
        open={fullscreenOpen}
        vistaAtual={vistaAtual}
        foto={fotoAtual}
        procedimentoArmado={procedimentoArmado}
        hideProcedimentoPicker={true}
        onArmar={(proc) => setProcedimentoArmadoId(proc?.id)}
        procedimentosUsados={listaProcedimentosSessao}
        pontosVista={gruposPontos}
        gruposSessao={gruposSessao}
        countPontosVista={mapaState.countPontosVista(vistaAtual)}
        unidadeMedida={unidadeMedida}
        onUnidadeMedidaChange={handleUnidadeMedidaChange}
        presets={presets}
        passo={passo}
        onAddPonto={handleAddPontoComProcedimento}
        onEditarPonto={(_catId, vista, localId, patch) =>
          mapaState.editarPonto(vista, localId, patch)
        }
        onRemovePonto={(_catId, vista, localId) => mapaState.removerPonto(vista, localId)}
        onDesfazerUltimo={() => mapaState.desfazerUltimoPonto(vistaAtual)}
        onClearVista={() => mapaState.limparPontosVista(vistaAtual)}
        onRemoverFotoVista={() => mapaState.removerFotoVista(vistaAtual)}
        onMudarCorProcedimento={handleMudarCorProcedimento}
        onClose={() => setFullscreenOpen(false)}
      />
    </div>
  );
}
