import React, { useState } from 'react';

import { createPortal } from 'react-dom';

import { FotoVistaCanvasCore } from './FotoVistaCanvas.jsx';
import { MapeamentoFullscreenProcedimentoFloatingPanel } from './MapeamentoFullscreenProcedimentoPanel.jsx';
import { MapeamentoFullscreenToolbar } from './MapeamentoFullscreenToolbar.jsx';

export function MapeamentoFullscreenOverlay({
  open,
  toolbarWidthPx = 220,
  vistaAtual,
  foto,
  procedimentoArmado,
  onArmar,
  procedimentosUsados = [],
  pontosVista,
  countPontosVista = 0,
  onAddPonto,
  onEditarPonto,
  onRemovePonto,
  onDesfazerUltimo,
  onClose,
}) {
  const [panelOpen, setPanelOpen] = useState(false);

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
        onDesfazerUltimo={onDesfazerUltimo}
        onClose={onClose}
      />

      <main className="relative flex min-h-0 min-w-0 flex-1 flex-col p-4">
        <FotoVistaCanvasCore
          vistaAtual={vistaAtual}
          foto={foto}
          procedimentoArmado={procedimentoArmado}
          pontosVista={pontosVista}
          onAddPonto={onAddPonto}
          onEditarPonto={onEditarPonto}
          onRemovePonto={onRemovePonto}
          showToolbar={false}
          fillViewport
          className="h-full min-h-0 w-full flex-1"
        />

        <MapeamentoFullscreenProcedimentoFloatingPanel
          open={panelOpen}
          procedimentoArmado={procedimentoArmado}
          onArmar={onArmar}
          procedimentosUsados={procedimentosUsados}
        />
      </main>
    </div>,
    document.body,
  );
}
