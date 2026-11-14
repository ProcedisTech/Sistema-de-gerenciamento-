import React, { useState, useMemo } from 'react';
import { 
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
import { formatarDataCalendario, normalizarDataCalendario, somarDias, diaDoInstante } from '../../utils/datasClinica.js';
import { useAgoraDaClinica } from '../hooks/useAgoraDaClinica.js';
import { PlanoFotoLightbox } from './PlanoFotoLightbox.jsx';
import { PlanoItemCard } from './PlanoItemCard.jsx';
import { isItemFinalizado } from '../../utils/planejamentoStatusUi.js';
import { isSessaoRetorno } from '../../utils/planejamentoSessoes.js';

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

/** @param {string} dataIso data de calendário  @param {string} hojeIso hoje no fuso da clínica */
function formatDataHumana(dataIso, hojeIso) {
  if (!dataIso) return '';
  const dataStr = normalizarDataCalendario(dataIso);

  if (hojeIso && dataStr === hojeIso) return 'Hoje';
  if (hojeIso && dataStr === somarDias(hojeIso, 1)) return 'Amanhã';

  return formatarDataCalendario(dataStr, { weekday: 'short', day: 'numeric', month: 'short' });
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
    const isVisitaRetorno = Boolean(visita.isRetornoVisita);

    const visitAgendaIds = new Set();
    const visitPfIds = new Set();
    (visita.itens || []).forEach((it) => {
      if (it.agendaId) visitAgendaIds.add(String(it.agendaId).trim());
      if (it.sessao?.agendaId) visitAgendaIds.add(String(it.sessao.agendaId).trim());
      if (it.sessaoAtiva?.agendaId) visitAgendaIds.add(String(it.sessaoAtiva.agendaId).trim());
      if (it.sessaoRealizada?.agendaId) visitAgendaIds.add(String(it.sessaoRealizada.agendaId).trim());
      if (it.procedimentoFeitoId) visitPfIds.add(String(it.procedimentoFeitoId).trim());
      if (it.sessao?.procedimentoFeitoId) visitPfIds.add(String(it.sessao.procedimentoFeitoId).trim());
      if (it.sessaoAtiva?.procedimentoFeitoId) visitPfIds.add(String(it.sessaoAtiva.procedimentoFeitoId).trim());
      if (it.sessaoRealizada?.procedimentoFeitoId) visitPfIds.add(String(it.sessaoRealizada.procedimentoFeitoId).trim());
    });
    if (visita.agendaId) visitAgendaIds.add(String(visita.agendaId).trim());

    const matchesVisit = (f) => {
      const fAgId = f.agendaId ? String(f.agendaId).trim() : null;
      let fPfId = f.procedimentoFeitoId ? String(f.procedimentoFeitoId).trim() : null;
      if (!fPfId && f.mapaOverlay?.procedimentos && Array.isArray(f.mapaOverlay.procedimentos)) {
        const pWithPf = f.mapaOverlay.procedimentos.find((p) => p.procedimentoFeitoId);
        if (pWithPf) fPfId = String(pWithPf.procedimentoFeitoId).trim();
      }
      const fData = String(f.dataISO || f.dataReferencia || '').slice(0, 10);

      if (fAgId && visitAgendaIds.size > 0) {
        return visitAgendaIds.has(fAgId);
      }
      if (fPfId && visitPfIds.size > 0) {
        return visitPfIds.has(fPfId);
      }
      if (f.matchedItemId && visita.itens?.length > 0) {
        const itemMatch = visita.itens.some((it) => {
          const rawId = String(it.id || it.planejamentoItemId || it.tempId || '');
          const baseItemId = String(it.planejamentoItemId || it.id || '').replace(/_retorno$/, '');
          const isRet = Boolean(it.isRetorno || it.tipo === 'retorno' || rawId.endsWith('_retorno'));
          const key = isRet ? `${baseItemId}_retorno` : baseItemId;
          return f.matchedItemId === key;
        });
        if (itemMatch) return true;
      }
      if (fData && visita.data) {
        return fData === visita.data;
      }
      return false;
    };

    (visita.itens || []).forEach((it) => {
      const rawId = String(it.id || it.planejamentoItemId || it.tempId || '');
      const baseItemId = String(it.planejamentoItemId || it.id || '').replace(/_retorno$/, '');
      const isRetornoItem = Boolean(it.isRetorno || it.tipo === 'retorno' || rawId.endsWith('_retorno'));
      const lookupKey = isRetornoItem ? `${baseItemId}_retorno` : baseItemId;

      const fotosDoItem = fotosPorPlanejamentoItemId[lookupKey] || [];
      fotosDoItem.forEach((f) => {
        if (!matchesVisit(f)) return;
        const key = String(f.id || f.fotoId || f.url);
        if (!map.has(key)) map.set(key, f);
      });
    });

    (fotosDoPlano || []).forEach((f) => {
      const tipoMapaOverlay = String(f.mapaOverlay?.tipoMapaCodigo || '').toLowerCase().trim();
      const isMapaProcOuRetorno = tipoMapaOverlay === 'procedimento' || tipoMapaOverlay === 'retorno';
      const fotoIsRetorno = Boolean(f.isRetorno || tipoMapaOverlay === 'retorno');

      // Se a visita for pura de avaliação (itens vazios), bloqueia estritamente fotos clínicas de procedimentos ou retorno
      if (visita.isAvaliacaoVisita) {
        const cat = String(f.categoria || '').toLowerCase().trim();
        if (cat === 'antes' || cat === 'pos_imediato' || cat === 'depois' || isMapaProcOuRetorno || fotoIsRetorno) {
          return;
        }
      }

      const isFotoAvaliacao =
        !isMapaProcOuRetorno &&
        !fotoIsRetorno &&
        (f.categoria === 'avaliacao' ||
          (String(f.tipoFotoCodigo || '').toUpperCase() === 'AVALIACAO' && f.categoria !== 'mapa') ||
          Boolean(f.isAvaliacao));

      const isDataOuAvaliacaoMatch =
        matchesVisit(f) ||
        (Boolean(visita.isAvaliacaoVisita) && isFotoAvaliacao);

      if (isDataOuAvaliacaoMatch) {
        if (fotoIsRetorno === isVisitaRetorno) {
          // Se a foto já tiver um matchedItemId específico, só descarta se NÃO for foto de avaliação
          if (f.matchedItemId && !isFotoAvaliacao && !visita.isAvaliacaoVisita) {
            const pertenceAEstaVisita = (visita.itens || []).some((it) => {
              const baseItemId = String(it.planejamentoItemId || it.id || '').replace(/_retorno$/, '');
              const expectedKey = isVisitaRetorno ? `${baseItemId}_retorno` : baseItemId;
              return f.matchedItemId === expectedKey;
            });
            if (!pertenceAEstaVisita) return;
          }
          const key = String(f.id || f.fotoId || f.url);
          if (!map.has(key)) map.set(key, f);
        }
      }
    });

    return Array.from(map.values());
  }, [visita.itens, visita.data, visita.isRetornoVisita, visita.isAvaliacaoVisita, visita.agendaId, fotosPorPlanejamentoItemId, fotosDoPlano]);

  // Agrupamento estrito por categoria clínica em prateleiras horizontais separadas
  const categoriasOrganizadas = useMemo(() => {
    const isVisitaRetorno = Boolean(visita.isRetornoVisita);
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
      const cod = String(f.tipoFotoCodigo || '').toUpperCase().trim();
      const leg = String(f.legenda || '').toLowerCase();
      const isRetornoOverlay = String(f.mapaOverlay?.tipoMapaCodigo || '').toLowerCase() === 'retorno';
      const isRetornoMapa = isRetornoOverlay || leg.includes('mapa de retorno');
      const isAv = cat === 'avaliacao' || cod === 'AVALIACAO' || Boolean(f.isAvaliacao);

      if (isRetornoMapa) grupos.mapa_retorno.push(f);
      else if (cod === 'POS_IMEDIATO' || cat === 'pos_imediato' || leg.includes('[pos_imediato]') || leg.includes('[pos-imediato]')) grupos.pos_imediato.push(f);
      else if (cat === 'mapa' || cod === 'MAPA') grupos.mapa.push(f);
      else if (cat === 'depois' || cod === 'DEPOIS' || leg.includes('[depois]')) grupos.depois.push(f);
      else if (cat === 'antes' || cod === 'ANTES' || leg.includes('[antes]')) grupos.antes.push(f);
      else if (isAv) grupos.avaliacao.push(f);
      else grupos.outro.push(f);
    });

    // Deduplicação inteligente de fotos de avaliação:
    // Se houver múltiplas fotos apontando para o mesmo mapaId ou rascunhos acumulados na mesma sessão/data,
    // preserva a versão mais recente de cada ângulo (ex: frontal e perfil separados).
    let fotosAvaliacao = grupos.avaliacao;
    if (fotosAvaliacao.length > 1) {
      const porAngulo = new Map();
      fotosAvaliacao.forEach((f) => {
        const angulo = f.anguloFotoCodigo || f.angulo || f.mapaOverlay?.anguloCodigo || 'frontal';
        porAngulo.set(angulo, f);
      });
      fotosAvaliacao = Array.from(porAngulo.values());
    }

    const ordem = [
      { key: 'antes', label: isVisitaRetorno ? 'Antes (Retoque)' : 'Antes' },
      { key: 'mapa', label: 'Mapa de Aplicação' },
      { key: 'mapa_retorno', label: 'Mapa de Retorno' },
      { key: 'pos_imediato', label: isVisitaRetorno ? 'Pós-Imediato (Retoque)' : 'Pós-Imediato' },
      { key: 'depois', label: isVisitaRetorno ? 'Resultado do Retorno' : 'Depois' },
      { key: 'avaliacao', label: 'Avaliação' },
      { key: 'outro', label: 'Outros Registros' },
    ];

    return ordem
      .map(({ key, label }) => ({
        key,
        label,
        fotos: key === 'avaliacao' ? fotosAvaliacao : (grupos[key] || []),
      }))
      .filter((c) => c.fotos.length > 0);
  }, [fotos, visita.isRetornoVisita]);

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
                  const hasMarkup = Boolean(f.mapaOverlay?.marcacoes?.length) || Boolean(f.mapaOverlay?.pontos?.length) || Boolean(f.pontos?.length);
                  return (
                    <div
                      key={f.id || f.fotoId || f.url}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectFoto(f, catFotos);
                      }}
                      className="group relative w-20 h-20 sm:w-24 sm:h-24 shrink-0 rounded-xl overflow-hidden border border-slate-200 bg-slate-900 shadow-2xs hover:border-[#00a88e] hover:shadow-md hover:scale-[1.03] transition-all cursor-pointer select-none"
                      title={f.descricaoLegenda || f.nomeProcedimento || 'Clique para ampliar com zoom'}
                    >
                      {hasMarkup ? (
                        <GaleriaMapaThumb
                          url={f.url}
                          mapaOverlay={f.mapaOverlay || (f.pontos ? { pontos: f.pontos } : null)}
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
  const { hojeIso, fuso } = useAgoraDaClinica();
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

    const resolverExecucaoReal = ({ agendaId, procedimentoFeitoId, basePlanejamentoItemId, isRetorno }) => {
      const pfEncontrado = (procedimentosFeitos || []).find((pf) => {
        const pfId = String(pf.id || pf.procedimentoFeitoId || '').trim();
        if (procedimentoFeitoId && pfId === String(procedimentoFeitoId).trim()) return true;

        const pfAgId = String(pf.agendaId || pf.agenda?.id || '').trim();
        if (agendaId && pfAgId && pfAgId === String(agendaId).trim()) return true;

        const pfPlanItemId = pf.planejamentoItemId ? String(pf.planejamentoItemId).replace(/_retorno$/, '').trim() : null;
        if (basePlanejamentoItemId && pfPlanItemId && pfPlanItemId === basePlanejamentoItemId) {
          const pfIsRet = Boolean(pf.isRetoque || pf.procedimentoFeitoOrigemId || String(pf.tipoProcedimentoCodigo || '').toLowerCase() === 'retorno');
          if (Boolean(isRetorno) === pfIsRet) return true;
        }
        return false;
      });

      if (!pfEncontrado) return null;

      const dataReal = pfEncontrado.criadoEm ? diaDoInstante(pfEncontrado.criadoEm, fuso) : null;
      let horaReal = null;
      if (pfEncontrado.horaInicio) {
        horaReal = String(pfEncontrado.horaInicio).slice(0, 5);
      } else if (pfEncontrado.criadoEm) {
        try {
          const dt = new Date(pfEncontrado.criadoEm);
          horaReal = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: fuso });
        } catch {
          horaReal = String(pfEncontrado.criadoEm).slice(11, 16);
        }
      }

      return {
        procedimentoFeitoId: String(pfEncontrado.id || pfEncontrado.procedimentoFeitoId || '').trim(),
        dataReal,
        horaReal,
      };
    };

    itens.forEach((item) => {
      const sessaoRealizadaItem = item.sessaoRealizada || (Array.isArray(item.sessoes) ? item.sessoes.find((s) => String(s.statusCodigo).toLowerCase() === 'realizado' && !isSessaoRetorno(s)) : null);
      const sessaoAtivaItem = item.sessaoAtiva || (Array.isArray(item.sessoes) ? item.sessoes.find((s) => !isSessaoRetorno(s) && String(s.statusCodigo).toLowerCase() !== 'realizado') : null);

      const isRealizado = isItemFinalizado(item.statusItem ?? item.statusItemNome);
      const basePlanejamentoItemId = String(item.planejamentoItemId || item.id || '').replace(/_retorno$/, '').trim();
      const execReal = isRealizado ? resolverExecucaoReal({
        agendaId: sessaoRealizadaItem?.agendaId || sessaoAtivaItem?.agendaId || item.agendaId,
        procedimentoFeitoId: sessaoRealizadaItem?.procedimentoFeitoId || item.procedimentoFeitoId,
        basePlanejamentoItemId,
        isRetorno: false,
      }) : null;

      const dataRealExecucao = execReal?.dataReal || item.dataRealizacao || item.realizadoEm || item.dataAtendimento;
      const horaRealExecucao = execReal?.horaReal || item.horaRealizacao;

      const dataIso =
        (isRealizado && dataRealExecucao)
          ? dataRealExecucao
          : (sessaoAtivaItem?.dataAgendamento ||
             sessaoRealizadaItem?.dataAgendamento ||
             item.dataPlanejada ||
             (isRealizado ? hojeIso : null));
      const dataKey = dataIso ? String(dataIso).slice(0, 10) : null;

      const itemEnriquecido = {
        ...item,
        dataRealizacao: dataRealExecucao || item.dataRealizacao,
        horaRealizacao: horaRealExecucao || item.horaRealizacao,
        procedimentoFeitoId: execReal?.procedimentoFeitoId || item.procedimentoFeitoId || sessaoRealizadaItem?.procedimentoFeitoId || null,
        sessaoRealizada: sessaoRealizadaItem ? {
          ...sessaoRealizadaItem,
          dataRealizacao: dataRealExecucao || sessaoRealizadaItem.dataRealizacao,
          horaRealizacao: horaRealExecucao || sessaoRealizadaItem.horaRealizacao,
          procedimentoFeitoId: execReal?.procedimentoFeitoId || sessaoRealizadaItem.procedimentoFeitoId || null,
        } : (item.sessaoRealizada || null),
        sessaoAtiva: sessaoAtivaItem || item.sessaoAtiva || null,
      };

      if (!dataKey) {
        semData.push(itemEnriquecido);
      } else {
        if (!gruposPorData.has(dataKey)) {
          gruposPorData.set(dataKey, {
            data: dataKey,
            dataHoraInicio:
              (isRealizado && horaRealExecucao) ||
              item.sessaoAtiva?.horaInicio ||
              item.sessaoRealizada?.horaInicio ||
              item.horaInicio ||
              item.horaRealizacao ||
              null,
            itens: [],
          });
        }
        gruposPorData.get(dataKey).itens.push(itemEnriquecido);
      }

      // VÍNCULO DE RETORNO DO PLANO (PADRÃO A: VISITA DEDICADA)
      let sessoesRetorno = (Array.isArray(item.sessoes) && item.sessoes.length > 0)
        ? item.sessoes.filter(isSessaoRetorno)
        : [];

      if (sessoesRetorno.length === 0) {
        const fallback = [item.sessaoRetornoAtiva, item.sessaoRetornoRealizada].filter(Boolean);
        if (fallback.length > 0) {
          sessoesRetorno = fallback;
        }
      }

      // Se ainda não tiver sessão de retorno, mas houver fotos de retorno em fotosPorPlanejamentoItemId, sintetiza
      if (sessoesRetorno.length === 0) {
        const fotosRetorno = fotosPorPlanejamentoItemId[`${basePlanejamentoItemId}_retorno`];
        if (Array.isArray(fotosRetorno) && fotosRetorno.length > 0) {
          const retornoDataIso = String(fotosRetorno[0].dataISO || fotosRetorno[0].dataReferencia || '').slice(0, 10);
          if (retornoDataIso) {
            sessoesRetorno = [{
              dataAgendamento: retornoDataIso,
              horaInicio: fotosRetorno[0].registradoEm ? String(fotosRetorno[0].registradoEm).slice(11, 16) : null,
              statusCodigo: 'realizado',
              isSynthetic: true,
            }];
          }
        }
      }

      sessoesRetorno.forEach((sessaoRetorno, sIdx) => {
        const isRetornoRealizado =
          String(sessaoRetorno?.statusCodigo).toLowerCase() === 'realizado' ||
          Boolean(sessaoRetorno?.dataRealizacao) ||
          Boolean(sessaoRetorno?.horaRealizacao) ||
          sessaoRetorno === item.sessaoRetornoRealizada;
        const isPaiRealizado = isItemFinalizado(item.statusItem ?? item.statusItemNome);

        const retExecReal = isRetornoRealizado ? resolverExecucaoReal({
          agendaId: sessaoRetorno?.agendaId || item.agendaId,
          procedimentoFeitoId: sessaoRetorno?.procedimentoFeitoId || item.sessaoRetornoRealizada?.procedimentoFeitoId,
          basePlanejamentoItemId,
          isRetorno: true,
        }) : null;

        const dataRealRetorno = retExecReal?.dataReal || sessaoRetorno?.dataRealizacao;
        const horaRealRetorno = retExecReal?.horaReal || sessaoRetorno?.horaRealizacao;

        const retornoDataIso = (isRetornoRealizado && dataRealRetorno)
          ? dataRealRetorno
          : sessaoRetorno?.dataAgendamento;
        if (!retornoDataIso) return;
        const retornoKey = String(retornoDataIso).slice(0, 10);

        const sessaoRetornoEnriquecida = {
          ...sessaoRetorno,
          dataRealizacao: dataRealRetorno || sessaoRetorno?.dataRealizacao,
          horaRealizacao: horaRealRetorno || sessaoRetorno?.horaRealizacao,
          procedimentoFeitoId: retExecReal?.procedimentoFeitoId || sessaoRetorno?.procedimentoFeitoId || null,
        };

        const retornoItem = {
          ...item,
          id: `${basePlanejamentoItemId}_retorno${sIdx > 0 ? `_${sIdx}` : ''}`,
          planejamentoItemId: basePlanejamentoItemId,
          catalogoNome: `Retorno Clínico · ${item.catalogoNome || 'Procedimento'}`,
          isRetorno: true,
          tipo: 'retorno',
          tipoProcedimentoCodigo: 'retorno',
          statusItem: isRetornoRealizado ? 'finalizado' : 'agendado',
          statusItemNome: isRetornoRealizado ? 'Finalizado' : 'Agendado',
          dataPlanejada: retornoDataIso,
          dataRealizacao: dataRealRetorno || item.dataRealizacao,
          horaRealizacao: horaRealRetorno || item.horaRealizacao,
          horaInicio: (isRetornoRealizado && horaRealRetorno) ? horaRealRetorno : sessaoRetorno.horaInicio,
          sessaoAtiva: isRetornoRealizado ? null : sessaoRetorno,
          sessaoRealizada: isRetornoRealizado ? sessaoRetornoEnriquecida : null,
          sessaoRetornoAtiva: null,
          sessaoRetornoRealizada: null,
          agendaId: sessaoRetorno?.agendaId || item.agendaId || null,
          procedimentoFeitoId:
            retExecReal?.procedimentoFeitoId ||
            sessaoRetorno?.procedimentoFeitoId ||
            (isRetornoRealizado ? item.sessaoRetornoRealizada?.procedimentoFeitoId : null) ||
            null,
          procedimentoFeitoOrigemId:
            sessaoRetorno?.procedimentoFeitoOrigemId ||
            item.sessaoRetornoAtiva?.procedimentoFeitoOrigemId ||
            item.sessaoRetornoRealizada?.procedimentoFeitoOrigemId ||
            item.procedimentoFeitoId ||
            item.sessaoRealizada?.procedimentoFeitoId ||
            item.procedimentoFeitoOrigemId ||
            null,
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

        const retSessionKey = sessaoRetorno?.agendaId
          ? `ag_${sessaoRetorno.agendaId}`
          : (retExecReal?.procedimentoFeitoId ? `pf_${retExecReal.procedimentoFeitoId}` : `item_${basePlanejamentoItemId}`);
        const groupKey = `${retornoKey}_ret_${retSessionKey}`;

        if (!gruposPorData.has(groupKey)) {
          gruposPorData.set(groupKey, {
            key: groupKey,
            data: retornoKey,
            dataHoraInicio: (isRetornoRealizado && horaRealRetorno) ? horaRealRetorno : (sessaoRetorno.horaInicio || null),
            isRetornoVisita: true,
            agendaId: sessaoRetorno?.agendaId || null,
            itens: [],
          });
        }
        const visitGroup = gruposPorData.get(groupKey);
        if (!visitGroup.dataHoraInicio && sessaoRetorno.horaInicio) {
          visitGroup.dataHoraInicio = sessaoRetorno.horaInicio;
        } else if (visitGroup.dataHoraInicio && sessaoRetorno.horaInicio && sessaoRetorno.horaInicio < visitGroup.dataHoraInicio) {
          visitGroup.dataHoraInicio = sessaoRetorno.horaInicio;
        }
        if (!visitGroup.agendaId && sessaoRetorno?.agendaId) {
          visitGroup.agendaId = sessaoRetorno.agendaId;
        }
        visitGroup.itens.push(retornoItem);
      });
    });

    // SÍNTESE DA VISITA DE AVALIAÇÃO CLÍNICA (quando há fotos/mapas de avaliação vinculados ao plano)
    const fotosDeAvaliacao = (fotosDoPlano || []).filter((f) => {
      const cat = String(f.categoria || '').toLowerCase().trim();
      const cod = String(f.tipoFotoCodigo || '').toUpperCase().trim();
      const tipoMapa = String(f.mapaOverlay?.tipoMapaCodigo || '').toLowerCase().trim();
      if (f.isRetorno || tipoMapa === 'retorno' || tipoMapa === 'procedimento') return false;
      return cat === 'avaliacao' || cod === 'AVALIACAO' || Boolean(f.isAvaliacao) || tipoMapa === 'avaliacao';
    });

    if (fotosDeAvaliacao.length > 0) {
      let dataAvaliacao = null;
      let horaAvaliacao = null;
      for (const f of fotosDeAvaliacao) {
        const rawData = String(f.dataISO || f.dataReferencia || '').slice(0, 10);
        if (rawData && rawData !== 'sem-data') {
          dataAvaliacao = rawData;
          horaAvaliacao = f.registradoEm ? String(f.registradoEm).slice(11, 16) : null;
          break;
        }
      }
      if (!dataAvaliacao && plano?.criadoEm) {
        dataAvaliacao = diaDoInstante(plano.criadoEm, fuso);
        horaAvaliacao = String(plano.criadoEm).slice(11, 16);
      }
      if (!dataAvaliacao) {
        dataAvaliacao = hojeIso;
      }

      if (dataAvaliacao) {
        const evalKey = `${dataAvaliacao}_avaliacao`;
        if (!gruposPorData.has(evalKey)) {
          gruposPorData.set(evalKey, {
            key: evalKey,
            data: dataAvaliacao,
            dataHoraInicio: horaAvaliacao || '00:00',
            isAvaliacaoVisita: true,
            tituloVisita: 'Avaliação Clínica & Mapeamento',
            itens: [],
          });
        }
      }
    }

    const visitas = Array.from(gruposPorData.values()).sort((a, b) => {
      const cmp = a.data.localeCompare(b.data);
      if (cmp !== 0) return cmp;
      if (a.isAvaliacaoVisita && !b.isAvaliacaoVisita) return -1;
      if (!a.isAvaliacaoVisita && b.isAvaliacaoVisita) return 1;
      return String(a.dataHoraInicio || '').localeCompare(String(b.dataHoraInicio || ''));
    });
    return { poolSemData: semData, visitasAgrupadas: visitas };
  }, [itens, fotosDoPlano, fotosPorPlanejamentoItemId, plano, fuso, hojeIso, procedimentosFeitos]);

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

  // Fotos e Mapas consolidados do Plano (com deduplicação inteligente por mapa e ângulo)
  const fotosAvaliacao = useMemo(() => {
    const mapaSeen = new Map();
    const semMapa = [];

    (fotosDoPlano || []).forEach((f) => {
      const mapaId = f.mapaOverlay?.id || f.mapaOverlay?.mapaId || f.mapaId;
      const angulo = f.anguloFotoCodigo || f.angulo || f.mapaOverlay?.anguloCodigo || 'frontal';
      if (mapaId) {
        mapaSeen.set(`${mapaId}_${angulo}`, f);
      } else {
        semMapa.push(f);
      }
    });

    const unicasSemMapa = new Map();
    semMapa.forEach((f) => {
      const key = String(f.id || f.fotoId || f.url);
      if (!unicasSemMapa.has(key)) unicasSemMapa.set(key, f);
    });

    return [...mapaSeen.values(), ...unicasSemMapa.values()];
  }, [fotosDoPlano]);

  return (
    <div className="space-y-4">
      {/* ── BLOCO 1: "ESCOLHIDOS, SEM DATA" (CONTAINER TRACEJADO - TOPO DO PLANO) ── */}
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

      {/* ── BLOCO 2: CRONOGRAMA DE VISITAS ── */}
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

              const todosFinalizados =
                Boolean(visita.isAvaliacaoVisita) ||
                (visita.itens.length > 0 &&
                  visita.itens.every((it) => {
                    const s = String(it.statusItem || it.statusItemNome || '').toLowerCase();
                    return s === 'finalizado' || s === 'realizado';
                  }));

              return (
                <div key={visita.key || `${visita.data}_${idx}`} className="relative">
                  <span
                    className={`absolute -left-[21.5px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-white shadow-2xs ${
                      todosFinalizados ? 'bg-emerald-500' : 'bg-[#00a88e]'
                    }`}
                  />

                  <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs space-y-2.5">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-[13px]">
                          Visita {idx + 1} ·{' '}
                          {visita.isAvaliacaoVisita
                            ? 'Avaliação Clínica & Mapeamento · '
                            : visita.temAvaliacao
                              ? 'Avaliação & Procedimentos · '
                              : visita.isRetornoVisita
                                ? 'Retorno Clínico · '
                                : ''}
                          {formatDataHumana(visita.data, hojeIso)}
                        </span>
                        {visita.dataHoraInicio && (
                          <span className="text-[11px] text-slate-500 font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                            {String(visita.dataHoraInicio).slice(0, 5)}
                          </span>
                        )}
                        {duracaoVisita > 0 && !visita.isAvaliacaoVisita && (
                          <span className="text-[11px] text-slate-400">
                            ({formatarTempoCadeira(duracaoVisita)})
                          </span>
                        )}
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

                        {visita.itens.length > 1 && (todosFinalizados || visita.isRetornoVisita) && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                            {visita.itens.length} procedimentos
                          </span>
                        )}

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

                        {!todosFinalizados && canBaixa && !visita.isRetornoVisita && !visita.isAvaliacaoVisita && visita.itens.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onIniciarAtendimentoVisita?.(visita, plano);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00a88e] hover:bg-[#008f79] text-white text-xs font-bold shadow-2xs transition-all select-none active:scale-95"
                          >
                            <Zap className="w-3.5 h-3.5" />
                            <span>Iniciar visita ({visita.itens.length})</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {visita.itens.length > 0 && (
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
                    )}

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

      {/* GALERIA CONSOLIDADA DE TODAS AS FOTOS E REGISTROS DESTE PLANO (MASTER GALLERY) */}
      {fotosAvaliacao.length > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-teal-100 bg-teal-50/40 p-2.5 shadow-2xs">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-100 text-[#00a88e]">
              <Camera className="h-4 w-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-800">
                {fotosAvaliacao.length} {fotosAvaliacao.length === 1 ? 'Foto / Mapa deste Plano' : 'Fotos / Mapas deste Plano'}
              </span>
              <span className="block text-[10px] text-slate-500 font-medium">
                Galeria consolidada de todas as visitas e registros deste plano
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {fotosAvaliacao.slice(0, 3).map((f) => (
              <div
                key={f.id || f.fotoId || f.url}
                onClick={() => setLightboxData({ foto: f, fotos: fotosAvaliacao })}
                className="h-7 w-7 rounded-md overflow-hidden border border-teal-200 cursor-pointer hover:border-[#00a88e] hover:scale-105 transition-transform"
                title={f.descricaoLegenda || 'Ver foto'}
              >
                {Boolean(f.mapaOverlay?.marcacoes?.length) || Boolean(f.mapaOverlay?.pontos?.length) || Boolean(f.pontos?.length) ? (
                  <GaleriaMapaThumb
                    url={f.url}
                    mapaOverlay={f.mapaOverlay || (f.pontos ? { pontos: f.pontos } : null)}
                    pacienteId={pacienteId}
                    fotoId={f.fotoId || f.id}
                    alt="Thumb"
                    className="w-full h-full"
                    imgClassName="w-full h-full object-cover"
                  />
                ) : (
                  <GaleriaArquivoImage
                    url={f.url}
                    pacienteId={pacienteId}
                    fotoId={f.fotoId || f.id}
                    alt="Thumb"
                    imgClassName="w-full h-full object-cover"
                  />
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => setLightboxData({ foto: fotosAvaliacao[0], fotos: fotosAvaliacao })}
              className="inline-flex items-center gap-1 rounded-lg border border-teal-200 bg-white px-2.5 py-1 text-xs font-semibold text-[#00a88e] hover:bg-teal-50 hover:border-[#00a88e] transition-colors cursor-pointer"
            >
              <Eye className="h-3.5 w-3.5" />
              <span>Ver Todas as Fotos</span>
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
