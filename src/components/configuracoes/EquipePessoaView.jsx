import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowUpDown,
  AlertTriangle,
  Check,
  ChevronDown,
  Filter,
  Info,
  Loader2,
  Lock,
  RotateCcw,
  Search,
  Shield,
  ShieldPlus,
  Sparkles,
  UserMinus,
  Users,
  X,
} from "lucide-react";
import { mapBackendPatient } from "../../utils/patientMapping";
import { perfilFotoDisplaySrc } from "../layout/identityDisplay";
import UsuarioCadastroModal from "./UsuarioCadastroModal";
import PrototypeIcon from "./PrototypeIcon";
import { AuditoriaView } from "./AuditoriaView";
import { formatCargoLabel, criarPerfilComPermissoes, atualizarPermissoesDoPerfil } from "./gestaoUsuariosUtils";
import { resolveApiUrl } from "../../config/apiEnv";
import {
  effectiveProfilePermissions,
  profileType,
  summarizeModules,
  PROTOTYPE_OPERATIONAL_CODES as OPERACIONAIS,
  PROTOTYPE_ROOT_CODES as RAIZES,
  getActiveDependentPermissions,
  getPrerequisitesForPermission,
  generateUniqueProfileName,
  isProfileNameDuplicate,
} from "./equipePrototypeUtils";

const etiquetasNivel = {
  1: "Só ver",
  2: "Ver e editar",
  3: "Tudo",
  0: "Sem acesso",
};
import {
  authHeadersForFetch,
  disponibilidadeApi,
  equipeApi,
  getApiErrorToastMessage,
  pacientesApi,
} from "../../services/api";
import { supabase } from "../../lib/supabaseClient";
import { Switch } from "../shared/Switch";
import DisponibilidadeProfissionalModal from "./DisponibilidadeProfissionalModal";
import "./equipePrototypeBase.css";
import "./gestaoEquipe.css";
import "./equipePessoa.css";
import "./invitePrototype.css";
import "./gestaoPerfilEditor.css";
import { hhmm } from "./horarioSemanaUtils";

const TABS = [
  ["geral", "Visão geral"],
  ["agenda", "Agenda"],
  ["atend", "Atendimentos"],
  ["pacs", "Pacientes"],
  ["acesso", "Acesso"],
  ["hist", "Histórico"],
];
const I = ({ name, size = "s" }) => <PrototypeIcon name={name} size={size} />;
const initials = (name) =>
  String(name || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((x) => x[0])
    .join("")
    .toUpperCase();
const resolveFriendlyName = (nameOrObj) => {
  const full =
    typeof nameOrObj === "string"
      ? nameOrObj
      : nameOrObj?.nomeCompleto || nameOrObj?.usuarioNome || "";
  const trimmed = full.trim();
  if (!trimmed) return "Colaborador";
  const parts = trimmed.split(/\s+/);
  if (
    parts.length >= 2 &&
    /^(dr\.|dra\.|enf\.|prof\.|profa\.|sr\.|sra\.)/i.test(parts[0])
  ) {
    return `${parts[0]} ${parts[1]}`;
  }
  return parts[0];
};
const calendarIso = (date) =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
const dateLabel = (value) =>
  value
    ? String(value).slice(0, 10).split("-").reverse().join("/")
    : "Não informado";
const status = (a) => String(a.statusCodigo || "").toUpperCase();
const statusClass = (a) =>
  ({
    REALIZADO: "fe",
    CONFIRMADO: "ok",
    FALTOU: "fa",
    FALTA: "fa",
    AGENDADO: "ag",
    EM_ATENDIMENTO: "nw",
    AGUARDANDO_CONFIRMACAO: "wt",
  })[status(a)] || "ag";
const statusLabel = (a) =>
  a.statusNome ||
  {
    REALIZADO: "Atendido",
    CONFIRMADO: "Confirmado",
    FALTOU: "Faltou",
    FALTA: "Faltou",
    AGENDADO: "Agendado",
    EM_ATENDIMENTO: "Em atendimento",
  }[status(a)] ||
  a.statusCodigo ||
  "Não informado";
const procedure = (a) =>
  a.catalogoProcedimentoNome ||
  a.tipoProcedimentoNome ||
  "Procedimento não informado";
const timeMinutes = (value) => {
  const [h, m] = String(value || "")
    .split(":")
    .map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
};
const duration = (a) => {
  const from = timeMinutes(a.horaInicio),
    to = timeMinutes(a.horaFim);
  return from != null && to != null && to >= from ? `${to - from} min` : "—";
};

const WEEK_DAYS = [
  [1, "Segunda"],
  [2, "Terça"],
  [3, "Quarta"],
  [4, "Quinta"],
  [5, "Sexta"],
  [6, "Sábado"],
  [0, "Domingo"],
];
const groupDayLabel = (days) => {
  if (days.length === 1) return days[0].label;
  const separator = days.length === 2 ? " e " : " a ";
  return `${days[0].label}${separator}${days.at(-1).label}`;
};

function WeekSchedule({ availability }) {
  const days = WEEK_DAYS.map(([day, label]) => {
    const turns = availability
      .filter((row) => Number(row.diaSemana) === day && row.ativo !== false)
      .map((row) => ({ start: hhmm(row.horaInicio), end: hhmm(row.horaFim) }))
      .sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));
    return { day, label, turns, routine: JSON.stringify(turns) };
  });
  const groups = [];
  days.forEach((day) => {
    const previous = groups.at(-1);
    if (previous?.routine === day.routine) previous.days.push(day);
    else groups.push({ days: [day], turns: day.turns, routine: day.routine });
  });
  const workingGroups = groups.filter((group) => group.turns.length);
  const offLabel = workingGroups.length
    ? groups.filter((group) => !group.turns.length)
        .map((group) => groupDayLabel(group.days)).join(", ")
    : "Todos os dias";

  return (
    <div className="week">
      <div className="week-groups">
        {workingGroups.map((group) => (
          <div
            key={group.days[0].day}
            className={`week-group-row${group.days.length === 1 || group.turns.length > 1 ? " highlighted" : ""}`}
          >
            <div className="week-group-label">
              <b>{groupDayLabel(group.days)}</b>
              {group.turns.length > 1 && (
                <span className="week-group-pill">{group.turns.length} turnos</span>
              )}
            </div>
            <div className="week-turns-row">
              {group.turns.map(({ start, end }, index) => (
                <React.Fragment key={`${start}-${end}-${index}`}>
                  {index > 0 && <span className="week-sep"> · </span>}
                  <span className="week-pill">{`${start} - ${end}`}</span>
                </React.Fragment>
              ))}
            </div>
          </div>
        ))}
        {offLabel && (
          <div className="week-off-row">
            <span>{offLabel}:</span>
            <span>Folga</span>
          </div>
        )}
      </div>
    </div>
  );
}

function ProfileChip({ perfil, fallback }) {
  const rawNome = perfil?.nome || fallback;
  const displayName =
    rawNome && !String(rawNome).toUpperCase().startsWith("CST_")
      ? rawNome
      : (rawNome ? "Perfil Personalizado" : "Sem perfil");

  return (
    <span className={`chip ${profileType(perfil)}`}>
      <I name={profileType(perfil) === "dono" ? "crown" : "shield"} />
      {displayName}
    </span>
  );
}
function Timeline({ items, dates = false }) {
  return items.length ? (
    <div className="tl">
      {items.map((a) => (
        <div
          key={a.id}
          className={`tli${status(a) === "REALIZADO" ? " done" : status(a) === "EM_ATENDIMENTO" ? " now" : ""}`}
        >
          <span className="h">{a.horaInicio?.slice(0, 5) || "—"}</span>
          <span className="dt" />
          <span className="p">
            <b className="trunc">
              {a.pacienteNome || "Paciente não informado"}
            </b>
            <span className="trunc">
              {dates && `${dateLabel(a.dataAgendamento)} · `}
              {procedure(a)}
            </span>
          </span>
          <span className={`sc ${statusClass(a)}`}>{statusLabel(a)}</span>
        </div>
      ))}
    </div>
  ) : (
    <div className="empty" style={{ padding: 20 }}>
      Nenhum agendamento neste período.
    </div>
  );
}

function DiffPopover({ diff, basePerfilNome, visible }) {
  if (!visible || !diff || diff.total === 0) return null;

  const entries = Object.entries(diff.porModulo || {}).filter(
    ([, modData]) =>
      modData.adicionadas.length > 0 || modData.desmarcadas.length > 0,
  );

  return (
    <div
      className="diff-popover-card"
      role="tooltip"
      aria-label="Permissões modificadas"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="diff-popover-head">
        <div className="diff-popover-title-row">
          <span className="diff-popover-title">
            <Sparkles className="h-4 w-4 text-amber-500" />
            Permissões Modificadas
          </span>
          <div className="flex items-center gap-1.5">
            {diff.adicionadas > 0 && (
              <span className="diff-pill added">+{diff.adicionadas}</span>
            )}
            {diff.desmarcadas > 0 && (
              <span className="diff-pill removed">-{diff.desmarcadas}</span>
            )}
          </div>
        </div>
        <span className="diff-popover-subtitle">
          Em relação ao perfil base <b>{basePerfilNome}</b>
        </span>
      </div>

      <div className="diff-popover-body">
        {entries.map(([modKey, modData]) => (
          <div key={modKey} className="diff-popover-mod-section">
            <div className="diff-popover-mod-title">
              <PrototypeIcon name={modData.icon || "shield"} size="s" />
              <span>{modData.name || modKey.toUpperCase()}</span>
            </div>
            <ul className="diff-popover-list">
              {modData.adicionadas.map((perm) => (
                <li key={perm.permissaoId} className="diff-popover-item added">
                  <span className="diff-tag added">+</span>
                  <span className="diff-perm-name">{perm.nome}</span>
                </li>
              ))}
              {modData.desmarcadas.map((perm) => (
                <li key={perm.permissaoId} className="diff-popover-item removed">
                  <span className="diff-tag removed">-</span>
                  <span className="diff-perm-name">{perm.nome}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="diff-popover-foot">
        <span className="diff-popover-hint">
          💡 Clique em <b>Restaurar</b> no banner para desfazer todas as alterações.
        </span>
      </div>
    </div>
  );
}

export default function EquipePessoaView({
  pessoa: sourcePessoa,
  pessoas = [],
  isSelf = false,
  hideBreadcrumb = false,
  backLabel = "Gestão de Equipe",
  onPerfilAtualizado,
  perfil,
  permissoes = [],
  permissoesPerfil = [],
  loadingPermissoes = false,
  permissoesError = "",
  onRetryPermissoes,
  agenda = [],
  loadingAgenda,
  agendaError,
  hojeIso,
  canManageUsers,
  canDeleteUsers,
  canSeeAgenda,
  canSeeConfigPerfil: _canSeeConfigPerfil,
  canSeeConfigAuditoria,
  onBack,
  onEditarPerfil: _onEditarPerfil,
  onDesativar,
  onDisponibilidade,
  canManageDisponibilidade,
  onDisponibilidadeInvalidate,
  onEquipeInvalidate,
  onSelectPatient,
  orgId,
  onNavigateAgenda,
  onSalvarAcesso,
  onPeriodoChange,
  roles = [],
  perfisAcesso = [],
  fetchHeaders,
  onPerfilCriado,
}) {
  const activeScope = useRef(null);
  useEffect(() => {
    const scope = `${orgId || ""}:${sourcePessoa.id}`;
    activeScope.current = scope;
    return () => {
      activeScope.current = null;
    };
  }, [orgId, sourcePessoa.id]);
  const [localPessoa, setLocalPessoa] = useState({});
  const [isAgendaRnfExpanded, setIsAgendaRnfExpanded] = useState(false);
  const [patientSearchTerm, setPatientSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("ativos");
  const [filterGender, setFilterGender] = useState("todos");
  const [filterAgeGroup, setFilterAgeGroup] = useState("todos");
  const [patientSort, setPatientSort] = useState("recente");
  const [showFilterPopover, setShowFilterPopover] = useState(false);
  const filterPopoverRef = useRef(null);
  const [patientDetailsMap, setPatientDetailsMap] = useState(() => new Map());
  const [inactivePatientIds, setInactivePatientIds] = useState(() => new Set());
  const [showDiffPopover, setShowDiffPopover] = useState(false);
  const diffPopoverTimeoutRef = useRef(null);

  const handleMouseEnterDiff = () => {
    if (diffPopoverTimeoutRef.current) {
      clearTimeout(diffPopoverTimeoutRef.current);
      diffPopoverTimeoutRef.current = null;
    }
    setShowDiffPopover(true);
  };

  const handleMouseLeaveDiff = () => {
    diffPopoverTimeoutRef.current = setTimeout(() => {
      setShowDiffPopover(false);
    }, 180);
  };

  useEffect(() => {
    return () => {
      if (diffPopoverTimeoutRef.current) {
        clearTimeout(diffPopoverTimeoutRef.current);
      }
    };
  }, []);

  const activeFiltersCount =
    (filterStatus !== "ativos" ? 1 : 0) +
    (filterGender !== "todos" ? 1 : 0) +
    (filterAgeGroup !== "todos" ? 1 : 0);

  const clearAllFilters = () => {
    setFilterStatus("ativos");
    setFilterGender("todos");
    setFilterAgeGroup("todos");
  };

  useEffect(() => {
    if (!showFilterPopover) return;
    const handleClickOutside = (e) => {
      if (filterPopoverRef.current && !filterPopoverRef.current.contains(e.target)) {
        setShowFilterPopover(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setShowFilterPopover(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showFilterPopover]);

  useEffect(() => {
    let alive = true;
    const fetchInativos = pacientesApi?.listInativos || pacientesApi?.inativos;
    if (typeof fetchInativos === "function") {
      fetchInativos({ size: 500 })
        .then((res) => {
          if (!alive) return;
          const list = Array.isArray(res) ? res : res?.content || [];
          const ids = new Set(list.map((p) => String(p.id)));
          setInactivePatientIds(ids);
          setPatientDetailsMap((prev) => {
            const next = new Map(prev);
            list.forEach((p) => {
              const mapped = mapBackendPatient(p);
              if (mapped?.id) {
                next.set(String(mapped.id), mapped);
              }
            });
            return next;
          });
        })
        .catch(() => {});
    }

    if (typeof pacientesApi?.list === "function") {
      pacientesApi
        .list({ size: 500 })
        .then((res) => {
          if (!alive) return;
          const list = Array.isArray(res) ? res : res?.content || [];
          setPatientDetailsMap((prev) => {
            const next = new Map(prev);
            list.forEach((p) => {
              const mapped = mapBackendPatient(p);
              if (mapped?.id) {
                next.set(String(mapped.id), mapped);
              }
            });
            return next;
          });
        })
        .catch(() => {});
    }

    return () => {
      alive = false;
    };
  }, [orgId]);
  const [showCadastroModal, setShowCadastroModal] = useState(false);
  const [showInativarModal, setShowInativarModal] = useState(false);
  const [inativarMotivo, setInativarMotivo] = useState("");
  const [inativarSenha, setInativarSenha] = useState("");
  const [inativarSenhaErro, setInativarSenhaErro] = useState("");
  const [inativarSubmitting, setInativarSubmitting] = useState(false);
  const [showMudarAcessoModal, setShowMudarAcessoModal] = useState(false);
  const [showDecisaoSalvarModal, setShowDecisaoSalvarModal] = useState(false);
  const [confirmacaoDesativarRaiz, setConfirmacaoDesativarRaiz] = useState(null);
  const [decisaoTipo, setDecisaoTipo] = useState("novo");
  const [decisaoNomePerfil, setDecisaoNomePerfil] = useState("");
  const [decisaoDescPerfil, setDecisaoDescPerfil] = useState("");
  const [salvandoDecisao, setSalvandoDecisao] = useState(false);
  const [decisaoErro, setDecisaoErro] = useState("");
  const [salvandoCargo, setSalvandoCargo] = useState(false);
  const [cargoSalvoSucesso, setCargoSalvoSucesso] = useState(false);
  const [permissoesDoNivel, setPermissoesDoNivel] = useState(() => Array.isArray(permissoesPerfil) ? [...permissoesPerfil] : []);
  const originalPermissoesRef = useRef(Array.isArray(permissoesPerfil) ? [...permissoesPerfil] : []);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [permissionError, setPermissionError] = useState(false);
  const permissionRequest = useRef(0);
  const [expandedMatrixModuleKey, setExpandedMatrixModuleKey] = useState(null);
  const modalModuleDetailRef = useRef(null);
  const pageModuleDetailRef = useRef(null);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const profileDropdownRef = useRef(null);
  const [abertosAcesso, setAbertosAcesso] = useState({});
  const tabsContainerRef = useRef(null);

  useEffect(() => {
    if (expandedMatrixModuleKey) {
      const target = showMudarAcessoModal
        ? modalModuleDetailRef.current
        : pageModuleDetailRef.current;
      if (typeof target?.scrollIntoView === "function") {
        target.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  }, [expandedMatrixModuleKey, showMudarAcessoModal]);
  useEffect(() => {
    setLocalPessoa({});
    setShowCadastroModal(false);
    setIsAgendaRnfExpanded(false);
    setShowAvailability(false);
    setShowInativarModal(false);
    setInativarMotivo("");
    setInativarSenha("");
    setInativarSenhaErro("");
    setSavingAgenda("");
    setAgendaOptionError("");
    setShowMudarAcessoModal(false);
    setShowDecisaoSalvarModal(false);
    setConfirmacaoDesativarRaiz(null);
    setDecisaoNomePerfil("");
    setDecisaoDescPerfil("");
    setDecisaoErro("");
    setSalvandoCargo(false);
    setCargoSalvoSucesso(false);
    setExpandedMatrixModuleKey(null);
    setProfileDropdownOpen(false);
    setAbertosAcesso({});
    setPatientSearchTerm("");
    setFilterStatus("ativos");
    setFilterGender("todos");
    setFilterAgeGroup("todos");
    setPatientSort("recente");
    setShowFilterPopover(false);
    setShowCadastroModal(false);
  }, [sourcePessoa.id, orgId]);

  const pessoa = { ...sourcePessoa, ...localPessoa, id: sourcePessoa.id };
  const updateCadastro = (data) => {
    // /perfil returns the user ID; the team view must keep its role-user ID.
    const fields = { ...data };
    delete fields.id;
    setLocalPessoa((previous) => ({ ...previous, ...fields }));
    onPerfilAtualizado?.(fields);
  };
  const [tab, setTab] = useState("geral");
  const [periodo, setPeriodo] = useState("mes");
  const [draftRole, setDraftRole] = useState(pessoa.roleId || "");
  const [draftPerfil, setDraftPerfil] = useState(pessoa.perfilAcessoId || "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    const isAnyModalOpen =
      showMudarAcessoModal ||
      showDecisaoSalvarModal ||
      Boolean(confirmacaoDesativarRaiz);
    if (!isAnyModalOpen) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        if (confirmacaoDesativarRaiz) {
          setConfirmacaoDesativarRaiz(null);
        } else if (showDecisaoSalvarModal && !salvandoDecisao) {
          setShowDecisaoSalvarModal(false);
        } else if (showMudarAcessoModal && !saving) {
          setShowMudarAcessoModal(false);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    showMudarAcessoModal,
    showDecisaoSalvarModal,
    salvandoDecisao,
    saving,
    confirmacaoDesativarRaiz,
  ]);

  useEffect(() => {
    if (!profileDropdownOpen) return;
    const handleClickOutside = (e) => {
      if (
        profileDropdownRef.current &&
        !profileDropdownRef.current.contains(e.target)
      ) {
        setProfileDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [profileDropdownOpen]);

  const permissoesPerfilKey = Array.isArray(permissoesPerfil)
    ? permissoesPerfil.join(",")
    : "";
  useEffect(() => {
    setDraftRole(sourcePessoa.roleId || "");
    setDraftPerfil(sourcePessoa.perfilAcessoId || "");
    const base = Array.isArray(permissoesPerfil) ? [...permissoesPerfil] : [];
    setPermissoesDoNivel(base);
    originalPermissoesRef.current = base;
    setExpandedMatrixModuleKey(null);
  }, [
    sourcePessoa.id,
    sourcePessoa.roleId,
    sourcePessoa.perfilAcessoId,
    permissoesPerfilKey,
  ]);
  const name = pessoa.nomeCompleto || pessoa.usuarioNome || "Pessoa sem nome";
  const first = resolveFriendlyName(pessoa);
  const owner =
    String(perfil?.codigo || pessoa.perfilAcessoCodigo || "").toUpperCase() ===
    "DONO";
  const [availabilityState, setAvailabilityState] = useState(null);
  const [availabilityReload, setAvailabilityReload] = useState(0);
  const [showAvailability, setShowAvailability] = useState(false);
  const availabilityKey = JSON.stringify([
    orgId,
    pessoa.id,
    availabilityReload,
  ]);
  const canReadAvailability = canSeeAgenda || isSelf || canManageUsers;
  useEffect(() => {
    if (!pessoa.id || !canReadAvailability) return;
    const controller = new AbortController();
    disponibilidadeApi
      .buscar(pessoa.id, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) {
          const list = Array.isArray(data)
            ? data
            : data?.seguirHorarioClinica
              ? (data?.gradeClinica || [])
              : (data?.turnos || []);
          setAvailabilityState({
            key: availabilityKey,
            data: list,
          });
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setAvailabilityState({
            key: availabilityKey,
            error: getApiErrorToastMessage(
              error,
              "Não foi possível carregar os horários.",
            ),
          });
      });
    return () => controller.abort();
  }, [pessoa.id, canReadAvailability, availabilityKey]);
  const availability =
    availabilityState?.key === availabilityKey ? availabilityState : null;
  const refreshAvailability = () => {
    setAvailabilityReload((value) => value + 1);
    onDisponibilidadeInvalidate?.({ scope: "role", roleUserId: pessoa.id });
  };
  const [savingAgenda, setSavingAgenda] = useState("");
  const [agendaOptionError, setAgendaOptionError] = useState("");
  const agendaMultiVer =
    pessoa.agendaMultiVer ??
    permissoes.some(
      (p) =>
        p.codigo === "AGENDA_MULTI_VER" &&
        permissoesPerfil.includes(p.permissaoId),
    );
  async function saveAgendaOption(field, enabled) {
    if (!owner || !isSelf || savingAgenda) return;
    const requestScope = activeScope.current;
    setSavingAgenda(field);
    setAgendaOptionError("");
    try {
      const member =
        pessoa.roleId && pessoa.usuarioId
          ? pessoa
          : await equipeApi.get(pessoa.id);
      if (activeScope.current !== requestScope) return;
      await equipeApi.update(pessoa.id, {
        usuarioId: member.usuarioId,
        roleId: member.roleId,
        [field]: enabled,
      });
      if (activeScope.current !== requestScope) return;
      updateCadastro({ [field]: enabled });
      onEquipeInvalidate?.();
      refreshAvailability();
    } catch (error) {
      if (activeScope.current !== requestScope) return;
      setAgendaOptionError(
        getApiErrorToastMessage(
          error,
          "Não foi possível salvar a opção da agenda.",
        ),
      );
    } finally {
      if (activeScope.current === requestScope) setSavingAgenda("");
    }
  }
  const ownerIds = permissoes
    .filter(
      (p) =>
        (p.codigo === "AGENDA_APARECER" && pessoa.apareceNaAgenda) ||
        (p.codigo === "AGENDA_MULTI_VER" && agendaMultiVer),
    )
    .map((p) => p.permissaoId);
  const effectiveIds = owner
    ? effectiveProfilePermissions({ codigo: "DONO" }, ownerIds, permissoes)
    : permissoesPerfil;
  const attends = pessoa.apareceNaAgenda === true && pessoa.ativo !== false;
  const permissionUnavailable = loadingPermissoes || Boolean(permissoesError);
  const modules = permissionUnavailable
    ? []
    : summarizeModules(permissoes, effectiveIds).filter(
        (m) => m.permissions.length > 0 || (owner && m.key === "agenda"),
      );
  const permissionState = (
    <span role={permissoesError ? "alert" : "status"}>
      {permissoesError || "Carregando funções…"}
      {permissoesError && onRetryPermissoes && (
        <button className="btn-s" onClick={onRetryPermissoes}>
          Tentar novamente
        </button>
      )}
    </span>
  );
  const ownAgenda = useMemo(
    () =>
      agenda
        .filter(
          (a) =>
            String(a.profissionalRoleUserId || a.roleUserId) ===
              String(pessoa.id) && a.pacienteId,
        )
        .sort((a, b) =>
          `${a.dataAgendamento} ${a.horaInicio}`.localeCompare(
            `${b.dataAgendamento} ${b.horaInicio}`,
          ),
        ),
    [agenda, pessoa.id],
  );
  const today = ownAgenda.filter((a) => a.dataAgendamento === hojeIso);
  const nextDay = new Date(`${hojeIso}T12:00:00Z`);
  nextDay.setUTCDate(nextDay.getUTCDate() + 7);
  const weekEnd = Number.isNaN(nextDay.getTime()) ? "" : calendarIso(nextDay);
  const upcoming = ownAgenda.filter(
    (a) =>
      a.dataAgendamento > hojeIso &&
      a.dataAgendamento <= weekEnd &&
      !["CANCELADO", "REALIZADO", "FALTOU", "FALTA"].includes(status(a)),
  );
  const monthDone = ownAgenda.filter(
    (a) =>
      status(a) === "REALIZADO" &&
      a.dataAgendamento?.slice(0, 7) === hojeIso?.slice(0, 7),
  );
  const history = ownAgenda.filter((a) =>
    ["REALIZADO", "FALTOU", "FALTA"].includes(status(a)),
  );
  const patients = useMemo(() => {
    return Array.from(
      history
        .filter((a) => status(a) === "REALIZADO")
        .reduce((map, a) => {
          const prior = map.get(a.pacienteId);
          const patientIdStr = String(a.pacienteId);
          const details = patientDetailsMap.get(patientIdStr);
          const isInactive =
            inactivePatientIds.has(patientIdStr) ||
            a.pacienteAtivo === false ||
            details?.ativo === false ||
            prior?.ativo === false;
          const isAtivo = !isInactive;

          const date = a.dataAgendamento;
          const first = prior?.first ? (date < prior.first ? date : prior.first) : date;
          const last = prior?.last ? (date > prior.last ? date : prior.last) : date;

          const idade = details?.idade != null ? details.idade : null;
          const rawSexo = (details?.sexo || "").toLowerCase();
          const sexo = rawSexo.startsWith("m") ? "m" : rawSexo.startsWith("f") ? "f" : null;
          const sexoLabel = sexo === "m" ? "Masculino" : sexo === "f" ? "Feminino" : null;

          map.set(a.pacienteId, {
            id: a.pacienteId,
            name: a.pacienteNome || details?.nome || "Paciente não informado",
            photo: a.pacienteFotoUrl || details?.fotoPerfilUrl,
            cpf: a.pacienteCpf || details?.cpf || prior?.cpf,
            count: (prior?.count || 0) + 1,
            first,
            last,
            idade,
            sexo,
            sexoLabel,
            ativo: isAtivo,
          });
          return map;
        }, new Map())
        .values(),
    );
  }, [history, inactivePatientIds, patientDetailsMap]);

  const activePatients = useMemo(() => patients.filter((p) => p.ativo !== false), [patients]);
  const inactivePatients = useMemo(() => patients.filter((p) => p.ativo === false), [patients]);

  const displayedPatients = useMemo(() => {
    let result = [...patients];

    const hasSearch = patientSearchTerm.trim().length > 0;
    if (hasSearch) {
      const term = patientSearchTerm.trim().toLowerCase();
      result = result.filter((p) => (p.name || "").toLowerCase().includes(term));
    } else {
      if (filterStatus === "ativos") {
        result = result.filter((p) => p.ativo !== false);
      } else if (filterStatus === "inativos") {
        result = result.filter((p) => p.ativo === false);
      }
    }

    if (filterGender === "m") {
      result = result.filter((p) => p.sexo === "m");
    } else if (filterGender === "f") {
      result = result.filter((p) => p.sexo === "f");
    }

    if (filterAgeGroup === "menor") {
      result = result.filter((p) => p.idade != null && p.idade < 18);
    } else if (filterAgeGroup === "adulto") {
      result = result.filter((p) => p.idade != null && p.idade >= 18 && p.idade <= 59);
    } else if (filterAgeGroup === "idoso") {
      result = result.filter((p) => p.idade != null && p.idade >= 60);
    }

    result.sort((a, b) => {
      switch (patientSort) {
        case "antigo":
          return (a.last || "").localeCompare(b.last || "");
        case "mais_atendimentos":
          return (b.count || 0) - (a.count || 0);
        case "primeiro_atendimento":
          return (a.first || "").localeCompare(b.first || "");
        case "nome_asc":
          return (a.name || "").localeCompare(b.name || "");
        case "nome_desc":
          return (b.name || "").localeCompare(a.name || "");
        case "idade_menor":
          return (a.idade ?? 999) - (b.idade ?? 999);
        case "idade_maior":
          return (b.idade ?? -1) - (a.idade ?? -1);
        case "recente":
        default:
          return (b.last || "").localeCompare(a.last || "");
      }
    });

    return result;
  }, [patients, patientSearchTerm, filterStatus, filterGender, filterAgeGroup, patientSort]);
  const procedures = Object.entries(
    monthDone.reduce((map, a) => {
      const key = procedure(a);
      map[key] = (map[key] || 0) + 1;
      return map;
    }, {}),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
  const draftPerfilObj =
    perfisAcesso.find((p) => String(p.id) === String(draftPerfil)) || perfil;
  const draftProfileType = profileType(draftPerfilObj);
  const perfisDisponiveis = perfisAcesso.filter(
    (p) => String(p.codigo || "").toUpperCase() !== "DONO",
  );
  const perfisClinica = perfisDisponiveis.filter((p) => profileType(p) === "cli");
  const perfisModelos = perfisDisponiveis.filter((p) => profileType(p) === "tpl");
  const agendaPermId = (permissoes || []).find(
    (p) => p.codigo === "AGENDA_APARECER",
  )?.permissaoId;
  const perfilSelecionadoAtendeAgenda = Boolean(
    pessoa.apareceNaAgenda ?? (agendaPermId && permissoesDoNivel.includes(agendaPermId)),
  );

  const matrixEffectiveIds = owner ? effectiveIds : permissoesDoNivel;
  const matrixModules = permissionUnavailable
    ? []
    : summarizeModules(permissoes, matrixEffectiveIds).filter(
        (m) => m.permissions.length > 0,
      );
  const selectedMatrixModule = matrixModules.find(
    (m) => m.key === expandedMatrixModuleKey,
  );

  const permissionToModuleMap = useMemo(() => {
    const map = new Map();
    matrixModules.forEach((mod) => {
      mod.permissions.forEach((perm) => {
        map.set(perm.permissaoId, { key: mod.key, name: mod.name, icon: mod.icon });
      });
    });
    return map;
  }, [matrixModules]);

  const diffCalculado = useMemo(() => {
    const origSet = new Set(originalPermissoesRef.current || []);
    const currSet = new Set(permissoesDoNivel || []);

    const adicionadasList = [];
    const desmarcadasList = [];
    const porModulo = {};

    (permissoes || []).forEach((perm) => {
      const id = perm.permissaoId;
      const wasInOrig = origSet.has(id);
      const isInCurr = currSet.has(id);
      const modInfo = permissionToModuleMap.get(id) || {
        key: perm.moduloCodigo?.toLowerCase() || "outros",
        name: perm.modulo || perm.moduloCodigo || "Outros",
        icon: "shield",
      };

      if (!wasInOrig && isInCurr) {
        adicionadasList.push({ ...perm, moduleInfo: modInfo });
        if (!porModulo[modInfo.key]) {
          porModulo[modInfo.key] = { ...modInfo, adicionadas: [], desmarcadas: [] };
        }
        porModulo[modInfo.key].adicionadas.push(perm);
      } else if (wasInOrig && !isInCurr) {
        desmarcadasList.push({ ...perm, moduleInfo: modInfo });
        if (!porModulo[modInfo.key]) {
          porModulo[modInfo.key] = { ...modInfo, adicionadas: [], desmarcadas: [] };
        }
        porModulo[modInfo.key].desmarcadas.push(perm);
      }
    });

    return {
      adicionadas: adicionadasList.length,
      desmarcadas: desmarcadasList.length,
      adicionadasList,
      desmarcadasList,
      porModulo,
      total: adicionadasList.length + desmarcadasList.length,
    };
  }, [permissoesDoNivel, permissoes, permissionToModuleMap]);

  const isPerfilCustomizado =
    diffCalculado.adicionadas > 0 || diffCalculado.desmarcadas > 0;
  const isCargoDirty = String(draftRole) !== String(pessoa.roleId || "");
  const isAccessDirty =
    isCargoDirty ||
    String(draftPerfil) !== String(pessoa.perfilAcessoId || "") ||
    isPerfilCustomizado;

  const membrosVinculadosAoPerfil = useMemo(() => {
    if (!draftPerfil) return [];
    return (pessoas || []).filter(
      (p) =>
        String(p.perfilAcessoId) === String(draftPerfil) && p.ativo !== false,
    );
  }, [pessoas, draftPerfil]);

  const isNomeDuplicado = useMemo(() => {
    if (decisaoTipo !== "novo") return false;
    return isProfileNameDuplicate(decisaoNomePerfil, perfisAcesso);
  }, [decisaoTipo, decisaoNomePerfil, perfisAcesso]);

  const agendaNotice = !canSeeAgenda ? (
    <div className="empty">Você não tem permissão para consultar a agenda.</div>
  ) : loadingAgenda ? (
    <div className="empty" role="status">
      Carregando agenda…
    </div>
  ) : agendaError ? (
    <div className="empty" role="alert">
      {typeof agendaError === "string"
        ? agendaError
        : "Não foi possível carregar a agenda."}
    </div>
  ) : null;
  const noAppointments = (
    <div className="box">
      <div className="empty">
        <I name="caloff" size="l" />
        <b>{first} não atende pacientes</b>O perfil{" "}
        {perfil?.nome || pessoa.perfilAcessoNome || "atual"} não aparece na
        agenda.{" "}
        {canManageUsers && !owner
          ? "Para atender, escolha outro perfil na aba Acesso."
          : ""}
      </div>
    </div>
  );
  const countCatalog = owner
    ? permissoes.filter(
        (p) => !["AGENDA_APARECER", "AGENDA_MULTI_VER"].includes(p.codigo),
      )
    : permissoes;
  const summary = (
    <div
      style={{
        display: "flex",
        gap: 8,
        flexWrap: "wrap",
        alignItems: "center",
      }}
    >
      <ProfileChip perfil={perfil} fallback={pessoa.perfilAcessoNome} />
      <span style={{ color: "var(--app-muted)", fontSize: 13 }}>
        {permissionUnavailable
          ? permissionState
          : `${effectiveIds.filter((id) => countCatalog.some((p) => p.permissaoId === id)).length} de ${countCatalog.length} funções`}
      </span>
    </div>
  );
  const handleSelectDraftPerfil = async (novoPerfilId) => {
    setDraftPerfil(novoPerfilId);
    setExpandedMatrixModuleKey(null);
    const request = ++permissionRequest.current;
    setPermissionError(false);
    if (!novoPerfilId) {
      setPermissoesDoNivel([]);
      originalPermissoesRef.current = [];
      return;
    }
    if (
      String(novoPerfilId) === String(pessoa.perfilAcessoId) &&
      Array.isArray(permissoesPerfil) &&
      permissoesPerfil.length > 0
    ) {
      setPermissoesDoNivel([...permissoesPerfil]);
      originalPermissoesRef.current = [...permissoesPerfil];
      return;
    }
    setLoadingTemplate(true);
    try {
      const headers =
        typeof fetchHeaders === "function"
          ? await fetchHeaders()
          : await authHeadersForFetch({ needsOrg: true });
      const res = await fetch(
        resolveApiUrl(`/api/v1/perfis-acesso/${novoPerfilId}/permissoes`),
        {
          headers,
          credentials: "include",
        },
      );
      if (!res.ok) throw new Error("Não foi possível carregar as permissões do perfil.");
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error("Formato inválido retornado.");
      if (request === permissionRequest.current) {
        setPermissoesDoNivel(data);
        originalPermissoesRef.current = data;
      }
    } catch (err) {
      console.error("Erro ao carregar permissões do perfil:", err);
      if (request === permissionRequest.current) {
        setPermissionError(true);
      }
    } finally {
      if (request === permissionRequest.current) {
        setLoadingTemplate(false);
      }
    }
  };

  const togglePermissao = (permissaoId, moduloObj) => {
    const permObj = (permissoes || []).find((p) => p.permissaoId === permissaoId);
    if (!permObj) return;

    const modulo =
      moduloObj ||
      matrixModules.find((m) =>
        m.permissions.some((p) => p.permissaoId === permObj.permissaoId)
      );

    const isChecked = permissoesDoNivel.includes(permObj.permissaoId);

    if (isChecked) {
      // Se está desmarcando: verifica se tem funções ativas que dependem desta permissão
      const dependentesAtivas = getActiveDependentPermissions(
        permObj,
        modulo,
        permissoesDoNivel
      );

      if (dependentesAtivas.length > 0) {
        setConfirmacaoDesativarRaiz({
          modulo: modulo || { nome: "Módulo" },
          permissao: permObj,
          dependentes: dependentesAtivas,
        });
        return;
      }

      setPermissoesDoNivel((prev) => prev.filter((id) => id !== permissaoId));
    } else {
      // Se está marcando: busca os pré-requisitos necessários e adiciona juntos
      const prereqs = getPrerequisitesForPermission(permObj, modulo, permissoes);
      setPermissoesDoNivel((prev) => [
        ...new Set([...prev, permissaoId, ...prereqs]),
      ]);
    }
  };

  const confirmarDesativacaoRaiz = () => {
    if (!confirmacaoDesativarRaiz) return;
    const { permissao, dependentes } = confirmacaoDesativarRaiz;
    const idsParaRemover = new Set([
      permissao.permissaoId,
      ...dependentes.map((p) => p.permissaoId),
    ]);
    setPermissoesDoNivel((prev) =>
      prev.filter((id) => !idsParaRemover.has(id))
    );
    setConfirmacaoDesativarRaiz(null);
  };

  const restaurarPerfilBase = () => {
    setPermissoesDoNivel([...originalPermissoesRef.current]);
  };

  const aplicarAcessoEmLote = (modo, moduleObj) => {
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
      return [...nextWithoutThisModule, ...idsToAdd];
    });
  };

  const handleSalvarCargo = async () => {
    if (!isCargoDirty || owner || !canManageUsers || !onSalvarAcesso) return;
    setSalvandoCargo(true);
    setSaveError("");
    setCargoSalvoSucesso(false);
    try {
      await onSalvarAcesso(pessoa, {
        roleId: draftRole,
        perfilAcessoId: pessoa.perfilAcessoId,
      });
      setCargoSalvoSucesso(true);
      setTimeout(() => setCargoSalvoSucesso(false), 3000);
    } catch (err) {
      setSaveError(err.message || "Não foi possível salvar o cargo.");
    } finally {
      setSalvandoCargo(false);
    }
  };

  const handleSalvarAcessoClick = () => {
    if (!isAccessDirty || owner || !canManageUsers) return;
    if (isPerfilCustomizado) {
      if (draftProfileType === "cli") {
        setDecisaoTipo("existente");
      } else {
        setDecisaoTipo("novo");
      }
      const nomeBase = draftPerfilObj?.nome || "Perfil";
      setDecisaoNomePerfil(generateUniqueProfileName(nomeBase, perfisAcesso));
      setDecisaoDescPerfil("");
      setDecisaoErro("");
      setShowDecisaoSalvarModal(true);
    } else {
      executarSalvarAcessoDireto(draftPerfil, draftRole);
    }
  };

  const executarSalvarAcessoDireto = async (perfilIdParaSalvar, roleIdParaSalvar) => {
    setSaving(true);
    setSaveError("");
    try {
      await onSalvarAcesso(pessoa, {
        roleId: roleIdParaSalvar,
        perfilAcessoId: perfilIdParaSalvar,
      });
      setShowMudarAcessoModal(false);
    } catch (err) {
      setSaveError(err.message || "Não foi possível salvar o acesso.");
    } finally {
      setSaving(false);
    }
  };

  const handleExecutarDecisaoSalvar = async () => {
    setSalvandoDecisao(true);
    setDecisaoErro("");
    try {
      let finalPerfilId = draftPerfil;
      const headers =
        typeof fetchHeaders === "function"
          ? await fetchHeaders()
          : await authHeadersForFetch({ needsOrg: true });
      if (decisaoTipo === "existente") {
        if (draftProfileType !== "cli") {
          throw new Error(
            "Modelos prontos do sistema não podem ser alterados diretamente. Escolha a opção de criar um novo perfil.",
          );
        }
        await atualizarPermissoesDoPerfil({
          perfilId: draftPerfil,
          permissoes: permissoesDoNivel,
          fetchHeaders: headers,
        });
      } else {
        if (!decisaoNomePerfil.trim()) {
          throw new Error("Informe o nome do novo perfil de acesso.");
        }
        if (isProfileNameDuplicate(decisaoNomePerfil, perfisAcesso)) {
          throw new Error("Já existe um perfil com este nome nesta clínica.");
        }
        const novoPerfilCriado = await criarPerfilComPermissoes({
          nome: decisaoNomePerfil.trim(),
          descricao: decisaoDescPerfil.trim() || undefined,
          permissoes: permissoesDoNivel,
          fetchHeaders: headers,
        });
        finalPerfilId = novoPerfilCriado.id;
        onPerfilCriado?.(novoPerfilCriado);
        setDraftPerfil(novoPerfilCriado.id);
      }
      await onSalvarAcesso(pessoa, {
        roleId: draftRole,
        perfilAcessoId: finalPerfilId,
      });
      originalPermissoesRef.current = [...permissoesDoNivel];
      setShowDecisaoSalvarModal(false);
      setShowMudarAcessoModal(false);
    } catch (err) {
      setDecisaoErro(err.message || "Erro ao salvar alterações de acesso.");
    } finally {
      setSalvandoDecisao(false);
    }
  };

  const handleConfirmInativar = async () => {
    if (!inativarSenha) {
      setInativarSenhaErro("Informe sua senha para confirmar a inativação.");
      return;
    }
    setInativarSubmitting(true);
    setInativarSenhaErro("");
    try {
      if (supabase?.auth) {
        const { data: sessionData } = await supabase.auth.getSession();
        const userEmail = sessionData?.session?.user?.email;
        if (userEmail) {
          const { error: authErr } = await supabase.auth.signInWithPassword({
            email: userEmail,
            password: inativarSenha,
          });
          if (authErr) {
            setInativarSenhaErro("Senha incorreta. Verifique e tente novamente.");
            setInativarSubmitting(false);
            return;
          }
        }
      }
      if (inativarMotivo?.trim()) {
        await onDesativar?.(pessoa, inativarMotivo.trim());
      } else {
        await onDesativar?.(pessoa);
      }
      setShowInativarModal(false);
    } catch (err) {
      setInativarSenhaErro(err.message || "Erro ao processar inativação.");
    } finally {
      setInativarSubmitting(false);
    }
  };
  const selectedPeriod = (() => {
    if (!hojeIso) return "";
    if (periodo === "ano") return `${hojeIso.slice(0, 4)}-01-01`;
    if (periodo === "mes") return `${hojeIso.slice(0, 7)}-01`;
    const date = new Date(`${hojeIso.slice(0, 7)}-01T12:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() - 2);
    return calendarIso(date);
  })();
  const periodHistory = history.filter(
    (a) => a.dataAgendamento >= selectedPeriod && a.dataAgendamento <= hojeIso,
  );
  let body;
  if (tab === "geral")
    body = !attends ? (
      noAppointments
    ) : (
      <div className="g2">
        <div>
          <div className="box">
            <h4>
              <I name="cal" />
              Hoje, {dateLabel(hojeIso)}
              <small>{agendaNotice ? "—" : today.length} atendimentos</small>
            </h4>
            {agendaNotice || <Timeline items={today} />}
          </div>
          <div className="box">
            <h4>
              <I name="calok" />
              Próximos agendamentos
              <small>
                <button
                  className="btn-g"
                  onClick={() => setTab("agenda")}
                  style={{ minHeight: 0, padding: 0 }}
                >
                  ver agenda
                </button>
              </small>
            </h4>
            {agendaNotice || <Timeline items={upcoming.slice(0, 4)} dates />}
          </div>
        </div>
        <div>
          <div className="box">
            <h4>
              <I name="hist" />
              Horário de atendimento
              {(canManageDisponibilidade ?? Boolean(onDisponibilidade)) && (
                <small>
                  <button
                    className="btn-g"
                    style={{ minHeight: 0, padding: 0 }}
                    onClick={() =>
                      onDisponibilidade
                        ? onDisponibilidade(pessoa, refreshAvailability)
                        : setShowAvailability(true)
                    }
                  >
                    editar
                  </button>
                </small>
              )}
            </h4>
            {!canReadAvailability ? (
              <div className="help">
                Você não tem permissão para consultar os horários.
              </div>
            ) : !availability ? (
              <div role="status">Carregando horários…</div>
            ) : availability.error ? (
              <div role="alert">
                {availability.error}
                <button
                  className="btn-s"
                  onClick={() => setAvailabilityReload((value) => value + 1)}
                >
                  Tentar novamente
                </button>
              </div>
            ) : (
              <WeekSchedule availability={availability.data} />
            )}
          </div>
          <div className="box">
            <h4>
              <I name="steth" />O que mais faz<small>este mês</small>
            </h4>
            {agendaNotice || (
              <div className="bars">
                {procedures.length ? (
                  procedures.map(([label, count]) => (
                    <div key={label}>
                      <span className="trunc">{label}</span>
                      <i
                        style={{
                          width: Math.round((count / procedures[0][1]) * 90),
                        }}
                      />
                      <b>{count}</b>
                    </div>
                  ))
                ) : (
                  <div className="empty" style={{ padding: 20 }}>
                    Sem procedimentos realizados no período.
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="box">
            <h4>
              <I name="shield" />
              Acesso
            </h4>
            {summary}
          </div>
        </div>
      </div>
    );
  else if (tab === "agenda")
    body = !attends ? (
      noAppointments
    ) : (
      <div className="box">
        <h4>
          <I name="cal" />
          Próximos 7 dias
          <small>{agendaNotice ? "—" : upcoming.length} agendamentos</small>
        </h4>
        {agendaNotice || (
          <>
            <div className="day">Hoje · {dateLabel(hojeIso)}</div>
            <Timeline items={today} />
            {Array.from(new Set(upcoming.map((a) => a.dataAgendamento))).map(
              (day) => (
                <React.Fragment key={day}>
                  <div className="day">{dateLabel(day)}</div>
                  <Timeline
                    items={upcoming.filter((a) => a.dataAgendamento === day)}
                  />
                </React.Fragment>
              ),
            )}
          </>
        )}
      </div>
    );
  else if (tab === "atend")
    body = !attends ? (
      noAppointments
    ) : (
      <div className="box">
        <div className="flt">
          {[
            ["mes", "Este mês"],
            ["3m", "Últimos 3 meses"],
            ["ano", "Este ano"],
          ].map(([value, label]) => (
            <button
              key={value}
              className={periodo === value ? "on" : ""}
              onClick={() => {
                setPeriodo(value);
                onPeriodoChange?.(value);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {agendaNotice || (
          <div style={{ overflowX: "auto" }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Paciente</th>
                  <th className="hm">Procedimento</th>
                  <th className="hm">Duração</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {periodHistory.map((a) => (
                  <tr key={a.id}>
                    <td className="m">
                      {dateLabel(a.dataAgendamento).slice(0, 5)}
                    </td>
                    <td>
                      {onSelectPatient && a.pacienteId ? (
                        <button
                          type="button"
                          className="hover:underline text-left font-bold cursor-pointer text-app-ink bg-transparent p-0 border-0 inline-flex items-center gap-1.5"
                          onClick={() => {
                            const isRowInativo = a.pacienteAtivo === false || inactivePatientIds.has(String(a.pacienteId));
                            onSelectPatient({
                              id: a.pacienteId,
                              name: a.pacienteNome || "Paciente não informado",
                              photo: a.pacienteFotoUrl,
                              cpf: a.pacienteCpf,
                              ativo: !isRowInativo,
                              status: isRowInativo ? "inativo" : "ativo",
                            });
                          }}
                          aria-label={`Abrir histórico de ${a.pacienteNome || "paciente"}`}
                        >
                          <span>{a.pacienteNome || "Paciente não informado"}</span>
                          {(a.pacienteAtivo === false || inactivePatientIds.has(String(a.pacienteId))) && (
                            <span className="text-[10px] font-extrabold tracking-wider uppercase px-1.5 py-0.2 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                              INATIVO
                            </span>
                          )}
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1.5">
                          <b>{a.pacienteNome || "Paciente não informado"}</b>
                          {(a.pacienteAtivo === false || inactivePatientIds.has(String(a.pacienteId))) && (
                            <span className="text-[10px] font-extrabold tracking-wider uppercase px-1.5 py-0.2 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                              INATIVO
                            </span>
                          )}
                        </span>
                      )}
                    </td>
                    <td className="hm">{procedure(a)}</td>
                    <td className="hm m">{duration(a)}</td>
                    <td>
                      <span className={`sc ${statusClass(a)}`}>
                        {statusLabel(a)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!periodHistory.length && (
              <div className="empty">Nenhum atendimento neste período.</div>
            )}
          </div>
        )}
      </div>
    );
  else if (tab === "pacs")
    body = !attends ? (
      noAppointments
    ) : (
      <div className="box">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 mb-3">
          <h4>
            <I name="users" />
            Pacientes que {first} atendeu
            <small>
              {agendaNotice
                ? "—"
                : inactivePatients.length > 0
                ? `${activePatients.length} ${activePatients.length === 1 ? "ativo" : "ativos"} · ${inactivePatients.length} ${inactivePatients.length === 1 ? "inativo" : "inativos"}`
                : `${displayedPatients.length} ${displayedPatients.length === 1 ? "paciente" : "pacientes"}`}
            </small>
          </h4>
        </div>
        {!agendaNotice && (
          <div className="flex flex-wrap items-center justify-between gap-2.5 mb-3">
            {/* Campo de Busca por Nome */}
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <input
                type="text"
                value={patientSearchTerm}
                onChange={(e) => setPatientSearchTerm(e.target.value)}
                placeholder="Buscar paciente por nome..."
                className="w-full h-9 pl-8 pr-8 text-xs text-slate-800 placeholder-slate-400 bg-white border border-slate-200 rounded-lg shadow-2xs hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition-all"
                aria-label="Buscar paciente por nome"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              {patientSearchTerm && (
                <button
                  type="button"
                  onClick={() => setPatientSearchTerm("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-400 hover:text-slate-600 cursor-pointer"
                  aria-label="Limpar busca"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Botão de Filtros com Popover */}
              <div className="relative" ref={filterPopoverRef}>
                <button
                  type="button"
                  onClick={() => setShowFilterPopover((v) => !v)}
                  className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-semibold border transition-all shadow-2xs cursor-pointer ${
                    activeFiltersCount > 0
                      ? "bg-teal-50 text-teal-800 border-teal-300 hover:bg-teal-100"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                  }`}
                  aria-expanded={showFilterPopover}
                  aria-label="Filtros de pacientes"
                >
                  <Filter className="w-3.5 h-3.5" />
                  <span>Filtros</span>
                  {activeFiltersCount > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-black rounded-full bg-teal-600 text-white leading-none">
                      {activeFiltersCount}
                    </span>
                  )}
                  <ChevronDown className="w-3.5 h-3.5 opacity-60" />
                </button>

                {/* Popover Card */}
                {showFilterPopover && (
                  <div
                    role="dialog"
                    aria-label="Filtros de pacientes"
                    className="absolute right-0 top-full mt-1.5 z-50 w-72 p-4 bg-white rounded-xl shadow-xl border border-slate-200 text-xs flex flex-col gap-3.5"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="font-bold text-slate-800 text-[13px]">Filtros</span>
                      {activeFiltersCount > 0 && (
                        <button
                          type="button"
                          onClick={clearAllFilters}
                          className="text-teal-700 hover:text-teal-900 font-semibold text-[11px] cursor-pointer"
                        >
                          Limpar
                        </button>
                      )}
                    </div>

                    {/* Seção 1: Status */}
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Status do cadastro</span>
                      <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-lg">
                        <button
                          type="button"
                          onClick={() => setFilterStatus("ativos")}
                          className={`py-1 px-1.5 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                            filterStatus === "ativos" ? "bg-white text-slate-900 shadow-2xs font-bold" : "text-slate-600 hover:text-slate-900"
                          }`}
                        >
                          Ativos
                        </button>
                        <button
                          type="button"
                          onClick={() => setFilterStatus("todos")}
                          className={`py-1 px-1.5 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                            filterStatus === "todos" ? "bg-white text-slate-900 shadow-2xs font-bold" : "text-slate-600 hover:text-slate-900"
                          }`}
                        >
                          Todos
                        </button>
                        <button
                          type="button"
                          onClick={() => setFilterStatus("inativos")}
                          className={`py-1 px-1.5 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                            filterStatus === "inativos" ? "bg-white text-slate-900 shadow-2xs font-bold" : "text-slate-600 hover:text-slate-900"
                          }`}
                        >
                          Inativos
                        </button>
                      </div>
                    </div>

                    {/* Seção 2: Sexo */}
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Sexo</span>
                      <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-lg">
                        <button
                          type="button"
                          onClick={() => setFilterGender("todos")}
                          className={`py-1 px-1.5 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                            filterGender === "todos" ? "bg-white text-slate-900 shadow-2xs font-bold" : "text-slate-600 hover:text-slate-900"
                          }`}
                        >
                          Todos
                        </button>
                        <button
                          type="button"
                          onClick={() => setFilterGender("m")}
                          className={`py-1 px-1.5 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                            filterGender === "m" ? "bg-white text-slate-900 shadow-2xs font-bold" : "text-slate-600 hover:text-slate-900"
                          }`}
                        >
                          Homem
                        </button>
                        <button
                          type="button"
                          onClick={() => setFilterGender("f")}
                          className={`py-1 px-1.5 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                            filterGender === "f" ? "bg-white text-slate-900 shadow-2xs font-bold" : "text-slate-600 hover:text-slate-900"
                          }`}
                        >
                          Mulher
                        </button>
                      </div>
                    </div>

                    {/* Seção 3: Faixa Etária */}
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Faixa Etária</span>
                      <div className="flex flex-col gap-1">
                        {[
                          { id: "todos", label: "Todas as idades" },
                          { id: "menor", label: "Menores (< 18 anos)" },
                          { id: "adulto", label: "Adultos (18–59 anos)" },
                          { id: "idoso", label: "Idosos (60+ anos)" },
                        ].map((item) => (
                          <label
                            key={item.id}
                            className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer text-slate-700"
                          >
                            <input
                              type="radio"
                              name="filterAgeGroup"
                              checked={filterAgeGroup === item.id}
                              onChange={() => setFilterAgeGroup(item.id)}
                              className="text-teal-600 focus:ring-teal-500 cursor-pointer"
                            />
                            <span>{item.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Seletor de Ordenação */}
              <div className="relative inline-flex items-center">
                <select
                  value={patientSort}
                  onChange={(e) => setPatientSort(e.target.value)}
                  className="h-9 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg pl-7 pr-7 shadow-2xs hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 appearance-none cursor-pointer"
                  aria-label="Ordenar pacientes"
                >
                  <option value="recente">Último atendimento (mais recente)</option>
                  <option value="antigo">Último atendimento (mais antigo)</option>
                  <option value="mais_atendimentos">Mais atendimentos (frequência)</option>
                  <option value="primeiro_atendimento">Primeiro atendimento (vínculo)</option>
                  <option value="nome_asc">Nome (A–Z)</option>
                  <option value="nome_desc">Nome (Z–A)</option>
                  <option value="idade_menor">Idade (menor para maior)</option>
                  <option value="idade_maior">Idade (maior para menor)</option>
                </select>
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 absolute left-2 pointer-events-none" />
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 pointer-events-none" />
              </div>
            </div>
          </div>
        )}
        {agendaNotice || (
          <div className="pcl">
            {displayedPatients.map((p) => (
              <button
                type="button"
                key={p.id}
                className={`pci pci-clickable cursor-pointer transition-colors ${
                  !p.ativo ? "bg-amber-50/20 hover:bg-amber-50/50 border-amber-200/50" : "hover:bg-slate-50"
                }`}
                disabled={!onSelectPatient}
                aria-label={`Abrir histórico de ${p.name}`}
                onClick={() => onSelectPatient?.({ ...p, status: p.ativo ? "ativo" : "inativo", isAtivo: p.ativo })}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelectPatient?.({ ...p, status: p.ativo ? "ativo" : "inativo", isAtivo: p.ativo });
                  }
                }}
              >
                <span
                  className="av"
                  style={{
                    width: 40,
                    height: 40,
                    background: !p.ativo ? "#94a3b8" : "var(--app-accent)",
                  }}
                >
                  {p.photo ? <img src={p.photo} alt="" /> : initials(p.name)}
                </span>
                <div className="t">
                  <div className="flex items-center gap-2">
                    <b className="trunc">{p.name}</b>
                    {!p.ativo && (
                      <span className="text-[10px] font-black tracking-wider uppercase px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs">
                        INATIVO
                      </span>
                    )}
                  </div>
                  <span>
                    {p.idade != null && `${p.idade} anos · `}
                    {p.sexoLabel && `${p.sexoLabel} · `}
                    {p.count} {p.count > 1 ? "atendimentos" : "atendimento"} ·{" "}
                    último em {dateLabel(p.last).slice(0, 5)}
                    {!p.ativo && " · Cadastro inativado"}
                  </span>
                </div>
                <I name="cr" />
              </button>
            ))}
            {!displayedPatients.length && (
              patientSearchTerm.trim().length > 0 ? (
                <div className="empty flex flex-col items-center justify-center gap-2.5 py-8 text-center bg-slate-50/60 rounded-xl border border-dashed border-slate-200">
                  <span className="text-slate-600 text-xs font-medium">
                    Nenhum paciente encontrado para "{patientSearchTerm}".
                  </span>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-50 text-teal-800 border border-teal-200 text-xs font-bold hover:bg-teal-100 transition-colors shadow-2xs cursor-pointer"
                    onClick={() => setPatientSearchTerm("")}
                  >
                    Limpar busca
                  </button>
                </div>
              ) : inactivePatients.length > 0 && filterStatus === "ativos" && filterGender === "todos" && filterAgeGroup === "todos" ? (
                <div className="empty flex flex-col items-center justify-center gap-2.5 py-8 text-center bg-slate-50/60 rounded-xl border border-dashed border-slate-200">
                  <span className="text-slate-600 text-xs font-medium">
                    Nenhum paciente ativo no período carregado ({inactivePatients.length}{" "}
                    {inactivePatients.length === 1 ? "paciente inativado oculto" : "pacientes inativados ocultos"}).
                  </span>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold hover:bg-amber-100 transition-colors shadow-2xs cursor-pointer"
                    onClick={() => setFilterStatus("todos")}
                  >
                    Ver {inactivePatients.length === 1 ? "inativado" : "inativados"} (+{inactivePatients.length})
                  </button>
                </div>
              ) : activeFiltersCount > 0 ? (
                <div className="empty flex flex-col items-center justify-center gap-2.5 py-8 text-center bg-slate-50/60 rounded-xl border border-dashed border-slate-200">
                  <span className="text-slate-600 text-xs font-medium">
                    Nenhum paciente atende aos filtros selecionados.
                  </span>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-50 text-teal-800 border border-teal-200 text-xs font-bold hover:bg-teal-100 transition-colors shadow-2xs cursor-pointer"
                    onClick={clearAllFilters}
                  >
                    Limpar filtros
                  </button>
                </div>
              ) : (
                <div className="empty">
                  Nenhum paciente atendido no período carregado.
                </div>
              )
            )}
          </div>
        )}
      </div>
    );
  else if (tab === "acesso")
    body = (
      <div className="acesso-container">
        {/* Coluna Principal: Dois Cards */}
        <div className="acesso-main-column">
          {/* Card 1: Cargo na Clínica */}
          <div className="acesso-card">
            <div className="acesso-card-header">
              <span className="acesso-card-icon-badge">
                <I name="ucog" />
              </span>
              <div>
                <h4>Cargo na Clínica</h4>
                <p>Função e título profissional na equipe.</p>
              </div>
            </div>

            <div style={{ padding: "0 20px 20px" }}>
              {canManageUsers && !owner ? (
                <div style={{ display: "flex", gap: "12px", alignItems: "flex-end", flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: "240px" }}>
                    <label htmlFor="pessoa-cargo" className="acesso-block-title" style={{ display: "block", marginBottom: 6 }}>
                      Função / Cargo
                    </label>
                    <div className="acesso-select-wrapper">
                      <select
                        id="pessoa-cargo"
                        className="acesso-select"
                        value={draftRole}
                        onChange={(e) => setDraftRole(e.target.value)}
                      >
                        {roles.map((role) => (
                          <option key={role.id} value={role.id}>
                            {formatCargoLabel(role.nome)}
                          </option>
                        ))}
                      </select>
                      <svg className="acesso-select-chevron" viewBox="0 0 20 20" fill="none" stroke="currentColor">
                        <path d="M7 8.5l3 3 3-3" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </div>
                  {isCargoDirty && (
                    <button
                      type="button"
                      className="btn-p"
                      disabled={salvandoCargo}
                      onClick={handleSalvarCargo}
                      style={{ height: "42px", padding: "0 18px", alignSelf: "flex-end" }}
                    >
                      {salvandoCargo ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Salvando…
                        </>
                      ) : (
                        "Salvar cargo"
                      )}
                    </button>
                  )}
                </div>
              ) : (
                <div className="acesso-static-value">
                  <span className="acesso-cargo-badge">
                    {formatCargoLabel(pessoa.roleName) || "Sem cargo atribuído"}
                  </span>
                </div>
              )}
              <div className="acesso-help-text" style={{ marginTop: 8 }}>
                Só o nome da função e título profissional. Não altera as permissões de acesso do sistema.
              </div>
              {cargoSalvoSucesso && (
                <div style={{ marginTop: 8, fontSize: "12px", color: "#007b68", fontWeight: 600 }}>
                  ✓ Cargo atualizado com sucesso!
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Perfil e Níveis de Acesso */}
          <div className="acesso-card" style={{ marginTop: 14 }}>
            <div className="acesso-card-header">
              <span className="acesso-card-icon-badge">
                <I name="shield" />
              </span>
              <div>
                <h4>Perfil e Níveis de Acesso</h4>
                <p>Controla telas, permissões e ações autorizadas para este colaborador.</p>
              </div>
            </div>

            {/* Seletor do Perfil */}
            <div style={{ padding: "0 20px 14px" }}>
              {owner ? (
                <div className="acesso-fixed-box">
                  <div className="acesso-fixed-header">
                    <ProfileChip perfil={perfil} fallback={pessoa.perfilAcessoNome} />
                    <span className="acesso-fixed-badge">
                      <I name="lock" />
                      fixo
                    </span>
                  </div>
                  <div className="acesso-help-text">
                    O dono da clínica sempre tem acesso a tudo.
                  </div>
                </div>
              ) : canManageUsers ? (
                <div
                  className="profile-picker-container prototype-invite"
                  ref={profileDropdownRef}
                  style={{ position: "relative" }}
                >
                  <label htmlFor="pessoa-perfil" className="sr-only">
                    Perfil Base
                  </label>
                  {/* Select Acessível para Formulário e Testes */}
                  <select
                    id="pessoa-perfil"
                    className="sr-only"
                    aria-label="Perfil Base"
                    value={draftPerfil}
                    onChange={(e) => handleSelectDraftPerfil(e.target.value)}
                    disabled={loadingTemplate}
                  >
                    {perfisAcesso
                      .filter((p) => String(p.codigo || "").toUpperCase() !== "DONO")
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nome}
                          {profileType(p) === "tpl" ? " (modelo pronto)" : " (da clínica)"}
                        </option>
                      ))}
                  </select>

                  {/* Dropdown de Perfis */}
                  <div
                    className={`profile-dropdown-menu ${profileDropdownOpen ? "open" : ""}`}
                    id="profileDropdown"
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
                        const isActive = String(draftPerfil) === String(p.id) && !isPerfilCustomizado;
                        const iconKey = isClinic ? "bld" : "shield";
                        return (
                          <button
                            key={p.id}
                            type="button"
                            role="option"
                            aria-selected={isActive}
                            className={`drop-item ${isActive ? "active" : ""}`}
                            onClick={() => {
                              handleSelectDraftPerfil(p.id);
                              setProfileDropdownOpen(false);
                            }}
                          >
                            <div className="drop-item-left">
                              <span className={`drop-item-icon ${isClinic ? "clinic" : "template"}`}>
                                <PrototypeIcon name={iconKey} size="s" />
                              </span>
                              <div>
                                <div className="drop-item-name">{p.nome}</div>
                                <div className="drop-item-desc">
                                  {p.descricao || (isClinic ? "Perfil da clínica" : "Modelo do sistema")}
                                </div>
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

                  {!draftPerfilObj ? (
                    /* Botão Vazio de Alto Destaque (Idêntico ao Protótipo) */
                    <button
                      type="button"
                      id="emptyProfileBtn"
                      className="invite-empty-btn"
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
                      className={`profile-card profile ${draftProfileType === "cli" ? "clinic" : ""}`}
                      aria-label="Resumo do perfil de acesso"
                      aria-busy={loadingTemplate}
                    >
                      <div className={`profile-card-top profile-main ${draftProfileType === "cli" ? "clinic-bg" : ""}`}>
                        <div className="card-profile-info">
                          <span className={`card-profile-icon profile-icon ${draftProfileType === "cli" ? "clinic" : ""}`}>
                            <PrototypeIcon
                              name={draftProfileType === "cli" ? "bld" : "shield"}
                              size="l"
                            />
                          </span>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                              <span className="card-profile-name profile-name">{draftPerfilObj.nome}</span>
                              <span className={`tag ${draftProfileType === "cli" ? "clinic" : ""}`}>
                                <PrototypeIcon
                                  name={draftProfileType === "cli" ? "bld" : "lock"}
                                  size="s"
                                />
                                {draftProfileType === "cli"
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
                              {draftPerfilObj.descricao || "Perfil personalizado da clínica."}
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
                            name={draftProfileType === "cli" ? "bld" : "lock"}
                            size="s"
                          />
                          <span>
                            {draftProfileType === "cli"
                              ? "Perfil personalizado da clínica. Ao salvar, você poderá atualizar este perfil para toda a clínica ou criar um novo."
                              : "Protegido pelo sistema. Personalize criando uma cópia ao salvar."}
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
                    </section>
                  )}
                </div>
              ) : (
                <div className="acesso-static-value">
                  <ProfileChip perfil={perfil} fallback={pessoa.perfilAcessoNome} />
                </div>
              )}
            </div>

            {/* Banner de customização de permissões */}
            {!owner && canManageUsers && isPerfilCustomizado && (
              <div className="custom-profile-alert" role="status" style={{ margin: "0 20px 14px" }}>
                <div className="alert-top-row">
                  <div className="alert-main-content">
                    <div className="alert-icon-box">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="alert-title">
                        Você está personalizando as permissões deste colaborador
                      </div>
                      <div className="alert-desc">
                        Modificações feitas com base em <strong>{draftPerfilObj?.nome || "Perfil"}</strong> poderão atualizar o perfil existente ou gerar um novo perfil de acesso na clínica ao salvar.
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="alert-undo-btn"
                    onClick={restaurarPerfilBase}
                    title="Reverter todas as personalizações"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Restaurar</span>
                  </button>
                </div>

                <div className="diff-summary-row">
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "#475569" }}>
                    Diferenças aplicadas:
                  </span>
                  <div
                    className="diff-pill-wrapper"
                    onMouseEnter={handleMouseEnterDiff}
                    onMouseLeave={handleMouseLeaveDiff}
                  >
                    <div
                      className="diff-pill-interactive flex items-center gap-1.5"
                      role="button"
                      tabIndex={0}
                      aria-label="Ver detalhes das diferenças aplicadas"
                      onClick={() => setShowDiffPopover((prev) => !prev)}
                    >
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
                      <Info className="h-3.5 w-3.5 text-slate-400" />
                    </div>
                    <DiffPopover
                      diff={diffCalculado}
                      basePerfilNome={draftPerfilObj?.nome || "Perfil Base"}
                      visible={showDiffPopover}
                    />
                  </div>
                </div>
              </div>
            )}

            {owner ? (
              <div style={{ padding: "0 20px 20px" }}>
                {permissionUnavailable && permissionState}
                {modules.map((m) => (
                  <div key={m.key} className="lvrow-container">
                    <div
                      className={`lvrow${owner && m.key === "agenda" ? " lvrow-interactive" : ""}`}
                      role={owner && m.key === "agenda" ? "button" : undefined}
                      tabIndex={owner && m.key === "agenda" ? 0 : undefined}
                      aria-expanded={owner && m.key === "agenda" ? isAgendaRnfExpanded : undefined}
                      aria-controls={owner && m.key === "agenda" ? "owner-agenda-inline-options" : undefined}
                      onClick={owner && m.key === "agenda" ? () => setIsAgendaRnfExpanded((value) => !value) : undefined}
                      onKeyDown={owner && m.key === "agenda" ? (event) => {
                        if (event.target !== event.currentTarget) return;
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setIsAgendaRnfExpanded((value) => !value);
                        }
                      } : undefined}
                    >
                      <span className="ic">
                        <I name={m.icon} />
                      </span>
                      <span className="lvrow-name">{m.name}</span>
                      {owner && m.key === "agenda" && (
                        <button
                          type="button"
                          className="rnf-accordion-trigger"
                          aria-expanded={isAgendaRnfExpanded}
                          aria-controls="owner-agenda-inline-options"
                          aria-label="Expandir configurações da agenda"
                          onClick={(event) => {
                            event.stopPropagation();
                            setIsAgendaRnfExpanded((value) => !value);
                          }}
                        >
                          <PrototypeIcon
                            name="cd"
                            size="s"
                            className={`rnf-chevron${isAgendaRnfExpanded ? " open" : ""}`}
                          />
                        </button>
                      )}
                      <span className={`l l${m.k}`}>{m.t}</span>
                    </div>
                    {owner && m.key === "agenda" && isAgendaRnfExpanded && (
                      <div
                        id="owner-agenda-inline-options"
                        className="owner-agenda-inline-accordion"
                      >
                        {[
                          [
                            "apareceNaAgenda",
                            "Aparecer na agenda",
                            pessoa.apareceNaAgenda === true,
                            "Receber agendamentos e definir horários de atendimento.",
                          ],
                          [
                            "agendaMultiVer",
                            "Ver múltiplas agendas",
                            agendaMultiVer,
                            "Consultar as agendas dos outros profissionais da clínica.",
                          ],
                        ].map(([field, label, checked, description]) => (
                          <div key={field} className="owner-agenda-toggle-row">
                            <div className="toggle-copy">
                              <strong>{label}</strong>
                              <p>{description}</p>
                            </div>
                            <Switch
                              ariaLabel={label}
                              checked={checked}
                              disabled={!isSelf || Boolean(savingAgenda)}
                              loading={savingAgenda === field}
                              onChange={(enabled) =>
                                saveAgendaOption(field, enabled)
                              }
                            />
                          </div>
                        ))}
                        {agendaOptionError && (
                          <div className="help" role="alert" style={{ color: "#b91c1c" }}>
                            {agendaOptionError}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <>
                {/* Título da Matriz */}
                <div className="matrix-title permission-title" style={{ padding: "0 20px 8px" }}>
                  <h3>O que este perfil pode fazer</h3>
                  <span className="aside" style={{ fontSize: "11px", fontWeight: 500, color: "#64748b" }}>
                    <PrototypeIcon name="info" size="s" />
                    Escolha um nível para cada área. Se precisar de algo no meio do caminho, escolha as funções uma a uma.
                  </span>
                </div>

                {permissionUnavailable ? (
                  <div style={{ padding: "0 20px 20px" }}>{permissionState}</div>
                ) : (
                  <div className="modulos-acesso-list" role="group" aria-label="Módulos do perfil" style={{ padding: "0 20px 10px" }}>
                    {matrixModules.map((m) => {
                      const statusObj = !m.selected.length
                        ? { tone: "none", oldTone: "off", label: "Sem acesso" }
                        : m.selected.length === m.permissions.length
                          ? { tone: "full", oldTone: "", label: "Completo" }
                          : { tone: "part", oldTone: "partial", label: "Parcial" };
                      const isExpanded = Boolean(abertosAcesso[m.key] || expandedMatrixModuleKey === m.key);
                      const modDiff = diffCalculado.porModulo[m.key];
                      const modHasDiff = Boolean(
                        modDiff && (modDiff.adicionadas.length > 0 || modDiff.desmarcadas.length > 0),
                      );
                      const modAddedCount = modDiff?.adicionadas.length || 0;
                      const modRemovedCount = modDiff?.desmarcadas.length || 0;

                      return (
                        <div key={m.key} className={`mod${modHasDiff ? " mod-has-diff" : ""}`}>
                          <div className="mod-h">
                            <div className="nm">
                              <span className="ic">
                                <PrototypeIcon name={m.icon} />
                              </span>
                              <span style={{ minWidth: 0 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                  <b>{m.name}</b>
                                  {modHasDiff && (
                                    <span
                                      className="mod-diff-chip"
                                      title={`${modAddedCount + modRemovedCount} modificações neste módulo`}
                                    >
                                      {modAddedCount > 0 && (
                                        <span className="diff-pill added mini">
                                          +{modAddedCount}
                                        </span>
                                      )}
                                      {modRemovedCount > 0 && (
                                        <span className="diff-pill removed mini">
                                          -{modRemovedCount}
                                        </span>
                                      )}
                                    </span>
                                  )}
                                </div>
                                <span className="trunc">{m.description}</span>
                              </span>
                            </div>
                            {!owner && canManageUsers && (
                              <div className="lv" role="group" aria-label={`Nível em ${m.name}`}>
                                {(m.editing?.length > 0 ? ["1", "2", "3", "0"] : ["1", "3", "0"]).map((key) => {
                                  const isAtivo = m.k === key;
                                  return (
                                    <button
                                      type="button"
                                      key={key}
                                      className={isAtivo ? "on" : ""}
                                      aria-pressed={isAtivo}
                                      onClick={() => aplicarAcessoEmLote(key, m)}
                                    >
                                      {etiquetasNivel[key]}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                          <div className="mod-x">
                            <span className="cnt">
                              {m.k === "c" ? (
                                <span className="cus">{m.t}</span>
                              ) : m.k === "0" ? (
                                "Nada liberado"
                              ) : (
                                `${m.selected.length} de ${m.permissions.length} funções`
                              )}
                            </span>
                            {m.permissions.length > 0 && (
                              <button
                                type="button"
                                className="btn-g expand-functions"
                                aria-label={`${m.name} ${m.selected.length}/${m.permissions.length} liberadas ${statusObj.label}`}
                                aria-expanded={isExpanded}
                                onClick={() => {
                                  setAbertosAcesso((prev) => ({
                                    ...prev,
                                    [m.key]: !isExpanded,
                                  }));
                                  if (expandedMatrixModuleKey === m.key) {
                                    setExpandedMatrixModuleKey(null);
                                  }
                                }}
                              >
                                {isExpanded ? "Esconder funções" : "Escolher funções uma a uma"}{" "}
                                <PrototypeIcon name={isExpanded ? "cd" : "cr"} size="s" />
                              </button>
                            )}
                          </div>

                          {isExpanded && (
                            <section
                              ref={expandedMatrixModuleKey === m.key ? pageModuleDetailRef : null}
                              id={`matrix-module-detail-${m.key}`}
                              className="module-detail-box module-detail open"
                              role="region"
                              aria-label={`Funções de ${m.name}`}
                            >
                              <div className="perm">
                                {m.permissions.map((permission) => {
                                  const checked = owner
                                    ? true
                                    : permissoesDoNivel.includes(permission.permissaoId);
                                  const origSet = new Set(originalPermissoesRef.current || []);
                                  const wasInOrig = origSet.has(permission.permissaoId);
                                  const isAdded = !wasInOrig && checked;
                                  const isRemoved = wasInOrig && !checked;

                                  return (
                                    <label
                                      key={permission.permissaoId}
                                      className={`perm-item${checked ? " on" : ""}${isAdded ? " perm-item-added" : ""}${isRemoved ? " perm-item-removed" : ""}`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        disabled={owner || !canManageUsers}
                                        aria-label={permission.nome}
                                        onChange={() => togglePermissao(permission.permissaoId, m)}
                                      />
                                      <span>{permission.nome}</span>
                                      {isAdded && (
                                        <span className="perm-diff-tag added">
                                          + Adicionada
                                        </span>
                                      )}
                                      {isRemoved && (
                                        <span className="perm-diff-tag removed">
                                          - Desmarcada
                                        </span>
                                      )}
                                    </label>
                                  );
                                })}
                              </div>
                            </section>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {/* Rodapé com Feedback e Botão Salvar */}
            {canManageUsers && !owner && (
              <div className="acesso-actions-footer">
                <div className="acesso-feedback-area">
                  {isAccessDirty && (
                    <span className="acesso-dirty-badge">
                      {isPerfilCustomizado
                        ? "Permissões personalizadas pendentes de salvamento"
                        : "Alterações pendentes de salvamento"}
                    </span>
                  )}
                  {saveError && (
                    <div className="acesso-error-text" role="alert">
                      {saveError}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className="btn-p h-9 px-4 rounded-lg bg-[#00a88e] hover:bg-[#00967f] text-white text-[13px] font-semibold transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!isAccessDirty || saving}
                  onClick={handleSalvarAcessoClick}
                >
                  {saving ? "Salvando…" : "Salvar acesso"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  else
    body = canSeeConfigAuditoria ? (
      <AuditoriaView roleUserId={pessoa.id} />
    ) : (
      <div className="box">
        <div className="empty">
          Você não tem permissão para consultar o histórico.
        </div>
      </div>
    );
  return (
    <div className="prototype-equipe equipe-pessoa">
      {showCadastroModal && (
        <UsuarioCadastroModal
          pessoa={pessoa}
          isSelf={isSelf}
          canManageUsers={canManageUsers}
          onAlterarAcesso={() => {
            setShowCadastroModal(false);
            setTab("acesso");
            requestAnimationFrame(() => {
              if (typeof tabsContainerRef.current?.scrollIntoView === "function") {
                tabsContainerRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
              }
            });
          }}
          onClose={() => setShowCadastroModal(false)}
          onMediaAtualizada={updateCadastro}
          onSaved={(data) => {
            updateCadastro(data);
            setShowCadastroModal(false);
          }}
        />
      )}
      {!hideBreadcrumb && (
        <div className="crumb">
          <button className="btn-g" onClick={onBack}>
            <I name="cl" />
            {backLabel}
          </button>
          <span>/</span>
          <span className="trunc">{isSelf ? "Meu Perfil" : name}</span>
        </div>
      )}
      <section className="hero">
        <div className={`cov ${owner ? "dono" : ""}`} />
        <div className="bd">
          <span
            className="av"
            style={{ background: owner ? "#f59e0b" : "var(--app-accent)" }}
          >
            {pessoa.fotoUrl ? (
              <img src={perfilFotoDisplaySrc(pessoa.fotoUrl)} alt="" />
            ) : (
              initials(name)
            )}
            {owner && (
              <span className="crown" title="Dono da clínica">
                <I name="crown" />
              </span>
            )}
          </span>
          <div className="id">
            <h2>{name}</h2>
            <div className="ln">
              <span>{formatCargoLabel(pessoa.roleName) || "Sem cargo atribuído"}</span>
              <span>·</span>
              <ProfileChip perfil={perfil} fallback={pessoa.perfilAcessoNome} />
              <span className={`st${pessoa.ativo === false ? " off" : ""}`}>
                {pessoa.ativo === false ? "Desativado" : "Ativo"}
              </span>
            </div>
          </div>
          <div className="ac">
            {(isSelf || canManageUsers) && (
              <button
                type="button"
                className="btn-s"
                aria-label="Abrir cadastro do usuário"
                onClick={() => setShowCadastroModal(true)}
              >
                <I name="file" />
                Cadastro
              </button>
            )}
            {pessoa.telefone && (
              <a
                className="btn-s"
                style={{ color: "#16a34a" }}
                href={`https://wa.me/${pessoa.telefone.replace(/\D/g, "")}`}
                target="_blank"
                rel="noreferrer"
              >
                <I name="wa" />
                WhatsApp
              </a>
            )}
            {attends && canSeeAgenda && (
              <button
                className="btn-p"
                onClick={() => onNavigateAgenda?.(pessoa)}
              >
                <I name="cal" />
                Agendar com {first}
              </button>
            )}
            {canDeleteUsers && !owner && pessoa.ativo !== false && (
              <button
                type="button"
                className="btn-inativar-hero"
                onClick={() => {
                  setInativarMotivo("");
                  setInativarSenha("");
                  setInativarSenhaErro("");
                  setShowInativarModal(true);
                }}
                title="Inativar colaborador"
                aria-label="Inativar colaborador"
              >
                <UserMinus className="h-4 w-4 shrink-0" strokeWidth={2.2} aria-hidden />
              </button>
            )}
          </div>
        </div>
        <div className="ct">
          <span>
            <I name="mail" />
            {pessoa.email || "sem e-mail"}
          </span>
          <span>
            <I name="phone" />
            {pessoa.telefone || (
              <span style={{ color: "var(--app-faint)" }}>sem telefone</span>
            )}
          </span>
          {pessoa.dataNascimento && (
            <span>
              🎂 Aniversário {dateLabel(pessoa.dataNascimento).slice(0, 5)}
            </span>
          )}
          <span>
            <I name="cal" />
            Na equipe desde{" "}
            {pessoa.criadoEm
              ? dateLabel(pessoa.criadoEm)
              : "data não informada"}
          </span>
        </div>
      </section>
      {attends && (
        <div className="pk">
          {[
            ["Atendimentos neste mês", monthDone.length, ""],
            ["Pacientes atendidos", patients.length, ""],
            [
              "Hoje",
              today.length,
              `${today.filter((a) => status(a) === "REALIZADO").length} já atendidos`,
            ],
            ["Próximos 7 dias", upcoming.length, ""],
          ].map(([label, value, note]) => (
            <div key={label}>
              <small>{label}</small>
              <b>{agendaNotice ? "—" : value}</b>
              {note && !agendaNotice && <em>{note}</em>}
            </div>
          ))}
        </div>
      )}
      <div
        ref={tabsContainerRef}
        className="ptabs scroll-mt-4"
        role="tablist"
        aria-label="Informações da pessoa"
      >
        {TABS.map(([id, label]) => (
          <button
            key={id}
            id={`pessoa-tab-${id}`}
            role="tab"
            aria-selected={tab === id}
            aria-controls="pessoa-painel"
            className={`tab${tab === id ? " on" : ""}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div
        id="pessoa-painel"
        role="tabpanel"
        aria-labelledby={`pessoa-tab-${tab}`}
      >
        {body}
      </div>
      {showAvailability && (
        <DisponibilidadeProfissionalModal
          roleUserId={pessoa.id}
          nome={name}
          onClose={() => setShowAvailability(false)}
          onSaved={refreshAvailability}
        />
      )}
      {showInativarModal && (
        <div
          className="inativar-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="inativar-colaborador-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !inativarSubmitting) {
              setShowInativarModal(false);
            }
          }}
        >
          <div
            className="inativar-modal-card"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="inativar-modal-head">
              <h3 id="inativar-colaborador-title">Inativar colaborador?</h3>
              <button
                type="button"
                className="inativar-modal-close"
                onClick={() => {
                  if (!inativarSubmitting) setShowInativarModal(false);
                }}
                aria-label="Fechar"
              >
                <X className="h-4 w-4" strokeWidth={2.5} />
              </button>
            </div>
            <div className="inativar-modal-body">
              <p>
                O histórico, atendimentos e prontuários de <strong>{pessoa.nomeCompleto || name}</strong> permanecem salvos e preservados. Esta ação desativa o acesso ao sistema e pode ser revertida a qualquer momento nas configurações.
              </p>
              <div>
                <label
                  htmlFor="inativar-colaborador-senha"
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#0f172a",
                    marginBottom: 6,
                  }}
                >
                  Sua senha <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  id="inativar-colaborador-senha"
                  type="password"
                  className="inativar-modal-input-password"
                  placeholder="Digite sua senha de acesso"
                  value={inativarSenha}
                  onChange={(e) => {
                    setInativarSenha(e.target.value);
                    if (inativarSenhaErro) setInativarSenhaErro("");
                  }}
                  disabled={inativarSubmitting}
                  autoComplete="current-password"
                />
                {inativarSenhaErro && (
                  <span className="inativar-modal-error-msg" role="alert">
                    {inativarSenhaErro}
                  </span>
                )}
              </div>
              <div>
                <label
                  htmlFor="inativar-colaborador-motivo"
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#475569",
                    marginBottom: 6,
                  }}
                >
                  Motivo (opcional)
                </label>
                <textarea
                  id="inativar-colaborador-motivo"
                  className="inativar-modal-textarea"
                  value={inativarMotivo}
                  onChange={(e) => setInativarMotivo(e.target.value)}
                  placeholder="Ex.: desligamento, licença médica…"
                  maxLength={500}
                  disabled={inativarSubmitting}
                />
              </div>
            </div>
            <div className="inativar-modal-footer">
              <button
                type="button"
                className="btn-g"
                disabled={inativarSubmitting}
                onClick={() => setShowInativarModal(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-d"
                disabled={inativarSubmitting}
                onClick={handleConfirmInativar}
              >
                {inativarSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : null}
                Desativar {resolveFriendlyName(pessoa)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Decisão ao Salvar Permissões Personalizadas via Portal */}
      {showDecisaoSalvarModal &&
        createPortal(
          <div
            className="acesso-modal-backdrop font-sans text-slate-800"
            role="dialog"
            aria-modal="true"
            aria-labelledby="decisao-modal-title"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget && !salvandoDecisao) {
                setShowDecisaoSalvarModal(false);
              }
            }}
          >
            <div className="decisao-modal-card prototype-equipe" onMouseDown={(e) => e.stopPropagation()}>
              <div className="decisao-modal-head">
                <div className="decisao-head-left">
                  <div className="decisao-head-icon">
                    <Shield className="h-5 w-5 text-[#00a88e]" />
                  </div>
                  <div>
                    <h3 id="decisao-modal-title" className="decisao-title">
                      Salvar Permissões Personalizadas
                    </h3>
                    <p className="decisao-subtitle">
                      Você fez alterações em relação ao perfil base{" "}
                      <strong>{draftPerfilObj?.nome || "Perfil"}</strong>. Como
                      deseja aplicar?
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="decisao-close-btn"
                  onClick={() => setShowDecisaoSalvarModal(false)}
                  disabled={salvandoDecisao}
                  aria-label="Fechar"
                  title="Fechar modal"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="decisao-modal-body">
                {/* Opção A: Atualizar perfil existente (se for perfil da clínica) */}
                {draftProfileType === "cli" ? (
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
                        Atualizar o perfil existente ({draftPerfilObj?.nome})
                      </span>
                      <label className="decisao-radio-wrapper flex items-center cursor-pointer m-0">
                        <input
                          type="radio"
                          name="decisaoTipo"
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
                      passarão a valer para todos os colaboradores vinculados a
                      ele.
                    </span>
                    {membrosVinculadosAoPerfil.length > 0 && (
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
                          Utilizado por {membrosVinculadosAoPerfil.length}{" "}
                          {membrosVinculadosAoPerfil.length > 1
                            ? "colaboradores"
                            : "colaborador"}
                          :{" "}
                          <strong>
                            {membrosVinculadosAoPerfil
                              .slice(0, 3)
                              .map(
                                (m) =>
                                  (m.nomeCompleto || m.nome || "").split(
                                    " ",
                                  )[0],
                              )
                              .join(", ")}
                            {membrosVinculadosAoPerfil.length > 3
                              ? ` e mais ${membrosVinculadosAoPerfil.length - 3}`
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
                        Atualizar modelo padrão ({draftPerfilObj?.nome})
                        <span className="decisao-badge-lock">Bloqueado</span>
                      </span>
                      <Lock className="h-4 w-4 text-slate-400 flex-shrink-0" />
                    </div>
                    <span className="decisao-opcao-desc">
                      Modelos prontos do sistema são protegidos e não podem ser
                      alterados diretamente. Crie um novo perfil abaixo.
                    </span>
                    {membrosVinculadosAoPerfil.length > 0 && (
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
                          Utilizado por {membrosVinculadosAoPerfil.length}{" "}
                          {membrosVinculadosAoPerfil.length > 1
                            ? "colaboradores"
                            : "colaborador"}
                          :{" "}
                          <strong>
                            {membrosVinculadosAoPerfil
                              .slice(0, 3)
                              .map(
                                (m) =>
                                  (m.nomeCompleto || m.nome || "").split(
                                    " ",
                                  )[0],
                              )
                              .join(", ")}
                            {membrosVinculadosAoPerfil.length > 3
                              ? ` e mais ${membrosVinculadosAoPerfil.length - 3}`
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
                      Criar um novo perfil e já vincular a {first}
                    </span>
                    <label className="decisao-radio-wrapper flex items-center cursor-pointer m-0">
                      <input
                        type="radio"
                        name="decisaoTipo"
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
                    Cria um novo perfil de acesso na clínica com estas permissões
                    específicas e já o atribui a este colaborador.
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
                          value={decisaoNomePerfil}
                          onChange={(e) => setDecisaoNomePerfil(e.target.value)}
                          placeholder="Ex: Recepcionista Avançado, Médico Plantonista..."
                          required
                          autoFocus
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
                        />
                      </div>
                    </div>
                  )}
                </div>

                {decisaoErro && (
                  <div className="decisao-error-box" role="alert">
                    {decisaoErro}
                  </div>
                )}
              </div>

              <div className="decisao-modal-foot">
                <button
                  type="button"
                  className="decisao-btn-cancel btn-s"
                  onClick={() => setShowDecisaoSalvarModal(false)}
                  disabled={salvandoDecisao}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="decisao-btn-confirm btn-p"
                  disabled={
                    salvandoDecisao ||
                    (decisaoTipo === "novo" &&
                      (!decisaoNomePerfil.trim() || isNomeDuplicado))
                  }
                  onClick={handleExecutarDecisaoSalvar}
                >
                  {salvandoDecisao ? (
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

      {/* Modal de Confirmação para Desativação de Raiz com Dependentes */}
      {confirmacaoDesativarRaiz &&
        createPortal(
          <div
            className="acesso-modal-backdrop font-sans text-slate-800"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dialog-raiz-title"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) {
                setConfirmacaoDesativarRaiz(null);
              }
            }}
          >
            <div
              className="decisao-modal-card prototype-equipe"
              style={{ maxWidth: 520 }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="decisao-modal-head">
                <div className="decisao-head-left">
                  <div
                    className="decisao-head-icon"
                    style={{ background: "#fef3c7", color: "#d97706" }}
                  >
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <h3 id="dialog-raiz-title" className="decisao-title">
                      Desativar visualização em{" "}
                      {confirmacaoDesativarRaiz.modulo.nome ||
                        confirmacaoDesativarRaiz.modulo.name ||
                        "Módulo"}
                      ?
                    </h3>
                    <p className="decisao-subtitle">
                      Ação com impacto em outras funções do módulo
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="decisao-close-btn"
                  onClick={() => setConfirmacaoDesativarRaiz(null)}
                  aria-label="Fechar"
                  title="Fechar modal"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="decisao-modal-body" style={{ padding: "16px 20px" }}>
                <div
                  style={{
                    background: "#fffdf5",
                    border: "1px solid #fde68a",
                    borderRadius: 10,
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

              <div className="decisao-modal-foot">
                <button
                  type="button"
                  className="decisao-btn-cancel btn-s"
                  onClick={() => setConfirmacaoDesativarRaiz(null)}
                >
                  Manter visualização
                </button>
                <button
                  type="button"
                  className="btn-danger"
                  style={{
                    padding: "9px 16px",
                    borderRadius: 8,
                    fontWeight: 600,
                    fontSize: 14,
                    border: "none",
                    background: "#dc2626",
                    color: "#fff",
                    cursor: "pointer",
                  }}
                  onClick={confirmarDesativacaoRaiz}
                >
                  Desativar funções dependentes
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Modal Rápido de Mudança de Acesso (disparado pelo Hero) via Portal */}
      {showMudarAcessoModal &&
        createPortal(
          <div
            className="acesso-modal-backdrop"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mudar-acesso-modal-title"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget && !saving) {
                setShowMudarAcessoModal(false);
              }
            }}
          >
            <div
              className="modal-card invite-dialog relative z-10 mx-auto flex max-h-[90vh] w-full max-w-[930px] flex-col overflow-hidden bg-white outline-none prototype-invite acesso-modal-card"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="modal-head invite-head">
                <span className="head-icon">
                  <PrototypeIcon name="shield" />
                </span>
                <div className="head-info invite-heading">
                  <h2 id="mudar-acesso-modal-title">Mudar Acesso de {first}</h2>
                  <p id="mudar-acesso-description">
                    Ajuste cargo, perfil e permissões deste colaborador com
                    visualização em tempo real.
                  </p>
                </div>
                <button
                  type="button"
                  className="modal-close invite-close"
                  onClick={() => setShowMudarAcessoModal(false)}
                  disabled={saving}
                  aria-label="Fechar"
                  title="Fechar modal (Esc)"
                >
                  <PrototypeIcon name="x" />
                </button>
              </div>

              <div className="modal-body invite-scroll acesso-modal-body flex-1 min-h-0 overflow-y-auto" style={{ padding: "20px 24px" }}>
                {/* 1. Seção Cargo e Acesso na Clínica */}
                <div className="section-title-wrap" style={{ marginBottom: "14px" }}>
                  <div className="section-title">
                    <PrototypeIcon name="ucog" size="s" />
                    <span>Cargo e Acesso na Clínica</span>
                  </div>
                  <div className="section-subtitle">
                    Defina a função exercida na equipe e confira as permissões liberadas antes de concluir.
                  </div>
                </div>

                <div className="fields-grid" style={{ marginBottom: "16px" }}>
                  <div className="field-group">
                    <label htmlFor="modal-pessoa-cargo" className="field-label">
                      <span>Cargo na Clínica</span>
                    </label>
                    <select
                      id="modal-pessoa-cargo"
                      className="select-control"
                      value={draftRole}
                      onChange={(e) => setDraftRole(e.target.value)}
                    >
                      {roles.map((role) => (
                        <option key={role.id} value={role.id}>
                          {formatCargoLabel(role.nome)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field-group">
                    <label htmlFor="modal-pessoa-perfil" className="field-label">
                      <span>Perfil de Acesso</span>
                    </label>
                    <select
                      id="modal-pessoa-perfil"
                      aria-label="Perfil de acesso"
                      className="select-control"
                      value={draftPerfil}
                      onChange={(e) => handleSelectDraftPerfil(e.target.value)}
                      disabled={loadingTemplate}
                    >
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
                  </div>
                </div>

                {/* Card Detalhado do Perfil com Botão Alterar Perfil & Dropdown */}
                <div className="profile-picker-container" ref={profileDropdownRef} style={{ marginBottom: "16px" }}>
                  <div
                    className={`profile-dropdown-menu ${profileDropdownOpen ? "open" : ""}`}
                    id="modalProfileDropdown"
                    role="listbox"
                    aria-label="Perfis Disponíveis"
                  >
                    <div className="drop-header">
                      <span>Perfis Disponíveis</span>
                      <span>{perfisDisponiveis.length} opções</span>
                    </div>
                    <div className="drop-list">
                      {perfisDisponiveis.map((p) => {
                        const isClinic = profileType(p) === "cli";
                        const isActive = String(draftPerfil) === String(p.id) && !isPerfilCustomizado;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            role="option"
                            aria-selected={isActive}
                            className={`drop-item ${isActive ? "active" : ""}`}
                            onClick={() => {
                              handleSelectDraftPerfil(p.id);
                              setProfileDropdownOpen(false);
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                              <span className={`drop-icon ${isClinic ? "clinic" : ""}`}>
                                <PrototypeIcon name={isClinic ? "bld" : "shield"} size="s" />
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
                              {isActive && <span style={{ color: "#00a88e", fontWeight: 800 }}>✓</span>}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {draftPerfilObj && (
                    <section
                      className={`profile-card profile ${draftProfileType === "cli" ? "clinic" : ""}`}
                      aria-label="Resumo do perfil de acesso"
                      aria-busy={loadingTemplate}
                    >
                      <div className={`profile-card-top profile-main ${draftProfileType === "cli" ? "clinic-bg" : ""}`}>
                        <div className="card-profile-info">
                          <span className={`card-profile-icon profile-icon ${draftProfileType === "cli" ? "clinic" : ""}`}>
                            <PrototypeIcon
                              name={draftProfileType === "cli" ? "bld" : "shield"}
                              size="l"
                            />
                          </span>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                              <span className="card-profile-name profile-name">{draftPerfilObj.nome}</span>
                              <span className={`tag ${draftProfileType === "cli" ? "clinic" : ""}`}>
                                <PrototypeIcon
                                  name={draftProfileType === "cli" ? "bld" : "lock"}
                                  size="s"
                                />
                                {draftProfileType === "cli"
                                  ? "Perfil da sua Clínica"
                                  : "Modelo pronto · protegido"}
                              </span>
                            </div>
                            <p className="card-profile-desc profile-desc">
                              {draftPerfilObj.descricao || "Perfil personalizado da clínica."}
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
                            name={draftProfileType === "cli" ? "bld" : "lock"}
                            size="s"
                          />
                          <span>
                            {draftProfileType === "cli"
                              ? "Você pode editar este perfil ou criar outro a partir dele."
                              : "Protegido pelo sistema. Personalize criando uma cópia."}
                          </span>
                        </div>
                        {!loadingTemplate && (
                          <div className="profile-amount-badge">
                            <PrototypeIcon name="shield-check" size="s" />
                            <span>
                              <b>{permissoesDoNivel.length}</b> / <b>{(permissoes || []).length}</b> funções liberadas
                            </span>
                          </div>
                        )}
                      </div>
                    </section>
                  )}
                </div>

                {/* Banner de customização se houver */}
                {isPerfilCustomizado && (
                  <div
                    className="custom-profile-alert"
                    role="status"
                    style={{ marginBottom: "16px" }}
                  >
                    <div className="alert-top-row">
                      <div className="alert-main-content">
                        <div className="alert-icon-box">
                          <Sparkles className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="alert-title">
                            Você está personalizando as permissões deste
                            colaborador
                          </div>
                          <div className="alert-desc">
                            Modificações feitas com base em{" "}
                            <strong>
                              {draftPerfilObj?.nome || "Perfil"}
                            </strong>{" "}
                            poderão atualizar o perfil existente ou gerar um novo
                            perfil de acesso na clínica ao salvar.
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="alert-undo-btn"
                        onClick={restaurarPerfilBase}
                        title="Reverter todas as personalizações"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        <span>Restaurar</span>
                      </button>
                    </div>

                    <div className="diff-summary-row">
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          color: "#475569",
                        }}
                      >
                        Diferenças aplicadas:
                      </span>
                      <div
                        className="diff-pill-wrapper"
                        onMouseEnter={handleMouseEnterDiff}
                        onMouseLeave={handleMouseLeaveDiff}
                      >
                        <div
                          className="diff-pill-interactive flex items-center gap-1.5"
                          role="button"
                          tabIndex={0}
                          aria-label="Ver detalhes das diferenças aplicadas"
                          onClick={() => setShowDiffPopover((prev) => !prev)}
                        >
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
                          <Info className="h-3.5 w-3.5 text-slate-400" />
                        </div>
                        <DiffPopover
                          diff={diffCalculado}
                          basePerfilNome={draftPerfilObj?.nome || "Perfil Base"}
                          visible={showDiffPopover}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Matriz Canônica */}
                <div
                  className="matrix-title permission-title"
                  style={{ marginBottom: "12px" }}
                >
                  <h3>Módulos e Permissões</h3>
                  <span
                    className="aside"
                    style={{
                      fontSize: "11px",
                      fontWeight: 500,
                      color: "#64748b",
                    }}
                  >
                    <PrototypeIcon name="info" size="s" />
                    Toque em um módulo para abrir e ajustar ações rápidas
                  </span>
                </div>

                <div
                  className="matrix-grid matrix"
                  role="group"
                  aria-label="Módulos do perfil no modal"
                >
                  {matrixModules.map((m) => {
                    const statusObj = !m.selected.length
                      ? { tone: "none", oldTone: "off", label: "Sem acesso" }
                      : m.selected.length === m.permissions.length
                        ? { tone: "full", oldTone: "", label: "Completo" }
                        : { tone: "part", oldTone: "partial", label: "Parcial" };
                    const isExpanded = expandedMatrixModuleKey === m.key;
                    return (
                      <button
                        type="button"
                        key={m.key}
                        className={`module-chip module ${isExpanded ? "expanded" : ""}`}
                        aria-label={`${m.name} ${m.selected.length}/${m.permissions.length} liberadas ${statusObj.label}`}
                        aria-expanded={isExpanded}
                        onClick={() =>
                          setExpandedMatrixModuleKey((current) =>
                            current === m.key ? null : m.key,
                          )
                        }
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            minWidth: 0,
                            flex: 1,
                          }}
                        >
                          <PrototypeIcon name={m.icon} />
                          <div className="module-info">
                            <b>{m.name}</b>
                            <span>
                              {m.selected.length}/{m.permissions.length} liberadas
                            </span>
                          </div>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          <span
                            className={`badge-status ${statusObj.tone} badge ${statusObj.oldTone}`}
                          >
                            {statusObj.label}
                          </span>
                          <span className="module-chevron">
                            <PrototypeIcon name="cd" size="s" />
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Detalhe do Módulo Expandido no Modal */}
                {expandedMatrixModuleKey !== null && selectedMatrixModule && (
                  <section
                    ref={modalModuleDetailRef}
                    className="module-detail-box module-detail open"
                    aria-label={`Funções de ${selectedMatrixModule.name}`}
                    style={{ marginTop: "14px" }}
                  >
                    <div className="detail-top-row detail-title">
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <PrototypeIcon name={selectedMatrixModule.icon} />
                        <div>
                          <h4>{selectedMatrixModule.name}</h4>
                          <span
                            style={{
                              fontSize: "11px",
                              color: "#007b68",
                              fontWeight: 600,
                            }}
                          >
                            {selectedMatrixModule.selected.length} de{" "}
                            {selectedMatrixModule.permissions.length} liberadas
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="modal-close"
                        style={{ width: "28px", height: "28px" }}
                        onClick={() => setExpandedMatrixModuleKey(null)}
                        title="Recolher"
                      >
                        <PrototypeIcon name="x" size="s" />
                      </button>
                    </div>

                    <div className="quick-nav-bar">
                      <span
                        style={{
                          fontSize: "12px",
                          fontWeight: 700,
                          color: "#334155",
                        }}
                      >
                        Ações rápidas:
                      </span>
                      <div
                        className="lv"
                        role="group"
                        aria-label={`Nível em ${selectedMatrixModule.name}`}
                      >
                        {(selectedMatrixModule.editing?.length > 0 ? ["1", "2", "3", "0"] : ["1", "3", "0"]).map((key) => {
                          const isAtivo = selectedMatrixModule.k === key;
                          return (
                            <button
                              type="button"
                              key={key}
                              className={isAtivo ? "on" : ""}
                              aria-pressed={isAtivo}
                              onClick={() =>
                                aplicarAcessoEmLote(key, selectedMatrixModule)
                              }
                            >
                              {etiquetasNivel[key]}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="perm">
                      {selectedMatrixModule.permissions.map((permission) => {
                        const checked = permissoesDoNivel.includes(
                          permission.permissaoId,
                        );
                        return (
                          <label
                            key={permission.permissaoId}
                            className={`perm-item${checked ? " on" : ""}`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              aria-label={permission.nome}
                              onChange={() =>
                                togglePermissao(
                                  permission.permissaoId,
                                  selectedMatrixModule,
                                )
                              }
                            />
                            <span>{permission.nome}</span>
                          </label>
                        );
                      })}
                    </div>
                  </section>
                )}
              </div>

              {/* Rodapé Estilizado Canônico Idêntico ao InviteModal */}
              <div className="modal-foot invite-foot acesso-modal-footer">
                <div className="foot-hint">
                  <PrototypeIcon name="shield-check" size="s" />
                  <span>
                    {isPerfilCustomizado
                      ? "Permissões personalizadas para este membro."
                      : "Você controla o acesso à sua clínica."}
                  </span>
                  {saveError && (
                    <span
                      className="acesso-error-text"
                      role="alert"
                      style={{ marginLeft: 8 }}
                    >
                      {saveError}
                    </span>
                  )}
                </div>
                <div className="foot-buttons">
                  <button
                    type="button"
                    className="btn-cancel invite-footer-button"
                    onClick={() => setShowMudarAcessoModal(false)}
                    disabled={saving}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn-submit invite-footer-button primary disabled:opacity-60 disabled:pointer-events-none"
                    disabled={!isAccessDirty || saving}
                    onClick={handleSalvarAcessoClick}
                  >
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                    <span>{saving ? "Salvando…" : "Salvar alterações"}</span>
                    {!saving && <PrototypeIcon name="cr" size="s" />}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
