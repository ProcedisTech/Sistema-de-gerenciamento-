import React, { useMemo } from 'react';

export function PlanoProtocoloResumo({ itens = [], plano }) {
  const { concluidos, agendados, semData } = useMemo(() => {
    let conc = 0;
    let agen = 0;
    let sem = 0;
    itens.forEach((it) => {
      const s = String(it.statusItem || it.statusItemNome || '').toLowerCase();
      if (s === 'finalizado' || s === 'realizado') {
        conc += 1;
      } else if (it.dataPlanejada || it.sessaoAtiva?.dataAgendamento) {
        agen += 1;
      } else {
        sem += 1;
      }
    });
    return { concluidos: conc, agendados: agen, semData: sem };
  }, [itens]);

  const total = itens.length;
  const pctConcluido = total > 0 ? (concluidos / total) * 100 : 0;
  const pctAgendado = total > 0 ? (agendados / total) * 100 : 0;
  const pctSemData = total > 0 ? (semData / total) * 100 : 0;

  const criadoEm = plano?.criadoEm;
  const diasAberto = useMemo(() => {
    if (!criadoEm) return null;
    const diff = Math.round((new Date() - new Date(criadoEm)) / 86400000);
    return Math.max(0, diff);
  }, [criadoEm]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
      <div className="flex items-center gap-2.5 flex-wrap">
        <h1 className="text-lg font-extrabold tracking-tight text-slate-900">
          Plano de tratamento
        </h1>
        <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
          {plano?.statusCodigo === 'concluido'
            ? 'CONCLUÍDO'
            : plano?.statusCodigo === 'encerrado'
              ? 'ENCERRADO'
              : 'MONTANDO'}
        </span>
        <span className="text-xs text-slate-400 font-medium">
          {diasAberto != null
            ? `Aberto há ${diasAberto} ${diasAberto === 1 ? 'dia' : 'dias'} · `
            : 'Iniciado hoje · '}
          {total} procedimento{total !== 1 ? 's' : ''}
        </span>
      </div>

      {/* TRILHA DO PLANO / BARRA MULTI-COLORIDA V6 */}
      <div className="pt-2 border-t border-slate-100 space-y-2">
        <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden flex">
          <div
            style={{ width: `${pctConcluido}%` }}
            className="bg-teal-600 transition-all duration-300"
            title={`${concluidos} realizados`}
          />
          <div
            style={{ width: `${pctAgendado}%` }}
            className="bg-teal-300 transition-all duration-300"
            title={`${agendados} agendados`}
          />
          <div
            style={{ width: `${pctSemData}%` }}
            className="bg-slate-200 transition-all duration-300"
            title={`${semData} sem data`}
          />
        </div>

        {/* LEGENDA V6 COM PONTINHOS */}
        <div className="flex items-center gap-4 flex-wrap text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-teal-600 inline-block" />
            <b className="font-bold text-slate-800">{concluidos}</b> realizados
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-teal-300 inline-block" />
            <b className="font-bold text-slate-800">{agendados}</b> agendados
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-slate-300 inline-block" />
            <b className="font-bold text-slate-800">{semData}</b> sem data
          </span>
        </div>
      </div>
    </div>
  );
}
