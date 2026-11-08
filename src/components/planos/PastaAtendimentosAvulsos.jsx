import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  ArrowLeftRight,
  ChevronDown, 
  ChevronLeft,
  ChevronRight,
  Calendar, 
  Plus, 
  User, 
  RotateCcw, 
  Camera, 
  FileText,
  Eye,
  X
} from 'lucide-react';
import { GaleriaArquivoImage } from '../patients/GaleriaArquivoImage.jsx';
import { GaleriaMapaThumb } from '../patients/galeria/GaleriaMapaThumb.jsx';
import { ZoomableGalleryLightbox } from '../patients/ZoomableGalleryLightbox.jsx';
import { formatDataSessaoPtBr } from '../../utils/pacienteGaleria.js';
import { PlanoFotoLightbox } from './PlanoFotoLightbox.jsx';
import { diaDoInstante } from '../../utils/datasClinica.js';
import { useFusoClinica } from '../hooks/useFusoClinica.js';

const PAGE_SIZE = 15;

function AtendimentoAvulsoItemCard({
  atendimento,
  pacienteId,
  onOpenLightbox,
}) {
  const { fuso } = useFusoClinica();
  const [expandido, setExpandido] = useState(false);

  const fotos = useMemo(() => (Array.isArray(atendimento?.fotos) ? atendimento.fotos : []), [atendimento.fotos]);
  const retornos = Array.isArray(atendimento.retornos) ? atendimento.retornos : [];
  const isRetornoAtendimento = Boolean(atendimento?.isRetorno);
  const hasFotos = fotos.length > 0;
  const hasRetornos = retornos.length > 0;
  const hasObservacao = Boolean(atendimento.observacao && String(atendimento.observacao).trim());

  const procedimentosLista = useMemo(() => {
    if (Array.isArray(atendimento?.procedimentosItens) && atendimento.procedimentosItens.length > 0) {
      return atendimento.procedimentosItens;
    }
    if (Array.isArray(atendimento?.nomesProcedimentos) && atendimento.nomesProcedimentos.length > 0) {
      return atendimento.nomesProcedimentos.map((nome, idx) => ({
        id: `p_${idx}`,
        nome,
        corHex: null,
      }));
    }
    return [
      {
        id: atendimento?.procedimentoFeitoId || 'single',
        nome: atendimento?.nomeProcedimento || 'Procedimento Sem Plano',
        corHex: null,
      },
    ];
  }, [atendimento]);

  const temMultiplosProcedimentos = procedimentosLista.length > 1;

  // Agrupamento estrito por categoria clínica com separação de Antes, Pós-Imediato e Resultado
  const categoriasOrganizadas = useMemo(() => {
    const grupos = {
      antes: [],
      mapa: [],
      mapa_retorno: [],
      pos_imediato: [],
      depois: [],
      avaliacao: [],
      outro: [],
    };

    fotos.forEach((f) => {
      const cat = String(f.categoria || '').toLowerCase().trim();
      const cod = String(f.tipoFotoCodigo || f.tipo_foto_codigo || '').toUpperCase().trim();
      const leg = String(f.legenda || f.descricaoLegenda || '').toLowerCase();
      const isRetornoOverlay = String(f.mapaOverlay?.tipoMapaCodigo || '').toLowerCase() === 'retorno';
      const isRetornoMapa = isRetornoOverlay || leg.includes('mapa de retorno');

      if (isRetornoMapa) {
        grupos.mapa_retorno.push(f);
      } else if (cod === 'POS_IMEDIATO' || cat === 'pos_imediato' || leg.includes('pos-imediato') || leg.includes('pós-imediato')) {
        grupos.pos_imediato.push(f);
      } else if (cod === 'DEPOIS' || cat === 'depois' || leg.includes('resultado')) {
        grupos.depois.push(f);
      } else if (cat === 'antes' || cod === 'ANTES') {
        grupos.antes.push(f);
      } else if (cat === 'mapa' || cod === 'MAPA') {
        grupos.mapa.push(f);
      } else if (cat === 'avaliacao' || cod === 'AVALIACAO') {
        grupos.avaliacao.push(f);
      } else {
        grupos.outro.push(f);
      }
    });

    const ordem = [
      { key: 'antes', label: isRetornoAtendimento ? 'Antes (Retoque)' : 'Antes' },
      { key: 'mapa', label: 'Mapa de Aplicação' },
      { key: 'mapa_retorno', label: 'Mapa de Retorno' },
      { key: 'pos_imediato', label: isRetornoAtendimento ? 'Pós-Imediato (Retoque)' : 'Pós-Imediato' },
      { key: 'depois', label: isRetornoAtendimento ? 'Resultado da 1ª Consulta (Retorno)' : 'Depois' },
      { key: 'avaliacao', label: 'Avaliação' },
      { key: 'outro', label: 'Outros Registros' },
    ];

    return ordem
      .map(({ key, label }) => ({
        key,
        label,
        fotos: grupos[key] || [],
      }))
      .filter((c) => c.fotos.length > 0);
  }, [fotos, isRetornoAtendimento]);

  const codigoAtendimento = String(atendimento.chave || atendimento.id || 'SEM').replace(/^(ag_|pf_)/, '').slice(-4).toUpperCase();

  return (
    <div
      className={`bg-white rounded-lg border border-slate-200 shadow-2xs transition-all overflow-hidden ${
        atendimento.isRetorno ? 'border-l-4 border-l-[#00a88e]' : 'border-l-4 border-l-slate-300'
      }`}
    >
      {/* CABEÇALHO DO CARD (PADRÃO PLANOS DE TRATAMENTO) */}
      <div
        onClick={() => setExpandido((prev) => !prev)}
        className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white cursor-pointer hover:bg-slate-50/60 transition-colors select-none"
      >
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
            <Calendar className={`w-3 h-3 ${atendimento.isRetorno ? 'text-[#00a88e]' : 'text-slate-400'}`} />
            <span>
              {atendimento.dataISO ? `Atendido em ${formatDataSessaoPtBr(atendimento.dataISO)}` : 'Atendimento Sem Plano'}
              {atendimento.horaInicio ? ` · ${atendimento.horaInicio}` : ''}
            </span>
            <span
              className={`px-1.5 py-0.2 rounded font-bold text-[9px] ${
                atendimento.isRetorno ? 'bg-[#e6f7f5] text-[#00a88e]' : 'bg-slate-100 text-slate-600'
              }`}
            >
              #AT-{codigoAtendimento}
            </span>
          </div>

          <div className="min-w-0">
            {temMultiplosProcedimentos ? (
              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                {procedimentosLista.slice(0, 2).map((proc, idx) => (
                  <span
                    key={proc.id || idx}
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-white border border-slate-300 text-slate-800 shadow-2xs"
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: proc.corHex || '#00a88e' }}
                    />
                    <span className="truncate max-w-[150px]">{proc.nome}</span>
                  </span>
                ))}
                {procedimentosLista.length > 2 && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 border border-slate-200 text-slate-600">
                    +{procedimentosLista.length - 2} outros
                  </span>
                )}
              </div>
            ) : (
              <h4 className="font-bold text-slate-900 text-sm truncate pt-0.5">
                {atendimento.nomeProcedimento}
              </h4>
            )}
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-500 flex-wrap">
            <span>
              {procedimentosLista.length} {procedimentosLista.length === 1 ? 'Procedimento' : 'Procedimentos'}
            </span>
            <span className="text-slate-300">·</span>
            <span className={fotos.length > 0 ? 'text-teal-700 font-medium' : 'text-slate-400'}>
              {fotos.length} {fotos.length === 1 ? 'foto' : 'fotos'}
            </span>
            {hasRetornos && (
              <>
                <span className="text-slate-300">·</span>
                <span className="text-[#00a88e] font-semibold">
                  {retornos.length} {retornos.length === 1 ? 'retorno vinculado' : 'retornos vinculados'}
                </span>
              </>
            )}
            {atendimento.profissionalNome && atendimento.profissionalNome !== '—' && (
              <p
                className="text-[11px] text-slate-500 flex flex-wrap items-center gap-1.5 mt-0.5"
                title={
                  atendimento.profissionalAgendadoNome &&
                  atendimento.profissionalAgendadoNome !== atendimento.profissionalNome
                    ? atendimento.motivoTrocaProfissional
                      ? `Agendado com ${atendimento.profissionalAgendadoNome} → Realizado por ${atendimento.profissionalNome} · Motivo: ${atendimento.motivoTrocaProfissional}`
                      : `Agendado com ${atendimento.profissionalAgendadoNome} → Realizado por ${atendimento.profissionalNome}`
                    : atendimento.profissionalNome
                }
              >
                <User className="w-3 h-3 text-slate-400 shrink-0" />
                {atendimento.profissionalAgendadoNome &&
                atendimento.profissionalAgendadoNome !== atendimento.profissionalNome ? (
                  <span className="inline-flex flex-wrap items-center gap-1">
                    <span>Agendado com {atendimento.profissionalAgendadoNome}</span>
                    <ArrowLeftRight className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                    <span className="font-semibold text-slate-700">
                      Realizado por {atendimento.profissionalNome}
                    </span>
                  </span>
                ) : (
                  <span>{atendimento.profissionalNome}</span>
                )}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-end sm:self-auto shrink-0">
          {atendimento.isRetorno ? (
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#e6f7f5] text-[#00a88e] border border-[#00a88e]/30 flex items-center gap-1 shadow-2xs">
              <RotateCcw className="w-3 h-3 text-[#00a88e]" />
              RETORNO
            </span>
          ) : atendimento.isAvaliacao ? (
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs">
              AVALIAÇÃO
            </span>
          ) : (
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs">
              {atendimento.statusNome || 'FINALIZADO'}
            </span>
          )}

          <div className="p-1 rounded-md text-slate-400 hover:text-slate-700">
            <ChevronDown 
              className={`w-4 h-4 transition-transform duration-200 ${
                expandido ? 'rotate-180 text-[#00a88e]' : ''
              }`} 
            />
          </div>
        </div>
      </div>

      {/* DETALHES CLÍNICOS EXPANSÍVEIS (FOTOS + OBSERVAÇÕES + RETORNOS) */}
      {expandido && (
        <div className="p-3.5 bg-slate-50/50 border-t border-slate-100 space-y-3 animate-in fade-in duration-150 text-xs">
          
          {/* LISTA COMPLETA DE PROCEDIMENTOS DA SESSÃO */}
          {temMultiplosProcedimentos && (
            <div className="p-3 rounded-lg bg-white border border-slate-200 space-y-1.5 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Procedimentos Realizados nesta Sessão ({procedimentosLista.length}):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {procedimentosLista.map((proc, idx) => (
                  <span
                    key={proc.id || idx}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-slate-50 border border-slate-200 text-slate-700"
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: proc.corHex || '#00a88e' }}
                    />
                    <span className="font-semibold text-slate-800">{proc.nome}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* OBSERVAÇÃO CLÍNICA */}
          {hasObservacao && (
            <div className="p-2.5 rounded-lg bg-white border border-slate-200 text-slate-600 flex items-start gap-2 shadow-2xs">
              <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
              <p className="text-[11px] leading-relaxed">{atendimento.observacao}</p>
            </div>
          )}

          {/* FOTOS DO ATENDIMENTO EM PRATELEIRAS CLÍNICAS SEPARADAS */}
          {hasFotos ? (
            <div className="space-y-3 pt-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-[#00a88e]" />
                <span>Fotos Registradas neste Procedimento ({fotos.length}):</span>
              </span>

              <div className="space-y-3 pt-0.5">
                {categoriasOrganizadas.map(({ key, label, fotos: catFotos }) => (
                  <div key={key} className="space-y-1.5">
                    {/* Cabeçalho da Categoria */}
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs">
                        {label} · {catFotos.length} {catFotos.length === 1 ? 'foto' : 'fotos'}
                      </span>
                    </div>

                    {/* Linha Horizontal de Miniaturas */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
                      {catFotos.map((foto) => {
                        const isMapa =
                          Boolean(foto?.mapaOverlay?.marcacoes?.length) ||
                          foto?.categoria === 'mapa' ||
                          String(foto?.tipoFotoCodigo || '').toUpperCase() === 'MAPA' ||
                          String(foto?.mapaOverlay?.tipoMapaCodigo || '').toLowerCase() === 'retorno';
                        return (
                          <button
                            key={foto.id || foto.fotoId || foto.url}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenLightbox?.(foto, catFotos);
                            }}
                            className="group relative w-20 h-20 sm:w-24 sm:h-24 shrink-0 rounded-xl overflow-hidden border border-slate-200 bg-slate-900 shadow-2xs hover:border-[#00a88e] hover:shadow-md hover:scale-[1.03] transition-all cursor-pointer select-none text-left focus:outline-none focus:ring-2 focus:ring-[#00a88e]"
                            title={foto.descricaoLegenda || foto.categoria || 'Clique para ampliar com zoom'}
                          >
                            {isMapa ? (
                              <GaleriaMapaThumb
                                url={foto.url}
                                mapaOverlay={foto.mapaOverlay}
                                pacienteId={pacienteId}
                                fotoId={foto.fotoId || foto.id}
                                alt={foto.descricaoLegenda || 'Mapa de aplicação'}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <GaleriaArquivoImage
                                url={foto.url}
                                pacienteId={pacienteId}
                                fotoId={foto.fotoId || foto.id}
                                alt={foto.descricaoLegenda || 'Foto do procedimento'}
                                imgClassName="w-full h-full object-cover"
                              />
                            )}

                            {/* Hover overlay com ícone de zoom */}
                            <div className="absolute inset-0 bg-slate-950/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                              <span className="p-1 rounded-full bg-white/90 text-slate-800 shadow-xs">
                                <Eye className="w-3.5 h-3.5" />
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-slate-400 italic">
              Nenhuma foto anexada a este procedimento.
            </p>
          )}

          {/* RETORNOS VINCULADOS */}
          {hasRetornos && (
            <div className="pt-2 border-t border-slate-200/60 space-y-1.5">
              <span className="text-[9px] font-bold uppercase tracking-wider text-[#00a88e] block">
                Retornos Vinculados ({retornos.length}):
              </span>
              {retornos.map((ret, rIdx) => (
                <div
                  key={ret.id || rIdx}
                  className="px-2.5 py-1.5 rounded-lg bg-[#e6f7f5]/40 border border-[#00a88e]/20 flex items-center justify-between text-[11px]"
                >
                  <div className="flex items-center gap-1.5">
                    <RotateCcw className="w-3 h-3 text-[#00a88e]" />
                    <span className="font-semibold text-slate-800">
                      {ret.procedimentoNome || 'Retorno / Retoque'}
                    </span>
                  </div>
                  {ret.criadoEm && (
                    <span className="text-[10px] text-slate-500 font-mono">
                      {formatDataSessaoPtBr(diaDoInstante(ret.criadoEm, fuso))}
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
  fotosAvulsas: _fotosAvulsas = [],
  onUploadFotoManual,
  onOpenLightbox: onOpenLightboxProp,
  initialOpen: _initialOpen = true,
}) {
  const [selectedFoto, setSelectedFoto] = useState(null);
  const [selectedFotosLista, setSelectedFotosLista] = useState([]);
  const [zoomIndex, setZoomIndex] = useState(0);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [filtroTipo, setFiltroTipo] = useState('todos');

  const totalAtendimentos = atendimentosAvulsos.length;

  const handleOpenLightbox = onOpenLightboxProp || ((foto, lista) => {
    const list = Array.isArray(lista) && lista.length > 0 ? lista : [foto];
    const targetKey = String(foto?.serverId || foto?.id || foto?.fotoId || foto?.url);
    const idx = list.findIndex(
      (item) => String(item.serverId || item.id || item.fotoId || item.url) === targetKey
    );
    setSelectedFoto(foto);
    setSelectedFotosLista(list);
    setZoomIndex(idx >= 0 ? idx : 0);
  });

  // Filtros rápidos por tipo de atendimento
  const atendimentosFiltrados = useMemo(() => {
    if (filtroTipo === 'retornos') {
      return atendimentosAvulsos.filter((at) => at.isRetorno);
    }
    if (filtroTipo === 'avaliacoes') {
      return atendimentosAvulsos.filter((at) => at.isAvaliacao);
    }
    if (filtroTipo === 'procedimentos') {
      return atendimentosAvulsos.filter((at) => !at.isRetorno && !at.isAvaliacao);
    }
    return atendimentosAvulsos;
  }, [atendimentosAvulsos, filtroTipo]);

  const counts = useMemo(() => {
    let retornos = 0;
    let avaliacoes = 0;
    let procedimentos = 0;
    atendimentosAvulsos.forEach((at) => {
      if (at.isRetorno) retornos += 1;
      else if (at.isAvaliacao) avaliacoes += 1;
      else procedimentos += 1;
    });
    return {
      todos: atendimentosAvulsos.length,
      retornos,
      avaliacoes,
      procedimentos,
    };
  }, [atendimentosAvulsos]);

  const itensVisiveis = useMemo(() => {
    return atendimentosFiltrados.slice(0, visibleCount);
  }, [atendimentosFiltrados, visibleCount]);

  const hasMore = visibleCount < atendimentosFiltrados.length;

  return (
    <div className="space-y-3 mt-1">
      {/* BARRA DE FILTROS RÁPIDOS NO TOPO */}
      {totalAtendimentos > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap pb-1">
          <button
            type="button"
            onClick={() => setFiltroTipo('todos')}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
              filtroTipo === 'todos'
                ? 'bg-[#00a88e] text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            Todos ({counts.todos})
          </button>
          {counts.retornos > 0 && (
            <button
              type="button"
              onClick={() => setFiltroTipo('retornos')}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                filtroTipo === 'retornos'
                  ? 'bg-[#00a88e] text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              Retornos ({counts.retornos})
            </button>
          )}
          {counts.procedimentos > 0 && (
            <button
              type="button"
              onClick={() => setFiltroTipo('procedimentos')}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                filtroTipo === 'procedimentos'
                  ? 'bg-[#00a88e] text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              Procedimentos ({counts.procedimentos})
            </button>
          )}
          {counts.avaliacoes > 0 && (
            <button
              type="button"
              onClick={() => setFiltroTipo('avaliacoes')}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                filtroTipo === 'avaliacoes'
                  ? 'bg-[#00a88e] text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              Avaliações ({counts.avaliacoes})
            </button>
          )}
        </div>
      )}

      {/* LISTA DE CARDS SOLTOS */}
      {itensVisiveis.length === 0 ? (
        <div className="p-8 text-center text-xs text-slate-500 bg-white rounded-lg border border-slate-200 shadow-2xs">
          Nenhum atendimento encontrado para o filtro selecionado.
        </div>
      ) : (
        <div className="space-y-3">
          {itensVisiveis.map((atendimento) => (
            <AtendimentoAvulsoItemCard
              key={atendimento.chave}
              atendimento={atendimento}
              pacienteId={pacienteId}
              onOpenLightbox={handleOpenLightbox}
            />
          ))}
        </div>
      )}

      {/* BOTÃO CARREGAR MAIS SE HOUVER MUITOS PROCEDIMENTOS */}
      {hasMore && (
        <div className="pt-2 text-center">
          <button
            type="button"
            onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
            className="px-4 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-all shadow-2xs"
          >
            Carregar mais atendimentos (+{Math.min(PAGE_SIZE, atendimentosFiltrados.length - visibleCount)}) · Exibindo {itensVisiveis.length} de {atendimentosFiltrados.length}
          </button>
        </div>
      )}

      {/* BOTÃO DE UPLOAD MANUAL SE NECESSÁRIO */}
      {onUploadFotoManual && (
        <button
          type="button"
          onClick={onUploadFotoManual}
          className="w-full py-2.5 border border-dashed border-[#00a88e]/40 hover:border-[#00a88e] rounded-lg text-[#00a88e] bg-[#e6f7f5]/30 hover:bg-[#e6f7f5] text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-2xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Adicionar Foto / Documento Sem Plano</span>
        </button>
      )}

      {/* LIGHTBOX MODAL NO TOPO: PLANO FOTO LIGHTBOX PARA MAPAS, ZOOMABLE GALLERY LIGHTBOX PARA FOTOS CLÍNICAS NORMAIS */}
      {selectedFoto && (
        Boolean(selectedFoto?.mapaOverlay?.marcacoes?.length) ||
        selectedFoto?.categoria === 'mapa' ||
        String(selectedFoto?.tipoFotoCodigo || '').toUpperCase() === 'MAPA' ||
        String(selectedFoto?.mapaOverlay?.tipoMapaCodigo || '').toLowerCase() === 'retorno' ? (
          <PlanoFotoLightbox
            foto={selectedFoto}
            fotos={selectedFotosLista}
            pacienteId={pacienteId}
            onClose={() => {
              setSelectedFoto(null);
              setSelectedFotosLista([]);
            }}
          />
        ) : (
          createPortal(
            <div
              className="fixed inset-0 z-[220] bg-black/80 flex items-center justify-center p-4 select-none backdrop-blur-xs"
              onClick={() => {
                setSelectedFoto(null);
                setSelectedFotosLista([]);
              }}
              role="presentation"
            >
              <div
                className="relative max-w-[92vw] max-h-[92vh] flex flex-col items-center"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFoto(null);
                    setSelectedFotosLista([]);
                  }}
                  className="absolute -top-10 right-0 text-white font-bold flex items-center gap-1.5 hover:text-slate-300 transition-colors cursor-pointer text-sm"
                >
                  <X className="w-4 h-4" />
                  <span>Fechar</span>
                </button>
                {selectedFotosLista.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const nextIdx = (zoomIndex - 1 + selectedFotosLista.length) % selectedFotosLista.length;
                        setZoomIndex(nextIdx);
                        setSelectedFoto(selectedFotosLista[nextIdx]);
                      }}
                      className="absolute -left-12 top-1/2 -translate-y-1/2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-all cursor-pointer"
                      aria-label="Foto anterior"
                    >
                      <ChevronLeft className="h-6 w-6" strokeWidth={2.5} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const nextIdx = (zoomIndex + 1) % selectedFotosLista.length;
                        setZoomIndex(nextIdx);
                        setSelectedFoto(selectedFotosLista[nextIdx]);
                      }}
                      className="absolute -right-12 top-1/2 -translate-y-1/2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-all cursor-pointer"
                      aria-label="Próxima foto"
                    >
                      <ChevronRight className="h-6 w-6" strokeWidth={2.5} />
                    </button>
                  </>
                )}
                <ZoomableGalleryLightbox
                  url={selectedFoto.url ?? selectedFoto.src ?? selectedFoto.presignedUrl}
                  alt={selectedFoto.descricaoLegenda || selectedFoto.fileName || 'Foto do procedimento'}
                  authFetch={true}
                  pacienteId={pacienteId}
                  fotoId={selectedFoto.serverId || selectedFoto.fotoId || selectedFoto.id}
                />
              </div>
            </div>,
            document.body
          )
        )
      )}
    </div>
  );
}
