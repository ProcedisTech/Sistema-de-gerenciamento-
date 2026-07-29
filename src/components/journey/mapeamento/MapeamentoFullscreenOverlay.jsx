import React, { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Menu } from 'lucide-react';
import { FotoVistaCanvasCore } from './FotoVistaCanvas.jsx';
import { MapeamentoFullscreenProcedimentoFloatingPanel } from './MapeamentoFullscreenProcedimentoPanel.jsx';
import { MapeamentoFullscreenToolbar } from './MapeamentoFullscreenToolbar.jsx';
import { PontosResumoPanel } from './PontosResumoPanel.jsx';
import { useMapeamentoFullscreenKeyboardShortcuts } from './useMapeamentoFullscreenKeyboardShortcuts.js';
import { useMediaQuery } from '../../../hooks/useMediaQuery.js';

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
  const [panelOpen, setPanelOpen] = useState(false);
  const [modo, setModo] = useState('ponto');
  const [tamanhoGlobalPonto, setTamanhoGlobalPonto] = useState(1.0);
  const [mostrarValores, setMostrarValores] = useState(false);
  const [resumoModalOpen, setResumoModalOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [configPopoverOpen, setConfigPopoverOpen] = useState(false);
  const [configMarcacao, setConfigMarcacao] = useState({
    dosePadrao: 1,
    profundidade: '',
    confirmarDose: true,
  });

  const isMdUp = useMediaQuery('(min-width: 768px)');

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
    onEscape: handleEscape,
  });

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[140] flex min-w-0 flex-row overflow-hidden bg-[#0f172a]">
      <MapeamentoFullscreenToolbar
        vistaAtual={vistaAtual}
        toolbarWidthPx={toolbarWidthPx}
        procedimentoArmado={procedimentoArmado}
        panelOpen={panelOpen}
        onToggleProcedimentoPanel={() => setPanelOpen((prev) => !prev)}
        countPontosVista={countPontosVista}
        onClose={onClose}
        configMarcacao={configMarcacao}
        setConfigMarcacao={setConfigMarcacao}
        unidadeMedida={unidadeMedida}
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
      />

      {/* Área da foto: zero chrome (exceto Menu mobile para abrir drawer) */}
      <main className="relative flex min-h-0 min-w-0 flex-1 flex-col p-0">
        {!isMdUp && !sidebarOpen ? (
          <button
            type="button"
            aria-label="Abrir menu de ferramentas"
            title="Abrir menu"
            onClick={() => setSidebarOpen(true)}
            className="absolute left-2 top-2 z-[50] flex h-9 w-9 items-center justify-center rounded-lg border border-[#e2e8f0] bg-white text-[#64748b] shadow-sm hover:bg-slate-50 hover:text-app-accent-deep"
          >
            <Menu className="h-4 w-4" />
          </button>
        ) : null}

        <FotoVistaCanvasCore
          vistaAtual={vistaAtual}
          foto={foto}
          procedimentoArmado={procedimentoArmado}
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
          unidadeMedida={unidadeMedida}
          onUnidadeMedidaChange={onUnidadeMedidaChange}
          presets={presets}
          passo={passo}
          externalModo={modo}
          onModoChange={setModo}
          configMarcacao={configMarcacao}
          mostrarValores={mostrarValores}
        />

        {!hideProcedimentoPicker ? (
          <MapeamentoFullscreenProcedimentoFloatingPanel
            open={panelOpen}
            procedimentoArmado={procedimentoArmado}
            onArmar={onArmar}
            procedimentosUsados={procedimentosUsados}
          />
        ) : null}

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
                unidadeMedida={unidadeMedida}
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
