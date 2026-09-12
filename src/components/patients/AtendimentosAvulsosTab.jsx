import React, { useMemo } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { usePlanosPaciente } from '../planos/usePlanosPaciente.js';
import { resolverFotosEPlanos } from '../../utils/planoGaleriaResolver.js';
import { PastaAtendimentosAvulsos } from '../planos/PastaAtendimentosAvulsos.jsx';

export function AtendimentosAvulsosTab({
  pacienteId,
  roleUserId,
  procedimentosFeitos = [],
  galeriaFotosInicial = [],
}) {
  const { planos, loading, error, refresh } = usePlanosPaciente({ pacienteId, roleUserId });

  const { atendimentosAvulsos, fotosAvulsas } = useMemo(() => {
    return resolverFotosEPlanos(planos, galeriaFotosInicial, procedimentosFeitos);
  }, [planos, galeriaFotosInicial, procedimentosFeitos]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
        <span className="text-xs font-medium text-slate-500">
          Carregando atendimentos avulsos do paciente...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-6 text-center space-y-2">
        <p className="text-xs font-bold text-rose-700">Erro ao carregar atendimentos avulsos</p>
        <p className="text-xs text-slate-600">{error}</p>
        <button
          type="button"
          onClick={() => refresh?.()}
          className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 bg-white text-rose-700 text-xs font-semibold hover:bg-rose-50 transition-colors shadow-2xs"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (!atendimentosAvulsos || atendimentosAvulsos.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-2xs space-y-3">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-purple-600 border border-purple-100 shadow-2xs">
          <Sparkles className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <h4 className="text-sm font-bold text-slate-800">Nenhum atendimento avulso registrado</h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            Procedimentos, consultas pontuais e fotos registrados fora de um plano de tratamento estruturado aparecerão nesta aba.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-900">Atendimentos Avulsos</h3>
            <span className="px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 text-xs font-bold">
              {atendimentosAvulsos.length} {atendimentosAvulsos.length === 1 ? 'atendimento' : 'atendimentos'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Procedimentos realizados e registros clínicos sem vinculação a planos de tratamento
          </p>
        </div>
      </div>

      <PastaAtendimentosAvulsos
        pacienteId={pacienteId}
        atendimentosAvulsos={atendimentosAvulsos}
        fotosAvulsas={fotosAvulsas}
        initialOpen={true}
      />
    </div>
  );
}
