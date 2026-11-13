import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { resolveApiUrl } from "../../config/apiEnv";
import {
  authHeadersForFetch,
  agendasApi,
  equipeApi,
  perfilApi,
  getApiErrorDetail,
  getApiErrorToastMessage,
} from "../../services/api";
import { useToast } from "../../contexts/useToast.js";
import { useOrg } from "../../contexts/OrgContext";
import { usePapel } from "../../hooks/usePapel";
import { AuditoriaView } from "./AuditoriaView";
import { GestaoPerfisTab } from "./GestaoPerfisTab";
import { formatCargoLabel } from "./gestaoUsuariosUtils";
import { InviteModal } from "./InviteModal";
import { VincularMembrosAoPerfilModal } from "./VincularMembrosAoPerfilModal";
import { ConfigTableSkeleton } from "../shared/ConfigPanelSkeletons";
import { initialsFromName } from "../../utils/agendaAvatarUtils";
import { perfilFotoDisplaySrc } from "../layout/identityDisplay";
import PrototypeIcon from "./PrototypeIcon";
import { Switch } from "../shared/Switch";
import EquipePessoaView from "./EquipePessoaView";
import {
  profileType,
  prunePinnedProfileIds,
  effectiveProfilePermissions,
  summarizeModules,
  catalogFunctionTotal,
  profileFunctionCount,
} from "./equipePrototypeUtils";
import { useChipsQueCabem } from "./useChipsQueCabem";
import { useFocoPreso } from "./useFocoPreso";
import "./equipePrototypeBase.css";
import "./gestaoEquipe.css";
import { useNavigate } from "react-router";
import { useRotaAtual } from "../../rotas/useRotaAtual.js";
import { caminhos } from "../../rotas/caminhos.js";
import NaoEncontrado from "../../rotas/NaoEncontrado.jsx";
import { useAgoraDaClinica } from "../hooks/useAgoraDaClinica.js";
import { useEntradaTela } from "../../hooks/useEntradaTela.js";
import { FiltrosFolha } from "./FiltrosFolha";
import { AtribuirPerfilModal } from "./AtribuirPerfilModal";
import {
  compareMembersByHierarchy,
  contarPrecisamDeVoce,
  sortProfilesByHierarchy,
} from "./equipePrototypeUtils";

export function GestaoUsuariosView({
  onDisponibilidadeInvalidate,
  onEquipeInvalidate,
  onNavigateAgenda,
  onSelectPatient,
  onPerfilAtualizado,
  onEquipeDirtyChange = () => {},
}) {
  const rota = useRotaAtual();
  const navigate = useNavigate();
  const {
    isDono,
    canSeeConfigEquipe,
    canCreateUsers,
    canManageUsers,
    canDeleteUsers,
    canSeeConfigPerfil,
    canEditConfigPerfil,
    canSeeConfigAuditoria,
    canSeeAgenda,
    canSeeAgendaMulti,
    canManageBloqueiosAgenda,
  } = usePapel();
  const {
    roleUserId: currentRoleUserId,
    recarregarContextoOrg,
    orgId,
    roleNome,
    papel,
    apareceNaAgenda,
  } = useOrg();
  const resolvedTarget =
    rota.membroId === "me" ? currentRoleUserId : rota.membroId;
  const selfTarget = Boolean(
    currentRoleUserId &&
    resolvedTarget &&
    String(resolvedTarget) === String(currentRoleUserId),
  );
  const selfOnly = !canSeeConfigEquipe && selfTarget;
  const { fuso, hojeIso } = useAgoraDaClinica(60000);
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [usuarios, setUsuarios] = useState([]);
  const [roles, setRoles] = useState([]);
  const [perfisAcesso, setPerfisAcesso] = useState([]);
  const [especialidadesList, setEspecialidadesList] = useState([]);
  const [permissoes, setPermissoes] = useState([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showVincularMembrosModal, setShowVincularMembrosModal] = useState(false);
  const [inviteDraft, setInviteDraft] = useState(null);
  const activeTab = rota.equipeAba ?? "membros"; // 'membros' | 'auditoria' | 'perfis'
  const setActiveTab = (aba) =>
    aba !== activeTab && navigate(caminhos.equipe(aba === "membros" ? undefined : aba));
  const [perfilParaAbrirNaAba, setPerfilParaAbrirNaAba] = useState(null);

  const onEditarPerfilNaAba = (perfilAcessoId) => {
    setPerfilParaAbrirNaAba(perfilAcessoId);
    setActiveTab("perfis");
  };

  // Filtros
  const [searchName, setSearchName] = useState("");
  const [filterLevel, setFilterLevel] = useState("");
  const [selectedStatusFilters, setSelectedStatusFilters] = useState([]); // 'ativos', 'inativos'
  const [selectedAgendaFilters, setSelectedAgendaFilters] = useState([]); // 'yes', 'no'
  const [selectedProfileIds, setSelectedProfileIds] = useState([]); // string[]
  const [selectedAtendimentoFilters, setSelectedAtendimentoFilters] = useState([]); // 'hoje', 'mes'
  const [viewingProfileId, setViewingProfileId] = useState(null); // string | null (profile cuja ficha está aberta no .pban)
  const [isTodosPerfisModalOpen, setIsTodosPerfisModalOpen] = useState(false);
  const [todosPerfisSearch, setTodosPerfisSearch] = useState("");
  const [pinnedProfileIds, setPinnedProfileIds] = useState(() => {
    try {
      const saved = localStorage.getItem(`procedi_pinned_profiles_${orgId}`);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return null;
  });
  const [loadError, setLoadError] = useState("");
  const detailId = resolvedTarget ? String(resolvedTarget) : null;
  const [sortOption, setSortOption] = useState("hier"); // 'hier' | 'az' | 'za' | 'perfil' | 'atendimentos'
  const [isFilterPopoverOpen, setIsFilterPopoverOpen] = useState(false);
  const [atribuirPessoa, setAtribuirPessoa] = useState(null);
  const filterBtnRef = useRef(null);
  // Só nos blocos de conteúdo; a chave não muda ao filtrar, buscar ou salvar.
  const entrada = useEntradaTela("lista");
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const [agendaAvailabilityFilter, setAgendaAvailabilityFilter] = useState("all"); // 'all' | 'yes' | 'no'
  const [periodo, setPeriodo] = useState("mes");
  const [criarNovoNonce, setCriarNovoNonce] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [agenda, setAgenda] = useState(null);
  const [agendaError, setAgendaError] = useState("");
  const [agendaReload, setAgendaReload] = useState(0);
  const [permissionsByProfile, setPermissionsByProfile] = useState({});
  const [previewError, setPreviewError] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [savingOwnerAgenda, setSavingOwnerAgenda] = useState("");
  const [ownerAgendaError, setOwnerAgendaError] = useState("");
  const [isOwnerAgendaOpen, setIsOwnerAgendaOpen] = useState(false);

  const filterPopoverRef = useRef(null);
  const sortMenuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        filterPopoverRef.current &&
        !filterPopoverRef.current.contains(event.target)
      ) {
        setIsFilterPopoverOpen(false);
      }
      if (
        sortMenuRef.current &&
        !sortMenuRef.current.contains(event.target)
      ) {
        setIsSortMenuOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsFilterPopoverOpen(false);
        setIsSortMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const fetchHeaders = useCallback(() => {
    return authHeadersForFetch({ needsOrg: true });
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [equipeRes, rolesRes, perfisRes, especialidadesRes, permissoesRes] =
        await Promise.all([
          fetch(resolveApiUrl("/api/v1/equipe"), {
            headers: await fetchHeaders(),
            credentials: "include",
          }),
          fetch(resolveApiUrl("/api/v1/dimensoes/roles"), {
            headers: await fetchHeaders(),
            credentials: "include",
          }),
          fetch(resolveApiUrl("/api/v1/perfis-acesso"), {
            headers: await fetchHeaders(),
            credentials: "include",
          }),
          fetch(resolveApiUrl("/api/v1/dimensoes/especialidades"), {
            headers: await fetchHeaders(),
            credentials: "include",
          }),
          fetch(resolveApiUrl("/api/v1/permissoes"), {
            headers: await fetchHeaders(),
            credentials: "include",
          }),
        ]);

      if (
        equipeRes.ok &&
        rolesRes.ok &&
        perfisRes.ok &&
        especialidadesRes.ok &&
        permissoesRes.ok
      ) {
        const equipeData = await equipeRes.json();
        const rolesData = await rolesRes.json();
        const perfisData = await perfisRes.json();
        const especialidadesData = await especialidadesRes.json();
        const permissoesData = await permissoesRes.json();
        setUsuarios(
          Array.isArray(equipeData) ? equipeData : equipeData.content || [],
        );
        setRoles(
          Array.isArray(rolesData) ? rolesData : rolesData.content || [],
        );
        setPerfisAcesso(
          Array.isArray(perfisData) ? perfisData : perfisData.content || [],
        );
        setEspecialidadesList(
          Array.isArray(especialidadesData)
            ? especialidadesData
            : especialidadesData.content || [],
        );
        setPermissoes(
          Array.isArray(permissoesData)
            ? permissoesData
            : permissoesData.content || [],
        );
      } else {
        const badRes = !equipeRes.ok
          ? equipeRes
          : !rolesRes.ok
            ? rolesRes
            : !perfisRes.ok
              ? perfisRes
              : !especialidadesRes.ok
                ? especialidadesRes
                : permissoesRes;
        const body = await badRes.json().catch(() => ({}));
        setLoadError(
          getApiErrorDetail({ body }) ||
          body?.message ||
          "Erro ao carregar dados da equipe.",
        );
      }
    } catch (e) {
      setLoadError(
        getApiErrorToastMessage(e, "Falha de rede ao carregar equipe."),
      );
    } finally {
      setLoading(false);
    }
  }, [fetchHeaders]);

  useEffect(() => {
    if (canSeeConfigEquipe) {
      loadData();
    }
  }, [canSeeConfigEquipe, loadData, orgId]);


  const loadSelf = useCallback(
    async (signal) => {
      setLoading(true);
      setLoadError("");
      try {
        const data = await perfilApi.buscar({ signal });
        if (signal?.aborted) return;
        setUsuarios([
          {
            ...data,
            usuarioId: data.id,
            id: currentRoleUserId,
            roleName: roleNome || data.cargoNome,
            perfilAcessoCodigo: papel,
            perfilAcessoNome: papel,
            apareceNaAgenda,
          },
        ]);
      } catch (err) {
        if (!signal?.aborted)
          setLoadError(
            getApiErrorToastMessage(
              err,
              "Não foi possível carregar seu cadastro.",
            ),
          );
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [currentRoleUserId, roleNome, papel, apareceNaAgenda],
  );
  useEffect(() => {
    if (!selfOnly) return;
    const controller = new AbortController();
    loadSelf(controller.signal);
    return () => controller.abort();
  }, [selfOnly, loadSelf, orgId]);

  const retryData = selfOnly ? loadSelf : loadData;
  const detail = usuarios.find((u) => String(u.id) === String(detailId));
  const selectedProfile = perfisAcesso.find(
    (p) => String(p.id) === String(viewingProfileId || filterLevel),
  );
  useEffect(() => {
    if (!canSeeAgenda || !hojeIso) return;
    let alive = true;
    const controller = new AbortController();
    const [year, month] = hojeIso.split("-").map(Number);
    const end = `${hojeIso.slice(0, 7)}-${String(new Date(Date.UTC(year, month, 0)).getUTCDate()).padStart(2, "0")}`;
    setAgenda(null);
    setAgendaError("");
    const offset = periodo === "3m" ? 2 : periodo === "ano" ? month - 1 : 0;
    const beginning = new Date(Date.UTC(year, month - 1 - offset, 1));
    const start = `${beginning.getUTCFullYear()}-${String(beginning.getUTCMonth() + 1).padStart(2, "0")}-01`;
    agendasApi
      .byRange(start, end, {
        signal: controller.signal,
        excluirCancelado: true,
      })
      .then((data) => {
        if (alive) setAgenda(Array.isArray(data) ? data : data?.content || []);
      })
      .catch((err) => {
        if (alive)
          setAgendaError(
            getApiErrorToastMessage(err, "Não foi possível carregar a agenda."),
          );
      });
    return () => {
      alive = false;
      controller.abort();
    };
  }, [canSeeAgenda, hojeIso, agendaReload, periodo]);

  useEffect(() => {
    let alive = true;
    setPreviewLoading(true);
    setPreviewError("");
    Promise.all(
      perfisAcesso.map(async (profile) => {
        const response = await fetch(
          resolveApiUrl(`/api/v1/perfis-acesso/${profile.id}/permissoes`),
          { headers: await fetchHeaders(), credentials: "include" },
        );
        if (!response.ok)
          throw new Error("Não foi possível carregar as funções dos perfis.");
        const ids = await response.json();
        if (!Array.isArray(ids))
          throw new Error("Não foi possível carregar as funções dos perfis.");
        return [
          profile.id,
          effectiveProfilePermissions(
            profile,
            Array.isArray(ids) ? ids : [],
            permissoes,
          ),
        ];
      }),
    )
      .then((entries) => {
        if (alive) setPermissionsByProfile(Object.fromEntries(entries));
      })
      .catch((error) => {
        if (alive) setPreviewError(error.message);
      })
      .finally(() => {
        if (alive) setPreviewLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [perfisAcesso, permissoes, fetchHeaders]);

  const nameOf = (u) => u.nomeCompleto || u.usuarioNome || "Pessoa sem nome";
  const appointmentsFor = (u) =>
    agenda?.filter(
      (a) => (a.profissionalRoleUserId || a.roleUserId) === u.id,
    ) || [];
  const stats = {
    ativos: usuarios.filter((u) => u.ativo !== false).length,
    atendem: usuarios.filter(
      (u) => u.ativo !== false && u.apareceNaAgenda === true,
    ).length,
    hoje: agenda?.filter((a) => a.dataAgendamento === hojeIso).length,
    mes: agenda?.filter(
      (a) =>
        String(a.statusCodigo).toUpperCase() === "REALIZADO" &&
        a.dataAgendamento?.startsWith(hojeIso.slice(0, 7)),
    ).length,
  };
  const effectiveProfileIds = useMemo(() => {
    if (selectedProfileIds.length > 0) return selectedProfileIds;
    if (filterLevel) return [filterLevel];
    return [];
  }, [selectedProfileIds, filterLevel]);

  const effectiveStatusFilters = useMemo(() => {
    if (selectedStatusFilters.length > 0) return selectedStatusFilters;
    if (statusFilter && ["ativos", "inativos"].includes(statusFilter)) return [statusFilter];
    return [];
  }, [selectedStatusFilters, statusFilter]);

  const effectiveAgendaFilters = useMemo(() => {
    if (selectedAgendaFilters.length > 0) return selectedAgendaFilters;
    if (agendaAvailabilityFilter !== "all") return [agendaAvailabilityFilter];
    return [];
  }, [selectedAgendaFilters, agendaAvailabilityFilter]);

  // Calculado aqui (não em sortedProfiles, declarado mais abaixo): mesma ordem de hierarquia do perfil.
  const porHierarquia = compareMembersByHierarchy(
    sortProfilesByHierarchy(perfisAcesso, permissionsByProfile, permissoes),
    nameOf,
  );
  const filteredUsers = usuarios
    .filter((u) => {
      const text = [
        nameOf(u),
        u.email,
        u.telefone,
        formatCargoLabel(u.roleName),
      ]
        .join(" ")
        .toLocaleLowerCase("pt-BR");

      // 1. Busca por texto
      const matchesSearch = !searchName || text.includes(searchName.toLocaleLowerCase("pt-BR"));

      // 2. Filtro de perfis (acumulativo OR entre perfis selecionados)
      const matchesProfile =
        effectiveProfileIds.length === 0 ||
        effectiveProfileIds.includes(String(u.perfilAcessoId));

      // 3. Status (ativos / inativos)
      let matchesStatus = true;
      if (effectiveStatusFilters.includes("ativos") && !effectiveStatusFilters.includes("inativos")) {
        matchesStatus = u.ativo !== false;
      } else if (effectiveStatusFilters.includes("inativos") && !effectiveStatusFilters.includes("ativos")) {
        matchesStatus = u.ativo === false;
      }
      if (effectiveStatusFilters.includes("semperfil") && !(u.ativo !== false && !u.perfilAcessoId)) {
        matchesStatus = false;
      }

      // 4. Agenda (atendem / não atendem)
      let matchesAgenda = true;
      if (effectiveAgendaFilters.includes("yes") && !effectiveAgendaFilters.includes("no")) {
        matchesAgenda = u.ativo !== false && u.apareceNaAgenda === true;
      } else if (effectiveAgendaFilters.includes("no") && !effectiveAgendaFilters.includes("yes")) {
        matchesAgenda = u.apareceNaAgenda !== true;
      }

      // 5. Atendimentos (hoje / mês)
      let matchesAtend = true;
      if (selectedAtendimentoFilters.includes("hoje")) {
        const hasToday = agenda?.some(
          (a) =>
            (a.profissionalRoleUserId || a.roleUserId) === u.id &&
            a.dataAgendamento === hojeIso,
        );
        matchesAtend = matchesAtend && Boolean(hasToday);
      }
      if (selectedAtendimentoFilters.includes("mes")) {
        const hasMonth = agenda?.some(
          (a) =>
            (a.profissionalRoleUserId || a.roleUserId) === u.id &&
            String(a.statusCodigo).toUpperCase() === "REALIZADO" &&
            a.dataAgendamento?.startsWith(hojeIso?.slice(0, 7) || ""),
        );
        matchesAtend = matchesAtend && Boolean(hasMonth);
      }

      // Fallback para statusFilter legado caso selecionado avulso
      if (statusFilter === "agenda") {
        matchesAgenda = matchesAgenda && (u.ativo !== false && u.apareceNaAgenda === true);
      } else if (statusFilter === "hoje") {
        const hasToday = agenda?.some(
          (a) =>
            (a.profissionalRoleUserId || a.roleUserId) === u.id &&
            a.dataAgendamento === hojeIso,
        );
        matchesAtend = matchesAtend && Boolean(hasToday);
      } else if (statusFilter === "mes") {
        const hasMonth = agenda?.some(
          (a) =>
            (a.profissionalRoleUserId || a.roleUserId) === u.id &&
            String(a.statusCodigo).toUpperCase() === "REALIZADO" &&
            a.dataAgendamento?.startsWith(hojeIso?.slice(0, 7) || ""),
        );
        matchesAtend = matchesAtend && Boolean(hasMonth);
      }

      return matchesSearch && matchesProfile && matchesStatus && matchesAgenda && matchesAtend;
    })
    .sort((a, b) => {
      if (sortOption === "hier") return porHierarquia(a, b);
      if (sortOption === "za") {
        return nameOf(b).localeCompare(nameOf(a), "pt-BR");
      }
      if (sortOption === "perfil") {
        const perfilA =
          perfisAcesso.find((p) => p.id === a.perfilAcessoId)?.nome || "";
        const perfilB =
          perfisAcesso.find((p) => p.id === b.perfilAcessoId)?.nome || "";
        const diff = perfilA.localeCompare(perfilB, "pt-BR");
        if (diff !== 0) return diff;
        return nameOf(a).localeCompare(nameOf(b), "pt-BR");
      }
      if (sortOption === "atendimentos") {
        const countA = appointmentsFor(a).length;
        const countB = appointmentsFor(b).length;
        if (countB !== countA) return countB - countA;
        return nameOf(a).localeCompare(nameOf(b), "pt-BR");
      }
      return nameOf(a).localeCompare(nameOf(b), "pt-BR");
    });

  const activeFiltersCount =
    (searchName ? 1 : 0) +
    effectiveStatusFilters.length +
    effectiveProfileIds.length +
    effectiveAgendaFilters.length +
    selectedAtendimentoFilters.length +
    (statusFilter && !["ativos", "inativos"].includes(statusFilter) ? 1 : 0);

  const clearAllFilters = () => {
    setSearchName("");
    setFilterLevel("");
    setSelectedProfileIds([]);
    setStatusFilter("");
    setSelectedStatusFilters([]);
    setAgendaAvailabilityFilter("all");
    setSelectedAgendaFilters([]);
    setSelectedAtendimentoFilters([]);
    setViewingProfileId(null);
  };

  const openDetail = (u) => {
    navigate(caminhos.membro(u.id));
    setPeriodo("mes");
  };
  const newProfile = () => {
    setActiveTab("perfis");
    setCriarNovoNonce((n) => n + 1);
  };
  const handleDeactivate = async (u) => {
    if (
      !canDeleteUsers ||
      u.id === currentRoleUserId ||
      u.perfilAcessoCodigo === "DONO"
    )
      return;
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Desativar o acesso de ${nameOf(u)}?`)) return;
    try {
      const res = await fetch(resolveApiUrl(`/api/v1/equipe/${u.id}`), {
        method: "DELETE",
        headers: await fetchHeaders(),
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          getApiErrorDetail({ body }) || "Erro ao desativar acesso.",
        );
      }
      toast.success("Acesso desativado com sucesso.");
      await loadData();
      onEquipeInvalidate?.();
    } catch (err) {
      toast.error(getApiErrorToastMessage(err, "Erro ao desativar acesso."));
    }
  };
  const avatar = (u) => (
    <span
      className="av"
      style={{
        background:
          u.perfilAcessoCodigo === "DONO" ? "#f59e0b" : "var(--app-accent)",
      }}
    >
      {u.fotoUrl ? (
        <img src={perfilFotoDisplaySrc(u.fotoUrl)} alt="" className="h-full w-full rounded-full object-cover" />
      ) : (
        initialsFromName(nameOf(u))
      )}
      {u.perfilAcessoCodigo === "DONO" && (
        <span className="crown">
          <PrototypeIcon name="crown" />
        </span>
      )}
    </span>
  );
  const badge = (profile) => (
    <span className={`chip ${profileType(profile)}`}>
      <PrototypeIcon
        name={profile?.codigo === "DONO" ? "crown" : "shield"}
        size="s"
      />
      <span className="trunc">{profile?.nome || "Sem perfil"}</span>
    </span>
  );
  const profileIds = (profile) => permissionsByProfile[profile?.id];
  const agendaModule =
    selectedProfile?.codigo === "DONO"
      ? summarizeModules(permissoes, profileIds(selectedProfile)).find(
        (module) => module.key === "agenda",
      )
      : null;
  const attends = (profile) =>
    profileIds(profile)?.some(
      (id) =>
        permissoes.find((p) => p.permissaoId === id)?.codigo ===
        "AGENDA_APARECER",
    );
  const count = (profile) =>
    usuarios.filter((u) => u.ativo !== false && u.perfilAcessoId === profile.id)
      .length;
  const sortedProfiles = useMemo(
    () => sortProfilesByHierarchy(perfisAcesso, permissionsByProfile, permissoes),
    [perfisAcesso, permissionsByProfile, permissoes],
  );

  const activePinnedProfileIds = useMemo(() => {
    if (pinnedProfileIds && pinnedProfileIds.length > 0) {
      return pinnedProfileIds;
    }
    return sortedProfiles.slice(0, 7).map((p) => String(p.id));
  }, [pinnedProfileIds, sortedProfiles]);

  const railProfiles = useMemo(() => {
    if (activePinnedProfileIds && activePinnedProfileIds.length > 0) {
      return sortedProfiles.filter((p) => activePinnedProfileIds.includes(String(p.id)));
    }
    return sortedProfiles.slice(0, 7);
  }, [sortedProfiles, activePinnedProfileIds]);

  // o perfil escolhido nunca some da barra, mesmo sem estar fixado
  const barProfiles =
    selectedProfile && !railProfiles.some((p) => p.id === selectedProfile.id)
      ? [...railProfiles, selectedProfile]
      : railProfiles;
  const modalPerfisRef = useRef(null);
  useFocoPreso(modalPerfisRef, isTodosPerfisModalOpen, () =>
    setIsTodosPerfisModalOpen(false),
  );
  const chipsRef = useRef(null);
  useChipsQueCabem(
    chipsRef,
    [
      loading,
      detailId,
      activeTab,
      viewingProfileId,
      effectiveProfileIds.join(","),
      barProfiles.map((p) => `${p.id}:${count(p)}`).join(","),
    ].join("|"),
  );

  const savePinned = (next) => {
    setPinnedProfileIds(next);
    try {
      localStorage.setItem(`procedi_pinned_profiles_${orgId}`, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  // Ao carregar os perfis, ids guardados que não existem mais saem da lista (só regrava se mudou).
  useEffect(() => {
    if (!pinnedProfileIds) return;
    const pruned = prunePinnedProfileIds(pinnedProfileIds, perfisAcesso);
    if (pruned.length !== pinnedProfileIds.length) savePinned(pruned);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfisAcesso]);

  const togglePinProfile = (id) => {
    const strId = String(id);
    const current = activePinnedProfileIds;
    savePinned(
      current.includes(strId)
        ? current.filter((item) => item !== strId)
        : [...current, strId],
    );
  };
  const pinnedCount = sortedProfiles.filter((p) =>
    activePinnedProfileIds.includes(String(p.id)),
  ).length;
  const allPinned = sortedProfiles.length > 0 && pinnedCount === sortedProfiles.length;
  const pinAllProfiles = () => savePinned(sortedProfiles.map((p) => String(p.id)));
  // como no protótipo: "Desafixar todos" deixa só o Dono
  const unpinAllProfiles = () =>
    savePinned(sortedProfiles.filter((p) => p.codigo === "DONO").map((p) => String(p.id)));

  const handleSelectProfileFromRail = (profile) => {
    const strId = String(profile.id);
    setViewingProfileId(strId);
    setFilterLevel(strId);
    setSelectedProfileIds([strId]);
  };

  const handleSelectAllFromRail = () => {
    setViewingProfileId(null);
    setFilterLevel("");
    setSelectedProfileIds([]);
  };

  const handleCloseProfileBanner = () => {
    if (viewingProfileId) {
      setSelectedProfileIds((prev) => prev.filter((id) => id !== viewingProfileId));
      if (filterLevel === viewingProfileId) {
        setFilterLevel("");
      }
    }
    setViewingProfileId(null);
  };

  const railItem = (profile) => (
    <button
      className={`rit ${viewingProfileId === String(profile.id) || (effectiveProfileIds.length === 1 && effectiveProfileIds.includes(String(profile.id))) ? "on" : ""}`}
      onClick={() => handleSelectProfileFromRail(profile)}
      key={profile.id}
    >
      <span className={`dot ${profileType(profile)}`}>
        <PrototypeIcon
          name={profile.codigo === "DONO" ? "crown" : "shield"}
          size="s"
        />
      </span>
      <span className="nm">
        <b className="trunc">{profile.nome}</b>
        <span>
          {profileIds(profile)
            ? `${profileFunctionCount(profileIds(profile), permissoes, profile.codigo === "DONO")} de ${catalogFunctionTotal(permissoes)} · ${attends(profile) ? "atende" : "não atende"}`
            : previewLoading
              ? "Carregando funções…"
              : "Funções indisponíveis"}
        </span>
      </span>
      <span className="ct">{count(profile)}</span>
    </button>
  );
  const backToTeam = (opts) => {
    navigate(caminhos.equipe(), { state: opts?.semGuarda ? { semGuarda: true } : undefined });
  };
  const saveAccess = async (person, changes) => {
    if (!canManageUsers || person.perfilAcessoCodigo === "DONO") return;
    await equipeApi.update(person.id, {
      ...person,
      apareceNaAgenda: undefined,
      agendaMultiVer: undefined,
      nomeCompleto: nameOf(person),
      ...changes,
    });
    toast.success("Acesso atualizado.");
    await loadData();
    onEquipeInvalidate?.();
    onDisponibilidadeInvalidate?.({ scope: "role", roleUserId: person.id });
  };

  const ownerPerson = usuarios.find(
    (person) =>
      person.id === currentRoleUserId && person.perfilAcessoCodigo === "DONO",
  );
  const changeOwnerAgenda = async (code, enabled) => {
    const permission = permissoes.find((p) => p.codigo === code);
    if (
      !ownerPerson ||
      !canManageUsers ||
      savingOwnerAgenda ||
      previewLoading ||
      previewError ||
      !permission
    )
      return;
    setSavingOwnerAgenda(code);
    setOwnerAgendaError("");
    try {
      const field =
        code === "AGENDA_APARECER" ? "apareceNaAgenda" : "agendaMultiVer";
      await equipeApi.update(ownerPerson.id, {
        usuarioId: ownerPerson.usuarioId,
        roleId: ownerPerson.roleId,
        [field]: enabled,
      });
      setPermissionsByProfile((previous) => {
        const ids = previous[ownerPerson.perfilAcessoId] || [];
        return {
          ...previous,
          [ownerPerson.perfilAcessoId]: enabled
            ? [...new Set([...ids, permission.permissaoId])]
            : ids.filter((id) => id !== permission.permissaoId),
        };
      });
      if (field === "apareceNaAgenda")
        setUsuarios((people) =>
          people.map((person) =>
            person.id === ownerPerson.id
              ? { ...person, apareceNaAgenda: enabled }
              : person,
          ),
        );
      recarregarContextoOrg();
      setAgendaReload((value) => value + 1);
      onEquipeInvalidate?.();
      onDisponibilidadeInvalidate?.({
        scope: "role",
        roleUserId: ownerPerson.id,
      });
      toast.success("Opção da agenda atualizada.");
    } catch (error) {
      const message = getApiErrorToastMessage(
        error,
        "Não foi possível salvar a opção da agenda.",
      );
      setOwnerAgendaError(message);
      toast.error(message);
    } finally {
      setSavingOwnerAgenda("");
    }
  };

  if (!canSeeConfigEquipe && !selfOnly)
    return (
      <div className="empty">
        Você não tem permissão para visualizar a equipe.
      </div>
    );
  const monthName = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${hojeIso || "2026-01-01"}T12:00:00Z`));
  const alternar = (setter, chave, limpa) => (e) => {
    setter((prev) =>
      e.target.checked ? [...prev.filter((x) => x !== chave), chave] : prev.filter((x) => x !== chave),
    );
    limpa?.();
  };
  const comAtendimento = (cond) =>
    agenda
      ? usuarios.filter((u) =>
          agenda.some((a) => (a.profissionalRoleUserId || a.roleUserId) === u.id && cond(a)),
        ).length
      : "—";
  const gruposFolha = !isFilterPopoverOpen ? [] : [
    {
      titulo: "Situação",
      opcoes: [
        { id: "ativos", rotulo: "Ativos", n: stats.ativos, marcado: effectiveStatusFilters.includes("ativos"), onToggle: alternar(setSelectedStatusFilters, "ativos", () => setStatusFilter("")) },
        { id: "inativos", rotulo: "Desativados", n: usuarios.length - stats.ativos, marcado: effectiveStatusFilters.includes("inativos"), onToggle: alternar(setSelectedStatusFilters, "inativos", () => setStatusFilter("")) },
        { id: "semperfil", rotulo: "Sem perfil", n: contarPrecisamDeVoce(usuarios), marcado: effectiveStatusFilters.includes("semperfil"), onToggle: alternar(setSelectedStatusFilters, "semperfil") },
      ],
    },
    {
      titulo: "Agenda",
      opcoes: [
        { id: "yes", rotulo: "Atendem na agenda", n: stats.atendem, marcado: effectiveAgendaFilters.includes("yes"), onToggle: alternar(setSelectedAgendaFilters, "yes", () => setAgendaAvailabilityFilter("all")) },
        { id: "no", rotulo: "Não atendem", n: usuarios.filter((u) => u.apareceNaAgenda !== true).length, marcado: effectiveAgendaFilters.includes("no"), onToggle: alternar(setSelectedAgendaFilters, "no", () => setAgendaAvailabilityFilter("all")) },
      ],
    },
    {
      titulo: "Atendimentos",
      opcoes: [
        { id: "hoje", rotulo: "Com atendimento hoje", n: comAtendimento((a) => a.dataAgendamento === hojeIso), marcado: selectedAtendimentoFilters.includes("hoje"), onToggle: alternar(setSelectedAtendimentoFilters, "hoje") },
        { id: "mes", rotulo: `Com atendimento em ${monthName}`, n: comAtendimento((a) => String(a.statusCodigo).toUpperCase() === "REALIZADO" && a.dataAgendamento?.startsWith(hojeIso.slice(0, 7))), marcado: selectedAtendimentoFilters.includes("mes"), onToggle: alternar(setSelectedAtendimentoFilters, "mes") },
      ],
    },
  ];
  return (
    <div className="prototype-equipe">
      {loadError ? (
        <div role="alert" className="team-error">
          {loadError}
          <button className="btn-s" onClick={() => retryData()}>
            Tentar novamente
          </button>
        </div>
      ) : loading ? (
        <ConfigTableSkeleton rows={5} cols={4} />
      ) : detailId && !detail ? (
        <NaoEncontrado />
      ) : detail ? (
        <EquipePessoaView
          key={detail.id}
          pessoa={detail}
          isSelf={Boolean(
            currentRoleUserId &&
            String(detail.id) === String(currentRoleUserId),
          )}
          onPerfilAtualizado={(data) => {
            if (String(detail.id) !== String(currentRoleUserId)) return;
            const fields = { ...data };
            delete fields.id;
            setUsuarios((previous) =>
              previous.map((user) =>
                String(user.id) === String(detail.id)
                  ? { ...user, ...fields }
                  : user,
              ),
            );
            if (fields.apareceNaAgenda !== undefined || fields.agendaMultiVer !== undefined) {
              setPermissionsByProfile((previous) => {
                let ids = previous[detail.perfilAcessoId] || [];
                for (const [field, code] of [['apareceNaAgenda', 'AGENDA_APARECER'], ['agendaMultiVer', 'AGENDA_MULTI_VER']]) {
                  if (fields[field] === undefined) continue;
                  const id = permissoes.find((p) => p.codigo === code)?.permissaoId;
                  if (id) ids = fields[field] ? [...new Set([...ids, id])] : ids.filter((value) => value !== id);
                }
                return { ...previous, [detail.perfilAcessoId]: ids };
              });
            }
            onPerfilAtualizado?.(fields);
          }}
          perfil={
            perfisAcesso.find((p) => p.id === detail.perfilAcessoId) ||
            (selfOnly ? { codigo: papel, nome: papel } : undefined)
          }
          pessoas={usuarios}
          permissoes={permissoes}
          permissoesPerfil={permissionsByProfile[detail.perfilAcessoId] || []}
          loadingPermissoes={previewLoading}
          permissoesError={previewError}
          onRetryPermissoes={selfOnly ? undefined : loadData}
          agenda={agenda || []}
          loadingAgenda={agenda === null}
          agendaError={agendaError}
          fuso={fuso}
          hojeIso={hojeIso}
          canManageUsers={!selfOnly && canManageUsers}
          canDeleteUsers={
            !selfOnly &&
            canDeleteUsers &&
            String(detail.id) !== String(currentRoleUserId)
          }
          canSeeAgenda={canSeeAgenda}
          canSeeConfigPerfil={canSeeConfigPerfil}
          canSeeConfigAuditoria={canSeeConfigAuditoria}
          onBack={backToTeam}
          onEditarPerfil={onEditarPerfilNaAba}
          onDesativar={() => handleDeactivate(detail)}
          orgId={orgId}
          canManageDisponibilidade={Boolean(isDono || canManageUsers || canManageBloqueiosAgenda)}
          onDisponibilidadeInvalidate={onDisponibilidadeInvalidate}
          onEquipeInvalidate={() => { recarregarContextoOrg(); onEquipeInvalidate?.(); }}
          onSelectPatient={onSelectPatient}
          onNavigateAgenda={onNavigateAgenda}
          onSalvarAcesso={saveAccess}
          roles={roles}
          perfisAcesso={perfisAcesso}
          onPeriodoChange={setPeriodo}
          permissionsByProfile={permissionsByProfile}
          canEditPerfis={!selfOnly && canEditConfigPerfil}
          viewerIsDono={Boolean(isDono)}
          onDirtyChange={onEquipeDirtyChange}
        />
      ) : selfOnly ? (
        <p role="status">Carregando seu usuário…</p>
      ) : activeTab === "perfis" ? (
        <GestaoPerfisTab
          perfisAcesso={perfisAcesso}
          permissoes={permissoes}
          roles={roles}
          usuarios={usuarios}
          onReload={loadData}
          fetchHeaders={fetchHeaders}
          perfilParaAbrir={perfilParaAbrirNaAba}
          onPerfilParaAbrirConsumido={() => setPerfilParaAbrirNaAba(null)}
          criarNovoNonce={criarNovoNonce}
          canEdit={canEditConfigPerfil}
          onDirtyChange={onEquipeDirtyChange}
          onBack={(opts) => {
            backToTeam(opts);
            if (inviteDraft) setShowInviteModal(true);
          }}
          onSaved={(profile) => {
            if (inviteDraft)
              setInviteDraft((prev) => ({
                ...prev,
                form: { ...prev.form, perfilAcessoId: String(profile.id) },
              }));
          }}
        />
      ) : activeTab === "auditoria" ? (
        <>
          <div className="crumb">
            <button onClick={backToTeam}>
              <PrototypeIcon name="cl" size="s" />
              Gestão de Equipe
            </button>
            <span>/</span>
            <span>Histórico / Auditoria</span>
          </div>
          <div className="phd">
            <div>
              <h1>Histórico / Auditoria</h1>
              <p>Acompanhe quem fez cada ação e o que mudou na clínica.</p>
            </div>
          </div>
          <AuditoriaView />
        </>
      ) : (
        <>
          {usuarios.length === 1 && (
            <div className="hint">
              <PrototypeIcon name="info" />
              <span>
                <b>Só você por enquanto.</b> Convide a equipe e escolha o perfil
                de acesso de cada pessoa: é ele que decide o que a pessoa pode
                fazer.
              </span>
            </div>
          )}
          <div className="kpis" role="group" aria-label="Filtros rápidos de status">
            {[
              {
                id: "ativos",
                label: "ATIVOS",
                value: stats.ativos,
                badgeClass: "kpi-badge-teal",
                icon: "users",
              },
              {
                id: "agenda",
                label: "ATENDEM NA AGENDA",
                value: stats.atendem,
                badgeClass: "kpi-badge-blue",
                icon: "calok",
              },
              {
                id: "hoje",
                label: "ATENDIMENTOS HOJE",
                value: stats.hoje ?? "—",
                badgeClass: "kpi-badge-amber",
                icon: "cal",
              },
              {
                id: "mes",
                label: `ATENDIMENTOS EM ${monthName.toUpperCase()}`,
                value: stats.mes ?? "—",
                badgeClass: "kpi-badge-emerald",
                icon: "steth",
              },
              {
                id: "precisam",
                label: "PRECISAM DE VOCÊ",
                value: contarPrecisamDeVoce(usuarios),
                badgeClass: "kpi-badge-slate",
                icon: "info",
              },
            ].map(({ id, label, value, badgeClass, icon }, indice) => {
              const isKpiActive =
                id === "ativos"
                  ? selectedStatusFilters.includes("ativos")
                  : id === "agenda"
                    ? selectedAgendaFilters.includes("yes")
                    : id === "hoje"
                      ? selectedAtendimentoFilters.includes("hoje")
                      : id === "mes"
                        ? selectedAtendimentoFilters.includes("mes")
                        : selectedStatusFilters.includes("semperfil");
              return (
                <button
                  type="button"
                  key={id}
                  className={`kpi ${isKpiActive ? "on" : ""} ${entrada(`agenda-delay-${[100, 150, 200, 250, 250][indice]}`)}`}
                  aria-pressed={isKpiActive}
                  title={
                    id === "precisam"
                      ? "Pessoas ativas sem perfil de acesso: elas não conseguem entrar."
                      : !canSeeAgendaMulti && (id === "hoje" || id === "mes")
                        ? "Dados da agenda disponíveis para seu acesso."
                        : undefined
                  }
                  onClick={() => {
                    if (id === "precisam") {
                      setSelectedStatusFilters((prev) =>
                        prev.includes("semperfil") ? prev.filter((s) => s !== "semperfil") : [...prev, "semperfil"]
                      );
                    } else if (id === "ativos") {
                      setSelectedStatusFilters((prev) =>
                        prev.includes("ativos") ? prev.filter((s) => s !== "ativos") : [...prev, "ativos"]
                      );
                    } else if (id === "agenda") {
                      setSelectedAgendaFilters((prev) =>
                        prev.includes("yes") ? prev.filter((a) => a !== "yes") : [...prev, "yes"]
                      );
                    } else if (id === "hoje") {
                      setSelectedAtendimentoFilters((prev) =>
                        prev.includes("hoje") ? prev.filter((h) => h !== "hoje") : [...prev, "hoje"]
                      );
                    } else if (id === "mes") {
                      setSelectedAtendimentoFilters((prev) =>
                        prev.includes("mes") ? prev.filter((m) => m !== "mes") : [...prev, "mes"]
                      );
                    }
                  }}
                >
                  <div className="kpi-top">
                    <span className="kpi-label">{label}</span>
                    <span className={`kpi-badge ${badgeClass}`}>
                      <PrototypeIcon name={icon} size="s" />
                    </span>
                  </div>
                  <div className="kpi-value">{value}</div>
                  <div className="kpi-sub-spacer" aria-hidden="true">·</div>
                </button>
              );
            })}
          </div>
          {(previewError || agendaError) && (
            <p role="alert" className="team-error">
              {previewError || agendaError}
              <button
                className="btn-s"
                onClick={() => {
                  loadData();
                  setAgendaReload((n) => n + 1);
                }}
              >
                Tentar novamente
              </button>
            </p>
          )}
          <div className="ws">
            <aside className={`rail ${entrada("agenda-delay-150")}`}>
              <div className="rail-h">
                <PrototypeIcon name="shield" />
                Perfis de acesso<small>{perfisAcesso.length}</small>
              </div>
              {canEditConfigPerfil && (
                <button
                  className="rail-btn-create prominent"
                  onClick={newProfile}
                  aria-label="Criar perfil de acesso"
                >
                  <PrototypeIcon name="plus" size="s" />
                  <span>Criar perfil de acesso</span>
                </button>
              )}
              <button
                className={`rit ${effectiveProfileIds.length === 0 && !viewingProfileId ? "on" : ""}`}
                onClick={handleSelectAllFromRail}
              >
                <span className="dot all">
                  <PrototypeIcon name="users" size="s" />
                </span>
                <span className="nm">
                  <b>Toda a equipe</b>
                  <span>todos os perfis</span>
                </span>
                <span className="ct">{stats.ativos}</span>
              </button>
              {railProfiles.map(railItem)}
              {perfisAcesso.length > 0 && (
                <button
                  type="button"
                  className="rail-see-all-btn"
                  onClick={() => setIsTodosPerfisModalOpen(true)}
                  aria-label={`Ver todos os ${perfisAcesso.length} perfis`}
                >
                  <PrototypeIcon name="shield" size="s" />
                  <span>Ver todos os perfis</span>
                  <span className="rail-see-all-btn-count">{perfisAcesso.length}</span>
                </button>
              )}
            </aside>
            <div style={{ minWidth: 0 }}>
              <div className={`pchips ${entrada("agenda-delay-150")}`}>
                <div className="pcw" ref={chipsRef}>
                  <button
                    type="button"
                    data-fixo
                    aria-pressed={effectiveProfileIds.length === 0 && !viewingProfileId}
                    className={`toque:min-h-[44px] ${effectiveProfileIds.length === 0 && !viewingProfileId ? "on" : ""}`}
                    onClick={handleSelectAllFromRail}
                  >
                    <span className="nm">Toda a equipe</span> <i>{stats.ativos}</i>
                  </button>
                  {barProfiles.map((p) => {
                    const on =
                      viewingProfileId === String(p.id) ||
                      effectiveProfileIds.includes(String(p.id));
                    return (
                      <button
                        type="button"
                        key={p.id}
                        title={p.nome}
                        aria-pressed={on}
                        className={`toque:min-h-[44px] ${on ? "on" : ""}`}
                        onClick={() => handleSelectProfileFromRail(p)}
                      >
                        <PrototypeIcon
                          name={p.codigo === "DONO" ? "crown" : "shield"}
                          size="s"
                        />
                        <span className="nm">{p.nome}</span> <i>{count(p)}</i>
                      </button>
                    );
                  })}
                </div>
                <div className="pcx">
                  {perfisAcesso.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setIsTodosPerfisModalOpen(true)}
                      className="pchip-more toque:min-h-[44px]"
                      aria-label={`Todos os perfis (${perfisAcesso.length})`}
                    >
                      <PrototypeIcon name="shield" size="s" />
                      <span>Todos os perfis</span>
                      <i>{perfisAcesso.length}</i>
                    </button>
                  )}
                  {canEditConfigPerfil && (
                    <button type="button" className="np toque:min-h-[44px]" onClick={newProfile}>
                      <PrototypeIcon name="plus" size="s" />
                      Novo perfil
                    </button>
                  )}
                </div>
              </div>
              {selectedProfile && (
                <section className={`pban ${profileType(selectedProfile)}`}>
                  <div className="t">
                    <div style={{ minWidth: 0 }}>
                      {badge(selectedProfile)}
                      <h3 style={{ marginTop: 8 }}>{selectedProfile.nome}</h3>
                      <p>{selectedProfile.descricao || "Sem descrição"}</p>
                    </div>
                    <div className="ac">
                      {selectedProfile.codigo === "DONO" ? (
                        <span className="lock">
                          <PrototypeIcon name="lock" size="s" />
                          Fixo: o dono sempre tem acesso total
                        </span>
                      ) : (
                        canEditConfigPerfil && (
                          <>
                            <button
                              className="btn-s"
                              onClick={() => setShowVincularMembrosModal(true)}
                              title={`Adicionar membros ao perfil ${selectedProfile.nome}`}
                            >
                              <PrototypeIcon name="uplus" size="s" />
                              Adicionar membros
                            </button>
                            <button
                              className={
                                profileType(selectedProfile) === "tpl"
                                  ? "btn-s"
                                  : "btn-p"
                              }
                              onClick={() =>
                                onEditarPerfilNaAba(selectedProfile.id)
                              }
                            >
                              <PrototypeIcon
                                name={
                                  profileType(selectedProfile) === "tpl"
                                    ? "copy"
                                    : "pen"
                                }
                                size="s"
                              />
                              {profileType(selectedProfile) === "tpl"
                                ? "Usar como base"
                                : "Editar perfil"}
                            </button>
                            {profileType(selectedProfile) === "cli" && (
                              <button
                                className="btn-s"
                                onClick={() => {
                                  setPerfilParaAbrirNaAba(
                                    `copy:${selectedProfile.id}`,
                                  );
                                  setActiveTab("perfis");
                                }}
                              >
                                <PrototypeIcon name="copy" size="s" />
                                Duplicar
                              </button>
                            )}
                          </>
                        )
                      )}
                      <button
                        type="button"
                        className="btn-close-pban"
                        onClick={handleCloseProfileBanner}
                        aria-label="Fechar ficha do perfil e remover filtro"
                        title="Fechar ficha e remover filtro"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  {selectedProfile.codigo === "DONO" &&
                    ownerPerson &&
                    canManageUsers && (
                      <div className="owner-agenda-card">
                        <button
                          type="button"
                          className="rnf-header-top rnf-header-btn"
                          aria-expanded={isOwnerAgendaOpen}
                          aria-controls="owner-agenda-options"
                          onClick={() => setIsOwnerAgendaOpen((prev) => !prev)}
                        >
                          <div
                            className={`area ${agendaModule.k === "0" ? "off" : ""}`}
                          >
                            <b>
                              <PrototypeIcon
                                name={agendaModule.icon}
                                size="s"
                              />
                              <span className="trunc">{agendaModule.name}</span>
                            </b>
                            <span className={`l${agendaModule.k}`}>
                              {agendaModule.k === "c"
                                ? "Parcial"
                                : agendaModule.t}
                            </span>
                          </div>
                          <span className="rnf-toggle-text">
                            <span className="lbl">Mais configurações</span>
                            <PrototypeIcon
                              name="cd"
                              size="s"
                              className={`rnf-chevron ${isOwnerAgendaOpen ? "open" : ""}`}
                            />
                          </span>
                        </button>
                        {isOwnerAgendaOpen && (
                          <div
                            className="owner-agenda-options"
                            id="owner-agenda-options"
                          >
                            <div className="options-stack-2a">
                              {[
                                [
                                  "AGENDA_APARECER",
                                  "Aparecer na agenda",
                                  "Receber agendamentos e definir seus horários de atendimento.",
                                ],
                                [
                                  "AGENDA_MULTI_VER",
                                  "Ver múltiplas agendas",
                                  "Consultar as agendas dos profissionais da clínica.",
                                ],
                              ].map(([code, label, description]) => {
                                const permission = permissoes.find(
                                  (p) => p.codigo === code,
                                );
                                return (
                                  <div className="option-row-2a" key={code}>
                                    <div className="option-top-2a">
                                      <Switch
                                        checked={Boolean(
                                          permission &&
                                          profileIds(selectedProfile)?.includes(
                                            permission.permissaoId,
                                          ),
                                        )}
                                        ariaLabel={label}
                                        disabled={Boolean(
                                          savingOwnerAgenda ||
                                          previewLoading ||
                                          previewError ||
                                          !permission ||
                                          !profileIds(selectedProfile),
                                        )}
                                        loading={savingOwnerAgenda === code}
                                        onChange={(enabled) =>
                                          changeOwnerAgenda(code, enabled)
                                        }
                                      />
                                      <strong>{label}</strong>
                                    </div>
                                    <p>{description}</p>
                                  </div>
                                );
                              })}
                            </div>
                            {ownerAgendaError && (
                              <p role="alert">{ownerAgendaError}</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  {previewLoading || previewError ? (
                    <p role={previewError ? "alert" : "status"}>
                      {previewError || "Carregando funções…"}
                      {previewError && (
                        <button className="btn-s" onClick={loadData}>
                          Tentar novamente
                        </button>
                      )}
                    </p>
                  ) : (
                    <>
                      <div className="gauge">
                        <b>
                          {profileIds(selectedProfile)
                            ? profileFunctionCount(profileIds(selectedProfile), permissoes, selectedProfile.codigo === "DONO")
                            : "—"} de{" "}
                          {catalogFunctionTotal(permissoes)} funções
                        </b>
                        <span className="bar">
                          <i
                            style={{
                              width: `${(profileFunctionCount(profileIds(selectedProfile), permissoes, selectedProfile.codigo === "DONO") / (catalogFunctionTotal(permissoes) || 1)) * 100}%`,
                            }}
                          />
                        </span>
                        <span
                          className={
                            attends(selectedProfile) ? "ag-yes" : "ag-no"
                          }
                        >
                          <PrototypeIcon
                            name={attends(selectedProfile) ? "calok" : "caloff"}
                            size="s"
                          />
                          {attends(selectedProfile)
                            ? "Atende na agenda"
                            : "Não atende"}
                        </span>
                        <span>
                          ·{" "}
                          {count(selectedProfile)
                            ? `${count(selectedProfile)} ${count(selectedProfile) === 1 ? "pessoa" : "pessoas"}`
                            : "ninguém usa"}
                        </span>
                      </div>
                      <div className="areas">
                        {summarizeModules(
                          permissoes,
                          profileIds(selectedProfile),
                        ).map((m) => (
                          <div
                            key={m.key}
                            className={`area ${m.k === "0" ? "off" : ""}`}
                          >
                            <b>
                              <PrototypeIcon name={m.icon} size="s" />
                              <span className="trunc">{m.name}</span>
                            </b>
                            <i className="pips" aria-hidden="true">
                              {[1, 2, 3].map((n) => (
                                <u
                                  key={n}
                                  className={n <= (m.k === "c" ? 2 : Number(m.k)) ? "on" : ""}
                                />
                              ))}
                            </i>
                            <span className={`l${m.k}`}>
                              {m.k === "c" ? "Parcial" : m.t}
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </section>
              )}
              <div className="tool">
                <label className="search">
                  <PrototypeIcon name="search" />
                  <input
                    id="inputBuscaEquipe"
                    placeholder="Buscar por nome, e-mail ou telefone"
                    aria-label="Buscar pessoa"
                    value={searchName}
                    onChange={(e) => setSearchName(e.target.value)}
                  />
                </label>

                {canCreateUsers && (
                  <button
                    type="button"
                    className="btn-p tool-action-btn"
                    onClick={() => setShowInviteModal(true)}
                    aria-label="Convidar pessoa"
                  >
                    <PrototypeIcon name="uplus" size="s" />
                    <span className="lbl">Convidar pessoa</span>
                  </button>
                )}

                <div className="filter-wrapper" style={{ position: "relative" }}>
                  <button
                    type="button"
                    ref={filterBtnRef}
                    className={`filter-btn ${activeFiltersCount > 0 ? "has-filters" : ""}`}
                    onClick={() => {
                      setIsFilterPopoverOpen((prev) => !prev);
                      setIsSortMenuOpen(false);
                    }}
                    aria-expanded={isFilterPopoverOpen}
                    aria-haspopup="dialog"
                    aria-label="Filtros"
                  >
                    <PrototypeIcon name="filter" size="s" />
                    <span className="lbl">Filtros</span>
                    {activeFiltersCount > 0 && (
                      <span className="filter-btn-count">
                        {activeFiltersCount}
                      </span>
                    )}
                  </button>

                  <FiltrosFolha
                    aberto={isFilterPopoverOpen}
                    onFechar={() => setIsFilterPopoverOpen(false)}
                    retornoFocoRef={filterBtnRef}
                    total={filteredUsers.length}
                    nFiltros={activeFiltersCount}
                    onLimpar={clearAllFilters}
                    perfis={sortProfilesByHierarchy(perfisAcesso, permissionsByProfile, permissoes)}
                    alcance={(p) => profileFunctionCount(profileIds(p), permissoes, p.codigo === "DONO")}
                    totalCatalogo={catalogFunctionTotal(permissoes)}
                    uso={count}
                    perfisSelecionados={effectiveProfileIds}
                    onPerfil={(strId, marcado) => {
                      setSelectedProfileIds((prev) =>
                        marcado ? [...prev.filter((id) => id !== strId), strId] : prev.filter((id) => id !== strId),
                      );
                      if (filterLevel === strId) setFilterLevel("");
                    }}
                    grupos={gruposFolha}
                  />
                </div>

                <div
                  className="sort-wrapper"
                  ref={sortMenuRef}
                  style={{ position: "relative" }}
                >
                  <button
                    type="button"
                    className="sort-btn"
                    onClick={() => {
                      setIsSortMenuOpen((prev) => !prev);
                      setIsFilterPopoverOpen(false);
                    }}
                    aria-expanded={isSortMenuOpen}
                    aria-haspopup="menu"
                    aria-label="Opções de ordenação"
                  >
                    <PrototypeIcon name="sort" size="s" />
                    <span className="lbl">
                      {sortOption === "hier"
                        ? "Hierarquia"
                        : sortOption === "az"
                        ? "Nome (A–Z)"
                        : sortOption === "za"
                          ? "Nome (Z–A)"
                          : sortOption === "perfil"
                            ? "Perfil de acesso (A–Z)"
                            : "Mais atendimentos"}
                    </span>
                  </button>

                  {isSortMenuOpen && (
                    <div
                      className="sort-menu"
                      role="menu"
                      aria-label="Menu de ordenação"
                    >
                      {[
                        { id: "hier", label: "Hierarquia" },
                        { id: "az", label: "Nome (A–Z)" },
                        { id: "za", label: "Nome (Z–A)" },
                        { id: "perfil", label: "Perfil de acesso (A–Z)" },
                        { id: "atendimentos", label: "Mais atendimentos" },
                      ].map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          role="menuitem"
                          className={`sort-item ${sortOption === opt.id ? "selected" : ""}`}
                          onClick={() => {
                            setSortOption(opt.id);
                            setIsSortMenuOpen(false);
                          }}
                        >
                          <span>{opt.label}</span>
                          {sortOption === opt.id && <span>✓</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {activeFiltersCount > 0 && (
                    <button
                      type="button"
                      className="btn-g"
                      onClick={clearAllFilters}
                      aria-label="Limpar todos os filtros"
                    >
                      Limpar filtros
                    </button>
                  )}
              </div>

              {activeFiltersCount > 0 && (
                <div className="active-pills-bar" aria-label="Filtros ativos">
                  <span className="active-pills-title">Filtros ativos:</span>
                  {Boolean(searchName) && (
                    <span className="active-pill">
                      Busca: &ldquo;{searchName}&rdquo;
                      <button
                        type="button"
                        className="active-pill-remove"
                        onClick={() => setSearchName("")}
                        aria-label="Remover filtro de busca"
                      >
                        ✕
                      </button>
                    </span>
                  )}
                  {effectiveProfileIds.map((pId) => {
                    const profile = perfisAcesso.find((p) => String(p.id) === String(pId));
                    if (!profile) return null;
                    return (
                      <span className="active-pill" key={pId}>
                        Perfil: {profile.nome}
                        <button
                          type="button"
                          className="active-pill-remove"
                          onClick={() => {
                            setSelectedProfileIds((prev) => prev.filter((id) => id !== pId));
                            if (filterLevel === pId) setFilterLevel("");
                            if (viewingProfileId === pId) setViewingProfileId(null);
                          }}
                          aria-label={`Remover filtro de perfil ${profile.nome}`}
                        >
                          ✕
                        </button>
                      </span>
                    );
                  })}
                  {selectedStatusFilters.includes("ativos") && (
                    <span className="active-pill">
                      Status: Ativos
                      <button
                        type="button"
                        className="active-pill-remove"
                        onClick={() => {
                          setSelectedStatusFilters((prev) => prev.filter((s) => s !== "ativos"));
                        }}
                        aria-label="Remover filtro de status"
                      >
                        ✕
                      </button>
                    </span>
                  )}
                  {selectedStatusFilters.includes("inativos") && (
                    <span className="active-pill">
                      Status: Inativos
                      <button
                        type="button"
                        className="active-pill-remove"
                        onClick={() => {
                          setSelectedStatusFilters((prev) => prev.filter((s) => s !== "inativos"));
                        }}
                        aria-label="Remover filtro de status inativos"
                      >
                        ✕
                      </button>
                    </span>
                  )}
                  {selectedStatusFilters.includes("semperfil") && (
                    <span className="active-pill">
                      Status: Sem perfil
                      <button
                        type="button"
                        className="active-pill-remove"
                        onClick={() => {
                          setSelectedStatusFilters((prev) => prev.filter((s) => s !== "semperfil"));
                        }}
                        aria-label="Remover filtro de sem perfil"
                      >
                        ✕
                      </button>
                    </span>
                  )}
                  {selectedAgendaFilters.includes("yes") && (
                    <span className="active-pill">
                      Agenda: Atendem
                      <button
                        type="button"
                        className="active-pill-remove"
                        onClick={() => {
                          setSelectedAgendaFilters((prev) => prev.filter((a) => a !== "yes"));
                          if (agendaAvailabilityFilter === "yes") setAgendaAvailabilityFilter("all");
                        }}
                        aria-label="Remover filtro de agenda atendem"
                      >
                        ✕
                      </button>
                    </span>
                  )}
                  {selectedAgendaFilters.includes("no") && (
                    <span className="active-pill">
                      Agenda: Não atendem
                      <button
                        type="button"
                        className="active-pill-remove"
                        onClick={() => {
                          setSelectedAgendaFilters((prev) => prev.filter((a) => a !== "no"));
                          if (agendaAvailabilityFilter === "no") setAgendaAvailabilityFilter("all");
                        }}
                        aria-label="Remover filtro de agenda"
                      >
                        ✕
                      </button>
                    </span>
                  )}
                  {selectedAtendimentoFilters.includes("hoje") && (
                    <span className="active-pill">
                      Atendimentos: Hoje
                      <button
                        type="button"
                        className="active-pill-remove"
                        onClick={() => {
                          setSelectedAtendimentoFilters((prev) => prev.filter((h) => h !== "hoje"));
                        }}
                        aria-label="Remover filtro de atendimentos hoje"
                      >
                        ✕
                      </button>
                    </span>
                  )}
                  {selectedAtendimentoFilters.includes("mes") && (
                    <span className="active-pill">
                      Atendimentos: Em {monthName}
                      <button
                        type="button"
                        className="active-pill-remove"
                        onClick={() => {
                          setSelectedAtendimentoFilters((prev) => prev.filter((m) => m !== "mes"));
                        }}
                        aria-label={`Remover filtro de atendimentos em ${monthName}`}
                      >
                        ✕
                      </button>
                    </span>
                  )}
                  <button
                    type="button"
                    className="btn-clear-all"
                    onClick={clearAllFilters}
                  >
                    Limpar todos
                  </button>
                </div>
              )}
              <div className="lst" aria-label="Pessoas da equipe">
                <div className="lhd" role="row">
                  {[
                    ["Pessoa e cargo", ["az", "za"], sortOption === "az" ? "za" : "az", "Ordenar por nome", ""],
                    ["Perfil de acesso", ["hier", "perfil"], "hier", "Ordenar pela hierarquia do perfil", ""],
                  ].map(([rotulo, ativas, alvo, dica, extra]) => (
                    <div
                      key={rotulo}
                      role="columnheader"
                      className={extra}
                      aria-sort={
                        ativas.includes(sortOption)
                          ? ["az", "perfil"].includes(sortOption) ? "ascending" : "descending"
                          : "none"
                      }
                    >
                      <button
                        type="button"
                        className={`lhd-sort ${ativas.includes(sortOption) ? "so" : ""}`}
                        title={dica}
                        onClick={() => setSortOption(alvo)}
                      >
                        {rotulo}
                        {ativas.includes(sortOption) && (
                          <span aria-hidden="true" className="lhd-seta">
                            {["az", "perfil"].includes(sortOption) ? "↑" : "↓"}
                          </span>
                        )}
                      </button>
                    </div>
                  ))}
                  <span role="columnheader">Hoje</span>
                  <div
                    role="columnheader"
                    className="h-mes"
                    aria-sort={sortOption === "atendimentos" ? "descending" : "none"}
                  >
                    <button
                      type="button"
                      className={`lhd-sort ${sortOption === "atendimentos" ? "so" : ""}`}
                      title="Ordenar por atendimentos no mês"
                      onClick={() => setSortOption("atendimentos")}
                    >
                      Atendimentos
                      {sortOption === "atendimentos" && (
                        <span aria-hidden="true" className="lhd-seta">↓</span>
                      )}
                    </button>
                  </div>
                  <span aria-hidden="true" />
                </div>
                {filteredUsers.length ? (
                  filteredUsers.map((u) => {
                    const pf = perfisAcesso.find(
                      (p) => p.id === u.perfilAcessoId,
                    );
                    const today = appointmentsFor(u).filter(
                      (a) => a.dataAgendamento === hojeIso,
                    );
                    const semPerfil = u.ativo !== false && !u.perfilAcessoId;
                    const botaoAtribuir =
                      semPerfil && canManageUsers && u.perfilAcessoCodigo !== "DONO" ? (
                        <button
                          type="button"
                          className="btn-s atr-perfil"
                          onClick={(event) => {
                            event.stopPropagation();
                            setAtribuirPessoa(u);
                          }}
                        >
                          Atribuir perfil
                        </button>
                      ) : null;
                    return (
                      <div
                        className={`row ${semPerfil ? "row-aviso" : ""} ${entrada("agenda-delay-200")}`}
                        key={u.id}
                        role="button"
                        tabIndex={0}
                        aria-label={`Abrir ficha de ${nameOf(u)}`}
                        onClick={() => openDetail(u)}
                        onKeyDown={(event) => {
                          if (event.target !== event.currentTarget) return;
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            openDetail(u);
                          }
                        }}
                        style={
                          u.ativo === false ? { opacity: 0.55 } : undefined
                        }
                      >
                        <div className="who c-who">
                          {avatar(u)}
                          <span className="t">
                            <b className="trunc">{nameOf(u)}</b>
                            <span className="trunc">
                              {formatCargoLabel(u.roleName)}
                              {u.ativo === false ? " · desativado" : ""}
                            </span>
                          </span>
                        </div>
                        <div className="c-pf">
                          {badge(pf)}
                          {botaoAtribuir}
                        </div>
                        <div className="c-hoje">
                          {u.apareceNaAgenda ? (
                            <div className="today">
                              {today.length ? (
                                <>
                                  <b>{today.length} hoje</b>
                                  <span>
                                    próximo às{" "}
                                    {String(today[0].horaInicio || "").slice(
                                      0,
                                      5,
                                    )}
                                  </span>
                                </>
                              ) : (
                                <span>
                                  {agenda ? "sem horários hoje" : "—"}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="ag-no">
                              <PrototypeIcon name="caloff" size="s" />
                              Não atende
                            </span>
                          )}
                        </div>
                        <div className="c-mes mes">
                          {u.apareceNaAgenda && agenda ? (
                            <>
                              {
                                appointmentsFor(u).filter(
                                  (a) =>
                                    a.dataAgendamento?.startsWith(
                                      hojeIso.slice(0, 7),
                                    ) &&
                                    String(a.statusCodigo).toUpperCase() ===
                                    "REALIZADO",
                                ).length
                              }
                              <span>em {monthName}</span>
                            </>
                          ) : (
                            "—"
                          )}
                        </div>
                        <div className="racts c-acts">
                          {u.telefone && (
                            <a
                              className="ib"
                              title="WhatsApp"
                              href={`https://wa.me/${u.telefone.replace(/\D/g, "")}`}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <PrototypeIcon name="wa" />
                            </a>
                          )}
                          <button
                            className="vm"
                            aria-label={`Ver ${nameOf(u)}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              openDetail(u);
                            }}
                          >
                            <span className="lbl">Ver</span>
                            <PrototypeIcon name="cr" size="s" />
                          </button>
                        </div>
                        <div className="c-meta">
                          {badge(pf)}
                          <span
                            className={u.apareceNaAgenda ? "ag-yes" : "ag-no"}
                          >
                            <PrototypeIcon
                              name={u.apareceNaAgenda ? "cal" : "caloff"}
                              size="s"
                            />
                            {u.apareceNaAgenda && agenda
                              ? `${today.length} hoje`
                              : "Não atende"}
                          </span>
                          {botaoAtribuir}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="empty">
                    <PrototypeIcon name="users" size="l" />
                    <b>Nenhuma pessoa encontrada</b>Revise a busca e os filtros.
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
      <AtribuirPerfilModal
        aberto={Boolean(atribuirPessoa)}
        pessoa={atribuirPessoa}
        perfis={perfisAcesso}
        permissionsByProfile={permissionsByProfile}
        catalogo={permissoes}
        onFechar={() => setAtribuirPessoa(null)}
        onConfirmar={async (perfilId) => {
          try {
            await saveAccess(atribuirPessoa, { perfilAcessoId: perfilId });
            setAtribuirPessoa(null);
          } catch (err) {
            toast.error(getApiErrorToastMessage(err, "Não foi possível atribuir o perfil."));
          }
        }}
      />
      {showInviteModal && (
        <InviteModal
          roles={roles}
          perfisAcesso={perfisAcesso}
          permissoes={permissoes}
          especialidadesList={especialidadesList}
          initialDraft={inviteDraft}
          canEditConfigPerfil={canEditConfigPerfil}
          onClose={() => {
            setShowInviteModal(false);
            setInviteDraft(null);
          }}
          onSuccess={() => {
            setShowInviteModal(false);
            setInviteDraft(null);
            loadData();
            onEquipeInvalidate?.();
          }}
          fetchHeaders={fetchHeaders}
          onEditarPerfilNaAba={(id, draft) => {
            setInviteDraft(draft);
            setShowInviteModal(false);
            onEditarPerfilNaAba(id);
          }}
        />
      )}
      {showVincularMembrosModal && selectedProfile && (
        <VincularMembrosAoPerfilModal
          isOpen={showVincularMembrosModal}
          onClose={() => setShowVincularMembrosModal(false)}
          selectedProfile={selectedProfile}
          usuarios={usuarios}
          perfisAcesso={perfisAcesso}
          onSuccess={async () => {
            await loadData();
            onEquipeInvalidate?.();
          }}
        />
      )}
      {isTodosPerfisModalOpen &&
        createPortal(
          <div className="prototype-equipe">
            <div
              className="modal-todos-perfis-overlay"
              onClick={(e) => {
                if (e.target === e.currentTarget) setIsTodosPerfisModalOpen(false);
              }}
            >
              <div
                className="modal-card modal-todos-perfis"
                ref={modalPerfisRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="modalTodosPerfisTitulo"
              >
                <div className="modal-header">
                  <div className="modal-header-left">
                    <div className="modal-header-icon" aria-hidden="true">
                      <PrototypeIcon name="shield" size="m" />
                    </div>
                    <div className="modal-header-text">
                      <h3 id="modalTodosPerfisTitulo">Todos os perfis de acesso</h3>
                      <p>Consulte e escolha quais perfis ficam na barra da equipe.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="modal-close-btn"
                    onClick={() => setIsTodosPerfisModalOpen(false)}
                    aria-label="Fechar modal"
                  >
                    ✕
                  </button>
                </div>

                <div className="modal-search-bar">
                  <PrototypeIcon name="search" size="s" />
                  <input
                    type="text"
                    placeholder="Buscar perfil pelo nome..."
                    value={todosPerfisSearch}
                    onChange={(e) => setTodosPerfisSearch(e.target.value)}
                    aria-label="Buscar perfil na lista completa"
                    data-foco-inicial
                    className="toque:text-base"
                  />
                  <button
                    type="button"
                    className="btn-s sm toque:min-h-[44px] shrink-0"
                    onClick={allPinned ? unpinAllProfiles : pinAllProfiles}
                  >
                    {allPinned ? "Desafixar todos" : "Fixar todos"}
                  </button>
                </div>

                <div className="modal-perfis-list">
                  {sortedProfiles
                    .filter((p) =>
                    p.nome.toLowerCase().includes(todosPerfisSearch.toLowerCase()),
                  )
                    .map((p) => {
                      const strId = String(p.id);
                      const isPinned = activePinnedProfileIds.includes(strId);
                      const funcoesCount = profileIds(p)
                        ? profileFunctionCount(profileIds(p), permissoes, p.codigo === "DONO")
                        : 0;
                      return (
                        <div key={p.id} className="modal-perfil-card">
                          <div className="modal-perfil-select">
                            <span className={`dot ${profileType(p)}`}>
                              <PrototypeIcon
                                name={p.codigo === "DONO" ? "crown" : "shield"}
                                size="s"
                              />
                            </span>
                            <div className="modal-perfil-info">
                              <b className="modal-perfil-name">{p.nome}</b>
                              <span className="modal-perfil-alcance" aria-hidden="true">
                                <i
                                  style={{
                                    width: `${Math.max((funcoesCount / (catalogFunctionTotal(permissoes) || 1)) * 100, 3)}%`,
                                  }}
                                />
                              </span>
                              <span className="modal-perfil-meta">
                                {count(p)} membro(s) · {funcoesCount} de {catalogFunctionTotal(permissoes)} funções ·{" "}
                                <span className={attends(p) ? "meta-atende" : "meta-nao-atende"}>
                                  {attends(p) ? "Atende na agenda" : "Não atende"}
                                </span>
                              </span>
                            </div>
                          </div>

                          <div className="modal-perfil-actions">
                            <button
                              type="button"
                              className={`btn-pin toque:min-h-[44px] shrink-0 ${isPinned ? "pinned" : ""}`}
                              onClick={() => togglePinProfile(strId)}
                              title={isPinned ? "Desafixar da barra lateral" : "Fixar na barra lateral"}
                              aria-label={isPinned ? `Desafixar ${p.nome}` : `Fixar ${p.nome}`}
                            >
                              <PrototypeIcon name="pin" size="s" />
                              <span>{isPinned ? "Fixado" : "Fixar"}</span>
                            </button>

                            <button
                              type="button"
                              className="btn-s btn-ficha toque:min-h-[44px] shrink-0"
                              onClick={() => {
                                setViewingProfileId(strId);
                                setIsTodosPerfisModalOpen(false);
                              }}
                              aria-label={`Ver ficha de ${p.nome}`}
                            >
                              Ver ficha
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>

                <div className="modal-footer">
                  <span className="modal-footer-stats">
                    <b>{pinnedCount}</b> de {sortedProfiles.length} fixados na barra
                  </span>
                  <div className="modal-footer-actions">
                    {canEditConfigPerfil && (
                      <button
                        type="button"
                        className="btn-s toque:min-h-[44px]"
                        onClick={() => {
                          setIsTodosPerfisModalOpen(false);
                          newProfile();
                        }}
                      >
                        <PrototypeIcon name="plus" size="s" />
                        Criar perfil
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn-p toque:min-h-[44px]"
                      onClick={() => setIsTodosPerfisModalOpen(false)}
                    >
                      Pronto
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}

    </div>
  );
}
