import React, { useState, useMemo } from 'react';
import { 
  Folder, 
  ChevronDown, 
  Sparkles, 
  Calendar, 
  Plus, 
  User, 
  RotateCcw, 
  Camera, 
  FileText,
  CheckCircle2
} from 'lucide-react';
import { GaleriaArquivoImage } from '../patients/GaleriaArquivoImage.jsx';
import { GaleriaMapaThumb } from '../patients/galeria/GaleriaMapaThumb.jsx';
import { GALERIA_CATEGORIA_LABELS, formatDataSessaoPtBr } from '../../utils/pacienteGaleria.js';
import { PlanoFotoLightbox } from './PlanoFotoLightbox.jsx';

const PAGE_SIZE = 15;

function AtendimentoAvulsoItemCard({
  atendimento,
  pacienteId,
  onOpenLightbox,
}) {
  const [expandido, setExpandido] = useState(false);

  const fotos = Array.isArray(atendimento.fotos) ? atendimento.fotos : [];
  const retornos = Array.isArray(atendimento.retornos) ? atendimento.retornos : [];
  const hasFotos = fotos.length > 0;
  const hasRetornos = retornos.length > 0;
  const hasObservacao = Boolean(atendimento.observacao && String(atendimento.observacao).trim());

  return (
    <div className="rounded-md border border-slate-200 bg-white shadow-2xs overflow-hidden transition-all">
      {/* LINHA DE CABEÇALHO CLICÁVEL */}
      <div
        onClick={() => setExpandido((prev) => !prev)}
        className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 cursor-pointer hover:bg-slate-50/80 transition-colors select-none"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-md bg-purple-50 text-purple-700 flex items-center justify-center font-bold text-xs border border-purple-100 shrink-0">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-bold text-slate-900 text-xs truncate">
                {atendimento.nomeProcedimento}
              </h4>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                {atendimento.statusNome || 'FINALIZADO'}
              </span>
              {hasFotos && (
                <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-teal-50 text-teal-700 border border-teal-200 flex items-center gap-1">
                  <Camera className="w-3 h-3" />
                  {fotos.length} {fotos.length === 1 ? 'foto' : 'fotos'}
                </span>
              )}
              {hasRetornos && (
                <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                  <RotateCcw className="w-3 h-3" />
                  {retornos.length} {retornos.length === 1 ? 'retorno' : 'retornos'}
                </span>
              )}
            </div>

            {atendimento.profissionalNome && atendimento.profissionalNome !== '—' && (
              <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                <User className="w-3 h-3 text-slate-400" />
                <span>{atendimento.profissionalNome}</span>
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-auto shrink-0">
          {atendimento.dataISO && (
            <span className="text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-mono flex items-center gap-1">
              <Calendar className="w-3 h-3 text-slate-400" />
              {formatDataSessaoPtBr(atendimento.dataISO)}
            </span>
          )}

          <div className="p-1 rounded-md text-slate-400 hover:text-slate-700">
            <ChevronDown 
              className={`w-4 h-4 transition-transform duration-200 ${expandido ? 'rotate-180 text-purple-700' : ''}`} 
            />
          </div>
        </div>
      </div>

      {/* DETALHES CLÍNICOS EXPANSÍVEIS (FOTOS + OBSERVAÇÕES + RETORNOS) */}
      {expandido && (
        <div className="p-3 bg-slate-50/50 border-t border-slate-100 space-y-2.5 animate-in fade-in duration-150 text-xs">
          
          {/* OBSERVAÇÃO CLÍNICA */}
          {hasObservacao && (
            <div className="p-2 rounded bg-white border border-slate-200 text-slate-600 flex items-start gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
              <p className="text-[11px]">{atendimento.observacao}</p>
            </div>
          )}

          {/* FOTOS DO ATENDIMENTO */}
          {hasFotos ? (
            <div>
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                Fotos Registradas neste Procedimento ({fotos.length}):
              </span>
              <div className="flex flex-wrap gap-1.5 items-center">
                {fotos.map((foto) => {
                  const isMapa = Boolean(foto?.mapaOverlay?.marcacoes?.length) || foto?.categoria === 'mapa';
                  return (
                    <div
                      key={foto.id || foto.fotoId}
                      onClick={() => onOpenLightbox(foto)}
                      className="group relative w-14 h-14 rounded overflow-hidden border border-slate-200 bg-slate-100 cursor-pointer hover:border-purple-500 transition-all shadow-2xs"
                      title={foto.descricaoLegenda || foto.categoria}
                    >
                      {isMapa ? (
                        <GaleriaMapaThumb
                          url={foto.url}
                          mapaOverlay={foto.mapaOverlay}
                          pacienteId={pacienteId}
                          fotoId={foto.fotoId || foto.id}
                          alt={foto.descricaoLegenda || 'Mapa'}
                          density="thumb"
                          className="w-full h-full"
                        />
                      ) : (
                        <GaleriaArquivoImage
                          url={foto.url}
                          pacienteId={pacienteId}
                          fotoId={foto.fotoId || foto.id}
                          alt="Foto avulsa"
                          imgClassName="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      )}
                      <span className="absolute bottom-0.5 inset-x-0.5 text-[7px] font-bold text-white bg-slate-950/75 rounded text-center truncate">
                        {GALERIA_CATEGORIA_LABELS[foto.categoria] || 'Foto'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-slate-400 italic">
              Nenhuma foto anexada a este procedimento.
            </p>
          )}

          {/* RETORNOS VINCULADOS */}
          {hasRetornos && (
            <div className="pt-1.5 border-t border-slate-200/60 space-y-1">
              <span className="text-[9px] font-bold uppercase tracking-wider text-amber-800 block">
                Retornos Vinculados ({retornos.length}):
              </span>
              {retornos.map((ret, rIdx) => (
                <div key={ret.id || rIdx} className="px-2 py-1 rounded bg-amber-50/50 border border-amber-200/60 flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <RotateCcw className="w-3 h-3 text-amber-600" />
                    <span className="font-semibold text-slate-800">{ret.procedimentoNome || 'Retorno / Retoque'}</span>
                  </div>
                  {ret.criadoEm && (
                    <span className="text-[10px] text-slate-500 font-mono">
                      {formatDataSessaoPtBr(String(ret.criadoEm).slice(0, 10))}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

        </div>
      )}
    </div>
  );
}

export function PastaAtendimentosAvulsos({
  pacienteId,
  atendimentosAvulsos = [],
  fotosAvulsas = [],
  onUploadFotoManual,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFoto, setSelectedFoto] = useState(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const totalAtendimentos = atendimentosAvulsos.length;
  const totalFotos = fotosAvulsas.length;

  const itensVisiveis = useMemo(() => {
    return atendimentosAvulsos.slice(0, visibleCount);
  }, [atendimentosAvulsos, visibleCount]);

  const hasMore = visibleCount < totalAtendimentos;

  return (
    <div className="bg-white rounded-lg border border-slate-200 border-l-4 border-l-purple-500 shadow-2xs overflow-hidden transition-all mt-4">
      {/* HEADER DA PASTA RETRÁTIL */}
      <div 
        onClick={() => setIsOpen((prev) => !prev)}
        className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white cursor-pointer hover:bg-slate-50/60 transition-colors select-none"
      >
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5 text-[11px] text-purple-700 font-bold">
            <Folder className="w-3.5 h-3.5 text-purple-600 shrink-0" />
            <span>PASTA: Atendimentos Avulsos & Registros Pontuais</span>
          </div>

          <h3 className="text-sm font-bold text-slate-900">
            Procedimentos fora de protocolo e fotos sem plano vinculado
          </h3>

          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <span className="font-semibold text-purple-800">
              {totalAtendimentos} {totalAtendimentos === 1 ? 'Atendimento avulso' : 'Atendimentos avulsos'}
            </span>
            <span className="text-slate-300">·</span>
            <span>{totalFotos} {totalFotos === 1 ? 'Foto registrada' : 'Fotos registradas'}</span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-end sm:self-auto">
          <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 text-[11px] font-bold">
            PASTA AVULSA ({totalAtendimentos})
          </span>

          <div className="p-1 rounded-md text-slate-400">
            <ChevronDown 
              className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180 text-purple-700' : ''}`} 
            />
          </div>
        </div>
      </div>

      {/* CORPO EXPANSÍVEL */}
      {isOpen && (
        <div className="p-3.5 bg-slate-50/40 border-t border-slate-100 space-y-2.5 animate-in fade-in duration-150">
          {totalAtendimentos === 0 ? (
            <div className="p-4 text-center text-xs text-slate-500 bg-white rounded-md border border-dashed border-slate-200">
              Nenhum procedimento avulso ou foto fora de plano registrado para este paciente.
            </div>
          ) : (
            <>
              {itensVisiveis.map((atendimento) => (
                <AtendimentoAvulsoItemCard
                  key={atendimento.chave}
                  atendimento={atendimento}
                  pacienteId={pacienteId}
                  onOpenLightbox={(foto) => setSelectedFoto(foto)}
                />
              ))}

              {/* BOTÃO CARREGAR MAIS SE HOUVER MUITOS PROCEDIMENTOS */}
              {hasMore && (
                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
                    className="px-4 py-1.5 rounded-md border border-purple-200 bg-purple-50/60 hover:bg-purple-100 text-purple-700 text-xs font-semibold transition-all shadow-2xs"
                  >
                    Carregar mais atendimentos (+{Math.min(PAGE_SIZE, totalAtendimentos - visibleCount)}) · Exibindo {itensVisiveis.length} de {totalAtendimentos}
                  </button>
                </div>
              )}
            </>
          )}

          {/* BOTÃO DE UPLOAD MANUAL SE NECESSÁRIO */}
          {onUploadFotoManual && (
            <button
              type="button"
              onClick={onUploadFotoManual}
              className="w-full py-2 border border-dashed border-purple-200 hover:border-purple-500 rounded-md text-purple-600 bg-purple-50/30 hover:bg-purple-50/60 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Adicionar Foto / Documento Avulso</span>
            </button>
          )}

        </div>
      )}

      {/* LIGHTBOX */}
      {selectedFoto && (
        <PlanoFotoLightbox
          foto={selectedFoto}
          pacienteId={pacienteId}
          onClose={() => setSelectedFoto(null)}
        />
      )}
    </div>
  );
}
