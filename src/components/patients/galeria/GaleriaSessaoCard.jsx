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
  procedimentoFeitoId,
  pacienteId,
  onAcompanhamento,
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
}) {
  const fotosPorCategoria = groupFotosByCategoria(sess.fotos);

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
        <div>
          <div className="text-[14px] font-bold text-[#0f172a]">
            Sessão {totalSessions - sessionIndex} — {formatMesAnoSessao(sess.dataISO)}
          </div>
          <div className="text-[12px] text-[#64748b] mt-0.5">
            {sess.nomeProcedimento || 'Procedimento não informado'} · {sess.fotos.length} foto
            {sess.fotos.length !== 1 ? 's' : ''}
          </div>
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

      <div className="flex flex-col gap-2 px-4 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-[12px] font-bold text-[#64748b] tabular-nums">
          {formatDataSessaoPtBr(sess.dataISO)}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onAcompanhamento?.({ procedimentoFeitoId, pacienteId });
          }}
          disabled={!pacienteId}
          className="w-full rounded-lg border-[2px] border-[#00a88e]/30 bg-[#e6f7f5] px-2.5 py-1 text-center text-[11px] font-bold text-[#0f766e] transition-colors hover:bg-[#d2f3ee] sm:w-auto disabled:cursor-not-allowed disabled:opacity-60"
        >
          Acompanhamento
        </button>
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
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
