import React, { useEffect, useState } from "react";
import { useOrg } from "../../contexts/OrgContext";
import { usePapel } from "../../hooks/usePapel";
import { useAgoraDaClinica } from "../hooks/useAgoraDaClinica.js";
import {
  agendasApi,
  perfilApi,
  permissoesApi,
  getApiErrorToastMessage,
} from "../../services/api";
import { ConfigTableSkeleton } from "../shared/ConfigPanelSkeletons";
import { effectiveProfilePermissions } from "./equipePrototypeUtils";
import EquipePessoaView from "./EquipePessoaView";

export function MeuPerfilConfigPanel({
  onBackToHub,
  onPerfilAtualizado,
  onNavigateAgenda,
  onSelectPatient,
  onDisponibilidadeInvalidate,
  onEquipeInvalidate,
}) {
  const {
    orgId,
    roleUserId,
    roleNome,
    papel,
    apareceNaAgenda,
    permissoes: permissionCodes = [],
    recarregarContextoOrg,
  } = useOrg();
  const {
    isDono,
    canManageUsers,
    canSeeAgenda,
    canSeeConfigPerfil,
    canSeeConfigAuditoria,
    canManageBloqueiosAgenda,
  } = usePapel();
  const { hojeIso, fuso } = useAgoraDaClinica(60000);
  const scope = `${orgId || ""}:${roleUserId || ""}`;
  const [profileState, setProfileState] = useState(null);
  const [permissionsState, setPermissionsState] = useState(null);
  const [agendaState, setAgendaState] = useState(null);
  const [reload, setReload] = useState(0);
  const [periodo, setPeriodo] = useState("mes");

  const profileKey = JSON.stringify([scope, reload]);
  const agendaKey = JSON.stringify([scope, hojeIso, periodo, reload]);

  useEffect(() => {
    if (!roleUserId) return;
    const controller = new AbortController();
    perfilApi
      .buscar({ signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted)
          setProfileState({ key: profileKey, data });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setProfileState({
            key: profileKey,
            error: getApiErrorToastMessage(
              error,
              "Não foi possível carregar seu cadastro.",
            ),
          });
      });
    return () => controller.abort();
  }, [profileKey, roleUserId]);

  useEffect(() => {
    if (!canSeeAgenda || !roleUserId || !hojeIso) return;
    const controller = new AbortController();
    const [year, month] = hojeIso.split("-").map(Number);
    const offset = periodo === "3m" ? 2 : periodo === "ano" ? month - 1 : 0;
    const first = new Date(Date.UTC(year, month - 1 - offset, 1));
    const start = `${first.getUTCFullYear()}-${String(first.getUTCMonth() + 1).padStart(2, "0")}-01`;
    const end = `${hojeIso.slice(0, 7)}-${String(new Date(Date.UTC(year, month, 0)).getUTCDate()).padStart(2, "0")}`;
    agendasApi
      .byRange(start, end, {
        signal: controller.signal,
        profissionalRoleUserId: roleUserId,
        excluirCancelado: true,
      })
      .then((data) => {
        if (!controller.signal.aborted)
          setAgendaState({
            key: agendaKey,
            data: Array.isArray(data) ? data : data?.content || [],
          });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setAgendaState({
            key: agendaKey,
            error: getApiErrorToastMessage(
              error,
              "Não foi possível carregar a agenda.",
            ),
          });
      });
    return () => controller.abort();
  }, [canSeeAgenda, roleUserId, hojeIso, periodo, agendaKey]);

  useEffect(() => {
    if (!roleUserId) return;
    const controller = new AbortController();
    permissoesApi
      .list({ signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted)
          setPermissionsState({
            key: profileKey,
            data: Array.isArray(data) ? data : data?.content || [],
          });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setPermissionsState({
            key: profileKey,
            error: getApiErrorToastMessage(
              error,
              "Não foi possível carregar as funções.",
            ),
          });
      });
    return () => controller.abort();
  }, [roleUserId, profileKey]);
  const permissions =
    permissionsState?.key === profileKey ? permissionsState : null;
  const catalog = permissions?.data || [];
  const selectedIds = catalog
    .filter((p) => permissionCodes.includes(p.codigo))
    .map((p) => p.permissaoId);
  const profilePermissions = effectiveProfilePermissions(
    { codigo: papel },
    selectedIds,
    catalog,
  );

  const profile = profileState?.key === profileKey ? profileState : null;
  const agenda = agendaState?.key === agendaKey ? agendaState : null;
  const handlePerfilAtualizado = (data) => {
    const fields = { ...data };
    delete fields.id;
    setProfileState((previous) =>
      previous?.key === profileKey
        ? { ...previous, data: { ...previous.data, ...fields } }
        : previous,
    );
    onPerfilAtualizado?.(fields);
  };

  return (
    <div className="prototype-equipe">
      {!roleUserId || !profile ? (
        <div role="status" aria-label="Carregando meu perfil">
          <ConfigTableSkeleton rows={5} cols={4} />
        </div>
      ) : profile.error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800"
        >
          <p>{profile.error}</p>
          <button
            type="button"
            className="btn-s mt-3"
            onClick={() => setReload((value) => value + 1)}
          >
            Tentar novamente
          </button>
        </div>
      ) : (
        <EquipePessoaView
          key={scope}
          pessoa={{
            ...profile.data,
            id: roleUserId,
            usuarioId: profile.data.id,
            roleName: roleNome || profile.data.cargoNome,
            perfilAcessoCodigo: papel,
            perfilAcessoNome: papel,
            apareceNaAgenda: profile.data.apareceNaAgenda ?? apareceNaAgenda,
            agendaMultiVer:
              profile.data.agendaMultiVer ??
              permissionCodes.includes("AGENDA_MULTI_VER"),
          }}
          isSelf
          onBack={onBackToHub}
          backLabel="Configurações"
          hideBreadcrumb={!onBackToHub}
          onPerfilAtualizado={handlePerfilAtualizado}
          orgId={orgId}
          perfil={{ codigo: papel, nome: papel }}
          permissoes={catalog}
          permissoesPerfil={profilePermissions}
          loadingPermissoes={!permissions}
          permissoesError={permissions?.error || ""}
          onRetryPermissoes={() => setReload((value) => value + 1)}
          canManageDisponibilidade={Boolean(isDono || canManageUsers || canManageBloqueiosAgenda)}
          onDisponibilidadeInvalidate={onDisponibilidadeInvalidate}
          onEquipeInvalidate={() => {
            recarregarContextoOrg?.();
            onEquipeInvalidate?.();
          }}
          onSelectPatient={onSelectPatient}
          agenda={agenda?.data || []}
          loadingAgenda={Boolean(canSeeAgenda && !agenda)}
          agendaError={agenda?.error || ""}
          hojeIso={hojeIso}
          fuso={fuso}
          canSeeAgenda={canSeeAgenda}
          canSeeConfigPerfil={canSeeConfigPerfil}
          canSeeConfigAuditoria={canSeeConfigAuditoria}
          onNavigateAgenda={onNavigateAgenda}
          onPeriodoChange={setPeriodo}
        />
      )}
    </div>
  );
}
