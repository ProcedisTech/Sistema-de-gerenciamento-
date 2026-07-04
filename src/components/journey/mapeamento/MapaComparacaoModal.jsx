import React, { useState, useEffect } from 'react';
import { X, Calendar, Loader2 } from 'lucide-react';
import { mapasApi } from '../../../services/api.js';

export function MapaComparacaoModal({ open, onClose, pacienteId, catalogoId, onSelectMapa }) {
  const [historico, setHistorico] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !pacienteId || !catalogoId) return;
    
    let cancelled = false;
    setTimeout(() => {
      if (!cancelled) setLoading(true);
    }, 0);
    mapasApi.buscarHistorico(pacienteId, catalogoId)
      .then(res => {
        if (!cancelled) setHistorico(res || []);
      })
      .catch(err => {
        console.error('Falha ao buscar histórico de mapas', err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [open, pacienteId, catalogoId]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/40 p-4">
      <div 
        role="dialog"
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-app-border bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-[#e2e8f0] px-5 py-4">
          <h3 className="text-[17px] font-bold text-app-ink">Comparar com Mapa Anterior</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#64748b] hover:bg-slate-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <p className="text-[13px] text-[#64748b] mb-4">
            Selecione um mapa do histórico deste paciente para exibir sobreposto à foto atual.
          </p>

          {loading ? (
            <div className="flex justify-center items-center py-8 text-[#94a3b8]">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>Buscando histórico...</span>
            </div>
          ) : historico.length === 0 ? (
            <div className="text-center py-8 text-[13px] font-medium text-[#94a3b8]">
              Nenhum mapa anterior encontrado para este procedimento.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {historico.map(item => (
                <button
                  key={item.id}
                  onClick={() => onSelectMapa(item)}
                  className="flex items-center justify-between p-4 rounded-xl border border-app-border hover:border-app-accent hover:bg-app-nav-active transition-colors text-left"
                >
                  <div>
                    <div className="flex items-center gap-1.5 text-app-ink font-semibold text-[14px]">
                      <Calendar className="h-4 w-4 text-[#64748b]" />
                      {new Date(item.dataRegistro).toLocaleDateString('pt-BR')}
                    </div>
                    <div className="text-[12px] text-[#64748b] mt-1">
                      Profissional: <span className="font-medium text-app-ink">{item.nomeProfissional}</span>
                    </div>
                  </div>
                  <div className="text-[12px] font-medium bg-[#f1f5f9] text-[#475569] px-2.5 py-1 rounded-md">
                    {item.quantidadeMarcacoes} marcação(ões)
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
