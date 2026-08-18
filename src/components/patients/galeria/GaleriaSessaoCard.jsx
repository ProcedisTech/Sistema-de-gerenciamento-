import React from 'react';
import { ChevronDown } from 'lucide-react';
import { formatDataSessaoPtBr } from '../../../utils/pacienteGaleria.js';
import { GaleriaCategoriaSection } from './GaleriaCategoriaSection.jsx';
import { formatMesAnoSessao, groupFotosByCategoria, ORDEM_CATEGORIAS } from './galeriaUiConstants.js';

export function GaleriaSessaoCard({
  sess,
  sessionIndex,
  totalSessions,
  expandida,
  onToggle,
  categoriasEmEdicao,
  onToggleEdicao,
  modoComparar,
  compararSelecionadas,
  onFotoClick,
  onOpenLightbox,
  onRemoveFoto,
  onUploadCategoria,
  uploadDisabled,
  uploadDisabledTitle,
  pacienteId = null,
}) {
  const fotosPorCategoria = groupFotosByCategoria(sess.fotos);
  const tituloSessao = sess.nomeProcedimento || 'Consulta / Avaliação';

  return (
    <div className="rounded-[20px] border border-slate-200 bg-white shadow-app-card overflow-hidden">
      <div
        className="flex items-center justify-between cursor-pointer select-none p-4 hover:bg-[#f8fafc] transition-colors rounded-xl"
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          }
        }}
        role="button"
        tabIndex={0}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="text-[14px] font-bold text-[#0f172a]">
              Sessão {totalSessions - sessionIndex} — {formatMesAnoSessao(sess.dataISO)}
            </div>
            {sess.isRetorno ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#0ea5e9]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#0369a1]">
                🔄 Retorno
              </span>
            ) : null}
          </div>
          {sess.isRetorno && sess.origemProcedimentoNome ? (
            <p className="text-[11px] text-[#64748b] mt-0.5">
              {sess.origemProcedimentoNome}
              {sess.origemDataLabel ? ` (Aplicação em ${sess.origemDataLabel})` : ''}
            </p>
          ) : null}
          <p
            className="text-[12px] text-[#64748b] mt-0.5 line-clamp-2"
            title={tituloSessao}
          >
            {tituloSessao} · {sess.fotos.length} foto
            {sess.fotos.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] font-medium text-[#94a3b8]">
            {expandida ? 'Recolher' : 'Ver fotos'}
          </span>
          <ChevronDown
            className={`w-4 h-4 text-[#94a3b8] transition-transform duration-200 ${
              expandida ? 'rotate-180' : ''
            }`}
            strokeWidth={2}
          />
        </div>
      </div>

      <div className="px-4 pb-3">
        <span className="text-[12px] font-bold text-[#64748b] tabular-nums">
          {formatDataSessaoPtBr(sess.dataISO)}
        </span>
      </div>

      {expandida ? (
        <div className="space-y-3 px-4 pb-4">
          {ORDEM_CATEGORIAS.map((cat) => {
            const fotosCat = fotosPorCategoria[cat];
            if (!fotosCat?.length) return null;
            const editKey = `${sess.key}_${cat}`;
            return (
              <GaleriaCategoriaSection
                key={cat}
                categoria={cat}
                fotos={fotosCat}
                modoComparar={modoComparar}
                compararSelecionadas={compararSelecionadas}
                emEdicao={Boolean(categoriasEmEdicao[editKey])}
                onToggleEdicao={() => onToggleEdicao?.(editKey)}
                onFotoClick={(foto) => onFotoClick?.(foto, fotosCat, cat)}
                onOpenLightbox={(idx) => onOpenLightbox?.(fotosCat, cat, idx)}
                onRemoveFoto={onRemoveFoto}
                onUpload={(file) => onUploadCategoria?.(sess, cat, file)}
                uploadDisabled={uploadDisabled}
                uploadDisabledTitle={uploadDisabledTitle}
                pacienteId={pacienteId}
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
