import React from 'react';
import { ChevronDown } from 'lucide-react';
import { formatDataSessaoPtBr, formatMesAnoCurtoPt, ORDEM_CATEGORIAS, sessaoDeveIniciarAberta } from '../../utils/pacienteGaleria.js';
import { GaleriaCategoryRow } from './GaleriaCategoryRow.jsx';

function formatMesAno(isoDate) {
  const curto = formatMesAnoCurtoPt(isoDate);
  return curto || 'Data desconhecida';
}

export function GaleriaSessionCard({
  sess,
  sessionIndex,
  totalSessions,
  expandidaOverride,
  onToggleSessao,
  procedimentoFeitoId,
  pacienteId,
  onAcompanhamento,
  modoComparar,
  compararSelecionadas,
  categoriasEmEdicao,
  onToggleCategoriaEdit,
  onFotoClick,
  onOpenCategoryLightbox,
  onCategoryUpload,
  canUpload,
  onRemoveFoto,
}) {
  const expandida = expandidaOverride ?? sessaoDeveIniciarAberta(sess);

  const fotosPorCategoria = {};
  sess.fotos.forEach((foto) => {
    const cat = foto.categoria || 'outro';
    if (!fotosPorCategoria[cat]) fotosPorCategoria[cat] = [];
    fotosPorCategoria[cat].push(foto);
  });

  return (
    <div className="overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-app-card">
      <button
        type="button"
        onClick={() => onToggleSessao?.(sess)}
        className="flex w-full min-h-[44px] cursor-pointer select-none items-center justify-between p-4 text-left transition-colors hover:bg-[#f8fafc]"
        aria-expanded={expandida}
      >
        <div className="min-w-0">
          <div className="text-[14px] font-bold text-[#0f172a]">
            Sessão {totalSessions - sessionIndex} — {formatMesAno(sess.dataISO)}
          </div>
          <div className="mt-0.5 text-[12px] text-[#64748b]">
            {sess.nomeProcedimento || 'Procedimento não informado'} · {sess.fotos.length} foto
            {sess.fotos.length !== 1 ? 's' : ''}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-[11px] font-medium text-[#94a3b8]">
            {expandida ? 'Recolher' : 'Ver fotos'}
          </span>
          <ChevronDown
            className={`h-4 w-4 text-[#94a3b8] transition-transform duration-200 ${
              expandida ? 'rotate-180' : ''
            }`}
            strokeWidth={2}
            aria-hidden
          />
        </div>
      </button>

      <div className="flex flex-col gap-2 px-4 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-[12px] font-bold tabular-nums text-[#64748b]">
          {formatDataSessaoPtBr(sess.dataISO)}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onAcompanhamento?.({ procedimentoFeitoId, pacienteId });
          }}
          disabled={!pacienteId}
          className="w-full rounded-lg border-[2px] border-[#00a88e]/30 bg-[#e6f7f5] px-2.5 py-1 text-center text-[11px] font-bold text-[#0f766e] transition-colors hover:bg-[#d2f3ee] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
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
              <GaleriaCategoryRow
                key={cat}
                sessKey={sess.key}
                categoria={cat}
                fotosCat={fotosCat}
                modoComparar={modoComparar}
                compararSelecionadas={compararSelecionadas}
                editMode={Boolean(categoriasEmEdicao[editKey])}
                onToggleEdit={() => onToggleCategoriaEdit?.(editKey)}
                onFotoClick={(foto, idx) => onFotoClick?.(foto, idx, { sess, categoria: cat, fotos: fotosCat })}
                onOpenLightbox={(opts) =>
                  onOpenCategoryLightbox?.({
                    sess,
                    categoria: cat,
                    fotos: fotosCat,
                    openInGrid: opts?.openInGrid ?? false,
                    initialIndex: opts?.initialIndex ?? 0,
                  })
                }
                onUpload={(files) => onCategoryUpload?.({ sess, categoria: cat, files })}
                canUpload={canUpload}
                onRemoveFoto={onRemoveFoto}
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
