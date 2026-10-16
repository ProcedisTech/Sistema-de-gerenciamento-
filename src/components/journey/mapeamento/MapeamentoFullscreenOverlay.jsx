import React, { useCallback, useRef, useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Menu,
  Minimize2,
  MoveDiagonal,
  CircleDot,
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
import { useToast } from '../../../contexts/useToast.js';
import { getVistaLabel } from '../../../constants/vistasMapeamento.js';
import { MAPEAMENTO_PALETA_CORES, corParaProcedimento } from '../../../constants/mapeamentoPaletaCores.js';
import { AssistiveTouchToolbar } from './AssistiveTouchToolbar.jsx';

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
  onMudarCorProcedimento,
}) {
  const toast = useToast();
  const [modo, setModo] = useState('ponto');
  const [tamanhoGlobalPonto, setTamanhoGlobalPonto] = useState(1.0);
  const [mostrarValores, setMostrarValores] = useState(true);
  const [resumoModalOpen, setResumoModalOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [configPopoverOpen, setConfigPopoverOpen] = useState(false);
  const mainContainerRef = useRef(null);
  const [configMarcacao, setConfigMarcacao] = useState({
    dosePadrao: 1,
    profundidade: '',
    confirmarDose: true,
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

  useEffect(() => {
    if (procedimentoArmado?.id) {
      setActiveProcedimentoId(procedimentoArmado.id);
    }
  }, [procedimentoArmado?.id]);

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

  const matchProcId = (p, targetId) => {
    if (!targetId || !p) return false;
    const t = String(targetId).trim();
    return [p.id, p.catalogoProcedimentoSaudeId, p.catalogoId, p.nomeProcedimentoCatalogoId, p._uid]
      .filter(Boolean)
      .some((id) => String(id).trim() === t);
  };

  const handleMudarCorProcedimento = (procId, novaCor) => {
    const alvo = procedimentosLocais.find((p) => matchProcId(p, procId));
    const corAntigaAlvo = alvo?.corHex;
    const outroAfetado = procedimentosLocais.find(
      (p) => !matchProcId(p, procId) && (p.corHex || corParaProcedimento(p.id)).toLowerCase() === novaCor?.toLowerCase()
    );

    setProcedimentosLocais((prev) =>
      prev.map((p) => {
        if (matchProcId(p, procId)) return { ...p, corHex: novaCor };
        if (outroAfetado && matchProcId(p, outroAfetado.id)) return { ...p, corHex: corAntigaAlvo };
        return p;
      })
    );

    onMudarCorProcedimento?.(procId, novaCor, outroAfetado?.id, corAntigaAlvo);

    if (outroAfetado) {
      toast?.info?.(
        `Cor já utilizada em ${outroAfetado.nome || 'outro procedimento'}. Cores foram invertidas para manter a distinção.`
      );
    }
  };

  const getProcedimentoStats = useCallback(
    (procId) => {
      let pontosCount = 0;
      let doseTotal = 0;
      const pontos = Array.isArray(pontosVista) ? pontosVista : [];
      pontos.forEach((pt) => {
        const ptId = String(pt.catalogoProcedimentoSaudeId || pt.catalogoId || pt.procedimentoId || '');
        if (ptId === String(procId)) {
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
    <div className="fixed inset-0 z-[140] flex min-w-0 flex-row overflow-hidden bg-slate-300 text-slate-800 select-none">
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

      {/* ── ÁREA DA FOTO E ILHA FLUTUANTE DE FERRAMENTAS (Mesa de Luz Clínica Claro) ── */}
      <main ref={mainContainerRef} className="relative flex min-h-0 min-w-0 flex-1 flex-col p-0 overflow-hidden bg-slate-300">
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
              title="Fechar tela cheia (Esc)"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/95 hover:bg-white text-slate-700 hover:text-slate-950 text-xs font-bold shadow-md border border-slate-300 backdrop-blur-xl transition-all scale-100 active:scale-95 cursor-pointer"
            >
              <X className="h-4 w-4 stroke-[2.5] text-slate-600" />
              <span>Fechar</span>
            </button>
          </div>
        </div>

        {/* BOLINHA FLUTUANTE ASSISTIVETOUCH ERGONÔMICA (z-[70]) */}
        <AssistiveTouchToolbar
          modo={modo}
          setModo={setModo}
          mostrarDoses={mostrarValores}
          setMostrarDoses={setMostrarValores}
          onUndo={onDesfazerUltimo}
          canUndo={countPontosVista > 0}
          activeCor={activeCor}
          activeProc={activeProc}
          procedimentos={listaProcedimentos}
          onMudarCor={(novaCor) => {
            if (activeProc) {
              handleMudarCorProcedimento(activeProc.id, novaCor);
            } else {
              setCorLivre(novaCor);
            }
          }}
          containerRef={mainContainerRef}
        />

        {/* Canvas da Foto Nativo */}
        <FotoVistaCanvasCore
          transformWrapperRef={transformWrapperRef}
          vistaAtual={vistaAtual}
          foto={foto}
          procedimentoArmado={activeProc}
          pontosVista={pontosVista}
          onAddPonto={(vista, pontoData) => {
            const catId = activeProc?.catalogoProcedimentoSaudeId || activeProc?.catalogoId || activeProc?.id || pontoData.catalogoProcedimentoSaudeId || pontoData.catalogoId;
            onAddPonto?.(vista, {
              ...pontoData,
              catalogoProcedimentoSaudeId: catId,
              catalogoId: catId,
              procedimentoIndex: activeProc?.index ?? 0,
              nomeProcedimento: activeProc?.nome || pontoData.nomeProcedimento,
              cor: pontoData?.cor || activeCor || activeProc?.corHex || (catId ? corParaProcedimento(catId) : '#00a88e'),
            });
          }}
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
