import React, { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";
import PrototypeIcon from "./PrototypeIcon";
import { useFocoPreso } from "./useFocoPreso";

const pessoas = (n) => (n === 1 ? "1 pessoa" : `${n} pessoas`);

/**
 * Folha de filtros: lateral de 420 px (>= 768) ou folha de baixo (celular).
 * A lista atrás muda na hora; não há botão "aplicar". Nasce no body (portal).
 * `grupos`: [{ titulo, opcoes: [{ id, rotulo, n, marcado, onToggle }] }].
 */
export function FiltrosFolha({
  aberto,
  onFechar,
  retornoFocoRef,
  total,
  nFiltros,
  onLimpar,
  perfis = [],
  alcance,
  totalCatalogo,
  uso,
  perfisSelecionados = [],
  onPerfil,
  grupos = [],
}) {
  const [busca, setBusca] = useState("");
  const painelRef = useRef(null);
  useBodyScrollLock(aberto);
  useFocoPreso(painelRef, aberto, onFechar, retornoFocoRef);

  const { emUso, semUso } = useMemo(() => {
    const q = busca.trim().toLocaleLowerCase("pt-BR");
    const visiveis = perfis.filter(
      (p) => !q || String(p.nome).toLocaleLowerCase("pt-BR").includes(q),
    );
    return {
      emUso: visiveis.filter((p) => uso(p) > 0),
      semUso: visiveis.filter((p) => uso(p) === 0),
    };
  }, [perfis, busca, uso]);

  if (!aberto) return null;

  const linhaPerfil = (p) => {
    const marcado = perfisSelecionados.includes(String(p.id));
    const n = uso(p);
    return (
      <li key={p.id}>
        <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-slate-50 toque:min-h-[44px]">
          <input
            type="checkbox"
            className="h-4 w-4 shrink-0 accent-[#00a88e]"
            checked={marcado}
            onChange={(e) => onPerfil(String(p.id), e.target.checked)}
            aria-label={p.nome}
          />
          <span className="shrink-0 text-slate-500" aria-hidden="true">
            <PrototypeIcon name={p.codigo === "DONO" ? "crown" : "shield"} size="s" />
          </span>
          <span className="min-w-0 flex-1">
            <b className="block truncate text-sm text-slate-900">{p.nome}</b>
            <small className="block text-xs text-slate-500">
              {alcance(p)} de {totalCatalogo} funções
            </small>
          </span>
          <em className="shrink-0 text-xs not-italic text-slate-500">
            {n ? pessoas(n) : "ninguém"}
          </em>
        </label>
      </li>
    );
  };

  return createPortal(
    <div
      data-folha-filtros=""
      className="fixed inset-0 z-[70] flex items-end bg-slate-900/30 md:items-stretch md:justify-end"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onFechar();
      }}
    >
      <aside
        ref={painelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Filtrar pessoas"
        className="flex max-h-[88vh] w-full flex-col rounded-t-2xl bg-white shadow-2xl md:max-h-none md:w-[420px] md:max-w-full md:rounded-none"
      >
        <header className="flex shrink-0 items-start gap-3 border-b border-slate-200 px-5 py-4">
          <span className="shrink-0 text-[#00a88e]" aria-hidden="true">
            <PrototypeIcon name="filter" size="s" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-slate-900">Filtrar pessoas</h3>
            <p className="text-xs text-slate-500">A lista atrás muda na hora.</p>
          </div>
          <button
            type="button"
            data-foco-inicial=""
            onClick={onFechar}
            aria-label="Fechar filtros"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-600 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00a88e] toque:h-11 toque:w-11"
          >
            ✕
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-4">
          <section aria-label="Perfil de acesso">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Perfil de acesso
              </h4>
              {perfisSelecionados.length > 0 && (
                <button
                  type="button"
                  onClick={() => perfisSelecionados.forEach((id) => onPerfil(id, false))}
                  className="shrink-0 text-xs font-semibold text-[#00a88e] toque:min-h-[44px]"
                >
                  limpar ({perfisSelecionados.length})
                </button>
              )}
            </div>
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar perfil"
              aria-label="Buscar perfil"
              className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00a88e] toque:min-h-[44px] toque:text-base"
            />
            <ul className="m-0 list-none p-0">
              {emUso.map(linhaPerfil)}
              {semUso.length > 0 && !busca && (
                <li className="px-2 pb-1 pt-3 text-xs font-semibold text-slate-500">
                  Perfis que ninguém usa
                </li>
              )}
              {semUso.map(linhaPerfil)}
            </ul>
            {emUso.length + semUso.length === 0 && (
              <p className="text-sm text-slate-500">Nenhum perfil com “{busca}”.</p>
            )}
          </section>

          {grupos.map((g) => (
            <section key={g.titulo} aria-label={g.titulo}>
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                {g.titulo}
              </h4>
              <div className="space-y-1">
                {g.opcoes.map((o) => (
                  <label
                    key={o.id}
                    className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-slate-50 toque:min-h-[44px]"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 shrink-0 accent-[#00a88e]"
                      checked={o.marcado}
                      onChange={o.onToggle}
                      aria-label={o.rotulo}
                    />
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-900">
                      {o.rotulo}
                    </span>
                    <i className="shrink-0 text-xs not-italic text-slate-500">{o.n}</i>
                  </label>
                ))}
              </div>
            </section>
          ))}
        </div>

        <footer className="flex shrink-0 gap-2 border-t border-slate-200 px-5 py-3">
          <button
            type="button"
            onClick={onLimpar}
            disabled={!nFiltros}
            className="shrink-0 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40 toque:min-h-[44px]"
          >
            Limpar{nFiltros ? ` (${nFiltros})` : ""}
          </button>
          <button
            type="button"
            onClick={onFechar}
            className="min-w-0 flex-1 rounded-lg bg-[#00a88e] px-4 py-2 text-sm font-semibold text-white toque:min-h-[44px]"
          >
            {total ? `Ver ${pessoas(total)}` : "Ninguém com esses filtros"}
          </button>
        </footer>
      </aside>
    </div>,
    document.body,
  );
}
