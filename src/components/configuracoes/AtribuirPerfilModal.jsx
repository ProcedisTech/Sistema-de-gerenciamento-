import React, { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { menuParaFuncoes } from "../layout/navGrupos";
import PrototypeIcon from "./PrototypeIcon";
import { useFocoPreso } from "./useFocoPreso";
import {
  catalogFunctionTotal,
  profileFunctionCount,
  sortProfilesByHierarchy,
} from "./equipePrototypeUtils";

const semAgendaAparecer = (p) => p?.codigo !== "AGENDA_APARECER";
const primeiroNome = (p) =>
  String(p?.nomeCompleto || p?.usuarioNome || "a pessoa").trim().split(/\s+/)[0];

function Conteudo({ pessoa, perfis, permissionsByProfile, catalogo, onConfirmar, onFechar }) {
  const [escolhido, setEscolhido] = useState(null);
  const [gravando, setGravando] = useState(false);
  const painelRef = useRef(null);
  // Durante a gravação, Esc e clique fora não fecham (useFocoPreso relê o callback a cada render).
  const fecharSeLivre = () => {
    if (!gravando) onFechar();
  };
  useFocoPreso(painelRef, true, fecharSeLivre);

  const lista = useMemo(
    () =>
      sortProfilesByHierarchy(
        perfis.filter((p) => p.codigo !== "DONO"),
        permissionsByProfile,
        catalogo,
      ),
    [perfis, permissionsByProfile, catalogo],
  );
  const atual = perfis.find((p) => String(p.id) === String(pessoa?.perfilAcessoId));
  const novo = lista.find((p) => String(p.id) === String(escolhido));
  const nome = primeiroNome(pessoa);
  const total = catalogFunctionTotal(catalogo);
  const mesmo = Boolean(atual && novo && String(atual.id) === String(novo.id));

  const { ganha, perde, menu } = useMemo(() => {
    if (!novo) return { ganha: [], perde: [], menu: [] };
    const doPerfil = (p) => {
      const ids = new Set(permissionsByProfile?.[p?.id] || []);
      return (catalogo || []).filter((c) => semAgendaAparecer(c) && ids.has(c.permissaoId));
    };
    const antes = new Set(doPerfil(atual).map((c) => c.permissaoId));
    const depois = doPerfil(novo);
    const depoisIds = new Set(depois.map((c) => c.permissaoId));
    return {
      ganha: depois.filter((c) => !antes.has(c.permissaoId)),
      perde: doPerfil(atual).filter((c) => !depoisIds.has(c.permissaoId)),
      menu: menuParaFuncoes(
        (catalogo || [])
          .filter((c) => new Set(permissionsByProfile?.[novo.id] || []).has(c.permissaoId))
          .map((c) => c.codigo),
      ).flatMap((g) => g.itens),
    };
  }, [novo, atual, permissionsByProfile, catalogo]);

  const lista6 = (itens) => (
    <ul className="m-0 mt-1 flex list-none flex-wrap gap-1 p-0">
      {itens.slice(0, 6).map((c) => (
        <li key={c.permissaoId} className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
          {c.nome}
        </li>
      ))}
      {itens.length > 6 && (
        <li className="px-1 py-0.5 text-xs text-slate-500">e mais {itens.length - 6}</li>
      )}
    </ul>
  );

  return createPortal(
    <div
      className="fixed inset-0 z-[80] grid place-items-center bg-slate-900/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) fecharSeLivre();
      }}
    >
      <div
        ref={painelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="atribuirPerfilTitulo"
        className="flex max-h-[90vh] w-full max-w-[560px] flex-col rounded-2xl bg-white shadow-2xl"
      >
        <header className="shrink-0 border-b border-slate-200 px-5 py-4">
          <h3 id="atribuirPerfilTitulo" className="text-base font-semibold text-slate-900">
            {atual ? `Trocar o perfil de ${nome}` : `Atribuir perfil a ${nome}`}
          </h3>
          <p className="text-xs text-slate-500">
            {atual
              ? `Hoje: ${atual.nome}`
              : "Sem perfil, a pessoa não consegue entrar em nenhuma área."}
          </p>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div role="radiogroup" aria-label="Perfis, do maior para o menor acesso" className="space-y-1">
            {lista.map((p, i) => (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={String(escolhido) === String(p.id)}
                data-foco-inicial={i === 0 ? "" : undefined}
                onClick={() => setEscolhido(String(p.id))}
                className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left toque:min-h-[44px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00a88e] ${
                  String(escolhido) === String(p.id)
                    ? "border-[#00a88e] bg-[#00a88e]/10"
                    : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                <span className="shrink-0 text-slate-500" aria-hidden="true">
                  <PrototypeIcon name="shield" size="s" />
                </span>
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-sm text-slate-900">{p.nome}</b>
                  <small className="block text-xs text-slate-500">
                    {profileFunctionCount(permissionsByProfile?.[p.id], catalogo)} de {total} funções
                  </small>
                </span>
                {atual && String(atual.id) === String(p.id) && (
                  <em className="shrink-0 text-xs not-italic text-slate-500">atual</em>
                )}
              </button>
            ))}
          </div>

          <section aria-label={`O que muda para ${nome}`}>
            <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">
              O que muda para {nome}
            </h4>
            {!novo && <p className="mt-1 text-sm text-slate-500">Escolha um perfil para ver o que muda.</p>}
            {mesmo && <p className="mt-1 text-sm text-slate-500">É o perfil que a pessoa já tem.</p>}
            {novo && !mesmo && (
              <div className="mt-1 space-y-2">
                {ganha.length > 0 && (
                  <div>
                    <b className="text-sm text-emerald-700">Passa a poder ({ganha.length})</b>
                    {lista6(ganha)}
                  </div>
                )}
                {perde.length > 0 && (
                  <div>
                    <b className="text-sm text-rose-700">Deixa de poder ({perde.length})</b>
                    {lista6(perde)}
                  </div>
                )}
                <div>
                  <b className="text-sm text-slate-900">O menu de {nome}</b>
                  <ul className="m-0 mt-1 flex list-none flex-wrap gap-1 p-0">
                    {menu.length ? (
                      menu.map((it) => (
                        <li
                          key={it.view}
                          className="flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
                        >
                          <it.icon size={14} className="shrink-0" aria-hidden="true" />
                          {it.label}
                        </li>
                      ))
                    ) : (
                      <li className="text-xs text-slate-500">nenhuma área</li>
                    )}
                  </ul>
                </div>
              </div>
            )}
          </section>
        </div>

        <footer className="flex shrink-0 justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <button
            type="button"
            onClick={onFechar}
            disabled={gravando}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40 toque:min-h-[44px]"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!novo || mesmo || gravando}
            onClick={async () => {
              setGravando(true);
              try {
                await onConfirmar(novo.id);
              } finally {
                setGravando(false);
              }
            }}
            className="rounded-lg bg-[#00a88e] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40 toque:min-h-[44px]"
          >
            {atual ? "Trocar perfil" : "Atribuir perfil"}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

/** Escolher o perfil de uma pessoa mostrando antes o que muda. Também serve à página da pessoa. */
export function AtribuirPerfilModal({ aberto, ...resto }) {
  return aberto && resto.pessoa ? <Conteudo key={resto.pessoa.id} {...resto} /> : null;
}
