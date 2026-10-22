import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { resolveApiUrl } from "../../config/apiEnv";
import { getApiErrorToastMessage, equipeApi } from "../../services/api";
import { useToast } from "../../contexts/useToast.js";
import {
  COUNTRY_PHONE_CODES,
  countrySelectDisplayLabel,
  getCountryByCode,
} from "../../data/countryPhoneCodes";
import {
  formatPhoneAsYouType,
  isPhoneValid,
  formatPhoneForApi,
} from "../../utils/phoneUtils";
import {
  formatCargoLabel,
  CODIGO_ORDER,
  ROLE_DISPLAY_ORDER,
} from "./gestaoUsuariosUtils";
import PrototypeIcon from "./PrototypeIcon";
import { profileType, summarizeModules } from "./equipePrototypeUtils";
import "./equipePrototypeBase.css";
import "./invitePrototype.css";

import { EstadoCivilSelect } from "../patients/EstadoCivilSelect.jsx";
import { useAgoraDaClinica } from "../hooks/useAgoraDaClinica.js";

export function InviteModal({
  roles,
  perfisAcesso,
  permissoes,
  especialidadesList,
  onClose,
  onSuccess,
  fetchHeaders,
  canEditConfigPerfil = false,
  onEditarPerfilNaAba,
  initialDraft,
}) {
  const toast = useToast();
  const dialogRef = useRef(null);
  const { hojeIso } = useAgoraDaClinica(60000);
  const [form, setForm] = useState(
    initialDraft?.form || {
      nome: "",
      email: "",
      senha: "",
      cpf: "",
      roleId: "",
      perfilAcessoId: "",
      dataNascimento: "",
      estadoCivilId: "",
      cep: "",
      logradouro: "",
      numero: "",
      complemento: "",
      bairro: "",
      cidade: "",
      uf: "",
      especialidades: [],
    },
  );
  const [saving, setSaving] = useState(false);
  const [telefoneCountryCode, setTelefoneCountryCode] = useState(
    initialDraft?.telefoneCountryCode || "BR",
  );
  const [telefoneNumero, setTelefoneNumero] = useState(
    initialDraft?.telefoneNumero || "",
  );
  const [telefoneTouched, setTelefoneTouched] = useState(false);
  const [showSenha, setShowSenha] = useState(false);

  // Só leitura: mostra o que o Nível selecionado inclui. Editar de verdade acontece na aba Perfis de Acesso.
  const [permissoesDoNivel, setPermissoesDoNivel] = useState([]);
  const [expandedModuleKey, setExpandedModuleKey] = useState(null);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [permissionError, setPermissionError] = useState(false);
  const permissionRequest = useRef(0);
  const perfilEscolhidoManualmente = useRef(
    Boolean(initialDraft?.form?.perfilAcessoId),
  );

  const loadPermissoesDoNivel = async (perfilId) => {
    const request = ++permissionRequest.current;
    setExpandedModuleKey(null);
    setPermissionError(false);
    if (!perfilId) {
      setPermissoesDoNivel([]);
      setLoadingTemplate(false);
      return;
    }
    setLoadingTemplate(true);
    try {
      const res = await fetch(
        resolveApiUrl(`/api/v1/perfis-acesso/${perfilId}/permissoes`),
        {
          headers: await fetchHeaders(),
          credentials: "include",
        },
      );
      if (!res.ok) throw new Error("permissions-read");
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error("permissions-shape");
      if (request === permissionRequest.current) setPermissoesDoNivel(data);
    } catch (e) {
      console.error("Erro ao carregar permissões do nível:", e);
      if (request === permissionRequest.current) setPermissionError(true);
    } finally {
      if (request === permissionRequest.current) setLoadingTemplate(false);
    }
  };

  const handlePerfilAction = (copy) => {
    if (!canEditConfigPerfil || !onEditarPerfilNaAba || !form.perfilAcessoId)
      return;
    const perfil = perfisAcesso.find(
      (p) => String(p.id) === String(form.perfilAcessoId),
    );
    const type = profileType(perfil);
    if (type !== "tpl" && type !== "cli") return;
    const id =
      copy || type === "tpl"
        ? `copy:${form.perfilAcessoId}`
        : form.perfilAcessoId;
    onEditarPerfilNaAba(id, { form, telefoneCountryCode, telefoneNumero });
  };
  const handleClose = useCallback(() => {
    setExpandedModuleKey(null);
    onClose();
  }, [onClose]);
  useEffect(() => {
    if (initialDraft?.form?.perfilAcessoId)
      loadPermissoesDoNivel(initialDraft.form.perfilAcessoId);
    // Restaura a prévia ao voltar do editor; o rascunho permanece só em memória.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCepChange = async (e) => {
    const rawValue = e.target.value.replace(/\D/g, "");
    let formattedCep = rawValue;
    if (rawValue.length > 5) {
      formattedCep = rawValue.replace(/^(\d{5})(\d)/, "$1-$2");
    }
    setForm((prev) => ({ ...prev, cep: formattedCep }));

    if (rawValue.length === 8) {
      try {
        const response = await fetch(
          `https://viacep.com.br/ws/${rawValue}/json/`,
        );
        const data = await response.json();
        if (!data.erro) {
          setForm((prev) => ({
            ...prev,
            logradouro: data.logradouro || "",
            bairro: data.bairro || "",
            cidade: data.localidade || "",
            uf: data.uf || "",
          }));
          document.getElementById("invite-numero")?.focus();
        }
      } catch (error) {
        console.error("Erro ao buscar CEP:", error);
      }
    }
  };

  useEffect(() => {
    const previousFocus = document.activeElement;
    const originalOverflow = document.body.style.overflow;
    dialogRef.current?.focus();
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
      previousFocus?.focus?.();
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        handleClose();
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        dialogRef.current?.querySelectorAll(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]',
        ) || [],
      ).filter((element) => !element.closest("[hidden]"));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first) {
        event.preventDefault();
        return;
      }
      const focusInside = dialogRef.current?.contains(document.activeElement);
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          !focusInside ||
          document.activeElement === dialogRef.current)
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          !focusInside ||
          document.activeElement === dialogRef.current)
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleClose]);

  const handleRoleChangeInvite = (selectedRoleId) => {
    setExpandedModuleKey(null);
    if (perfilEscolhidoManualmente.current) {
      setForm((prev) => ({ ...prev, roleId: selectedRoleId }));
      return;
    }
    const cargo = roles.find((r) => String(r.id) === String(selectedRoleId));
    const sugerido = perfisAcesso.find(
      (p) =>
        cargo?.perfilAcessoPadraoId != null &&
        String(p.id) === String(cargo.perfilAcessoPadraoId) &&
        (p.codigo || "").toUpperCase() !== "DONO" &&
        p.ativo !== false,
    );
    const perfilId = sugerido ? String(sugerido.id) : "";
    setForm((prev) => ({
      ...prev,
      roleId: selectedRoleId,
      perfilAcessoId: perfilId,
    }));
    loadPermissoesDoNivel(perfilId);
  };

  const handlePerfilChangeInvite = (selectedPerfilId) => {
    perfilEscolhidoManualmente.current = Boolean(selectedPerfilId);
    setForm((prev) => ({ ...prev, perfilAcessoId: selectedPerfilId }));
    loadPermissoesDoNivel(selectedPerfilId);
  };

  const maskCPF = (value) => {
    return value
      .replace(/\D/g, "")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})/, "$1-$2")
      .replace(/(-\d{2})\d+?$/, "$1");
  };

  const validateCPF = (cpf) => {
    const cleanCPF = cpf.replace(/\D/g, "");
    if (cleanCPF.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(cleanCPF)) return false;

    let sum = 0;
    let remainder;

    for (let i = 1; i <= 9; i++)
      sum += parseInt(cleanCPF.substring(i - 1, i)) * (11 - i);
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cleanCPF.substring(9, 10))) return false;

    sum = 0;
    for (let i = 1; i <= 10; i++)
      sum += parseInt(cleanCPF.substring(i - 1, i)) * (12 - i);
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cleanCPF.substring(10, 11))) return false;

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.roleId) return toast.error("Selecione um papel.");
    if (!form.perfilAcessoId)
      return toast.error("Selecione um nível de permissão.");
    if (form.senha.length < 8)
      return toast.error("A senha deve ter no mínimo 8 caracteres.");
    if (!validateCPF(form.cpf))
      return toast.error("CPF inválido. Verifique os números digitados.");

    setSaving(true);
    try {
      const { createClient } = await import("@supabase/supabase-js");

      // Criamos um client temporário SEM persistência para não deslogar o admin atual
      const tempSupabase = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        { auth: { persistSession: false } },
      );

      // 1. Criar usuário no Supabase usando o client temporário
      const { data: signUpData, error: signUpError } =
        await tempSupabase.auth.signUp({
          email: form.email,
          password: form.senha,
          options: {
            data: {
              nome_completo: form.nome,
            },
          },
        });

      if (signUpError) throw signUpError;
      const usuarioId = signUpData.user?.id;
      if (!usuarioId)
        throw new Error("Falha ao obter ID do novo usuário no Supabase.");

      const token = signUpData.session?.access_token;

      // 2. Completar Perfil no Backend
      const profileRes = await fetch(
        resolveApiUrl("/api/auth/completar-perfil"),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          credentials: "include",
          body: JSON.stringify({
            nomeCompleto: form.nome,
            email: form.email,
            telefone:
              formatPhoneForApi(telefoneCountryCode, telefoneNumero) || null,
            cpf: form.cpf,
            dataNascimento: form.dataNascimento || null,
            estadoCivilId: form.estadoCivilId || null,
            cep: form.cep || null,
            logradouro: form.logradouro || null,
            numero: form.numero || null,
            complemento: form.complemento || null,
            bairro: form.bairro || null,
            cidade: form.cidade || null,
            uf: form.uf || null,
            especialidades: form.especialidades,
          }),
        },
      );

      if (!profileRes.ok) {
        const profileErr = await profileRes.json().catch(() => ({}));
        throw new Error(
          profileErr.message ||
            "Usuário criado no Supabase, mas erro ao completar perfil no backend.",
        );
      }

      // 3. Vincular à Equipe
      try {
        await equipeApi.create({
          usuarioId,
          roleId: form.roleId,
          perfilAcessoId: form.perfilAcessoId,
        });
      } catch (err) {
        throw new Error(
          getApiErrorToastMessage(err) ||
            "Perfil completado, mas erro ao vincular à equipe.",
        );
      }

      toast.success("Acesso criado com sucesso!");
      onSuccess();
    } catch (err) {
      toast.error(err.message || "Falha ao criar acesso.");
    } finally {
      setSaving(false);
    }
  };

  const sectionClass =
    "border-t border-slate-200 pt-4 first:border-0 first:pt-0";

  const phoneWrapClass = () =>
    `flex items-center gap-2 h-11 rounded-[10px] border bg-white px-3 ${
      telefoneTouched &&
      telefoneNumero &&
      !isPhoneValid(telefoneCountryCode, telefoneNumero)
        ? "border-red-300 ring-2 ring-red-100"
        : "border-slate-200 focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-500/10"
    }`;

  const perfilSelecionado = (perfisAcesso || []).find(
    (p) => String(p.id) === String(form.perfilAcessoId),
  );
  const agendaPermId = (permissoes || []).find(
    (p) => p.codigo === "AGENDA_APARECER",
  )?.permissaoId;
  const perfilSelecionadoAtendeAgenda = Boolean(
    agendaPermId && permissoesDoNivel.includes(agendaPermId),
  );
  const modules = summarizeModules(permissoes, permissoesDoNivel);
  const selectedModule = modules.find(
    (module) => module.key === expandedModuleKey,
  );
  const selectedProfileType = profileType(perfilSelecionado);

  return createPortal(
    <div className="prototype-equipe prototype-invite">
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-hidden">
        {/* Backdrop limpo e leve para máxima taxa de quadros (60/120 FPS) */}
        <div
          className="fixed inset-0 bg-slate-900/40 pointer-events-auto transition-opacity"
          onMouseDown={handleClose}
        />

        {/* Modal Card */}
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="invite-title"
          aria-describedby="invite-description"
          tabIndex={-1}
          className="invite-dialog relative z-10 mx-auto flex max-h-[92dvh] w-full max-w-[930px] flex-col overflow-hidden bg-white outline-none"
        >
          <div className="invite-head">
            <span className="head-icon">
              <PrototypeIcon name="uplus" />
            </span>
            <div className="invite-heading">
              <h2
                id="invite-title"
                className="text-[22px] font-semibold tracking-tight text-slate-900"
              >
                Convidar pessoa
              </h2>
              <p
                id="invite-description"
                className="mt-1 text-sm text-slate-500"
              >
                Adicione alguém à equipe e escolha seu acesso.
              </p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              aria-label="Fechar convite"
              className="invite-close"
            >
              <PrototypeIcon name="x" />
            </button>
          </div>

          <form
            onSubmit={handleSubmit}
            className="flex-1 flex flex-col min-h-0"
          >
            <div className="invite-scroll flex-1 min-h-0 overflow-y-auto">
              <div className="invite-grid person-fields">
                <div>
                  <label
                    htmlFor="invite-nome"
                    className="mb-1.5 block text-[13px] font-medium text-slate-700"
                  >
                    Nome Completo
                  </label>
                  <input
                    required
                    maxLength={80}
                    id="invite-nome"
                    value={form.nome}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        nome: e.target.value.replace(/[^a-zA-ZÀ-ÿ\s]/g, ""),
                      })
                    }
                    placeholder="Nome da pessoa"
                    className="h-11 w-full rounded-[10px] border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder-slate-400 outline-none transition-colors focus:border-[#00a88e] focus:ring-2 focus:ring-teal-500/10"
                  />
                </div>
                <div>
                  <label
                    htmlFor="invite-email"
                    className="mb-1.5 block text-[13px] font-medium text-slate-700"
                  >
                    E-mail
                  </label>
                  <input
                    required
                    type="email"
                    id="invite-email"
                    value={form.email}
                    onChange={(e) =>
                      setForm({ ...form, email: e.target.value })
                    }
                    placeholder="pessoa@exemplo.com"
                    className="h-11 w-full rounded-[10px] border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder-slate-400 outline-none transition-colors focus:border-[#00a88e] focus:ring-2 focus:ring-teal-500/10"
                  />
                </div>
                <div>
                  <label
                    htmlFor="invite-cargo"
                    className="mb-1.5 block text-[13px] font-medium text-slate-700"
                  >
                    Cargo na Clínica
                  </label>
                  <select
                    required
                    id="invite-cargo"
                    value={form.roleId}
                    onChange={(e) => handleRoleChangeInvite(e.target.value)}
                    className="h-11 w-full rounded-[10px] border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition-colors focus:border-[#00a88e] focus:ring-2 focus:ring-teal-500/10 appearance-none"
                  >
                    <option value="">Selecione o cargo...</option>
                    {[...roles]
                      .sort((a, b) => {
                        const ordA =
                          ROLE_DISPLAY_ORDER[(a.nome || "").toUpperCase()] ||
                          99;
                        const ordB =
                          ROLE_DISPLAY_ORDER[(b.nome || "").toUpperCase()] ||
                          99;
                        if (ordA !== ordB) return ordA - ordB;
                        return (a.nome || "").localeCompare(b.nome || "");
                      })
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {formatCargoLabel(r.nome)}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
              <div className="invite-profile-select">
                <label
                  htmlFor="invite-perfil"
                  className="mb-1.5 block text-[13px] font-medium text-slate-700"
                >
                  Perfil de acesso
                </label>
                <select
                  required
                  id="invite-perfil"
                  value={form.perfilAcessoId}
                  onChange={(e) => handlePerfilChangeInvite(e.target.value)}
                  className="h-11 w-full rounded-[10px] border border-teal-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-[#00a88e] focus:ring-2 focus:ring-teal-500/10 appearance-none"
                >
                  <option value="">Selecione o perfil de acesso...</option>
                  {[...perfisAcesso]
                    .filter(
                      (p) =>
                        (p.codigo || "").toUpperCase() !== "DONO" &&
                        (p.nome || "").toLowerCase() !== "dono",
                    )
                    .sort((a, b) => {
                      const ordA =
                        CODIGO_ORDER[(a.codigo || "").toUpperCase()] || 99;
                      const ordB =
                        CODIGO_ORDER[(b.codigo || "").toUpperCase()] || 99;
                      if (ordA !== ordB) return ordA - ordB;
                      return (a.nome || "").localeCompare(b.nome || "");
                    })
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome}
                      </option>
                    ))}
                </select>
              </div>

              {perfilSelecionado ? (
                <>
                  <section
                    className={`profile ${selectedProfileType === "cli" ? "clinic" : ""}`}
                    aria-label="Resumo do perfil de acesso"
                    aria-busy={loadingTemplate}
                  >
                    <div className="profile-main">
                      <span className="profile-icon">
                        <PrototypeIcon
                          name={
                            selectedProfileType === "cli" ? "bld" : "shield"
                          }
                        />
                      </span>
                      <div className="profile-copy">
                        <div className="profile-name-row">
                          <span className="profile-name">
                            {perfilSelecionado.nome}
                          </span>
                          <span
                            className={`tag ${selectedProfileType === "cli" ? "clinic" : ""}`}
                          >
                            <PrototypeIcon
                              name={
                                selectedProfileType === "cli" ? "bld" : "lock"
                              }
                              size="s"
                            />
                            {selectedProfileType === "cli"
                              ? "Perfil da sua Clínica"
                              : "Modelo pronto · protegido"}
                          </span>
                          {!loadingTemplate && !permissionError && (
                            <span
                              className={`tag ${perfilSelecionadoAtendeAgenda ? "tag-agenda-yes" : "tag-agenda-no"}`}
                            >
                              <PrototypeIcon
                                name={
                                  perfilSelecionadoAtendeAgenda
                                    ? "calok"
                                    : "caloff"
                                }
                                size="s"
                              />
                              {perfilSelecionadoAtendeAgenda
                                ? "Atende na agenda"
                                : "Não atende na agenda"}
                            </span>
                          )}
                        </div>
                        <p className="profile-desc">
                          {perfilSelecionado.descricao ||
                            "Perfil personalizado da clínica."}
                        </p>
                      </div>
                      {!loadingTemplate && !permissionError && (
                        <div className="profile-amount">
                          <b>{permissoesDoNivel.length}</b> /{" "}
                          {(permissoes || []).length}
                          <br />
                          <span>funções liberadas</span>
                        </div>
                      )}
                    </div>
                    {!loadingTemplate && !permissionError && (
                      <div className="profile-actions">
                        <span className="protection">
                          <PrototypeIcon
                            name={
                              selectedProfileType === "cli" ? "bld" : "lock"
                            }
                            size="s"
                          />
                          {selectedProfileType === "cli"
                            ? "Você pode editar este perfil ou criar outro a partir dele."
                            : "Protegido pelo sistema. Personalize criando uma cópia."}
                        </span>
                        {canEditConfigPerfil && onEditarPerfilNaAba && (
                          <div className="profile-buttons">
                            {selectedProfileType === "tpl" && (
                              <button
                                type="button"
                                className="action"
                                onClick={() => handlePerfilAction(true)}
                              >
                                <PrototypeIcon name="copy" size="s" />
                                Criar perfil com base neste modelo
                              </button>
                            )}
                            {selectedProfileType === "cli" && (
                              <>
                                <button
                                  type="button"
                                  className="action"
                                  onClick={() => handlePerfilAction(false)}
                                >
                                  <PrototypeIcon name="pen" size="s" />
                                  Editar este perfil
                                </button>
                                <button
                                  type="button"
                                  className="action secondary"
                                  onClick={() => handlePerfilAction(true)}
                                >
                                  <PrototypeIcon name="copy" size="s" />
                                  Criar novo com base neste
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </section>
                  {loadingTemplate ? (
                    <p role="status">Carregando funções…</p>
                  ) : permissionError ? (
                    <p role="alert">
                      Não foi possível carregar as permissões.{" "}
                      <button
                        type="button"
                        className="action"
                        onClick={() =>
                          loadPermissoesDoNivel(form.perfilAcessoId)
                        }
                      >
                        Tentar novamente
                      </button>
                    </p>
                  ) : (
                    <>
                      <div className="permission-title">
                        <h3>O que este perfil pode fazer</h3>
                        <span className="count-chip">
                          {permissoesDoNivel.length} de{" "}
                          {(permissoes || []).length}
                        </span>
                        <span className="aside">
                          <PrototypeIcon name="info" size="s" />
                          Toque em um módulo para detalhar
                        </span>
                      </div>
                      <div
                        className="matrix"
                        role="group"
                        aria-label="Módulos do perfil"
                      >
                        {modules.map((m) => {
                          const status = !m.selected.length
                            ? { tone: "off", label: "Sem acesso" }
                            : m.selected.length === m.permissions.length
                              ? { tone: "", label: "Completo" }
                              : { tone: "partial", label: "Parcial" };
                          return (
                            <button
                              type="button"
                              key={m.key}
                              className="module"
                              aria-label={`${m.name} ${m.selected.length}/${m.permissions.length} liberadas ${status.label}`}
                              aria-expanded={expandedModuleKey === m.key}
                              aria-controls="module-detail"
                              onClick={() =>
                                setExpandedModuleKey((current) =>
                                  current === m.key ? null : m.key,
                                )
                              }
                            >
                              <PrototypeIcon name={m.icon} />
                              <span className="module-info">
                                <b>{m.name}</b>
                                <span>
                                  {m.selected.length}/{m.permissions.length}{" "}
                                  liberadas
                                </span>
                              </span>
                              <span className={`badge ${status.tone}`}>
                                {status.label}
                              </span>
                              <span className="module-chevron">
                                <PrototypeIcon name="cd" size="s" />
                              </span>
                            </button>
                          );
                        })}
                        {expandedModuleKey !== null && selectedModule && (
                          <section
                            id="module-detail"
                            className="module-detail"
                            aria-label={`Funções de ${selectedModule.name}`}
                          >
                            <div className="detail-title">
                              <PrototypeIcon name={selectedModule.icon} />
                              <h4>{selectedModule.name}</h4>
                              <span>
                                {selectedModule.selected.length} de{" "}
                                {selectedModule.permissions.length} liberadas
                              </span>
                            </div>
                            <ul className="permission-list">
                              {selectedModule.permissions.map((permission) => {
                                const allowed = permissoesDoNivel.includes(
                                  permission.permissaoId,
                                );
                                return (
                                  <li
                                    key={permission.permissaoId}
                                    className={`permission-item ${allowed ? "" : "blocked"}`}
                                  >
                                    <span className="permission-status">
                                      <PrototypeIcon
                                        name={allowed ? "check" : "lock"}
                                        size="s"
                                      />
                                    </span>
                                    <span className="permission-name">
                                      {permission.nome}
                                    </span>
                                    <span className="status-text">
                                      {allowed ? "Liberada" : "Bloqueada"}
                                    </span>
                                  </li>
                                );
                              })}
                            </ul>
                            <p className="detail-hint">
                              <PrototypeIcon name="info" size="s" />
                              Para ajustar funções, use a ação de personalizar o
                              perfil acima.
                            </p>
                          </section>
                        )}
                      </div>
                      {selectedProfileType === "cli" && (
                        <p className="invite-note">
                          Atenção: alterações afetam os colaboradores que já
                          utilizam este perfil.
                        </p>
                      )}
                    </>
                  )}
                </>
              ) : (
                <div className="invite-empty">
                  <PrototypeIcon name="shield" size="s" /> Escolha um perfil
                  para conferir o acesso desta pessoa.
                </div>
              )}
              <section className="border-t border-slate-200 pt-4">
                <h3 className="mb-3 text-[15px] font-semibold">
                  Dados pessoais e acesso
                </h3>
                <p className="invite-note">
                  O acesso será criado com a senha inicial informada.
                </p>
                <div className="invite-grid">
                  <div>
                    <label
                      htmlFor="invite-cpf"
                      className="mb-1.5 block text-[13px] font-medium text-slate-700"
                    >
                      CPF
                    </label>
                    <input
                      required
                      id="invite-cpf"
                      value={form.cpf}
                      onChange={(e) =>
                        setForm({ ...form, cpf: maskCPF(e.target.value) })
                      }
                      placeholder="123.456.789-10"
                      maxLength={14}
                      className="h-11 w-full rounded-[10px] border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder-slate-400 outline-none transition-colors focus:border-[#00a88e] focus:ring-2 focus:ring-teal-500/10"
                    />
                  </div>
                  <div>
                    <label htmlFor="invite-senha">Senha inicial</label>
                    <div className="invite-password">
                      <input
                        required
                        type={showSenha ? "text" : "password"}
                        autoComplete="new-password"
                        minLength={8}
                        id="invite-senha"
                        value={form.senha}
                        onChange={(e) =>
                          setForm({ ...form, senha: e.target.value })
                        }
                        placeholder="Mínimo 8 caracteres"
                        className="h-11 w-full rounded-[10px] border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder-slate-400 outline-none transition-colors focus:border-[#00a88e] focus:ring-2 focus:ring-teal-500/10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSenha(!showSenha)}
                        aria-label={
                          showSenha ? "Ocultar senha" : "Mostrar senha"
                        }
                        aria-pressed={showSenha}
                        className="btn-s invite-password-toggle"
                      >
                        {showSenha ? (
                          <EyeOff size={20} aria-hidden="true" />
                        ) : (
                          <Eye size={20} aria-hidden="true" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label
                      htmlFor="invite-data-nascimento"
                      className="mb-1.5 block text-[13px] font-medium text-slate-700"
                    >
                      Data de Nascimento{" "}
                      <span className="font-normal text-slate-400 normal-case">
                        (Opcional)
                      </span>
                    </label>
                    <input
                      type="date"
                      max={hojeIso ?? undefined}
                      min="1900-01-01"
                      id="invite-data-nascimento"
                      value={form.dataNascimento}
                      onChange={(e) => {
                        if (e.target.value.length <= 10)
                          setForm({ ...form, dataNascimento: e.target.value });
                      }}
                      className="h-11 w-full rounded-[10px] border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition-colors focus:border-[#00a88e] focus:ring-2 focus:ring-teal-500/10"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="invite-estado-civil"
                      className="mb-1.5 block text-[13px] font-medium text-slate-700"
                    >
                      Estado Civil{" "}
                      <span className="font-normal text-slate-400 normal-case">
                        (Opcional)
                      </span>
                    </label>
                    <EstadoCivilSelect
                      id="invite-estado-civil"
                      value={form.estadoCivilId}
                      onChange={(v) => setForm({ ...form, estadoCivilId: v })}
                      selectClassName="h-11 w-full rounded-[10px] border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition-colors focus:border-[#00a88e] focus:ring-2 focus:ring-teal-500/10 appearance-none"
                    />
                  </div>
                  <div>
                    <label>País / DDI</label>
                    <select
                      aria-label="País do telefone"
                      title={countrySelectDisplayLabel(
                        getCountryByCode(telefoneCountryCode),
                      )}
                      value={telefoneCountryCode}
                      onChange={(e) => {
                        setTelefoneCountryCode(e.target.value);
                        setTelefoneNumero("");
                      }}
                      className="h-11 w-full rounded-[10px] border border-slate-200 bg-white px-3"
                    >
                      {COUNTRY_PHONE_CODES.map((country) => (
                        <option key={country.code} value={country.code}>
                          {countrySelectDisplayLabel(country)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="invite-telefone"
                      className="mb-1.5 block text-[13px] font-medium text-slate-700"
                    >
                      Telefone Celular (Opcional)
                    </label>
                    <div className={phoneWrapClass()}>
                      <div className="flex min-w-0 flex-1 items-stretch gap-0.5">
                        <input
                          type="tel"
                          id="invite-telefone"
                          value={telefoneNumero}
                          onChange={(e) =>
                            setTelefoneNumero(
                              formatPhoneAsYouType(
                                telefoneCountryCode,
                                e.target.value,
                              ),
                            )
                          }
                          onBlur={() => setTelefoneTouched(true)}
                          placeholder="99999-9999"
                          className="w-full min-w-0 flex-1 bg-transparent text-[14px] text-slate-900 placeholder-slate-400 outline-none"
                        />
                      </div>
                    </div>
                    {telefoneTouched &&
                      telefoneNumero &&
                      !isPhoneValid(telefoneCountryCode, telefoneNumero) && (
                        <p className="mt-1 text-xs text-red-600">
                          Verifique o número de telefone.
                        </p>
                      )}
                  </div>
                </div>
              </section>
              {/* Nova Seção: Especialidades */}
              <div className={sectionClass}>
                <h3 className="mb-3 text-[15px] font-semibold text-slate-900">
                  Especialidades (Opcional)
                </h3>
                <div className="grid grid-cols-1">
                  <div>
                    <div className="invite-specialties">
                      {(especialidadesList || []).map((esp) => (
                        <label
                          key={esp.id}
                          className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 bg-slate-50 cursor-pointer hover:bg-slate-100"
                        >
                          <input
                            type="checkbox"
                            checked={form.especialidades.includes(esp.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setForm({
                                  ...form,
                                  especialidades: [
                                    ...form.especialidades,
                                    esp.id,
                                  ],
                                });
                              } else {
                                setForm({
                                  ...form,
                                  especialidades: form.especialidades.filter(
                                    (id) => id !== esp.id,
                                  ),
                                });
                              }
                            }}
                            className="h-4 w-4 text-[#00a88e] rounded border-slate-300 focus:ring-[#00a88e]"
                          />
                          <span className="text-[13px] font-medium text-slate-700">
                            {esp.nome}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <details className="border-t border-slate-200 pt-3">
                <summary className="cursor-pointer py-2 text-[13px] font-semibold text-[#007f6b]">
                  Endereço (opcional)
                </summary>{" "}
                {/* Nova Seção: Endereço */}
                <div className={sectionClass}>
                  <div className={`invite-grid`}>
                    <div>
                      <label
                        htmlFor="invite-cep"
                        className="mb-1.5 block text-[13px] font-medium text-slate-700"
                      >
                        CEP
                      </label>
                      <input
                        id="invite-cep"
                        value={form.cep}
                        onChange={handleCepChange}
                        placeholder="00000-000"
                        maxLength={9}
                        className="h-11 w-full rounded-[10px] border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder-slate-400 outline-none transition-colors focus:border-[#00a88e] focus:ring-2 focus:ring-teal-500/10"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="invite-logradouro"
                        className="mb-1.5 block text-[13px] font-medium text-slate-700"
                      >
                        Logradouro
                      </label>
                      <input
                        id="invite-logradouro"
                        value={form.logradouro}
                        onChange={(e) =>
                          setForm({ ...form, logradouro: e.target.value })
                        }
                        placeholder="Ex: Rua das Flores"
                        className="h-11 w-full rounded-[10px] border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder-slate-400 outline-none transition-colors focus:border-[#00a88e] focus:ring-2 focus:ring-teal-500/10"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="invite-numero"
                        className="mb-1.5 block text-[13px] font-medium text-slate-700"
                      >
                        Número
                      </label>
                      <input
                        id="invite-numero"
                        value={form.numero}
                        onChange={(e) =>
                          setForm({ ...form, numero: e.target.value })
                        }
                        placeholder="Ex: 123"
                        className="h-11 w-full rounded-[10px] border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder-slate-400 outline-none transition-colors focus:border-[#00a88e] focus:ring-2 focus:ring-teal-500/10"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="invite-complemento"
                        className="mb-1.5 block text-[13px] font-medium text-slate-700"
                      >
                        Complemento
                      </label>
                      <input
                        id="invite-complemento"
                        value={form.complemento}
                        onChange={(e) =>
                          setForm({ ...form, complemento: e.target.value })
                        }
                        placeholder="Ex: Apto 42"
                        className="h-11 w-full rounded-[10px] border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder-slate-400 outline-none transition-colors focus:border-[#00a88e] focus:ring-2 focus:ring-teal-500/10"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="invite-bairro"
                        className="mb-1.5 block text-[13px] font-medium text-slate-700"
                      >
                        Bairro
                      </label>
                      <input
                        id="invite-bairro"
                        value={form.bairro}
                        onChange={(e) =>
                          setForm({ ...form, bairro: e.target.value })
                        }
                        placeholder="Ex: Centro"
                        className="h-11 w-full rounded-[10px] border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder-slate-400 outline-none transition-colors focus:border-[#00a88e] focus:ring-2 focus:ring-teal-500/10"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label
                          htmlFor="invite-cidade"
                          className="mb-1.5 block text-[13px] font-medium text-slate-700"
                        >
                          Cidade
                        </label>
                        <input
                          id="invite-cidade"
                          value={form.cidade}
                          onChange={(e) =>
                            setForm({ ...form, cidade: e.target.value })
                          }
                          placeholder="Ex: São Paulo"
                          className="h-11 w-full rounded-[10px] border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder-slate-400 outline-none transition-colors focus:border-[#00a88e] focus:ring-2 focus:ring-teal-500/10"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="invite-uf"
                          className="mb-1.5 block text-[13px] font-medium text-slate-700"
                        >
                          UF
                        </label>
                        <input
                          id="invite-uf"
                          value={form.uf}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              uf: e.target.value.toUpperCase(),
                            })
                          }
                          placeholder="Ex: SP"
                          maxLength={2}
                          className="h-11 w-full rounded-[10px] border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder-slate-400 outline-none transition-colors focus:border-[#00a88e] focus:ring-2 focus:ring-teal-500/10"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </details>
            </div>

            <div className="invite-foot">
              <span className="foot-hint">
                <PrototypeIcon name="shield-check" size="s" />
                Você controla o acesso à sua clínica.
              </span>
              <button
                type="button"
                onClick={handleClose}
                className="invite-footer-button"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving || loadingTemplate || permissionError}
                className="invite-footer-button primary disabled:opacity-60 disabled:pointer-events-none"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {saving ? "Criando..." : "Criar acesso"}
                {!saving && <PrototypeIcon name="cr" size="s" />}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body,
  );
}
