import React, { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Users, Search, X, Loader2, Check, AlertCircle } from "lucide-react";
import { equipeApi, getApiErrorToastMessage } from "../../services/api";
import { useToast } from "../../contexts/useToast.js";
import { perfilFotoDisplaySrc } from "../layout/identityDisplay";
import { initialsFromName } from "../../utils/agendaAvatarUtils";
import "./equipePrototypeBase.css";
import "./gestaoEquipe.css";

export function VincularMembrosAoPerfilModal({
  isOpen,
  onClose,
  selectedProfile,
  usuarios = [],
  perfisAcesso = [],
  onSuccess,
}) {
  const toast = useToast();
  const [busca, setBusca] = useState("");
  const [selecionados, setSelecionados] = useState(new Set());
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const dialogRef = useRef(null);

  // Fecha no Esc
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && !salvando) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, salvando]);

  // Foco no diálogo
  useEffect(() => {
    if (isOpen) {
      dialogRef.current?.focus();
    }
  }, [isOpen]);

  const nameOf = (u) => u?.nomeCompleto || u?.usuarioNome || "Pessoa sem nome";

  // Membros elegíveis: ativos e que NÃO são DONO
  const membrosElegiveis = useMemo(() => {
    return usuarios.filter(
      (u) => u.perfilAcessoCodigo !== "DONO" && u.ativo !== false,
    );
  }, [usuarios]);

  // Mapa de perfil por ID
  const perfilMap = useMemo(() => {
    const map = new Map();
    perfisAcesso.forEach((p) => map.set(p.id, p.nome));
    return map;
  }, [perfisAcesso]);

  // Filtro de busca
  const membrosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const lista = membrosElegiveis.filter((u) => {
      if (!termo) return true;
      const nome = nameOf(u).toLowerCase();
      const email = (u.email || "").toLowerCase();
      const perfilAtual = (perfilMap.get(u.perfilAcessoId) || "").toLowerCase();
      return (
        nome.includes(termo) || email.includes(termo) || perfilAtual.includes(termo)
      );
    });

    // Ordenação: disponíveis para vincular primeiro, depois já vinculados; ambos alfabéticos
    return lista.sort((a, b) => {
      const aJaTem = a.perfilAcessoId === selectedProfile?.id;
      const bJaTem = b.perfilAcessoId === selectedProfile?.id;
      if (aJaTem !== bJaTem) {
        return aJaTem ? 1 : -1;
      }
      return nameOf(a).localeCompare(nameOf(b), "pt-BR");
    });
  }, [membrosElegiveis, busca, selectedProfile?.id, perfilMap]);

  // Colaboradores que podem ser selecionados na busca atual
  const disponiveisNaBusca = useMemo(() => {
    return membrosFiltrados.filter(
      (u) => u.perfilAcessoId !== selectedProfile?.id,
    );
  }, [membrosFiltrados, selectedProfile?.id]);

  const totalJaVinculados = useMemo(() => {
    return membrosElegiveis.filter(
      (u) => u.perfilAcessoId === selectedProfile?.id,
    ).length;
  }, [membrosElegiveis, selectedProfile?.id]);

  const toggleSelecionado = (userId) => {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const selecionarTodosVisiveis = () => {
    setSelecionados((prev) => {
      const next = new Set(prev);
      const todosJaMarcados = disponiveisNaBusca.every((u) => next.has(u.id));
      if (todosJaMarcados) {
        disponiveisNaBusca.forEach((u) => next.delete(u.id));
      } else {
        disponiveisNaBusca.forEach((u) => next.add(u.id));
      }
      return next;
    });
  };

  const handleSalvar = async () => {
    if (selecionados.size === 0 || salvando || !selectedProfile) return;
    setSalvando(true);
    setErro("");

    const idsParaMigrar = Array.from(selecionados);
    const errosDetalhados = [];
    let sucessos = 0;

    for (const userId of idsParaMigrar) {
      const u = usuarios.find((x) => x.id === userId);
      if (!u) continue;
      try {
        await equipeApi.update(u.id, {
          ...u,
          apareceNaAgenda: undefined,
          agendaMultiVer: undefined,
          nomeCompleto: nameOf(u),
          perfilAcessoId: selectedProfile.id,
        });
        sucessos += 1;
      } catch (err) {
        errosDetalhados.push(
          `${nameOf(u)}: ${getApiErrorToastMessage(err, "Falha ao vincular")}`,
        );
      }
    }

    setSalvando(false);

    if (sucessos > 0) {
      toast.success(
        sucessos === 1
          ? `1 colaborador vinculado a ${selectedProfile.nome} com sucesso.`
          : `${sucessos} colaboradores vinculados a ${selectedProfile.nome} com sucesso.`,
      );
      onSuccess?.();
      onClose();
    } else if (errosDetalhados.length > 0) {
      setErro(errosDetalhados[0]);
    }
  };

  if (!isOpen || !selectedProfile) return null;

  const todosDisponiveisMarcados =
    disponiveisNaBusca.length > 0 &&
    disponiveisNaBusca.every((u) => selecionados.has(u.id));

  return createPortal(
    <div className="prototype-equipe">
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4 overflow-hidden">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-slate-900/40 pointer-events-auto transition-opacity modal-backdrop-animate"
          onClick={salvando ? undefined : onClose}
        />

        {/* Modal Card */}
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="vincular-membros-title"
          aria-describedby="vincular-membros-desc"
          tabIndex={-1}
          className="modal-card vincular-membros-modal relative z-10 mx-auto flex max-h-[90vh] w-full max-w-[560px] flex-col overflow-hidden bg-white outline-none rounded-2xl shadow-2xl border border-slate-200"
        >
          {/* Header */}
          <div className="decisao-modal-head px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-3 bg-white">
            <div className="flex items-start gap-3 min-w-0">
              <div
                className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-100 text-[#00a88e] flex items-center justify-center shrink-0"
                aria-hidden="true"
              >
                <Users className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3
                  id="vincular-membros-title"
                  className="text-base font-bold text-slate-800 leading-snug truncate"
                >
                  Adicionar Membros ao Perfil
                </h3>
                <p
                  id="vincular-membros-desc"
                  className="text-xs text-slate-500 mt-0.5"
                >
                  Vincular colaboradores ao perfil{" "}
                  <strong className="text-slate-700 font-semibold">
                    {selectedProfile.nome}
                  </strong>
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={salvando}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
              aria-label="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 flex flex-col gap-3 overflow-hidden flex-1 bg-white">
            {/* Aviso Contextual */}
            <div className="p-3 bg-teal-50/60 border border-teal-100 rounded-xl text-xs text-teal-800 flex items-center justify-between gap-2">
              <span>
                Colaboradores vinculados assumirão todas as permissões deste
                perfil.
              </span>
              {totalJaVinculados > 0 && (
                <span className="shrink-0 font-medium bg-teal-100/70 text-teal-900 px-2 py-0.5 rounded-full text-[11px]">
                  {totalJaVinculados} já no perfil
                </span>
              )}
            </div>

            {/* Barra de Pesquisa & Selecionar Todos */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search
                  className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar por nome, e-mail ou perfil..."
                  className="w-full h-9 pl-9 pr-8 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00a88e]/20 focus:border-[#00a88e] transition-all"
                />
                {busca && (
                  <button
                    type="button"
                    onClick={() => setBusca("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    aria-label="Limpar busca"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {disponiveisNaBusca.length > 0 && (
                <button
                  type="button"
                  onClick={selecionarTodosVisiveis}
                  className="h-9 px-3 text-[11px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200/80 rounded-lg transition-colors shrink-0"
                >
                  {todosDisponiveisMarcados ? "Desmarcar todos" : "Marcar todos"}
                </button>
              )}
            </div>

            {erro && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                <span>{erro}</span>
              </div>
            )}

            {/* Lista com Scroll */}
            <div
              className="flex-1 overflow-y-auto max-h-[360px] border border-slate-100 rounded-xl divide-y divide-slate-100 vincular-membros-lista"
              role="list"
              aria-label="Lista de colaboradores elegíveis"
            >
              {membrosFiltrados.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-1.5">
                  <Users className="w-8 h-8 text-slate-300 stroke-1" />
                  <p className="font-medium text-slate-600">
                    Nenhum colaborador encontrado
                  </p>
                  <p>Tente buscar por outro termo.</p>
                </div>
              ) : (
                membrosFiltrados.map((u) => {
                  const jaVinculado = u.perfilAcessoId === selectedProfile.id;
                  const isChecked = jaVinculado || selecionados.has(u.id);
                  const perfilAtualNome =
                    perfilMap.get(u.perfilAcessoId) || "Sem perfil";

                  return (
                    <label
                      key={u.id}
                      className={`flex items-center gap-3 p-3 transition-colors ${
                        jaVinculado
                          ? "bg-slate-50/70 cursor-not-allowed opacity-75"
                          : "hover:bg-slate-50/80 cursor-pointer"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={jaVinculado || salvando}
                        onChange={() => toggleSelecionado(u.id)}
                        className="w-4 h-4 rounded border-slate-300 text-[#00a88e] focus:ring-[#00a88e]/30 cursor-pointer disabled:cursor-not-allowed"
                        aria-label={`Selecionar ${nameOf(u)}`}
                      />

                      {/* Avatar */}
                      <span className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                        {u.fotoUrl ? (
                          <img
                            src={perfilFotoDisplaySrc(u.fotoUrl)}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          initialsFromName(nameOf(u))
                        )}
                      </span>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-800 truncate">
                            {nameOf(u)}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 truncate block">
                          {u.email || "Sem e-mail cadastrado"}
                        </span>
                      </div>

                      {/* Status / Perfil Atual */}
                      <div className="shrink-0 text-right">
                        {jaVinculado ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-700 bg-teal-50 border border-teal-200/60 px-2 py-0.5 rounded-full">
                            <Check className="w-3 h-3 text-[#00a88e]" />
                            Já vinculado
                          </span>
                        ) : (
                          <span className="inline-block text-[11px] text-slate-500 bg-slate-100 border border-slate-200/80 px-2 py-0.5 rounded-full">
                            {perfilAtualNome}
                          </span>
                        )}
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="decisao-modal-foot px-5 py-3.5 border-t border-slate-100 flex items-center justify-between gap-3 bg-slate-50/70">
            <span className="text-xs text-slate-500">
              {selecionados.size > 0 ? (
                <strong className="text-[#00a88e] font-semibold">
                  {selecionados.size} selecionado{selecionados.size > 1 ? "s" : ""}
                </strong>
              ) : (
                "Nenhum novo membro selecionado"
              )}
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={salvando}
                className="decisao-btn-cancel"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSalvar}
                disabled={selecionados.size === 0 || salvando}
                className="decisao-btn-confirm"
                style={{
                  background:
                    selecionados.size === 0 || salvando
                      ? "#94a3b8"
                      : "#00a88e",
                  cursor:
                    selecionados.size === 0 || salvando
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                {salvando ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                    Salvando...
                  </>
                ) : selecionados.size > 0 ? (
                  `Adicionar ${selecionados.size} colaborador${selecionados.size > 1 ? "es" : ""}`
                ) : (
                  "Adicionar ao perfil"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

