import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Search, X, ChevronDown, ChevronUp } from 'lucide-react';

const DEBOUNCE_MS = 300;

/**
 * Seção de catálogo com autocomplete + chips selecionados.
 *
 * Props:
 * - titulo: string
 * - selected: Array<{ id, nome, observacao?, dose?, frequencia?, usoContinuo? }>
 * - onAdd(item): void
 * - onRemove(id): void
 * - onUpdateObservacao(id, texto): void
 * - searchFn(q): Promise<CatalogoItemDTO[]> — busca debounced externamente
 * - renderChipExtra?(item, onChange): ReactNode — extra para medicamentos
 * - placeholder?: string
 */
export function CatalogoChipSection({
  titulo,
  selected = [],
  onAdd,
  onRemove,
  onUpdateObservacao,
  searchFn,
  renderChipExtra,
  placeholder = 'Buscar…',
  readOnly = false,
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [expandedChip, setExpandedChip] = useState(null);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const debounceRef = useRef(null);

  const handleQueryChange = useCallback((e) => {
    const q = e.target.value;
    setQuery(q);
    clearTimeout(debounceRef.current);
    if (!q.trim()) {
      setResults([]);
      setShowResults(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoadingSearch(true);
      try {
        const data = await searchFn(q.trim());
        setResults(Array.isArray(data) ? data : []);
        setShowResults(true);
      } catch {
        setResults([]);
      } finally {
        setLoadingSearch(false);
      }
    }, DEBOUNCE_MS);
  }, [searchFn]);

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    if (!showResults) return undefined;
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target) &&
          inputRef.current && !inputRef.current.contains(e.target)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showResults]);

  const handleSelect = useCallback((item) => {
    const chip = {
      id: item.id ?? item.codigo,
      codigo: item.codigo,
      nome: item.nome,
      observacao: '',
      dose: '',
      frequencia: '',
      usoContinuo: true,
    };
    onAdd(chip);
    setQuery('');
    setResults([]);
    setShowResults(false);
    inputRef.current?.focus();
  }, [onAdd]);

  const selectedIds = new Set(selected.map((s) => s.id));

  if (readOnly) {
    return (
      <div className="flex min-w-0 flex-col gap-1.5">
        <p className="text-[12px] font-bold text-slate-700">{titulo}</p>
        {selected.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {selected.map((item) => {
              const extras = [
                item.observacao?.trim() || null,
                item.dose?.trim() ? `Dose: ${item.dose.trim()}` : null,
                item.frequencia?.trim() ? `Freq.: ${item.frequencia.trim()}` : null,
                item.usoContinuo === false ? 'Uso não contínuo' : null,
              ].filter(Boolean);
              return (
                <div
                  key={item.id}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5"
                >
                  <span className="text-[12px] font-medium text-slate-700">{item.nome}</span>
                  {extras.length > 0 ? (
                    <p className="mt-0.5 text-[11px] text-slate-500">{extras.join(' · ')}</p>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-[11px] text-slate-400">Nenhum item registrado</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <p className="text-[12px] font-bold text-slate-700">{titulo}</p>

      {/* Campo de busca */}
      <div className="relative">
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 focus-within:border-[#00a88e] focus-within:ring-1 focus-within:ring-[#00a88e]/20 transition-all">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleQueryChange}
            onFocus={() => query.trim() && results.length > 0 && setShowResults(true)}
            placeholder={placeholder}
            className="flex-1 bg-transparent text-[13px] text-slate-700 placeholder:text-slate-400 outline-none"
          />
          {loadingSearch && (
            <div className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-slate-300 border-t-[#00a88e]" />
          )}
        </div>

        {/* Dropdown de resultados */}
        {showResults && results.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg overflow-hidden"
          >
            <ul className="max-h-52 overflow-y-auto">
              {results.map((item) => {
                const itemId = item.id ?? item.codigo;
                const already = selectedIds.has(itemId);
                return (
                  <li key={itemId}>
                    <button
                      type="button"
                      disabled={already}
                      onClick={() => handleSelect(item)}
                      className={`w-full px-3 py-2 text-left text-[13px] transition-colors ${
                        already
                          ? 'text-slate-400 cursor-default bg-slate-50'
                          : 'text-slate-700 hover:bg-[#e6f7f5] cursor-pointer'
                      }`}
                    >
                      {item.nome}
                      {already && (
                        <span className="ml-2 text-[11px] text-slate-400">já adicionado</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {/* Chips selecionados */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((item) => {
            const isExpanded = expandedChip === item.id;
            return (
              <div
                key={item.id}
                className="flex flex-col rounded-lg border border-slate-200 bg-slate-50 overflow-hidden"
              >
                <div className="flex items-center gap-1.5 px-2.5 py-1.5">
                  <span className="text-[12px] font-medium text-slate-700">{item.nome}</span>

                  {/* Botão expandir chip (observação / extras) */}
                  <button
                    type="button"
                    onClick={() => setExpandedChip(isExpanded ? null : item.id)}
                    className="text-slate-400 hover:text-slate-600 transition-colors"
                    title={isExpanded ? 'Recolher' : 'Editar observação'}
                  >
                    {isExpanded ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (expandedChip === item.id) setExpandedChip(null);
                      onRemove(item.id);
                    }}
                    className="text-slate-400 hover:text-red-500 transition-colors"
                    title="Remover"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Painel expandido */}
                {isExpanded && (
                  <div className="border-t border-slate-200 bg-white px-2.5 pb-2.5 pt-2 flex flex-col gap-2">
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] text-slate-500">Observação</span>
                      <input
                        type="text"
                        value={item.observacao ?? ''}
                        onChange={(e) => onUpdateObservacao(item.id, e.target.value)}
                        placeholder="ex.: reação grave"
                        className="rounded border border-slate-200 px-2 py-1 text-[12px] text-slate-700 outline-none focus:border-[#6c63ff] transition-colors"
                      />
                    </label>
                    {renderChipExtra && renderChipExtra(item, (_fields) => {
                      /* chamado pelo PerfilClinicoBloco com updateMedicamentoExtra */
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {selected.length === 0 && (
        <p className="text-[11px] text-slate-400">Nenhum item adicionado</p>
      )}
    </div>
  );
}
