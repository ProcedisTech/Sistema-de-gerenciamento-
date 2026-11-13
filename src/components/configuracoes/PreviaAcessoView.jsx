import React, { useMemo } from "react";
import { menuParaFuncoes } from "../layout/navGrupos";
import { catalogFunctionTotal, profileFunctionCount, summarizeModules } from "./equipePrototypeUtils";

const BOTOES_TOPO = [
  ["Agendamento", "AGENDA_CRIAR"],
  ["Novo Paciente", "PACIENTE_CRIAR"],
  ["Consulta", "ATENDIMENTO_REALIZAR"],
  ["Notificações", "NOTIFICACAO_VER"],
];

function Linha({ ok, children }) {
  return (
    <li className="flex items-center gap-2 py-0.5 text-sm">
      <span aria-hidden="true">{ok ? "✓" : "✕"}</span>
      <span className="sr-only">{ok ? "Tem:" : "Não tem:"}</span>
      {children}
    </li>
  );
}

/** Tela de prévia: o Procedi como a pessoa enxerga. Só leitura, nada aqui muda o acesso dela. */
export default function PreviaAcessoView({ nome, perfil, codigos = [], catalogo = [] }) {
  const set = useMemo(() => new Set(codigos), [codigos]);
  const itensMenu = useMemo(() => menuParaFuncoes(codigos).flatMap((g) => g.itens), [codigos]);
  const modulos = useMemo(() => {
    const ids = catalogo.filter((c) => set.has(c.codigo)).map((c) => c.permissaoId);
    return { ids, lista: summarizeModules(catalogo, ids) };
  }, [catalogo, set]);
  const total = catalogFunctionTotal(catalogo);
  const com = modulos.lista.filter((m) => m.k !== "0");
  const sem = modulos.lista.filter((m) => m.k === "0");
  return (
    <div className="box" data-testid="previa-acesso">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 style={{ margin: 0 }}>O Procedi de {nome}</h3>
          <p className="m-0 text-xs text-slate-500">
            {perfil} · {profileFunctionCount(modulos.ids, catalogo)} de {total} funções. Nada aqui muda o acesso da pessoa.
          </p>
        </div>
      </div>
      <div className="g2 mt-3">
        <div className="box">
          <h4>No menu</h4>
          <ul className="m-0 list-none p-0">
            {itensMenu.map((it) => (
              <Linha key={it.view} ok>
                {it.label}
              </Linha>
            ))}
          </ul>
        </div>
        <div className="box">
          <h4>Botões do topo</h4>
          <ul className="m-0 list-none p-0">
            {BOTOES_TOPO.map(([n, c]) => (
              <Linha key={c} ok={set.has(c)}>
                {n}
              </Linha>
            ))}
          </ul>
        </div>
        <div className="box">
          <h4>Não aparece para {nome}</h4>
          {sem.length ? (
            <ul className="m-0 list-none p-0">
              {sem.map((m) => (
                <li key={m.key} className="py-0.5 text-sm">{m.name}</li>
              ))}
            </ul>
          ) : (
            <p className="m-0 text-xs text-slate-500">Vê todas as áreas.</p>
          )}
        </div>
      </div>
      <div className="mt-3 grid gap-3">
        {com.map((m) => (
          <div className="box" key={m.key} data-testid={`previa-area-${m.key}`}>
            <h4>
              {m.name}
              <small>
                {" "}
                <b>{m.t}</b> · {m.has} de {m.tot}
              </small>
            </h4>
            <ul className="m-0 list-none p-0">
              {m.permissions.map((p) => (
                <Linha key={p.permissaoId} ok={m.selected.includes(p)}>
                  {p.nome}
                </Linha>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
