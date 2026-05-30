import React from 'react';
import { Loader2, Shield } from 'lucide-react';
import { GaleriaArquivoImage, GaleriaLocalImage } from './GaleriaArquivoImage.jsx';
import { GaleriaFilterChips } from './GaleriaFilterChips.jsx';
import { GaleriaSessionCard } from './GaleriaSessionCard.jsx';
import { GaleriaCategoryLightbox } from './GaleriaCategoryLightbox.jsx';
import { sessaoDeveIniciarAberta } from '../../utils/pacienteGaleria.js';

export function PatientGaleriaTab({
  isNivel1,
  galeriaBackend,
  selectedPatientId,
  galeriaSessionsForView,
  apiGaleriaItemsCount,
  galeriaFilterCategoria,
  setGaleriaFilterCategoria,
  galeriaFilterMes,
  setGaleriaFilterMes,
  galeriaMesesOpcoes,
  galeriaFilterProcedimento,
  setGaleriaFilterProcedimento,
  galeriaProcedimentosOpcoes,
  modoComparar,
  setModoComparar,
  setCompararSelecionadas,
  setCompararModalOpen,
  compararSelecionadas,
  compararModalOpen,
  sessoesExpandidas,
  onToggleSessao,
  resolveProcedimentoFeitoIdForSessao,
  onAcompanhamento,
  categoriasEmEdicao,
  onToggleCategoriaEdit,
  onFotoClick,
  onOpenCategoryLightbox,
  galeriaCategoryLightbox,
  onCloseCategoryLightbox,
  onCategoryUpload,
  canUpload,
  onRemoveFoto,
  galleryItemsForGrid,
  onLocalPreview,
  onLocalRemove,
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h4 className="text-[16px] font-bold text-[#0f172a]">Galeria de evolução</h4>
          {!isNivel1 && galeriaBackend === 'api' && galeriaSessionsForView.length > 0 && (
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
              className={`rounded-lg border-[2px] px-3 py-1.5 text-[12px] font-bold transition-all ${
                modoComparar
                  ? 'border-[#00a88e] bg-[#00a88e] text-white'
                  : 'border-[#00a88e]/40 bg-white text-[#00a88e] hover:border-[#00a88e]'
              }`}
            >
              {modoComparar ? '✕ Cancelar comparação' : '⇄ Comparar'}
            </button>
          )}
        </div>
        {!isNivel1 && galeriaBackend === 'loading' && selectedPatientId ? (
          <span className="inline-flex items-center gap-2 text-[12px] font-medium text-[#64748b]">
            <Loader2 className="h-4 w-4 animate-spin text-[#00a88e]" aria-hidden />
            Sincronizando galeria…
          </span>
        ) : !isNivel1 && galeriaBackend === 'api' ? (
          <span className="w-fit rounded-lg border border-[#00a88e]/25 bg-[#e6f7f5] px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-[#0f766e]">
            Galeria no servidor
          </span>
        ) : !isNivel1 && selectedPatientId ? (
          <span className="w-fit max-w-md text-[11px] font-medium leading-snug text-[#94a3b8]">
            Galeria do servidor indisponível — exibindo fotos locais da jornada, se houver.
          </span>
        ) : null}
      </div>

      {isNivel1 ? (
        <div className="flex flex-col items-center justify-center rounded-[18px] border border-[#e2e8f0] bg-white p-12 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-rose-100/60 bg-rose-50 text-rose-500 shadow-inner">
            <Shield className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800">Fotos Ocultas</h3>
          <p className="mt-2 max-w-sm text-xs leading-relaxed text-slate-500">
            Por motivos de privacidade e conformidade médica, a visualização de fotos clínicas de evolução
            deste paciente está bloqueada para o seu nível de acesso (Nível 1).
          </p>
        </div>
      ) : (
        <>
          {galeriaBackend === 'api' && selectedPatientId && galeriaBackend !== 'loading' ? (
            <GaleriaFilterChips
              filterCategoria={galeriaFilterCategoria}
              setFilterCategoria={setGaleriaFilterCategoria}
              filterMes={galeriaFilterMes}
              setFilterMes={setGaleriaFilterMes}
              mesesOpcoes={galeriaMesesOpcoes}
              filterProcedimento={galeriaFilterProcedimento}
              setFilterProcedimento={setGaleriaFilterProcedimento}
              procedimentosOpcoes={galeriaProcedimentosOpcoes}
            />
          ) : null}

          {modoComparar ? (
            <div className="flex items-center gap-3 rounded-xl border-[2px] border-[#f59e0b]/40 bg-[#fffbeb] px-4 py-3 text-[13px] font-medium text-[#b45309]">
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
              {galeriaSessionsForView.map((sess, idx) => {
                const procedimentoFeitoIdSessao = resolveProcedimentoFeitoIdForSessao(sess);
                const expandida =
                  sessoesExpandidas[sess.key] ?? sessaoDeveIniciarAberta(sess);
                return (
                  <GaleriaSessionCard
                    key={sess.key}
                    sess={sess}
                    sessionIndex={idx}
                    totalSessions={galeriaSessionsForView.length}
                    expandidaOverride={expandida}
                    onToggleSessao={onToggleSessao}
                    procedimentoFeitoId={procedimentoFeitoIdSessao}
                    pacienteId={selectedPatientId}
                    onAcompanhamento={onAcompanhamento}
                    modoComparar={modoComparar}
                    compararSelecionadas={compararSelecionadas}
                    categoriasEmEdicao={categoriasEmEdicao}
                    onToggleCategoriaEdit={onToggleCategoriaEdit}
                    onFotoClick={onFotoClick}
                    onOpenCategoryLightbox={onOpenCategoryLightbox}
                    onCategoryUpload={onCategoryUpload}
                    canUpload={canUpload}
                    onRemoveFoto={onRemoveFoto}
                  />
                );
              })}
            </div>
          ) : galeriaBackend === 'api' && apiGaleriaItemsCount > 0 && galeriaSessionsForView.length === 0 ? (
            <p className="px-2 py-8 text-center text-[13px] font-medium text-[#94a3b8]">
              Nenhuma foto com estes filtros. Ajuste categoria, mês ou procedimento.
            </p>
          ) : galeriaBackend === 'api' && apiGaleriaItemsCount === 0 ? (
            <p className="py-8 text-center text-[14px] text-[#94a3b8]">Nenhuma foto registrada</p>
          ) : galleryItemsForGrid.length ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {galleryItemsForGrid.map((item) => {
                const canDelete =
                  item.source === 'api' || (item.source !== 'legacy' && item.index >= 0);
                return (
                  <div key={item.id} className="relative">
                    <button
                      type="button"
                      onClick={() => onLocalPreview?.(item)}
                      className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl border border-app-border bg-[#e6f7f5]"
                    >
                      {item.source === 'api' ? (
                        <GaleriaArquivoImage
                          url={item.url}
                          alt=""
                          className="h-full w-full"
                          imgClassName="h-full w-full object-cover"
                        />
                      ) : (
                        <GaleriaLocalImage url={item.url} alt="" imgClassName="h-full w-full object-cover" />
                      )}
                    </button>
                    {canDelete ? (
                      <button
                        type="button"
                        onClick={() => onLocalRemove?.(item)}
                        className="absolute right-1 top-1 h-7 w-7 rounded-full border-[2px] border-white bg-red-500 text-[11px] font-bold text-white hover:bg-red-600"
                      >
                        x
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="py-8 text-center text-[14px] text-[#94a3b8]">Nenhuma foto registrada</p>
          )}

          {compararModalOpen && compararSelecionadas.antes && compararSelecionadas.depois ? (
            <div
              className="fixed inset-0 z-[300] flex flex-col items-center justify-center gap-4 bg-black/90 p-4"
              onClick={() => {
                setCompararModalOpen(false);
                setCompararSelecionadas({ antes: null, depois: null });
                setModoComparar(false);
              }}
              role="presentation"
            >
              <div
                className="flex w-full max-w-5xl flex-col items-center justify-center gap-4 sm:flex-row"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
                  <span className="rounded-full bg-[#00a88e]/20 px-3 py-1 text-[12px] font-bold uppercase tracking-wide text-[#00a88e]">
                    Antes
                  </span>
                  <GaleriaArquivoImage
                    url={compararSelecionadas.antes.url}
                    alt="Antes"
                    className="max-h-[75dvh] max-w-full"
                    imgClassName="max-h-[75dvh] max-w-full rounded-xl object-contain"
                  />
                </div>
                <div className="hidden h-full w-px bg-white/20 sm:block" />
                <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
                  <span className="rounded-full bg-[#f59e0b]/20 px-3 py-1 text-[12px] font-bold uppercase tracking-wide text-[#f59e0b]">
                    Depois
                  </span>
                  <GaleriaArquivoImage
                    url={compararSelecionadas.depois.url}
                    alt="Depois"
                    className="max-h-[75dvh] max-w-full"
                    imgClassName="max-h-[75dvh] max-w-full rounded-xl object-contain"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCompararModalOpen(false);
                  setCompararSelecionadas({ antes: null, depois: null });
                  setModoComparar(false);
                }}
                className="rounded-xl border border-white/20 bg-white/10 px-6 py-2.5 text-[13px] font-bold text-white transition-all hover:bg-white/20"
              >
                Fechar comparação
              </button>
            </div>
          ) : null}

          <GaleriaCategoryLightbox
            lightbox={galeriaCategoryLightbox}
            onClose={onCloseCategoryLightbox}
            categoriaKey={galeriaCategoryLightbox?.categoria}
          />
        </>
      )}
    </div>
  );
}
