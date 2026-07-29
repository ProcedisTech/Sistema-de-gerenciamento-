import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, ImageIcon, Loader2, Lock, RotateCcw, Trash2 } from 'lucide-react';
import { useToast } from '../../contexts/useToast.js';
import { mapasApi, pacientesGaleriaApi, procedimentosApi } from '../../services/api.js';
import { normalizePacienteGaleriaResponse } from '../../utils/pacienteGaleria.js';
import { buildGrupoPontosVista, hydrateMapaFromGet } from '../../utils/procedimentoMapaPayload.js';
import { VISTA_MAPA_APLICACAO_PADRAO } from '../../constants/vistasMapaAplicacao.js';
import { FotoVistaCanvas } from '../journey/mapeamento/FotoVistaCanvas.jsx';
import { VistaAtivaHeader, VistaChipsBar } from '../journey/mapeamento/VistaChipsBar.jsx';

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
  retornoAvaliacao = {},
  setRetornoAvaliacao,
  houveRetoque = false,
  setHouveRetoque,
  evaluationCapturedPhotos = [],
  evaluationPhotoMax = 30,
  onEvaluationUploadFiles,
  onEvaluationRemovePhoto,
  onConcluirRetorno,
  isConcluirBusy = false,
  pendingMapaCapture = null,
  onMapaCaptureConsumed = () => {},
  onPrepareMapaCapture = () => {},
}) {
  const toast = useToast();
  const uploadInputRef = useRef(null);
  const blobUrlsRef = useRef([]);
  const photos = evaluationCapturedPhotos || [];
  const av = retornoAvaliacao || {};

  const [parentLoading, setParentLoading] = useState(false);
  const [parentError, setParentError] = useState(null);
  const [parentMeta, setParentMeta] = useState(null);
  const [parentSemMapa, setParentSemMapa] = useState(false);
  const [fotosPorTipo, setFotosPorTipo] = useState({});
  const [parentFotosPorVista, setParentFotosPorVista] = useState({});
  const [parentPontosPorVista, setParentPontosPorVista] = useState({});
  const [vistaPai, setVistaPai] = useState(VISTA_MAPA_APLICACAO_PADRAO);

  const patchAvaliacao = (patch) => {
    setRetornoAvaliacao?.((prev) => ({ ...(prev || {}), ...patch }));
  };

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
            Procedimento original + avaliação desta visita
          </p>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-6 lg:grid-cols-2">
        {/* Coluna esquerda — procedimento pai (A4 + B4) */}
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

              <div className="mb-4 space-y-3">
                <p className="text-[12px] font-bold uppercase tracking-wide text-[#00a88e]">Fotos</p>
                {FOTO_TIPOS_COLUNA.map(({ codigo, label }) => {
                  const items = fotosPorTipo[codigo] || [];
                  return (
                    <div key={codigo}>
                      <p className="mb-1.5 text-[12px] font-semibold text-[#64748b]">{label}</p>
                      {items.length === 0 ? (
                        <p className="text-[11px] text-[#94a3b8]">Sem fotos</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {items.map((item) => (
                            <div
                              key={item.serverId}
                              className="h-14 w-14 overflow-hidden rounded-lg border border-[#e2e8f0] bg-[#f1f5f9]"
                            >
                              {item.thumbUrl ? (
                                <img src={item.thumbUrl} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-[#94a3b8]">
                                  <ImageIcon className="h-4 w-4" />
                                </div>
                              )}
                            </div>
                          ))}
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
                      className="border-0 p-0 shadow-none"
                    />
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Coluna direita — avaliação + retoque */}
        <div className="flex min-h-0 flex-col">
          <div className="mb-6 space-y-6 rounded-2xl border border-[#00a88e]/25 bg-white p-6">
            <div>
              <h4 className="mb-3 text-[15px] font-bold text-[#0f172a]">Avaliação</h4>

              <div className="space-y-4">
                <div>
                  <p className="mb-2 text-[13px] font-bold text-[#00a88e]">Satisfação (1–5)</p>
                  <div className="flex flex-wrap gap-2">
                    {SATISFACAO_OPTS.map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => patchAvaliacao({ satisfacao: n })}
                        className={`min-h-[40px] min-w-[40px] rounded-full px-3 text-[14px] font-bold transition-colors ${
                          av.satisfacao === n
                            ? 'bg-[#00a88e] text-white shadow-sm'
                            : 'border border-[#e2e8f0] bg-[#f8fafc] text-[#64748b] hover:border-[#00a88e]/40'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-[13px] font-bold text-[#00a88e]">Simetria</p>
                  <div className="flex flex-wrap gap-2">
                    {SIMETRIA_OPTS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => patchAvaliacao({ simetria: opt.value })}
                        className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                          av.simetria === opt.value
                            ? 'bg-[#00a88e] text-white'
                            : 'border border-[#e2e8f0] bg-[#f8fafc] text-[#64748b] hover:border-[#00a88e]/40'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-[13px] font-bold text-[#00a88e]">Dor</p>
                  <div className="flex flex-wrap gap-2">
                    {DOR_OPTS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => patchAvaliacao({ dor: opt.value })}
                        className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                          av.dor === opt.value
                            ? 'bg-[#00a88e] text-white'
                            : 'border border-[#e2e8f0] bg-[#f8fafc] text-[#64748b] hover:border-[#00a88e]/40'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3">
              <div>
                <p className="text-[14px] font-bold text-[#0f172a]">Houve retoque nesta visita?</p>
                <p className="text-[12px] text-[#64748b]">
                  Marque Sim para registrar mapa corretivo com foto nova desta visita
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
          </div>

          {houveRetoque ? (
            <div className="mb-6 rounded-2xl border border-[#00a88e]/25 bg-white p-4">
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
                      className="border-0 p-0 shadow-none"
                    />
                  </div>
                </>
              ) : null}
            </div>
          ) : null}

          <div className="mb-2 flex items-center justify-between gap-2">
            <h4 className="text-[13px] font-bold text-[#00a88e]">Foto do resultado</h4>
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

          <div className="mt-8 flex justify-end border-t border-app-border pt-6">
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
    </div>
  );
}
