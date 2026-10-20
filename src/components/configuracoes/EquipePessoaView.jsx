import React, { useEffect, useMemo, useRef, useState } from "react";
import { perfilFotoDisplaySrc } from "../layout/identityDisplay";
import UsuarioCadastroModal from "./UsuarioCadastroModal";
import PrototypeIcon from "./PrototypeIcon";
import { AuditoriaView } from "./AuditoriaView";
import { formatCargoLabel } from "./gestaoUsuariosUtils";
import {
  effectiveProfilePermissions,
  profileType,
  summarizeModules,
} from "./equipePrototypeUtils";
import {
  disponibilidadeApi,
  equipeApi,
  getApiErrorToastMessage,
} from "../../services/api";
import { Switch } from "../shared/Switch";
import DisponibilidadeProfissionalModal from "./DisponibilidadeProfissionalModal";
import "./equipePrototypeBase.css";
import "./gestaoEquipe.css";
import "./equipePessoa.css";
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
  return (
    <span className={`chip ${profileType(perfil)}`}>
      <I name={profileType(perfil) === "dono" ? "crown" : "shield"} />
      {perfil?.nome || fallback || "Sem perfil"}
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

export default function EquipePessoaView({
  pessoa: sourcePessoa,
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
  canSeeConfigPerfil,
  canSeeConfigAuditoria,
  onBack,
  onEditarPerfil,
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
  const [showCadastroModal, setShowCadastroModal] = useState(false);
  useEffect(() => {
    setLocalPessoa({});
    setShowCadastroModal(false);
    setIsAgendaRnfExpanded(false);
    setShowAvailability(false);
    setSavingAgenda("");
    setAgendaOptionError("");
  }, [sourcePessoa.id, orgId]);
  useEffect(() => {
    if (!isSelf) setShowCadastroModal(false);
  }, [isSelf]);
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
  const name = pessoa.nomeCompleto || pessoa.usuarioNome || "Pessoa sem nome";
  const first = name.split(" ")[0];
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
    : summarizeModules(permissoes, effectiveIds);
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
  const patients = Array.from(
    history
      .filter((a) => status(a) === "REALIZADO")
      .reduce((map, a) => {
        const prior = map.get(a.pacienteId);
        map.set(a.pacienteId, {
          id: a.pacienteId,
          name: a.pacienteNome || "Paciente não informado",
          photo: a.pacienteFotoUrl,
          cpf: a.pacienteCpf || prior?.cpf,
          count: (prior?.count || 0) + 1,
          last: a.dataAgendamento,
        });
        return map;
      }, new Map())
      .values(),
  );
  const procedures = Object.entries(
    monthDone.reduce((map, a) => {
      const key = procedure(a);
      map[key] = (map[key] || 0) + 1;
      return map;
    }, {}),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
  const accessDirty =
    String(draftRole) !== String(pessoa.roleId || "") ||
    String(draftPerfil) !== String(pessoa.perfilAcessoId || "");
  const menu = [
    ["users", "Pacientes", ["pacientes"]],
    ["cal", "Agenda", ["agenda"]],
    ["ucog", "Gestão de Equipe", ["equipe"]],
    ["gear", "Configurações", ["clinica", "sistema", "catalogo"]],
  ].map(([icon, label, keys]) => ({
    icon,
    label,
    on: modules.some(
      (m) =>
        keys.includes(m.key) &&
        m.selected.some((p) => p.codigo?.endsWith("_VER")),
    ),
  }));
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
  async function saveAccess() {
    if (
      !accessDirty ||
      owner ||
      !canManageUsers ||
      !onSalvarAcesso ||
      !draftPerfil ||
      !draftRole
    )
      return;
    setSaving(true);
    setSaveError("");
    try {
      await onSalvarAcesso(pessoa, {
        roleId: draftRole,
        perfilAcessoId: draftPerfil,
      });
    } catch (error) {
      setSaveError(error.message || "Não foi possível salvar o acesso.");
    } finally {
      setSaving(false);
    }
  }
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
                      <b>{a.pacienteNome || "Paciente não informado"}</b>
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
        <h4>
          <I name="users" />
          Pacientes que {first} atendeu
          <small>{agendaNotice ? "—" : patients.length} pacientes</small>
        </h4>
        {agendaNotice || (
          <div className="pcl">
            {patients.map((p) => (
              <button
                type="button"
                key={p.id}
                className="pci pci-clickable cursor-pointer hover:bg-slate-50 transition-colors"
                disabled={!onSelectPatient}
                aria-label={`Abrir histórico de ${p.name}`}
                onClick={() => onSelectPatient?.(p)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelectPatient?.(p);
                  }
                }}
              >
                <span
                  className="av"
                  style={{
                    width: 40,
                    height: 40,
                    background: "var(--app-accent)",
                  }}
                >
                  {p.photo ? <img src={p.photo} alt="" /> : initials(p.name)}
                </span>
                <div className="t">
                  <b className="trunc">{p.name}</b>
                  <span>
                    {p.count} {p.count > 1 ? "atendimentos" : "atendimento"} ·
                    último em {dateLabel(p.last).slice(0, 5)}
                  </span>
                </div>
                <I name="cr" />
              </button>
            ))}
            {!patients.length && (
              <div className="empty">
                Nenhum paciente atendido no período carregado.
              </div>
            )}
          </div>
        )}
      </div>
    );
  else if (tab === "acesso")
    body = (
      <div className="box">
        <h4>
          <I name="shield" />
          Perfil de acesso
        </h4>
        <div className="g2" style={{ gap: 16 }}>
          <div>
            <div className="fld">
              <label htmlFor="pessoa-perfil">Perfil</label>
              {owner ? (
                <>
                  <div
                    className="inp"
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <ProfileChip
                      perfil={perfil}
                      fallback={pessoa.perfilAcessoNome}
                    />
                    <span className="lock" style={{ marginLeft: "auto" }}>
                      <I name="lock" />
                      fixo
                    </span>
                  </div>
                  <div className="help">
                    O dono da clínica sempre tem acesso a tudo.
                  </div>
                </>
              ) : canManageUsers ? (
                <>
                  <select
                    id="pessoa-perfil"
                    className="inp"
                    value={draftPerfil}
                    onChange={(e) => setDraftPerfil(e.target.value)}
                  >
                    {perfisAcesso
                      .filter(
                        (p) => String(p.codigo || "").toUpperCase() !== "DONO",
                      )
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nome}
                          {profileType(p) === "tpl" ? " (modelo pronto)" : ""}
                        </option>
                      ))}
                  </select>
                  <div className="help">
                    É o perfil que decide o que {first} pode fazer. A troca vale
                    após salvar.
                  </div>
                </>
              ) : (
                <div
                  className="inp"
                  style={{ display: "flex", alignItems: "center" }}
                >
                  <ProfileChip
                    perfil={perfil}
                    fallback={pessoa.perfilAcessoNome}
                  />
                </div>
              )}
            </div>
            <div className="fld" style={{ marginTop: 14 }}>
              <label htmlFor="pessoa-cargo">Cargo na clínica</label>
              {canManageUsers && !owner ? (
                <select
                  id="pessoa-cargo"
                  className="inp"
                  value={draftRole}
                  onChange={(e) => setDraftRole(e.target.value)}
                >
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {formatCargoLabel(role.nome)}
                    </option>
                  ))}
                </select>
              ) : (
                <div
                  className="inp"
                  style={{ display: "flex", alignItems: "center" }}
                >
                  {formatCargoLabel(pessoa.roleName)}
                </div>
              )}
              <div className="help">
                Só o nome da função. Não muda o que a pessoa acessa.
              </div>
            </div>
            {canManageUsers && !owner && (
              <button
                className="btn-p"
                style={{ marginTop: 14 }}
                disabled={!accessDirty || saving}
                onClick={saveAccess}
              >
                {saving ? "Salvando…" : "Salvar acesso"}
              </button>
            )}
            {saveError && (
              <div className="help" role="alert">
                {saveError}
              </div>
            )}
            {accessDirty && (
              <div className="help">
                O resumo abaixo mostra o acesso atual, antes de salvar.
              </div>
            )}
            <div style={{ marginTop: 14 }}>
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
                      {!isSelf && (
                        <div className="help">
                          Somente o próprio Dono pode alterar estas opções.
                        </div>
                      )}
                      {agendaOptionError && (
                        <div role="alert" className="help">
                          {agendaOptionError}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {canSeeConfigPerfil &&
              canManageUsers &&
              !owner &&
              profileType(perfil) === "cli" && (
                <button
                  className="btn-g"
                  onClick={() => onEditarPerfil?.(perfil?.id)}
                >
                  <I name="pen" />
                  Ajustar o perfil {perfil?.nome}
                </button>
              )}
          </div>
          <div>
            <div className="acc">
              <div className="menu-prev">
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    color: "var(--app-muted)",
                    padding: "4px 8px 6px",
                  }}
                >
                  O menu de {first}
                </div>
                {menu.map((item) => (
                  <div
                    key={item.label}
                    className={`mi${item.on ? "" : " off"}`}
                  >
                    <I name={item.icon} />
                    {item.label}
                  </div>
                ))}
              </div>
              <div className="can" style={{ flex: 1, minWidth: 200 }}>
                <h5>
                  <span className={pessoa.apareceNaAgenda ? "ag-yes" : "ag-no"}>
                    <I name={pessoa.apareceNaAgenda ? "calok" : "caloff"} />
                    {pessoa.apareceNaAgenda ? "Atende na agenda" : "Não atende"}
                  </span>
                </h5>
                <div
                  className="help"
                  style={{ color: "var(--app-muted)", fontSize: 13 }}
                >
                  {pessoa.apareceNaAgenda
                    ? "Aparece na agenda e pode ter horários de atendimento."
                    : "Não aparece na agenda. Para atender, escolha um perfil que atende."}
                </div>
              </div>
            </div>
            {canDeleteUsers && !owner && pessoa.ativo !== false && (
              <div
                className="box"
                style={{
                  marginTop: 14,
                  borderColor: "#fecaca",
                  background: "#fffafa",
                }}
              >
                <h4 style={{ color: "#991b1b" }}>
                  <I name="lock" />
                  Desativar acesso
                </h4>
                <div
                  style={{
                    fontSize: 13,
                    color: "var(--app-muted)",
                    marginBottom: 8,
                  }}
                >
                  {first} deixa de entrar no sistema. O histórico e os
                  atendimentos continuam salvos.
                </div>
                <button
                  className="btn-d"
                  onClick={() => onDesativar?.(pessoa)}
                  style={{ border: "1px solid #fecaca" }}
                >
                  Desativar {first}
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
      {isSelf && showCadastroModal && (
        <UsuarioCadastroModal
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
              <span>{formatCargoLabel(pessoa.roleName)}</span>
              <span>·</span>
              <ProfileChip perfil={perfil} fallback={pessoa.perfilAcessoNome} />
              <span className={`st${pessoa.ativo === false ? " off" : ""}`}>
                {pessoa.ativo === false ? "Desativado" : "Ativo"}
              </span>
            </div>
          </div>
          <div className="ac">
            {isSelf && (
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
            {canManageUsers && !owner && (
              <button className="btn-s" onClick={() => setTab("acesso")}>
                <I name="shield" />
                Mudar acesso
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
      <div className="ptabs" role="tablist" aria-label="Informações da pessoa">
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
    </div>
  );
}
