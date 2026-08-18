import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, ChevronDown } from 'lucide-react';
import { useProfissoes } from '../../hooks/useProfissoes.js';
import { matchesSearch } from '../../utils/profissaoHelpers.js';

/**
 * @typedef {object} ProfissaoSelectProps
 * @property {string | null} value — UUID da profissão selecionada
 * @property {(uuid: string | null) => void} onChange
 * @property {boolean} [disabled]
 * @property {boolean} [error]
 * @property {boolean} [required]
 * @property {string} [placeholder]
 * @property {'default'|'modal'} [variant]
 */

const PANEL_MARGIN = 8;
const PANEL_PREFERRED_HEIGHT = 560;
const PANEL_FLIP_THRESHOLD = 360;

export default function ProfissaoSelect({
  value,
  onChange,
  disabled = false,
  error = false,
  required: _required = false,
  placeholder = 'Selecione a profissao...',
  variant = 'default',
}) {
  const { profissoes, loading, error: loadError } = useProfissoes();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoriaFilter, setCategoriaFilter] = useState(null);
  const [placement, setPlacement] = useState(null);
  const rootRef = useRef(null);
  const panelRef = useRef(null);

  const selectedItem = useMemo(
    () => profissoes.find((p) => p.id === value) ?? null,
    [profissoes, value],
  );

  const displayLabel = selectedItem?.nome ?? '';

  const categoriasOrdenadas = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const p of profissoes) {
      const c = String(p.categoria ?? '').trim() || '—';
      if (seen.has(c)) continue;
      seen.add(c);
      out.push(c);
    }
    return out;
  }, [profissoes]);

  const filtered = useMemo(() => {
    let list = profissoes;
    if (categoriaFilter) {
      list = list.filter((p) => (String(p.categoria ?? '').trim() || '—') === categoriaFilter);
    }
    return list.filter((p) => matchesSearch(p, searchQuery));
  }, [profissoes, categoriaFilter, searchQuery]);

  const close = useCallback(() => {
    setOpen(false);
    setSearchQuery('');
    setCategoriaFilter(null);
  }, []);

  // Posiciona o painel via portal (fixed no viewport), recalculando ao abrir/rolar/redimensionar.
  // Evita o painel ficar preso/cortado dentro de containers com overflow (ex.: modal com scroll)
  // e inverte pra abrir pra cima quando não há espaço suficiente embaixo.
  useLayoutEffect(() => {
    if (!open) return undefined;

    const update = () => {
      const el = rootRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom - PANEL_MARGIN;
      const spaceAbove = rect.top - PANEL_MARGIN;
      const openUp = spaceBelow < PANEL_FLIP_THRESHOLD && spaceAbove > spaceBelow;
      const available = openUp ? spaceAbove : spaceBelow;
      // Nunca deixa a altura passar do espaço real disponível — do contrário o painel
      // vaza pra fora da tela quando o campo está perto do topo/rodapé do viewport.
      const maxHeight = Math.max(40, Math.min(PANEL_PREFERRED_HEIGHT, available));

      setPlacement({
        left: rect.left,
        width: rect.width,
        openUp,
        maxHeight,
        top: openUp ? undefined : rect.bottom + 4,
        bottom: openUp ? window.innerHeight - rect.top + 4 : undefined,
      });
    };

    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      const root = rootRef.current;
      const panel = panelRef.current;
      const insideRoot = root && root.contains(e.target);
      const insidePanel = panel && panel.contains(e.target);
      if (!insideRoot && !insidePanel) close();
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, close]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);

  const isModalVariant = variant === 'modal';

  const shellClass = isModalVariant
    ? `flex w-full min-h-[44px] items-stretch overflow-hidden rounded-lg border text-[14px] outline-none transition focus-within:border-[#00a88e] focus-within:ring-1 focus-within:ring-[#00a88e]/20 ${
        disabled
          ? 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400'
          : error
            ? 'border-red-300 bg-red-50/60 text-slate-900'
            : 'border-slate-200 bg-white text-slate-900'
      }`
    : `flex w-full min-h-[44px] items-stretch overflow-hidden rounded-xl border text-[14px] font-medium outline-none transition focus-within:ring-4 focus-within:ring-[#00a88e]/20 ${
        disabled
          ? 'cursor-not-allowed border-[#00a88e]/15 bg-slate-50 text-slate-400'
          : error
            ? 'border-red-400 bg-red-50 text-[#0f172a]'
            : 'border-[#00a88e]/30 bg-[#f8fbfb] text-[#0f172a] focus-within:border-[#00a88e]'
      }`;

  const mainBtnClass = isModalVariant
    ? 'flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5 text-left text-slate-900 outline-none'
    : 'flex min-w-0 flex-1 items-center gap-2 px-4 py-3 text-left text-[#0f172a] outline-none';

  const handleToggle = () => {
    if (disabled) return;
    setOpen((o) => !o);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    if (disabled) return;
    onChange?.(null);
    close();
  };

  const handlePick = (id) => {
    if (disabled) return;
    onChange?.(id);
    close();
  };

  const toggleCategoria = (cat) => {
    setCategoriaFilter((prev) => (prev === cat ? null : cat));
  };

  const listPanelClass = isModalVariant
    ? 'flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl'
    : 'flex flex-col overflow-hidden rounded-xl border-[2px] border-[#00a88e]/30 bg-white shadow-xl';

  return (
    <div ref={rootRef} className="relative">
      <div className={shellClass}>
        <button
          type="button"
          disabled={disabled}
          onClick={handleToggle}
          className={mainBtnClass}
          aria-expanded={open}
          aria-haspopup="listbox"
        >
          <span className={`min-w-0 flex-1 truncate ${displayLabel ? '' : isModalVariant ? 'text-slate-400' : 'text-slate-400'}`}>
            {displayLabel || placeholder}
          </span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-slate-500 transition ${open ? 'rotate-180' : ''}`}
            strokeWidth={2.25}
            aria-hidden
          />
        </button>
        {value ? (
          <button
            type="button"
            onClick={handleClear}
            disabled={disabled}
            className={`flex shrink-0 items-center border-l border-slate-200 px-2 transition hover:bg-[#e6f7f5] ${
              isModalVariant ? 'border-slate-200' : 'border-[#00a88e]/20'
            } ${disabled ? 'pointer-events-none opacity-40' : ''}`}
            aria-label="Limpar profissão"
          >
            <X className="h-4 w-4 text-slate-500" strokeWidth={2.25} />
          </button>
        ) : null}
      </div>

      {open && placement
        ? createPortal(
            <div
              ref={panelRef}
              className={listPanelClass}
              style={{
                position: 'fixed',
                left: placement.left,
                width: placement.width,
                top: placement.top,
                bottom: placement.bottom,
                maxHeight: placement.maxHeight,
                zIndex: 1000,
              }}
            >
              <div
                className={`shrink-0 border-b p-2 ${isModalVariant ? 'border-slate-100 bg-white' : 'border-[#00a88e]/15 bg-[#f8fbfb]'}`}
              >
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                    strokeWidth={2}
                    aria-hidden
                  />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar por nome..."
                    className={
                      isModalVariant
                        ? 'w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-[13px] text-slate-900 outline-none focus:border-[#00a88e] focus:ring-1 focus:ring-[#00a88e]/20'
                        : 'w-full rounded-lg border border-[#00a88e]/25 bg-white py-2.5 pl-9 pr-3 text-[13px] text-[#0f172a] outline-none focus:border-[#00a88e] focus:ring-2 focus:ring-[#00a88e]/20'
                    }
                    autoComplete="off"
                    autoFocus
                  />
                </div>
              </div>

              {categoriasOrdenadas.length > 0 ? (
                <div className="flex max-h-40 shrink-0 flex-wrap content-start gap-2 overflow-y-auto border-b border-slate-100 p-2.5">
                  {categoriasOrdenadas.map((cat) => {
                    const active = categoriaFilter === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => toggleCategoria(cat)}
                        title={cat}
                        className={`max-w-full rounded-full px-3 py-1.5 text-left text-[12px] font-semibold transition ${
                          active
                            ? 'bg-[#00a88e] text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-[#e6f7f5] hover:text-[#0f766e]'
                        }`}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              ) : null}

              <div className="min-h-0 flex-1 overflow-y-auto p-1">
                {loading ? (
                  <div className="px-3 py-6 text-center text-[13px] text-slate-500">Carregando profissoes...</div>
                ) : loadError ? (
                  <div className="px-3 py-6 text-center text-[13px] text-red-600">
                    Erro ao carregar profissoes. Tente recarregar a pagina
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="px-3 py-6 text-center text-[13px] text-slate-500">
                    Nenhuma profissao encontrada para os filtros
                  </div>
                ) : (
                  <ul role="listbox" className="space-y-0.5">
                    {filtered.map((p) => {
                      const selected = p.id === value;
                      return (
                        <li key={p.id}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={selected}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => handlePick(p.id)}
                            className={`flex w-full flex-col items-start rounded-lg px-3 py-2 text-left transition ${
                              selected ? 'bg-[#e6f7f5] ring-1 ring-[#00a88e]/30' : 'hover:bg-[#e6f7f5]'
                            }`}
                          >
                            <span className="text-[13px] font-semibold text-[#0f172a]">{p.nome}</span>
                            <span className="text-[11px] text-slate-500">
                              {(String(p.categoria ?? '').trim() || '—')}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
