import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Shield, X, Lock, Users, Loader2, AlertTriangle } from "lucide-react";
import { resolveApiUrl } from "../../config/apiEnv";
import { getApiErrorDetail } from "../../services/api";
import { useToast } from "../../contexts/useToast.js";
import {
  PRESETS_PERFIS,
  summarizeModules,
  PROTOTYPE_OPERATIONAL_CODES as OPERACIONAIS,
  generateUniqueProfileName,
  isProfileNameDuplicate,
} from "./equipePrototypeUtils";
import { PrototypeIcon } from "./PrototypeIcon";
import "./gestaoPerfilEditor.css";
import "./equipePessoa.css";

const RAIZES = new Set([
  "AGENDA_VER",
  "AGENDA_PROPRIA_VER",
  "PACIENTE_VER",
  "PRONTUARIO_VER",
  "ATENDIMENTO_REALIZAR",
  "CATALOGO_VER",
  "CLINICA_DADOS_VER",
  "DOC_MODELO_VER",
  "ANAMNESE_MODELO_VER",
  "ACESSO_CONFIGURACOES_VER",
  "USUARIO_VER",
  "NOTIFICACAO_VER",
  "AUDITORIA_VER",
]);
// Permissões operacionais do nível intermediário. Permissões administrativas e
// destrutivas só entram em Tudo ou pela escolha explícita de funções.

const ehGlobal = (perfil) =>
  Boolean(
    perfil &&
      !perfil.organizacaoSaudeDona &&
      !perfil.organizacaoSaudeDonaId &&
      !perfil.organizacaoSaudeId,
  );

const ehPadrao = (perfil) =>
  Boolean(perfil?.codigo && !perfil.codigo.startsWith("CST_"));

const getNomeCanonicaPerfil = (perfil) => {
  const cod = (perfil?.codigo || "").toUpperCase();
  if (cod === "SECRETARIA" || cod === "NIVEL_2") return "Recepção / Secretária";
  if (cod === "PROFISSIONAL_CLINICO" || cod === "NIVEL_3" || cod === "NIVEL_4")
    return "Profissional Clínico";
  if (cod === "ADMINISTRADOR" || cod === "NIVEL_5") return "Administrador";
  if (cod === "APOIO" || cod === "NIVEL_1") return "Apoio / Auxiliar";
  if (cod === "DONO") return "Dono";
  if (cod === "SOCIO") return "Sócio";
  return perfil?.nome || "";
};

const etiquetasNivel = {
  0: "Sem acesso",
  1: "Só ver",
  2: "Ver e editar",
  3: "Tudo",
};

function nivelModulo(modulo, selecionadas) {
  const summary = summarizeModules(modulo.permissoes, selecionadas).find(
    (m) => m.key === modulo.key.toLowerCase(),
  );
  return {
    key: summary.k,
    text: summary.t,
    has: summary.has,
    total: summary.tot,
  };
}

export function GestaoPerfisTab({
  perfisAcesso = [],
  permissoes = [],
  usuarios = [],
  onReload,
  fetchHeaders,
  perfilParaAbrir,
  onPerfilParaAbrirConsumido,
  criarNovoNonce = 0,
  canEdit = false,
  onBack,
  onSaved,
}) {
  const toast = useToast();
  const [editingPerfil, setEditingPerfil] = useState(null);
  const [formData, setFormData] = useState({ nome: "", descricao: "" });
  const [selectedPermissoes, setSelectedPermissoes] = useState([]);
  const [baseSelecionada, setBaseSelecionada] = useState("branco");
  const [abertos, setAbertos] = useState({});
  const [saving, setSaving] = useState(false);
  const [loadingPermissoes, setLoadingPermissoes] = useState(false);
  const [erroPermissoes, setErroPermissoes] = useState(false);
  const [modeloSemPermissoes, setModeloSemPermissoes] = useState(false);
  const [confirmacaoDesativarRaiz, setConfirmacaoDesativarRaiz] = useState(null);
  const [showDecisaoModal, setShowDecisaoModal] = useState(false);
  const [decisaoTipo, setDecisaoTipo] = useState("existente");
  const [decisaoNomePerfil, setDecisaoNomePerfil] = useState("");
  const [decisaoDescPerfil, setDecisaoDescPerfil] = useState("");
  const recemCriadoIdRef = useRef(null);
  const requestId = useRef(0);

  useEffect(() => {
    if (!confirmacaoDesativarRaiz && !showDecisaoModal) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setConfirmacaoDesativarRaiz(null);
        setShowDecisaoModal(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [confirmacaoDesativarRaiz, showDecisaoModal]);

  const modulos = summarizeModules(permissoes, selectedPermissoes)
    .filter((m) => m.permissions.length > 0)
    .map((m) => ({
      key: m.key.toUpperCase(),
      nome: m.name,
      icon: m.icon,
      descricao: m.description,
      permissoes: m.permissions,
      raizes: m.permissions.filter((p) => RAIZES.has(p.codigo)),
      funcoes: m.permissions,
    }));
  const agendaPermissao = permissoes.find(
    (p) => p.codigo === "AGENDA_APARECER",
  );
  const ag = Boolean(
    agendaPermissao && selectedPermissoes.includes(agendaPermissao.permissaoId),
  );
  const funcoesCatalogo = permissoes.filter(
    (p) => p.codigo !== "AGENDA_APARECER",
  );
  const selectedFuncoesCount = selectedPermissoes.filter(
    (id) => !agendaPermissao || id !== agendaPermissao.permissaoId,
  ).length;
  const membros = editingPerfil
    ? usuarios.filter(
        (u) =>
          String(u.perfilAcessoId) === String(editingPerfil.id) &&
          u.ativo !== false,
      )
    : [];

  const isNomeDuplicado = React.useMemo(() => {
    if (decisaoTipo !== "novo") return false;
    return isProfileNameDuplicate(decisaoNomePerfil, perfisAcesso);
  }, [decisaoTipo, decisaoNomePerfil, perfisAcesso]);

  const isMainNomeDuplicado = React.useMemo(() => {
    if (!formData.nome?.trim()) return false;
    if (editingPerfil && ehPadrao(editingPerfil)) return false;
    return isProfileNameDuplicate(formData.nome, perfisAcesso, editingPerfil?.id);
  }, [formData.nome, perfisAcesso, editingPerfil]);
  const disponiveis = perfisAcesso.filter(
    (p) => (p.codigo || "").toUpperCase() !== "DONO",
  );
  const profissionalBase = disponiveis.find(
    (p) => (p.codigo || "").toUpperCase() === "PROFISSIONAL_CLINICO",
  );
  const recepcaoBase = disponiveis.find((p) =>
    /^(SECRETARIA|NIVEL_2)$/.test((p.codigo || "").toUpperCase()),
  );
  const administradorBase = disponiveis.find((p) =>
    /^(ADMINISTRADOR|NIVEL_5)$/.test((p.codigo || "").toUpperCase()),
  );
  const apoioBase = disponiveis.find((p) =>
    /^(APOIO|NIVEL_1)$/.test((p.codigo || "").toUpperCase()),
  );
  const bases = [
    profissionalBase,
    recepcaoBase,
    administradorBase,
    apoioBase,
  ].filter(Boolean);

  const buscarPermissoes = async (perfil) => {
    const id = ++requestId.current;
    setLoadingPermissoes(true);
    setErroPermissoes(false);
    setModeloSemPermissoes(false);
    try {
      const res = await fetch(
        resolveApiUrl(`/api/v1/perfis-acesso/${perfil.id}/permissoes`),
        { headers: await fetchHeaders(), credentials: "include" },
      );
      if (!res.ok) throw new Error("permission-read");
      const ids = await res.json();
      if (!Array.isArray(ids)) throw new Error("permission-shape");
      if (id === requestId.current && ehGlobal(perfil) && ids.length === 0) {
        setModeloSemPermissoes(true);
        setErroPermissoes(true);
        return;
      }
      if (id === requestId.current) {
        if (
          agendaPermissao &&
          ((perfil.codigo || "").toUpperCase() === "PROFISSIONAL_CLINICO" ||
            perfil.apareceNaAgenda === true ||
            /profissional/i.test(perfil.nome || ""))
        ) {
          if (!ids.includes(agendaPermissao.permissaoId)) {
            ids.push(agendaPermissao.permissaoId);
          }
        }
        setSelectedPermissoes(ids);
      }
    } catch {
      if (id === requestId.current) {
        setErroPermissoes(true);
        toast.error(
          "Erro ao buscar permissões do perfil. Tente abrir o perfil novamente.",
        );
      }
    } finally {
      if (id === requestId.current) setLoadingPermissoes(false);
    }
  };

  useEffect(() => {
    if (!canEdit || !perfilParaAbrir) return;
    const copy = String(perfilParaAbrir).startsWith("copy:");
    const id = copy
      ? String(perfilParaAbrir).slice(5)
      : String(perfilParaAbrir);
    const perfil = perfisAcesso.find((p) => String(p.id) === id);
    if (!perfil) return;
    if ((perfil.codigo || "").toUpperCase() === "DONO") {
      onPerfilParaAbrirConsumido?.();
      return;
    }
    const criar = copy || ehGlobal(perfil);
    setEditingPerfil(criar ? null : perfil);
    setFormData({
      nome: criar
        ? `Cópia de ${perfil.nome}`
        : ehPadrao(perfil)
          ? getNomeCanonicaPerfil(perfil)
          : perfil.nome || "",
      descricao: perfil.descricao || "",
    });
    setBaseSelecionada(criar ? String(perfil.id) : "");
    setSelectedPermissoes([]);
    setAbertos({});
    buscarPermissoes(perfil);
    onPerfilParaAbrirConsumido?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfilParaAbrir, canEdit]);

  useEffect(() => {
    if (!canEdit || criarNovoNonce <= 0 || perfilParaAbrir) return;
    ++requestId.current;
    setEditingPerfil(null);
    setFormData({ nome: "", descricao: "" });
    setSelectedPermissoes([]);
    setBaseSelecionada("branco");
    setAbertos({});
    setLoadingPermissoes(false);
    setErroPermissoes(false);
    setModeloSemPermissoes(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [criarNovoNonce, canEdit]);

  const usarBase = (perfil) => {
    if (!canEdit || saving) return;
    setBaseSelecionada(perfil ? String(perfil.id) : "branco");
    if (perfil) {
      buscarPermissoes(perfil);
      if (
        agendaPermissao &&
        ((perfil.codigo || "").toUpperCase() === "PROFISSIONAL_CLINICO" ||
          perfil.apareceNaAgenda === true ||
          /profissional/i.test(perfil.nome || ""))
      ) {
        setSelectedPermissoes((prev) =>
          prev.includes(agendaPermissao.permissaoId)
            ? prev
            : [...prev, agendaPermissao.permissaoId],
        );
      }
    } else {
      ++requestId.current;
      setSelectedPermissoes([]);
      setLoadingPermissoes(false);
      setErroPermissoes(false);
      setModeloSemPermissoes(false);
    }
  };

  const aplicarPreset = (key) => {
    if (!canEdit || saving || loadingPermissoes) return;
    setBaseSelecionada(key);
    if (key === "BRANCO" || key === "branco") {
      ++requestId.current;
      setSelectedPermissoes([]);
      setLoadingPermissoes(false);
      setErroPermissoes(false);
      setModeloSemPermissoes(false);
      return;
    }
    const preset = PRESETS_PERFIS[key];
    if (!preset) return;

    const codigosSet = new Set(preset.codigos);
    const ids = permissoes
      .filter((p) => codigosSet.has(p.codigo))
      .map((p) => p.permissaoId);

    if (
      agendaPermissao &&
      (key === "PROFISSIONAL_CLINICO" || key === "MEDICO" || key === "BIOMEDICO" || codigosSet.has("AGENDA_APARECER"))
    ) {
      if (!ids.includes(agendaPermissao.permissaoId)) {
        ids.push(agendaPermissao.permissaoId);
      }
    } else if (agendaPermissao && !codigosSet.has("AGENDA_APARECER")) {
      const idx = ids.indexOf(agendaPermissao.permissaoId);
      if (idx !== -1) ids.splice(idx, 1);
    }

    setSelectedPermissoes(ids);
    setLoadingPermissoes(false);
    setErroPermissoes(false);
    setModeloSemPermissoes(false);
  };

  const aplicarNivel = (modulo, key) => {
    if (!canEdit || loadingPermissoes || saving) return;
    const idsModulo = [
      ...modulo.permissoes.map((p) => p.permissaoId),
      ...(modulo.key === "AGENDA" && key === "0" && agendaPermissao
        ? [agendaPermissao.permissaoId]
        : []),
    ];
    const selecionadas = [
      ...modulo.raizes,
      ...(key === "3"
        ? modulo.funcoes
        : key === "2"
          ? modulo.funcoes.filter(
              (p) => OPERACIONAIS.has(p.codigo) || RAIZES.has(p.codigo),
            )
          : []),
    ].map((p) => p.permissaoId);
    setSelectedPermissoes((prev) => [
      ...new Set([
        ...prev.filter(
          (id) =>
            !idsModulo.includes(id) ||
            (key !== "0" && id === agendaPermissao?.permissaoId),
        ),
        ...(key === "0" ? [] : selecionadas),
      ]),
    ]);
  };
  const mudarFuncao = (modulo, permissao, checked) => {
    if (!canEdit || loadingPermissoes || saving) return;

    const isRaiz = RAIZES.has(permissao.codigo);

    if (!checked && isRaiz) {
      const dependentesAtivas = modulo.funcoes.filter(
        (p) =>
          !RAIZES.has(p.codigo) && selectedPermissoes.includes(p.permissaoId),
      );

      if (dependentesAtivas.length > 0) {
        setConfirmacaoDesativarRaiz({
          modulo,
          permissao,
          dependentes: dependentesAtivas,
        });
        return;
      }
    }

    setSelectedPermissoes((prev) =>
      checked
        ? [
            ...new Set([
              ...prev,
              permissao.permissaoId,
              ...modulo.raizes.map((p) => p.permissaoId),
            ]),
          ]
        : prev.filter((id) => id !== permissao.permissaoId),
    );
  };

  const confirmarDesativacaoRaiz = () => {
    if (!confirmacaoDesativarRaiz) return;
    const { permissao, dependentes } = confirmacaoDesativarRaiz;
    const idsParaRemover = new Set([
      permissao.permissaoId,
      ...dependentes.map((p) => p.permissaoId),
    ]);
    setSelectedPermissoes((prev) =>
      prev.filter((id) => !idsParaRemover.has(id)),
    );
    setConfirmacaoDesativarRaiz(null);
  };
  const mudarAgenda = (atende) => {
    if (!canEdit || !agendaPermissao || loadingPermissoes || saving) return;
    const raizes = modulos.find((m) => m.key === "AGENDA")?.raizes || [];
    setSelectedPermissoes((prev) =>
      atende
        ? [
            ...new Set([
              ...prev,
              agendaPermissao.permissaoId,
              ...raizes.map((p) => p.permissaoId),
            ]),
          ]
        : prev.filter((id) => id !== agendaPermissao.permissaoId),
    );
  };

  const salvarPerfil = (event) => {
    event?.preventDefault();
    if (!canEdit || saving || loadingPermissoes || erroPermissoes) return;
    if (!formData.nome.trim()) {
      toast.error("O nome do perfil é obrigatório.");
      return;
    }

    if (editingPerfil && recemCriadoIdRef.current !== editingPerfil.id) {
      const isPadraoOuGlobal = ehGlobal(editingPerfil) || ehPadrao(editingPerfil);
      setDecisaoTipo(isPadraoOuGlobal ? "novo" : "existente");
      const nomeBase = isPadraoOuGlobal
        ? getNomeCanonicaPerfil(editingPerfil)
        : (formData.nome || getNomeCanonicaPerfil(editingPerfil)).trim();
      setDecisaoNomePerfil(generateUniqueProfileName(nomeBase, perfisAcesso));
      setDecisaoDescPerfil(formData.descricao || "");
      setShowDecisaoModal(true);
      return;
    }

    if (isProfileNameDuplicate(formData.nome, perfisAcesso, editingPerfil?.id)) {
      toast.error("Já existe um perfil com este nome nesta clínica.");
      return;
    }

    executarSalvarPerfil({ tipo: editingPerfil ? "existente" : "novo" });
  };

  const executarSalvarPerfil = async ({ tipo, nomeCustom, descCustom } = {}) => {
    setSaving(true);
    try {
      if (tipo === "existente" && editingPerfil) {
        if (
          ehGlobal(editingPerfil) ||
          (editingPerfil.codigo || "").toUpperCase() === "DONO"
        ) {
          toast.error("Modelos padrão do sistema são protegidos e não podem ser sobrescritos.");
          setSaving(false);
          return;
        }

        const payload = {
          ...formData,
          nome: ehPadrao(editingPerfil)
            ? getNomeCanonicaPerfil(editingPerfil)
            : (nomeCustom || formData.nome).trim(),
          descricao: descCustom !== undefined ? descCustom : formData.descricao,
        };

        const res = await fetch(
          resolveApiUrl(`/api/v1/perfis-acesso/${editingPerfil.id}`),
          {
            method: "PUT",
            headers: {
              ...(await fetchHeaders()),
              "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify(payload),
          },
        );

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          toast.error(getApiErrorDetail({ body }) || "Erro ao salvar perfil.");
          return;
        }

        const perfilSalvo = await res.json();
        setEditingPerfil(perfilSalvo);

        const permissaoRes = await fetch(
          resolveApiUrl(`/api/v1/perfis-acesso/${perfilSalvo.id}/permissoes`),
          {
            method: "PUT",
            headers: {
              ...(await fetchHeaders()),
              "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify(selectedPermissoes),
          },
        );

        if (!permissaoRes.ok) {
          toast.error("Perfil salvo, mas houve erro ao atribuir permissões.");
        } else {
          toast.success("Perfil atualizado com sucesso!");
        }

        setShowDecisaoModal(false);
        await onReload?.();
        if (permissaoRes.ok) {
          onSaved?.(perfilSalvo);
          onBack?.();
        }
      } else {
        // Criar novo perfil
        const finalNome = (nomeCustom || formData.nome || "").trim();
        if (!finalNome) {
          toast.error("O nome do perfil é obrigatório.");
          setSaving(false);
          return;
        }

        if (isProfileNameDuplicate(finalNome, perfisAcesso)) {
          toast.error("Já existe um perfil com este nome nesta clínica.");
          setSaving(false);
          return;
        }

        const payload = {
          nome: finalNome,
          descricao: (descCustom !== undefined ? descCustom : formData.descricao) || "",
        };

        const res = await fetch(
          resolveApiUrl("/api/v1/perfis-acesso"),
          {
            method: "POST",
            headers: {
              ...(await fetchHeaders()),
              "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify(payload),
          },
        );

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          toast.error(getApiErrorDetail({ body }) || "Erro ao criar perfil.");
          return;
        }

        const novoPerfil = await res.json();
        recemCriadoIdRef.current = novoPerfil.id;
        setEditingPerfil(novoPerfil);
        const permissaoRes = await fetch(
          resolveApiUrl(`/api/v1/perfis-acesso/${novoPerfil.id}/permissoes`),
          {
            method: "PUT",
            headers: {
              ...(await fetchHeaders()),
              "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify(selectedPermissoes),
          },
        );

        if (!permissaoRes.ok) {
          toast.error("Perfil criado, mas houve erro ao atribuir permissões.");
        } else {
          toast.success("Novo perfil criado com sucesso!");
        }

        setShowDecisaoModal(false);
        await onReload?.();
        if (permissaoRes.ok) {
          onSaved?.(novoPerfil);
          onBack?.();
        }
      }
    } catch {
      toast.error("Falha de rede ao salvar perfil.");
    } finally {
      setSaving(false);
    }
  };
  const saveButton = (
    <button
      type="submit"
      className="btn-p"
      disabled={!canEdit || saving || loadingPermissoes || erroPermissoes}
    >
      <PrototypeIcon name="check" size="s" />
      {saving ? "Salvando..." : "Salvar perfil"}
    </button>
  );
  const menu = [
    ["users", "Pacientes", ["PACIENTE_VER"]],
    ["cal", "Agenda", ["AGENDA_VER", "AGENDA_PROPRIA_VER"]],
    ["ucog", "Gestão de Equipe", ["USUARIO_VER"]],
    [
      "gear",
      "Configurações",
      [
        "CLINICA_EDITAR",
        "HORARIO_EDITAR",
        "FERIADO_EDITAR",
        "CATALOGO_VER",
        "ANAMNESE_MODELO_VER",
        "DOC_MODELO_VER",
        "MSG_TEMPLATE_GERENCIAR",
      ],
    ],
  ];
  const temCodigo = (codes) =>
    permissoes.some(
      (p) =>
        codes.includes(p.codigo) && selectedPermissoes.includes(p.permissaoId),
    );

  return (
    <form className="prototype-perfil-editor" onSubmit={salvarPerfil}>
      <div className="crumb">
        <button type="button" onClick={onBack} disabled={saving}>
          <PrototypeIcon name="cl" size="s" />
          Gestão de Equipe
        </button>
        <span>/</span>
        <span>Perfis de acesso</span>
      </div>
      <div className="ed-bar">
        <h2 className="trunc">
          {editingPerfil
            ? `Editar perfil: ${formData.nome}`
            : "Novo perfil de acesso"}
        </h2>
        <button
          type="button"
          className="btn-s"
          onClick={onBack}
          disabled={saving}
        >
          Cancelar
        </button>
        {canEdit && saveButton}
      </div>

      {editingPerfil && (
        <div
          className="perfil-custom-banner"
          style={{
            margin: "0 0 16px",
            padding: "14px 16px",
            background: "#fffdf5",
            border: "1px solid #fde68a",
            borderRadius: 12,
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
          }}
        >
          <div style={{ color: "#d97706", marginTop: 2, flexShrink: 0 }}>
            <PrototypeIcon name="info" size="s" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontWeight: 600,
                color: "#78350f",
                fontSize: "0.95rem",
              }}
            >
              Você está editando o perfil{" "}
              <strong>{getNomeCanonicaPerfil(editingPerfil)}</strong>
            </div>
            <div
              style={{
                color: "#92400e",
                fontSize: "0.85rem",
                marginTop: 4,
                lineHeight: 1.4,
              }}
            >
              {membros.length > 0 ? (
                <>
                  Este perfil é utilizado por{" "}
                  <strong>
                    {membros.length}{" "}
                    {membros.length > 1 ? "colaboradores" : "colaborador"}
                  </strong>{" "}
                  (
                  {membros
                    .slice(0, 4)
                    .map((m) => (m.nomeCompleto || m.nome || "").split(" ")[0])
                    .join(", ")}
                  {membros.length > 4 ? ` e mais ${membros.length - 4}` : ""}). Ao
                  salvar, você poderá atualizar as permissões para todos os
                  vinculados ou gerar um novo perfil de acesso na clínica.
                </>
              ) : (
                <>
                  Nenhum colaborador vinculado a este perfil atualmente. Ao
                  salvar, você poderá atualizar este perfil ou gerar um novo a
                  partir destas permissões.
                </>
              )}
            </div>
          </div>
        </div>
      )}
      <div className="ed">
        <div style={{ minWidth: 0 }}>
          <fieldset disabled={!canEdit || saving || loadingPermissoes}>
            <div className="card">
              <h3>Nome e descrição</h3>
              <p className="d">
                Um nome que a equipe reconheça, como “Recepção” ou “Biomédica”.
              </p>
              <div className="fld">
                <input
                  className="inp"
                  required
                  maxLength={50}
                  value={
                    editingPerfil && ehPadrao(editingPerfil)
                      ? getNomeCanonicaPerfil(editingPerfil)
                      : formData.nome
                  }
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, nome: e.target.value }))
                  }
                  disabled={Boolean(editingPerfil && ehPadrao(editingPerfil))}
                  placeholder="Ex.: Recepção"
                  aria-label="Nome do perfil"
                />
                {editingPerfil && ehPadrao(editingPerfil) && (
                  <p
                    className="d"
                    style={{
                      fontSize: "0.8rem",
                      color: "var(--text-tertiary, #64748b)",
                      marginTop: 6,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <span>🔒</span>
                    <span>
                      Perfis padrão do sistema possuem nome fixo para manter a consistência da clínica. Você pode personalizar as permissões livremente abaixo.
                    </span>
                  </p>
                )}
                {isMainNomeDuplicado && (
                  <p
                    className="fld-erro-duplicado"
                    style={{
                      fontSize: "0.8rem",
                      color: "#e11d48",
                      marginTop: 6,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontWeight: 500,
                    }}
                    role="alert"
                  >
                    <AlertTriangle className="h-3.5 w-3.5 text-rose-500 flex-shrink-0" />
                    <span>Já existe um perfil com este nome nesta clínica.</span>
                  </p>
                )}
              </div>
              <div className="fld" style={{ marginTop: 10 }}>
                <textarea
                  className="inp"
                  maxLength={200}
                  value={formData.descricao}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      descricao: e.target.value,
                    }))
                  }
                  placeholder="Para que serve este perfil? (opcional)"
                  aria-label="Descrição"
                />
              </div>
              {!editingPerfil && (
                <div style={{ marginTop: 12 }}>
                  <div className="base-title">Começar a partir de</div>
                  <div className="base">
                    <button
                      type="button"
                      className={baseSelecionada === "branco" || baseSelecionada === "BRANCO" ? "on" : ""}
                      onClick={() => usarBase(null)}
                    >
                      Em branco
                    </button>
                    {bases.length > 0
                      ? bases.map((perfil) => (
                          <button
                            key={perfil.id}
                            type="button"
                            className={
                              baseSelecionada === String(perfil.id) ? "on" : ""
                            }
                            onClick={() => usarBase(perfil)}
                          >
                            {getNomeCanonicaPerfil(perfil)}
                          </button>
                        ))
                      : Object.entries(PRESETS_PERFIS)
                          .filter(([key]) => key !== "BRANCO")
                          .map(([key, preset]) => (
                            <button
                              key={key}
                              type="button"
                              className={baseSelecionada === key ? "on" : ""}
                              onClick={() => aplicarPreset(key)}
                              title={preset.descricao}
                            >
                              {preset.nome}
                            </button>
                          ))}
                  </div>
                </div>
              )}
            </div>
            <div className="card">
              <h3>Quem tiver este perfil atende pacientes?</h3>
              <p className="d">
                Quem atende aparece na agenda e pode ter horários de
                atendimento.
              </p>
              <div
                className="agsw"
                role="radiogroup"
                aria-label="Atendimento na agenda"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={ag}
                  className={`opt${ag ? " on" : ""}`}
                  disabled={!agendaPermissao}
                  onClick={() => mudarAgenda(true)}
                >
                  <span className="radio" />
                  <span>
                    <b>Sim, atende na agenda</b>
                    <span>Ex.: dentista, biomédica, esteticista</span>
                  </span>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={!ag}
                  className={`opt${!ag ? " on" : ""}`}
                  disabled={!agendaPermissao}
                  onClick={() => mudarAgenda(false)}
                >
                  <span className="radio" />
                  <span>
                    <b>Não atende</b>
                    <span>Ex.: recepção, administração, sócio</span>
                  </span>
                </button>
              </div>
            </div>
            <div className="card">
              <h3>O que este perfil pode fazer</h3>
              <p className="d">
                Escolha um nível para cada área. Se precisar de algo no meio do
                caminho, escolha as funções uma a uma.
              </p>
              {loadingPermissoes && (
                <p role="status">Carregando permissões...</p>
              )}
              {erroPermissoes && (
                <p role="alert">
                  {modeloSemPermissoes
                    ? "Este modelo está sem permissões nesta clínica. As funções que você já marcou foram preservadas. Selecione o modelo novamente após restaurar suas permissões."
                    : "Não foi possível carregar as permissões. Abra o perfil novamente antes de salvar."}
                </p>
              )}
              {modulos.map((modulo) => {
                const nivel = nivelModulo(modulo, selectedPermissoes);
                const open = abertos[modulo.key];
                const temEdicaoOperacional = modulo.funcoes.some(
                  (p) =>
                    OPERACIONAIS.has(p.codigo) && !p.codigo.endsWith("_VER"),
                );
                const niveisModulo = temEdicaoOperacional
                  ? ["1", "2", "3", "0"]
                  : ["1", "3", "0"];
                return (
                  <div key={modulo.key} className="mod">
                    <div className="mod-h">
                      <div className="nm">
                        <span className="ic">
                          <PrototypeIcon name={modulo.icon} />
                        </span>
                        <span style={{ minWidth: 0 }}>
                          <b>{modulo.nome}</b>
                          <span className="trunc">{modulo.descricao}</span>
                        </span>
                      </div>
                      <div
                        className="lv"
                        role="group"
                        aria-label={`Nível em ${modulo.nome}`}
                      >
                        {niveisModulo.map((key) => {
                          const isDisabled =
                            key === "1" && !modulo.raizes.length;
                          return (
                            <button
                              type="button"
                              key={key}
                              className={nivel.key === key ? "on" : ""}
                              aria-pressed={nivel.key === key}
                              disabled={isDisabled}
                              title={
                                isDisabled
                                  ? `O módulo ${modulo.nome} não possui nível somente visualização`
                                  : undefined
                              }
                              onClick={() => aplicarNivel(modulo, key)}
                            >
                              {etiquetasNivel[key]}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="mod-x">
                      <span className="cnt">
                        {nivel.key === "c" ? (
                          <span className="cus">{nivel.text}</span>
                        ) : nivel.key === "0" ? (
                          "Nada liberado"
                        ) : (
                          `${nivel.has} de ${nivel.total} funções`
                        )}
                      </span>
                      {modulo.funcoes.length > 0 && (
                        <button
                          type="button"
                          className="btn-g expand-functions"
                          aria-expanded={Boolean(open)}
                          onClick={() =>
                            setAbertos((prev) => ({
                              ...prev,
                              [modulo.key]: !open,
                            }))
                          }
                        >
                          {open
                            ? "Esconder funções"
                            : "Escolher funções uma a uma"}{" "}
                          <PrototypeIcon name={open ? "cd" : "cr"} size="s" />
                        </button>
                      )}
                    </div>
                    {open && (
                      <div className="perm">
                        {modulo.funcoes.map((permissao) => {
                          const checked = selectedPermissoes.includes(
                            permissao.permissaoId,
                          );
                          return (
                            <label
                              key={permissao.permissaoId}
                              className={`perm-item${checked ? " on" : ""}`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) =>
                                  mudarFuncao(modulo, permissao, e.target.checked)
                                }
                              />
                              <span>{permissao.nome}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </fieldset>
          {canEdit && (
            <div className="sticky-sum">
              <span style={{ flex: 1, minWidth: 0 }}>
                <b>
                  {selectedFuncoesCount} de {funcoesCatalogo.length} funções
                </b>{" "}
                · {ag ? "atende na agenda" : "não atende"}
              </span>
              {saveButton}
            </div>
          )}
        </div>
        <div className="sum-col">
          <div className="card sum">
            <h3>Resumo do perfil</h3>
            <div className="big">
              {selectedFuncoesCount}{" "}
              <span>de {funcoesCatalogo.length} funções</span>
            </div>
            <div className="gauge" style={{ margin: "6px 0 10px" }}>
              <span className="bar">
                <i
                  style={{
                    width: `${funcoesCatalogo.length ? Math.round((selectedFuncoesCount / funcoesCatalogo.length) * 100) : 0}%`,
                  }}
                />
              </span>
            </div>
            <span className={ag ? "ag-yes" : "ag-no"}>
              <PrototypeIcon name={ag ? "calok" : "caloff"} size="s" />
              {ag ? "Atende na agenda" : "Não atende na agenda"}
            </span>

            {membros.length > 0 && (
              <div className="sum-membros-bloco">
                <div className="who-uses">
                  <PrototypeIcon name="info" size="s" />
                  <span>
                    {membros.length}{" "}
                    {membros.length > 1 ? "pessoas usam" : "pessoa usa"} este
                    perfil. As mudanças valem assim que você salvar.
                  </span>
                </div>
                <div className="aff">
                  {membros.slice(0, 6).map((membro) => (
                    <span key={membro.id || membro.usuarioId} className="av">
                      {(membro.nomeCompleto || membro.nome || "?")
                        .split(" ")
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((p) => p[0])
                        .join("")}
                    </span>
                  ))}
                  <span>
                    {membros
                      .slice(0, 2)
                      .map(
                        (m) => (m.nomeCompleto || m.nome || "").split(" ")[0],
                      )
                      .join(", ")}
                    {membros.length > 2 ? ` e mais ${membros.length - 2}` : ""}
                  </span>
                </div>
              </div>
            )}

            <ul>
              {modulos.map((modulo) => {
                const nivel = nivelModulo(modulo, selectedPermissoes);
                return (
                  <li key={modulo.key}>
                    <span>{modulo.nome}</span>
                    <span className={`l l${nivel.key}`}>{nivel.text}</span>
                  </li>
                );
              })}
            </ul>
            <div className="prev">
              <div className="menu-prev">
                <div className="menu-title">O menu desta pessoa</div>
                {menu.map(([icon, label, codes]) => (
                  <div
                    key={label}
                    className={`mi${temCodigo(codes) ? "" : " off"}`}
                  >
                    <PrototypeIcon name={icon} size="s" />
                    {label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      {confirmacaoDesativarRaiz && (
        <div
          className="eq-overlay"
          role="presentation"
          onClick={() => setConfirmacaoDesativarRaiz(null)}
        >
          <div
            className="eq-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dialog-raiz-title"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 520 }}
          >
            <div className="eq-dialog-head" style={{ marginBottom: 16 }}>
              <div>
                <h2 id="dialog-raiz-title" style={{ fontSize: 18 }}>
                  Desativar visualização em {confirmacaoDesativarRaiz.modulo.nome}?
                </h2>
                <p
                  style={{
                    margin: "4px 0 0",
                    color: "var(--app-muted)",
                    fontSize: 13,
                  }}
                >
                  Ação com impacto em outras funções do módulo
                </p>
              </div>
              <button
                type="button"
                className="ib"
                aria-label="Fechar"
                onClick={() => setConfirmacaoDesativarRaiz(null)}
              >
                <PrototypeIcon name="x" size="s" />
              </button>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div
                style={{
                  background: "#fffdf5",
                  border: "1px solid #fef08a",
                  borderRadius: 12,
                  padding: 14,
                  marginBottom: 14,
                }}
              >
                <p
                  style={{
                    margin: "0 0 8px",
                    fontSize: 13,
                    color: "#78350f",
                    fontWeight: 600,
                  }}
                >
                  Este perfil possui {confirmacaoDesativarRaiz.dependentes.length} função(ões) ativas que dependem desta visualização:
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {confirmacaoDesativarRaiz.dependentes.map((p) => (
                    <span
                      key={p.permissaoId}
                      style={{
                        background: "#fff",
                        border: "1px solid #fde68a",
                        color: "#92400e",
                        fontSize: 12,
                        fontWeight: 600,
                        padding: "3px 8px",
                        borderRadius: 6,
                      }}
                    >
                      ✕ {p.nome}
                    </span>
                  ))}
                </div>
              </div>

              <p
                style={{
                  fontSize: 13,
                  color: "#475569",
                  lineHeight: 1.5,
                  margin: 0,
                }}
              >
                Não é possível realizar ações neste módulo sem permissão para visualizá-lo. Ao confirmar, essas funções também serão desmarcadas automaticamente.
              </p>
            </div>

            <div
              className="eq-dialog-foot"
              style={{ marginTop: 16, paddingTop: 16 }}
            >
              <button
                type="button"
                className="btn-s"
                onClick={() => setConfirmacaoDesativarRaiz(null)}
              >
                Manter visualização
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={confirmarDesativacaoRaiz}
              >
                Desativar funções dependentes
              </button>
            </div>
          </div>
        </div>
      )}

      {showDecisaoModal &&
        createPortal(
          <div
            className="acesso-modal-backdrop font-sans text-slate-800"
            role="dialog"
            aria-modal="true"
            aria-labelledby="decisao-perfil-modal-title"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget && !saving) {
                setShowDecisaoModal(false);
              }
            }}
          >
            <div
              className="decisao-modal-card prototype-equipe"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="decisao-modal-head">
                <div className="decisao-head-left">
                  <div className="decisao-head-icon">
                    <Shield className="h-5 w-5 text-[#00a88e]" />
                  </div>
                  <div>
                    <h3
                      id="decisao-perfil-modal-title"
                      className="decisao-title"
                    >
                      Salvar Alterações do Perfil
                    </h3>
                    <p className="decisao-subtitle">
                      Você fez alterações no perfil{" "}
                      <strong>{getNomeCanonicaPerfil(editingPerfil)}</strong>.
                      Como deseja aplicar?
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="decisao-close-btn"
                  onClick={() => setShowDecisaoModal(false)}
                  disabled={saving}
                  aria-label="Fechar"
                  title="Fechar modal"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="decisao-modal-body">
                {/* Opção A: Atualizar o perfil existente */}
                {!ehGlobal(editingPerfil) && !ehPadrao(editingPerfil) ? (
                  <div
                    className={`decisao-opcao-card decisao-opcao-box ${decisaoTipo === "existente" ? "selected" : ""}`}
                    onClick={() => setDecisaoTipo("existente")}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ")
                        setDecisaoTipo("existente");
                    }}
                  >
                    <div className="decisao-opcao-head">
                      <span className="decisao-opcao-title">
                        Atualizar o perfil existente (
                        {getNomeCanonicaPerfil(editingPerfil)})
                      </span>
                      <label className="decisao-radio-wrapper flex items-center cursor-pointer m-0">
                        <input
                          type="radio"
                          name="decisaoTipoPerfil"
                          value="existente"
                          checked={decisaoTipo === "existente"}
                          onChange={() => setDecisaoTipo("existente")}
                          className="sr-only"
                        />
                        <div
                          className={`decisao-radio ${decisaoTipo === "existente" ? "active" : ""}`}
                          aria-hidden="true"
                        >
                          {decisaoTipo === "existente" && (
                            <div className="decisao-radio-inner" />
                          )}
                        </div>
                      </label>
                    </div>
                    <span className="decisao-opcao-desc">
                      As permissões alteradas serão salvas no perfil existente e
                      passarão a valer para todos os colaboradores vinculados a ele.
                    </span>
                    {membros.length > 0 && (
                      <div
                        className="decisao-membros-afetados"
                        style={{
                          marginTop: 8,
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          fontSize: "0.8rem",
                          color: "#64748b",
                        }}
                      >
                        <Users className="h-4 w-4 text-slate-400 flex-shrink-0" />
                        <span>
                          Utilizado por {membros.length}{" "}
                          {membros.length > 1
                            ? "colaboradores"
                            : "colaborador"}
                          :{" "}
                          <strong>
                            {membros
                              .slice(0, 3)
                              .map(
                                (m) =>
                                  (m.nomeCompleto || m.nome || "").split(
                                    " ",
                                  )[0],
                              )
                              .join(", ")}
                            {membros.length > 3
                              ? ` e mais ${membros.length - 3}`
                              : ""}
                          </strong>
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="decisao-opcao-card decisao-opcao-box disabled">
                    <div className="decisao-opcao-head">
                      <span className="decisao-opcao-title">
                        Atualizar modelo padrão (
                        {getNomeCanonicaPerfil(editingPerfil)})
                        <span className="decisao-badge-lock">Bloqueado</span>
                      </span>
                      <Lock className="h-4 w-4 text-slate-400 flex-shrink-0" />
                    </div>
                    <span className="decisao-opcao-desc">
                      Modelos prontos do sistema são protegidos e não podem ser
                      alterados diretamente. Crie um novo perfil abaixo.
                    </span>
                    {membros.length > 0 && (
                      <div
                        className="decisao-membros-afetados"
                        style={{
                          marginTop: 8,
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          fontSize: "0.8rem",
                          color: "#64748b",
                        }}
                      >
                        <Users className="h-4 w-4 text-slate-400 flex-shrink-0" />
                        <span>
                          Utilizado por {membros.length}{" "}
                          {membros.length > 1
                            ? "colaboradores"
                            : "colaborador"}
                          :{" "}
                          <strong>
                            {membros
                              .slice(0, 3)
                              .map(
                                (m) =>
                                  (m.nomeCompleto || m.nome || "").split(
                                    " ",
                                  )[0],
                              )
                              .join(", ")}
                            {membros.length > 3
                              ? ` e mais ${membros.length - 3}`
                              : ""}
                          </strong>
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Opção B: Criar um novo perfil */}
                <div
                  className={`decisao-opcao-card decisao-opcao-box ${decisaoTipo === "novo" ? "selected" : ""}`}
                  onClick={() => setDecisaoTipo("novo")}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ")
                      setDecisaoTipo("novo");
                  }}
                >
                  <div className="decisao-opcao-head">
                    <span className="decisao-opcao-title">
                      Criar um novo perfil com as edições feitas
                    </span>
                    <label className="decisao-radio-wrapper flex items-center cursor-pointer m-0">
                      <input
                        type="radio"
                        name="decisaoTipoPerfil"
                        value="novo"
                        checked={decisaoTipo === "novo"}
                        onChange={() => setDecisaoTipo("novo")}
                        className="sr-only"
                      />
                      <div
                        className={`decisao-radio ${decisaoTipo === "novo" ? "active" : ""}`}
                        aria-hidden="true"
                      >
                        {decisaoTipo === "novo" && (
                          <div className="decisao-radio-inner" />
                        )}
                      </div>
                    </label>
                  </div>
                  <span className="decisao-opcao-desc">
                    Mantém o perfil original intacto e cria um novo perfil de
                    acesso na clínica com estas permissões específicas.
                  </span>

                  {decisaoTipo === "novo" && (
                    <div
                      className="decisao-form-group"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="decisao-field">
                        <label
                          htmlFor="decisao-nome-perfil"
                          className="decisao-label"
                        >
                          Nome do novo perfil *
                        </label>
                        <input
                          id="decisao-nome-perfil"
                          type="text"
                          className={`decisao-input ${isNomeDuplicado ? "border-rose-500 focus:border-rose-500 focus:ring-rose-200" : ""}`}
                          required
                          value={decisaoNomePerfil}
                          onChange={(e) => setDecisaoNomePerfil(e.target.value)}
                          placeholder="Ex: Recepcionista Avançado, Médico Plantonista..."
                          disabled={saving}
                          aria-invalid={isNomeDuplicado}
                        />
                        {isNomeDuplicado && (
                          <div
                            className="decisao-erro-duplicado flex items-center gap-1.5 text-xs text-rose-600 font-medium mt-1.5"
                            role="alert"
                          >
                            <AlertTriangle className="h-3.5 w-3.5 text-rose-500 flex-shrink-0" />
                            <span>Já existe um perfil com este nome nesta clínica.</span>
                          </div>
                        )}
                      </div>
                      <div className="decisao-field">
                        <label
                          htmlFor="decisao-desc-perfil"
                          className="decisao-label"
                        >
                          Descrição (opcional)
                        </label>
                        <input
                          id="decisao-desc-perfil"
                          type="text"
                          className="decisao-input"
                          value={decisaoDescPerfil}
                          onChange={(e) => setDecisaoDescPerfil(e.target.value)}
                          placeholder="Breve descrição da função deste perfil"
                          disabled={saving}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="decisao-modal-foot">
                <button
                  type="button"
                  className="decisao-btn-cancel btn-s"
                  onClick={() => setShowDecisaoModal(false)}
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="decisao-btn-confirm btn-p"
                  disabled={
                    saving ||
                    (decisaoTipo === "novo" &&
                      (!decisaoNomePerfil.trim() || isNomeDuplicado))
                  }
                  onClick={() =>
                    executarSalvarPerfil({
                      tipo: decisaoTipo,
                      nomeCustom: decisaoNomePerfil,
                      descCustom: decisaoDescPerfil,
                    })
                  }
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Salvando…</span>
                    </>
                  ) : (
                    "Confirmar e salvar"
                  )}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </form>
  );
}
