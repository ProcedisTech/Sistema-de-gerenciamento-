import React, { useMemo, useState } from 'react';
import { Search, Calendar, Check, ChevronRight } from 'lucide-react';
import { gerarCorAvatar, iniciaisDoNome } from '../../utils/gerarCorAvatar.js';
import {
  formatProcedimentoRaizData,
  filtrarProcedimentosRaiz,
  nomeProcedimentoRaiz,
} from './retornoOrigemUtils.js';

/** Seletor de procedimento raiz para retorno órfão / modal de agenda. */
export function RetornoOrigemSelect({
  value,
  onChange,
  options = [],
  loading = false,
  error = '',
  fieldError = '',
  id = 'retorno-origem-select',
}) {
  const [query, setQuery] = useState('');
  const listId = `${id}-list`;

  const filtered = useMemo(
    () => filtrarProcedimentosRaiz(options, query),
    [options, query],
  );

  const emptyMessage =
    options.length === 0
      ? 'Nenhum procedimento disponível'
      : 'Nenhum procedimento encontrado';

  return (
    <div className="space-y-2">
      <label
        htmlFor={id}
        className="text-[11px] font-semibold uppercase tracking-wide text-ink-500"
      >
        Retorno de qual procedimento? <span className="text-red-500">*</span>
      </label>
      {loading ? (
        <p className="text-[12px] text-ink-400">Carregando procedimentos…</p>
      ) : error ? (
        <p className="text-[11px] font-bold text-red-600">{error}</p>
      ) : (
        <>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
              aria-hidden
            />
            <input
              id={id}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome ou data…"
              aria-controls={listId}
              className="w-full rounded-xl border border-ink-200 bg-white py-2.5 pl-10 pr-3 text-sm text-ink-800 outline-none focus:border-[#00a88e] focus:ring-2 focus:ring-[#e6f7f5]"
            />
          </div>

          <div
            id={listId}
            role="listbox"
            aria-label="Procedimentos de origem do retorno"
            className="mt-2 max-h-[300px] space-y-2 overflow-y-auto overscroll-contain pr-0.5"
          >
            {filtered.length === 0 ? (
              <p className="py-8 text-center text-[13px] text-ink-400">{emptyMessage}</p>
            ) : (
              filtered.map((r) => {
                const nome = nomeProcedimentoRaiz(r);
                const dataFmt = formatProcedimentoRaizData(r.data);
                const isSelected = String(value) === String(r.id);
                const cor = gerarCorAvatar(nome);

                return (
                  <button
                    key={r.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    aria-label={`${nome}, realizado em ${dataFmt}`}
                    onClick={() => onChange?.(r.id)}
                    className={
                      isSelected
                        ? 'flex w-full items-center gap-3 rounded-xl border-2 border-[#00a88e] bg-[#e6f7f5] px-3 py-2.5 text-left'
                        : 'flex w-full items-center gap-3 rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-left hover:bg-ink-50'
                    }
                  >
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${cor.bg} ${cor.fg}`}
                    >
                      {iniciaisDoNome(nome)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`truncate text-[13px] font-semibold ${
                          isSelected ? 'text-[#0f766e]' : 'text-ink-900'
                        }`}
                      >
                        {nome}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1 text-[12px] text-ink-500">
                        <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        <span>{dataFmt}</span>
                      </p>
                    </div>
                    {isSelected ? (
                      <Check className="h-5 w-5 shrink-0 text-[#00a88e]" aria-hidden />
                    ) : (
                      <ChevronRight className="h-5 w-5 shrink-0 text-ink-400" aria-hidden />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </>
      )}
      {fieldError ? (
        <p className="text-[11px] font-bold text-red-600">{fieldError}</p>
      ) : null}
    </div>
  );
}
