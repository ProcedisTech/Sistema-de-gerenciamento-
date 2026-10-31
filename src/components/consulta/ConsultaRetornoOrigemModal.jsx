import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  Search,
  Folder,
  Calendar,
  Check,
  ChevronDown,
  Syringe,
  AlertCircle,
  AlertTriangle,
} from 'lucide-react';
import { pacientesApi, planejamentosApi, procedimentosApi } from '../../services/api.js';
import { normalizeApiList } from '../../utils/agendaDashboardMapping.js';
import { normalizeListaPlanos } from '../../utils/planejamentoNormalize.js';
import {
  formatProcedimentoRaizData,
  nomeProcedimentoRaiz,
} from '../agenda/retornoOrigemUtils.js';
import { useFusoClinica } from '../hooks/useFusoClinica.js';

export function ConsultaRetornoOrigemModal({
  open,
  pacienteId,
  onClose,
  onConfirm,
}) {
  const { fuso } = useFusoClinica();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [fieldError, setFieldError] = useState('');

  // Dados brutos processados
  const [planosAgrupados, setPlanosAgrupados] = useState([]);
  const [avulsos, setAvulsos] = useState([]);

  // Estados de navegação e escopo
  const [tabAtiva, setTabAtiva] = useState('planos'); // 'planos' | 'avulsos'
  const [openPlanoId, setOpenPlanoId] = useState(null); // Sanfona única
  const [query, setQuery] = useState('');
  const [selectedItemsMap, setSelectedItemsMap] = useState(() => new Map());
  const [activeScopeId, setActiveScopeId] = useState(null); // planoId ou 'avulso'
  const [pendingTabChange, setPendingTabChange] = useState(null);

  // Carregamento e agrupamento relacional dos procedimentos
  useEffect(() => {
    if (!open || !pacienteId) return undefined;
    let cancelled = false;

    Promise.allSettled([
      pacientesApi.listarProcedimentosFeitosRaiz(pacienteId),
      planejamentosApi.listarPorPaciente(pacienteId),
      procedimentosApi.byPaciente(pacienteId),
    ])
      .then(([resHistorico, resPlanos, resProcs]) => {
        if (cancelled) return;

        if (resHistorico.status === 'rejected') {
          setError(resHistorico.reason?.message || 'Erro ao carregar procedimentos.');
          setLoading(false);
          return;
        }

        const raizesRaw = normalizeApiList(resHistorico.value);

        // Mapa de planos por item ID
        const planosMap = new Map();
        const planosValidos = [];
        const itensDePlanosCancelados = new Set();

        if (resPlanos.status === 'fulfilled') {
          const planos = normalizeListaPlanos(resPlanos.value);
          (planos || []).forEach((plano) => {
            const st = String(plano.statusCodigo || '').toLowerCase();
            // Oculta planos cancelados (Decisão 3 do /grill-me)
            if (st === 'cancelado') {
              const itens = Array.isArray(plano.itens) ? plano.itens : [];
              itens.forEach((it) => {
                const itemId = String(it.id || it.planejamentoItemId || '').trim();
                if (itemId) {
                  itensDePlanosCancelados.add(itemId);
                }
              });
              return;
            }

            const pId = String(plano.id);
            const planoTitulo = 'Plano de Tratamento'; // Nomenclatura canônica
            const dataCriacao = plano.criadoEm || plano.dataCriacao || plano.data || null;

            const planoObj = {
              planoId: pId,
              titulo: planoTitulo,
              criadoEm: dataCriacao,
              statusCodigo: st,
              itens: [],
            };
            planosValidos.push(planoObj);

            const itens = Array.isArray(plano.itens) ? plano.itens : [];
            itens.forEach((it) => {
              const itemId = String(it.id || it.planejamentoItemId || '').trim();
              if (itemId) {
                planosMap.set(itemId, planoObj);
              }
            });
          });
        }

        // Histórico de atendimentos do paciente para contagem de retornos
        const allProcs =
          resProcs.status === 'fulfilled'
            ? Array.isArray(resProcs.value)
              ? resProcs.value
              : resProcs.value?.content ?? []
            : [];

        const listAvulsos = [];

        raizesRaw.forEach((r) => {
          const rId = String(r.id);
          const retornosCount = allProcs.filter(
            (p) => String(p.procedimentoFeitoOrigemId || '') === rId,
          ).length;

          const planItemId = r.planejamentoItemId ? String(r.planejamentoItemId).trim() : null;
          if (planItemId && itensDePlanosCancelados.has(planItemId)) {
            return;
          }
          const planoDono = planItemId ? planosMap.get(planItemId) : null;

          const baseItem = {
            id: rId,
            procedimentoFeitoOrigemId: rId,
            nome: nomeProcedimentoRaiz(r),
            catalogoProcedimentoSaudeId: r.catalogoProcedimentoSaudeId || r.catalogoId || null,
            catalogoId: r.catalogoProcedimentoSaudeId || r.catalogoId || null,
            catalogoNome: r.catalogoProcedimentoNome || r.nomeCatalogo || r.nome,
            data: r.data,
            planejamentoItemId: planItemId,
            jaRealizado: true,
            retornosCount,
          };

          if (planoDono) {
            planoDono.itens.push({
              ...baseItem,
              tipoOrigem: 'plano',
              planoId: planoDono.planoId,
              planoTitulo: planoDono.titulo,
              planoStatus: planoDono.statusCodigo,
            });
          } else {
            listAvulsos.push({
              ...baseItem,
              tipoOrigem: 'historico',
              planoId: null,
            });
          }
        });

        // Filtrar planos que realmente possuem procedimentos realizados
        const planosComItens = planosValidos.filter((p) => p.itens.length > 0);

        // Ordenação dos planos: em andamento primeiro, depois por data decrescente
        planosComItens.sort((a, b) => {
          const aAtivo = a.statusCodigo === 'em_andamento' || a.statusCodigo === 'ativo';
          const bAtivo = b.statusCodigo === 'em_andamento' || b.statusCodigo === 'ativo';
          if (aAtivo && !bAtivo) return -1;
          if (!aAtivo && bAtivo) return 1;
          return String(b.criadoEm || '').localeCompare(String(a.criadoEm || ''));
        });

        setPlanosAgrupados(planosComItens);
        setAvulsos(listAvulsos);

        // Abertura inteligente (Decisão 1 do /grill-me):
        if (planosComItens.length > 0) {
          setTabAtiva('planos');
          setOpenPlanoId(planosComItens[0].planoId);
        } else if (listAvulsos.length > 0) {
          setTabAtiva('avulsos');
          setOpenPlanoId(null);
        } else {
          setTabAtiva('planos');
          setOpenPlanoId(null);
        }

        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message || 'Erro ao carregar procedimentos.');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, pacienteId]);

  // Filtragem por busca (Hooks chamados incondicionalmente no topo)
  const qClean = query.trim().toLowerCase();

  const planosFiltrados = useMemo(() => {
    if (!qClean) return planosAgrupados;
    return planosAgrupados
      .map((plano) => {
        const dataFmt = formatProcedimentoRaizData(plano.criadoEm, fuso).toLowerCase();
        const itensMatch = plano.itens.filter((it) => {
          const itNome = String(it.nome || '').toLowerCase();
          const itData = formatProcedimentoRaizData(it.data, fuso).toLowerCase();
          return itNome.includes(qClean) || itData.includes(qClean);
        });
        if (dataFmt.includes(qClean)) return plano;
        if (itensMatch.length > 0) {
          return { ...plano, itens: itensMatch };
        }
        return null;
      })
      .filter(Boolean);
  }, [planosAgrupados, qClean, fuso]);

  const avulsosFiltrados = useMemo(() => {
    if (!qClean) return avulsos;
    return avulsos.filter((it) => {
      const itNome = String(it.nome || '').toLowerCase();
      const itData = formatProcedimentoRaizData(it.data, fuso).toLowerCase();
      return itNome.includes(qClean) || itData.includes(qClean);
    });
  }, [avulsos, qClean, fuso]);

  if (!open) return null;

  // Sanfona Única: expande um e fecha os outros
  const handleToggleAccordion = (planoId) => {
    setOpenPlanoId((prev) => (prev === planoId ? null : planoId));
  };

  // Troca de aba com confirmação (Decisão 4 do /grill-me)
  const handleTabClick = (targetTab) => {
    if (targetTab === tabAtiva) return;
    if (selectedItemsMap.size > 0) {
      setPendingTabChange(targetTab);
      return;
    }
    setTabAtiva(targetTab);
  };

  const handleConfirmTabChange = () => {
    setSelectedItemsMap(new Map());
    setActiveScopeId(null);
    setFieldError('');
    if (pendingTabChange) {
      setTabAtiva(pendingTabChange);
      setPendingTabChange(null);
    }
  };

  const handleCancelTabChange = () => {
    setPendingTabChange(null);
  };

  // Seleção e trava inteligente de escopo
  const handleToggleItem = (item, scopeId) => {
    if (!item?.id) return;
    const itemId = String(item.id);

    // Se o escopo estiver travado em outro plano/avulso, bloqueia
    if (activeScopeId !== null && activeScopeId !== scopeId) {
      return;
    }

    setSelectedItemsMap((prev) => {
      const next = new Map(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
        if (next.size === 0) {
          setActiveScopeId(null);
        }
      } else {
        next.set(itemId, item);
        setActiveScopeId(scopeId);
      }
      return next;
    });
    setFieldError('');
  };

  const handleClearSelection = () => {
    setSelectedItemsMap(new Map());
    setActiveScopeId(null);
    setFieldError('');
  };

  const selectedCount = selectedItemsMap.size;

  const handleClose = () => {
    setSelectedItemsMap(new Map());
    setActiveScopeId(null);
    setFieldError('');
    onClose?.();
  };

  const handleConfirm = () => {
    const items = Array.from(selectedItemsMap.values());
    if (items.length === 0) {
      setFieldError('Selecione ao menos um procedimento de origem do retorno.');
      return;
    }
    onConfirm?.(items);
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-slate-900/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="consulta-retorno-origem-title"
    >
      <div className="w-full max-w-md sm:max-w-xl md:max-w-2xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-150 rounded-2xl border border-app-border bg-white shadow-2xl transition-all overflow-hidden">
        
        {/* Cabeçalho */}
        <div className="p-5 sm:p-6 pb-4 border-b border-slate-100 flex items-start justify-between gap-3 shrink-0">
          <div>
            <h3
              id="consulta-retorno-origem-title"
              className="text-[17px] sm:text-[19px] font-extrabold text-[#0f172a] tracking-tight"
            >
              Iniciar retorno
            </h3>
            <p className="mt-1 text-[13px] sm:text-[14px] text-[#64748b] leading-relaxed">
              Escolha os procedimentos anteriores que serão avaliados neste retorno. Você pode selecionar múltiplos procedimentos.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-xl p-2 text-[#64748b] hover:bg-slate-100 hover:text-slate-900 transition-colors"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Busca */}
        <div className="px-5 sm:px-6 pt-4 pb-2 shrink-0">
          <label
            htmlFor="retorno-origem-search-input"
            className="block text-[11px] font-extrabold uppercase tracking-wide text-ink-500 mb-1.5"
          >
            Retorno de qual procedimento? <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="retorno-origem-search-input"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome ou data…"
              className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-10 pr-4 text-[13.5px] text-slate-800 outline-none transition-all focus:border-[#00a88e] focus:ring-2 focus:ring-[#e6f7f5]"
              autoComplete="off"
            />
          </div>
        </div>

        {/* Abas Superiores de Escopo (v3) */}
        <div className="flex items-center gap-2 px-5 sm:px-6 py-2 border-b border-slate-100 shrink-0 bg-white">
          <button
            type="button"
            role="tab"
            aria-selected={tabAtiva === 'planos'}
            onClick={() => handleTabClick('planos')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-[12.5px] font-bold border transition-all ${
              tabAtiva === 'planos'
                ? 'bg-[#e6f7f5] text-[#0f766e] border-[#00a88e] shadow-xs'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Folder className="h-4 w-4" />
            Planos de Tratamento
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10.5px] font-extrabold ${
                tabAtiva === 'planos' ? 'bg-[#00a88e] text-white' : 'bg-slate-200 text-slate-600'
              }`}
            >
              {planosAgrupados.length}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={tabAtiva === 'avulsos'}
            onClick={() => handleTabClick('avulsos')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-[12.5px] font-bold border transition-all ${
              tabAtiva === 'avulsos'
                ? 'bg-[#e6f7f5] text-[#0f766e] border-[#00a88e] shadow-xs'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Syringe className="h-4 w-4" />
            Sem Plano (Avulsos)
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10.5px] font-extrabold ${
                tabAtiva === 'avulsos' ? 'bg-[#00a88e] text-white' : 'bg-slate-200 text-slate-600'
              }`}
            >
              {avulsos.length}
            </span>
          </button>
        </div>

        {/* Diálogo de Confirmação de Troca de Aba com Seleção Ativa */}
        {pendingTabChange && (
          <div className="mx-5 sm:mx-6 my-2 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2 text-[12.5px] text-amber-900 font-medium">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <span>
                Você tem <b>{selectedCount}</b> item(ns) selecionado(s). Deseja desmarcar para alternar para a aba{' '}
                <b>{pendingTabChange === 'planos' ? 'Planos de Tratamento' : 'Sem Plano'}</b>?
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                aria-label="Cancelar troca de aba"
                onClick={handleCancelTabChange}
                className="px-2.5 py-1 text-[11.5px] font-semibold text-slate-600 hover:bg-amber-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmTabChange}
                className="px-3 py-1 text-[11.5px] font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow-xs transition-colors"
              >
                Sim, desmarcar
              </button>
            </div>
          </div>
        )}

        {/* Banner de Escopo Travado */}
        {activeScopeId && selectedCount > 0 && !pendingTabChange && (
          <div className="mx-5 sm:mx-6 my-2 px-3 py-2 bg-teal-50/90 border border-teal-200 rounded-xl flex items-center justify-between gap-2 shrink-0">
            <span className="text-[12px] text-teal-800 font-medium">
              🔒 Escopo ativo:{' '}
              <b>
                {activeScopeId === 'avulso'
                  ? 'Procedimentos Avulsos'
                  : planosAgrupados.find((p) => p.planoId === activeScopeId)
                    ? `Plano de Tratamento (${formatProcedimentoRaizData(
                        planosAgrupados.find((p) => p.planoId === activeScopeId)?.criadoEm,
                        fuso,
                      )})`
                    : 'Plano de Tratamento'}
              </b>
              . Outros planos bloqueados para manter a consistência do retorno.
            </span>
            <button
              type="button"
              onClick={handleClearSelection}
              className="text-[11.5px] font-bold text-teal-700 hover:text-teal-900 underline shrink-0 cursor-pointer"
            >
              Limpar seleção
            </button>
          </div>
        )}

        {/* Erro de validação de campo */}
        {fieldError && (
          <div className="mx-5 sm:mx-6 mt-2 p-2.5 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-[12.5px] text-red-700 shrink-0">
            <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
            <span>{fieldError}</span>
          </div>
        )}

        {/* Lista com Rolagem Única e Expansão Natural (Sem Sub-Scroll) */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-3 space-y-3 min-h-0">
          {loading ? (
            <div className="py-12 text-center text-[13px] text-slate-500">
              Carregando procedimentos do paciente…
            </div>
          ) : error ? (
            <div className="py-8 text-center text-[13px] text-red-600">{error}</div>
          ) : tabAtiva === 'planos' ? (
            /* ─── ABA 1: PLANOS DE TRATAMENTO ─── */
            planosFiltrados.length === 0 ? (
              <div className="py-10 text-center text-[13px] text-slate-500">
                {qClean
                  ? 'Nenhum plano encontrado para esta busca.'
                  : 'Este paciente não possui procedimentos realizados em planos de tratamento.'}
              </div>
            ) : (
              planosFiltrados.map((plano) => {
                const isOpen = openPlanoId === plano.planoId || Boolean(qClean);
                const isScopeActive = activeScopeId === plano.planoId;
                const isLocked = activeScopeId !== null && activeScopeId !== plano.planoId;
                const selecionadosDestePlano = plano.itens.filter((it) =>
                  selectedItemsMap.has(String(it.id)),
                ).length;

                const isAtivo =
                  plano.statusCodigo === 'em_andamento' || plano.statusCodigo === 'ativo';

                return (
                  <div
                    key={`plano-acc-${plano.planoId}`}
                    className={`border rounded-2xl bg-white transition-all ${
                      isScopeActive
                        ? 'border-[#00a88e] ring-1 ring-[#00a88e]/40 shadow-sm'
                        : isLocked
                          ? 'border-slate-200 opacity-60 bg-slate-50/50'
                          : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {/* Cabeçalho do Accordion (Sanfona Única) */}
                    <div
                      role="button"
                      tabIndex={0}
                      aria-expanded={isOpen}
                      onClick={() => handleToggleAccordion(plano.planoId)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleToggleAccordion(plano.planoId);
                        }
                      }}
                      className={`w-full flex items-center justify-between gap-3 p-3.5 sm:p-4 text-left cursor-pointer select-none transition-colors rounded-2xl ${
                        isOpen ? 'border-b border-slate-100 rounded-b-none bg-slate-50/60' : 'hover:bg-slate-50/80'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                            isScopeActive ? 'bg-[#00a88e] text-white' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          <Folder className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[13.5px] sm:text-[14px] font-extrabold text-[#0f172a]">
                              {plano.titulo}
                            </span>
                            {isAtivo ? (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-xs" />
                                Em andamento
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                <Check className="w-3 h-3 text-[#00a88e]" />
                                Concluído
                              </span>
                            )}
                          </div>
                          <p className="text-[12px] text-slate-500 mt-0.5">
                            Criado em {formatProcedimentoRaizData(plano.criadoEm, fuso)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0">
                        <span
                          className={`px-2.5 py-1 rounded-lg text-[11.5px] sm:text-[12px] font-bold border transition-all ${
                            selecionadosDestePlano > 0
                              ? 'bg-[#00a88e] text-white border-[#00a88e] shadow-xs'
                              : 'bg-blue-50 text-blue-800 border-blue-200'
                          }`}
                        >
                          {selecionadosDestePlano > 0
                            ? `✓ ${selecionadosDestePlano} de ${plano.itens.length} selecionados`
                            : `${plano.itens.length} ${plano.itens.length === 1 ? 'procedimento' : 'procedimentos'}`}
                        </span>
                        <ChevronDown
                          className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                            isOpen ? 'rotate-180 text-slate-700' : ''
                          }`}
                        />
                      </div>
                    </div>

                    {/* Corpo Expansível com Altura 100% Natural (Sem Sub-Scroll) */}
                    {isOpen && (
                      <div className="p-2.5 sm:p-3 space-y-2 bg-white rounded-b-2xl animate-in fade-in duration-150">
                        {plano.itens.map((proc) => {
                          const isSelected = selectedItemsMap.has(String(proc.id));
                          const itemLocked = isLocked;

                          return (
                            <button
                              key={`proc-plano-${proc.id}`}
                              type="button"
                              role="checkbox"
                              aria-checked={isSelected}
                              aria-disabled={itemLocked}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleItem(proc, plano.planoId);
                              }}
                              className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                                isSelected
                                  ? 'border-[#00a88e] bg-[#e6f7f5] shadow-xs'
                                  : itemLocked
                                    ? 'border-slate-200 bg-slate-50 cursor-not-allowed opacity-60'
                                    : 'border-slate-200 bg-white hover:border-teal-300 hover:bg-teal-50/20'
                              }`}
                            >
                              <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200/80 text-[#00a88e] flex items-center justify-center shrink-0">
                                <Syringe className="h-4 w-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span
                                    className={`text-[13px] sm:text-[13.5px] font-semibold truncate ${
                                      isSelected ? 'text-[#0f766e]' : 'text-slate-900'
                                    }`}
                                  >
                                    {proc.nome}
                                  </span>
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-100 text-teal-800 border border-teal-200">
                                    No Plano
                                  </span>
                                  {proc.retornosCount > 0 && (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                      {proc.retornosCount === 1
                                        ? '1 retorno'
                                        : `${proc.retornosCount} retornos`}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[12px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                                  <Calendar className="h-3.5 w-3.5 shrink-0" />
                                  <span>Realizado em {formatProcedimentoRaizData(proc.data, fuso)}</span>
                                </p>
                              </div>

                              {itemLocked ? (
                                <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                                  Outro plano
                                </span>
                              ) : (
                                <div
                                  className={`w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 transition-all ${
                                    isSelected
                                      ? 'border-[#00a88e] bg-[#00a88e] text-white'
                                      : 'border-slate-300 bg-white'
                                  }`}
                                >
                                  {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )
          ) : (
            /* ─── ABA 2: PROCEDIMENTOS AVULSOS ─── */
            avulsosFiltrados.length === 0 ? (
              <div className="py-10 text-center text-[13px] text-slate-500">
                {qClean
                  ? 'Nenhum procedimento avulso encontrado para esta busca.'
                  : 'Este paciente não possui procedimentos avulsos no histórico.'}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="px-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 flex justify-between">
                  <span>Procedimentos Avulsos (Histórico)</span>
                  <span>{avulsosFiltrados.length} itens</span>
                </div>
                {avulsosFiltrados.map((proc) => {
                  const isSelected = selectedItemsMap.has(String(proc.id));
                  const itemLocked = activeScopeId !== null && activeScopeId !== 'avulso';

                  return (
                    <button
                      key={`proc-avulso-${proc.id}`}
                      type="button"
                      role="checkbox"
                      aria-checked={isSelected}
                      aria-disabled={itemLocked}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleItem(proc, 'avulso');
                      }}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'border-[#00a88e] bg-[#e6f7f5] shadow-xs'
                          : itemLocked
                            ? 'border-slate-200 bg-slate-50 cursor-not-allowed opacity-60'
                            : 'border-slate-200 bg-white hover:border-teal-300 hover:bg-teal-50/20'
                      }`}
                    >
                      <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center shrink-0">
                        <Syringe className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-[13px] sm:text-[13.5px] font-semibold truncate ${
                              isSelected ? 'text-[#0f766e]' : 'text-slate-900'
                            }`}
                          >
                            {proc.nome}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            Avulso
                          </span>
                          {proc.retornosCount > 0 && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              {proc.retornosCount === 1
                                ? '1 retorno'
                                : `${proc.retornosCount} retornos`}
                            </span>
                          )}
                        </div>
                        <p className="text-[12px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 shrink-0" />
                          <span>Realizado em {formatProcedimentoRaizData(proc.data, fuso)}</span>
                        </p>
                      </div>

                      {itemLocked ? (
                        <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                          Plano selecionado
                        </span>
                      ) : (
                        <div
                          className={`w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 transition-all ${
                            isSelected
                              ? 'border-[#00a88e] bg-[#00a88e] text-white'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )
          )}
        </div>

        {/* Rodapé */}
        <div className="p-4 sm:p-5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2.5 shrink-0 bg-white">
          {selectedCount > 0 ? (
            <span className="text-[12px] font-semibold text-teal-800 bg-teal-50 px-3 py-1.5 rounded-lg border border-teal-200">
              {selectedCount === 1 ? '1 procedimento selecionado' : `${selectedCount} procedimentos selecionados`}
            </span>
          ) : (
            <span className="text-[12px] text-ink-400">
              Nenhum procedimento selecionado
            </span>
          )}
          <div className="flex items-center gap-2.5 ml-auto">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-xl border border-app-border px-5 py-2.5 text-[13px] sm:text-[14px] font-semibold text-[#64748b] hover:bg-app-nav-hover transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={loading || selectedCount === 0}
              className="rounded-xl bg-[#00a88e] px-6 py-2.5 text-[13px] sm:text-[14px] font-semibold text-white shadow-sm hover:bg-[#00967f] disabled:opacity-50 transition-all"
            >
              Iniciar Retorno{selectedCount > 1 ? ` (${selectedCount})` : ''}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
