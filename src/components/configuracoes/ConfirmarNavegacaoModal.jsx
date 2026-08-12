import React from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * Confirmação antes de fechar um formulário em andamento (Convidar/Editar Membro)
 * pra navegar até a aba Perfis de Acesso.
 */
export function ConfirmarNavegacaoModal({ onCancel, onConfirm }) {
  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-md"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center">
        <div className="h-14 w-14 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mb-4">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-2">Sair sem salvar?</h3>
        <p className="text-sm text-slate-500 mb-6">Isso vai fechar este formulário sem salvar as informações preenchidas até agora.</p>
        <div className="flex justify-center w-full gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#00a88e] to-teal-500 text-white text-sm font-bold shadow-lg shadow-teal-500/30 hover:-translate-y-0.5 active:scale-95 transition-all"
          >
            Continuar
          </button>
        </div>
      </div>
    </div>
  );
}
