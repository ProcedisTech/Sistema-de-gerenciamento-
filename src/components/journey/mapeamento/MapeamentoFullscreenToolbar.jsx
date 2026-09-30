import React, { useCallback, useRef, useState, useMemo } from 'react';
import {
  Minimize2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ImageOff,
  MousePointer2,
  MoveDiagonal,
  Eraser,
  Eye,
  EyeOff,
  Undo2,
  FileText,
  Settings2,
  Palette,
  Search,
  X,
  Loader2,
  Plus,
  Minus,
  Check,
  ClipboardList,
} from 'lucide-react';
import { getVistaLabel } from '../../../constants/vistasMapeamento.js';
import { useMediaQuery } from '../../../hooks/useMediaQuery.js';
import { useCatalogoMapeamentoOptions } from '../../../hooks/useCatalogoMapeamentoOptions.js';
import { MapeamentoFullscreenConfigPopover } from './MapeamentoFullscreenConfigPopover.jsx';
import {
  persistSidebarCollapsed,
  readStoredSidebarCollapsed,
} from './mapeamentoFullscreenSidebarStorage.js';
import { MAPEAMENTO_PALETA_CORES, corParaProcedimento } from '../../../constants/mapeamentoPaletaCores.js';
import { getPresetsForUnidade, getPassoFallback } from '../../../constants/quantidadePresets.js';

const DEFAULT_TOOLBAR_WIDTH_PX = 240;
const COLLAPSED_WIDTH_PX = 48;

const FERRAMENTAS = [
  { id: 'ponto', label: 'Ponto', shortcut: 'P', Icon: MousePointer2 },
  { id: 'traco', label: 'Traço', shortcut: 'T', Icon: MoveDiagonal },
  { id: 'borracha', label: 'Borracha', shortcut: 'B', Icon: Eraser },
];

function stopBubble(e) {
  e.stopPropagation();
}


function ConfigFields({
  modo,
  configMarcacao,
  setConfigMarcacao,
  unidadeMedida,
  tamanho,
  setTamanho,
  compact = false,
}) {
  if (modo === 'mover') {
    return (
      <p className="text-[11px] leading-snug text-slate-500">
        Arraste a foto para reposicionar. Use o scroll ou pinch para zoom.
      </p>
    );
  }
  if (modo === 'borracha') {
    return (
      <p className="text-[11px] leading-snug text-slate-500">
        Clique em um ponto ou traço para apagá-lo.
      </p>
    );
  }

  const showDose = modo === 'ponto' && configMarcacao && setConfigMarcacao;
  const showTamanho = (modo === 'ponto' || modo === 'traco') && typeof setTamanho === 'function';

  return (
    <div className={`flex flex-col ${compact ? 'gap-2' : 'gap-2.5'}`}>
      {modo === 'traco' ? (
        <p className="text-[11px] leading-snug text-slate-500">
          A espessura da linha é fixa; o tamanho controla o ponto nas extremidades.
        </p>
      ) : null}

      {showDose ? (
        <>
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold text-slate-600">Dose padrão</span>
            <div className="relative">
              <input
                type="number"
                min="0.1"
                step={unidadeMedida && String(unidadeMedida).toLowerCase() === 'ml' ? '0.1' : '1'}
                value={configMarcacao.dosePadrao}
                onChange={(e) =>
                  setConfigMarcacao({ ...configMarcacao, dosePadrao: Number(e.target.value) || 0 })
                }
                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[13px] font-medium text-slate-700 shadow-sm outline-none focus:border-app-accent focus:ring-1 focus:ring-app-accent"
              />
              {unidadeMedida ? (
                <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[12px] font-medium uppercase text-slate-400">
                  {unidadeMedida}
                </span>
              ) : null}
            </div>
          </label>

          <label className="block">
            <span className="mb-1 flex items-center justify-between text-[11px] font-semibold text-slate-600">
              Profundidade <span className="text-[10px] font-medium text-slate-400">(Opcional)</span>
            </span>
            <div className="relative">
              <input
                type="number"
                min="0.1"
                step="0.1"
                value={configMarcacao.profundidade}
                onChange={(e) => setConfigMarcacao({ ...configMarcacao, profundidade: e.target.value })}
                placeholder="Ex: 2.0"
                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[13px] font-medium text-slate-700 shadow-sm outline-none focus:border-app-accent focus:ring-1 focus:ring-app-accent"
              />
              <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[12px] font-medium text-slate-400">
                mm
              </span>
            </div>
          </label>

          <label className="mt-1 flex cursor-pointer flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-semibold text-slate-700">Confirmar a cada clique</span>
              <button
                type="button"
                role="switch"
                aria-checked={configMarcacao.confirmarDose}
                aria-label="Confirmar a cada clique"
                onClick={() =>
                  setConfigMarcacao({
                    ...configMarcacao,
                    confirmarDose: !configMarcacao.confirmarDose,
                  })
                }
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${configMarcacao.confirmarDose ? 'bg-app-accent' : 'bg-slate-300'
                  }`}
              >
                <span
                  className="pointer-events-none inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition"
                  style={{ transform: `translateX(${configMarcacao.confirmarDose ? '18px' : '3px'})` }}
                />
              </button>
            </div>
            {!configMarcacao.confirmarDose ? (
              <span className="w-fit rounded bg-emerald-50/80 px-1.5 py-1 text-[11px] font-bold text-emerald-600">
                Fricção Zero
              </span>
            ) : (
              <span className="text-[10px] leading-tight text-slate-500">
                Abre popup pedindo a dose a cada marcação na foto.
              </span>
            )}
          </label>
        </>
      ) : null}

      {showTamanho ? (
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold text-slate-600">Tamanho do marcador</span>
          <input
            type="range"
            min="0.5"
            max="1.5"
            step="0.1"
            value={tamanho ?? 1.0}
            onChange={(e) => setTamanho?.(Number(e.target.value))}
            className="w-full accent-app-accent"
            aria-label="Tamanho do marcador"
          />
        </label>
      ) : null}
    </div>
  );
}

export function MapeamentoFullscreenToolbar({
  vistaAtual,
  titulo,
  toolbarWidthPx = DEFAULT_TOOLBAR_WIDTH_PX,
  procedimentoArmado,
  panelOpen: _panelOpen,
  onToggleProcedimentoPanel: _onToggleProcedimentoPanel,
  procedimentos = [],
  procedimentosDoPlano = [],
  activeProcedimentoId,
  onSelectProcedimento,
  onAdicionarProcedimento,
  onArmar,
  onRemoverProcedimento,
  onMudarCorProcedimento,
  corLivre,
  onMudarCorLivre,
  getProcedimentoStats,
  countPontosVista = 0,
  onClose,
  configMarcacao,
  setConfigMarcacao,
  unidadeMedida,
  onClearVista,
  onRemoverFotoVista: _onRemoverFotoVista,
  hasFoto: _hasFoto = false,
  hideProcedimentoPicker,
  isMobileDrawer = false,
  drawerOpen = false,
  onCloseDrawer,
  modo: _modo = 'ponto',
  setModo: _setModo,
  tamanho,
  setTamanho,
  mostrarValores = false,
  onToggleMostrarValores,
  onDesfazerUltimo,
  onOpenResumo: _onOpenResumo,
  onSaveAction,
  tituloAcaoPrimaria,
  isSaving = false,
  configPopoverOpen: _configPopoverOpen = false,
  onConfigPopoverOpenChange: _onConfigPopoverOpenChange,
}) {
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => readStoredSidebarCollapsed());
  const [colorPickerProcId, setColorPickerProcId] = useState(null);
  const [collapsedPaletteOpen, setCollapsedPaletteOpen] = useState(false);
  const isMdUp = useMediaQuery('(min-width: 768px)');

  const { options: catalogoOptions = [], loading: catalogoLoading } = useCatalogoMapeamentoOptions({
    enabled: !hideProcedimentoPicker,
  });
  const [catalogSearchQuery, setCatalogSearchQuery] = useState('');
  const [catalogDropdownOpen, setCatalogDropdownOpen] = useState(false);
  const searchContainerRef = useRef(null);

  const filteredCatalogOptions = useMemo(() => {
    if (!catalogSearchQuery.trim()) return catalogoOptions.slice(0, 20);
    const q = catalogSearchQuery.toLowerCase().trim();
    return catalogoOptions.filter((opt) => opt.nome.toLowerCase().includes(q)).slice(0, 30);
  }, [catalogoOptions, catalogSearchQuery]);

  const handleSelectCatalogItem = (opt) => {
    setCatalogSearchQuery('');
    setCatalogDropdownOpen(false);
    if (typeof onAdicionarProcedimento === 'function') {
      onAdicionarProcedimento(opt);
    } else if (typeof onArmar === 'function') {
      onArmar(opt);
    }
  };

  const showAsDrawer = !isMdUp || isMobileDrawer;

  const setCollapsedPersisted = useCallback((next) => {
    setIsCollapsed(next);
    persistSidebarCollapsed(next);
  }, []);

  if (showAsDrawer && !drawerOpen) return null;

  const collapsed = !showAsDrawer && isCollapsed;
  const currentWidth = collapsed ? COLLAPSED_WIDTH_PX : toolbarWidthPx;
  const widthStyle = showAsDrawer
    ? { width: toolbarWidthPx }
    : { width: currentWidth, minWidth: currentWidth };

  const closeConfirms = () => {
    setShowClearConfirm(false);
    setCollapsedPaletteOpen(false);
  };

  const activeProc =
    procedimentoArmado ||
    procedimentos.find((p) => p.id === activeProcedimentoId) ||
    procedimentos[0] ||
    null;

  const activeCor =
    activeProc?.corHex ||
    (activeProc?.id ? corParaProcedimento(activeProc.id) : null) ||
    corLivre ||
    '#0d9488';


  return (
    <>
      {showAsDrawer ? (
        <div className="fixed inset-0 z-[140] bg-black/40" onClick={onCloseDrawer} aria-hidden />
      ) : null}
      <aside
        style={widthStyle}
        className={`flex h-full flex-col overflow-y-auto overflow-x-hidden border-r border-app-border bg-white shadow-app-sidebar transition-all duration-300 ${showAsDrawer ? 'fixed left-0 top-0 bottom-0 z-[150]' : 'relative shrink-0 z-10'
          }`}
        onPointerDown={stopBubble}
        onClick={stopBubble}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between border-b border-app-border ${collapsed ? 'flex-col gap-2 px-0.5 py-2' : 'px-3 py-3'
            }`}
        >
          {collapsed ? (
            <button
              type="button"
              aria-label="Expandir sidebar"
              title="Expandir sidebar"
              onClick={() => setCollapsedPersisted(false)}
              className="mx-auto rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[#94a3b8]">
                  Mapeamento Clínico
                </p>
                <h3 className="mt-0.5 line-clamp-2 text-[14px] font-bold leading-snug text-app-accent-deep">
                  {titulo || (vistaAtual ? getVistaLabel(vistaAtual) : 'Vista')}
                </h3>
              </div>
              {!showAsDrawer ? (
                <button
                  type="button"
                  aria-label="Recolher sidebar"
                  title="Recolher sidebar"
                  onClick={() => setCollapsedPersisted(true)}
                  className="shrink-0 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              ) : null}
            </>
          )}
        </div>

        <div className={`flex flex-1 flex-col gap-2.5 py-2.5 ${collapsed ? 'items-center px-0.5' : 'px-2.5'}`}>
          {/* BUSCA DE PROCEDIMENTOS (INLINE NO TOPO) */}
          {!hideProcedimentoPicker ? (
            collapsed ? (
              <button
                type="button"
                title="Buscar procedimentos (expandir lateral)"
                onClick={() => setCollapsedPersisted(false)}
                className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-emerald-700 transition-colors"
              >
                <Search className="h-4 w-4" />
              </button>
            ) : (
              <div className="relative mx-0.5" ref={searchContainerRef}>
                <div className="flex items-center justify-between px-0.5 mb-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Adicionar Procedimento
                  </span>
                  <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700 uppercase tracking-wider">
                    Busca Direta
                  </span>
                </div>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar procedimento no catálogo..."
                    value={catalogSearchQuery}
                    onChange={(e) => {
                      setCatalogSearchQuery(e.target.value);
                      setCatalogDropdownOpen(true);
                    }}
                    onFocus={() => setCatalogDropdownOpen(true)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/90 pl-8 pr-7 py-2 text-[12px] font-medium text-slate-700 placeholder-slate-400 outline-none focus:border-emerald-500 focus:bg-white focus:ring-1 focus:ring-emerald-500 transition-all shadow-2xs"
                  />
                  {catalogSearchQuery ? (
                    <button
                      type="button"
                      onClick={() => {
                        setCatalogSearchQuery('');
                        setCatalogDropdownOpen(false);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  ) : null}
                </div>

                {/* Dropdown Ancorado da Busca */}
                {catalogDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-[55]"
                      onClick={() => setCatalogDropdownOpen(false)}
                    />
                    <div className="absolute left-0 right-0 top-full mt-1.5 z-[60] max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-100">
                      {catalogoLoading ? (
                        <div className="flex items-center justify-center py-4 text-slate-400">
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                      ) : filteredCatalogOptions.length === 0 ? (
                        <p className="py-3 text-center text-[11px] text-slate-400">
                          Nenhum procedimento encontrado
                        </p>
                      ) : (
                        filteredCatalogOptions.map((opt) => {
                          const jaAdicionado = procedimentos.some((p) => p.id === opt.id);
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => handleSelectCatalogItem(opt)}
                              className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12px] hover:bg-emerald-50/80 transition-colors group cursor-pointer"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold text-slate-700 group-hover:text-emerald-800 truncate">
                                  {opt.nome}
                                </p>
                                <p className="text-[10px] text-slate-400 font-medium">
                                  {opt.unidadeMedida || 'un'}
                                </p>
                              </div>
                              {jaAdicionado ? (
                                <span className="text-[10px] font-bold text-emerald-600 shrink-0">
                                  Adicionado
                                </span>
                              ) : (
                                <Plus className="h-3.5 w-3.5 text-slate-400 group-hover:text-emerald-600 shrink-0" />
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </>
                )}
              </div>
            )
          ) : null}

          {/* BANDEJA DE CHIPS RÁPIDOS DO PLANO DE TRATAMENTO ATIVO */}
          {!collapsed && Array.isArray(procedimentosDoPlano) && procedimentosDoPlano.length > 0 && (
            <div className="rounded-xl border border-teal-200/80 bg-gradient-to-br from-teal-50/70 to-cyan-50/50 p-2.5 shadow-2xs">
              <div className="mb-2 flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <ClipboardList className="h-3.5 w-3.5 text-teal-600 shrink-0" />
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-teal-800 truncate">
                    Plano do Paciente
                  </span>
                </div>
                <span className="shrink-0 rounded-full border border-teal-200/90 bg-teal-100/90 px-2 py-0.5 text-[10px] font-bold text-teal-800 shadow-2xs whitespace-nowrap">
                  {procedimentosDoPlano.length} no plano
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {procedimentosDoPlano.map((procPlano) => {
                  const procAdicionado = procedimentos.find((p) => p.id === procPlano.id);
                  const jaAdicionado = Boolean(procAdicionado);
                  const isFocado = jaAdicionado && activeProcedimentoId === procPlano.id;
                  const cor = procAdicionado?.corHex || corParaProcedimento(procPlano.id);
                  const nomeExibicao =
                    procPlano.nome ||
                    catalogoOptions.find((o) => o.id === procPlano.id)?.nome ||
                    'Procedimento';

                  return (
                    <button
                      key={procPlano.id}
                      type="button"
                      onClick={() => {
                        if (!jaAdicionado) {
                          onAdicionarProcedimento?.(procPlano);
                        } else {
                          onSelectProcedimento?.(procAdicionado || procPlano);
                        }
                      }}
                      title={
                        jaAdicionado
                          ? `${nomeExibicao} já adicionado ao mapa (clique para focar o pincel)`
                          : `Adicionar ${nomeExibicao} ao mapa e armar pincel`
                      }
                      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all cursor-pointer ${
                        jaAdicionado
                          ? isFocado
                            ? 'border border-emerald-500 bg-emerald-50 text-emerald-800 shadow-2xs ring-1 ring-emerald-500/40'
                            : 'border border-slate-300 bg-slate-50 text-slate-700 shadow-2xs hover:bg-slate-100 hover:border-slate-400'
                          : 'border border-teal-200 bg-white text-teal-800 shadow-2xs hover:bg-teal-50 hover:border-teal-400 hover:shadow-xs'
                      }`}
                    >
                      {jaAdicionado ? (
                        <>
                          <span
                            className="h-2 w-2 rounded-full shrink-0"
                            style={{ backgroundColor: cor }}
                          />
                          <Check className="h-3 w-3 text-emerald-600 shrink-0" />
                          <span className="truncate max-w-[150px]">{nomeExibicao}</span>
                        </>
                      ) : (
                        <>
                          <Plus className="h-3 w-3 text-teal-600 font-extrabold shrink-0" />
                          <span className="truncate max-w-[150px]">{nomeExibicao}</span>
                        </>
                      )}
                      {procPlano.isRetorno && (
                        <span className="rounded bg-amber-100 px-1 py-0.5 text-[9px] font-black uppercase text-amber-800 tracking-wider">
                          Retorno
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* PROCEDIMENTOS ATIVOS */}
          {!collapsed && (
            <div className="flex items-center justify-between px-0.5 mt-1 mb-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Procedimentos Ativos
              </span>
              <span className="text-[10px] font-bold text-slate-400">
                {procedimentos.length} no mapa
              </span>
            </div>
          )}

          {/* LISTA DE PROCEDIMENTOS DO MAPA (MULT-PROCEDIMENTO / AVALIAÇÃO) */}
          {Array.isArray(procedimentos) && procedimentos.length > 0 ? (
            collapsed ? (
              <div className="flex flex-col items-center gap-1.5 py-1">
                {procedimentos.map((proc) => {
                  const isSelected = activeProcedimentoId === proc.id;
                  const cor = proc.corHex || corParaProcedimento(proc.id);
                  return (
                    <button
                      key={proc.id}
                      type="button"
                      title={`${proc.nome} (${isSelected ? 'Ativo' : 'Clique para ativar'})`}
                      onClick={() => onSelectProcedimento?.(proc)}
                      className={`relative h-6 w-6 rounded-full border transition-transform hover:scale-110 ${isSelected ? 'ring-2 ring-app-accent ring-offset-1 scale-105' : 'border-black/20'
                        }`}
                      style={{ backgroundColor: cor }}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col gap-1.5 px-0.5">
                {procedimentos.map((proc) => {
                  const isSelected = activeProcedimentoId === proc.id;
                  const stats = getProcedimentoStats ? getProcedimentoStats(proc.id) : { pontosCount: 0, doseTotal: 0 };
                  const cor = proc.corHex || corParaProcedimento(proc.id);
                  const isColorPickerOpen = colorPickerProcId === proc.id;
                  const procUnidade = proc.unidadeMedida || unidadeMedida || 'un';

                  return (
                    <div
                      key={proc.id}
                      onClick={() => onSelectProcedimento?.(proc)}
                      className={`group relative flex flex-col gap-1 rounded-xl border p-2 text-left transition-all cursor-pointer ${isSelected
                          ? 'border-emerald-500/70 bg-emerald-50/70 shadow-2xs'
                          : 'border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50'
                        }`}
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {/* Seletor de cor popover */}
                          <div className="relative shrink-0">
                            <button
                              type="button"
                              aria-label={`Mudar cor de ${proc.nome}`}
                              title="Mudar cor do procedimento"
                              onClick={(e) => {
                                e.stopPropagation();
                                setColorPickerProcId(isColorPickerOpen ? null : proc.id);
                              }}
                              className="h-4 w-4 rounded-full border border-black/15 shadow-2xs hover:scale-115 transition-transform"
                              style={{ backgroundColor: cor }}
                            />

                            {isColorPickerOpen ? (
                              <>
                                <div
                                  className="fixed inset-0 z-[60]"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setColorPickerProcId(null);
                                  }}
                                />
                                <div
                                  className="absolute left-6 -top-2 z-[70] w-48 rounded-xl border border-slate-200 bg-white p-2.5 shadow-2xl animate-in fade-in zoom-in-95 duration-100"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                    Cor do Procedimento
                                  </p>
                                  <div className="grid grid-cols-6 gap-1.5">
                                    {MAPEAMENTO_PALETA_CORES.map((c) => {
                                      const procOwner = procedimentos.find(
                                        (p) =>
                                          p.id !== proc.id &&
                                          (p.corHex || corParaProcedimento(p.id)).toLowerCase() === c.toLowerCase()
                                      );
                                      const isEmUsoOutro = Boolean(procOwner);
                                      const isAtual = cor.toLowerCase() === c.toLowerCase();

                                      return (
                                        <button
                                          key={c}
                                          type="button"
                                          aria-label={
                                            isEmUsoOutro
                                              ? `Cor em uso por ${procOwner.nome} (clique para trocar)`
                                              : `Selecionar cor`
                                          }
                                          title={
                                            isEmUsoOutro
                                              ? `Em uso por: ${procOwner.nome} (clique para trocar)`
                                              : `Selecionar cor`
                                          }
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onMudarCorProcedimento?.(proc.id, c);
                                            setColorPickerProcId(null);
                                          }}
                                          className={`relative flex h-5 w-5 items-center justify-center rounded-full border transition-transform hover:scale-120 cursor-pointer ${isAtual ? 'ring-2 ring-slate-800 ring-offset-1' : 'border-black/10'
                                            }`}
                                          style={{ backgroundColor: c }}
                                        >
                                          {isEmUsoOutro ? (
                                            <span className="h-1 w-1 rounded-full bg-white shadow-2xs" />
                                          ) : null}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              </>
                            ) : null}
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className={`truncate text-[12px] font-bold leading-tight ${isSelected ? 'text-app-accent-deep' : 'text-slate-700'}`}>
                              {proc.nome}
                            </p>
                            <p className="mt-0.5 text-[10px] text-slate-500 font-medium">
                              {stats.pontosCount} {stats.pontosCount === 1 ? 'pto' : 'ptos'}
                              {stats.doseTotal > 0 ? ` · ${stats.doseTotal} ${procUnidade}` : ''}
                            </p>
                          </div>
                        </div>

                        {typeof onRemoverProcedimento === 'function' ? (
                          <button
                            type="button"
                            aria-label={`Remover ${proc.nome}`}
                            title="Remover procedimento"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRemoverProcedimento(proc.id);
                            }}
                            className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                      </div>

                      {/* Ajuste de Dose Direto no Card (Modelo B) */}
                      {isSelected && !collapsed && (
                        <div
                          className="mt-1 pt-1.5 border-t border-slate-200/80 flex flex-col gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                              Dose do Próximo Ponto
                            </span>
                            <span className="text-[10px] font-bold text-emerald-700 uppercase">
                              {procUnidade}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              title="Diminuir dose"
                              onClick={() => {
                                const passoAtual = getPassoFallback(procUnidade, undefined);
                                const novaDose = Math.max(
                                  passoAtual,
                                  Number(((configMarcacao?.dosePadrao || 1) - passoAtual).toFixed(2))
                                );
                                setConfigMarcacao?.((prev) => ({ ...prev, dosePadrao: novaDose }));
                              }}
                              className="flex h-6 w-6 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 hover:border-slate-300 shadow-2xs active:scale-95 transition-all cursor-pointer"
                            >
                              <Minus className="h-3 w-3" />
                            </button>

                            <div className="flex-1 text-center py-0.5 rounded-lg border border-slate-200 bg-slate-50 font-bold text-[12px] text-slate-800 shadow-inner">
                              {configMarcacao?.dosePadrao || 1}
                            </div>

                            <button
                              type="button"
                              title="Aumentar dose"
                              onClick={() => {
                                const passoAtual = getPassoFallback(procUnidade, undefined);
                                const novaDose = Number(
                                  ((configMarcacao?.dosePadrao || 1) + passoAtual).toFixed(2)
                                );
                                setConfigMarcacao?.((prev) => ({ ...prev, dosePadrao: novaDose }));
                              }}
                              className="flex h-6 w-6 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 hover:border-slate-300 shadow-2xs active:scale-95 transition-all cursor-pointer"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>

                          {/* Chips de Dose Rápida */}
                          <div className="flex items-center gap-1 pt-0.5">
                            {getPresetsForUnidade(procUnidade).map((val) => {
                              const isDoseAtiva = Number(configMarcacao?.dosePadrao) === Number(val);
                              return (
                                <button
                                  key={val}
                                  type="button"
                                  onClick={() =>
                                    setConfigMarcacao?.((prev) => ({ ...prev, dosePadrao: val }))
                                  }
                                  className={`flex-1 py-0.5 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                                    isDoseAtiva
                                      ? 'bg-emerald-600 text-white shadow-2xs'
                                      : 'bg-white border border-slate-200/90 text-slate-600 hover:bg-slate-100'
                                  }`}
                                >
                                  {val}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            !collapsed ? (
              <div className="mx-0.5 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-3 text-center">
                <p className="text-[11px] font-semibold text-slate-600">
                  Nenhum procedimento no mapa
                </p>
                <p className="mt-0.5 text-[10px] text-slate-400">
                  Busque no catálogo acima ou escolha uma cor abaixo para anotação livre.
                </p>
              </div>
            ) : null
          )}

          {/* PALETA DE CORES (Só exibe se não houver procedimentos cadastrados) */}
          {(!procedimentos || procedimentos.length === 0) ? (
            !collapsed ? (
            <div className="mx-0.5 rounded-xl border border-slate-200/90 bg-slate-50/70 p-2.5 text-left shadow-2xs">
              <div className="mb-2 flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Palette className="h-3.5 w-3.5 text-slate-500 shrink-0" strokeWidth={2} />
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600 truncate">
                    Cor da Marcação
                  </p>
                </div>
                {activeProc ? (
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-slate-700 bg-white border border-slate-200 shadow-2xs truncate max-w-[125px]"
                    title={`Procedimento ativo: ${activeProc.nome}`}
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: activeCor }}
                    />
                    <span className="truncate">{activeProc.nome}</span>
                  </span>
                ) : (
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium text-slate-600 bg-white border border-slate-200 shadow-2xs"
                    title="Anotação Livre"
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: activeCor }}
                    />
                    <span>Livre</span>
                  </span>
                )}
              </div>

              <div className="grid grid-cols-6 gap-1.5">
                {MAPEAMENTO_PALETA_CORES.map((c) => {
                  const procOwner = procedimentos.find(
                    (p) => (p.corHex || corParaProcedimento(p.id)).toLowerCase() === c.toLowerCase()
                  );
                  const isEmUso = Boolean(procOwner);
                  const isAtiva = activeCor.toLowerCase() === c.toLowerCase();
                  const isEmUsoOutro = isEmUso && procOwner?.id !== activeProc?.id;
                  const tooltipText = isEmUsoOutro
                    ? `Cor em uso por "${procOwner.nome}" (clique para definir em "${activeProc.nome}" e trocar)`
                    : isEmUso
                      ? `Cor atual de "${procOwner.nome}"`
                      : activeProc
                        ? `Definir esta cor para "${activeProc.nome}"`
                        : `Selecionar esta cor para anotação livre`;

                  return (
                    <button
                      key={c}
                      type="button"
                      aria-label={tooltipText}
                      title={tooltipText}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (activeProc) {
                          onMudarCorProcedimento?.(activeProc.id, c);
                        } else if (procOwner) {
                          onSelectProcedimento?.(procOwner);
                        } else {
                          onMudarCorLivre?.(c);
                        }
                      }}
                      className={`group relative flex h-6 w-6 items-center justify-center rounded-full transition-all hover:scale-115 active:scale-95 cursor-pointer ${isAtiva
                          ? 'ring-2 ring-emerald-500 ring-offset-2 scale-110 shadow-sm'
                          : 'border border-black/15 hover:border-black/30'
                        }`}
                      style={{ backgroundColor: c }}
                    >
                      {/* Indicador de cor em uso */}
                      {isEmUso ? (
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${isAtiva ? 'bg-white shadow-2xs' : 'bg-white/90 shadow-2xs'
                            }`}
                          aria-hidden="true"
                        />
                      ) : null}
                    </button>
                  );
                })}
              </div>

              <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400 font-medium">
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400 inline-block" />
                  <span>= em uso</span>
                </span>
                <span>{activeProc ? '1 clique p/ alternar' : 'Cor livre'}</span>
              </div>
            </div>
          ) : (
            /* Modo collapsed: botão compacto da cor com popover flutuante */
            <div className="relative flex flex-col items-center">
              <button
                type="button"
                aria-label={`Paleta de cores. Cor ativa: ${activeCor}`}
                title={`Paleta de cores (${activeProc ? activeProc.nome : 'Anotação'})`}
                onClick={(e) => {
                  e.stopPropagation();
                  setCollapsedPaletteOpen((prev) => !prev);
                }}
                className="relative flex h-10 w-10 items-center justify-center rounded-lg text-[#64748b] hover:bg-slate-100 hover:text-app-accent-deep cursor-pointer"
              >
                <span
                  className="h-5 w-5 rounded-full border-2 border-white shadow-sm ring-1 ring-slate-300"
                  style={{ backgroundColor: activeCor }}
                />
              </button>

              {collapsedPaletteOpen ? (
                <>
                  <div
                    className="fixed inset-0 z-[60]"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCollapsedPaletteOpen(false);
                    }}
                  />
                  <div
                    className="absolute left-12 top-0 z-[70] w-52 rounded-xl border border-slate-200 bg-white p-3 shadow-2xl animate-in fade-in zoom-in-95 duration-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Cor da Marcação
                    </p>
                    <div className="grid grid-cols-6 gap-1.5">
                      {MAPEAMENTO_PALETA_CORES.map((c) => {
                        const procOwner = procedimentos.find(
                          (p) => (p.corHex || corParaProcedimento(p.id)).toLowerCase() === c.toLowerCase()
                        );
                        const isEmUso = Boolean(procOwner);
                        const isAtiva = activeCor.toLowerCase() === c.toLowerCase();
                        const tooltipText = isEmUso
                          ? `Em uso por: ${procOwner.nome}`
                          : `Cor livre`;

                        return (
                          <button
                            key={c}
                            type="button"
                            title={tooltipText}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (activeProc) {
                                onMudarCorProcedimento?.(activeProc.id, c);
                              } else if (procOwner) {
                                onSelectProcedimento?.(procOwner);
                              } else {
                                onMudarCorLivre?.(c);
                              }
                              setCollapsedPaletteOpen(false);
                            }}
                            className={`flex h-5 w-5 items-center justify-center rounded-full border transition-transform hover:scale-120 cursor-pointer ${isAtiva ? 'ring-2 ring-emerald-500 ring-offset-1 scale-105' : 'border-black/10'
                              }`}
                            style={{ backgroundColor: c }}
                          >
                            {isEmUso ? (
                              <span className="h-1 w-1 rounded-full bg-white shadow-2xs" />
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          )
        ) : null}

          {/* EXIBIÇÃO CLÍNICA */}
          {!collapsed ? (
            <div className="mx-0.5 rounded-xl border border-slate-200/90 bg-white p-3 shadow-2xs">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Eye className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                    Exibição Clínica
                  </span>
                </div>
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-500 uppercase">
                  No Rosto
                </span>
              </div>

              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  role="switch"
                  aria-checked={mostrarValores}
                  aria-label="Mostrar doses"
                  onClick={() => onToggleMostrarValores?.()}
                  className="flex w-full items-center justify-between gap-2 text-left cursor-pointer"
                >
                  <span className="text-[12px] font-semibold text-slate-700">Mostrar doses</span>
                  <span
                    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                      mostrarValores ? 'bg-app-accent' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className="pointer-events-none inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition"
                      style={{ transform: `translateX(${mostrarValores ? '18px' : '3px'})` }}
                    />
                  </span>
                </button>

                <div className="pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 mb-1">
                    <span>Tamanho do marcador</span>
                    <span className="font-mono text-[10px] text-slate-400">
                      {(tamanho ?? 1.0).toFixed(1)}x
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="1.5"
                    step="0.1"
                    value={tamanho ?? 1.0}
                    onChange={(e) => setTamanho?.(Number(e.target.value))}
                    className="w-full accent-teal-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-1">
              <button
                type="button"
                onClick={() => onToggleMostrarValores?.()}
                title={mostrarValores ? 'Ocultar doses' : 'Mostrar doses'}
                className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
              >
                {mostrarValores ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </button>
            </div>
          )}
        </div>

        {/* Rodapé e Ação Primária (Modelo B) */}
        <div className={`mt-auto border-t border-slate-200 bg-white ${collapsed ? 'flex flex-col items-center gap-1.5 p-1.5' : 'p-3 flex flex-col gap-2'}`}>
          {!collapsed ? (
            <button
              type="button"
              onClick={onSaveAction || onClose}
              disabled={isSaving}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-500 hover:bg-teal-400 py-2.5 px-3 text-xs font-bold text-slate-950 shadow-md shadow-teal-500/20 active:scale-98 disabled:opacity-50 transition-all cursor-pointer"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 stroke-[2.5]" />}
              <span>{tituloAcaoPrimaria || 'Concluir Avaliação'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onSaveAction || onClose}
              title={tituloAcaoPrimaria || 'Concluir'}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500 text-slate-950 shadow-sm"
            >
              <Check className="h-5 w-5 stroke-[2.5]" />
            </button>
          )}

          {!collapsed ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                aria-label="Desfazer (Ctrl+Z)"
                title="Desfazer (Ctrl+Z)"
                disabled={countPontosVista === 0}
                onClick={() => onDesfazerUltimo?.()}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white py-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-2xs"
              >
                <Undo2 className="h-3.5 w-3.5" />
                <span>Desfazer</span>
              </button>

              {typeof onClearVista === 'function' ? (
                showClearConfirm ? (
                  <div className="flex-1 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        onClearVista?.();
                        closeConfirms();
                      }}
                      className="flex-1 rounded border border-red-200 bg-red-50 py-1.5 text-[10px] font-bold text-red-600 hover:bg-red-100"
                    >
                      Sim
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowClearConfirm(false)}
                      className="flex-1 rounded border border-slate-200 bg-white py-1.5 text-[10px] font-bold text-slate-600"
                    >
                      Não
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    title="Limpar todas as marcações"
                    disabled={countPontosVista === 0}
                    onClick={() => setShowClearConfirm(true)}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white py-2 text-[11px] font-semibold text-slate-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-2xs"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Limpar</span>
                  </button>
                )
              ) : null}
            </div>
          ) : null}

          {/* Sair / Fechar */}
          <button
            type="button"
            onClick={(e) => {
              stopBubble(e);
              onClose?.();
            }}
            title="Sair (Esc)"
            className="flex items-center justify-center gap-2 py-1 text-[11px] font-medium text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <Minimize2 className="h-3.5 w-3.5" />
            {!collapsed ? <span>Fechar tela cheia</span> : null}
          </button>
        </div>
      </aside>
    </>
  );
}
