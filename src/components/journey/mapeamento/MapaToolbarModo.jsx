import React from 'react';
import { MousePointer2, MoveDiagonal, Eraser, Hand } from 'lucide-react';

export function MapaToolbarModo({ modo, setModo, tamanho, setTamanho }) {
  return (
    <div className="flex flex-wrap justify-center items-center gap-1.5 sm:gap-2 bg-[#f8fafc] p-1.5 rounded-lg border border-[#e2e8f0] shadow-sm pointer-events-auto">
      <div className="flex flex-wrap justify-center items-center gap-1">
        <button
          type="button"
          onClick={() => setModo('ponto')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-semibold transition-colors ${
            modo === 'ponto'
              ? 'bg-white shadow-sm text-app-accent border border-app-border'
              : 'text-[#64748b] hover:text-[#334155] border border-transparent'
          }`}
        >
          <MousePointer2 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Ponto</span>
        </button>
        <button
          type="button"
          onClick={() => setModo('mover')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-semibold transition-colors ${
            modo === 'mover'
              ? 'bg-white shadow-sm text-app-accent border border-app-border'
              : 'text-[#64748b] hover:text-[#334155] border border-transparent'
          }`}
        >
          <Hand className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Mover</span>
        </button>
        <button
          type="button"
          onClick={() => setModo('traco')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-semibold transition-colors ${
            modo === 'traco'
              ? 'bg-white shadow-sm text-app-accent border border-app-border'
              : 'text-[#64748b] hover:text-[#334155] border border-transparent'
          }`}
        >
          <MoveDiagonal className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Traço</span>
        </button>
        <button
          type="button"
          onClick={() => setModo('borracha')}
          title="Apagar pontos ou traços"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-semibold transition-colors ${
            modo === 'borracha'
              ? 'bg-red-50 text-red-600 shadow-sm border border-red-200'
              : 'text-[#64748b] hover:text-red-500 border border-transparent'
          }`}
        >
          <Eraser className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Borracha</span>
        </button>
      </div>

      {modo === 'ponto' && (
        <div className="flex items-center gap-2 px-2 border-l border-slate-200">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-[#64748b]">
            Tamanho
          </label>
          <input 
            type="range" 
            min="0.5" 
            max="1.5" 
            step="0.1" 
            value={tamanho ?? 1.0} 
            onChange={(e) => setTamanho?.(Number(e.target.value))}
            className="w-24 accent-app-accent cursor-pointer"
          />
        </div>
      )}
    </div>
  );
}
