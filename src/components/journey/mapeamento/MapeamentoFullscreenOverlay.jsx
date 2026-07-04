import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Undo2, Eye, EyeOff, FileText, X, Menu } from 'lucide-react';
import { FotoVistaCanvasCore } from './FotoVistaCanvas.jsx';
import { MapeamentoFullscreenProcedimentoFloatingPanel } from './MapeamentoFullscreenProcedimentoPanel.jsx';
import { MapeamentoFullscreenToolbar } from './MapeamentoFullscreenToolbar.jsx';
import { MapaToolbarModo } from './MapaToolbarModo.jsx';
import { PontosResumoPanel } from './PontosResumoPanel.jsx';

export function MapeamentoFullscreenOverlay({
  open,
  toolbarWidthPx = 220,
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
}) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [modo, setModo] = useState('ponto');
  const [tamanhoGlobalPonto, setTamanhoGlobalPonto] = useState(1.0);
  const [mostrarValores, setMostrarValores] = useState(false);
  const [resumoModalOpen, setResumoModalOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [configMarcacao, setConfigMarcacao] = useState({
    dosePadrao: 1,
    profundidade: '',
    confirmarDose: true,
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
        hideProcedimentoPicker={hideProcedimentoPicker}
        drawerOpen={sidebarOpen}
        onCloseDrawer={() => setSidebarOpen(false)}
      />

      <main className="relative flex min-h-0 min-w-0 flex-1 flex-col p-4">
        <div className="absolute top-4 left-0 right-0 z-[50] flex flex-wrap justify-center gap-2 px-2 pointer-events-none">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setSidebarOpen(true); }}
            className="md:hidden flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#e2e8f0] bg-white text-[#64748b] shadow-sm hover:bg-slate-50 hover:text-app-accent-deep pointer-events-auto"
          >
            <Menu className="h-4 w-4" />
          </button>
          
          <button
            type="button"
            title={mostrarValores ? "Ocultar valores na foto" : "Mostrar valores na foto"}
            onClick={(e) => {
              e.stopPropagation();
              setMostrarValores((prev) => !prev);
            }}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#e2e8f0] bg-white text-[#64748b] shadow-sm transition-colors hover:bg-slate-50 hover:text-app-accent-deep pointer-events-auto"
          >
            {mostrarValores ? <Eye className="h-4 w-4" strokeWidth={2} /> : <EyeOff className="h-4 w-4" strokeWidth={2} />}
          </button>
          
          <MapaToolbarModo 
            modo={modo} 
            setModo={setModo} 
            tamanho={tamanhoGlobalPonto} 
            setTamanho={setTamanhoGlobalPonto} 
          />
          <button
            type="button"
            title="Desfazer último ponto"
            disabled={countPontosVista === 0}
            onClick={(e) => {
              e.stopPropagation();
              onDesfazerUltimo?.();
            }}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#e2e8f0] bg-white text-[#64748b] shadow-sm transition-colors hover:bg-slate-50 hover:text-app-accent-deep disabled:cursor-not-allowed disabled:opacity-50 pointer-events-auto"
          >
            <Undo2 className="h-4 w-4" strokeWidth={2} />
          </button>
          
          <button
            type="button"
            title="Ver Resumo de Insumos"
            onClick={(e) => {
              e.stopPropagation();
              setResumoModalOpen(true);
            }}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-[#e2e8f0] bg-white px-3 text-[12px] font-semibold text-[#64748b] shadow-sm transition-colors hover:bg-slate-50 hover:text-app-accent-deep pointer-events-auto"
          >
            <FileText className="h-4 w-4" strokeWidth={2} />
            <span className="hidden sm:inline">Resumo</span>
          </button>
        </div>
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

        {resumoModalOpen && (
          <div className="absolute inset-0 z-[150] flex items-center justify-center bg-black/60 p-4">
            <div className="relative w-full max-w-sm">
              <button
                type="button"
                onClick={() => setResumoModalOpen(false)}
                className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#64748b] shadow-md hover:text-app-ink z-10"
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
        )}
      </main>
    </div>,
    document.body,
  );
}
