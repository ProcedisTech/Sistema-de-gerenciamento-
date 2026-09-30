import React, { useMemo, useRef, useState } from 'react';
import { Check, Plus, Search, X, Loader2 } from 'lucide-react';
import {
  MAPEAMENTO_PALETA_CORES,
  corParaProcedimento,
  getCorLivreParaProcedimento,
} from '../../../constants/mapeamentoPaletaCores.js';

export function MapeamentoProcedimentoSearch({
  options = [],
  loading = false,
  procedimentoArmado,
  procedimentosUsados = [],
  onArmar,
  onClose,
}) {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  const termo = query.trim().toLowerCase();
  const lista = useMemo(() => {
    return options.filter((p) => !termo || p.nome?.toLowerCase().includes(termo));
  }, [options, termo]);

  const armId = procedimentoArmado?.id ? String(procedimentoArmado.id) : null;

  const usedMap = useMemo(() => {
    const map = new Map();
    procedimentosUsados.forEach((p) => {
      if (p?.id) map.set(String(p.id), p);
    });
    if (armId && procedimentoArmado?.nome) {
      map.set(armId, { ...procedimentoArmado, id: armId });
    }
    return map;
  }, [procedimentosUsados, armId, procedimentoArmado]);

  const coresOcupadas = useMemo(() => {
    const set = new Set();
    procedimentosUsados.forEach((p) => {
      const c = p?.corHex || corParaProcedimento(p?.id);
      if (c) set.add(String(c).trim().toLowerCase());
    });
    if (procedimentoArmado?.id) {
      const c = procedimentoArmado.corHex || corParaProcedimento(procedimentoArmado.id);
      if (c) set.add(String(c).trim().toLowerCase());
    }
    return set;
  }, [procedimentosUsados, procedimentoArmado]);

  const getCorParaExibir = (proc) => {
    const procId = String(proc.id);
    const procUsado = usedMap.get(procId);
    if (procUsado?.corHex) return procUsado.corHex;

    const corPref = String(proc.corHex || corParaProcedimento(proc.id)).toLowerCase();
    if (!coresOcupadas.has(corPref)) {
      return proc.corHex || corParaProcedimento(proc.id);
    }
    return getCorLivreParaProcedimento(proc.id, coresOcupadas);
  };

  const handleSelect = (proc) => {
    const cor = getCorParaExibir(proc);
    onArmar?.({ ...proc, corHex: cor });
  };

  return (
    <div className="w-full rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xl backdrop-blur-md">
      {/* Cabeçalho do Card */}
      <div className="mb-3 flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
        <div className="flex items-center gap-2">
          <p className="text-[12px] font-bold uppercase tracking-wider text-slate-700">Procedimentos</p>
          <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-teal-700 border border-teal-200/50">
            Catálogo
          </span>
        </div>
        {typeof onClose === 'function' ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            title="Fechar busca"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {/* Input de Busca */}
      <div className="relative mb-3">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          aria-hidden
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar procedimento..."
          autoFocus
          className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2 pl-9 pr-8 text-xs font-medium text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-500/15"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 rounded"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      {/* Lista de Procedimentos Direta e Fluida (Sem rolagem dupla e sem corte) */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-xs text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin text-teal-600" />
          <span>Carregando catálogo…</span>
        </div>
      ) : lista.length === 0 ? (
        <div className="py-6 text-center text-xs text-slate-400">
          {termo ? `Nenhum procedimento encontrado para "${query}"` : 'Nenhum procedimento cadastrado'}
        </div>
      ) : (
        <div className="max-h-[300px] overflow-y-auto space-y-1 pr-1 overscroll-contain">
          {lista.map((proc) => {
            const isUsado = usedMap.has(String(proc.id));
            const isArmado = armId === String(proc.id);
            const cor = getCorParaExibir(proc);

            return (
              <button
                key={proc.id}
                type="button"
                onClick={() => handleSelect(proc)}
                className={`flex w-full items-center justify-between gap-2.5 rounded-xl border p-2 text-left transition-all ${
                  isArmado
                    ? 'border-teal-500 bg-teal-50/80 shadow-2xs'
                    : isUsado
                      ? 'border-slate-200 bg-slate-50/80 hover:border-teal-300'
                      : 'border-slate-100 bg-white hover:border-teal-300 hover:bg-teal-50/40'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span
                    className="h-3.5 w-3.5 shrink-0 rounded-full border border-black/10 shadow-2xs"
                    style={{ backgroundColor: cor }}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs font-semibold truncate ${isArmado ? 'text-teal-900' : 'text-slate-800'}`}>
                      {proc.nome}
                    </p>
                    {proc.unidadeMedida ? (
                      <p className="text-[10px] text-slate-400 font-medium uppercase">
                        {proc.unidadeMedida}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="shrink-0 flex items-center">
                  {isArmado ? (
                    <Check className="h-4 w-4 text-teal-600" />
                  ) : isUsado ? (
                    <span className="text-[10px] font-bold text-teal-700 bg-teal-100/70 px-1.5 py-0.5 rounded-md">
                      Ativo
                    </span>
                  ) : (
                    <div className="h-6 w-6 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-teal-500 hover:text-white transition-colors">
                      <Plus className="h-3.5 w-3.5" />
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Procedimento Ativo / Armado */}
      {procedimentoArmado ? (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50/70 px-3 py-2 text-xs">
          <span
            className="h-3 w-3 shrink-0 rounded-full border border-black/10"
            style={{ backgroundColor: procedimentoArmado.corHex || corParaProcedimento(procedimentoArmado.id) }}
          />
          <span className="text-[11px] font-medium text-slate-500">Selecionado:</span>
          <span className="font-bold text-teal-800 truncate">{procedimentoArmado.nome}</span>
        </div>
      ) : null}
    </div>
  );
}
