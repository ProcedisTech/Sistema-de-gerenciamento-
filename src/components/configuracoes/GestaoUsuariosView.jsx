import React, { useState, useEffect, useCallback, useRef } from "react";
import { resolveApiUrl } from "../../config/apiEnv";
import {
  authHeadersForFetch,
  agendasApi,
  configuracoesClinicaApi,
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
  onDisponibilidadeInvalidate,
  onEquipeInvalidate,
  onNavigateAgenda,
  onSelectPatient,
  targetUserId,
  onClearTargetUserId,
  onPerfilAtualizado,
}) {
  const {
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
  const [inviteDraft, setInviteDraft] = useState(null);
  const [activeTab, setActiveTab] = useState("membros"); // 'membros' | 'auditoria' | 'perfis'
  const [tipoOrg, setTipoOrg] = useState("clinica");
  const [perfilParaAbrirNaAba, setPerfilParaAbrirNaAba] = useState(null);

  const onEditarPerfilNaAba = useCallback((perfilAcessoId) => {
    setDetailId(null);
    setPerfilParaAbrirNaAba(perfilAcessoId);
    setActiveTab("perfis");
  }, []);

  // Filtros
  const [searchName, setSearchName] = useState("");
  const [filterLevel, setFilterLevel] = useState("");
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
    if (!canSeeConfigEquipe) return;
    let alive = true;
    (async () => {
      try {
        const dto = await configuracoesClinicaApi.buscar();
        if (alive) setTipoOrg(dto?.tipoOrg || "clinica");
      } catch {
        /* mantém default 'clinica'; falha aqui não deve quebrar a tela de equipe */
      }
    })();
    return () => {
      alive = false;
    };
  }, [canSeeConfigEquipe]);

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
    (p) => String(p.id) === String(filterLevel),
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
      return (
        text.includes(searchName.toLocaleLowerCase("pt-BR")) &&
        (!filterLevel || String(u.perfilAcessoId) === String(filterLevel)) &&
        (statusFilter !== "ativos" || u.ativo !== false) &&
        (statusFilter !== "inativos" || u.ativo === false) &&
        (!["agenda", "hoje", "mes"].includes(statusFilter) ||
          (u.ativo !== false && u.apareceNaAgenda === true)) &&
        (agendaAvailabilityFilter === "all" ||
          (agendaAvailabilityFilter === "yes" &&
            u.ativo !== false &&
            u.apareceNaAgenda === true) ||
          (agendaAvailabilityFilter === "no" &&
            u.apareceNaAgenda !== true))
      );
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
    (statusFilter ? 1 : 0) +
    (filterLevel ? 1 : 0) +
    (agendaAvailabilityFilter !== "all" ? 1 : 0);

  const clearAllFilters = () => {
    setSearchName("");
    setFilterLevel("");
    setStatusFilter("");
    setAgendaAvailabilityFilter("all");
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
  const railItem = (profile) => (
    <button
      className={`rit ${String(profile.id) === filterLevel ? "on" : ""}`}
      onClick={() => setFilterLevel(String(profile.id))}
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
          canManageDisponibilidade={canManageBloqueiosAgenda}
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
          tipoOrg={tipoOrg}
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
          <div className="phd">
            <div>
              <h1>Gestão de Equipe</h1>
              <p>
                Quem trabalha na clínica, o que cada um faz e o que pode
                acessar.
              </p>
            </div>
            <div className="acts">
              {canSeeConfigAuditoria && (
                <button
                  className="btn-s"
                  aria-label="Histórico / Auditoria"
                  onClick={() => setActiveTab("auditoria")}
                >
                  <PrototypeIcon name="hist" size="s" />
                  <span className="lbl">Histórico / Auditoria</span>
                </button>
              )}
              {canCreateUsers && (
                <button
                  className="btn-p"
                  onClick={() => setShowInviteModal(true)}
                  aria-label="Convidar pessoa"
                >
                  <PrototypeIcon name="uplus" size="s" />
                  <span className="lbl">Convidar pessoa</span>
                </button>
              )}
            </div>
          </div>
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
              ["ativos", "Ativos", stats.ativos, "users"],
              ["agenda", "Atendem na agenda", stats.atendem, "calok"],
              ["hoje", "Atendimentos hoje", stats.hoje ?? "—", "cal"],
              [
                "mes",
                `Atendimentos em ${monthName}`,
                stats.mes ?? "—",
                "steth",
              ],
              ["conv", "Convites pendentes", "—", "mail"],
            ].map(([id, label, value, icon]) => (
              <button
                key={id}
                className={`kpi ${statusFilter === id ? "on" : ""}`}
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
                  setStatusFilter(statusFilter === id ? "" : id);
                }}
              >
                <span>
                  <small>{label}</small>
                  <b>{value}</b>
                </span>
                <span className="ic">
                  <PrototypeIcon name={icon} size="l" />
                </span>
              </button>
            ))}
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
                className={`rit ${!filterLevel ? "on" : ""}`}
                onClick={() => setFilterLevel("")}
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
              <div className="rgl">Da sua clínica</div>
              {sortedProfiles
                .filter((p) => profileType(p) !== "tpl")
                .map(railItem)}
              <div className="rgl">
                <PrototypeIcon name="lock" size="s" />
                Modelos prontos
              </div>
              {sortedProfiles
                .filter((p) => profileType(p) === "tpl")
                .map(railItem)}
            </aside>
            <div style={{ minWidth: 0 }}>
              <div className="pchips">
                <button
                  className={!filterLevel ? "on" : ""}
                  onClick={() => setFilterLevel("")}
                >
                  Toda a equipe <i>{stats.ativos}</i>
                </button>
                {sortedProfiles.map((p) => (
                  <button
                    key={p.id}
                    className={filterLevel === String(p.id) ? "on" : ""}
                    onClick={() => setFilterLevel(String(p.id))}
                  >
                    <PrototypeIcon
                      name={p.codigo === "DONO" ? "crown" : "shield"}
                      size="s"
                    />
                    {p.nome} <i>{count(p)}</i>
                  </button>
                ))}
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
                    placeholder="Buscar por nome, e-mail ou telefone"
                    aria-label="Buscar pessoa"
                    value={searchName}
                    onChange={(e) => setSearchName(e.target.value)}
                  />
                </label>

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
                            onClick={() => {
                              setStatusFilter("");
                              setFilterLevel("");
                              setAgendaAvailabilityFilter("all");
                            }}
                          >
                            Limpar
                          </button>
                        )}
                      </div>

                      <div className="popover-section">
                        <span className="section-title">Status do Acesso</span>
                        <div className="popover-options">
                          <label className="popover-radio">
                            <input
                              type="radio"
                              name="popover_status"
                              checked={
                                !statusFilter ||
                                ["agenda", "hoje", "mes"].includes(statusFilter)
                              }
                              onChange={() => setStatusFilter("")}
                            />
                            <span>Todos</span>
                          </label>
                          <label className="popover-radio">
                            <input
                              type="radio"
                              name="popover_status"
                              checked={statusFilter === "ativos"}
                              onChange={() => setStatusFilter("ativos")}
                            />
                            <span>Apenas Ativos</span>
                          </label>
                          <label className="popover-radio">
                            <input
                              type="radio"
                              name="popover_status"
                              checked={statusFilter === "inativos"}
                              onChange={() => setStatusFilter("inativos")}
                            />
                            <span>Apenas Inativos</span>
                          </label>
                        </div>
                      </div>

                      <div className="popover-section">
                        <span className="section-title">Perfil de Acesso</span>
                        <select
                          className="input-select"
                          style={{
                            width: "100%",
                            padding: "6px 10px",
                            borderRadius: "8px",
                            border: "1px solid var(--app-border)",
                            fontSize: "13px",
                            color: "var(--app-ink)",
                            background: "#fff",
                          }}
                          value={filterLevel}
                          onChange={(e) => setFilterLevel(e.target.value)}
                          aria-label="Filtrar por perfil"
                        >
                          <option value="">Todos os perfis</option>
                          {perfisAcesso.map((p) => (
                            <option key={p.id} value={String(p.id)}>
                              {p.nome}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="popover-section">
                        <span className="section-title">
                          Disponibilidade na Agenda
                        </span>
                        <div className="popover-options">
                          <label className="popover-radio">
                            <input
                              type="radio"
                              name="popover_agenda"
                              checked={agendaAvailabilityFilter === "all"}
                              onChange={() => setAgendaAvailabilityFilter("all")}
                            />
                            <span>Todos</span>
                          </label>
                          <label className="popover-radio">
                            <input
                              type="radio"
                              name="popover_agenda"
                              checked={agendaAvailabilityFilter === "yes"}
                              onChange={() => setAgendaAvailabilityFilter("yes")}
                            />
                            <span>Atendem na agenda</span>
                          </label>
                          <label className="popover-radio">
                            <input
                              type="radio"
                              name="popover_agenda"
                              checked={agendaAvailabilityFilter === "no"}
                              onChange={() => setAgendaAvailabilityFilter("no")}
                            />
                            <span>Não atendem</span>
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

                {(searchName ||
                  filterLevel ||
                  statusFilter ||
                  agendaAvailabilityFilter !== "all") && (
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
                  className={`quick-chip ${!statusFilter ? "active" : ""}`}
                  onClick={() => setStatusFilter("")}
                >
                  <span>Todos</span>
                  <span className="chip-count">{usuarios.length}</span>
                </button>
                <button
                  type="button"
                  className={`quick-chip ${statusFilter === "ativos" ? "active" : ""}`}
                  onClick={() =>
                    setStatusFilter(statusFilter === "ativos" ? "" : "ativos")
                  }
                >
                  <span>Ativos</span>
                  <span className="chip-count">{stats.ativos}</span>
                </button>
                <button
                  type="button"
                  className={`quick-chip ${statusFilter === "agenda" ? "active" : ""}`}
                  onClick={() =>
                    setStatusFilter(statusFilter === "agenda" ? "" : "agenda")
                  }
                >
                  <span>Atendem na agenda</span>
                  <span className="chip-count">{stats.atendem}</span>
                </button>
                <button
                  type="button"
                  className={`quick-chip ${statusFilter === "hoje" ? "active" : ""}`}
                  onClick={() =>
                    setStatusFilter(statusFilter === "hoje" ? "" : "hoje")
                  }
                >
                  <span>Atendimentos hoje</span>
                  <span className="chip-count">{stats.hoje ?? "—"}</span>
                </button>
                <button
                  type="button"
                  className={`quick-chip ${statusFilter === "mes" ? "active" : ""}`}
                  onClick={() =>
                    setStatusFilter(statusFilter === "mes" ? "" : "mes")
                  }
                >
                  <span>Atendimentos em {monthName}</span>
                  <span className="chip-count">{stats.mes ?? "—"}</span>
                </button>
              </div>

              {(searchName ||
                filterLevel ||
                statusFilter ||
                agendaAvailabilityFilter !== "all") && (
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
                  {Boolean(filterLevel) && (
                    <span className="active-pill">
                      Perfil:{" "}
                      {perfisAcesso.find(
                        (p) => String(p.id) === String(filterLevel),
                      )?.nome || "Selecionado"}
                      <button
                        type="button"
                        className="active-pill-remove"
                        onClick={() => setFilterLevel("")}
                        aria-label="Remover filtro de perfil"
                      >
                        ✕
                      </button>
                    </span>
                  )}
                  {Boolean(statusFilter) && (
                    <span className="active-pill">
                      Status:{" "}
                      {statusFilter === "ativos"
                        ? "Ativos"
                        : statusFilter === "inativos"
                          ? "Inativos"
                          : statusFilter === "agenda"
                            ? "Atendem na agenda"
                            : statusFilter === "hoje"
                              ? "Atendimentos hoje"
                              : statusFilter === "mes"
                                ? `Atendimentos em ${monthName}`
                                : statusFilter}
                      <button
                        type="button"
                        className="active-pill-remove"
                        onClick={() => setStatusFilter("")}
                        aria-label="Remover filtro de status"
                      >
                        ✕
                      </button>
                    </span>
                  )}
                  {agendaAvailabilityFilter !== "all" && (
                    <span className="active-pill">
                      Agenda:{" "}
                      {agendaAvailabilityFilter === "yes"
                        ? "Atendem"
                        : "Não atendem"}
                      <button
                        type="button"
                        className="active-pill-remove"
                        onClick={() => setAgendaAvailabilityFilter("all")}
                        aria-label="Remover filtro de agenda"
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

    </div>
  );
}
