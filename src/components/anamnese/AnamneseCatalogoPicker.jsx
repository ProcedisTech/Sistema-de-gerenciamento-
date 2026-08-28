import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pencil, Search, X } from 'lucide-react';

const DEBOUNCE_MS = 300;

/**
 * Autocomplete de catálogo clínico para anamnese.
 * Chips de catálogo (teal) e texto livre (slate/dashed) podem coexistir.
 */
export function AnamneseCatalogoPicker({
  searchFn,
  catalogoItens = [],
  textosLivres = [],
  onChange = () => {},
  readOnly = false,
  minQueryLength = 2,
  placeholder = 'Buscar no catálogo…',
  declarouAusencia = false,
  onDeclarouAusenciaChange,
  hideAusencia = false,
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [descrevendo, setDescrevendo] = useState(false);
  const [textoLivre, setTextoLivre] = useState('');
  const inputRef = useRef(null);
  const textoRef = useRef(null);
  const dropdownRef = useRef(null);
  const debounceRef = useRef(null);
  const searchFnRef = useRef(searchFn);
  const minQueryLengthRef = useRef(minQueryLength);
  searchFnRef.current = searchFn;
  minQueryLengthRef.current = minQueryLength;

  const selectedIds = new Set(catalogoItens.map((s) => String(s.id)));

  const emit = useCallback((nextCatalogo, nextTextos, ausencia) => {
    onChange({
      catalogoItens: nextCatalogo,
      textosLivres: nextTextos,
      declarouAusencia: ausencia,
    });
  }, [onChange]);

  const runSearch = (q) => {
    clearTimeout(debounceRef.current);
    const fn = searchFnRef.current;
    const minLen = minQueryLengthRef.current;
    if (!fn || q.length < minLen) {
      setResults([]);
      setShowResults(false);
      setLoadingSearch(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoadingSearch(true);
      try {
        const data = await fn(q);
        const list = Array.isArray(data) ? data : [];
        setResults(list);
        setShowResults(true);
      } catch {
        setResults([]);
        setShowResults(true);
      } finally {
        setLoadingSearch(false);
      }
    }, DEBOUNCE_MS);
  };

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  useEffect(() => {
    if (!showResults) return undefined;
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)
          && inputRef.current && !inputRef.current.contains(e.target)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showResults]);

  useEffect(() => {
    if (descrevendo && textoRef.current) textoRef.current.focus();
  }, [descrevendo]);

  const handleSelect = (item) => {
    const id = item.id ?? item.codigo;
    if (id == null || selectedIds.has(String(id))) return;
    emit(
      [...catalogoItens, { id, nome: item.nome || String(id), fonte: 'catalogo' }],
      textosLivres,
      false,
    );
    setQuery('');
    setResults([]);
    setShowResults(false);
  };

  const handleRemoveCatalogo = (id) => {
    emit(catalogoItens.filter((i) => String(i.id) !== String(id)), textosLivres, false);
  };

  const handleRemoveTexto = (idLocal) => {
    emit(catalogoItens, textosLivres.filter((t) => t.idLocal !== idLocal), false);
  };

  const commitTextoLivre = () => {
    const texto = textoLivre.trim();
    if (!texto) return;
    emit(
      catalogoItens,
      [...textosLivres, { idLocal: `livre-${Date.now()}`, texto, fonte: 'livre' }],
      false,
    );
    setTextoLivre('');
    setDescrevendo(false);
  };

  if (readOnly) {
    return (
      <div className="flex flex-wrap gap-2">
        {catalogoItens.map((item) => (
          <span
            key={item.id}
            data-chip="catalogo"
            className="rounded-lg border border-[#00a88e]/30 bg-[#e6f7f5] px-2.5 py-1 text-[12px] font-medium text-[#0f766e]"
          >
            {item.nome}
          </span>
        ))}
        {textosLivres.map((t) => (
          <span
            key={t.idLocal}
            data-chip="livre"
            className="inline-flex items-center gap-1 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-2.5 py-1 text-[12px] font-medium text-slate-600"
          >
            <Pencil className="h-3 w-3" aria-hidden />
            {t.texto}
          </span>
        ))}
        {declarouAusencia ? (
          <span className="text-[12px] italic text-slate-500">Declarou ausência</span>
        ) : null}
        {catalogoItens.length === 0 && textosLivres.length === 0 && !declarouAusencia ? (
          <span className="text-[12px] text-slate-400">Nenhum item</span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      {hideAusencia ? null : (
        <label className="flex items-center gap-2 text-[13px] text-slate-600">
          <input
            type="checkbox"
            checked={Boolean(declarouAusencia)}
            onChange={(e) => {
              const checked = e.target.checked;
              onDeclarouAusenciaChange?.(checked);
              emit(checked ? [] : catalogoItens, checked ? [] : textosLivres, checked);
            }}
          />
          Não tenho nenhum destes
        </label>
      )}

      {!declarouAusencia ? (
        <>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              ref={inputRef}
              type="search"
              value={query}
              placeholder={placeholder}
              onChange={(e) => {
                const q = e.target.value;
                setQuery(q);
                runSearch(q.trim());
              }}
              className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-[14px] text-slate-700 outline-none focus:border-[#00a88e] focus:ring-2 focus:ring-[#00a88e]/15"
            />
            {showResults ? (
              <div
                ref={dropdownRef}
                className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg"
              >
                {loadingSearch ? (
                  <p className="px-3 py-2 text-[13px] text-slate-400">Buscando…</p>
                ) : results.filter((r) => !selectedIds.has(String(r.id ?? r.codigo))).length === 0 ? (
                  <div className="flex flex-col gap-2 px-3 py-3">
                    <p className="text-[13px] text-slate-500">Nenhum item. Descreva em texto.</p>
                    <button
                      type="button"
                      onClick={() => { setDescrevendo(true); setShowResults(false); }}
                      className="text-left text-[13px] font-semibold text-[#00a88e] hover:underline"
                    >
                      Não encontrei → descrever
                    </button>
                  </div>
                ) : (
                  <ul>
                    {results
                      .filter((r) => !selectedIds.has(String(r.id ?? r.codigo)))
                      .map((item) => {
                        const id = item.id ?? item.codigo;
                        return (
                          <li key={id}>
                            <button
                              type="button"
                              onClick={() => handleSelect(item)}
                              className="w-full px-3 py-2 text-left text-[13px] text-slate-700 hover:bg-[#e6f7f5]"
                            >
                              <span className="flex flex-col gap-0.5">
                                <span>{item.nome}</span>
                                {(item.detalhe || item.encontradoPor) ? (
                                  <span className="text-[11px] text-slate-400">
                                    {[item.detalhe, item.encontradoPor].filter(Boolean).join(' · ')}
                                  </span>
                                ) : null}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    <li className="border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => { setDescrevendo(true); setShowResults(false); }}
                        className="w-full px-3 py-2 text-left text-[13px] font-semibold text-[#00a88e] hover:bg-slate-50"
                      >
                        Não encontrei → descrever
                      </button>
                    </li>
                  </ul>
                )}
              </div>
            ) : null}
          </div>

          {descrevendo ? (
            <input
              ref={textoRef}
              type="text"
              value={textoLivre}
              placeholder="Descreva o item…"
              onChange={(e) => setTextoLivre(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitTextoLivre();
                }
              }}
              className="w-full rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-[14px] outline-none focus:border-[#00a88e]"
            />
          ) : (
            <button
              type="button"
              onClick={() => setDescrevendo(true)}
              className="self-start text-[12px] font-semibold text-[#00a88e] hover:underline"
            >
              Não encontrei → descrever
            </button>
          )}

          <div className="flex flex-wrap gap-2">
            {catalogoItens.map((item) => (
              <span
                key={item.id}
                data-chip="catalogo"
                className="inline-flex items-center gap-1 rounded-lg border border-[#00a88e]/30 bg-[#e6f7f5] px-2.5 py-1 text-[12px] font-medium text-[#0f766e]"
              >
                {item.nome}
                <button type="button" aria-label={`Remover ${item.nome}`} onClick={() => handleRemoveCatalogo(item.id)}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            {textosLivres.map((t) => (
              <span
                key={t.idLocal}
                data-chip="livre"
                className="inline-flex items-center gap-1 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-2.5 py-1 text-[12px] font-medium text-slate-600"
              >
                <Pencil className="h-3 w-3" aria-hidden />
                {t.texto}
                <button type="button" aria-label={`Remover ${t.texto}`} onClick={() => handleRemoveTexto(t.idLocal)}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
