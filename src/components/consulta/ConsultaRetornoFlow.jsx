import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, ImageIcon, Loader2, Lock, RotateCcw, Trash2, ZoomIn, X } from 'lucide-react';
import { useToast } from '../../contexts/useToast.js';
import { mapasApi, pacientesGaleriaApi, procedimentosApi } from '../../services/api.js';
import { normalizePacienteGaleriaResponse } from '../../utils/pacienteGaleria.js';
import { buildGrupoPontosVista, hydrateMapaFromGet } from '../../utils/procedimentoMapaPayload.js';
import { VISTA_MAPA_APLICACAO_PADRAO } from '../../constants/vistasMapaAplicacao.js';
import { FotoVistaCanvas, FotoVistaCanvasCore } from '../journey/mapeamento/FotoVistaCanvas.jsx';
import { MapeamentoFullscreenOverlay } from '../journey/mapeamento/MapeamentoFullscreenOverlay.jsx';
import { VistaAtivaHeader, VistaChipsBar } from '../journey/mapeamento/VistaChipsBar.jsx';
import { ZoomableGalleryLightbox } from '../patients/ZoomableGalleryLightbox.jsx';

const SATISFACAO_OPTS = [1, 2, 3, 4, 5];
const SIMETRIA_OPTS = [
  { value: 'sim', label: 'Simétrico' },
  { value: 'leve', label: 'Assimetria leve' },
  { value: 'moderada', label: 'Assimetria moderada' },
  { value: 'na', label: 'N/A' },
];
const DOR_OPTS = [
  { value: 0, label: 'Sem dor' },
  { value: 3, label: 'Leve' },
  { value: 6, label: 'Moderada' },
  { value: 9, label: 'Intensa' },
];

const FOTO_TIPOS_COLUNA = [
  { codigo: 'ANTES', label: 'Antes' },
  { codigo: 'POS_IMEDIATO', label: 'Pós-imediato' },
  { codigo: 'DEPOIS', label: 'Depois' },
];

function formatDataHora(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return String(iso);
  }
}

function resolveNomeProcedimento(meta) {
  if (!meta) return '—';
  const nome = String(meta.procedimentoNome || meta.nomeManual || '').trim();
  return nome || '—';
}

/** Fluxo de retorno: coluna pai (read-only) + avaliação/retoque editável. */
export function ConsultaRetornoFlow({
  pacienteId,
  procedimentoFeitoOrigemId,
  mapaRetornoState,
  _retornoAvaliacao = {},
  _setRetornoAvaliacao,
  houveRetoque = false,
  setHouveRetoque,
  evaluationCapturedPhotos = [],
  evaluationPhotoMax = 30,
  onEvaluationUploadFiles,
  onEvaluationRemovePhoto,
  procedureCapturedPhotos = [],
  onProcedureUploadFiles,
  onProcedureRemovePhoto,
  onProcedureOpenCamera,
  onConcluirRetorno,
  isConcluirBusy = false,
  pendingMapaCapture = null,
  onMapaCaptureConsumed = () => {},
  onPrepareMapaCapture = () => {},
}) {
  const toast = useToast();
  const uploadInputRef = useRef(null);
  const uploadPreRef = useRef(null);
  const uploadPosRef = useRef(null);
  const blobUrlsRef = useRef([]);
  const photos = evaluationCapturedPhotos || [];

  const procedurePhotos = procedureCapturedPhotos || [];
  const preRetoquePhotos = procedurePhotos.filter(
    (p) => (p.meta?.categoria || 'antes') === 'antes',
  );
  const posRetoquePhotos = procedurePhotos.filter(
    (p) => p.meta?.categoria === 'pos_imediato',
  );

  const [parentLoading, setParentLoading] = useState(false);
  const [parentError, setParentError] = useState(null);
  const [parentMeta, setParentMeta] = useState(null);
  const [parentSemMapa, setParentSemMapa] = useState(false);
  const [fotosPorTipo, setFotosPorTipo] = useState({});
  const [parentFotosPorVista, setParentFotosPorVista] = useState({});
  const [parentPontosPorVista, setParentPontosPorVista] = useState({});
  const [vistaPai, setVistaPai] = useState(VISTA_MAPA_APLICACAO_PADRAO);
  const [lightboxPhoto, setLightboxPhoto] = useState(null);
  const [parentMapaFullscreen, setParentMapaFullscreen] = useState(false);
  const [retornoFullscreenOpen, setRetornoFullscreenOpen] = useState(false);

  const handleImageUpload = (e) => {
    const files = e.target.files;
    if (files?.length) onEvaluationUploadFiles?.(files);
    e.target.value = '';
  };

  const catalogoIdPai = parentMeta?.catalogoProcedimentoSaudeId
    ? String(parentMeta.catalogoProcedimentoSaudeId)
    : '';
  const nomeProcedimentoPai = resolveNomeProcedimento(parentMeta);
  const procedimentoArmadoPai = catalogoIdPai
    ? { id: catalogoIdPai, nome: nomeProcedimentoPai }
    : null;

  useEffect(() => {
    if (!pacienteId || !procedimentoFeitoOrigemId) {
      setParentMeta(null);
      setFotosPorTipo({});
      setParentFotosPorVista({});
      setParentPontosPorVista({});
      setParentSemMapa(false);
      setParentError(null);
      return undefined;
    }

    let cancelled = false;
    setParentLoading(true);
    setParentError(null);

    (async () => {
      try {
        const paiId = String(procedimentoFeitoOrigemId);
        const [procListRaw, galeriaRaw, mapaResp] = await Promise.all([
          procedimentosApi.byPaciente(pacienteId),
          pacientesGaleriaApi.list(pacienteId, { procedimentoFeitoId: paiId }),
          mapasApi.buscarPorProcedimento(paiId).catch(() => null),
        ]);
        if (cancelled) return;

        const procList = Array.isArray(procListRaw) ? procListRaw : procListRaw?.content ?? [];
        const pai = procList.find((p) => String(p.id) === paiId) || null;
        setParentMeta(pai);

        const galeriaItems = normalizePacienteGaleriaResponse(galeriaRaw);
        const grouped = { ANTES: [], POS_IMEDIATO: [], DEPOIS: [] };
        await Promise.all(
          galeriaItems.map(async (item) => {
            const codigo = String(item.tipoFotoCodigo || '').trim().toUpperCase();
            if (!grouped[codigo]) return;
            try {
              const blob = await pacientesGaleriaApi.fetchArquivoBlob(item.url);
              if (cancelled) return;
              const thumbUrl = URL.createObjectURL(blob);
              blobUrlsRef.current.push(thumbUrl);
              grouped[codigo].push({ ...item, thumbUrl });
            } catch {
              grouped[codigo].push({ ...item, thumbUrl: null });
            }
          }),
        );
        if (cancelled) return;
        setFotosPorTipo(grouped);

        if (!mapaResp) {
          setParentSemMapa(true);
          setParentFotosPorVista({});
          setParentPontosPorVista({});
          return;
        }

        setParentSemMapa(false);
        const mapData = hydrateMapaFromGet(mapaResp);
        setParentPontosPorVista(mapData.pontosPorVista || {});

        const fotosMapa = {};
        const ids = Object.entries(mapData.fotoGaleriaIdPorVista || {});
        await Promise.all(
          ids.map(async ([vista, fid]) => {
            const item = galeriaItems.find((i) => String(i.serverId) === String(fid));
            if (!item?.url) return;
            try {
              const blob = await pacientesGaleriaApi.fetchArquivoBlob(item.url);
              if (cancelled) return;
              const displayUrl = URL.createObjectURL(blob);
              blobUrlsRef.current.push(displayUrl);
              fotosMapa[vista] = {
                displayUrl,
                fotoGaleriaId: String(fid),
                source: 'galeria',
              };
            } catch {
              /* foto indisponível — pontos ainda carregam */
            }
          }),
        );
        if (cancelled) return;
        setParentFotosPorVista(fotosMapa);

        const vistasComConteudo = new Set([
          ...Object.keys(fotosMapa),
          ...Object.keys(mapData.pontosPorVista || {}).filter(
            (v) => (mapData.pontosPorVista[v] || []).length > 0,
          ),
        ]);
        const primeira =
          Array.from(vistasComConteudo)[0] ||
          Object.keys(mapData.fotoGaleriaIdPorVista || {})[0] ||
          VISTA_MAPA_APLICACAO_PADRAO;
        setVistaPai(primeira);
      } catch (e) {
        if (!cancelled) {
          console.warn('[ConsultaRetornoFlow] Falha ao carregar dados do pai:', e);
          setParentError(e?.message || 'Não foi possível carregar o procedimento original.');
        }
      } finally {
        if (!cancelled) setParentLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pacienteId, procedimentoFeitoOrigemId]);

  useEffect(
    () => () => {
      blobUrlsRef.current.forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch {
          /* ignore */
        }
      });
      blobUrlsRef.current = [];
    },
    [],
  );

  const resetMapa = mapaRetornoState?.resetMapa;

  // Sem reusar foto do pai: ao desligar retoque, limpa o mapa editável.
  useEffect(() => {
    if (!resetMapa) return;
    if (!houveRetoque) resetMapa();
  }, [houveRetoque, resetMapa]);

  // Consome captura da câmera flutuante (mesmo padrão do MapaAplicacaoPanel).
  useEffect(() => {
    if (!mapaRetornoState || !pendingMapaCapture?.blob || !pendingMapaCapture?.vista) return;
    const url = URL.createObjectURL(pendingMapaCapture.blob);
    mapaRetornoState.setFotoVista(pendingMapaCapture.vista, {
      displayUrl: url,
      blob: pendingMapaCapture.blob,
      source: 'capture',
    });
    mapaRetornoState.setVistaAtual(pendingMapaCapture.vista);
    onMapaCaptureConsumed?.();
  }, [pendingMapaCapture, mapaRetornoState, onMapaCaptureConsumed]);

  const vistasPaiPreenchidas = useMemo(() => {
    const codigos = new Set(Object.keys(parentFotosPorVista));
    Object.entries(parentPontosPorVista).forEach(([vista, lista]) => {
      if (Array.isArray(lista) && lista.length > 0) codigos.add(vista);
    });
    return codigos.size ? Array.from(codigos) : [vistaPai];
  }, [parentFotosPorVista, parentPontosPorVista, vistaPai]);

  const gruposPontosPai = buildGrupoPontosVista(
    parentPontosPorVista[vistaPai],
    catalogoIdPai,
    nomeProcedimentoPai,
  );

  const retornoVistaAtual = mapaRetornoState?.vistaAtual ?? VISTA_MAPA_APLICACAO_PADRAO;
  const retornoFotoAtual = mapaRetornoState?.getFotoVista?.(retornoVistaAtual) ?? null;
  const retornoGruposPontos =
    mapaRetornoState?.getPontosVista?.(retornoVistaAtual, catalogoIdPai, nomeProcedimentoPai) ?? [];
  const retornoVistasPreenchidas = mapaRetornoState?.getVistasPreenchidas?.() ?? [];

  const countPontosPai = (codigo) =>
    Array.isArray(parentPontosPorVista[codigo]) ? parentPontosPorVista[codigo].length : 0;

  return (
    <div className="relative flex min-h-0 flex-col">
      <div className="mb-6 flex shrink-0 items-center gap-4 px-0.5">
        <div className="rounded-xl border border-app-border bg-app-nav-active p-2.5 text-app-accent shadow-sm">
          <RotateCcw className="h-6 w-6" strokeWidth={2.5} />
        </div>
        <div>
          <h3 className="text-[18px] font-bold text-app-ink">Retorno</h3>
          <p className="text-[13px] font-medium text-[#64748b]">
            Procedimento original + fotos e mapa desta visita
          </p>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-6 lg:grid-cols-2">
        {/* Coluna esquerda — procedimento pai + fotos do resultado */}
        <div className="flex min-h-0 flex-col gap-6">
          <div className="flex min-h-0 flex-col rounded-2xl border border-[#e2e8f0] bg-white p-5">
            <div className="mb-4 flex items-start justify-between gap-2">
              <div>
                <h4 className="text-[15px] font-bold text-[#0f172a]">Procedimento original</h4>
                <p className="text-[12px] text-[#64748b]">Referência da sessão anterior</p>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#cbd5e1] bg-[#f8fafc] px-2.5 py-1 text-[11px] font-semibold text-[#64748b]">
                <Lock className="h-3 w-3" aria-hidden />
                Somente leitura
              </span>
            </div>

            {!procedimentoFeitoOrigemId ? (
              <p className="text-[13px] text-[#94a3b8]">Nenhum procedimento de origem vinculado.</p>
            ) : parentLoading ? (
              <div className="flex items-center gap-2 py-8 text-[13px] text-[#64748b]">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando procedimento original…
              </div>
            ) : parentError ? (
              <p className="text-[13px] text-[#dc2626]">{parentError}</p>
            ) : (
              <>
                <dl className="mb-4 space-y-2 text-[13px]">
                  <div>
                    <dt className="font-semibold text-[#64748b]">Procedimento</dt>
                    <dd className="font-bold text-[#0f172a]">{nomeProcedimentoPai}</dd>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <dt className="font-semibold text-[#64748b]">Data</dt>
                      <dd className="text-[#0f172a]">{formatDataHora(parentMeta?.horaInicio)}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-[#64748b]">Profissional</dt>
                      <dd className="text-[#0f172a]">
                        {String(parentMeta?.profissionalNome || '').trim() || '—'}
                      </dd>
                    </div>
                  </div>
                  {parentMeta?.observacao ? (
                    <div>
                      <dt className="font-semibold text-[#64748b]">Observações</dt>
                      <dd className="whitespace-pre-wrap text-[#0f172a]">{parentMeta.observacao}</dd>
                    </div>
                  ) : null}
                </dl>

                <div className="mb-4 space-y-4">
                  <p className="text-[12px] font-bold uppercase tracking-wide text-[#00a88e]">Fotos de referência</p>
                  {FOTO_TIPOS_COLUNA.map(({ codigo, label }) => {
                    const items = fotosPorTipo[codigo] || [];
                    return (
                      <div key={codigo}>
                        <p className="mb-1.5 text-[12px] font-semibold text-[#64748b]">{label}</p>
                        {items.length === 0 ? (
                          <p className="text-[11px] text-[#94a3b8]">Sem fotos</p>
                        ) : (
                          <div className="flex flex-wrap gap-3">
                            {items.map((item) => {
                              const imgUrl = item.thumbUrl || item.url;
                              return (
                                <button
                                  key={item.serverId}
                                  type="button"
                                  onClick={() => {
                                    if (imgUrl) {
                                      setLightboxPhoto({
                                        url: imgUrl,
                                        alt: `${label} — ${nomeProcedimentoPai}`,
                                        serverId: item.serverId,
                                      });
                                    }
                                  }}
                                  className="group relative h-28 w-28 sm:h-36 sm:w-36 overflow-hidden rounded-xl border border-[#cbd5e1] bg-[#f1f5f9] shadow-sm transition-all hover:border-[#00a88e] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#00a88e]"
                                  title={`Clique para ampliar: ${label}`}
                                >
                                  {imgUrl ? (
                                    <>
                                      <img src={imgUrl} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/0 transition-colors group-hover:bg-black/40">
                                        <ZoomIn className="h-6 w-6 text-white opacity-0 transition-opacity group-hover:opacity-100 drop-shadow-md" />
                                        <span className="text-[11px] font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100 drop-shadow-md">
                                          Ampliar
                                        </span>
                                      </div>
                                    </>
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center text-[#94a3b8]">
                                      <ImageIcon className="h-6 w-6" />
                                    </div>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {parentSemMapa ? (
                  <p className="rounded-xl border border-dashed border-[#cbd5e1] bg-[#f8fafc] px-4 py-6 text-center text-[13px] text-[#64748b]">
                    Procedimento original sem mapa registrado.
                  </p>
                ) : (
                  <>
                    <VistaChipsBar
                      vistasPreenchidas={vistasPaiPreenchidas}
                      vistaAtual={vistaPai}
                      onSelectVista={setVistaPai}
                      countPontosVista={countPontosPai}
                    />
                    <div className="mt-3 min-h-0">
                      <VistaAtivaHeader vistaAtual={vistaPai} />
                      <FotoVistaCanvas
                        readOnly
                        showToolbar={false}
                        vistaAtual={vistaPai}
                        foto={parentFotosPorVista[vistaPai] ?? null}
                        procedimentoArmado={procedimentoArmadoPai}
                        pontosVista={gruposPontosPai}
                        emptyTitle="Sem foto nesta vista"
                        emptySubtitle="O mapa do procedimento original não possui imagem para esta vista."
                        onRequestFullscreen={() => setParentMapaFullscreen(true)}
                        className="border-0 p-0 shadow-none"
                      />
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          {/* Fotos do Resultado (Posicionado na Esquerda) */}
          <div className="rounded-2xl border border-[#cbd5e1] bg-white p-5">
            <div className="mb-4 flex items-center justify-between gap-2">
              <div>
                <h4 className="text-[15px] font-bold text-[#0f172a]">Foto do resultado</h4>
                <p className="text-[12px] text-[#64748b]">Fotos do resultado final desta consulta de retorno</p>
              </div>
              <span className="text-[12px] font-semibold text-[#64748b]">
                {photos.length}/{evaluationPhotoMax}
              </span>
            </div>

            <input
              ref={uploadInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleImageUpload}
            />

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {photos.map((ph, idx) => (
                <div key={ph.url ? `${ph.url}_${idx}` : idx} className="min-w-0">
                  <div className="group relative aspect-square overflow-hidden rounded-xl bg-[#f1f5f9]">
                    <img src={ph.url} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => onEvaluationRemovePhoto?.(idx)}
                      className="absolute right-1 top-1 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-[#dc2626] text-white shadow-md active:bg-[#b91c1c] sm:h-7 sm:w-7 sm:hover:bg-[#b91c1c]"
                      aria-label="Remover imagem"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={2.5} />
                    </button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => uploadInputRef.current?.click()}
                className="col-span-2 flex min-h-[120px] flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-[#cbd5e1] bg-[#fafafa] px-4 py-2 text-[#64748b] transition-colors active:border-[#00a88e]/50 active:bg-[#f0fdf9] active:text-[#00a88e] sm:col-span-1 sm:aspect-square sm:min-h-0 sm:hover:border-[#00a88e]/50 sm:hover:bg-[#f0fdf9] sm:hover:text-[#00a88e]"
              >
                <Camera className="h-6 w-6" strokeWidth={2} />
                <span className="px-1 text-center text-[11px] font-semibold leading-tight">
                  Upload de imagens
                </span>
              </button>
            </div>

            {photos.length === 0 ? (
              <p className="mt-3 flex items-center gap-2 text-[12px] font-medium text-[#94a3b8]">
                <ImageIcon className="h-4 w-4 shrink-0" />
                Registre fotos do resultado final deste retorno.
              </p>
            ) : null}
          </div>
        </div>

        {/* Coluna direita — retoque + conclusão */}
        <div className="flex min-h-0 flex-col">
          <div className="mb-6 flex items-center justify-between gap-4 rounded-2xl border border-[#00a88e]/25 bg-white p-6 shadow-sm">
            <div>
              <p className="text-[15px] font-bold text-[#0f172a]">Houve retoque nesta visita?</p>
              <p className="text-[12px] text-[#64748b]">
                Marque Sim para registrar fotos de retoque e mapa corretivo desta visita
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={houveRetoque}
              onClick={() => setHouveRetoque?.(!houveRetoque)}
              className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${
                houveRetoque ? 'bg-[#00a88e]' : 'bg-[#cbd5e1]'
              }`}
            >
              <span
                className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                  houveRetoque ? 'left-7' : 'left-1'
                }`}
              />
            </button>
          </div>

          {houveRetoque ? (
            <div className="mb-6 space-y-6">
              {/* Fotos de Retoque (Pré e Pós-imediato) */}
              <div className="rounded-2xl border border-[#00a88e]/25 bg-white p-5 shadow-sm">
                <h4 className="mb-1 text-[15px] font-bold text-[#0f172a]">Fotos do retoque</h4>
                <p className="mb-4 text-[12px] text-[#64748b]">
                  Registre fotos do paciente antes de aplicar o retoque e pós-imediato desta visita.
                </p>

                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Pré-retoque (Antes) */}
                  <div className="rounded-xl border border-[#cbd5e1] bg-[#f8fafc] p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div>
                        <h5 className="text-[13px] font-bold text-[#0f172a]">Pré-retoque (Antes)</h5>
                        <p className="text-[11px] text-[#64748b]">Antes de aplicar o retoque</p>
                      </div>
                      <span className="text-[11px] font-semibold text-[#64748b]">
                        {preRetoquePhotos.length} foto(s)
                      </span>
                    </div>

                    <input
                      ref={uploadPreRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files?.length) {
                          onProcedureUploadFiles?.(e.target.files, 'antes');
                        }
                        e.target.value = '';
                      }}
                    />

                    <div className="flex flex-wrap gap-2.5">
                      {preRetoquePhotos.map((ph) => {
                        const globalIdx = procedurePhotos.indexOf(ph);
                        return (
                          <div key={ph.url} className="group relative h-20 w-20 overflow-hidden rounded-xl border border-[#cbd5e1] bg-[#f1f5f9]">
                            <img src={ph.url} alt="" className="h-full w-full object-cover" />
                            <button
                              type="button"
                              onClick={() => onProcedureRemovePhoto?.(globalIdx)}
                              className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-[#dc2626] text-white shadow-md hover:bg-[#b91c1c]"
                              title="Remover foto"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        );
                      })}

                      <button
                        type="button"
                        onClick={() => onProcedureOpenCamera?.('antes')}
                        className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-xl border border-app-accent/40 bg-app-nav-active text-[#00a88e] hover:bg-[#e6f7f5] transition-colors"
                        title="Tirar foto com a câmera"
                      >
                        <Camera className="h-5 w-5" />
                        <span className="text-[10px] font-semibold">Câmera</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => uploadPreRef.current?.click()}
                        className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-[#cbd5e1] bg-white text-[#64748b] hover:border-[#00a88e]/50 hover:bg-[#f0fdf9] hover:text-[#00a88e] transition-colors"
                        title="Upload de arquivo de imagem"
                      >
                        <ImageIcon className="h-5 w-5" />
                        <span className="text-[10px] font-semibold">Arquivo</span>
                      </button>
                    </div>
                  </div>

                  {/* Pós-imediato (Retoque) */}
                  <div className="rounded-xl border border-[#cbd5e1] bg-[#f8fafc] p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div>
                        <h5 className="text-[13px] font-bold text-[#0f172a]">Pós-imediato (Retoque)</h5>
                        <p className="text-[11px] text-[#64748b]">Logo após aplicar o retoque</p>
                      </div>
                      <span className="text-[11px] font-semibold text-[#64748b]">
                        {posRetoquePhotos.length} foto(s)
                      </span>
                    </div>

                    <input
                      ref={uploadPosRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files?.length) {
                          onProcedureUploadFiles?.(e.target.files, 'pos_imediato');
                        }
                        e.target.value = '';
                      }}
                    />

                    <div className="flex flex-wrap gap-2.5">
                      {posRetoquePhotos.map((ph) => {
                        const globalIdx = procedurePhotos.indexOf(ph);
                        return (
                          <div key={ph.url} className="group relative h-20 w-20 overflow-hidden rounded-xl border border-[#cbd5e1] bg-[#f1f5f9]">
                            <img src={ph.url} alt="" className="h-full w-full object-cover" />
                            <button
                              type="button"
                              onClick={() => onProcedureRemovePhoto?.(globalIdx)}
                              className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-[#dc2626] text-white shadow-md hover:bg-[#b91c1c]"
                              title="Remover foto"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        );
                      })}

                      <button
                        type="button"
                        onClick={() => onProcedureOpenCamera?.('pos_imediato')}
                        className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-xl border border-app-accent/40 bg-app-nav-active text-[#00a88e] hover:bg-[#e6f7f5] transition-colors"
                        title="Tirar foto com a câmera"
                      >
                        <Camera className="h-5 w-5" />
                        <span className="text-[10px] font-semibold">Câmera</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => uploadPosRef.current?.click()}
                        className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-[#cbd5e1] bg-white text-[#64748b] hover:border-[#00a88e]/50 hover:bg-[#f0fdf9] hover:text-[#00a88e] transition-colors"
                        title="Upload de arquivo de imagem"
                      >
                        <ImageIcon className="h-5 w-5" />
                        <span className="text-[10px] font-semibold">Arquivo</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Mapa de retoque */}
              <div className="rounded-2xl border border-[#00a88e]/25 bg-white p-5 shadow-sm">
                <h4 className="mb-1 text-[15px] font-bold text-[#0f172a]">Mapa de retoque</h4>
                <p className="mb-4 text-[12px] text-[#64748b]">
                  Tire ou envie uma foto nova desta visita e marque pontos e traços sobre ela.
                </p>
                {mapaRetornoState ? (
                  <>
                    <VistaChipsBar
                      vistasPreenchidas={
                        retornoVistasPreenchidas.length
                          ? retornoVistasPreenchidas
                          : [retornoVistaAtual]
                      }
                      vistaAtual={retornoVistaAtual}
                      onSelectVista={(v) => mapaRetornoState.setVistaAtual(v)}
                      countPontosVista={mapaRetornoState.countPontosVista}
                    />
                    <div className="mt-3">
                      <VistaAtivaHeader vistaAtual={retornoVistaAtual} />
                      <FotoVistaCanvas
                        previewMode={true}
                        showToolbar={true}
                        vistaAtual={retornoVistaAtual}
                        foto={retornoFotoAtual}
                        procedimentoArmado={procedimentoArmadoPai}
                        pontosVista={retornoGruposPontos}
                        onAddPonto={mapaRetornoState.adicionarPonto}
                        onEditarPonto={(_catId, vista, localId, patch) =>
                          mapaRetornoState.editarPonto(vista, localId, patch)
                        }
                        onRemovePonto={(_catId, vista, localId) =>
                          mapaRetornoState.removerPonto(vista, localId)
                        }
                        onRequestCapture={() => {
                          onPrepareMapaCapture?.(retornoVistaAtual);
                          toast.info(
                            'Use o botão da câmera flutuante para capturar a foto desta vista.',
                          );
                        }}
                        onRequestUpload={(file) => {
                          if (!file) return;
                          mapaRetornoState.setFotoVista(retornoVistaAtual, {
                            displayUrl: URL.createObjectURL(file),
                            blob: file,
                            source: 'upload',
                          });
                        }}
                        onRequestFullscreen={() => setRetornoFullscreenOpen(true)}
                        className="border-0 p-0 shadow-none"
                      />
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="mt-auto flex justify-end border-t border-app-border pt-6">
            <button
              type="button"
              onClick={() => onConcluirRetorno?.()}
              disabled={isConcluirBusy}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-app-accent px-6 py-3 text-[14px] font-semibold text-white shadow-sm hover:bg-[#00967f] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isConcluirBusy ? 'Salvando…' : 'Concluir Retorno'}
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Lightbox para foto de referência */}
      {lightboxPhoto ? (
        <div
          className="fixed inset-0 z-[300] flex flex-col bg-black/90 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={lightboxPhoto.alt || 'Foto ampliada'}
          onClick={() => setLightboxPhoto(null)}
        >
          <div
            className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 pb-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="min-w-0">
              <h3 className="truncate text-[15px] font-bold text-white">{lightboxPhoto.alt}</h3>
            </div>
            <button
              type="button"
              onClick={() => setLightboxPhoto(null)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" strokeWidth={2.5} />
            </button>
          </div>
          <div
            className="relative mx-auto flex min-h-0 flex-1 items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <ZoomableGalleryLightbox
              url={lightboxPhoto.url}
              alt={lightboxPhoto.alt}
              pacienteId={pacienteId}
              fotoId={lightboxPhoto.serverId}
            />
          </div>
        </div>
      ) : null}

      {/* Modal de Zoom/Inspeção em Tela Cheia do Mapa Original (Somente Leitura) */}
      {parentMapaFullscreen ? (
        <div
          className="fixed inset-0 z-[300] flex flex-col bg-[#0f172a] p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Zoom do Mapa Original"
          onClick={() => setParentMapaFullscreen(false)}
        >
          <div
            className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 pb-3 border-b border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 className="text-[15px] font-bold text-white">
                Mapa do procedimento original ({vistaPai})
              </h3>
              <p className="text-[12px] font-medium text-white/60">
                Modo de visualização e zoom — Somente leitura
              </p>
            </div>
            <button
              type="button"
              onClick={() => setParentMapaFullscreen(false)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" strokeWidth={2.5} />
            </button>
          </div>
          <div
            className="relative mx-auto flex h-[82vh] w-full max-w-6xl items-center justify-center pt-2"
            onClick={(e) => e.stopPropagation()}
          >
            <FotoVistaCanvasCore
              readOnly={true}
              vistaAtual={vistaPai}
              foto={parentFotosPorVista[vistaPai] ?? null}
              procedimentoArmado={procedimentoArmadoPai}
              pontosVista={gruposPontosPai}
              showToolbar={false}
              fillViewport={true}
              externalModo="mover"
              className="h-full w-full"
            />
          </div>
        </div>
      ) : null}

      {/* Fullscreen Mapeamento de Retoque Overlay */}
      {retornoFullscreenOpen ? (
        <MapeamentoFullscreenOverlay
          open={retornoFullscreenOpen}
          vistaAtual={retornoVistaAtual}
          foto={retornoFotoAtual}
          procedimentoArmado={procedimentoArmadoPai}
          hideProcedimentoPicker={true}
          onArmar={() => {}}
          procedimentosUsados={[]}
          pontosVista={retornoGruposPontos}
          gruposSessao={[]}
          countPontosVista={mapaRetornoState?.countPontosVista?.(retornoVistaAtual) ?? 0}
          onAddPonto={mapaRetornoState?.adicionarPonto}
          onEditarPonto={(_catId, vista, localId, patch) =>
            mapaRetornoState?.editarPonto(vista, localId, patch)
          }
          onRemovePonto={(_catId, vista, localId) =>
            mapaRetornoState?.removerPonto(vista, localId)
          }
          onDesfazerUltimo={() => mapaRetornoState?.desfazerUltimoPonto?.(retornoVistaAtual)}
          onClearVista={() => mapaRetornoState?.limparPontosVista?.(retornoVistaAtual)}
          onRemoverFotoVista={() => mapaRetornoState?.removerFotoVista?.(retornoVistaAtual)}
          onClose={() => setRetornoFullscreenOpen(false)}
        />
      ) : null}
    </div>
  );
}
