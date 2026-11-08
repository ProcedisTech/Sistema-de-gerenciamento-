import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
  criarPerfilComPermissoes,
} from "./gestaoUsuariosUtils";
import PrototypeIcon from "./PrototypeIcon";
import {
  profileType,
  summarizeModules,
  PROTOTYPE_OPERATIONAL_CODES as OPERACIONAIS,
  PROTOTYPE_ROOT_CODES as RAIZES,
} from "./equipePrototypeUtils";

const etiquetasNivel = {
  1: "Só ver",
  2: "Ver e editar",
  3: "Tudo",
  0: "Sem acesso",
};
import {
  maskCPF,
  normalizeCpf,
  isCpfValidCheckDigits,
} from "../utils/formatters.js";
import { isPacienteEmailFormatValid } from "../../utils/patientFormValidation.js";
import "./equipePrototypeBase.css";
import "./invitePrototype.css";

import { EstadoCivilSelect } from "../patients/EstadoCivilSelect.jsx";
import { useAgoraDaClinica } from "../hooks/useAgoraDaClinica.js";

const FieldReq = () => (
  <span className="text-red-500 font-bold ml-0.5" aria-hidden="true" title="Campo obrigatório">
    *
  </span>
);

export function InviteModal({
  equipeMembros = [],
  roles,
  perfisAcesso,
  permissoes,
  especialidadesList,
  onClose,
  onSuccess,
  fetchHeaders,
  canEditConfigPerfil: _canEditConfigPerfil = false,
  onEditarPerfilNaAba: _onEditarPerfilNaAba,
  initialDraft,
}) {
  const toast = useToast();
  const dialogRef = useRef(null);
  const { hojeIso } = useAgoraDaClinica(60000);
  const [serverCpfError, setServerCpfError] = useState("");

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
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const markTouched = useCallback((field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }, []);
  const [showSenha, setShowSenha] = useState(false);

  // Permissões e customização inline de perfil de acesso
  const [permissoesDoNivel, setPermissoesDoNivel] = useState([]);
  const originalPermissoesRef = useRef([]);
  const [isPerfilCustomizado, setIsPerfilCustomizado] = useState(false);
  const [modalNovoPerfilAberto, setModalNovoPerfilAberto] = useState(false);
  const [novoPerfilNome, setNovoPerfilNome] = useState("");
  const [novoPerfilDesc, setNovoPerfilDesc] = useState("");
  const [novoPerfilError, setNovoPerfilError] = useState("");

  const [expandedModuleKey, setExpandedModuleKey] = useState(null);
  const inviteModuleDetailRef = useRef(null);

  useEffect(() => {
    if (
      expandedModuleKey &&
      typeof inviteModuleDetailRef.current?.scrollIntoView === "function"
    ) {
      inviteModuleDetailRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [expandedModuleKey]);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [permissionError, setPermissionError] = useState(false);
  const permissionRequest = useRef(0);
  const perfilEscolhidoManualmente = useRef(
    Boolean(initialDraft?.form?.perfilAcessoId),
  );
  const profileTriggerRef = useRef(null);
  const profileDropdownRef = useRef(null);
  const emptyProfileBtnRef = useRef(null);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  const perfisDisponiveis = useMemo(() => {
    return [...(perfisAcesso || [])]
      .filter(
        (p) =>
          (p.codigo || "").toUpperCase() !== "DONO" &&
          (p.nome || "").toLowerCase() !== "dono",
      )
      .sort((a, b) => {
        const ordA = CODIGO_ORDER[(a.codigo || "").toUpperCase()] || 99;
        const ordB = CODIGO_ORDER[(b.codigo || "").toUpperCase()] || 99;
        if (ordA !== ordB) return ordA - ordB;
        return (a.nome || "").localeCompare(b.nome || "");
      });
  }, [perfisAcesso]);

  const perfisClinica = useMemo(() => {
    return perfisDisponiveis.filter((p) => profileType(p) === "cli");
  }, [perfisDisponiveis]);

  const perfisModelos = useMemo(() => {
    return perfisDisponiveis.filter((p) => profileType(p) !== "cli");
  }, [perfisDisponiveis]);

  const loadPermissoesDoNivel = async (perfilId) => {
    const request = ++permissionRequest.current;
    setExpandedModuleKey(null);
    setPermissionError(false);
    if (!perfilId) {
      setPermissoesDoNivel([]);
      originalPermissoesRef.current = [];
      setIsPerfilCustomizado(false);
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
      if (request === permissionRequest.current) {
        setPermissoesDoNivel(data);
        originalPermissoesRef.current = data;
        setIsPerfilCustomizado(false);
      }
    } catch (e) {
      console.error("Erro ao carregar permissões do nível:", e);
      if (request === permissionRequest.current) setPermissionError(true);
    } finally {
      if (request === permissionRequest.current) setLoadingTemplate(false);
    }
  };

  const checkCustomizacao = useCallback((nextPerms) => {
    const orig = new Set(originalPermissoesRef.current || []);
    if (nextPerms.length !== orig.size) return true;
    return nextPerms.some((id) => !orig.has(id));
  }, []);

  const togglePermissao = useCallback((permissaoId) => {
    setPermissoesDoNivel((prev) => {
      const next = prev.includes(permissaoId)
        ? prev.filter((id) => id !== permissaoId)
        : [...prev, permissaoId];
      setIsPerfilCustomizado(checkCustomizacao(next));
      return next;
    });
  }, [checkCustomizacao]);

  const restaurarPerfilBase = useCallback(() => {
    setPermissoesDoNivel([...originalPermissoesRef.current]);
    setIsPerfilCustomizado(false);
    toast.success("Permissões restauradas para o modelo base.");
  }, [toast]);

  const aplicarAcessoEmLote = useCallback((modo, moduleObj) => {
    if (!moduleObj) return;
    const modPermIds = new Set(moduleObj.permissions.map((p) => p.permissaoId));

    setPermissoesDoNivel((prev) => {
      const nextWithoutThisModule = prev.filter((id) => !modPermIds.has(id));
      let idsToAdd = [];

      if (modo === "tudo" || modo === "3") {
        idsToAdd = moduleObj.permissions.map((p) => p.permissaoId);
      } else if (modo === "sem_acesso" || modo === "0") {
        idsToAdd = [];
      } else if (modo === "so_ver" || modo === "1") {
        idsToAdd = moduleObj.permissions
          .filter((p) => {
            const cod = (p.codigo || "").toUpperCase();
            return (
              RAIZES.has(cod) ||
              cod.endsWith("_VER") ||
              (p.nome || "").toLowerCase().includes("visualizar") ||
              (p.nome || "").toLowerCase().includes("ver ")
            );
          })
          .map((p) => p.permissaoId);
      } else if (modo === "ver_editar" || modo === "2") {
        idsToAdd = moduleObj.permissions
          .filter((p) => {
            const cod = (p.codigo || "").toUpperCase();
            return (
              OPERACIONAIS.has(cod) ||
              RAIZES.has(cod) ||
              cod.endsWith("_VER")
            );
          })
          .map((p) => p.permissaoId);
      }

      const next = [...nextWithoutThisModule, ...idsToAdd];
      setIsPerfilCustomizado(checkCustomizacao(next));
      return next;
    });
  }, [checkCustomizacao]);

  const diffCalculado = useMemo(() => {
    const origSet = new Set(originalPermissoesRef.current || []);
    let adicionadas = 0;
    let desmarcadas = 0;

    permissoesDoNivel.forEach((id) => {
      if (!origSet.has(id)) adicionadas++;
    });
    origSet.forEach((id) => {
      if (!permissoesDoNivel.includes(id)) desmarcadas++;
    });

    return { adicionadas, desmarcadas };
  }, [permissoesDoNivel]);


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
    const handleClickOutside = (e) => {
      if (
        e.target.closest(".btn-change-profile") ||
        e.target.closest("#emptyProfileBtn")
      ) {
        return;
      }
      if (
        profileDropdownRef.current &&
        !profileDropdownRef.current.contains(e.target)
      ) {
        setProfileDropdownOpen(false);
      }
    };
    if (profileDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [profileDropdownOpen]);

  useEffect(() => {
    if (profileDropdownOpen && profileDropdownRef.current) {
      setTimeout(() => {
        if (typeof profileDropdownRef.current?.scrollIntoView === "function") {
          profileDropdownRef.current.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
          });
        }
      }, 50);
    }
  }, [profileDropdownOpen]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        if (modalNovoPerfilAberto) {
          event.preventDefault();
          setModalNovoPerfilAberto(false);
          return;
        }
        if (profileDropdownOpen) {
          event.preventDefault();
          setProfileDropdownOpen(false);
          return;
        }
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
  }, [handleClose, modalNovoPerfilAberto, profileDropdownOpen]);

  const handleRoleChangeInvite = (selectedRoleId) => {
    markTouched("role");
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
    markTouched("perfil");
    perfilEscolhidoManualmente.current = Boolean(selectedPerfilId);
    setForm((prev) => ({ ...prev, perfilAcessoId: selectedPerfilId }));
    loadPermissoesDoNivel(selectedPerfilId);
  };

  const validateFormBasics = useCallback(() => {
    const errs = {};

    // 1. Cargo oficial na Clínica
    if (!form.roleId) {
      errs.role = "Selecione um papel.";
    }

    // 2. Perfil de acesso
    if (!form.perfilAcessoId) {
      errs.perfil = "Selecione um nível de permissão.";
    }

    // 3. Nome completo
    const nomeTrim = (form.nome || "").trim();
    if (!nomeTrim) {
      errs.nome = "O nome completo é obrigatório.";
    } else if (nomeTrim.length < 2) {
      errs.nome = "O nome deve ter no mínimo 2 caracteres.";
    }

    // 4. E-mail profissional
    const emailTrim = (form.email || "").trim();
    if (!emailTrim) {
      errs.email = "O e-mail profissional é obrigatório.";
    } else if (!isPacienteEmailFormatValid(emailTrim)) {
      errs.email = "Informe um e-mail profissional válido.";
    }

    // 5. CPF
    const cpfDigits = normalizeCpf(form.cpf || "");
    if (!cpfDigits) {
      errs.cpf = "O CPF é obrigatório.";
    } else if (cpfDigits.length !== 11) {
      errs.cpf = "O CPF deve conter exatamente 11 dígitos.";
    } else if (!isCpfValidCheckDigits(cpfDigits)) {
      errs.cpf = "CPF inválido. Verifique os números digitados.";
    } else if (
      Array.isArray(equipeMembros) &&
      equipeMembros.some((m) => normalizeCpf(m.cpf || "") === cpfDigits)
    ) {
      errs.cpf = "Já existe um usuário cadastrado com este CPF.";
    } else if (serverCpfError) {
      errs.cpf = serverCpfError;
    }

    // 6. Senha inicial
    if (!form.senha) {
      errs.senha = "A senha inicial de acesso é obrigatória.";
    } else if (form.senha.length < 8) {
      errs.senha = "A senha deve ter no mínimo 8 caracteres.";
    }

    // 7. Data de nascimento
    if (!form.dataNascimento) {
      errs.dataNascimento = "A data de nascimento é obrigatória.";
    } else if (form.dataNascimento < "1900-01-01") {
      errs.dataNascimento = "Data de nascimento inválida (ano anterior a 1900).";
    } else if (hojeIso && form.dataNascimento > hojeIso) {
      errs.dataNascimento = "A data de nascimento não pode ser no futuro.";
    }

    // 8. Estado civil
    if (!form.estadoCivilId) {
      errs.estadoCivil = "Selecione o estado civil.";
    }

    // 9. Telefone Celular
    const telTrim = (telefoneNumero || "").trim();
    if (!telTrim) {
      errs.telefone = "O telefone celular é obrigatório.";
    } else if (!isPhoneValid(telefoneCountryCode, telTrim)) {
      errs.telefone = "Informe um número de telefone celular completo e válido.";
    }

    return errs;
  }, [form, telefoneNumero, telefoneCountryCode, hojeIso, equipeMembros, serverCpfError]);

  const formErrors = useMemo(() => {
    return validateFormBasics();
  }, [validateFormBasics]);

  const isFieldInvalid = (fieldName) => {
    return Boolean(
      (touched[fieldName] || submitted) &&
      (formErrors[fieldName] || (fieldName === "cpf" && serverCpfError)),
    );
  };

  const executarCriacaoUsuario = async (perfilAcessoIdParaVincular) => {
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
        if (profileRes.status === 409) {
          const cpfMsg =
            profileErr.message ||
            "Já existe um usuário cadastrado com este CPF.";
          setServerCpfError(cpfMsg);
          setTouched((prev) => ({ ...prev, cpf: true }));
          document.getElementById("invite-cpf")?.focus();
          toast.error(cpfMsg);
          return;
        }
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
          perfilAcessoId: perfilAcessoIdParaVincular,
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
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const confirmarSalvarNovoPerfilEUsuario = async () => {
    const nomeTrim = novoPerfilNome.trim();
    if (!nomeTrim) {
      setNovoPerfilError("Informe um nome para o novo perfil.");
      document.getElementById("novo-perfil-nome")?.focus();
      return;
    }
    setNovoPerfilError("");
    setSaving(true);
    try {
      const perfilCriado = await criarPerfilComPermissoes({
        nome: nomeTrim,
        descricao: novoPerfilDesc.trim(),
        permissoes: permissoesDoNivel,
        fetchHeaders,
      });

      await executarCriacaoUsuario(perfilCriado.id);
      setModalNovoPerfilAberto(false);
    } catch (err) {
      toast.error(err.message || "Erro ao criar novo perfil.");
      setSaving(false);
    }
  };

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setSubmitted(true);
    const errors = validateFormBasics();

    if (Object.keys(errors).length > 0) {
      setTouched({
        nome: true,
        email: true,
        cpf: true,
        senha: true,
        dataNascimento: true,
        estadoCivil: true,
        telefone: true,
        role: true,
        perfil: true,
      });

      // Foco e toast no primeiro erro por ordem de prioridade
      if (errors.role) {
        document.getElementById("invite-cargo")?.focus();
        return toast.error(errors.role);
      }
      if (errors.perfil) {
        (emptyProfileBtnRef.current || profileTriggerRef.current)?.focus();
        return toast.error(errors.perfil);
      }
      if (errors.nome) {
        document.getElementById("invite-nome")?.focus();
        return toast.error(errors.nome);
      }
      if (errors.email) {
        document.getElementById("invite-email")?.focus();
        return toast.error(errors.email);
      }
      if (errors.cpf) {
        document.getElementById("invite-cpf")?.focus();
        return toast.error(errors.cpf);
      }
      if (errors.senha) {
        document.getElementById("invite-senha")?.focus();
        return toast.error(errors.senha);
      }
      if (errors.dataNascimento) {
        document.getElementById("invite-data-nascimento")?.focus();
        return toast.error(errors.dataNascimento);
      }
      if (errors.estadoCivil) {
        document.getElementById("invite-estado-civil")?.focus();
        return toast.error(errors.estadoCivil);
      }
      if (errors.telefone) {
        document.getElementById("invite-telefone")?.focus();
        return toast.error(errors.telefone);
      }
      return;
    }

    // Se o perfil foi customizado, abre o modal intermediário para nomear o novo perfil
    if (isPerfilCustomizado) {
      const cargo = roles.find((r) => String(r.id) === String(form.roleId));
      const cargoNome = cargo ? formatCargoLabel(cargo.nome) : "";
      const baseNome = perfilSelecionado?.nome || "Perfil";
      const sugestao = cargoNome
        ? `${cargoNome} Personalizado`
        : `${baseNome} Personalizado`;
      setNovoPerfilNome(sugestao);
      setNovoPerfilDesc(
        `Perfil personalizado na clínica com base em ${baseNome} (${permissoesDoNivel.length} funções liberadas).`,
      );
      setNovoPerfilError("");
      setModalNovoPerfilAberto(true);
      return;
    }

    await executarCriacaoUsuario(form.perfilAcessoId);
  };


  const perfilSelecionado = (perfisAcesso || []).find(
    (p) => String(p.id) === String(form.perfilAcessoId),
  );
  const agendaPermId = (permissoes || []).find(
    (p) => p.codigo === "AGENDA_APARECER",
  )?.permissaoId;
  const perfilSelecionadoAtendeAgenda = Boolean(
    agendaPermId && permissoesDoNivel.includes(agendaPermId),
  );
  const modules = summarizeModules(permissoes, permissoesDoNivel).filter(
    (m) => m.permissions.length > 0,
  );
  const selectedModule = modules.find(
    (module) => module.key === expandedModuleKey,
  );
  const selectedProfileType = profileType(perfilSelecionado);

  const camposPreenchidos = useMemo(() => {
    let count = 0;
    if (form.nome && form.nome.trim().length >= 2) count++;
    if (form.email && isPacienteEmailFormatValid(form.email.trim())) count++;
    const cpfDigits = normalizeCpf(form.cpf || "");
    const isCpfDuplicate =
      Array.isArray(equipeMembros) &&
      equipeMembros.some((m) => normalizeCpf(m.cpf || "") === cpfDigits);
    if (
      cpfDigits.length === 11 &&
      isCpfValidCheckDigits(cpfDigits) &&
      !isCpfDuplicate &&
      !serverCpfError
    ) {
      count++;
    }
    if (form.senha && form.senha.length >= 8) count++;
    if (
      form.dataNascimento &&
      form.dataNascimento >= "1900-01-01" &&
      (!hojeIso || form.dataNascimento <= hojeIso)
    ) {
      count++;
    }
    if (form.estadoCivilId) count++;
    if (
      telefoneNumero &&
      isPhoneValid(telefoneCountryCode, telefoneNumero.trim())
    ) {
      count++;
    }
    if (form.roleId) count++;
    if (form.perfilAcessoId) count++;
    return count;
  }, [form, telefoneNumero, telefoneCountryCode, hojeIso, equipeMembros, serverCpfError]);

  const progressoPorcentagem = Math.round((camposPreenchidos / 9) * 100);

  const cargoAtual = (roles || []).find(
    (r) => String(r.id) === String(form.roleId),
  );
  const isSugestaoAutomatica = Boolean(
    cargoAtual?.perfilAcessoPadraoId &&
    String(form.perfilAcessoId) === String(cargoAtual.perfilAcessoPadraoId) &&
    !perfilEscolhidoManualmente.current,
  );

  return createPortal(
    <div className="prototype-equipe prototype-invite">
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-hidden">
        {/* Backdrop limpo e animado suavemente */}
        <div
          className="fixed inset-0 bg-slate-900/40 pointer-events-auto transition-opacity modal-backdrop-animate"
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
          className="modal-card invite-dialog relative z-10 mx-auto flex max-h-[90vh] w-full max-w-[930px] flex-col overflow-hidden bg-white outline-none"
        >
          <div className="modal-head invite-head">
            <span className="head-icon">
              <PrototypeIcon name="uplus" />
            </span>
            <div className="head-info invite-heading">
              <h2
                id="invite-title"
              >
                Convidar pessoa
              </h2>
              <p
                id="invite-description"
              >
                Adicione alguém à equipe e configure suas informações de acesso.
              </p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              aria-label="Fechar convite"
              title="Fechar modal (Esc)"
              className="modal-close invite-close"
            >
              <PrototypeIcon name="x" />
            </button>
          </div>

          <form
            onSubmit={handleSubmit}
            noValidate
            className="flex-1 flex flex-col min-h-0"
          >
            <div className="modal-body invite-scroll flex-1 min-h-0 overflow-y-auto">
              {/* Barra de Progresso dos 9 Campos Obrigatórios */}
              <div className="required-progress-card">
                <div className="required-progress-header">
                  <span className="required-progress-text">
                    <PrototypeIcon name="check" size="s" />
                    <span>{camposPreenchidos} de 9 campos obrigatórios preenchidos</span>
                  </span>
                  <span className="required-legend">
                    <span className="field-req">*</span> Campos obrigatórios
                  </span>
                </div>
                <div className="required-progress-track">
                  <div
                    className="required-progress-bar"
                    style={{ width: `${progressoPorcentagem}%` }}
                  />
                </div>
              </div>

              {/* 1. INFORMAÇÕES PESSOAIS E DE ACESSO */}
              <div className="section-title-wrap">
                <div className="section-title">
                  <PrototypeIcon name="users" size="s" />
                  <span>Informações Pessoais e de Acesso</span>
                </div>
                <div className="section-subtitle">
                  Preencha os dados de cadastro e defina a senha inicial de acesso.
                </div>
              </div>

              <div className="fields-grid">
                {/* Nome Completo */}
                <div className="field-group">
                  <label
                    htmlFor="invite-nome"
                    className="field-label"
                  >
                    <span>Nome Completo <FieldReq /></span>
                  </label>
                  <input
                    required
                    maxLength={80}
                    id="invite-nome"
                    aria-label="Nome Completo"
                    value={form.nome}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        nome: e.target.value.replace(/[^a-zA-ZÀ-ÿ\s]/g, ""),
                      })
                    }
                    onBlur={() => markTouched("nome")}
                    placeholder="Ex: Dra. Mariana Costa"
                    className={`input-control ${isFieldInvalid("nome") ? "has-error" : ""}`}
                  />
                  {isFieldInvalid("nome") && (
                    <span className="field-error-msg">{formErrors.nome}</span>
                  )}
                </div>

                {/* E-mail */}
                <div className="field-group">
                  <label
                    htmlFor="invite-email"
                    className="field-label"
                  >
                    <span>E-mail <FieldReq /></span>
                  </label>
                  <input
                    required
                    type="email"
                    id="invite-email"
                    aria-label="E-mail"
                    value={form.email}
                    onChange={(e) =>
                      setForm({ ...form, email: e.target.value })
                    }
                    onBlur={() => markTouched("email")}
                    placeholder="mariana.costa@clinica.com"
                    className={`input-control ${isFieldInvalid("email") ? "has-error" : ""}`}
                  />
                  {isFieldInvalid("email") && (
                    <span className="field-error-msg">{formErrors.email}</span>
                  )}
                </div>

                {/* CPF */}
                <div className="field-group">
                  <label
                    htmlFor="invite-cpf"
                    className="field-label"
                  >
                    <span>CPF <FieldReq /></span>
                  </label>
                  <input
                    required
                    id="invite-cpf"
                    aria-label="CPF"
                    value={form.cpf}
                    onChange={(e) => {
                      if (serverCpfError) setServerCpfError("");
                      setForm({ ...form, cpf: maskCPF(e.target.value) });
                    }}
                    onBlur={() => markTouched("cpf")}
                    placeholder="000.000.000-00"
                    maxLength={14}
                    className={`input-control ${isFieldInvalid("cpf") ? "has-error" : ""}`}
                  />
                  {isFieldInvalid("cpf") && (
                    <span className="field-error-msg">
                      {formErrors.cpf || serverCpfError}
                    </span>
                  )}
                </div>

                {/* Senha Inicial com Toggle */}
                <div className="field-group">
                  <label htmlFor="invite-senha" className="field-label">
                    <span>Senha inicial <FieldReq /></span>
                  </label>
                  <div className="password-wrap">
                    <input
                      required
                      type={showSenha ? "text" : "password"}
                      autoComplete="new-password"
                      minLength={8}
                      id="invite-senha"
                      aria-label="Senha inicial"
                      value={form.senha}
                      onChange={(e) =>
                        setForm({ ...form, senha: e.target.value })
                      }
                      onBlur={() => markTouched("senha")}
                      placeholder="Mínimo 8 caracteres"
                      className={`input-control ${isFieldInvalid("senha") ? "has-error" : ""}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowSenha(!showSenha)}
                      aria-label={
                        showSenha ? "Ocultar senha" : "Mostrar senha"
                      }
                      aria-pressed={showSenha}
                      className="password-toggle"
                      title="Mostrar/ocultar senha"
                    >
                      {showSenha ? (
                        <EyeOff size={18} aria-hidden="true" />
                      ) : (
                        <Eye size={18} aria-hidden="true" />
                      )}
                    </button>
                  </div>
                  {isFieldInvalid("senha") && (
                    <span className="field-error-msg">{formErrors.senha}</span>
                  )}
                </div>

                {/* Data de Nascimento */}
                <div className="field-group">
                  <label
                    htmlFor="invite-data-nascimento"
                    className="field-label"
                  >
                    <span>Data de Nascimento <FieldReq /></span>
                  </label>
                  <input
                    required
                    type="date"
                    max={hojeIso ?? undefined}
                    min="1900-01-01"
                    id="invite-data-nascimento"
                    aria-label="Data de Nascimento"
                    value={form.dataNascimento}
                    onChange={(e) => {
                      if (e.target.value.length <= 10)
                        setForm({ ...form, dataNascimento: e.target.value });
                    }}
                    onBlur={() => markTouched("dataNascimento")}
                    className={`input-control ${isFieldInvalid("dataNascimento") ? "has-error" : ""}`}
                  />
                  {isFieldInvalid("dataNascimento") && (
                    <span className="field-error-msg">
                      {formErrors.dataNascimento}
                    </span>
                  )}
                </div>

                {/* Estado Civil */}
                <div className="field-group">
                  <label
                    htmlFor="invite-estado-civil"
                    className="field-label"
                  >
                    <span>Estado Civil <FieldReq /></span>
                  </label>
                  <EstadoCivilSelect
                    id="invite-estado-civil"
                    aria-label="Estado Civil"
                    value={form.estadoCivilId}
                    onChange={(v) => {
                      setForm({ ...form, estadoCivilId: v });
                      markTouched("estadoCivil");
                    }}
                    selectClassName={`select-control ${isFieldInvalid("estadoCivil") ? "has-error" : ""}`}
                  />
                  {isFieldInvalid("estadoCivil") && (
                    <span className="field-error-msg">
                      {formErrors.estadoCivil}
                    </span>
                  )}
                </div>

                {/* País / DDI */}
                <div className="field-group">
                  <label htmlFor="invite-ddi" className="field-label">
                    <span>País / DDI</span>
                  </label>
                  <select
                    id="invite-ddi"
                    aria-label="País do telefone"
                    title={countrySelectDisplayLabel(
                      getCountryByCode(telefoneCountryCode),
                    )}
                    value={telefoneCountryCode}
                    onChange={(e) => {
                      setTelefoneCountryCode(e.target.value);
                      setTelefoneNumero("");
                    }}
                    className="select-control"
                  >
                    {COUNTRY_PHONE_CODES.map((country) => (
                      <option key={country.code} value={country.code}>
                        {countrySelectDisplayLabel(country)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Telefone Celular */}
                <div className="field-group">
                  <label
                    htmlFor="invite-telefone"
                    className="field-label"
                  >
                    <span>Telefone Celular <FieldReq /></span>
                  </label>
                  <input
                    required
                    type="tel"
                    id="invite-telefone"
                    aria-label="Telefone Celular"
                    value={telefoneNumero}
                    onChange={(e) =>
                      setTelefoneNumero(
                        formatPhoneAsYouType(
                          telefoneCountryCode,
                          e.target.value,
                        ),
                      )
                    }
                    onBlur={() => markTouched("telefone")}
                    placeholder="(11) 98765-4321"
                    className={`input-control ${isFieldInvalid("telefone") ? "has-error" : ""}`}
                  />
                  {isFieldInvalid("telefone") && (
                    <span className="field-error-msg">
                      {formErrors.telefone}
                    </span>
                  )}
                </div>

                {/* Especialidades Clínicas */}
                <div className="field-group field-full">
                  <label className="field-label" style={{ justifyContent: "flex-start", gap: "6px" }}>
                    <span>Especialidades Clínicas</span>
                    <span className="field-optional">(Opcional)</span>
                  </label>
                  <div className="specialties-grid">
                    {(especialidadesList || []).map((esp) => {
                      const isChecked = form.especialidades.includes(esp.id);
                      return (
                        <label
                          key={esp.id}
                          className={`specialty-chip ${isChecked ? "checked" : ""}`}
                        >
                          <input
                            type="checkbox"
                            aria-label={esp.nome}
                            checked={isChecked}
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
                          />
                          <span>{esp.nome}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Endereço Residencial (Colapsável) */}
                <div className="field-group field-full">
                  <details className="address-details">
                    <summary>
                      <span>Endereço (opcional)</span>
                      <span style={{ fontSize: "11px", fontWeight: 600, color: "#64748b" }}>
                        Toque para expandir ▾
                      </span>
                    </summary>
                    <div className="address-content">
                      <div className="fields-grid">
                        <div className="field-group">
                          <label
                            htmlFor="invite-cep"
                            className="field-label"
                          >
                            <span>CEP</span>
                          </label>
                          <input
                            id="invite-cep"
                            aria-label="CEP"
                            value={form.cep}
                            onChange={handleCepChange}
                            placeholder="00000-000"
                            maxLength={9}
                            className="input-control"
                          />
                        </div>
                        <div className="field-group">
                          <label
                            htmlFor="invite-logradouro"
                            className="field-label"
                          >
                            <span>Logradouro</span>
                          </label>
                          <input
                            id="invite-logradouro"
                            value={form.logradouro}
                            onChange={(e) =>
                              setForm({ ...form, logradouro: e.target.value })
                            }
                            placeholder="Ex: Av. Paulista"
                            className="input-control"
                          />
                        </div>
                        <div className="field-group">
                          <label
                            htmlFor="invite-numero"
                            className="field-label"
                          >
                            <span>Número</span>
                          </label>
                          <input
                            id="invite-numero"
                            value={form.numero}
                            onChange={(e) =>
                              setForm({ ...form, numero: e.target.value })
                            }
                            placeholder="Ex: 1000"
                            className="input-control"
                          />
                        </div>
                        <div className="field-group">
                          <label
                            htmlFor="invite-complemento"
                            className="field-label"
                          >
                            <span>Complemento</span>
                          </label>
                          <input
                            id="invite-complemento"
                            value={form.complemento}
                            onChange={(e) =>
                              setForm({ ...form, complemento: e.target.value })
                            }
                            placeholder="Ex: Sala 42"
                            className="input-control"
                          />
                        </div>
                        <div className="field-group">
                          <label
                            htmlFor="invite-bairro"
                            className="field-label"
                          >
                            <span>Bairro</span>
                          </label>
                          <input
                            id="invite-bairro"
                            value={form.bairro}
                            onChange={(e) =>
                              setForm({ ...form, bairro: e.target.value })
                            }
                            placeholder="Ex: Bela Vista"
                            className="input-control"
                          />
                        </div>
                        <div className="field-group">
                          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "10px" }}>
                            <div>
                              <label
                                htmlFor="invite-cidade"
                                className="field-label"
                              >
                                <span>Cidade</span>
                              </label>
                              <input
                                id="invite-cidade"
                                value={form.cidade}
                                onChange={(e) =>
                                  setForm({ ...form, cidade: e.target.value })
                                }
                                placeholder="São Paulo"
                                className="input-control"
                              />
                            </div>
                            <div>
                              <label
                                htmlFor="invite-uf"
                                className="field-label"
                              >
                                <span>UF</span>
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
                                placeholder="SP"
                                maxLength={2}
                                className="input-control"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </details>
                </div>
              </div>

              <div className="section-divider" />

              {/* 2. GOVERNANÇA: CARGO E PERFIL DE ACESSO */}
              <div className="governance-card">
                <div className="section-title-wrap" style={{ marginBottom: 0 }}>
                  <div className="section-title">
                    <PrototypeIcon name="shield" size="s" />
                    <span>Cargo e Acesso na Clínica</span>
                  </div>
                  <div className="section-subtitle">
                    Defina a função exercida na equipe e confira as permissões liberadas antes de concluir.
                  </div>
                </div>

                {/* Cargo na Clínica */}
                <div className="field-group">
                  <label
                    htmlFor="invite-cargo"
                    className="field-label"
                  >
                    <span>Cargo na Clínica <FieldReq /></span>
                    {isSugestaoAutomatica && (
                      <span className="diff-pill neutral">
                        Sugestão Automática Aplicada
                      </span>
                    )}
                  </label>
                  <select
                    required
                    id="invite-cargo"
                    aria-label="Cargo na Clínica"
                    value={form.roleId}
                    onChange={(e) => handleRoleChangeInvite(e.target.value)}
                    onBlur={() => markTouched("role")}
                    className={`select-control ${isFieldInvalid("role") ? "has-error" : ""}`}
                  >
                    <option value="">Selecione o cargo da pessoa...</option>
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
                  {isFieldInvalid("role") && (
                    <span className="field-error-msg">{formErrors.role}</span>
                  )}
                </div>

                {/* Perfil de Acesso */}
                <div className="field-group">
                  <label
                    htmlFor="invite-perfil"
                    className="field-label"
                  >
                    <span>Perfil de Acesso <FieldReq /></span>
                  </label>

                  {/* Controle de compatibilidade para acessibilidade e testes */}
                  <select
                    id="invite-perfil"
                    aria-label="Perfil de acesso"
                    ref={profileTriggerRef}
                    value={form.perfilAcessoId}
                    onChange={(e) => handlePerfilChangeInvite(e.target.value)}
                    onBlur={() => markTouched("perfil")}
                    className="select-control sr-only"
                  >
                    <option value="">Selecione o perfil de acesso...</option>
                    {perfisClinica.length > 0 && (
                      <optgroup label="Perfis da sua clínica">
                        {perfisClinica.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nome}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {perfisModelos.length > 0 && (
                      <optgroup label="Modelos prontos do sistema">
                        {perfisModelos.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nome}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>

                  <div className={`profile-picker-container ${profileDropdownOpen ? "dropdown-open" : ""}`}>
                    {/* Dropdown de Perfis Canônico e Único */}
                    <div
                      className={`profile-dropdown-menu ${perfilSelecionado ? "popover-anchor" : "empty-anchor"} ${profileDropdownOpen ? "open" : ""}`}
                      id="profileDropdown"
                      ref={profileDropdownRef}
                      role="listbox"
                      aria-label="Perfis Disponíveis"
                    >
                      <div className="drop-header">
                        <span>Perfis Disponíveis</span>
                        <span id="profilesCount">{perfisDisponiveis.length} opções</span>
                      </div>
                      <div className="drop-list" id="profilesList">
                        {perfisDisponiveis.map((p) => {
                          const isClinic = profileType(p) === "cli";
                          const isActive = form.perfilAcessoId === p.id && !isPerfilCustomizado;
                          const iconKey = isClinic ? "bld" : "shield";
                          return (
                            <button
                              key={p.id}
                              type="button"
                              role="option"
                              aria-selected={isActive}
                              className={`drop-item ${isActive ? "active" : ""}`}
                              onClick={() => {
                                handlePerfilChangeInvite(p.id);
                                setProfileDropdownOpen(false);
                              }}
                            >
                              <div className="drop-item-left">
                                <span className={`drop-item-icon ${isClinic ? "clinic" : "template"}`}>
                                  <PrototypeIcon name={iconKey} size="s" />
                                </span>
                                <div>
                                  <div className="drop-item-name">{p.nome}</div>
                                  <div className="drop-item-desc">{p.descricao}</div>
                                </div>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <span className="diff-pill neutral">
                                  {isClinic ? "Clínica" : "Modelo pronto"}
                                </span>
                                {isActive && (
                                  <span style={{ color: "#00a88e", fontWeight: 800 }}>✓</span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {!perfilSelecionado ? (
                      /* Botão Vazio de Alto Destaque (Idêntico ao Protótipo) */
                      <button
                        type="button"
                        id="emptyProfileBtn"
                        ref={emptyProfileBtnRef}
                        className={`invite-empty-btn ${isFieldInvalid("perfil") ? "has-error" : ""}`}
                        onClick={() => setProfileDropdownOpen((prev) => !prev)}
                        aria-expanded={profileDropdownOpen}
                        aria-haspopup="listbox"
                      >
                        <div className="empty-left">
                          <div className="empty-icon">
                            <PrototypeIcon name="shield" size="l" />
                          </div>
                          <div>
                            <div className="empty-title">
                              Escolha um perfil para conferir o acesso desta pessoa
                            </div>
                            <div className="empty-sub">
                              Toque para selecionar um perfil de acesso da sua clínica
                            </div>
                          </div>
                        </div>
                        <div className="empty-cta">
                          <span>Selecionar perfil</span>
                          <PrototypeIcon name="cd" size="s" />
                        </div>
                      </button>
                    ) : (
                      /* Card do Perfil Selecionado */
                      <section
                        className={`profile-card profile ${selectedProfileType === "cli" ? "clinic" : ""}`}
                        aria-label="Resumo do perfil de acesso"
                        aria-busy={loadingTemplate}
                      >
                        <div className={`profile-card-top profile-main ${selectedProfileType === "cli" ? "clinic-bg" : ""}`}>
                          <div className="card-profile-info">
                            <span className={`card-profile-icon profile-icon ${selectedProfileType === "cli" ? "clinic" : ""}`}>
                              <PrototypeIcon
                                name={selectedProfileType === "cli" ? "bld" : "shield"}
                                size="l"
                              />
                            </span>
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                                <span className="card-profile-name profile-name">{perfilSelecionado.nome}</span>
                                <span className={`tag ${selectedProfileType === "cli" ? "clinic" : ""}`}>
                                  <PrototypeIcon
                                    name={selectedProfileType === "cli" ? "bld" : "lock"}
                                    size="s"
                                  />
                                  {selectedProfileType === "cli"
                                    ? "Perfil da sua Clínica"
                                    : "Modelo pronto · protegido"}
                                </span>
                                {!loadingTemplate && !permissionError && (
                                  <span className={`tag ${perfilSelecionadoAtendeAgenda ? "tag-agenda-yes" : "tag-agenda-no"}`}>
                                    <PrototypeIcon
                                      name={perfilSelecionadoAtendeAgenda ? "calok" : "caloff"}
                                      size="s"
                                    />
                                    {perfilSelecionadoAtendeAgenda
                                      ? "Atende na agenda"
                                      : "Não atende na agenda"}
                                  </span>
                                )}
                              </div>
                              <p className="card-profile-desc profile-desc">
                                {perfilSelecionado.descricao || "Perfil personalizado da clínica."}
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            className="btn-change-profile"
                            onClick={() => setProfileDropdownOpen((prev) => !prev)}
                            aria-expanded={profileDropdownOpen}
                            aria-haspopup="listbox"
                          >
                            <PrototypeIcon name="shield" size="s" />
                            <span>Alterar perfil</span>
                            <PrototypeIcon name="cd" size="s" />
                          </button>
                        </div>

                        <div className="profile-card-mid">
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <PrototypeIcon
                              name={selectedProfileType === "cli" ? "bld" : "lock"}
                              size="s"
                            />
                            <span>
                              {selectedProfileType === "cli"
                                ? "Você pode editar este perfil ou criar outro a partir dele."
                                : "Protegido pelo sistema. Personalize criando uma cópia."}
                            </span>
                          </div>
                          {!loadingTemplate && !permissionError && (
                            <div className="profile-amount-badge">
                              <PrototypeIcon name="shield-check" size="s" />
                              <span>
                                <b>{permissoesDoNivel.length}</b> / <b>{(permissoes || []).length}</b> funções liberadas
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Matriz Canônica de Módulos */}
                        {loadingTemplate ? (
                          <p role="status" style={{ padding: "16px", color: "#64748b" }}>
                            Carregando funções…
                          </p>
                        ) : permissionError ? (
                          <p role="alert" style={{ padding: "16px", color: "#ef4444" }}>
                            Não foi possível carregar as permissões.{" "}
                            <button
                              type="button"
                              className="action"
                              onClick={() => loadPermissoesDoNivel(form.perfilAcessoId)}
                            >
                              Tentar novamente
                            </button>
                          </p>
                        ) : (
                          <>
                            {isPerfilCustomizado && (
                              <div className="custom-profile-alert" role="alert">
                                <div className="alert-top-row">
                                  <div className="alert-main-content">
                                    <div className="alert-icon-box">
                                      <PrototypeIcon name="sparkles" size="s" />
                                    </div>
                                    <div>
                                      <div className="alert-title">
                                        Você está personalizando as permissões deste colaborador
                                      </div>
                                      <div className="alert-desc">
                                        Modificações feitas com base em <strong>{perfilSelecionado?.nome || "Modelo"}</strong> gerarão um novo perfil de acesso na clínica ao concluir.
                                      </div>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    className="alert-undo-btn"
                                    onClick={restaurarPerfilBase}
                                    title="Reverter todas as personalizações"
                                  >
                                    <PrototypeIcon name="pen" size="s" />
                                    <span>Restaurar</span>
                                  </button>
                                </div>

                                <div className="diff-summary-row">
                                  <span style={{ fontSize: "11px", fontWeight: 700, color: "#475569" }}>
                                    Diferenças aplicadas:
                                  </span>
                                  {diffCalculado.adicionadas > 0 && (
                                    <span className="diff-pill added">
                                      +{diffCalculado.adicionadas} adicionadas
                                    </span>
                                  )}
                                  {diffCalculado.desmarcadas > 0 && (
                                    <span className="diff-pill removed">
                                      -{diffCalculado.desmarcadas} desmarcadas
                                    </span>
                                  )}
                                  {diffCalculado.adicionadas === 0 && diffCalculado.desmarcadas === 0 && (
                                    <span className="diff-pill neutral">Nenhuma alteração</span>
                                  )}
                                </div>
                              </div>
                            )}

                            <div className="matrix-title permission-title">
                              <h3>O que este perfil pode fazer</h3>
                              <span className="aside" style={{ fontSize: "11px", fontWeight: 500, color: "#64748b" }}>
                                <PrototypeIcon name="info" size="s" />
                                Toque em um módulo para detalhar
                              </span>
                            </div>

                            <div className="matrix-grid matrix" role="group" aria-label="Módulos do perfil">
                              {modules.map((m) => {
                                const status = !m.selected.length
                                  ? { tone: "none", oldTone: "off", label: "Sem acesso" }
                                  : m.selected.length === m.permissions.length
                                    ? { tone: "full", oldTone: "", label: "Completo" }
                                    : { tone: "part", oldTone: "partial", label: "Parcial" };
                                const isExpanded = expandedModuleKey === m.key;
                                return (
                                  <button
                                    type="button"
                                    key={m.key}
                                    className={`module-chip module ${isExpanded ? "expanded" : ""}`}
                                    aria-label={`${m.name} ${m.selected.length}/${m.permissions.length} liberadas ${status.label}`}
                                    aria-expanded={isExpanded}
                                    aria-controls="module-detail"
                                    onClick={() =>
                                      setExpandedModuleKey((current) =>
                                        current === m.key ? null : m.key,
                                      )
                                    }
                                  >
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0, flex: 1 }}>
                                      <PrototypeIcon name={m.icon} />
                                      <div className="module-info">
                                        <b>{m.name}</b>
                                        <span>
                                          {m.selected.length}/{m.permissions.length} liberadas
                                        </span>
                                      </div>
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                      <span className={`badge-status ${status.tone} badge ${status.oldTone}`}>
                                        {status.label}
                                      </span>
                                      <span className="module-chevron">
                                        <PrototypeIcon name="cd" size="s" />
                                      </span>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>

                            {/* Detalhe do Módulo Expandido */}
                            {expandedModuleKey !== null && selectedModule && (
                              <section
                                ref={inviteModuleDetailRef}
                                id="module-detail"
                                className="module-detail-box module-detail open"
                                aria-label={`Funções de ${selectedModule.name}`}
                              >
                                <div className="detail-top-row detail-title">
                                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                    <PrototypeIcon name={selectedModule.icon} />
                                    <div>
                                      <h4>{selectedModule.name}</h4>
                                      <span style={{ fontSize: "11px", color: "#007b68", fontWeight: 600 }}>
                                        {selectedModule.selected.length} de {selectedModule.permissions.length} liberadas
                                      </span>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    className="modal-close"
                                    style={{ width: "28px", height: "28px" }}
                                    onClick={() => setExpandedModuleKey(null)}
                                    title="Recolher"
                                  >
                                    <PrototypeIcon name="x" size="s" />
                                  </button>
                                </div>

                                {/* Ações rápidas no módulo */}
                                <div className="quick-nav-bar">
                                  <span style={{ fontSize: "12px", fontWeight: 700, color: "#334155" }}>
                                    Ações rápidas:
                                  </span>
                                  <div
                                    className="lv"
                                    role="group"
                                    aria-label={`Nível em ${selectedModule.name}`}
                                  >
                                    {(selectedModule.editing?.length > 0 ? ["1", "2", "3", "0"] : ["1", "3", "0"]).map((key) => {
                                      const isAtivo = selectedModule.k === key;
                                      return (
                                        <button
                                          type="button"
                                          key={key}
                                          className={isAtivo ? "on" : ""}
                                          aria-pressed={isAtivo}
                                          onClick={() => aplicarAcessoEmLote(key, selectedModule)}
                                        >
                                          {etiquetasNivel[key]}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>

                                <div className="perm">
                                  {selectedModule.permissions.map((permission) => {
                                    const checked = permissoesDoNivel.includes(permission.permissaoId);
                                    return (
                                      <label
                                        key={permission.permissaoId}
                                        className={`perm-item${checked ? " on" : ""}`}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          aria-label={permission.nome}
                                          onChange={() => togglePermissao(permission.permissaoId)}
                                        />
                                        <span>{permission.nome}</span>
                                      </label>
                                    );
                                  })}
                                </div>
                              </section>
                            )}

                            {/* Informativo sobre o perfil */}
                            <div className="profile-actions">
                              <span className="protection">
                                <PrototypeIcon
                                  name={selectedProfileType === "cli" ? "bld" : "lock"}
                                  size="s"
                                />
                                {selectedProfileType === "cli"
                                  ? "Perfil da sua clínica. Personalize as permissões diretamente nos seletores acima."
                                  : "Modelo protegido pelo sistema. Personalize as permissões diretamente nos seletores acima."}
                              </span>
                            </div>
                          </>
                        )}
                      </section>
                    )}
                  </div>
                  {isFieldInvalid("perfil") && (
                    <span className="field-error-msg">{formErrors.perfil}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Rodapé */}
            <div className="modal-foot invite-foot">
              <div className="foot-hint">
                <PrototypeIcon name="shield-check" size="s" />
                <span>Você controla o acesso à sua clínica.</span>
              </div>
              <div className="foot-buttons">
                <button
                  type="button"
                  onClick={handleClose}
                  className="btn-cancel invite-footer-button"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving || loadingTemplate || permissionError}
                  className="btn-submit invite-footer-button primary disabled:opacity-60 disabled:pointer-events-none"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {saving ? "Criando..." : "Criar acesso"}
                  {!saving && <PrototypeIcon name="cr" size="s" />}
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Sub-modal: Salvar Novo Perfil de Acesso */}
        {modalNovoPerfilAberto && (
          <div
            className="profile-modal-backdrop open"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-novo-perfil-title"
          >
            <div className="profile-modal-card">
              <div className="profile-modal-head">
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div className="alert-icon-box">
                    <PrototypeIcon name="shield-check" size="s" />
                  </div>
                  <div>
                    <h3
                      id="modal-novo-perfil-title"
                      style={{
                        fontSize: "16px",
                        fontWeight: 800,
                        color: "#0f172a",
                        margin: 0,
                      }}
                    >
                      Salvar Novo Perfil de Acesso
                    </h3>
                    <p style={{ fontSize: "11.5px", color: "#64748b", margin: 0 }}>
                      Personalizado a partir de{" "}
                      <strong>{perfilSelecionado?.nome || "Modelo Base"}</strong>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="modal-close"
                  onClick={() => setModalNovoPerfilAberto(false)}
                  title="Fechar"
                >
                  <PrototypeIcon name="x" size="s" />
                </button>
              </div>

              <div className="profile-modal-body">
                <div
                  style={{
                    padding: "10px 14px",
                    fontSize: "12px",
                    background: "#f0fdfa",
                    border: "1px solid #ccfbf1",
                    borderRadius: "10px",
                    color: "#0f766e",
                  }}
                >
                  <span>
                    Como você ajustou permissões específicas, um novo perfil será
                    registrado na sua clínica e vinculado ao colaborador.
                  </span>
                </div>

                <div className="field-group">
                  <label className="field-label" htmlFor="novo-perfil-nome">
                    <span>
                      Nome do Novo Perfil <FieldReq />
                    </span>
                  </label>
                  <input
                    type="text"
                    id="novo-perfil-nome"
                    aria-label="Nome do Novo Perfil"
                    className={`input-control ${novoPerfilError ? "has-error" : ""}`}
                    value={novoPerfilNome}
                    onChange={(e) => {
                      setNovoPerfilNome(e.target.value);
                      if (novoPerfilError) setNovoPerfilError("");
                    }}
                    placeholder="Ex: Médico Clínico Geral Personalizado"
                  />
                  {novoPerfilError && (
                    <span className="field-error-msg">{novoPerfilError}</span>
                  )}
                </div>

                <div className="field-group">
                  <label className="field-label" htmlFor="novo-perfil-desc">
                    <span>Descrição do Perfil</span>
                    <span
                      style={{
                        marginLeft: "4px",
                        fontSize: "11px",
                        color: "#64748b",
                      }}
                    >
                      (Opcional)
                    </span>
                  </label>
                  <input
                    type="text"
                    id="novo-perfil-desc"
                    aria-label="Descrição do Perfil"
                    className="input-control"
                    value={novoPerfilDesc}
                    onChange={(e) => setNovoPerfilDesc(e.target.value)}
                    placeholder="Descreva as funções liberadas..."
                  />
                </div>

                <div
                  style={{
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "10px",
                    padding: "10px 12px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "11.5px",
                      fontWeight: 700,
                      color: "#334155",
                      marginBottom: "6px",
                    }}
                  >
                    Resumo das funções:
                  </div>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    <span className="diff-pill neutral">
                      {permissoesDoNivel.length} de {(permissoes || []).length} funções liberadas
                    </span>
                    {diffCalculado.adicionadas > 0 && (
                      <span className="diff-pill added">
                        +{diffCalculado.adicionadas} adicionadas
                      </span>
                    )}
                    {diffCalculado.desmarcadas > 0 && (
                      <span className="diff-pill removed">
                        -{diffCalculado.desmarcadas} desmarcadas
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="profile-modal-foot">
                <button
                  type="button"
                  className="btn-cancel"
                  disabled={saving}
                  onClick={() => setModalNovoPerfilAberto(false)}
                >
                  Voltar e revisar
                </button>
                <button
                  type="button"
                  className="btn-submit"
                  disabled={saving}
                  onClick={confirmarSalvarNovoPerfilEUsuario}
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  <span>{saving ? "Salvando..." : "Salvar perfil e criar acesso"}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
