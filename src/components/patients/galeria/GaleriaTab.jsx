import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Shield } from 'lucide-react';
import { GALERIA_CATEGORIA_LABELS } from '../../../utils/pacienteGaleria.js';
import { GaleriaArquivoImage, GaleriaLocalImage } from '../GaleriaArquivoImage.jsx';
import { GaleriaFilterChips } from './GaleriaFilterChips.jsx';
import { GaleriaSessaoCard } from './GaleriaSessaoCard.jsx';
import { GaleriaCategoriaLightbox } from './GaleriaCategoriaLightbox.jsx';
import { shouldGaleriaSessionStartExpanded } from './galeriaUiConstants.js';

export function GaleriaTab({
  isNivel1,
  galeriaBackend,
  selectedPatientId,
  galeriaSessionsForView,
  galeriaMesesOpcoes,
  galeriaProcedimentosOpcoes,
  galeriaFilterCategoria,
  setGaleriaFilterCategoria,
  galeriaFilterMes,
  setGaleriaFilterMes,
  galeriaFilterProcedimento,
  setGaleriaFilterProcedimento,
  apiGaleriaItemsLength,
  galleryItemsForGrid,
  sessoesExpandidas,
  setSessoesExpandidas,
  categoriasEmEdicao,
  setCategoriasEmEdicao,
  modoComparar,
  setModoComparar,
  compararSelecionadas,
  setCompararSelecionadas,
  compararModalOpen,
  setCompararModalOpen,
  onCompararFotoClick,
  onRemoveGalleryItem,
  onUploadCategoria,
  onLocalPreview,
  uploadDisabled,
  uploadDisabledTitle,
}) {
  const [categoriaLightbox, setCategoriaLightbox] = useState(null);

  useEffect(() => {
    if (!galeriaSessionsForView?.length) return;
    setSessoesExpandidas((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const sess of galeriaSessionsForView) {
        if (next[sess.key] === undefined) {
          next[sess.key] = shouldGaleriaSessionStartExpanded(sess);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [galeriaSessionsForView, setSessoesExpandidas]);

  const toggleSessao = useCallback(
    (sess) => {
      const key = sess.key;
      setSessoesExpandidas((prev) => ({ ...prev, [key]: !prev[key] }));
    },
    [setSessoesExpandidas],
  );

  const handleToggleEdicao = useCallback(
    (editKey) => {
      setCategoriasEmEdicao((prev) => ({ ...prev, [editKey]: !prev[editKey] }));
    },
    [setCategoriasEmEdicao],
  );

  const handleFotoClick = useCallback(
    (foto, fotosCat, cat) => {
      if (modoComparar) {
        onCompararFotoClick?.(foto);
        return;
      }
      setCategoriaLightbox({
        fotos: fotosCat,
        categoriaLabel: GALERIA_CATEGORIA_LABELS[cat] || cat,
      });
    },
    [modoComparar, onCompararFotoClick],
  );

  const handleOpenLightbox = useCallback((fotosCat, cat) => {
    setCategoriaLightbox({
      fotos: fotosCat,
      categoriaLabel: GALERIA_CATEGORIA_LABELS[cat] || cat,
    });
  }, []);

  const handleCancelComparar = () => {
    setModoComparar(false);
    setCompararSelecionadas({ antes: null, depois: null });
    setCompararModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h4 className="text-[16px] font-bold text-[#0f172a]">Galeria de evolução</h4>
          {!isNivel1 && galeriaBackend === 'api' && galeriaSessionsForView.length > 0 ? (
            <button
              type="button"
              onClick={() => {
                setModoComparar((prev) => {
                  if (prev) {
                    setCompararSelecionadas({ antes: null, depois: null });
                    setCompararModalOpen(false);
                  }
                  return !prev;
                });
              }}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-bold border-[2px] transition-all ${
                modoComparar
                  ? 'bg-[#00a88e] text-white border-[#00a88e]'
                  : 'bg-white text-[#00a88e] border-[#00a88e]/40 hover:border-[#00a88e]'
              }`}
            >
              {modoComparar ? '✕ Cancelar comparação' : '⇄ Comparar'}
            </button>
          ) : null}
        </div>
        {!isNivel1 && galeriaBackend === 'loading' && selectedPatientId ? (
          <span className="inline-flex items-center gap-2 text-[12px] font-medium text-[#64748b]">
            <Loader2 className="h-4 w-4 animate-spin text-[#00a88e]" aria-hidden />
            Sincronizando galeria…
          </span>
        ) : !isNivel1 && galeriaBackend === 'api' ? (
          <span className="text-[11px] font-bold uppercase tracking-wide text-[#0f766e] bg-[#e6f7f5] border border-[#00a88e]/25 px-2 py-1 rounded-lg w-fit">
            Galeria no servidor
          </span>
        ) : !isNivel1 && selectedPatientId ? (
          <span className="text-[11px] font-medium text-[#94a3b8] w-fit max-w-md leading-snug">
            Galeria do servidor indisponível — exibindo fotos locais da jornada, se houver.
          </span>
        ) : null}
      </div>

      {isNivel1 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center bg-white border border-[#e2e8f0] rounded-[18px]">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-500 mb-4 border border-rose-100/60 shadow-inner">
            <Shield className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800">Fotos Ocultas</h3>
          <p className="mt-2 text-xs text-slate-500 max-w-sm leading-relaxed">
            Por motivos de privacidade e conformidade médica, a visualização de fotos clínicas de evolução deste
            paciente está bloqueada para o seu nível de acesso (Nível 1).
          </p>
        </div>
      ) : (
        <>
          {galeriaBackend === 'api' && selectedPatientId && galeriaBackend !== 'loading' ? (
            <GaleriaFilterChips
              galeriaFilterCategoria={galeriaFilterCategoria}
              setGaleriaFilterCategoria={setGaleriaFilterCategoria}
              galeriaFilterMes={galeriaFilterMes}
              setGaleriaFilterMes={setGaleriaFilterMes}
              galeriaFilterProcedimento={galeriaFilterProcedimento}
              setGaleriaFilterProcedimento={setGaleriaFilterProcedimento}
              galeriaMesesOpcoes={galeriaMesesOpcoes}
              galeriaProcedimentosOpcoes={galeriaProcedimentosOpcoes}
            />
          ) : null}

          {modoComparar ? (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#fffbeb] border-[2px] border-[#f59e0b]/40 text-[13px] font-medium text-[#b45309]">
              <span>
                {!compararSelecionadas.antes && !compararSelecionadas.depois
                  ? 'Clique em uma foto de Antes e uma foto de Depois para comparar.'
                  : !compararSelecionadas.antes
                    ? '✓ Depois selecionado — agora clique em uma foto de Antes.'
                    : !compararSelecionadas.depois
                      ? '✓ Antes selecionado — agora clique em uma foto de Depois.'
                      : 'Abrindo comparação…'}
              </span>
            </div>
          ) : null}

          {galeriaBackend === 'api' && galeriaSessionsForView.length > 0 ? (
            <div className="space-y-4">
              {galeriaSessionsForView.map((sess, idx) => (
                <GaleriaSessaoCard
                  key={sess.key}
                  sess={sess}
                  sessionIndex={idx}
                  totalSessions={galeriaSessionsForView.length}
                  expandida={sessoesExpandidas[sess.key] ?? false}
                  onToggle={() => toggleSessao(sess)}
                  categoriasEmEdicao={categoriasEmEdicao}
                  onToggleEdicao={handleToggleEdicao}
                  modoComparar={modoComparar}
                  compararSelecionadas={compararSelecionadas}
                  onFotoClick={handleFotoClick}
                  onOpenLightbox={handleOpenLightbox}
                  onRemoveFoto={onRemoveGalleryItem}
                  onUploadCategoria={onUploadCategoria}
                  uploadDisabled={uploadDisabled}
                  uploadDisabledTitle={uploadDisabledTitle}
                />
              ))}
            </div>
          ) : galeriaBackend === 'api' && apiGaleriaItemsLength > 0 && galeriaSessionsForView.length === 0 ? (
            <p className="text-center py-8 text-[#94a3b8] text-[13px] font-medium px-2">
              Nenhuma foto com estes filtros. Ajuste categoria, mês ou procedimento.
            </p>
          ) : galeriaBackend === 'api' && apiGaleriaItemsLength === 0 ? (
            <p className="text-center py-8 text-[#94a3b8] text-[14px]">Nenhuma foto registrada</p>
          ) : galleryItemsForGrid.length ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {galleryItemsForGrid.map((item) => {
                const canDelete =
                  item.source === 'api' || (item.source !== 'legacy' && item.index >= 0);
                return (
                  <div key={item.id} className="relative">
                    <button
                      type="button"
                      onClick={() =>
                        onLocalPreview?.({
                          url: item.url,
                          authFetch: item.source === 'api',
                          caption: item.fileName,
                        })
                      }
                      className="aspect-square rounded-xl bg-[#e6f7f5] border border-app-border flex items-center justify-center overflow-hidden w-full"
                    >
                      {item.source === 'api' ? (
                        <GaleriaArquivoImage
                          url={item.url}
                          alt=""
                          className="w-full h-full"
                          imgClassName="w-full h-full object-cover"
                        />
                      ) : (
                        <GaleriaLocalImage
                          url={item.url}
                          alt=""
                          imgClassName="w-full h-full object-cover"
                        />
                      )}
                    </button>
                    {canDelete ? (
                      <button
                        type="button"
                        onClick={() => onRemoveGalleryItem(item)}
                        className="absolute top-1 right-1 w-7 h-7 rounded-full bg-red-500 hover:bg-red-600 text-white border-[2px] border-white text-[11px] font-bold"
                      >
                        x
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-center py-8 text-[#94a3b8] text-[14px]">Nenhuma foto registrada</p>
          )}

          {compararModalOpen && compararSelecionadas.antes && compararSelecionadas.depois ? (
            <div
              className="fixed inset-0 z-[300] bg-black/90 flex flex-col items-center justify-center p-4 gap-4"
              onClick={handleCancelComparar}
            >
              <div
                className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full max-w-5xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
                  <span className="text-[12px] font-bold uppercase tracking-wide text-[#00a88e] bg-[#00a88e]/20 px-3 py-1 rounded-full">
                    Antes
                  </span>
                  <img
                    src={compararSelecionadas.antes.url}
                    alt="Antes"
                    className="max-h-[75dvh] max-w-full rounded-xl object-contain"
                  />
                </div>
                <div className="w-px h-full bg-white/20 hidden sm:block" />
                <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
                  <span className="text-[12px] font-bold uppercase tracking-wide text-[#f59e0b] bg-[#f59e0b]/20 px-3 py-1 rounded-full">
                    Depois
                  </span>
                  <img
                    src={compararSelecionadas.depois.url}
                    alt="Depois"
                    className="max-h-[75dvh] max-w-full rounded-xl object-contain"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={handleCancelComparar}
                className="px-6 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-[13px] border border-white/20 transition-all"
              >
                Fechar comparação
              </button>
            </div>
          ) : null}

          <GaleriaCategoriaLightbox
            key={
              categoriaLightbox
                ? `${categoriaLightbox.categoriaLabel}-${categoriaLightbox.fotos?.length ?? 0}`
                : 'closed'
            }
            open={Boolean(categoriaLightbox)}
            fotos={categoriaLightbox?.fotos}
            categoriaLabel={categoriaLightbox?.categoriaLabel}
            onClose={() => setCategoriaLightbox(null)}
          />
        </>
      )}
    </div>
  );
}
