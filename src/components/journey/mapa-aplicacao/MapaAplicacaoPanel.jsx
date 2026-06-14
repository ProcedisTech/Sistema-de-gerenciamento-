import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Loader2, MapPin } from 'lucide-react';
import { useToast } from '../../../contexts/useToast.js';
import {
  catalogosApi,
  pacientesGaleriaApi,
  planejamentosApi,
  procedimentosApi,
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
  planejamentoItemId,
  planejamentoId,
  procedimentosComPontos = [],
  sidebarInsetPx = 0,
  pendingCapture,
  onCaptureConsumed,
  onPrepareCapture,
  onEnsureProcedimento,
  disabled = false,
  disabledHint = 'Preencha o nome do procedimento (com item do catálogo) para habilitar o mapa.',
}) {
  const toast = useToast();
  const [galeriaOpen, setGaleriaOpen] = useState(false);
  const [galeriaItems, setGaleriaItems] = useState([]);
  const [galeriaLoading, setGaleriaLoading] = useState(false);
  const [vistaModalOpen, setVistaModalOpen] = useState(false);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [hydrating, setHydrating] = useState(false);
  const [unidadeMedida, setUnidadeMedida] = useState('un');
  const [passo, setPasso] = useState(1);

  const presets = useMemo(() => getPresetsForUnidade(unidadeMedida), [unidadeMedida]);

  const handleUnidadeMedidaChange = useCallback((unit) => {
    const u = normalizeUnidadeMedida(unit);
    setUnidadeMedida(u);
    setPasso(getPassoFallback(u, undefined));
  }, []);

  const procedimentoArmado = useMemo(
    () =>
      catalogoId
        ? { id: String(catalogoId), nome: String(nomeProcedimento || '') }
        : null,
    [catalogoId, nomeProcedimento],
  );

  const vistasPreenchidas = mapaState.getVistasPreenchidas();
  const vistaAtual = mapaState.vistaAtual;
  const fotoAtual = mapaState.getFotoVista(vistaAtual);
  const gruposPontos = mapaState.getPontosVista(vistaAtual, catalogoId, nomeProcedimento);

  useEffect(() => {
    if (!catalogoId) {
      setUnidadeMedida('un');
      setPasso(1);
      return;
    }
    let cancelled = false;
    catalogosApi
      .get(catalogoId)
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
  }, [catalogoId]);

  useEffect(() => {
    if (!pendingCapture?.blob || !pendingCapture?.vista) return;
    const url = URL.createObjectURL(pendingCapture.blob);
    mapaState.setFotoVista(pendingCapture.vista, {
      displayUrl: url,
      blob: pendingCapture.blob,
      source: 'capture',
    });
    mapaState.setVistaAtual(pendingCapture.vista);
    onCaptureConsumed?.();
  }, [pendingCapture, mapaState, onCaptureConsumed]);

  useEffect(() => {
    if (!procedimentoFeitoId || !pacienteId) return undefined;
    let cancelled = false;
    setHydrating(true);
    procedimentosApi
      .getPontos(procedimentoFeitoId)
      .then(async (resp) => {
        if (cancelled) return;
        const data = mapaState.hydrateFromApi(resp);
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
              mapaState.setFotoVista(vista, {
                displayUrl: URL.createObjectURL(blob),
                fotoGaleriaId: String(fid),
                source: 'galeria',
              });
            } catch {
              /* foto indisponível — pontos ainda carregam */
            }
          }),
        );
        if (!cancelled) mapaState.clearAllDirty();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate once per procedimentoFeitoId
  }, [procedimentoFeitoId, pacienteId]);

  const ensureReady = useCallback(async () => {
    if (disabled) return false;
    try {
      await onEnsureProcedimento?.();
      return true;
    } catch (e) {
      toast.error(e?.message || 'Não foi possível registrar o procedimento.');
      return false;
    }
  }, [disabled, onEnsureProcedimento, toast]);

  const loadGaleria = useCallback(async () => {
    if (!pacienteId) {
      toast.warning('Paciente sem ID no servidor — não é possível abrir a galeria.');
      return;
    }
    if (!(await ensureReady())) return;
    setGaleriaLoading(true);
    try {
      const raw = await pacientesGaleriaApi.list(pacienteId);
      const normalized = normalizePacienteGaleriaResponse(raw);
      const withThumbs = await Promise.all(
        normalized.map(async (item) => {
          try {
            const blob = await pacientesGaleriaApi.fetchArquivoBlob(item.url);
            return { ...item, thumbUrl: URL.createObjectURL(blob) };
          } catch {
            return item;
          }
        }),
      );
      setGaleriaItems(withThumbs);
      setGaleriaOpen(true);
    } catch (e) {
      toast.error(e?.message || 'Não foi possível carregar a galeria.');
    } finally {
      setGaleriaLoading(false);
    }
  }, [pacienteId, ensureReady, toast]);

  const handleGaleriaSelect = useCallback(
    async (item) => {
      if (!item?.serverId || !vistaAtual) return;
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

  if (disabled) {
    return (
      <div className="mb-6 rounded-2xl border border-dashed border-[#cbd5e1] bg-[#f8fafc] p-6 text-center">
        <MapPin className="mx-auto h-8 w-8 text-[#94a3b8]" strokeWidth={1.5} />
        <h4 className="mt-3 text-[15px] font-bold text-app-ink">Mapa de aplicação</h4>
        <p className="mt-1 text-[13px] font-medium text-[#64748b]">{disabledHint}</p>
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
            onAddPonto={mapaState.adicionarPonto}
            onEditarPonto={(_catId, vista, localId, patch) =>
              mapaState.editarPonto(vista, localId, patch)
            }
            onRemovePonto={(_catId, vista, localId) => mapaState.removerPonto(vista, localId)}
            onOpenGaleria={loadGaleria}
            onRequestCapture={async () => {
              if (!(await ensureReady())) return;
              onPrepareCapture?.(vistaAtual);
              toast.info('Use o botão da câmera flutuante para capturar a foto desta vista.');
            }}
            onRequestUpload={(file) => {
              ensureReady().then((ok) => {
                if (!ok || !file) return;
                mapaState.setFotoVista(vistaAtual, {
                  displayUrl: URL.createObjectURL(file),
                  blob: file,
                  source: 'upload',
                });
              });
            }}
            onRequestFullscreen={() => setFullscreenOpen(true)}
          />
        </div>
        <PontosResumoPanel
          vistaAtual={vistaAtual}
          gruposPontos={gruposPontos}
          unidadeMedida={unidadeMedida}
        />
      </div>

      <GaleriaVistaPickerModal
        open={galeriaOpen}
        items={galeriaItems}
        loading={galeriaLoading}
        onSelect={handleGaleriaSelect}
        onClose={() => setGaleriaOpen(false)}
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
        toolbarWidthPx={sidebarInsetPx}
        vistaAtual={vistaAtual}
        foto={fotoAtual}
        procedimentoArmado={procedimentoArmado}
        onArmar={() => {}}
        procedimentosUsados={[]}
        hideProcedimentoPicker
        pontosVista={gruposPontos}
        unidadeMedida={unidadeMedida}
        onUnidadeMedidaChange={handleUnidadeMedidaChange}
        presets={presets}
        passo={passo}
        onAddPonto={mapaState.adicionarPonto}
        onEditarPonto={(_catId, vista, localId, patch) =>
          mapaState.editarPonto(vista, localId, patch)
        }
        onRemovePonto={(_catId, vista, localId) => mapaState.removerPonto(vista, localId)}
        onClose={() => setFullscreenOpen(false)}
      />
    </div>
  );
}
