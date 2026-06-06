import React, { useCallback, useRef, useState } from 'react';
import { Check, Plus, Search } from 'lucide-react';
import { corParaProcedimento } from '../../../constants/mapeamentoPaletaCores.js';
import { SearchDropdownShell } from '../../agenda/SearchDropdownShell.jsx';

const INPUT_CLASS =
  'w-full rounded-xl border border-app-border bg-white py-2.5 pl-10 pr-3 text-[13px] font-medium text-app-ink outline-none focus:border-app-accent focus:ring-4 focus:ring-[#00a88e]/10';

export function MapeamentoProcedimentoSearch({
  options = [],
  loading = false,
  procedimentoArmado,
  procedimentosUsados = [],
  onArmar,
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef(null);

  const close = useCallback(() => setOpen(false), []);

  const termo = query.trim().toLowerCase();
  const lista = options.filter((p) => !termo || p.nome.toLowerCase().includes(termo));
  const armId = procedimentoArmado?.id ? String(procedimentoArmado.id) : null;

  const usedMap = new Map();
  procedimentosUsados.forEach((p) => {
    if (p?.id) usedMap.set(String(p.id), p);
  });
  if (armId && procedimentoArmado?.nome) {
    usedMap.set(armId, { id: armId, nome: procedimentoArmado.nome });
  }
  const usados = Array.from(usedMap.values());

  const handleToggleUsado = (proc) => {
    onArmar?.(proc);
    setOpen(false);
  };

  const handleSelectBusca = (proc) => {
    onArmar?.(proc);
    setOpen(false);
  };

  const dropdown = open ? (
    <ul role="listbox" aria-label="Procedimentos" className="py-1">
      {lista.length === 0 ? (
        <li className="px-3 py-2.5 text-[12px] font-medium text-[#94a3b8]">
          {termo ? `Nenhum resultado para "${query}"` : 'Nenhum procedimento disponível'}
        </li>
      ) : (
        lista.map((proc) => {
          const selecionado = armId === String(proc.id);
          const cor = corParaProcedimento(proc.id);
          return (
            <li key={proc.id} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={selecionado}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelectBusca(proc)}
                className={`flex w-full items-center gap-3 border-b border-[#f1f5f9] px-3 py-2.5 text-left last:border-0 ${
                  selecionado ? 'bg-app-nav-active' : 'hover:bg-[#f8fafc]'
                }`}
              >
                <span
                  className="h-3 w-3 shrink-0 rounded-full ring-2 ring-white"
                  style={{ backgroundColor: cor }}
                  aria-hidden
                />
                <span className={`min-w-0 flex-1 truncate text-[13px] font-semibold ${selecionado ? 'text-[#0f766e]' : 'text-app-ink'}`}>
                  {proc.nome}
                </span>
                {selecionado ? (
                  <Check className="h-4 w-4 shrink-0 text-app-accent" />
                ) : (
                  <Plus className="h-4 w-4 shrink-0 text-[#94a3b8]" />
                )}
              </button>
            </li>
          );
        })
      )}
    </ul>
  ) : null;

  return (
    <div className="rounded-xl border border-app-border bg-white p-5 shadow-app-card">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748b]">Procedimento</p>
        <span className="rounded-md bg-[#e6f7f5] px-2 py-0.5 text-[10px] font-semibold text-[#00a88e]">
          Padrão por ponto
        </span>
      </div>

      {loading ? (
        <p className="text-[13px] text-[#94a3b8]">Carregando catálogo…</p>
      ) : (
        <SearchDropdownShell open={open} onRequestClose={close} dropdown={dropdown}>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 z-[1] h-4 w-4 -translate-y-1/2 text-[#94a3b8]"
            aria-hidden
          />
          <input
            ref={inputRef}
            type="search"
            role="combobox"
            aria-expanded={open}
            aria-label="Buscar procedimento"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onClick={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                close();
                e.preventDefault();
              }
            }}
            placeholder="Buscar procedimento..."
            className={INPUT_CLASS}
            autoComplete="off"
          />
        </SearchDropdownShell>
      )}

      {usados.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {usados.map((proc) => {
            const cor = corParaProcedimento(proc.id);
            const armado = armId === String(proc.id);
            return (
              <li key={proc.id}>
                <button
                  type="button"
                  onClick={() => handleToggleUsado(proc)}
                  className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left transition-colors ${
                    armado
                      ? 'border-app-accent/40 bg-app-nav-active shadow-sm'
                      : 'border-[#e2e8f0] bg-[#f8fafc] hover:border-app-accent/30'
                  }`}
                >
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: cor }} aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-app-ink">{proc.nome}</span>
                  {armado ? (
                    <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-[#00a88e]">Armado</span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {procedimentoArmado ? (
        <div className="mt-3 inline-flex w-full items-center gap-2 rounded-xl border border-app-accent/40 bg-app-nav-active px-4 py-2.5 shadow-sm">
          <span
            className="h-3 w-3 shrink-0 rounded-full ring-2 ring-white"
            style={{ backgroundColor: corParaProcedimento(procedimentoArmado.id) }}
            aria-hidden
          />
          <span className="text-[12px] font-medium text-[#64748b]">Armado para marcar:</span>
          <span className="truncate text-[13px] font-bold text-[#0f766e]">{procedimentoArmado.nome}</span>
        </div>
      ) : (
        <p className="mt-3 text-[12px] font-medium text-[#94a3b8]">
          Selecione um procedimento para marcar pontos na foto.
        </p>
      )}
    </div>
  );
}
