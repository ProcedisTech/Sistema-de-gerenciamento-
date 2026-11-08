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
  sortPrototypeProfiles,
  effectiveProfilePermissions,
  summarizeModules,
} from "./equipePrototypeUtils";
import "./equipePrototypeBase.css";
import "./gestaoEquipe.css";
import { useAgoraDaClinica } from "../hooks/useAgoraDaClinica.js";

export function GestaoUsuariosView({
  initialTab = "membros",
  onDisponibilidadeInvalidate,
  onEquipeInvalidate,
  onNavigateAgenda,
  onSelectPatient,
  targetUserId,
  onClearTargetUserId,
  onPerfilAtualizado,
}) {
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
    targetUserId === "me" ? currentRoleUserId : targetUserId;
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
  const [activeTab, setActiveTab] = useState(initialTab || "membros"); // 'membros' | 'auditoria' | 'perfis'
  const [perfilParaAbrirNaAba, setPerfilParaAbrirNaAba] = useState(null);

  const onEditarPerfilNaAba = useCallback((perfilAcessoId) => {
    setDetailId(null);
    setPerfilParaAbrirNaAba(perfilAcessoId);
    setActiveTab("perfis");
  }, []);

  // Filtros
  const [searchName, setSearchName] = useState("");
  const [filterLevel, setFilterLevel] = useState("");
  const [selectedStatusFilters, setSelectedStatusFilters] = useState([]); // 'ativos', 'inativos'
  const [selectedAgendaFilters, setSelectedAgendaFilters] = useState([]); // 'yes', 'no'
  const [selectedProfileIds, setSelectedProfileIds] = useState([]); // string[]
  const [selectedAtendimentoFilters, setSelectedAtendimentoFilters] = useState([]); // 'hoje', 'mes'
  const [viewingProfileId, setViewingProfileId] = useState(null); // string | null (profile cuja ficha está aberta no .pban)
  const [isTodosPerfisModalOpen, setIsTodosPerfisModalOpen] = useState(false);
  const [profileSearchInFilter, setProfileSearchInFilter] = useState("");
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
  const [detailId, setDetailId] = useState(null);
  const [sortOption, setSortOption] = useState("az"); // 'az' | 'za' | 'perfil' | 'atendimentos'
  const [isFilterPopoverOpen, setIsFilterPopoverOpen] = useState(false);
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


  useEffect(() => {
    if (!resolvedTarget || (!canSeeConfigEquipe && !selfTarget)) return;
    setDetailId(String(resolvedTarget));
    setActiveTab("membros");
  }, [resolvedTarget, canSeeConfigEquipe, selfTarget]);

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
    setDetailId(u.id);
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
  const sortedProfiles = sortPrototypeProfiles(perfisAcesso);

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

  const togglePinProfile = (id) => {
    const strId = String(id);
    setPinnedProfileIds((prev) => {
      const current = prev && prev.length > 0 ? prev : sortedProfiles.slice(0, 7).map((p) => String(p.id));
      const next = current.includes(strId)
        ? current.filter((item) => item !== strId)
        : [...current, strId];
      try {
        localStorage.setItem(`procedi_pinned_profiles_${orgId}`, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

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
            ? `${profileIds(profile).length} de ${permissoes.length} · ${attends(profile) ? "atende" : "não atende"}`
            : previewLoading
              ? "Carregando funções…"
              : "Funções indisponíveis"}
        </span>
      </span>
      <span className="ct">{count(profile)}</span>
    </button>
  );
  const backToTeam = () => {
    setDetailId(null);
    setActiveTab("membros");
    onClearTargetUserId?.();
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
          onBack={() => {
            backToTeam();
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
          <div className="kpis">
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
                id: "conv",
                label: "CONVITES PENDENTES",
                value: "—",
                badgeClass: "kpi-badge-slate",
                icon: "mail",
              },
            ].map(({ id, label, value, badgeClass, icon }) => {
              const isKpiActive =
                id === "ativos"
                  ? selectedStatusFilters.includes("ativos")
                  : id === "agenda"
                    ? selectedAgendaFilters.includes("yes")
                    : id === "hoje"
                      ? selectedAtendimentoFilters.includes("hoje")
                      : id === "mes"
                        ? selectedAtendimentoFilters.includes("mes")
                        : false;
              return (
                <button
                  type="button"
                  key={id}
                  className={`kpi ${isKpiActive ? "on" : ""}`}
                  title={
                    id === "conv"
                      ? "Convites pendentes por e-mail ainda não disponíveis na API."
                      : !canSeeAgendaMulti && (id === "hoje" || id === "mes")
                        ? "Dados da agenda disponíveis para seu acesso."
                        : undefined
                  }
                  onClick={() => {
                    if (id === "conv") {
                      toast.info(
                        "O sistema atual cria o acesso diretamente. Convites pendentes por e-mail ainda não estão disponíveis.",
                      );
                      return;
                    }
                    if (id === "ativos") {
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
            <aside className="rail">
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
              <div className="pchips">
                <button
                  className={effectiveProfileIds.length === 0 && !viewingProfileId ? "on" : ""}
                  onClick={handleSelectAllFromRail}
                >
                  Toda a equipe <i>{stats.ativos}</i>
                </button>
                {railProfiles.map((p) => (
                  <button
                    key={p.id}
                    className={viewingProfileId === String(p.id) || effectiveProfileIds.includes(String(p.id)) ? "on" : ""}
                    onClick={() => handleSelectProfileFromRail(p)}
                  >
                    <PrototypeIcon
                      name={p.codigo === "DONO" ? "crown" : "shield"}
                      size="s"
                    />
                    {p.nome} <i>{count(p)}</i>
                  </button>
                ))}
                {perfisAcesso.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsTodosPerfisModalOpen(true)}
                    className="pchip-more"
                  >
                    Ver todos ({perfisAcesso.length})
                  </button>
                )}
                {canEditConfigPerfil && (
                  <button onClick={newProfile}>
                    <PrototypeIcon name="plus" size="s" />
                    Novo perfil
                  </button>
                )}
              </div>
              {selectedProfile && (
                <section className={`pban ${profileType(selectedProfile)}`}>
                  <div className="t">
                    <div style={{ minWidth: 0 }}>
                      {badge(selectedProfile)}
                      <h3 style={{ marginTop: 8 }}>{selectedProfile.nome}</h3>
                      <p>{selectedProfile.descricao || "Sem descrição."}</p>
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
                          {profileIds(selectedProfile)?.length ?? "—"} de{" "}
                          {permissoes.length} funções
                        </b>
                        <span className="bar">
                          <i
                            style={{
                              width: `${((profileIds(selectedProfile)?.length || 0) / (permissoes.length || 1)) * 100}%`,
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
                        <span>· {count(selectedProfile)} pessoas</span>
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

                <div
                  className="filter-wrapper"
                  ref={filterPopoverRef}
                  style={{ position: "relative" }}
                >
                  <button
                    type="button"
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

                  {isFilterPopoverOpen && (
                    <div
                      className="filter-popover"
                      role="dialog"
                      aria-label="Opções de filtros"
                    >
                      <div className="popover-h">
                        <h3>Filtrar Pessoas</h3>
                        {activeFiltersCount > 0 && (
                          <button
                            type="button"
                            className="btn-clear-all"
                            onClick={clearAllFilters}
                          >
                            Limpar
                          </button>
                        )}
                      </div>

                      <div className="popover-section">
                        <span className="section-title">Status do Acesso</span>
                        <div className="popover-options-vertical">
                          <label className="popover-checkbox-row">
                            <input
                              type="checkbox"
                              checked={effectiveStatusFilters.includes("ativos")}
                              onChange={(e) => {
                                setSelectedStatusFilters((prev) =>
                                  e.target.checked
                                    ? [...prev.filter((s) => s !== "ativos"), "ativos"]
                                    : prev.filter((s) => s !== "ativos"),
                                );
                                setStatusFilter("");
                              }}
                              aria-label="Apenas Ativos"
                            />
                            <span>Apenas Ativos</span>
                          </label>
                          <label className="popover-checkbox-row">
                            <input
                              type="checkbox"
                              checked={effectiveStatusFilters.includes("inativos")}
                              onChange={(e) => {
                                setSelectedStatusFilters((prev) =>
                                  e.target.checked
                                    ? [...prev.filter((s) => s !== "inativos"), "inativos"]
                                    : prev.filter((s) => s !== "inativos"),
                                );
                                setStatusFilter("");
                              }}
                              aria-label="Apenas Inativos"
                            />
                            <span>Apenas Inativos</span>
                          </label>
                        </div>
                      </div>

                      <div className="popover-section">
                        <div className="popover-section-header">
                          <span className="section-title">Perfil de Acesso</span>
                          {perfisAcesso.length > 0 && (
                            <button
                              type="button"
                              className="popover-link-action"
                              onClick={() => {
                                setIsFilterPopoverOpen(false);
                                setIsTodosPerfisModalOpen(true);
                              }}
                            >
                              Ver todos ({perfisAcesso.length})
                            </button>
                          )}
                        </div>
                        <div className="popover-search-input-wrap">
                          <PrototypeIcon name="search" size="s" />
                          <input
                            type="text"
                            placeholder="Buscar perfil..."
                            value={profileSearchInFilter}
                            onChange={(e) => setProfileSearchInFilter(e.target.value)}
                            aria-label="Buscar perfil no filtro"
                            className="popover-mini-search"
                          />
                        </div>
                        <div className="popover-profiles-list">
                          {perfisAcesso
                            .filter((p) =>
                              p.nome
                                .toLowerCase()
                                .includes(profileSearchInFilter.toLowerCase()),
                            )
                            .map((p) => {
                              const strId = String(p.id);
                              const isChecked = effectiveProfileIds.includes(strId);
                              return (
                                <label key={p.id} className="popover-checkbox-row">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => {
                                      setSelectedProfileIds((prev) =>
                                        e.target.checked
                                          ? [...prev.filter((id) => id !== strId), strId]
                                          : prev.filter((id) => id !== strId),
                                      );
                                      if (filterLevel === strId) setFilterLevel("");
                                    }}
                                    aria-label={p.nome}
                                  />
                                  <span className={`dot ${profileType(p)} mini`}>
                                    <PrototypeIcon
                                      name={p.codigo === "DONO" ? "crown" : "shield"}
                                      size="s"
                                    />
                                  </span>
                                  <span className="popover-profile-name">{p.nome}</span>
                                  <span className="popover-profile-count">{count(p)}</span>
                                </label>
                              );
                            })}
                        </div>
                      </div>

                      <div className="popover-section">
                        <span className="section-title">
                          Disponibilidade na Agenda
                        </span>
                        <div className="popover-options-vertical">
                          <label className="popover-checkbox-row">
                            <input
                              type="checkbox"
                              checked={effectiveAgendaFilters.includes("yes")}
                              onChange={(e) => {
                                setSelectedAgendaFilters((prev) =>
                                  e.target.checked
                                    ? [...prev.filter((a) => a !== "yes"), "yes"]
                                    : prev.filter((a) => a !== "yes"),
                                );
                                setAgendaAvailabilityFilter("all");
                              }}
                              aria-label="Atendem na agenda"
                            />
                            <span>Atendem na agenda</span>
                          </label>
                          <label className="popover-checkbox-row">
                            <input
                              type="checkbox"
                              checked={effectiveAgendaFilters.includes("no")}
                              onChange={(e) => {
                                setSelectedAgendaFilters((prev) =>
                                  e.target.checked
                                    ? [...prev.filter((a) => a !== "no"), "no"]
                                    : prev.filter((a) => a !== "no"),
                                );
                                setAgendaAvailabilityFilter("all");
                              }}
                              aria-label="Não atendem"
                            />
                            <span>Não atendem</span>
                          </label>
                        </div>
                      </div>

                      <div className="popover-section">
                        <span className="section-title">Atendimentos</span>
                        <div className="popover-options-vertical">
                          <label className="popover-checkbox-row">
                            <input
                              type="checkbox"
                              checked={selectedAtendimentoFilters.includes("hoje")}
                              onChange={(e) => {
                                setSelectedAtendimentoFilters((prev) =>
                                  e.target.checked
                                    ? [...prev.filter((h) => h !== "hoje"), "hoje"]
                                    : prev.filter((h) => h !== "hoje"),
                                );
                              }}
                              aria-label="Atendimentos hoje"
                            />
                            <span>Atendimentos hoje</span>
                          </label>
                          <label className="popover-checkbox-row">
                            <input
                              type="checkbox"
                              checked={selectedAtendimentoFilters.includes("mes")}
                              onChange={(e) => {
                                setSelectedAtendimentoFilters((prev) =>
                                  e.target.checked
                                    ? [...prev.filter((m) => m !== "mes"), "mes"]
                                    : prev.filter((m) => m !== "mes"),
                                );
                              }}
                              aria-label={`Atendimentos em ${monthName}`}
                            />
                            <span>Atendimentos em {monthName}</span>
                          </label>
                        </div>
                      </div>

                      <div className="popover-actions">
                        <button
                          type="button"
                          className="btn-s"
                          style={{ width: "100%" }}
                          onClick={() => setIsFilterPopoverOpen(false)}
                        >
                          Fechar
                        </button>
                      </div>
                    </div>
                  )}
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
                      {sortOption === "az"
                        ? "Nome (A–Z)"
                        : sortOption === "za"
                          ? "Nome (Z–A)"
                          : sortOption === "perfil"
                            ? "Perfil de acesso"
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
                        { id: "az", label: "Nome (A–Z)" },
                        { id: "za", label: "Nome (Z–A)" },
                        { id: "perfil", label: "Perfil de acesso" },
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

              <div
                className="quick-chips"
                aria-label="Filtros rápidos de status"
              >
                <button
                  type="button"
                  className={`quick-chip ${activeFiltersCount === 0 && !searchName ? "active" : ""}`}
                  onClick={clearAllFilters}
                >
                  <span>Todos</span>
                  <span className="chip-count">{usuarios.length}</span>
                </button>
                <button
                  type="button"
                  className={`quick-chip ${selectedStatusFilters.includes("ativos") ? "active" : ""}`}
                  onClick={() =>
                    setSelectedStatusFilters((prev) =>
                      prev.includes("ativos")
                        ? prev.filter((s) => s !== "ativos")
                        : [...prev, "ativos"]
                    )
                  }
                >
                  <span>Ativos</span>
                  <span className="chip-count">{stats.ativos}</span>
                </button>
                <button
                  type="button"
                  className={`quick-chip ${selectedAgendaFilters.includes("yes") ? "active" : ""}`}
                  onClick={() =>
                    setSelectedAgendaFilters((prev) =>
                      prev.includes("yes")
                        ? prev.filter((a) => a !== "yes")
                        : [...prev, "yes"]
                    )
                  }
                >
                  <span>Atendem na agenda</span>
                  <span className="chip-count">{stats.atendem}</span>
                </button>
                <button
                  type="button"
                  className={`quick-chip ${selectedAtendimentoFilters.includes("hoje") ? "active" : ""}`}
                  onClick={() =>
                    setSelectedAtendimentoFilters((prev) =>
                      prev.includes("hoje")
                        ? prev.filter((h) => h !== "hoje")
                        : [...prev, "hoje"]
                    )
                  }
                >
                  <span>Atendimentos hoje</span>
                  <span className="chip-count">{stats.hoje ?? "—"}</span>
                </button>
                <button
                  type="button"
                  className={`quick-chip ${selectedAtendimentoFilters.includes("mes") ? "active" : ""}`}
                  onClick={() =>
                    setSelectedAtendimentoFilters((prev) =>
                      prev.includes("mes")
                        ? prev.filter((m) => m !== "mes")
                        : [...prev, "mes"]
                    )
                  }
                >
                  <span>Atendimentos em {monthName}</span>
                  <span className="chip-count">{stats.mes ?? "—"}</span>
                </button>
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
                <div className="lhd">
                  <span>Pessoa e cargo</span>
                  <span>Perfil de acesso</span>
                  <span>Hoje</span>
                  <span className="h-mes">Atendimentos</span>
                  <span />
                </div>
                {filteredUsers.length ? (
                  filteredUsers.map((u) => {
                    const pf = perfisAcesso.find(
                      (p) => p.id === u.perfilAcessoId,
                    );
                    const today = appointmentsFor(u).filter(
                      (a) => a.dataAgendamento === hojeIso,
                    );
                    return (
                      <div
                        className="row"
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
                        <div className="c-pf">{badge(pf)}</div>
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
                      <h3 id="modalTodosPerfisTitulo">Todos os Perfis de Acesso</h3>
                      <p>Consulte e fixe perfis na barra lateral da clínica.</p>
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
                  />
                </div>

                <div className="modal-perfis-list">
                  {sortedProfiles
                    .filter((p) =>
                    p.nome.toLowerCase().includes(todosPerfisSearch.toLowerCase()),
                  )
                    .map((p) => {
                      const strId = String(p.id);
                      const isPinned = activePinnedProfileIds.includes(strId);
                      const funcoesCount = profileIds(p)?.length ?? 0;
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
                              <span className="modal-perfil-meta">
                                {count(p)} membro(s) · {funcoesCount} de {permissoes.length} funções ·{" "}
                                <span className={attends(p) ? "meta-atende" : "meta-nao-atende"}>
                                  {attends(p) ? "Atende na agenda" : "Não atende"}
                                </span>
                              </span>
                            </div>
                          </div>

                          <div className="modal-perfil-actions">
                            <button
                              type="button"
                              className={`btn-pin ${isPinned ? "pinned" : ""}`}
                              onClick={() => togglePinProfile(strId)}
                              title={isPinned ? "Desafixar da barra lateral" : "Fixar na barra lateral"}
                              aria-label={isPinned ? `Desafixar ${p.nome}` : `Fixar ${p.nome}`}
                            >
                              <PrototypeIcon name="pin" size="s" />
                              <span>{isPinned ? "Fixado" : "Fixar"}</span>
                            </button>

                            <button
                              type="button"
                              className="btn-s btn-ficha"
                              onClick={() => {
                                setViewingProfileId(strId);
                                setIsTodosPerfisModalOpen(false);
                              }}
                              aria-label={`Abrir ficha de ${p.nome}`}
                            >
                              Ficha
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>

                <div className="modal-footer">
                  <span className="modal-footer-stats">
                    Total de <b>{sortedProfiles.length}</b> {sortedProfiles.length === 1 ? "perfil cadastrado" : "perfis cadastrados"}
                  </span>
                  <div className="modal-footer-actions">
                    <button
                      type="button"
                      className="btn-p"
                      onClick={() => setIsTodosPerfisModalOpen(false)}
                    >
                      Fechar
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
