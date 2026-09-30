import React, { useCallback, useRef, useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Menu,
  Minimize2,
  MoveDiagonal,
  MousePointer2,
  Eraser,
  Eye,
  EyeOff,
  Undo2,
  ChevronDown,
  ChevronUp,
  Minus,
} from 'lucide-react';
import { FotoVistaCanvasCore } from './FotoVistaCanvas.jsx';
import { MapeamentoFullscreenToolbar } from './MapeamentoFullscreenToolbar.jsx';
import { PontosResumoPanel } from './PontosResumoPanel.jsx';
import { useMapeamentoFullscreenKeyboardShortcuts } from './useMapeamentoFullscreenKeyboardShortcuts.js';
import { useMediaQuery } from '../../../hooks/useMediaQuery.js';
import { getVistaLabel } from '../../../constants/vistasMapeamento.js';
import { MAPEAMENTO_PALETA_CORES, corParaProcedimento } from '../../../constants/mapeamentoPaletaCores.js';

export function MapeamentoFullscreenOverlay({
  open,
  toolbarWidthPx = 240,
  vistaAtual,
  foto,
  procedimentoArmado,
  onArmar,
  procedimentosUsados = [],
  pontosVista,
  gruposSessao,
  countPontosVista = 0,
  onAddPonto,
  onEditarPonto,
  onRemovePonto,
  onDesfazerUltimo,
  onClearVista,
  onClose,
  hideProcedimentoPicker = false,
  unidadeMedida,
  onUnidadeMedidaChange,
  presets,
  passo,
  onRemoverFotoVista,
}) {
  const [modo, setModo] = useState('ponto');
  const [tamanhoGlobalPonto, setTamanhoGlobalPonto] = useState(1.0);
  const [mostrarValores, setMostrarValores] = useState(true);
  const [resumoModalOpen, setResumoModalOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [configPopoverOpen, setConfigPopoverOpen] = useState(false);
  const [islandDockedBottom, setIslandDockedBottom] = useState(false);
  const [isIslandMinimized, setIsIslandMinimized] = useState(false);
  const [islandColorPickerOpen, setIslandColorPickerOpen] = useState(false);
  const [configMarcacao, setConfigMarcacao] = useState({
    dosePadrao: 1,
    profundidade: '',
    confirmarDose: false,
  });

  const transformWrapperRef = useRef(null);
  const isMdUp = useMediaQuery('(min-width: 768px)');

  // Gerenciamento local de múltiplos procedimentos
  const [activeProcedimentoId, setActiveProcedimentoId] = useState(
    () => procedimentoArmado?.id || procedimentosUsados[0]?.id || null
  );
  const [corLivre, setCorLivre] = useState('#0d9488');
  const [procedimentosLocais, setProcedimentosLocais] = useState(() => procedimentosUsados || []);

  useEffect(() => {
    if (Array.isArray(procedimentosUsados) && procedimentosUsados.length > 0) {
      setProcedimentosLocais(procedimentosUsados);
    }
  }, [procedimentosUsados]);

  const listaProcedimentos = useMemo(() => {
    if (procedimentosLocais.length > 0) return procedimentosLocais;
    if (procedimentoArmado) return [procedimentoArmado];
    return [];
  }, [procedimentosLocais, procedimentoArmado]);

  const activeProc = useMemo(() => {
    if (activeProcedimentoId) {
      const found = listaProcedimentos.find((p) => p.id === activeProcedimentoId);
      if (found) return found;
    }
    return procedimentoArmado || listaProcedimentos[0] || null;
  }, [listaProcedimentos, activeProcedimentoId, procedimentoArmado]);

  const activeCor =
    activeProc?.corHex || (activeProc?.id ? corParaProcedimento(activeProc.id) : null) || corLivre;
  const activeUnidade = activeProc?.unidadeMedida || unidadeMedida || 'un';

  const handleSelectProcedimento = (proc) => {
    setActiveProcedimentoId(proc.id);
    onArmar?.(proc);
  };

  const handleAdicionarProcedimento = (proc) => {
    setProcedimentosLocais((prev) => {
      if (prev.some((p) => p.id === proc.id)) return prev;
      return [...prev, proc];
    });
    setActiveProcedimentoId(proc.id);
    onArmar?.(proc);
  };

  const handleMudarCorProcedimento = (procId, novaCor) => {
    setProcedimentosLocais((prev) =>
      prev.map((p) => (p.id === procId ? { ...p, corHex: novaCor } : p))
    );
  };

  const getProcedimentoStats = useCallback(
    (procId) => {
      let pontosCount = 0;
      let doseTotal = 0;
      const pontos = Array.isArray(pontosVista) ? pontosVista : [];
      pontos.forEach((pt) => {
        if (String(pt.catalogoId || pt.procedimentoId || '') === String(procId)) {
          pontosCount++;
          doseTotal += Number(pt.quantidade || pt.dose || 0);
        }
      });
      return { pontosCount, doseTotal: Number(doseTotal.toFixed(2)) };
    },
    [pontosVista]
  );

  const handleResetView = useCallback(() => {
    if (transformWrapperRef.current?.resetTransform) {
      transformWrapperRef.current.resetTransform();
    }
  }, []);

  const handleEscape = useCallback(() => {
    if (configPopoverOpen) {
      setConfigPopoverOpen(false);
      return;
    }
    if (resumoModalOpen) {
      setResumoModalOpen(false);
      return;
    }
    onClose?.();
  }, [configPopoverOpen, resumoModalOpen, onClose]);

  useMapeamentoFullscreenKeyboardShortcuts({
    enabled: open,
    blocked: false,
    onSetModo: setModo,
    onDesfazer: onDesfazerUltimo,
    onResetZoom: handleResetView,
    onToggleDoses: () => setMostrarValores((v) => !v),
    onEscape: handleEscape,
  });

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[140] flex min-w-0 flex-row overflow-hidden bg-[#0b0f19] text-slate-800 select-none">
      <MapeamentoFullscreenToolbar
        vistaAtual={vistaAtual}
        toolbarWidthPx={toolbarWidthPx}
        procedimentoArmado={activeProc}
        procedimentos={listaProcedimentos}
        activeProcedimentoId={activeProc?.id}
        onSelectProcedimento={handleSelectProcedimento}
        onAdicionarProcedimento={handleAdicionarProcedimento}
        onArmar={onArmar}
        onMudarCorProcedimento={handleMudarCorProcedimento}
        corLivre={corLivre}
        onMudarCorLivre={setCorLivre}
        getProcedimentoStats={getProcedimentoStats}
        countPontosVista={countPontosVista}
        onClose={onClose}
        configMarcacao={configMarcacao}
        setConfigMarcacao={setConfigMarcacao}
        unidadeMedida={activeUnidade}
        onClearVista={onClearVista}
        onRemoverFotoVista={onRemoverFotoVista}
        hasFoto={Boolean(foto?.displayUrl)}
        hideProcedimentoPicker={hideProcedimentoPicker}
        drawerOpen={sidebarOpen}
        onCloseDrawer={() => setSidebarOpen(false)}
        modo={modo}
        setModo={setModo}
        tamanho={tamanhoGlobalPonto}
        setTamanho={setTamanhoGlobalPonto}
        mostrarValores={mostrarValores}
        onToggleMostrarValores={() => setMostrarValores((v) => !v)}
        onDesfazerUltimo={onDesfazerUltimo}
        onOpenResumo={() => setResumoModalOpen(true)}
        configPopoverOpen={configPopoverOpen}
        onConfigPopoverOpenChange={setConfigPopoverOpen}
        onSaveAction={onClose}
        tituloAcaoPrimaria="Concluir Mapeamento"
      />

      {/* ── ÁREA DA FOTO E ILHA FLUTUANTE DE FERRAMENTAS (Mesa de Luz Clínica Slate Profundo) ── */}
      <main className="relative flex min-h-0 min-w-0 flex-1 flex-col p-0 overflow-hidden bg-[#0b0f19]">
        {!isMdUp && !sidebarOpen ? (
          <button
            type="button"
            aria-label="Abrir menu de ferramentas"
            title="Abrir menu"
            onClick={() => setSidebarOpen(true)}
            className="absolute left-3 top-3.5 z-[50] flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-md hover:bg-slate-50 hover:text-emerald-700"
          >
            <Menu className="h-4 w-4" />
          </button>
        ) : null}

        {/* Barra Superior Discreta Flutuante — Branco Gelo Clínico */}
        <div className="absolute top-3.5 left-4 right-4 z-40 pointer-events-none flex items-center justify-between">
          <div className="pointer-events-auto flex items-center gap-2 rounded-xl bg-white/95 px-3 py-1.5 backdrop-blur-xl border border-slate-200/90 shadow-md text-slate-800">
            <span className="text-xs font-bold text-slate-800">
              {vistaAtual ? getVistaLabel(vistaAtual) : 'Mapeamento'}
            </span>
            {activeProc?.nome && (
              <span
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-bold border shadow-2xs"
                style={{
                  backgroundColor: `${activeCor}15`,
                  borderColor: `${activeCor}40`,
                  color: activeCor,
                }}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: activeCor }} />
                <span className="truncate max-w-[140px]">{activeProc.nome}</span>
              </span>
            )}
          </div>

          <div className="pointer-events-auto flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/95 hover:bg-slate-100 text-slate-700 text-xs font-bold shadow-md border border-slate-200/90 backdrop-blur-xl transition-all scale-100 active:scale-95 cursor-pointer"
            >
              <Minimize2 className="h-4 w-4" />
              <span>Concluir</span>
            </button>
          </div>
        </div>

        {/* ILHA FLUTUANTE DE FERRAMENTAS — BRANCO GELO CLÍNICO (z-[60] GARANTIDO) */}
        <div
          className={`absolute z-[60] pointer-events-auto transition-all duration-200 ${
            islandDockedBottom
              ? 'bottom-5 left-1/2 -translate-x-1/2'
              : 'top-3.5 left-1/2 -translate-x-1/2'
          }`}
        >
          {isIslandMinimized ? (
            <button
              type="button"
              onClick={() => setIsIslandMinimized(false)}
              className="flex items-center gap-2 rounded-2xl border border-slate-200/90 bg-white/95 px-3.5 py-2 shadow-xl backdrop-blur-xl text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer animate-in fade-in zoom-in-95 duration-100"
              title="Expandir barra de ferramentas flutuante"
            >
              <MoveDiagonal className="h-3.5 w-3.5 text-emerald-600" />
              <span>Ferramentas</span>
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                {modo}
              </span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 rounded-2xl border border-slate-200/90 bg-white/95 px-2.5 py-1.5 shadow-xl backdrop-blur-xl">
            {/* Tríade de Ferramentas */}
            <button
              type="button"
              onClick={() => setModo('traco')}
              title="Traço Contínuo (T)"
              className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                modo === 'traco'
                  ? 'border border-emerald-500/40 bg-emerald-50 text-emerald-700 shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <MoveDiagonal className="h-3.5 w-3.5" />
              <span>Traço</span>
            </button>

            <button
              type="button"
              onClick={() => setModo('ponto')}
              title="Ponto Direto (P)"
              className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                modo === 'ponto'
                  ? 'border border-emerald-500/40 bg-emerald-50 text-emerald-700 shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <MousePointer2 className="h-3.5 w-3.5" />
              <span>Ponto</span>
            </button>

            <button
              type="button"
              onClick={() => setModo('borracha')}
              title="Borracha (B)"
              className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                modo === 'borracha'
                  ? 'border border-red-500/40 bg-red-50 text-red-600 shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Eraser className="h-3.5 w-3.5" />
              <span>Borracha</span>
            </button>

            <div className="h-4 w-px bg-slate-200 mx-0.5" />

            {/* Alternar Doses (Olho) */}
            <button
              type="button"
              onClick={() => setMostrarValores((prev) => !prev)}
              title={mostrarValores ? 'Ocultar Doses (D)' : 'Mostrar Doses (D)'}
              className={`flex items-center gap-1 rounded-xl px-2 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                mostrarValores
                  ? 'text-emerald-700 bg-emerald-50/70 hover:bg-emerald-100/70'
                  : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'
              }`}
            >
              {mostrarValores ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline text-[11px] font-bold">Doses</span>
            </button>

            {/* Desfazer */}
            <button
              type="button"
              onClick={() => onDesfazerUltimo?.()}
              disabled={countPontosVista === 0}
              title="Desfazer (Ctrl+Z)"
              className="flex items-center gap-1 rounded-xl px-2 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-35 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              <Undo2 className="h-3.5 w-3.5" />
            </button>

            <div className="h-4 w-px bg-slate-200 mx-0.5" />

            {/* Chip de Cor Ativa com Popover Rápido */}
            <div className="relative">
              <button
                type="button"
                aria-label={`Cor ativa: ${activeCor}. Clique para mudar.`}
                title={`Cor ativa: ${activeCor}`}
                onClick={() => setIslandColorPickerOpen((prev) => !prev)}
                className="flex items-center gap-1 rounded-xl p-1.5 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <span
                  className="h-4 w-4 rounded-full border border-black/20 shadow-2xs"
                  style={{ backgroundColor: activeCor }}
                />
              </button>

              {islandColorPickerOpen && (
                <>
                  <div
                    className="fixed inset-0 z-[70]"
                    onClick={() => setIslandColorPickerOpen(false)}
                  />
                    <div
                      className={`absolute left-1/2 -translate-x-1/2 ${
                        islandDockedBottom ? 'bottom-full mb-2' : 'top-full mt-2'
                      } z-[80] w-52 rounded-xl border border-slate-200 bg-white p-2.5 shadow-2xl animate-in fade-in zoom-in-95 duration-100`}
                    >
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 text-center">
                        Trocar Cor Ativa
                      </p>
                      <div className="grid grid-cols-6 gap-1.5">
                        {MAPEAMENTO_PALETA_CORES.map((c) => {
                          const procOwner = listaProcedimentos.find(
                            (p) => (p.corHex || corParaProcedimento(p.id)).toLowerCase() === c.toLowerCase()
                          );
                          const isEmUso = Boolean(procOwner);
                          const isAtiva = activeCor.toLowerCase() === c.toLowerCase();
                          return (
                            <button
                              key={c}
                              type="button"
                              title={isEmUso ? `Em uso por: ${procOwner.nome}` : 'Cor livre'}
                              onClick={() => {
                                if (activeProc) {
                                  handleMudarCorProcedimento(activeProc.id, c);
                                } else {
                                  setCorLivre(c);
                                }
                                setIslandColorPickerOpen(false);
                              }}
                              className={`flex h-5 w-5 items-center justify-center rounded-full border transition-transform hover:scale-120 cursor-pointer ${
                                isAtiva ? 'ring-2 ring-emerald-500 ring-offset-1 scale-105' : 'border-black/10'
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
              )}
            </div>

            <div className="h-4 w-px bg-slate-200 mx-0.5" />

            {/* Botão Enquadrar na Tela */}
            <button
              type="button"
              onClick={handleResetView}
              title="Enquadrar na tela (0 ou R)"
              className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 transition-all cursor-pointer shadow-2xs"
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
              </svg>
              <span>Enquadrar</span>
            </button>

            <div className="h-4 w-px bg-slate-200 mx-0.5" />

            {/* Alternar Posição (Dock Inferior / Superior) */}
            <button
              type="button"
              onClick={() => setIslandDockedBottom((prev) => !prev)}
              title={islandDockedBottom ? 'Mover barra para o Topo' : 'Mover barra para a Base (Dock)'}
              className="flex items-center gap-1 rounded-xl px-2 py-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 text-[11px] font-semibold transition-colors cursor-pointer"
            >
              {islandDockedBottom ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              <span>{islandDockedBottom ? 'Topo' : 'Dock'}</span>
            </button>

            {/* Minimizar Ilha */}
            <button
              type="button"
              onClick={() => setIsIslandMinimized(true)}
              title="Minimizar barra de ferramentas"
              className="p-1 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

        {/* Canvas da Foto Nativo */}
        <FotoVistaCanvasCore
          transformWrapperRef={transformWrapperRef}
          vistaAtual={vistaAtual}
          foto={foto}
          procedimentoArmado={activeProc}
          pontosVista={pontosVista}
          onAddPonto={onAddPonto}
          onEditarPonto={onEditarPonto}
          onRemovePonto={onRemovePonto}
          tamanhoGlobalPonto={tamanhoGlobalPonto}
          modo={modo}
          setModo={setModo}
          showToolbar={false}
          fillViewport
          className="h-full min-h-0 w-full flex-1"
          unidadeMedida={activeUnidade}
          onUnidadeMedidaChange={onUnidadeMedidaChange}
          presets={presets}
          passo={passo}
          externalModo={modo}
          onModoChange={setModo}
          configMarcacao={configMarcacao}
          mostrarValores={mostrarValores}
        />

        {resumoModalOpen ? (
          <div className="absolute inset-0 z-[150] flex items-center justify-center bg-black/60 p-4">
            <div className="relative w-full max-w-sm">
              <button
                type="button"
                aria-label="Fechar resumo"
                onClick={() => setResumoModalOpen(false)}
                className="absolute -right-2 -top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#64748b] shadow-md hover:text-app-ink"
              >
                <X className="h-4 w-4" />
              </button>
              <PontosResumoPanel
                vistaAtual={vistaAtual}
                gruposPontos={pontosVista}
                gruposSessao={gruposSessao}
                unidadeMedida={activeUnidade}
                isModal={true}
              />
            </div>
          </div>
        ) : null}
      </main>
    </div>,
    document.body,
  );
}
