import React, { useState, useMemo } from 'react';
import { 
  Calendar, 
  Clock, 
  RotateCcw,
  Plus,
  CheckCircle2,
  CalendarClock,
  Sparkles,
  Zap,
  Camera,
  Eye,
  ChevronDown,
} from 'lucide-react';
import { GaleriaArquivoImage } from '../patients/GaleriaArquivoImage.jsx';
import { GaleriaMapaThumb } from '../patients/galeria/GaleriaMapaThumb.jsx';
import { GALERIA_CATEGORIA_LABELS } from '../../utils/pacienteGaleria.js';
import { GALERIA_CATEGORIA_BADGE_CLASS } from '../patients/galeria/galeriaUiConstants.js';
import { formatValorBrl } from '../../utils/planejamentoDraftUtils.js';
import { toLocalDateIso } from '../../utils/agendaDateUtils.js';
import { PlanoFotoLightbox } from './PlanoFotoLightbox.jsx';
import { PlanoItemCard } from './PlanoItemCard.jsx';
import { canReagendarItem, isItemFinalizado } from '../../utils/planejamentoStatusUi.js';

function formatarTempoCadeira(minutos) {
  const m = Number(minutos) || 0;
  if (m <= 0) return '0 min';
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const rest = m % 60;
    return `${h}h${rest ? String(rest).padStart(2, '0') : ''}`;
  }
  return `${m}min`;
}

function formatDataHumana(dataIso) {
  if (!dataIso) return '';
  const d = new Date(String(dataIso).slice(0, 10) + 'T12:00:00');
  const hojeStr = toLocalDateIso();
  const dataStr = String(dataIso).slice(0, 10);
  
  if (dataStr === hojeStr) return 'Hoje';
  
  const amanha = new Date();
  amanha.setDate(amanha.getDate() + 1);
  if (dataStr === toLocalDateIso(amanha)) return 'Amanhã';

  return d.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' });
}

function PlanoVisitaGaleria({
  visita,
  pacienteId,
  fotosDoPlano = [],
  fotosPorPlanejamentoItemId = {},
  onSelectFoto,
}) {
  const [isExpandido, setIsExpandido] = useState(true);

  const fotos = useMemo(() => {
    const map = new Map();
    (visita.itens || []).forEach((it) => {
      const itemId = String(it.id || it.planejamentoItemId || it.tempId || '');
      const fotosDoItem = fotosPorPlanejamentoItemId[itemId] || [];
      fotosDoItem.forEach((f) => {
        const key = String(f.id || f.fotoId || f.url);
        if (!map.has(key)) map.set(key, f);
      });
    });

    (fotosDoPlano || []).forEach((f) => {
      const fData = String(f.dataISO || f.dataReferencia || '').slice(0, 10);
      if (fData && fData === visita.data) {
        const key = String(f.id || f.fotoId || f.url);
        if (!map.has(key)) map.set(key, f);
      }
    });

    return Array.from(map.values());
  }, [visita.itens, visita.data, fotosPorPlanejamentoItemId, fotosDoPlano]);

  // Agrupamento estrito por categoria clínica em prateleiras horizontais separadas
  const categoriasOrganizadas = useMemo(() => {
    const grupos = {
      antes: [],
      mapa: [],
      depois: [],
      avaliacao: [],
      outro: [],
    };

    fotos.forEach((f) => {
      const cat = String(f.categoria || '').toLowerCase().trim();
      if (cat === 'antes') grupos.antes.push(f);
      else if (cat === 'mapa') grupos.mapa.push(f);
      else if (cat === 'depois') grupos.depois.push(f);
      else if (cat === 'avaliacao') grupos.avaliacao.push(f);
      else grupos.outro.push(f);
    });

    const ordem = [
      { key: 'antes', label: 'Antes' },
      { key: 'mapa', label: 'Mapa de Aplicação' },
      { key: 'depois', label: 'Depois' },
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
  }, [fotos]);

  if (!fotos || fotos.length === 0) return null;

  return (
    <div className="mt-2.5 pt-2.5 border-t border-slate-100 space-y-2">
      {/* Cabeçalho da Seção com Botão de Ocultar/Recolher */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Camera className="w-3.5 h-3.5 text-[#00a88e]" />
          <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wider">
            Fotos desta Visita
          </span>
          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
            {fotos.length} {fotos.length === 1 ? 'foto' : 'fotos'}
          </span>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsExpandido((prev) => !prev);
          }}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
        >
          <span>{isExpandido ? 'Recolher fotos' : 'Mostrar fotos'}</span>
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-200 ${
              isExpandido ? 'rotate-180' : ''
            }`}
          />
        </button>
      </div>

      {/* Conteúdo Expansível: Linhas por Categoria com Estilo Padrão Neutro */}
      {isExpandido && (
        <div className="space-y-3 pt-1">
          {categoriasOrganizadas.map(({ key, label, fotos: catFotos }) => (
            <div key={key} className="space-y-1.5">
              {/* Cabeçalho da Linha com Badge Neutro (Slate/Cinza) */}
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200/90 shadow-2xs">
                  {label} · {catFotos.length} {catFotos.length === 1 ? 'foto' : 'fotos'}
                </span>
              </div>

              {/* Linha Horizontal de Miniaturas */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
                {catFotos.map((f) => {
                  const hasMarkup = Boolean(f.mapaOverlay?.marcacoes?.length);
                  return (
                    <div
                      key={f.id || f.fotoId || f.url}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectFoto(f, fotos);
                      }}
                      className="group relative w-20 h-20 sm:w-24 sm:h-24 shrink-0 rounded-xl overflow-hidden border border-slate-200 bg-slate-900 shadow-2xs hover:border-[#00a88e] hover:shadow-md hover:scale-[1.03] transition-all cursor-pointer select-none"
                      title={f.descricaoLegenda || f.nomeProcedimento || 'Clique para ampliar com zoom'}
                    >
                      {hasMarkup ? (
                        <GaleriaMapaThumb
                          url={f.url}
                          mapaOverlay={f.mapaOverlay}
                          pacienteId={pacienteId}
                          fotoId={f.fotoId || f.id}
                          alt={f.descricaoLegenda || 'Mapa de aplicação'}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <GaleriaArquivoImage
                          url={f.url}
                          pacienteId={pacienteId}
                          fotoId={f.fotoId || f.id}
                          alt={f.descricaoLegenda || 'Foto do procedimento'}
                          imgClassName="w-full h-full object-cover"
                        />
                      )}

                      {/* Hover overlay com ícone de zoom */}
                      <div className="absolute inset-0 bg-slate-950/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                        <span className="p-1 rounded-full bg-white/90 text-slate-800 shadow-xs">
                          <Eye className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function PlanoVisitasTimeline({
  plano,
  pacienteId,
  fotosDoPlano = [],
  fotosPorPlanejamentoItemId = {},
  canCrud = true,
  canBaixa = true,
  canReagendar = true,
  canAgendar = true,
  mutating = false,
  onAgendarItem,
  onAgendarRetornoItem,
  onReagendarItem,
  onIniciarAtendimentoItem,
  onIniciarAtendimentoVisita,
  onDarBaixa,
  onEdit,
  onRemover,
  onAdicionarProcedimento,
  catalogoOptions = [],
  selecionados = new Set(),
  onToggleSelecao,
  termosFaltantes = [],
  procedimentosFeitos = [],
}) {
  const [lightboxData, setLightboxData] = useState(null); // { foto, fotos }

  const itens = useMemo(() => Array.isArray(plano?.itens) ? plano.itens : [], [plano]);

  const catalogoMap = useMemo(() => {
    const map = new Map();
    catalogoOptions.forEach((c) => {
      map.set(String(c.id), c);
      if (c.catalogoProcedimentoSaudeId) {
        map.set(String(c.catalogoProcedimentoSaudeId), c);
      }
    });
    return map;
  }, [catalogoOptions]);

  // Contagem de vezes que o paciente já fez determinado procedimento no histórico
  const contagemProcedimentosFeitos = useMemo(() => {
    const map = new Map();
    (procedimentosFeitos || []).forEach((proc) => {
      const id = String(proc.catalogoProcedimentoSaudeId || proc.id || '').trim();
      const nome = String(proc.nomeProcedimento || proc.nome || '').trim().toLowerCase();
      if (id) map.set(id, (map.get(id) || 0) + 1);
      if (nome) map.set(nome, (map.get(nome) || 0) + 1);
    });
    return map;
  }, [procedimentosFeitos]);

  const getVezesFeitas = (item) => {
    const id = String(item.catalogoProcedimentoSaudeId || item.catalogoId || '').trim();
    const nome = String(item.catalogoNome || '').trim().toLowerCase();
    return (id && contagemProcedimentosFeitos.get(id)) || (nome && contagemProcedimentosFeitos.get(nome)) || 0;
  };

  // Separação em dois grupos: Itens Sem Data (Pool não agendado) e Itens Agendados (Visitas)
  const { poolSemData, visitasAgrupadas } = useMemo(() => {
    const semData = [];
    const gruposPorData = new Map();

    itens.forEach((item) => {
      const dataIso =
        item.sessaoAtiva?.dataAgendamento ||
        item.sessaoRealizada?.dataAgendamento ||
        item.dataPlanejada;
      const dataKey = dataIso ? String(dataIso).slice(0, 10) : null;

      if (!dataKey) {
        semData.push(item);
      } else {
        if (!gruposPorData.has(dataKey)) {
          gruposPorData.set(dataKey, {
            data: dataKey,
            dataHoraInicio:
              item.sessaoAtiva?.horaInicio ||
              item.sessaoRealizada?.horaInicio ||
              item.horaInicio ||
              null,
            itens: [],
          });
        }
        gruposPorData.get(dataKey).itens.push(item);
      }

      // VÍNCULO DE RETORNO DO PLANO (PADRÃO A: VISITA DEDICADA)
      const sessaoRetorno = item.sessaoRetornoAtiva || item.sessaoRetornoRealizada;
      const retornoDataIso = sessaoRetorno?.dataAgendamento;
      if (retornoDataIso) {
        const retornoKey = String(retornoDataIso).slice(0, 10);
        const isRetornoRealizado = Boolean(item.sessaoRetornoRealizada) ||
          String(sessaoRetorno?.statusCodigo).toLowerCase() === 'realizado';
        const isPaiRealizado = isItemFinalizado(item.statusItem ?? item.statusItemNome);

        const retornoItem = {
          ...item,
          id: `${item.id || item.planejamentoItemId}_retorno`,
          planejamentoItemId: item.id || item.planejamentoItemId,
          catalogoNome: `Retorno Clínico · ${item.catalogoNome || 'Procedimento'}`,
          isRetorno: true,
          tipo: 'retorno',
          tipoProcedimentoCodigo: 'retorno',
          statusItem: isRetornoRealizado ? 'finalizado' : 'agendado',
          statusItemNome: isRetornoRealizado ? 'Finalizado' : 'Agendado',
          dataPlanejada: retornoDataIso,
          horaInicio: sessaoRetorno.horaInicio,
          sessaoAtiva: isRetornoRealizado ? null : sessaoRetorno,
          sessaoRealizada: isRetornoRealizado ? sessaoRetorno : null,
          sessaoRetornoAtiva: null,
          sessaoRetornoRealizada: null,
          valorOrcado: 0,
          dataPaiReal:
            item.sessaoAtiva?.dataAgendamento ||
            item.sessaoRealizada?.dataAgendamento ||
            item.dataRealizacao ||
            item.dataPlanejada ||
            null,
          horaPaiReal: item.sessaoAtiva?.horaInicio || item.sessaoRealizada?.horaInicio || null,
          statusPai: isPaiRealizado ? 'realizado' : (item.sessaoAtiva ? 'agendado' : 'planejado'),
          planoTitulo: plano?.titulo || plano?.nome || 'Plano de Tratamento',
        };

        if (!gruposPorData.has(retornoKey)) {
          gruposPorData.set(retornoKey, {
            data: retornoKey,
            dataHoraInicio: sessaoRetorno.horaInicio || null,
            isRetornoVisita: true,
            itens: [],
          });
        }
        gruposPorData.get(retornoKey).itens.push(retornoItem);
      }
    });

    const visitas = Array.from(gruposPorData.values()).sort((a, b) => a.data.localeCompare(b.data));
    return { poolSemData: semData, visitasAgrupadas: visitas };
  }, [itens]);

  // Tempo total e valor do pool sem data
  const duracaoSemData = useMemo(() => {
    return poolSemData.reduce((acc, i) => {
      const c = catalogoMap.get(String(i.catalogoProcedimentoSaudeId || i.catalogoId));
      return acc + (Number(c?.duracaoMin) || 30);
    }, 0);
  }, [poolSemData, catalogoMap]);

  const valorSemData = useMemo(() => {
    return poolSemData.reduce((acc, i) => acc + (Number(i.valorOrcado) || 0), 0);
  }, [poolSemData]);

  // Fotos de Avaliação e Aplicação
  const fotosAvaliacao = useMemo(() => {
    return fotosDoPlano.filter((f) => {
      const cat = (f.categoria || '').toLowerCase();
      return cat === 'avaliacao' || cat === 'antes' || cat === 'mapa' || cat === 'planejamento' || cat === 'modelo';
    });
  }, [fotosDoPlano]);

  return (
    <div className="space-y-4">
      {/* ── BLOCO 1: "ESCOLHIDOS, SEM DATA" (CONTAINER TRACEJADO) ── */}
      {poolSemData.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 px-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
            <span>Escolhidos, sem data</span>
            <span className="font-semibold normal-case text-slate-400">
              {poolSemData.length} procedimento{poolSemData.length !== 1 ? 's' : ''} ·{' '}
              {formatarTempoCadeira(duracaoSemData)} de cadeira · {formatValorBrl(valorSemData)}
            </span>
          </div>

          <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-3 shadow-2xs space-y-2">
            {poolSemData.map((item) => {
              const key = String(item.id || item.planejamentoItemId || item.tempId);
              const isSel = selecionados.has(key);
              const cat = catalogoMap.get(String(item.catalogoProcedimentoSaudeId || item.catalogoId));
              const vezes = getVezesFeitas(item);
              const temTermo = termosFaltantes.some(
                (tf) => String(tf.catalogoId) === String(item.catalogoProcedimentoSaudeId || item.catalogoId)
              );

              return (
                <PlanoItemCard
                  key={key}
                  item={item}
                  plano={plano}
                  planoTitulo={plano?.titulo || plano?.nome || 'Plano de Tratamento'}
                  visitaLabel="No plano"
                  canCrud={canCrud}
                  canBaixa={canBaixa}
                  canReagendar={canReagendar}
                  canAgendar={canAgendar}
                  mutating={mutating}
                  onAgendarItem={onAgendarItem}
                  onAgendarRetornoItem={onAgendarRetornoItem}
                  onReagendarItem={onReagendarItem}
                  onIniciarAtendimento={onIniciarAtendimentoItem}
                  onDarBaixa={onDarBaixa}
                  onEdit={onEdit}
                  onRemover={onRemover}
                  selecionavel={true}
                  selecionado={isSel}
                  onToggleSelecao={() => onToggleSelecao?.(key)}
                  vezesFeitas={vezes}
                  temTermoPendente={temTermo}
                  duracaoMin={cat?.duracaoMin}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* ── BLOCO 2: VISITAS AGENDADAS NA TB_AGENDA ── */}
      {visitasAgrupadas.length > 0 && (
        <div className="space-y-3">
          <div className="px-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
            Cronograma de Visitas
          </div>

          <div className="relative pl-4 border-l-2 border-[#00a88e] space-y-4">
            {visitasAgrupadas.map((visita, idx) => {
              const duracaoVisita = visita.itens.reduce((acc, it) => {
                const c = catalogoMap.get(String(it.catalogoProcedimentoSaudeId || it.catalogoId));
                return acc + (Number(c?.duracaoMin) || 30);
              }, 0);

              const todosFinalizados = visita.itens.every((it) => {
                const s = String(it.statusItem || it.statusItemNome || '').toLowerCase();
                return s === 'finalizado' || s === 'realizado';
              });

              return (
                <div key={visita.data} className="relative">
                  <span
                    className={`absolute -left-[21.5px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-white shadow-2xs ${
                      todosFinalizados ? 'bg-emerald-500' : 'bg-[#00a88e]'
                    }`}
                  />

                  <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs space-y-2.5">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-[13px]">
                          Visita {idx + 1} · {visita.isRetornoVisita ? 'Retorno Clínico · ' : ''}{formatDataHumana(visita.data)}
                        </span>
                        {visita.dataHoraInicio && (
                          <span className="text-[11px] text-slate-500 font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                            {String(visita.dataHoraInicio).slice(0, 5)}
                          </span>
                        )}
                        <span className="text-[11px] text-slate-400">
                          ({formatarTempoCadeira(duracaoVisita)})
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {(() => {
                          const termosPendentesVisita = visita.itens.filter((it) => {
                            const cid = String(it.catalogoProcedimentoSaudeId || it.catalogoId || '');
                            return termosFaltantes.some(
                              (tf) =>
                                String(tf.catalogoProcedimentoSaudeId || tf.catalogoId || tf.id || '') === cid ||
                                (tf.catalogos && tf.catalogos.some((c) => String(c.id || c.catalogoProcedimentoSaudeId) === cid)),
                            );
                          }).length;
                          if (termosPendentesVisita > 0) {
                            return (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                                {termosPendentesVisita} {termosPendentesVisita === 1 ? 'TERMO PENDENTE' : 'TERMOS PENDENTES'}
                              </span>
                            );
                          }
                          return null;
                        })()}

                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            todosFinalizados
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : visita.isRetornoVisita
                                ? 'bg-cyan-50 text-cyan-800 border border-cyan-200'
                                : 'bg-teal-50 text-teal-800 border border-teal-200'
                          }`}
                        >
                          {todosFinalizados
                            ? 'Concluída'
                            : visita.isRetornoVisita
                              ? 'Retorno Clínico'
                              : `${visita.itens.length} procedimento${visita.itens.length !== 1 ? 's' : ''}`}
                        </span>

                        {!todosFinalizados && canAgendar && (
                          <button
                            type="button"
                            onClick={() => {
                              const primeiroItem = visita.itens[0];
                              if (!primeiroItem) return;
                              const itemComVisita = {
                                ...primeiroItem,
                                visitaLabel: `Visita ${idx + 1}${visita.isRetornoVisita ? ' (Retorno Clínico)' : ''}`,
                              };
                              const jaAgendado = Boolean(primeiroItem.sessaoAtiva?.agendaId) || canReagendarItem(plano, primeiroItem);
                              if (jaAgendado && canReagendar && typeof onReagendarItem === 'function') {
                                onReagendarItem(itemComVisita, plano);
                              } else {
                                onAgendarItem?.(itemComVisita, undefined, plano?.id);
                              }
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-[11px] font-semibold transition-colors"
                          >
                            <Calendar className="w-3 h-3" />
                            <span>Mudar data</span>
                          </button>
                        )}

                        {!todosFinalizados && canBaixa && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onIniciarAtendimentoVisita?.(visita, plano);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[11px] font-bold shadow-2xs transition-all"
                          >
                            <Zap className="w-3 h-3" />
                            <span>{visita.isRetornoVisita ? 'Iniciar Retorno' : 'Iniciar visita'}</span>
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      {visita.itens.map((item) => {
                        const key = String(item.id || item.planejamentoItemId || item.tempId);
                        const isSel = selecionados.has(key);
                        const cat = catalogoMap.get(String(item.catalogoProcedimentoSaudeId || item.catalogoId));
                        const vezes = getVezesFeitas(item);
                        const temTermo = termosFaltantes.some(
                          (tf) => String(tf.catalogoId) === String(item.catalogoProcedimentoSaudeId || item.catalogoId)
                        );

                        return (
                          <PlanoItemCard
                            key={key}
                            item={item}
                            plano={plano}
                            planoTitulo={plano?.titulo || plano?.nome || 'Plano de Tratamento'}
                            visitaLabel={`Visita ${idx + 1}${visita.isRetornoVisita ? ' (Retorno Clínico)' : ''}`}
                            visitaData={visita.data}
                            visitaHora={visita.dataHoraInicio}
                            canCrud={canCrud}
                            canBaixa={canBaixa}
                            canReagendar={canReagendar}
                            canAgendar={canAgendar}
                            mutating={mutating}
                            onAgendarItem={onAgendarItem}
                            onAgendarRetornoItem={onAgendarRetornoItem}
                            onReagendarItem={onReagendarItem}
                            onIniciarAtendimento={onIniciarAtendimentoItem}
                            onDarBaixa={onDarBaixa}
                            onEdit={onEdit}
                            onRemover={onRemover}
                            selecionavel={true}
                            selecionado={isSel}
                            onToggleSelecao={() => onToggleSelecao?.(key)}
                            vezesFeitas={vezes}
                            temTermoPendente={temTermo}
                            duracaoMin={cat?.duracaoMin}
                          />
                        );
                      })}
                    </div>

                    {/* GALERIA DE FOTOS DA VISITA */}
                    <PlanoVisitaGaleria
                      visita={visita}
                      pacienteId={pacienteId}
                      fotosDoPlano={fotosDoPlano}
                      fotosPorPlanejamentoItemId={fotosPorPlanejamentoItemId}
                      onSelectFoto={(f, fotosVisita) => setLightboxData({ foto: f, fotos: fotosVisita })}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* DICA DE SELEÇÃO V6 */}
      <div className="py-1 text-center text-xs text-slate-400 font-medium">
        Toque em dois ou mais procedimentos e use <strong className="text-slate-600 font-semibold">Agendar juntos</strong> — vira um agendamento só.
      </div>

      {/* FOTOS DA AVALIAÇÃO / MARCAÇÃO VINCULADAS AO PLANO (VISUALIZAÇÃO DISCRETA SOB DEMANDA) */}
      {fotosAvaliacao.length > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-teal-100 bg-teal-50/40 p-2.5 shadow-2xs">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-100 text-[#00a88e]">
              <Camera className="h-4 w-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-800">
                {fotosAvaliacao.length} {fotosAvaliacao.length === 1 ? 'Foto / Mapa de Avaliação' : 'Fotos / Mapas de Avaliação'}
              </span>
              <span className="block text-[10px] text-slate-500 font-medium">
                Registros diagnósticos vinculados a este plano
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {fotosAvaliacao.slice(0, 3).map((f) => (
              <div
                key={f.id || f.fotoId}
                onClick={() => setLightboxData({ foto: f, fotos: fotosAvaliacao })}
                className="h-7 w-7 rounded-md overflow-hidden border border-teal-200 cursor-pointer hover:border-[#00a88e] hover:scale-105 transition-transform"
                title={f.descricaoLegenda || 'Ver foto'}
              >
                <GaleriaArquivoImage
                  url={f.url}
                  pacienteId={pacienteId}
                  fotoId={f.fotoId || f.id}
                  alt="Thumb"
                  imgClassName="w-full h-full object-cover"
                />
              </div>
            ))}
            <button
              type="button"
              onClick={() => setLightboxData({ foto: fotosAvaliacao[0], fotos: fotosAvaliacao })}
              className="inline-flex items-center gap-1 rounded-lg border border-teal-200 bg-white px-2.5 py-1 text-xs font-semibold text-[#00a88e] hover:bg-teal-50 hover:border-[#00a88e] transition-colors cursor-pointer"
            >
              <Eye className="h-3.5 w-3.5" />
              <span>Ver Fotos</span>
            </button>
          </div>
        </div>
      )}

      {/* BOTÃO PARA ADICIONAR PROCEDIMENTO DIRETO NO PLANO */}
      {canCrud && onAdicionarProcedimento && (
        <button
          type="button"
          onClick={() => onAdicionarProcedimento(plano.id)}
          className="w-full py-2 border-2 border-dashed border-slate-200 hover:border-[#00a88e] rounded-xl text-slate-600 hover:text-[#00a88e] bg-slate-50/50 hover:bg-teal-50/20 text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
        >
          <Plus className="w-4 h-4" strokeWidth={2.5} />
          <span>Adicionar procedimento a este plano</span>
        </button>
      )}

      {/* LIGHTBOX MODAL */}
      {lightboxData && (
        <PlanoFotoLightbox
          foto={lightboxData.foto}
          fotos={lightboxData.fotos}
          pacienteId={pacienteId}
          onClose={() => setLightboxData(null)}
        />
      )}
    </div>
  );
}
