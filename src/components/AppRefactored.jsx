import React, { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

// Hooks de estado
import {
  useAuthState,
  usePatientState,
  useJourneyState,
  useProcedureCamera,
  useMapaAplicacaoState,
} from './hooks';
import { persistirMapaAplicacao } from '../utils/persistirMapaAplicacao.js';
import { usePatientsKpi } from './hooks/usePatientsKpi.js';

// Componentes de Autenticação
import { LoginForm } from './auth';
import { CompletarPerfil } from './auth/CompletarPerfil.jsx';
import { CadastrarClinica } from './auth/CadastrarClinica.jsx';
import { SelecionarClinica } from './auth/SelecionarClinica.jsx';

// Componentes de Layout
import { RoleGuard } from './auth/RoleGuard.jsx';
import { Sidebar, Stepper, MobileNavigation } from './layout';
import { GlobalHeader } from './layout/GlobalHeader.jsx';
import NotificacoesView from './notificacoes/NotificacoesView.jsx';

import { usePapel } from '../hooks/usePapel';
import { resolverPapel } from '../utils/authPayload';
import { useOrg } from '../contexts/OrgContext';
import { useToast } from '../contexts/useToast.js';
import {
  applyGroupActionAndRefresh,
  excludeInactiveForReagendarGroup,
  formatGroupActionResultMessage,
  resolveActionAppointments,
  resolveActionTargetFromDayAppointments,
  scheduleRowFromTarget,
} from '../utils/agendaGroupActions.js';
import { getEntryPrimaryAppointment } from '../utils/agendaDayInsights.js';
import {
  isAgendaVisibleOnDashboard,
  mapAgendaDtoToDashboardRow,
  normalizeApiList,
} from '../utils/agendaDashboardMapping.js';
import { resolveApiUrl } from '../config/apiEnv.js';
import { authHeadersForFetch } from '../services/api.js';
import {
  agendasApi,
  anamneseApi,
  catalogosApi,
  getApiErrorDetail,
  getApiErrorToastMessage,
  orientacoesApi,
  pacientesGaleriaApi,
  perfilApi,
  planejamentosApi,
  procedimentosApi,
  termoAssinaturaApi,
  termosApi,
} from '../services/api';
import { formatGaleriaLegendaForUpload, GALERIA_CATEGORIA } from '../utils/pacienteGaleria.js';
import { isRealUuid } from '../utils/planejamentoDraftUtils.js';
import { pickSessaoAtiva } from '../utils/planejamentoSessoes.js';
import { toLocalISODate } from '../utils/dateLimits.js';
import { convertToWebP } from '../utils/imageUtils.js';
import { evaluateProximoRetornoStep5 } from '../utils/proximoRetornoStep5.js';

import { PatientsView } from './patients';
import { ConfiguracoesView, GestaoUsuariosView } from './configuracoes';
import { UnsavedChangesModal } from './shared/UnsavedChangesModal';
import { AgendaDashboard } from './agenda';
import { AgendaFormModal } from './agenda/AgendaFormModal.jsx';
import { AgendaBloqueioModal } from './agenda/AgendaBloqueioModal.jsx';
import CancelarAgendaModal from './agenda/CancelarAgendaModal.jsx';
// ReagendarAgendaModal removido — substituído por AgendaFormModal em modo 'reagendar'.
import { IniciarAtendimentoToleranciaModal } from './agenda/IniciarAtendimentoToleranciaModal.jsx';
import { useAgendaPage } from './agenda/useAgendaPage.js';
import { DisponibilidadeRevisionProvider } from '../contexts/DisponibilidadeRevisionProvider.jsx';
import { ConfirmacaoPublicaPage } from './agenda/ConfirmacaoPublicaPage';
import { AnamnesePage } from '../pages/AnamnesePublica/AnamnesePage';
import { DocumentoPublicoPage } from '../pages/DocumentoPublico/DocumentoPublicoPage';
import { PublicSignatureFlow } from '../pages/PublicSignature/PublicSignatureFlow.jsx';
import { readStoredSection, persistSection, VALID_SECTIONS } from './configuracoes/configSectionStorage';
import { ProcedureCameraWidget } from './canvas';

// Componentes da Jornada (paciente na aba Pacientes; etapas 1–5)
import {
  Step2Anamnese,
  Step3Evaluation,
  Step3Termos,
  Step4Procedimento,
  Step5Finalization,
  JourneyPatientContextHeader,
} from './journey';
import {
  ConsultaHub,
  ConsultaModuleHeader,
  ConsultaViewShell,
  ConsultaProcedimentoFlow,
  ConsultaAvaliacaoFlow,
  ConsultaRetornoFlow,
  ConsultaRetornoOrigemModal,
  formatRetornoAvaliacaoTexto,
  ConsultaEncerrarFooter,
  ConsultaEncerrarConfirmModal,
  getEncerrarConsultaMessage,
} from './consulta';
import { PlanosTab } from './planos';
import { JourneyPhotoAnnotationEditor } from './journey/JourneyPhotoAnnotationEditor.jsx';
import {
  normalizeOrientacoesTemplateResponse,
  orientacoesTemplateSignature,
} from '../utils/orientacoesJourney.js';

// Utilitarios
import { getPatientInitials } from './utils';
import { toDateKey } from '../utils/agendaDateUtils';
import {
  MARGEM_TECNICA_MIN,
  parseSlotLocalDateTime,
  diffScheduledMinusNowMinutes,
  formatClockHHMM,
  formatAntecedenciaText,
  formatAtrasoText,
  formatNowHHMM,
} from '../utils/agendaStartTolerance.js';

function normalizeTermosList(raw) {
  if (Array.isArray(raw)) return raw;
  if (raw && Array.isArray(raw.content)) return raw.content;
  return [];
}

function isTermoAtivoRow(row) {
  if (!row || typeof row !== 'object') return false;
  if (row.ativo === false || row.active === false) return false;
  if (row.ativo === true || row.active === true) return true;
  const s = String(row.status || '').toUpperCase();
  if (s === 'INATIVO' || s === 'INACTIVE') return false;
  return true;
}

/** Mapeamento legado initialStep → consultaModule (compat. agenda / call sites antigos). */
const LEGACY_STEP_TO_MODULE = { 1: 'anamnese', 2: 'avaliacao', 3: 'termos', 4: 'procedimento' };

function revokeBlobUrlIfAny(url) {
  if (url == null || typeof url !== 'string') return;
  if (!url.startsWith('blob:')) return;
  setTimeout(() => {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  }, 1000);
}

function AppRefactoredInner() {
  const { roleUserId, setRoleUserId, setOrgId, orgId, setPapel, setRoleNome, roleNome, setPermissoes } = useOrg();
  const {
    isAdmin: _isAdmin,
    isProfissional: _isProfissional,
    isRecepcionista,
    isAtLeast: _isAtLeast,
    canSeeConfig,
    canSeeConfigAnamnese,
    canSeeConfigProcedimentos,
    canSeeConfigTermos,
    canSeeConfigPerfil,
    canSeeConfigClinica,
    canSeeConfigAgenda,
    canSeeConfigEquipe,
  } = usePapel();
  const toast = useToast();
  // ============ ESTADO GLOBAL ============
  const authState = useAuthState({ setRoleUserId, setOrgId });
  /** null = deslogado ou pendente; checking = carregando gates; profile | cadastrar-clinica | clinic | ready = pós-login */
  const [postLoginGate, setPostLoginGate] = React.useState(null);
  const authSessionReady = authState.authReady && authState.isLoggedIn && postLoginGate === 'ready';

  React.useEffect(() => {
    if (!authState.isLoggedIn) {
      if (typeof setRoleNome === 'function') setRoleNome('');
    }
  }, [authState.isLoggedIn, setRoleNome]);

  React.useEffect(() => {
    if (!authState.isLoggedIn || !authState.authUser) {
      setPostLoginGate(null);
      return;
    }
    // Só após getSession() em useAuthState — accessToken e sessionStorage prontos para Bearer
    if (!authState.authReady) {
      return;
    }
    let cancelled = false;
    setPostLoginGate('checking');
    (async () => {
      try {
        const meRes = await fetch(resolveApiUrl('/api/auth/me'), {
          credentials: 'include',
          headers: { ...(await authHeadersForFetch({ needsOrg: false })) },
        });
        const meJson = await meRes.json().catch(() => ({}));
        if (cancelled) return;
        if (!meRes.ok) {
          if (meRes.status === 404) {
            setPostLoginGate('profile'); // usuário não completou o perfil ainda
            return;
          }
          if (meRes.status === 403) {
            toast.error('Sua conta está desativada. Entre em contato com o administrador.');
            handleLogout();
            return;
          }
          setPostLoginGate('ready'); // outros erros, deixa passar
          return;
        }
        const nome =
          meJson?.nomeCompleto ??
          meJson?.nome_completo ??
          meJson?.user?.nomeCompleto ??
          meJson?.user?.nome_completo;
        if (!nome || !String(nome).trim()) {
          setPostLoginGate('profile');
          return;
        }
        const roleId = meJson?.roleUserId ?? meJson?.role_user_id ?? null;
        if (roleId && typeof setRoleUserId === 'function') {
          setRoleUserId(String(roleId));
        }
        const roleNome = meJson?.perfilAcessoCodigo ?? meJson?.perfil_acesso_codigo ?? meJson?.role?.nome ?? meJson?.role_nome ?? meJson?.role ?? null;
        if (typeof setRoleNome === 'function') {
          setRoleNome(roleNome != null ? String(roleNome) : '');
        }
        if (typeof setPapel === 'function') {
          setPapel(resolverPapel(roleNome));
        }
        if (typeof setPermissoes === 'function') {
          setPermissoes(meJson?.permissoes || []);
        }
        const orgRes = await fetch(resolveApiUrl('/api/v1/organizacoes/minhas'), {
          credentials: 'include',
          headers: { ...(await authHeadersForFetch({ needsOrg: true })) },
        });
        const orgJson = await orgRes.json().catch(() => ({}));
        if (cancelled) return;
        const list = Array.isArray(orgJson) ? orgJson : orgJson?.content ?? orgJson?.organizacoes ?? orgJson?.data ?? [];
        const arr = Array.isArray(list) ? list : [];
        if (arr.length === 1) {
          const id = arr[0]?.id ?? arr[0]?.organizacaoSaudeId;
          if (id) setOrgId(String(id), arr[0]?.slug || '');
          const clinicaRes = await fetch(resolveApiUrl('/api/v1/clinica'), {
            credentials: 'include',
            headers: { ...(await authHeadersForFetch({ needsOrg: true })) },
          });
          if (clinicaRes.ok) {
            const clinicaJson = await clinicaRes.json().catch(() => ({}));
            const nomeClinica = clinicaJson?.nome || clinicaJson?.nomeFantasia || '';
            const logoRaw = clinicaJson?.logoUrl ?? clinicaJson?.logo_url;
            const logoUrl = typeof logoRaw === 'string' ? logoRaw.trim() : '';
            
            let endCompleto = String(clinicaJson?.enderecoLogradouro ?? clinicaJson?.endereco ?? clinicaJson?.logradouro ?? '').trim();
            if (clinicaJson?.enderecoNumero) endCompleto += `, ${clinicaJson.enderecoNumero}`;
            if (clinicaJson?.enderecoCidade) endCompleto += ` - ${clinicaJson.enderecoCidade}`;
            if (clinicaJson?.enderecoEstado) endCompleto += `/${clinicaJson.enderecoEstado}`;

            if (nomeClinica || logoUrl || clinicaJson) {
              setClinicaInfo((prev) => ({
                ...prev,
                ...(nomeClinica ? { nome: nomeClinica, subtitulo: 'Harmonização Premium' } : {}),
                ...(logoUrl ? { logoUrl } : {}),
                endereco: endCompleto,
                telefone: String(clinicaJson?.telefone ?? clinicaJson?.celular ?? '').trim(),
                cnpj: String(clinicaJson?.cnpj ?? '').trim(),
                slug: String(clinicaJson?.slug ?? '').trim(),
              }));
            }
          }
          setPostLoginGate('ready');
          return;
        }
        if (arr.length === 0) {
          setPostLoginGate('cadastrar-clinica');
          return;
        }
        setPostLoginGate('clinic');
      } catch {
        if (!cancelled) setPostLoginGate('ready');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authState.isLoggedIn, authState.authUser?.id, authState.authReady, setOrgId]);
  const patientState = usePatientState({ authEnabled: authSessionReady });
  const journeyState = useJourneyState();
  const mapaAplicacaoState = useMapaAplicacaoState();
  /** Data local (YYYY-MM-DD) do início do atendimento — limite mínimo para “próximo retorno”. */
  const [journeyProcedureDateIso, setJourneyProcedureDateIso] = useState(() => toLocalISODate());
  /** Sincronizado com Step2: false quando a ficha tem perguntas (bloco queixa oculto). */
  const [queixaVisivel, setQueixaVisivel] = useState(true);
  const [step1Busy, setStep1Busy] = useState(false);
  /** Procedimento já registrado no Step 4, quando existir (na etapa 3 costuma ser null). */
  const [loteProcedimentosFeitosIds, setLoteProcedimentosFeitosIds] = React.useState([]);
  /** Array com IDs das assinaturas persistidas no Step 3 (para vincular ao procedimento no finalizar). */
  const [assinaturasRealizadasIds, setAssinaturasRealizadasIds] = React.useState([]);

  const handleTermoAssinaturaSalva = React.useCallback((assinaturaObj) => {
    if (assinaturaObj?.id) {
      setAssinaturasRealizadasIds((prev) => [...prev, assinaturaObj.id]);
    }
  }, []);
  /** Largura atual da sidebar (64 ou 220) para alinhar barras fixas e fullscreen da avaliação. */
  const [sidebarRailWidthPx, setSidebarRailWidthPx] = useState(220);
  const [clinicaInfo, setClinicaInfo] = useState({
    nome: 'Procedi',
    subtitulo: 'Harmonização Premium',
    logoUrl: '',
  });
  const [perfilInfo, setPerfilInfo] = useState({ nomeCompleto: '', fotoUrl: '' });
  const [configSection, setConfigSectionState] = useState(readStoredSection);
  const [notifVersion, setNotifVersion] = useState(0);
  const [journeyTermoTitulo, setJourneyTermoTitulo] = React.useState('');
  const [journeyTermoConteudo, setJourneyTermoConteudo] = React.useState('');
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const anamneseRef = useRef(null);
  /** Vista alvo ao confirmar foto da câmera no step 2 (mapeamento). */
  const mapeamentoCaptureVistaRef = useRef(null);
  const [pendingMapeamentoCapture, setPendingMapeamentoCapture] = React.useState(null);
  /** Vista alvo ao confirmar foto da câmera no step 4 (mapa de aplicação). */
  const mapaAplicacaoCaptureVistaRef = useRef(null);
  const [pendingMapaAplicacaoCapture, setPendingMapaAplicacaoCapture] = React.useState(null);
  /** Id do preenchimento retornado por `createPaciente` (PATCH de observações ao finalizar). */
  const anamnesePreenchimentoIdRef = useRef(null);
  /** Último paciente resolvido na jornada — mantém header quando catálogo/search está temporariamente vazio. */
  const pacienteAtualRef = useRef(null);
  /** Evita duplo clique em “Finalizar”. */
  const finishJourneyLockRef = useRef(false);
  const [isSalvandoFotosAvaliacao, setIsSalvandoFotosAvaliacao] = React.useState(false);
  const [isSalvandoRetorno, setIsSalvandoRetorno] = React.useState(false);
  const [isSalvandoProcedimento] = React.useState(false);
  const [sugestaoProcedimentoEnviada, setSugestaoProcedimentoEnviada] = React.useState(false);
  /** Rastreia ultimo pacienteId para resetar anamnese ao trocar paciente. undefined = primeiro mount. */
  const prevJourneyPacienteIdRef = useRef(undefined);
  /** JPEGs anotados (avaliação) enfileirados até existir procedimentoFeitoId no finalizar. */
  const pendingAnnotatedGalleryBlobsRef = useRef([]);
  const finishJourneyModalResolveRef = useRef(null);
  const [finishJourneyModal, setFinishJourneyModal] = React.useState(null);

  const askFinishJourneyConfirm = React.useCallback(
    ({ title, message, confirmLabel = 'Sim', cancelLabel = 'Não' }) =>
      new Promise((resolve) => {
        finishJourneyModalResolveRef.current = resolve;
        setFinishJourneyModal({ title, message, confirmLabel, cancelLabel });
      }),
    [],
  );

  const closeFinishJourneyModal = React.useCallback((value) => {
    const fn = finishJourneyModalResolveRef.current;
    finishJourneyModalResolveRef.current = null;
    setFinishJourneyModal(null);
    if (typeof fn === 'function') fn(Boolean(value));
  }, []);

  // ============ Estados destructurados para facilitar leitura ============
  const { authReady, isLoggedIn, authUser, handleLogout } = authState;
  const { currentStep, setCurrentStep, isFinishing, setIsFinishing, journeyId } = journeyState;
  const {
    patients,
    setPatients,
    selectedPatientCpf,
    setSelectedPatientCpf,
    patientView,
    setPatientView,
    patientDetailTab,
    setPatientDetailTab,
    patientSearchQuery,
    setPatientSearchQuery,
    refreshPatients: fetchPatientsCatalog,
    mergePatientById,
    patientListItems,
    patientListPage,
    setPatientListPage,
    patientListLoading,
    patientListMeta,
    patientListSortBy,
    setPatientListSortBy,
    bumpPatientList,
    patientListBump,
    statusPlanoFilter,
    setStatusPlanoFilter,
    anamneseDesatualizadaFilter,
    setAnamneseDesatualizadaFilter,
    semRetornoFilter,
    setSemRetornoFilter,
    ehNovoFilter,
    setEhNovoFilter,
    ehAniversarianteFilter,
    setEhAniversarianteFilter,
    patientQuickFilter,
    setPatientQuickFilter,
    captureProfileNavSnapshot,
    navigateProfilePatient,
    profileNav,
    clearProfileNavSnapshot,
  } = patientState;

  const kpiState = usePatientsKpi({ authEnabled: authSessionReady, bump: patientListBump });

  const agendaSchedule = useAgendaPage({ patients, authEnabled: authSessionReady });

  const buildAgendaPacienteFromRecord = React.useCallback((p) => {
    if (!p?.id) return null;
    return {
      id: p.id,
      nome: p.nome,
      telefone:
        p.telefone ||
        p.phone ||
        p.telefoneNumero ||
        p.telefonePrincipal ||
        '',
    };
  }, []);

  const handleAgendarPlanoItem = React.useCallback(
    (paciente, item, onSaved) => {
      if (!paciente?.id || !roleUserId || !item?.catalogoProcedimentoSaudeId) return;
      const catId = String(item.catalogoProcedimentoSaudeId).trim();
      const planejamentoItemId = String(item.planejamentoItemId ?? item.id ?? '').trim();
      if (!isRealUuid(planejamentoItemId)) {
        toast.error('Salve o plano antes de agendar este procedimento.');
        return;
      }
      agendaSchedule.openCreateModalForPatient(buildAgendaPacienteFromRecord(paciente), {
        catalogoProcedimentoSaudeIds: [catId],
        planejamentoItemId,
        planejamentoItemIdPorCatalogo: {
          [catId]: planejamentoItemId,
        },
        profissionalRoleUserId: roleUserId,
        onAgendaSaved: onSaved,
      });
    },
    [agendaSchedule, buildAgendaPacienteFromRecord, roleUserId, toast],
  );

  const handleAgendarRetornoPlanoItem = React.useCallback(
    (paciente, item, onSaved) => {
      if (!paciente?.id || !roleUserId) return;
      const planejamentoItemId = String(item.planejamentoItemId ?? item.id ?? '').trim();
      if (!isRealUuid(planejamentoItemId)) {
        toast.error('Salve o plano antes de agendar retorno deste procedimento.');
        return;
      }
      agendaSchedule.openCreateModalForPatient(buildAgendaPacienteFromRecord(paciente), {
        modoRetorno: true,
        planejamentoItemId,
        retornoOrigemNome: String(item.catalogoNome ?? '').trim() || 'Procedimento',
        retornoDataPlanejada: item.dataPlanejada ?? null,
        profissionalRoleUserId: roleUserId,
        onAgendaSaved: onSaved,
      });
    },
    [agendaSchedule, buildAgendaPacienteFromRecord, roleUserId, toast],
  );

  const handleConcluirPlanoComRetorno = React.useCallback(
    (paciente, plano, onPlanoRefresh) => {
      if (!paciente?.id || !roleUserId || !plano?.id) return;
      agendaSchedule.openCreateModalForPatient(buildAgendaPacienteFromRecord(paciente), {
        modoRetorno: true,
        profissionalRoleUserId: roleUserId,
        onAgendaSaved: async () => {
          await planejamentosApi.alterarStatus(plano.id, { codigo: 'concluido' });
          await onPlanoRefresh?.();
        },
      });
    },
    [agendaSchedule, buildAgendaPacienteFromRecord, roleUserId],
  );

  const handleReagendarPlanoItem = React.useCallback(
    async (paciente, item, plano, onPlanoRefresh) => {
      if (!paciente?.id || !plano?.id || !item?.id) return;
      let sessao = item.sessaoAtiva;
      if (!sessao?.agendaId) {
        try {
          const detalhe = await planejamentosApi.detalhe(plano.id);
          const rawItem = (detalhe?.itens ?? []).find(
            (i) => String(i.planejamentoItemId ?? i.id) === String(item.id),
          );
          sessao = pickSessaoAtiva(rawItem?.sessoes ?? []);
        } catch (e) {
          console.warn('[handleReagendarPlanoItem] Falha ao carregar detalhe do plano:', e);
          return;
        }
      }
      if (!sessao?.agendaId) return;
      const catId = String(
        item.catalogoId ??
          item.catalogoProcedimentoSaudeId ??
          sessao.catalogoProcedimentoSaudeId ??
          '',
      ).trim();
      const appointment = {
        agendaId: sessao.agendaId,
        id: sessao.agendaId,
        data: sessao.dataAgendamento ? String(sessao.dataAgendamento).slice(0, 10) : '',
        horaInicio: sessao.horaInicio ? String(sessao.horaInicio).slice(0, 5) : '',
        pacienteId: String(paciente.id),
        pacienteNome: paciente.nome || '',
        telefone:
          paciente.telefone ||
          paciente.phone ||
          paciente.telefoneNumero ||
          paciente.telefonePrincipal ||
          '',
        catalogoProcedimentoSaudeId: catId,
        profissionalRoleUserId: sessao.profissionalRoleUserId ?? roleUserId,
        planejamentoItemId: item.id,
      };
      agendaSchedule.openReagendarModal(appointment, [appointment], {
        onAgendaSaved: async () => {
          await onPlanoRefresh?.();
        },
      });
    },
    [agendaSchedule, roleUserId],
  );

  const [scheduleCancelRow, setScheduleCancelRow] = React.useState(null);
  const [scheduleCancelSubmitting, setScheduleCancelSubmitting] = React.useState(false);
  const [iniciarTolModal, setIniciarTolModal] = React.useState(null);
  const [iniciarTolAdiantarSubmitting, setIniciarTolAdiantarSubmitting] = React.useState(false);

  const handleScheduleConfirmCancelar = React.useCallback(
    async (payload) => {
      const row = scheduleCancelRow?.agenda;
      const group = scheduleCancelRow?.groupAppointments;
      if (!row?.agendaId || !payload) {
        if (import.meta.env.DEV) {
          console.warn('[handleScheduleConfirmCancelar] payload inválido', { row, payload });
        }
        return;
      }
      setScheduleCancelSubmitting(true);
      try {
        if (Array.isArray(group) && group.length > 1) {
          const result = await applyGroupActionAndRefresh(
            group,
            (item) =>
              agendaSchedule.handleCancelar(item.agendaId, payload, {
                successToast: false,
                skipDashboardRefresh: true,
              }),
            agendaSchedule.refreshDashboard,
          );
          const partialMsg = formatGroupActionResultMessage(result, { verb: 'canceladas' });
          if (result.allOk) {
            toast.success(`${group.length} agendamentos cancelados`);
            setScheduleCancelRow(null);
          } else if (result.succeeded.length > 0) {
            toast.error(partialMsg || 'Cancelamento parcial');
            setScheduleCancelRow(null);
          }
          return;
        }
        const ok = await agendaSchedule.handleCancelar(row.agendaId, payload);
        if (ok) setScheduleCancelRow(null);
      } finally {
        setScheduleCancelSubmitting(false);
      }
    },
    [agendaSchedule, scheduleCancelRow, toast],
  );

  const handleSlotReagendar = React.useCallback(
    async (target) => {
      const row = scheduleRowFromTarget(target) || (target?.agendaId ? { agenda: target } : null);
      if (!row?.agenda) return;
      const appointment = row.agenda;
      const groupFromTarget = row.groupAppointments;
      if (Array.isArray(groupFromTarget) && groupFromTarget.length > 1) {
        const grupo = excludeInactiveForReagendarGroup(groupFromTarget);
        const primary = grupo[0] || appointment;
        agendaSchedule.openReagendarModal(primary, grupo.length > 0 ? grupo : [appointment]);
        return;
      }
      try {
        const raw = await agendasApi.byDate(appointment.data);
        const mappedRows = normalizeApiList(raw)
          .map(mapAgendaDtoToDashboardRow)
          .filter(Boolean)
          .filter(isAgendaVisibleOnDashboard);
        const activePool = excludeInactiveForReagendarGroup(mappedRows);
        const resolved = resolveActionTargetFromDayAppointments(activePool, appointment);
        const grupo = resolveActionAppointments(resolved);
        const primary = getEntryPrimaryAppointment(resolved) || appointment;
        agendaSchedule.openReagendarModal(primary, grupo.length > 0 ? grupo : [appointment]);
      } catch (e) {
        console.warn('[handleSlotReagendar] Falha ao detectar grupo, abrindo reagendar individual:', e);
        agendaSchedule.openReagendarModal(appointment, [appointment]);
      }
    },
    [agendaSchedule],
  );

  const refreshPatientsAndPagedList = React.useCallback(() => {
    fetchPatientsCatalog();
    bumpPatientList();
  }, [fetchPatientsCatalog, bumpPatientList]);

  // Sincroniza Pacientes quando agenda muda (criar/cancelar/reagendar)
  React.useEffect(() => {
    if (!authSessionReady) return;
    refreshPatientsAndPagedList();
  }, [agendaSchedule.appointments, authSessionReady, refreshPatientsAndPagedList]);

  const pacienteAtual = React.useMemo(() => {
    const sCpf = String(selectedPatientCpf || '').trim();
    if (!sCpf) {
      pacienteAtualRef.current = null;
      return null;
    }
    const matchCpf = (p) => p && String(p?.cpf || '').trim() === sCpf;
    const found =
      patients.find(matchCpf) ??
      (Array.isArray(patientListItems) ? patientListItems.find(matchCpf) : null) ??
      null;
    if (found) {
      pacienteAtualRef.current = found;
      return found;
    }
    const pinned = pacienteAtualRef.current;
    if (pinned && matchCpf(pinned)) return pinned;
    pacienteAtualRef.current = null;
    return null;
  }, [patients, patientListItems, selectedPatientCpf]);

  // moved to line 683 below cameraState

  const step5RetornoBloqueiaFinal = React.useMemo(
    () =>
      evaluateProximoRetornoStep5(
        journeyProcedureDateIso,
        journeyState.proximoRetornoDisplay
      ).blocksFinish,
    [journeyProcedureDateIso, journeyState.proximoRetornoDisplay]
  );

  const cameraState = useProcedureCamera({
    currentStep,
    journeyId,
    setJourneyId: journeyState.setJourneyId,
    selectedPatientCpf,
    cpf: pacienteAtual?.cpf || '',
    setPatients,
  });

  // Reseta estado de anamnese ao trocar de paciente para evitar vazamento de draft entre pacientes
  React.useEffect(() => {
    const newId = pacienteAtual?.id ?? null;
    const prevId = prevJourneyPacienteIdRef.current;
    prevJourneyPacienteIdRef.current = newId;
    if (prevId === undefined) return; // primeiro mount — nao resetar
    if (prevId === newId) return; // mesmo paciente (ex: lista atualizou)
    journeyState.setQueixa('');
    journeyState.setExpectativas('');
    journeyState.setStep2AnamneseDraft({
      pacienteId: newId,
      fichaSelecionadaId: '',
      fichaDropdownNovo: '',
      respostas: {},
      preenchimentoAnterior: null,
      modoVisualizacao: false,
    });
    journeyState.setRespostasAnamnese({});
    journeyState.setStep2Errors({});
    journeyState.setStep2PerfilClinicoDraft(null);
    journeyState.setObservacoesExecucao('');
    journeyState.setNomeProcedimento('');
    journeyState.setProcedimentosSessao([]);
    setProcedimentosLote([]);
    setLoteProcedimentosFeitosIds([]);
    journeyState.setAgendaId(null);
    journeyState.setEvaluationAnnotatedPhotoUrl(null);
    cameraState.resetEvaluationPhotos();
    cameraState.resetProcedureCapturedPhotos();
    cameraState.setAnamnesePhotoUrl(null);
    cameraState.setAnamnesePhotoBlob(null);
    cameraState.setAnamnesePhotoMeta(null);
    
    // Clear refs and state to prevent cross-patient corruption
    anamnesePreenchimentoIdRef.current = null;
    pendingAnnotatedGalleryBlobsRef.current = [];
    journeyState.setTermoSelecionadoId(null);
    setAssinaturasRealizadasIds([]);
    journeyState.setJourneyPlanejamentoCtx(null);
    if (typeof mapaAplicacaoState?.resetMapa === 'function') {
      mapaAplicacaoState.resetMapa();
    }
    mapeamentoCaptureVistaRef.current = null;
    setPendingMapeamentoCapture(null);
    mapaAplicacaoCaptureVistaRef.current = null;
    setPendingMapaAplicacaoCapture(null);
    journeyState.setTermoLido(false);
    journeyState.setTermoAssinado(false);
    journeyState.setTermoAssinaturaDataUrl('');
    journeyState.setProfissionalAssinaturaDataUrl('');
    journeyState.setOrientacoesItens([]);
    journeyState.setOrientacoesCarregadas(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pacienteAtual?.id]);

  const handleSelectCapturedPhoto = (idx) => {
    const photo = cameraState.evaluationCapturedPhotos[idx];
    if (!photo?.url) return;

    cameraState.setEvaluationSelectedPhotoIndex(idx);
    journeyState.setImageSrc(photo.url);
    journeyState.setPaths([]);
    journeyState.setEvaluationAnnotatedPhotoUrl(null);
  };

  /** Grava na lista da câmera o JPEG já com desenho (etapa 3), para LGPD/galeria usarem a mesma imagem. */
  const handleAnnotatedCaptureSaved = ({ index, newUrl, blob }) => {
    cameraState.replaceEvaluationCapturedPhotoAt(index, { url: newUrl, blob });
    journeyState.setImageSrc(newUrl);
    journeyState.setPaths([]);
  };

  const handleConfirmProcedurePhoto = () => {
    const skipMapeamentoCapture =
      activeView === 'consulta' && consultaModule === 'avaliacao';

    if (currentStep === 2 && mapeamentoCaptureVistaRef.current && !skipMapeamentoCapture) {
      const vista = mapeamentoCaptureVistaRef.current;
      const blob = cameraState.photoPreviewBlob;
      if (blob) {
        setPendingMapeamentoCapture({ vista, blob });
      }
      mapeamentoCaptureVistaRef.current = null;
      cameraState.closePhotoModal();
      return;
    }

    if (currentStep === 4 && mapaAplicacaoCaptureVistaRef.current) {
      const vista = mapaAplicacaoCaptureVistaRef.current;
      const blob = cameraState.photoPreviewBlob;
      if (blob) {
        setPendingMapaAplicacaoCapture({ vista, blob });
      }
      mapaAplicacaoCaptureVistaRef.current = null;
      cameraState.closePhotoModal();
      return;
    }

    const isConsultaProcedimento =
      activeView === 'consulta' && consultaModule === 'procedimento';
    if (isConsultaProcedimento && mapaAplicacaoCaptureVistaRef.current) {
      const vista = mapaAplicacaoCaptureVistaRef.current;
      const blob = cameraState.photoPreviewBlob;
      if (blob) {
        setPendingMapaAplicacaoCapture({ vista, blob });
      }
      mapaAplicacaoCaptureVistaRef.current = null;
      cameraState.closePhotoModal();
      return;
    }

    const previewUrl = cameraState.photoPreviewUrl;
    cameraState.confirmPhoto();

    if (previewUrl) {
      journeyState.setImageSrc(previewUrl);
      journeyState.setPaths([]);
      journeyState.setEvaluationAnnotatedPhotoUrl(null);
    }
  };

  const handlePrepareMapeamentoCapture = React.useCallback((vistaCodigo) => {
    mapeamentoCaptureVistaRef.current = vistaCodigo;
  }, []);

  const handlePrepareMapaAplicacaoCapture = React.useCallback((vistaCodigo) => {
    mapaAplicacaoCaptureVistaRef.current = vistaCodigo;
  }, []);

  const resolvePlanejamentoItemId = React.useCallback(
    (catalogoId) => {
      const cat = catalogoId != null ? String(catalogoId).trim() : '';
      if (!cat) return null;
      const ctx = journeyState.journeyPlanejamentoCtx;
      return ctx?.itemIdByCatalogo?.[cat] ?? null;
    },
    [journeyState.journeyPlanejamentoCtx],
  );

  const persistirMapaAplicacaoAtual = React.useCallback(
    async (procedimentoFeitoId, paciente, explicitSnapshot = null, explicitFotos = null, explicitCatalogoId = null) => {
      const pid = String(procedimentoFeitoId || '').trim();
      if (!pid) return { ok: false };
      const snapshot = explicitSnapshot || mapaAplicacaoState.getSnapshotForPersist();
      const fotosPorVista = explicitFotos || snapshot.fotosPorVista || {};
      const hasDirty =
        Array.isArray(snapshot.dirtyVistas) && snapshot.dirtyVistas.length > 0;
      const hasContent =
        Object.keys(fotosPorVista || {}).length > 0 ||
        Object.values(snapshot.pontosPorVista || {}).some((l) => Array.isArray(l) && l.length > 0);
      if (!hasDirty && !hasContent) return { ok: true, erros: [] };

      const catId = explicitCatalogoId || journeyState.nomeProcedimentoCatalogoId;

      const resultado = await persistirMapaAplicacao({
        pacienteId: paciente.id,
        roleUserId,
        procedimentoFeitoId,
        catalogoProcedimentoSaudeId: catId,
        snapshot,
      });
      if (resultado.ok) {
        mapaAplicacaoState.clearAllDirty();
      } else if (resultado.erros?.length) {
        toast.warning(`Mapa de aplicação: ${resultado.erros.join(' · ')}`);
      }
      return resultado;
    },
    [
      journeyState.nomeProcedimentoCatalogoId,
      mapaAplicacaoState,
      roleUserId,
      toast,
    ],
  );

  /** Editor fullscreen compartilhado (procedimento / resumo etapa 5). */
  const [photoAnnotationScope, setPhotoAnnotationScope] = React.useState(null);
  const [photoAnnotationIndex, setPhotoAnnotationIndex] = React.useState(null);

  const closeJourneyPhotoAnnotation = React.useCallback(() => {
    setPhotoAnnotationScope(null);
    setPhotoAnnotationIndex(null);
    journeyState.setPaths([]);
    journeyState.setIsHoveringCanvas(false);
    journeyState.setCursorPos({ x: -100, y: -100 });
    journeyState.setIsDrawing(false);
  }, [journeyState]);

  const openProcedurePhotoAnnotation = React.useCallback(
    (idx) => {
      const list = cameraState.procedureCapturedPhotos || [];
      const ph = list[idx];
      if (!ph?.url) return;
      setPhotoAnnotationScope('procedure');
      setPhotoAnnotationIndex(idx);
      journeyState.setImageSrc(ph.url);
      journeyState.setPaths([]);
      journeyState.setEvaluationAnnotatedPhotoUrl(null);
    },
    [cameraState.procedureCapturedPhotos, journeyState]
  );

  const openEvaluationPhotoAnnotationFromSummary = React.useCallback(
    (idx) => {
      const list = cameraState.evaluationCapturedPhotos || [];
      const ph = list[idx];
      if (!ph?.url) return;
      setPhotoAnnotationScope('evaluation');
      setPhotoAnnotationIndex(idx);
      cameraState.setEvaluationSelectedPhotoIndex(idx);
      journeyState.setImageSrc(ph.url);
      journeyState.setPaths([]);
      journeyState.setEvaluationAnnotatedPhotoUrl(null);
    },
    [cameraState.evaluationCapturedPhotos, cameraState, journeyState]
  );

  const openEvaluationPhotoAnnotationForConsulta = React.useCallback(
    (idx) => {
      journeyState.setShowPointNumbers(false);
      openEvaluationPhotoAnnotationFromSummary(idx);
    },
    [journeyState, openEvaluationPhotoAnnotationFromSummary]
  );

  // ============ FUNÇÕES DE NAVEGAÇÃO ============
  const [consultaModule, setConsultaModule] = React.useState(null);
  const [retornoAvulsoPickerOpen, setRetornoAvulsoPickerOpen] = React.useState(false);
  const [encerrarConsultaOpen, setEncerrarConsultaOpen] = React.useState(false);
  const [finishingMode, setFinishingMode] = React.useState(null);
  
  // --- Lote de Procedimentos ---
  const [procedimentosLote, setProcedimentosLote] = React.useState([]);
  // O índice do procedimento ativo foi movido para o useJourneyState para manter tudo em sincronia.
  
  // null | 'hub' | 'anamnese' | 'avaliacao' | 'planejamento' | 'termos' | 'procedimento'

  const [activeView, _setActiveView] = React.useState(() => {
    try {
      const v = sessionStorage.getItem('activeView');
      // @deprecated — substituído por activeView:'consulta'. Remover na v2 após confirmar que nenhum call site usa 'jornada'.
      if (v === 'jornada' || v === 'consulta') return 'pacientes';
      if (v === 'anamnese' || v === 'termos') {
        sessionStorage.setItem('activeView', 'configuracoes');
        return 'configuracoes';
      }
      return v || 'pacientes';
    } catch {
      return 'pacientes';
    }
  });
  const [previousView, setPreviousView] = React.useState(null);
  const setActiveView = React.useCallback((view) => {
    _setActiveView((prev) => {
      const next = typeof view === 'function' ? view(prev) : view;
      try {
        if (next) sessionStorage.setItem('activeView', String(next));
        else sessionStorage.removeItem('activeView');
      } catch {
        // ignore
      }
      return next;
    });
  }, []);
  const goToView = (view) => {
    // Verificacao de segurança na troca de view
    if (view === 'configuracoes' && !canSeeConfig) {
      toast.error('Você não tem permissão para acessar as configurações.');
      return;
    }
    if (view === 'gestao-equipe' && !canSeeConfigEquipe) {
      toast.error('Você não tem permissão para acessar a Gestão de Equipe.');
      return;
    }
    if (view === 'configuracoes') {
      setConfigSectionState(null);
    }
    setActiveView(view);
  };

  // ── Guard de alterações não salvas no Horário de Atendimento ───────────────
  const [isDirtyHorarios, setIsDirtyHorarios] = React.useState(false);
  const [isUnsavedNavModalOpen, setIsUnsavedNavModalOpen] = React.useState(false);
  const pendingNavAction = useRef(null);

  /**
   * Substitui goToView nos call sites que podem ocorrer enquanto o usuário
   * está em Configurações > Horário de Atendimento com alterações não salvas.
   */
  const goToViewWithGuard = React.useCallback((view) => {
    if (isDirtyHorarios && activeView === 'configuracoes') {
      pendingNavAction.current = () => goToView(view);
      setIsUnsavedNavModalOpen(true);
      return;
    }
    goToView(view);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDirtyHorarios, activeView, canSeeConfig, canSeeConfigEquipe]);

  React.useEffect(() => {
    if (activeView !== 'consulta' || !journeyState.isAgendaRetorno) return;
    const blocked = ['anamnese', 'avaliacao', 'planejamento', 'procedimento'];
    if (blocked.includes(consultaModule)) {
      setConsultaModule('hub');
    }
  }, [activeView, consultaModule, journeyState.isAgendaRetorno]);

  React.useEffect(() => {
    if (activeView === 'configuracoes' && postLoginGate === 'ready' && !canSeeConfig) {
      setActiveView('pacientes');
      try {
        sessionStorage.setItem('activeView', 'pacientes');
      } catch {
        // ignore
      }
    }
    if (activeView === 'gestao-equipe' && postLoginGate === 'ready' && !canSeeConfigEquipe) {
      setActiveView('pacientes');
      try {
        sessionStorage.setItem('activeView', 'pacientes');
      } catch {
        // ignore
      }
    }
  }, [activeView, postLoginGate, canSeeConfig, canSeeConfigEquipe, setActiveView]);

  const setConfigSection = React.useCallback((section) => {
    const next = VALID_SECTIONS.has(section) ? section : 'fichas';
    setConfigSectionState(next);
    persistSection(next);
  }, []);

  const onOpenClinicaSettings = React.useCallback(() => {
    if (!canSeeConfig) return;
    setActiveView('configuracoes');
    setConfigSection('clinica');
  }, [canSeeConfig, setActiveView, setConfigSection]);

  const onOpenPerfilSettings = React.useCallback(() => {
    if (!canSeeConfig) return;
    setActiveView('configuracoes');
    setConfigSection('perfil');
  }, [canSeeConfig, setActiveView, setConfigSection]);

  /** Migração de `activeView` salvo: jornada/consulta → pacientes; anamnese/termos → configuracoes. */
  React.useEffect(() => {
    try {
      const cur = sessionStorage.getItem('activeView');
      // @deprecated — substituído por activeView:'consulta'. Remover na v2 após confirmar que nenhum call site usa 'jornada'.
      if (cur === 'jornada' || cur === 'consulta') {
        sessionStorage.setItem('activeView', 'pacientes');
      } else if (cur === 'anamnese' || cur === 'termos') {
        sessionStorage.setItem('activeView', 'configuracoes');
      }
    } catch {
      /* ignore */
    }
  }, []);

  React.useEffect(() => {
    const needsJourneyTermos =
      activeView === 'jornada' || (activeView === 'consulta' && consultaModule === 'termos');
    // @deprecated — activeView === 'jornada' legado; consulta + termos é o caminho novo.
    if (!needsJourneyTermos) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const raw = await termosApi.list();
        if (cancelled) return;
        const list = normalizeTermosList(raw).filter(isTermoAtivoRow);
        const first = list[0];
        setJourneyTermoTitulo(first ? String(first.titulo ?? first.title ?? '').trim() : '');
        setJourneyTermoConteudo(first ? String(first.conteudo ?? first.content ?? '').trim() : '');
      } catch {
        if (!cancelled) {
          setJourneyTermoTitulo('');
          setJourneyTermoConteudo('');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeView, consultaModule]);

  React.useEffect(() => {
    if (!authSessionReady) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const [perfilRes, clinicaRes] = await Promise.all([
          fetch(resolveApiUrl('/api/v1/perfil'), {
            credentials: 'include',
            headers: { ...(await authHeadersForFetch({ needsOrg: false })) },
          }),
          fetch(resolveApiUrl('/api/v1/clinica'), {
            credentials: 'include',
            headers: { ...(await authHeadersForFetch({ needsOrg: true })) },
          }),
        ]);
        if (cancelled) return;
        if (perfilRes.ok) {
          const p = await perfilRes.json().catch(() => ({}));
          setPerfilInfo({
            nomeCompleto: String(p?.nomeCompleto ?? p?.nome_completo ?? '').trim(),
            fotoUrl: String(p?.fotoUrl ?? p?.foto_url ?? '').trim(),
            cpf: String(p?.cpf ?? '').trim(),
            crm: String(p?.crm ?? '').trim(),
            telefone: String(p?.telefone ?? p?.celular ?? '').trim(),
          });
        }
        if (clinicaRes.ok) {
          const c = await clinicaRes.json().catch(() => ({}));
          const nomeClinica = c?.nome || c?.nomeFantasia || c?.nome_fantasia || '';
          const logoRaw = c?.logoUrl ?? c?.logo_url;
          const logoUrl = typeof logoRaw === 'string' ? logoRaw.trim() : '';
          
          let endCompleto = String(c?.enderecoLogradouro ?? c?.endereco ?? c?.logradouro ?? '').trim();
          if (c?.enderecoNumero) endCompleto += `, ${c.enderecoNumero}`;
          if (c?.enderecoCidade) endCompleto += ` - ${c.enderecoCidade}`;
          if (c?.enderecoEstado) endCompleto += `/${c.enderecoEstado}`;

          setClinicaInfo((prev) => ({
            ...prev,
            ...(nomeClinica ? { nome: String(nomeClinica).trim(), subtitulo: 'Harmonização Premium' } : {}),
            ...(logoUrl ? { logoUrl } : {}),
            endereco: endCompleto,
            telefone: String(c?.telefone ?? c?.celular ?? '').trim(),
            cnpj: String(c?.cnpj ?? '').trim(),
          }));
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authSessionReady, orgId]);

  React.useEffect(() => {
    if (!isLoggedIn) {
      setPerfilInfo({ nomeCompleto: '', fotoUrl: '' });
    }
  }, [isLoggedIn]);

  const updatePatientByCpf = (cpfKey, updater) => {
    const key = String(cpfKey || '').trim();
    if (!key) return;
    setPatients((prev) =>
      prev.map((p) => {
        const patientCpf = String(p?.cpf || '').trim();
        if (patientCpf !== key) return p;
        return typeof updater === 'function' ? updater(p) : { ...p, ...updater };
      })
    );
  };

  const handleStartAttendance = (patient, options = {}) => {
    if (!patient) return;

    const cpf = patient.cpf != null && String(patient.cpf).trim() !== '' ? patient.cpf : null;
    const cpfKey = cpf != null ? String(cpf).trim() : '';
    const todayIso = toLocalISODate();
    const isSameDayResume =
      cpfKey !== '' &&
      cpfKey === String(selectedPatientCpf || '').trim() &&
      journeyProcedureDateIso === todayIso;

    cameraState.closePhotoModal();

    if (!isSameDayResume) {
      if (!options.fromAgendaSlot) {
        setProcedimentosLote([]);
      }
      /* Evita ERR_FILE_NOT_FOUND em blob: após reset — canvas ainda apontava para URLs revogadas. */
      revokeBlobUrlIfAny(journeyState.evaluationAnnotatedPhotoUrl);
      journeyState.setEvaluationAnnotatedPhotoUrl(null);
      revokeBlobUrlIfAny(journeyState.imageSrc);
      journeyState.setImageSrc(null);
      journeyState.setPaths([]);

      cameraState.resetEvaluationPhotos();
      cameraState.resetProcedureCapturedPhotos();

      /* ProcedureCameraWidget usa anamnesePhotoUrl na miniatura — mesmo blob das fotos confirmadas. */
      revokeBlobUrlIfAny(cameraState.anamnesePhotoUrl);
      cameraState.setAnamnesePhotoUrl(null);
      cameraState.setAnamnesePhotoBlob(null);
      cameraState.setAnamnesePhotoMeta(null);

      if (cpfKey) {
        setPatients((prev) =>
          prev.map((p) => {
            if (String(p?.cpf || '').trim() !== cpfKey) return p;
            const photos = Array.isArray(p.evaluationCapturedPhotos) ? p.evaluationCapturedPhotos : [];
            photos.forEach((ph) => revokeBlobUrlIfAny(ph?.url));
            revokeBlobUrlIfAny(p.evaluationAnnotatedPhotoUrl);
            return {
              ...p,
              evaluationCapturedPhotos: [],
              evaluationSelectedPhotoIndex: null,
              evaluationAnnotatedPhotoUrl: null,
            };
          })
        );
      }
    }

    setSelectedPatientCpf(cpf);
    if (!isSameDayResume) {
      setJourneyProcedureDateIso(todayIso);
      const nomeAgenda = options.procedimentoNome != null ? String(options.procedimentoNome).trim() : '';
      const catAgenda =
        options.catalogoProcedimentoSaudeId != null && String(options.catalogoProcedimentoSaudeId).trim() !== ''
          ? String(options.catalogoProcedimentoSaudeId).trim()
          : null;
      journeyState.setNomeProcedimentoCatalogoId(catAgenda);
      journeyState.setNomeProcedimento(nomeAgenda);
      journeyState.setAgendaId(options.agendaId ?? null);
      const isRetorno =
        options.isAgendaRetorno === true ||
        String(options.tipoProcedimentoCodigo || '').toLowerCase() === 'retorno';
      journeyState.setTipoAtendimento(isRetorno ? 'retorno' : 'consulta');
      journeyState.setProcedimentoFeitoOrigemId(
        options.procedimentoFeitoOrigemId != null ? String(options.procedimentoFeitoOrigemId) : null,
      );
      if (isRetorno) {
        journeyState.setRetornoAvaliacao({ satisfacao: null, simetria: '', dor: null });
        journeyState.setHouveRetoque(false);
      }
    }
    const isRetornoFallback =
      options.isAgendaRetorno === true ||
      String(options.tipoProcedimentoCodigo || '').toLowerCase() === 'retorno';
    const mod = isRetornoFallback
      ? (options.initialModule ?? 'hub')
      : (options.initialModule ?? LEGACY_STEP_TO_MODULE[options.initialStep] ?? 'hub');
    setConsultaModule(mod);
    setActiveView('consulta');
    setPatientView('list');
  };

  const handleIniciarRetornoAvulso = React.useCallback(() => {
    if (!pacienteAtual?.id) return;
    setRetornoAvulsoPickerOpen(true);
  }, [pacienteAtual?.id]);

  const handleRetornoAvulsoPaiEscolhido = React.useCallback(
    (procedimentoFeitoOrigemId) => {
      if (!pacienteAtual?.id || !roleUserId) return;
      setRetornoAvulsoPickerOpen(false);
      const origemId = String(procedimentoFeitoOrigemId || '').trim();
      if (!origemId) return;
      agendaSchedule.openCreateModalForPatient(buildAgendaPacienteFromRecord(pacienteAtual), {
        modoRetorno: true,
        procedimentoFeitoOrigemId: origemId,
        profissionalRoleUserId: roleUserId,
        onAgendaSaved: (payload) => {
          handleStartAttendance(pacienteAtual, {
            agendaId: payload?.agendaId,
            isAgendaRetorno: true,
            tipoProcedimentoCodigo: 'retorno',
            procedimentoFeitoOrigemId: origemId,
            fromAgendaSlot: true,
            initialModule: 'hub',
            data: payload?.dataAgendamento,
            horaInicio: payload?.horaInicio,
          });
        },
      });
    },
    [agendaSchedule, buildAgendaPacienteFromRecord, pacienteAtual, roleUserId],
  );

  const onSairConsulta = React.useCallback(() => {
    const sCpf = String(selectedPatientCpf || pacienteAtual?.cpf || '').trim();
    setConsultaModule(null);
    setActiveView('pacientes');
    
    refreshPatientsAndPagedList();
    
    if (sCpf) {
      setSelectedPatientCpf(sCpf);
      setPatientView('profile');
      setPatientDetailTab('timeline');
    }
  }, [
    setActiveView,
    journeyState,
    selectedPatientCpf,
    pacienteAtual?.cpf,
    setSelectedPatientCpf,
    setPatientView,
    setPatientDetailTab,
    refreshPatientsAndPagedList,
  ]);

  const requestEncerrarConsulta = React.useCallback(() => {
    setEncerrarConsultaOpen(true);
  }, []);

  const cancelEncerrarConsulta = React.useCallback(() => {
    setEncerrarConsultaOpen(false);
  }, []);

  const autoSaveAnamneseSilently = React.useCallback(async () => {
    if (!pacienteAtual?.id || !roleUserId) return;
    if (!journeyState.queixa?.trim() && !journeyState.expectativas?.trim()) return;
    try {
      const observacoes = [
        journeyState.queixa?.trim() ? `Queixa: ${journeyState.queixa.trim()}` : '',
        journeyState.expectativas?.trim() ? `. Expectativas: ${journeyState.expectativas.trim()}` : '',
      ].join('').trim();

      if (anamnesePreenchimentoIdRef.current) {
        await anamneseApi.atualizarObservacoesAnamnese(
          pacienteAtual.id,
          anamnesePreenchimentoIdRef.current,
          observacoes
        );
      } else {
        let anamneseId = journeyState.fichaSelecionadaId;
        if (!anamneseId) {
          const fichaBasica = await anamneseApi.getFichaBasica();
          anamneseId = fichaBasica?.id ?? fichaBasica?.anamneseId;
        }
        if (!anamneseId) return;

        const created = await anamneseApi.createPaciente(pacienteAtual.id, roleUserId, {
          anamneseId,
          observacoes,
          respostas: [],
        });
        const pid = created?.id ?? created?.preenchimentoId;
        if (pid != null && pid !== '') {
          anamnesePreenchimentoIdRef.current = String(pid);
        }
      }
    } catch (err) {
      console.warn('[AutoSave] Falha ao salvar anamnese no encerramento/blur:', err?.message);
    }
  }, [journeyState.queixa, journeyState.expectativas, journeyState.fichaSelecionadaId, pacienteAtual?.id, roleUserId]);

  const autoSaveProcedimentoSilently = React.useCallback(async (observacoes) => {
    const obs = String(observacoes || '').trim();
    if (!obs || !loteProcedimentosFeitosIds?.length) return;
    try {
      for (const pid of loteProcedimentosFeitosIds.filter(Boolean)) {
        await procedimentosApi.atualizarObservacao(pid, obs);
      }
    } catch (err) {
      console.warn('[AutoSave] Falha ao salvar observações no encerramento:', err?.message);
    }
  }, [loteProcedimentosFeitosIds]);


  const closeIniciarTolModal = React.useCallback(() => {
    setIniciarTolModal(null);
    setIniciarTolAdiantarSubmitting(false);
  }, []);

  const handleAgendaStartAttendance = (patient, options = {}) => {
    if (!patient) return;
    const opt = options || {};
    const agendaId = opt.agendaId;
    const fromSlot = opt.fromAgendaSlot === true;
    const dataRaw = opt.data;
    const horaRaw = opt.horaInicio;
    
    if (opt.lote && Array.isArray(opt.lote) && opt.lote.length > 0) {
      setProcedimentosLote(opt.lote);
      journeyState.setProcedimentosSessao(opt.lote);
      journeyState.setActiveProcedureIndex(0);
    } else {
      if (fromSlot && agendaId && dataRaw) {
        const scheduledAt = parseSlotLocalDateTime(dataRaw, horaRaw);
        if (scheduledAt || !scheduledAt) { // Keep indenting/logic simple
          const agendamentosDoDia = agendaSchedule.appointments
            .filter(i => {
              const sameId = String(i?.paciente?.id || '') === String(patient.id || '') || String(i?.pacienteId || '') === String(patient.id || '');
              const sameName = String(i?.pacienteNome || '').trim().toLowerCase() === String(patient?.nome || patient?.nomeCompleto || '').trim().toLowerCase();
              const isSamePatient = (patient.id && sameId) || sameName;
              return isSamePatient && toDateKey(i?.data) === toDateKey(dataRaw);
            })
            .sort((a,b) => String(a?.horaInicio).localeCompare(String(b?.horaInicio)));
          
          const lote = agendamentosDoDia.map(a => ({
            agendaId: a.id || a.agendaId,
            procedimentoNome: a.tipoProcedimento?.nome || a.procedimentoNome,
            catalogoProcedimentoSaudeId: a.catalogoProcedimentoSaudeId,
            isAgendaRetorno:
              String(a.tipoProcedimentoCodigo ?? a.rawSlot?.tipoProcedimentoCodigo ?? '').toLowerCase() ===
              'retorno',
          }));
          
          setProcedimentosLote(lote);
          journeyState.setProcedimentosSessao(lote);
          journeyState.setActiveProcedureIndex(0);
        }
      } else {
        setProcedimentosLote([]);
        journeyState.setProcedimentosSessao([]);
        journeyState.setActiveProcedureIndex(0);
      }
    }

    const proceedDirect = () => {
      handleStartAttendance(patient, opt);
    };

    if (
      !fromSlot ||
      !agendaId ||
      dataRaw == null ||
      String(dataRaw).trim() === '' ||
      horaRaw == null ||
      String(horaRaw).trim() === ''
    ) {
      proceedDirect();
      return;
    }

    if (toDateKey(dataRaw) !== toDateKey(agendaSchedule.todayIso)) {
      proceedDirect();
      return;
    }

    const scheduledAt = parseSlotLocalDateTime(dataRaw, horaRaw);
    if (!scheduledAt) {
      toast.error('Horário do agendamento inválido.');
      return;
    }

    const diffMin = diffScheduledMinusNowMinutes(scheduledAt);
    if (Math.abs(diffMin) <= MARGEM_TECNICA_MIN) {
      proceedDirect();
      return;
    }

    const scheduledTimeLabel = formatClockHHMM(scheduledAt);
    const now = new Date();
    const nowTimeLabel = formatClockHHMM(now);

    if (diffMin > MARGEM_TECNICA_MIN) {
      setIniciarTolModal({
        variant: 'early',
        patient,
        options: opt,
        scheduledTimeLabel,
        nowTimeLabel,
        antecedenciaTexto: formatAntecedenciaText(diffMin),
      });
      return;
    }

    setIniciarTolModal({
      variant: 'late',
      patient,
      options: opt,
      scheduledTimeLabel,
      nowTimeLabel,
      atrasoTexto: formatAtrasoText(-diffMin),
    });
  };

  const handleIniciarTolAdvanceNow = async () => {
    const m = iniciarTolModal;
    if (!m || m.variant !== 'early' || !m.options?.agendaId) return;
    setIniciarTolAdiantarSubmitting(true);
    try {
      await agendasApi.adiantar(m.options.agendaId, formatNowHHMM());
      await agendaSchedule.refreshDashboard();
      closeIniciarTolModal();
      handleStartAttendance(m.patient, m.options);
    } catch (e) {
      const status = e?.status;
      if (status === 409) {
        setIniciarTolModal((prev) =>
          prev ? { ...prev, variant: 'conflict', detailMessage: getApiErrorDetail(e) } : null,
        );
      } else if (status === 404) {
        toast.error(getApiErrorToastMessage(e, 'Agendamento não encontrado.'));
        closeIniciarTolModal();
      } else if (status === 400) {
        toast.error(getApiErrorToastMessage(e, 'Não foi possível validar o horário.'));
        closeIniciarTolModal();
      } else {
        toast.error(getApiErrorToastMessage(e, 'Não foi possível adiantar o horário.'));
        closeIniciarTolModal();
      }
    } finally {
      setIniciarTolAdiantarSubmitting(false);
    }
  };

  const onCancelJourney = React.useCallback(() => {
    setCurrentStep(1);
    setActiveView('pacientes');
  }, [setCurrentStep, setActiveView]);

  const handleCreatePatientFromPatients = () => {
    setPatientView('create');
  };

  const handleGlobalPatientSelect = React.useCallback(
    (patient) => {
      const cpf = String(patient?.cpf || '').trim();
      if (!cpf) return;
      if (activeView !== 'pacientes') goToViewWithGuard('pacientes');
      captureProfileNavSnapshot?.(cpf);
      setSelectedPatientCpf(cpf);
      setPatientDetailTab('planos');
      setPatientView('profile');
    },
    [
      activeView,
      goToViewWithGuard,
      captureProfileNavSnapshot,
      setSelectedPatientCpf,
      setPatientDetailTab,
      setPatientView,
    ],
  );

  const handleGlobalNovoPaciente = React.useCallback(() => {
    if (activeView !== 'pacientes') goToViewWithGuard('pacientes');
    setPatientView('create');
  }, [activeView, goToViewWithGuard, setPatientView]);

  const handleGlobalAgendamento = React.useCallback(() => {
    agendaSchedule.openCreateModal(agendaSchedule.selectedDay);
  }, [agendaSchedule]);

  const handleOpenNotificacoes = React.useCallback(() => {
    if (activeView !== 'notificacoes') {
      setPreviousView(activeView);
    }
    goToViewWithGuard('notificacoes');
  }, [activeView, goToViewWithGuard]);

  const handleVoltarNotificacoes = React.useCallback(() => {
    goToViewWithGuard(previousView || 'pacientes');
  }, [previousView, goToViewWithGuard]);

  const handleNotificacoesChanged = React.useCallback(() => {
    setNotifVersion((v) => v + 1);
  }, []);

  const handleNavigateToCatalogo = React.useCallback(() => {
    if (!canSeeConfig) return;
    goToViewWithGuard('configuracoes');
    setConfigSection('procedimentos');
  }, [canSeeConfig, goToViewWithGuard, setConfigSection]);

  const handleNavigateToAgenda = React.useCallback(() => {
    goToViewWithGuard('agenda');
  }, [goToViewWithGuard]);

  const handleUpdatePatientProfile = (cpfKey, patch) => {
    updatePatientByCpf(cpfKey, (prev) => ({ ...prev, ...patch }));
  };

  const handleAddGalleryFiles = async (cpfKey, fileList) => {
    const files = Array.from(fileList || []).slice(0, 30);
    if (files.length === 0) return;

    const toDataUrl = (file) =>
      new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Falha ao ler arquivo de imagem.'));
        reader.readAsDataURL(file);
      });

    const uploaded = [];
    for (const file of files) {
      try {
        const url = await toDataUrl(file);
        uploaded.push({
          url,
          meta: {
            source: 'upload',
            fileName: file.name,
            capturedAt: new Date().toISOString(),
          },
        });
      } catch {
        // ignore invalid file
      }
    }

    if (uploaded.length === 0) return;

    updatePatientByCpf(cpfKey, (prev) => {
      const current = Array.isArray(prev?.evaluationCapturedPhotos)
        ? prev.evaluationCapturedPhotos
        : [];
      const merged = [...current, ...uploaded].slice(0, 30);
      return {
        ...prev,
        evaluationCapturedPhotos: merged,
        evaluationSelectedPhotoIndex:
          merged.length > 0 ? Math.min(merged.length - 1, 29) : null,
      };
    });
  };

  const handleDeleteGalleryPhoto = (cpfKey, index) => {
    updatePatientByCpf(cpfKey, (prev) => {
      const photos = Array.isArray(prev?.evaluationCapturedPhotos)
        ? prev.evaluationCapturedPhotos
        : [];
      if (index < 0 || index >= photos.length) return prev;
      const next = photos.filter((_, i) => i !== index);

      let nextSelected = prev?.evaluationSelectedPhotoIndex;
      if (!next.length) nextSelected = null;
      else if (nextSelected === index) nextSelected = Math.min(index, next.length - 1);
      else if (nextSelected > index) nextSelected = nextSelected - 1;

      return {
        ...prev,
        evaluationCapturedPhotos: next,
        evaluationSelectedPhotoIndex: nextSelected,
      };
    });
  };

  const upsertPatientLocal = ({ ensureSelected = false } = {}) => {
    const selectedTrim = String(selectedPatientCpf || '').trim();
    if (!selectedTrim && !pacienteAtual) return;

    const existingPatient =
      pacienteAtual ||
      patients.find((p) => String(p?.cpf || '').trim() === selectedTrim);
    if (!existingPatient) return;

    const matchKey = String(existingPatient.cpf || '').trim() || selectedTrim;

    const patientPayload = {
      ...existingPatient,
      anamnese: {
        queixa: journeyState.queixa || '',
        expectativas: journeyState.expectativas || '',
        updatedAt: new Date().toISOString(),
      },
      termoLido: Boolean(journeyState.termoLido),
      termoAssinado: Boolean(journeyState.termoAssinado),
      termoAssinaturaDataUrl: journeyState.termoAssinaturaDataUrl || '',
      profissionalAssinaturaDataUrl: journeyState.profissionalAssinaturaDataUrl || '',
      orientacoes: Boolean(journeyState.orientacoes),
    };

    setPatients((prev) => {
      const list = Array.isArray(prev) ? prev : [];
      const idx = list.findIndex((p) => {
        const itemCpf = String(p?.cpf || '').trim();
        return matchKey ? itemCpf === matchKey : false;
      });

      if (idx >= 0) {
        const copy = [...list];
        const existing = copy[idx];
        copy[idx] = { ...existing, ...patientPayload };
        return copy;
      }

      return [...list, patientPayload];
    });

    if (ensureSelected && matchKey) {
      setSelectedPatientCpf(matchKey);
    }
  };

  const salvarAnamneseAntesDeAvancar = React.useCallback(async () => {
    if (!pacienteAtual) {
      toast.error('Selecione um paciente na aba Pacientes antes de continuar a jornada.');
      return false;
    }
    upsertPatientLocal({ ensureSelected: true });

    if (anamneseRef.current?.isPerfilDirty?.()) {
      if (!roleUserId) {
        toast.error('Selecione o profissional responsável antes de salvar o perfil clínico.');
        return false;
      }
      const perfilResult = await anamneseRef.current.savePerfilClinico();
      if (!perfilResult?.ok) {
        toast.error(
          getApiErrorToastMessage(
            perfilResult?.error,
            'Erro ao salvar o perfil clínico. Verifique a conexão e tente novamente.',
          ),
        );
        return false;
      }
    }

    const validacaoObrigatorias = anamneseRef.current?.validateObrigatorias?.();
    if (validacaoObrigatorias && !validacaoObrigatorias.ok) {
      toast.error('Preencha todas as perguntas obrigatórias da ficha.');
      return false;
    }

    const { queixa, expectativas } = journeyState;
    const skipQueixaExpectativas =
      !queixaVisivel || anamneseRef.current?.skipQueixaExpectativas?.() === true;
    if (!skipQueixaExpectativas) {
      if (!queixa.trim() || !expectativas.trim()) {
        const e2 = {};
        if (!queixa.trim()) e2.queixa = true;
        if (!expectativas.trim()) e2.expectativas = true;
        journeyState.setStep2Errors(e2);
        toast.error('Para prosseguir, preencha a queixa principal e as expectativas.');
        return false;
      }
    }
    journeyState.setStep2Errors({});

    upsertPatientLocal({ ensureSelected: true });

    const anamneseData = anamneseRef.current?.getAnamneseData?.();
    const temFicha =
      Boolean(anamneseData?.anamneseId) && (anamneseData?.respostas?.length ?? 0) > 0;
    const temObservacoes = Boolean(queixa.trim() || expectativas.trim());

    if (temFicha || temObservacoes) {
      const paciente =
        pacienteAtual ||
        patients.find((p) => {
          const pCpf = String(p?.cpf || '').trim();
          const sCpf = String(selectedPatientCpf || '').trim();
          return sCpf && pCpf === sCpf;
        });
      const rid = roleUserId;
      if (!rid) {
        console.warn('roleUserId ausente: faça login novamente para vincular o profissional.');
      }

      let anamneseId = anamneseData?.anamneseId;

      if (!temFicha && temObservacoes) {
        try {
          const fichaBasica = await anamneseApi.getFichaBasica();
          anamneseId = fichaBasica?.id ?? fichaBasica?.anamneseId;
        } catch (err) {
          console.warn('Erro ao obter ficha básica:', err.message);
          anamneseId = undefined;
        }
      }

      if (paciente?.id && rid && anamneseId) {
        const q = queixa.trim();
        const e = expectativas.trim();
        let observacoes;
        if (q && e) observacoes = `Queixa: ${q}. Expectativas: ${e}`;
        else if (q) observacoes = `Queixa: ${q}`;
        else if (e) observacoes = `Expectativas: ${e}`;
        try {
          const created = await anamneseApi.createPaciente(paciente.id, rid, {
            anamneseId,
            ...(observacoes ? { observacoes } : {}),
            respostas: anamneseData?.respostas || [],
          });
          const pid = created?.id ?? created?.preenchimentoId;
          if (pid != null && pid !== '') {
            anamnesePreenchimentoIdRef.current = String(pid);
          }
        } catch (err) {
          toast.error(getApiErrorToastMessage(err, 'Erro ao salvar a anamnese.'));
          return false;
        }
      }
    }

    return true;
  }, [
    journeyState,
    pacienteAtual,
    patients,
    queixaVisivel,
    roleUserId,
    selectedPatientCpf,
    toast,
    upsertPatientLocal,
  ]);

  const handleNextStep = async () => {
    if (currentStep === 5 && isFinishing) return;

    if (currentStep === 1) {
      setStep1Busy(true);
      try {
        const ok = await salvarAnamneseAntesDeAvancar();
        if (!ok) return;
      } finally {
        setStep1Busy(false);
      }
    }

    if (currentStep === 3) {
      if (!journeyState.termosAssinados || journeyState.termosAssinados.length === 0) {
        toast.error('Para prosseguir, assine pelo menos um termo de consentimento.');
        return;
      }

      journeyState.setTermoAssinado(true);
      journeyState.setStep4Errors({});
      upsertPatientLocal({ ensureSelected: true });
    }

    if (currentStep === 4) {
      const nomeP = String(journeyState.nomeProcedimento || '').trim();
      const catId =
        journeyState.nomeProcedimentoCatalogoId != null &&
        String(journeyState.nomeProcedimentoCatalogoId).trim() !== ''
          ? String(journeyState.nomeProcedimentoCatalogoId).trim()
          : null;
      if (!nomeP || (!catId && !sugestaoProcedimentoEnviada)) {
        journeyState.setStep4Errors({
          nomeProcedimento: !nomeP || (!catId && !sugestaoProcedimentoEnviada),
          catalogoId: !catId && !sugestaoProcedimentoEnviada,
        });
        toast.error('Selecione o procedimento no catálogo para continuar.');
        return;
      }
      journeyState.setStep4Errors({});
      upsertPatientLocal({ ensureSelected: true });
    }

    if (currentStep === 5) {
      const { orientacoes } = journeyState;
      if (!orientacoes) {
        journeyState.setStep5Errors({
          orientacoes: !orientacoes,
        });
        toast.error('Marque ao menos uma orientação pós-procedimento para continuar.');
        return;
      }

      const { blocksFinish } = evaluateProximoRetornoStep5(
        journeyProcedureDateIso,
        journeyState.proximoRetornoDisplay
      );
      if (blocksFinish) {
        toast.error('Corrija a data do próximo retorno ou deixe o campo vazio.');
        return;
      }

      journeyState.setStep5Errors({});
      upsertPatientLocal({ ensureSelected: true });
    }

    if (currentStep < 5) {
      setCurrentStep(currentStep + 1);
    } else {
      await finishJourney();
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      if (currentStep === 3 || currentStep === 4) journeyState.setStep4Errors({});
      if (currentStep === 5) journeyState.setStep5Errors({});
      setCurrentStep(currentStep - 1);
    }
  };

  const resolvePacienteAtendimento = React.useCallback(() => {
    const sCpf = String(selectedPatientCpf || pacienteAtual?.cpf || '').trim();
    return sCpf ? patients.find((p) => String(p?.cpf || '').trim() === sCpf) : null;
  }, [selectedPatientCpf, pacienteAtual?.cpf, patients]);



  const uploadEvaluationCapturedPhotos = React.useCallback(
    async ({ paciente, procIdOpt, dataRefSessao }) => {
      const ridUpload = roleUserId;
      const ridOk = ridUpload && /^[0-9a-f-]{36}$/i.test(String(ridUpload));
      const fotosAvaliacao = cameraState.evaluationCapturedPhotos || [];
      if (fotosAvaliacao.length > 0 && paciente?.id && ridOk) {
        const uploads = fotosAvaliacao.map(async (foto) => {
          try {
            let fileToUpload = foto.blob;
            if (!fileToUpload && foto.url) {
              const resp = await fetch(foto.url);
              const blob = await resp.blob();
              fileToUpload = new File([blob], 'foto-avaliacao.jpg', {
                type: blob.type || 'image/jpeg',
              });
            }
            if (!fileToUpload) return;
            const webp = await convertToWebP(fileToUpload, 0.85, 1920);
            await pacientesGaleriaApi.upload(paciente.id, webp, {
              roleUserId: ridUpload,
              procedimentoFeitoId: procIdOpt,
              legenda: formatGaleriaLegendaForUpload(GALERIA_CATEGORIA.AVALIACAO),
              dataReferencia: dataRefSessao,
            });
          } catch (e) {
            console.warn('Erro ao salvar foto de avaliação na galeria:', e);
          }
        });
        await Promise.allSettled(uploads);
      } else if (fotosAvaliacao.length > 0 && paciente?.id && !ridOk) {
        console.warn(
          'Fotos de avaliação não enviadas: selecione o profissional (roleUserId) na barra de contexto.'
        );
      }
    },
    [cameraState.evaluationCapturedPhotos, roleUserId]
  );

  const salvarFotosAvaliacao = React.useCallback(async () => {
    if (finishJourneyLockRef.current) return;
    finishJourneyLockRef.current = true;
    setIsSalvandoFotosAvaliacao(true);
    try {
      const sCpf = String(selectedPatientCpf || pacienteAtual?.cpf || '').trim();
      const paciente = sCpf
        ? patients.find((p) => String(p?.cpf || '').trim() === sCpf)
        : null;
      const dataRefSessao = toLocalISODate(new Date());
      const procIdOpt = loteProcedimentosFeitosIds[0] ?? undefined;
      pendingAnnotatedGalleryBlobsRef.current = [];
      await uploadEvaluationCapturedPhotos({ paciente, procIdOpt, dataRefSessao });
    } catch (error) {
      console.error('Erro ao salvar fotos de avaliação:', error);
      toast.error(error.message || 'Erro ao salvar fotos de avaliação.');
      throw error;
    } finally {
      finishJourneyLockRef.current = false;
      setIsSalvandoFotosAvaliacao(false);
    }
  }, [
    pacienteAtual?.cpf,
    patients,
    selectedPatientCpf,
    toast,
    loteProcedimentosFeitosIds[0],
    uploadEvaluationCapturedPhotos,
  ]);

  const handleConcluirAvaliacao = React.useCallback(async () => {
    try {
      await salvarFotosAvaliacao();
      setConsultaModule('hub');
    } catch {
      /* toast já exibido em salvarFotosAvaliacao */
    }
  }, [salvarFotosAvaliacao]);

  const handleConcluirAnamnese = React.useCallback(async () => {
    setStep1Busy(true);
    try {
      const ok = await salvarAnamneseAntesDeAvancar();
      if (ok) {
        toast.success('Anamnese salva com sucesso.');
        setConsultaModule('hub');
      }
    } finally {
      setStep1Busy(false);
    }
  }, [salvarAnamneseAntesDeAvancar, toast]);

  const resetJourney = React.useCallback(() => {
    setPhotoAnnotationScope(null);
    setPhotoAnnotationIndex(null);
    setCurrentStep(1);
    journeyState.setQueixa('');
    journeyState.setExpectativas('');
    journeyState.setObservacoes('');
    journeyState.setStep2AnamneseDraft({
      pacienteId: null,
      fichaSelecionadaId: '',
      fichaDropdownNovo: '',
      respostas: {},
      preenchimentoAnterior: null,
      modoVisualizacao: false,
    });
    journeyState.setRespostasAnamnese({});
    journeyState.setStep2PerfilClinicoDraft(null);
    journeyState.setImageSrc(null);
    journeyState.setPaths([]);
    journeyState.setTermoLido(false);
    journeyState.setTermoAssinado(false);
    journeyState.setTermoAssinaturaDataUrl('');
    journeyState.setProfissionalAssinaturaDataUrl('');
    journeyState.setOrientacoesItens([]);
    journeyState.setOrientacoesCarregadas(false);
    journeyState.setProximoRetornoDisplay('');
    journeyState.setObservacoesExecucao('');
    journeyState.setNomeProcedimento('');
    journeyState.setNomeProcedimentoCatalogoId(null);
    journeyState.setTipoAtendimento('consulta');
    journeyState.setProcedimentoFeitoOrigemId(null);
    journeyState.setRetornoAvaliacao({ satisfacao: null, simetria: '', dor: null });
    journeyState.setHouveRetoque(false);
    setSugestaoProcedimentoEnviada(false);
    journeyState.setAgendaId(null);
    journeyState.setStep2Errors({});
    journeyState.setStep4Errors({});
    journeyState.setStep5Errors({});
    anamnesePreenchimentoIdRef.current = null;
    pendingAnnotatedGalleryBlobsRef.current = [];
    journeyState.setTermoSelecionadoId(null);
    setLoteProcedimentosFeitosIds([]);
    setAssinaturasRealizadasIds([]);
    patientState.setSelectedPatientCpf(null);
    patientState.setPatientView('list');
    setJourneyProcedureDateIso(toLocalISODate());
    setQueixaVisivel(true);
    mapeamentoCaptureVistaRef.current = null;
    setPendingMapeamentoCapture(null);
    mapaAplicacaoCaptureVistaRef.current = null;
    setPendingMapaAplicacaoCapture(null);
    journeyState.setJourneyPlanejamentoCtx(null);
    mapaAplicacaoState.resetMapa();
    cameraState.resetProcedureCapturedPhotos();
    cameraState.resetEvaluationPhotos();
  }, [
    cameraState,
    journeyState,
    patientState,
    setAssinaturasRealizadasIds,
    setJourneyProcedureDateIso,
    setPendingMapeamentoCapture,
    setPhotoAnnotationIndex,
    setPhotoAnnotationScope,
    setQueixaVisivel,
    mapaAplicacaoState,
  ]);

  const UUID_REGEX_PROC = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const getOrCreateProcedimentoFeitoId = React.useCallback(
    async (paciente, opts = {}) => {
      const existing = loteProcedimentosFeitosIds[0];
      if (existing) return String(existing);

      if (!opts.allowCreate) return null;
      if (!paciente?.id || !roleUserId) return null;

      const agendaIdValido =
        journeyState.agendaId && UUID_REGEX_PROC.test(String(journeyState.agendaId))
          ? journeyState.agendaId
          : null;
      if (!agendaIdValido) return null;

      const catalogoId =
        opts.catalogoId != null && String(opts.catalogoId).trim() !== ''
          ? String(opts.catalogoId).trim()
          : null;
      const planejamentoItemId = resolvePlanejamentoItemId(catalogoId);

      const body = {
        pacienteId: paciente.id,
        agendaId: agendaIdValido,
        roleUserId,
        ...(catalogoId ? { catalogoProcedimentoSaudeId: catalogoId } : {}),
        ...(opts.isRetoque != null ? { isRetoque: Boolean(opts.isRetoque) } : {}),
      };
      if (planejamentoItemId) body.planejamentoItemId = planejamentoItemId;

      try {
        const res = await procedimentosApi.iniciar(body);
        const pid = res?.id ?? res?.procedimentoId ?? res?.procedimentoFeitoId;
        if (pid != null && pid !== '') {
          const idStr = String(pid);
          setLoteProcedimentosFeitosIds([idStr]);
          return idStr;
        }
      } catch (e) {
        console.warn('iniciar procedimento falhou:', e);
      }
      return null;
    },
    [journeyState.agendaId, resolvePlanejamentoItemId, roleUserId, loteProcedimentosFeitosIds[0]],
  );

  const iniciarProcedimentoRetorno = React.useCallback(
    async (paciente, { isRetoque }) =>
      getOrCreateProcedimentoFeitoId(paciente, {
        allowCreate: true,
        isRetoque,
        catalogoId: null,
      }),
    [getOrCreateProcedimentoFeitoId],
  );

  const handleConcluirRetorno = React.useCallback(async () => {
    if (finishJourneyLockRef.current) return;
    finishJourneyLockRef.current = true;
    setIsSalvandoRetorno(true);
    try {
      const paciente = resolvePacienteAtendimento();
      if (!paciente?.id) {
        toast.error('Paciente não encontrado.');
        return;
      }
      const pid = await iniciarProcedimentoRetorno(paciente, {
        isRetoque: journeyState.houveRetoque,
      });
      if (!pid) {
        toast.error('Não foi possível iniciar o retorno.');
        return;
      }
      journeyState.setObservacoesExecucao(
        formatRetornoAvaliacaoTexto(journeyState.retornoAvaliacao),
      );
      pendingAnnotatedGalleryBlobsRef.current = [];
      await uploadEvaluationCapturedPhotos({
        paciente,
        procIdOpt: pid,
        dataRefSessao: toLocalISODate(new Date()),
      });
      await procedimentosApi.finalizar(pid);
      toast.success('Retorno registrado com sucesso.');
      setConsultaModule('hub');
    } catch (error) {
      console.error('Erro ao concluir retorno:', error);
      toast.error(error?.message || 'Erro ao concluir retorno.');
    } finally {
      finishJourneyLockRef.current = false;
      setIsSalvandoRetorno(false);
    }
  }, [
    iniciarProcedimentoRetorno,
    journeyState.houveRetoque,
    journeyState.retornoAvaliacao,
    journeyState.setObservacoesExecucao,
    resolvePacienteAtendimento,
    uploadEvaluationCapturedPhotos,
    toast,
  ]);

  const ensureProcedimentoFeitoForMapa = React.useCallback(
    async (paciente) => {
      if (journeyState.isAgendaRetorno) {
        return loteProcedimentosFeitosIds[0] ? String(loteProcedimentosFeitosIds[0]) : null;
      }

      const catalogoId =
        journeyState.nomeProcedimentoCatalogoId != null &&
        String(journeyState.nomeProcedimentoCatalogoId).trim() !== ''
          ? String(journeyState.nomeProcedimentoCatalogoId).trim()
          : null;
      const nome = String(journeyState.nomeProcedimento || '').trim();

      if (!nome || !paciente?.id || !roleUserId) return null;
      if (!catalogoId) return null;

      const created = await getOrCreateProcedimentoFeitoId(paciente, {
        allowCreate: true,
        catalogoId,
      });
      if (created) return created;

      const agendaIdValido =
        journeyState.agendaId && UUID_REGEX_PROC.test(String(journeyState.agendaId))
          ? journeyState.agendaId
          : null;
      const planejamentoItemId = resolvePlanejamentoItemId(catalogoId);
      const resultado = await procedimentosApi.registrarManual(paciente.id, {
        nome,
        roleUserId,
        observacao: String(journeyState.observacoesExecucao || '').trim() || null,
        agendaId: agendaIdValido,
        catalogoProcedimentoSaudeId: catalogoId,
        ...(planejamentoItemId ? { planejamentoItemId } : {}),
      });
      const pid = resultado?.id ?? resultado?.procedimentoId ?? resultado?.procedimentoFeitoId;
      if (pid != null && pid !== '') {
        const idStr = String(pid);
        setLoteProcedimentosFeitosIds([idStr]);
        return idStr;
      }
      return null;
    },
    [
      getOrCreateProcedimentoFeitoId,
      journeyState.agendaId,
      journeyState.isAgendaRetorno,
      journeyState.nomeProcedimento,
      journeyState.nomeProcedimentoCatalogoId,
      journeyState.observacoesExecucao,
      resolvePlanejamentoItemId,
      roleUserId,
      loteProcedimentosFeitosIds[0],
    ],
  );

  const registrarProcedimentoManual = React.useCallback(
    async (paciente, isApenasSair = false) => {
      let procedimentoFeitoIdParaVinculo = loteProcedimentosFeitosIds[0];
      const snapshotCatalogoId =
        journeyState.nomeProcedimentoCatalogoId != null &&
        String(journeyState.nomeProcedimentoCatalogoId).trim() !== ''
          ? String(journeyState.nomeProcedimentoCatalogoId).trim()
          : null;

      if (journeyState.nomeProcedimento.trim() && paciente?.id && roleUserId) {
        const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const agendaIdValido =
          !isApenasSair && journeyState.agendaId && UUID_REGEX.test(journeyState.agendaId)
            ? journeyState.agendaId
            : null;
        const planejamentoItemId = resolvePlanejamentoItemId(snapshotCatalogoId);
        const resultado = await procedimentosApi.registrarManual(paciente.id, {
          nome: journeyState.nomeProcedimento.trim(),
          roleUserId,
          observacao: String(journeyState.observacoesExecucao || '').trim() || null,
          agendaId: agendaIdValido,
          catalogoProcedimentoSaudeId: snapshotCatalogoId,
          ...(planejamentoItemId ? { planejamentoItemId } : {}),
        });
        const pid = resultado?.id ?? resultado?.procedimentoId ?? resultado?.procedimentoFeitoId;
        if (pid != null && pid !== '') {
          procedimentoFeitoIdParaVinculo = String(pid);
          setLoteProcedimentosFeitosIds([String(pid)]);
        }
      }
      return procedimentoFeitoIdParaVinculo;
    },
    [
      journeyState.agendaId,
      journeyState.nomeProcedimento,
      journeyState.nomeProcedimentoCatalogoId,
      journeyState.observacoesExecucao,
      resolvePlanejamentoItemId,
      roleUserId,
      loteProcedimentosFeitosIds[0],
    ]
  );

  const uploadProcedureCapturedPhotos = React.useCallback(
    async (paciente, pidsArray, dataRefSessao, explicitFotos = null) => {
      const ids = Array.isArray(pidsArray) ? pidsArray : [pidsArray].filter(Boolean);
      if (!ids.length) return;

      const ridUpload = roleUserId;
      const ridOk = ridUpload && /^[0-9a-f-]{36}$/i.test(String(ridUpload));
      const fotosProcedimento = explicitFotos || cameraState.procedureCapturedPhotos || [];
      if (fotosProcedimento.length > 0 && paciente?.id && ridOk) {
        const uploads = fotosProcedimento.map(async (foto) => {
          try {
            console.log('foto state:', {
              hasBlob: !!foto.blob,
              url: foto.url?.substring(0, 50),
              meta: foto.meta,
            });
            let fileToUpload = foto.blob;
            if (!fileToUpload && foto.url) {
              const resp = await fetch(foto.url);
              const blob = await resp.blob();
              fileToUpload = new File([blob], 'foto-procedimento.jpg', {
                type: blob.type || 'image/jpeg',
              });
            }
            if (!fileToUpload) return false;
            const webp = await convertToWebP(fileToUpload, 0.85, 1920);
            const uploadsForThisPhoto = ids.map(async (pid) => {
              try {
                await pacientesGaleriaApi.upload(paciente.id, webp, {
                  roleUserId: ridUpload,
                  procedimentoFeitoId: pid,
                  legenda: formatGaleriaLegendaForUpload(
                    foto.meta?.categoria || GALERIA_CATEGORIA.DEPOIS,
                    journeyState.nomeProcedimento.trim() || 'Foto do procedimento'
                  ),
                  dataReferencia: dataRefSessao,
                });
                return true;
              } catch (e) {
                console.warn('Erro ao salvar foto para procedimento:', pid, e);
                return false;
              }
            });
            const photoResults = await Promise.all(uploadsForThisPhoto);
            return photoResults.every(Boolean);
          } catch (e) {
            console.warn('Erro ao preparar foto:', e);
            return false;
          }
        });
        const results = await Promise.allSettled(uploads);
        const attempted = results.length;
        const succeeded = results.filter(
          (r) => r.status === 'fulfilled' && r.value === true
        ).length;
        if (attempted > 0 && succeeded > 0) {
          cameraState.resetProcedureCapturedPhotos();
        }
      } else if (fotosProcedimento.length > 0 && paciente?.id && !ridOk) {
        console.warn(
          'Fotos do procedimento não enviadas: selecione o profissional (roleUserId) na barra de contexto.'
        );
      }
    },
    [cameraState, journeyState.nomeProcedimento, roleUserId]
  );

  const persistirEncerramentoConsulta = React.useCallback(
    async (pidsInput) => {
      const ids = Array.isArray(pidsInput) ? pidsInput : [pidsInput].filter(Boolean);

      if (assinaturasRealizadasIds.length > 0 && ids.length > 0) {
        for (const pid of ids) {
          for (const assinaturaId of assinaturasRealizadasIds) {
            try {
              await termoAssinaturaApi.vincularProcedimento(assinaturaId, pid);
            } catch (e) {
              console.warn(`Não foi possível vincular assinatura ${assinaturaId} ao procedimento ${pid}:`, e);
            }
          }
        }
      }

      const nomesArray = journeyState.procedimentosSessao?.length > 0
        ? journeyState.procedimentosSessao.map(p => String(p.procedimentoNome || p.nomeProcedimento || '').trim()).filter(Boolean)
        : [String(journeyState.nomeProcedimento || '').trim()].filter(Boolean);
      const nomesUnicos = [...new Set(nomesArray)];

      const snapshotItens = Array.isArray(journeyState.orientacoesItens)
        ? journeyState.orientacoesItens.map((i) => ({ ...i }))
        : [];

      const orientacoesPayload = snapshotItens
        .map((i, idx) => ({
          descricao: String(i.descricao || '').trim(),
          checado: Boolean(i.checado),
          ordem: Number.isFinite(Number(i.ordem)) ? Number(i.ordem) : idx,
        }))
        .filter((x) => x.descricao);

      if (ids.length > 0 && orientacoesPayload.length > 0) {
        for (const pid of ids) {
          await orientacoesApi.salvar(pid, orientacoesPayload);
        }
      }

      const nomesParaTemplate = [];
      for (const snapshotNome of nomesUnicos) {
        let tplSig = '';
        try {
          const tplRaw = await perfilApi.getOrientacoesTemplate(snapshotNome);
          const tplList = normalizeOrientacoesTemplateResponse(tplRaw);
          tplSig = orientacoesTemplateSignature(
            tplList.map((x) => ({ descricao: x.descricao, ordem: x.ordem }))
          );
        } catch (e) {
          if (e?.status !== 404 && e?.status !== 400) {
            console.warn('getOrientacoesTemplate:', e);
          }
        }
        const curSig = orientacoesTemplateSignature(orientacoesPayload);
        if (orientacoesPayload.length > 0 && (tplSig === '' || tplSig !== curSig)) {
          nomesParaTemplate.push(snapshotNome);
        }
      }

      if (nomesParaTemplate.length > 0) {
        const nomesStr = nomesParaTemplate.map(n => `"${n}"`).join(' e ');
        const saveTpl = await askFinishJourneyConfirm({
          title: 'Salvar como padrão?',
          message: `Salvar estas orientações como padrão para ${nomesStr}?`,
        });
        if (saveTpl) {
          for (const snapshotNome of nomesParaTemplate) {
            try {
              await perfilApi.salvarOrientacoesTemplate(snapshotNome, orientacoesPayload);
            } catch {
              toast.error(`Não foi possível salvar o template de orientações para ${snapshotNome}.`);
            }
          }
        }
      }

      let catalogNames = [];
      try {
        const cats = await catalogosApi.list();
        const arr = Array.isArray(cats) ? cats : cats?.content || [];
        catalogNames = (Array.isArray(arr) ? arr : [])
          .map((c) => String(c.nomeProcedimento || c.nome || '').trim().toLowerCase())
          .filter(Boolean);
      } catch (e) {
        console.warn('catalogos list:', e);
      }

      for (const snapshotNome of nomesUnicos) {
        // No batch, we don't have easy access to each procedure's catalogoId from here easily if it was empty.
        // We'll just check if the name exists in the catalog.
        const hit = catalogNames.includes(snapshotNome.toLowerCase());
        if (!hit) {
          const add = await askFinishJourneyConfirm({
            title: 'Catálogo',
            message: `O procedimento "${snapshotNome}" não está no catálogo. Deseja cadastrá-lo?`,
          });
          if (add) {
            try {
              await catalogosApi.criar({ nomeProcedimento: snapshotNome });
              toast.success(`"${snapshotNome}" adicionado ao catálogo.`);
              catalogNames.push(snapshotNome.toLowerCase());
            } catch {
              toast.error(`Não foi possível cadastrar "${snapshotNome}" no catálogo.`);
            }
          }
        }
      }
    },
    [
      assinaturasRealizadasIds,
      askFinishJourneyConfirm,
      journeyState.nomeProcedimento,
      journeyState.nomeProcedimentoCatalogoId,
      journeyState.orientacoesItens,
      toast,
    ]
  );

  const finalizarAtendimentoNavegacao = React.useCallback(
    async (sCpf) => {
      refreshPatientsAndPagedList();
      await agendaSchedule.refreshDashboard();
      toast.success('Jornada finalizada com sucesso.');
      setActiveView('pacientes');
      resetJourney();
      if (sCpf) {
        setSelectedPatientCpf(sCpf);
      }
      setPatientView('profile');
      setPatientDetailTab('timeline');
    },
    [
      agendaSchedule,
      refreshPatientsAndPagedList,
      resetJourney,
      setActiveView,
      setPatientDetailTab,
      setPatientView,
      setSelectedPatientCpf,
      toast,
    ]
  );

  const encerrarAtendimento = React.useCallback(async (isApenasSair = false) => {
    if (finishJourneyLockRef.current) return;
    finishJourneyLockRef.current = true;
    setIsFinishing(true);
    try {
      const sCpf = String(selectedPatientCpf || pacienteAtual?.cpf || '').trim();
      const paciente = resolvePacienteAtendimento();
      
      const listaParaSalvar = journeyState.procedimentosSessao && journeyState.procedimentosSessao.length > 0 
        ? journeyState.procedimentosSessao 
        : procedimentosLote;

      const todosIds = []; 
      const payloadLote = { procedimentos: [] };
      const indexParaCriar = [];

      if (listaParaSalvar && listaParaSalvar.length > 0) {
        for (let i = 0; i < listaParaSalvar.length; i++) {
           const proc = listaParaSalvar[i];
           if (proc.id) {
             todosIds.push(proc.id);
             if (proc.observacoesExecucao) {
               try {
                 await procedimentosApi.atualizarObservacao(proc.id, proc.observacoesExecucao);
               } catch (e) {
                 console.warn('[encerrarAtendimento] erro ao atualizar obs do proc', proc.id, e);
               }
             }
           } else {
             const catId = proc.nomeProcedimentoCatalogoId || proc.catalogoProcedimentoSaudeId;
             const body = {
               nome: proc.nomeProcedimento || proc.procedimentoNome,
               roleUserId,
               observacao: proc.observacoesExecucao || null,
               agendaId: proc.agendaId || journeyState.agendaId,
               catalogoProcedimentoSaudeId: catId,
               ...(resolvePlanejamentoItemId(catId) ? { planejamentoItemId: resolvePlanejamentoItemId(catId) } : {}),
             };
             payloadLote.procedimentos.push(body);
             indexParaCriar.push(i);
             todosIds.push(null); 
           }
        }

        if (payloadLote.procedimentos.length > 0) {
          let temErroNoLote = false;
          for (let idx = 0; idx < payloadLote.procedimentos.length; idx++) {
             const body = payloadLote.procedimentos[idx];
             const bodyToSave = isApenasSair ? { ...body, agendaId: undefined } : body;
             try {
               const res = await procedimentosApi.registrarManual(paciente.id, bodyToSave);
               const pid = res?.id ?? res?.procedimentoId ?? res?.procedimentoFeitoId;
               if (pid) {
                  const origIdx = indexParaCriar[idx];
                  todosIds[origIdx] = String(pid);
               } else {
                  temErroNoLote = true;
               }
             } catch (e) {
               console.warn('[encerrarAtendimento] Erro ao registrar procedimento manual no lote', e);
               temErroNoLote = true;
             }
          }
          if (temErroNoLote) {
             throw new Error('Falha ao salvar um ou mais procedimentos do lote.');
          }
        }
      } else {
        const procedimentoFeitoIdParaVinculo = await registrarProcedimentoManual(paciente, isApenasSair);
        if (procedimentoFeitoIdParaVinculo) {
           todosIds.push(procedimentoFeitoIdParaVinculo);
        } else if (journeyState.nomeProcedimento && journeyState.nomeProcedimento.trim()) {
           throw new Error('Falha ao registrar procedimento manual. Verifique sua conexão.');
        }
      }

      const novosIdsValidos = todosIds.filter(Boolean);

      if (journeyState.procedimentosSessao?.length > 0 && novosIdsValidos.length > 0) {
        journeyState.setProcedimentosSessao(prev => 
          prev.map((p, i) => ({ ...p, id: todosIds[i] || p.id }))
        );
      }

      if (novosIdsValidos.length === 0 && journeyState.agendaId && !isApenasSair) {
        try {
          await agendasApi.atualizarStatus(journeyState.agendaId, 'realizado');
        } catch (e) {
          console.warn('[encerrarAtendimento] Erro ao marcar agenda como realizado sem procedimento:', e);
          throw new Error('Falha ao concluir agendamento na recepção. Tente novamente.');
        }
      }

      // Salva o snapshot final da aba atual no state antes de persistir
      journeyState.updateProcedureByIndex(journeyState.activeProcedureIndex, {
        mapaSnapshot: mapaAplicacaoState.getSnapshotForPersist(),
        fotosSnapshot: cameraState.procedureCapturedPhotos
      });


      if (novosIdsValidos.length > 0) {
        setLoteProcedimentosFeitosIds(novosIdsValidos);
        const dataRefSessao = toLocalISODate(new Date());

        for (let i = 0; i < novosIdsValidos.length; i++) {
          const pid = novosIdsValidos[i];
          const proc = journeyState.procedimentosSessao[i] || {};
          
          const snap = proc.mapaSnapshot || (i === journeyState.activeProcedureIndex ? mapaAplicacaoState.getSnapshotForPersist() : null);
          if (snap) {
            const catId = proc.nomeProcedimentoCatalogoId || proc.catalogoProcedimentoSaudeId;
            await persistirMapaAplicacaoAtual(pid, paciente, snap, null, catId);
          }
          
          const photos = proc.fotosSnapshot || (i === journeyState.activeProcedureIndex ? cameraState.procedureCapturedPhotos : []);
          if (photos.length > 0) {
            await uploadProcedureCapturedPhotos(paciente, [pid], dataRefSessao, photos);
          }
        }
        
        if (!isApenasSair) {
          const finalizarPromises = novosIdsValidos.map(id => procedimentosApi.finalizar(id).catch(e => console.warn('Erro ao finalizar proc', id, e)));
          await Promise.all(finalizarPromises);
        }
      }

      if (isApenasSair && cameraState.evaluationCapturedPhotos?.length > 0) {
        const dataRefSessao = toLocalISODate(new Date());
        try {
          await uploadEvaluationCapturedPhotos({ paciente, procIdOpt: novosIdsValidos[0], dataRefSessao });
        } catch (e) {
          console.warn('[encerrarAtendimento] erro ao enviar fotos avaliacao no Sair:', e);
        }
      }

      if (isApenasSair) {
        toast.success('Rascunho salvo com sucesso.');
        setConsultaModule(null);
        onSairConsulta();
      } else {
        await persistirEncerramentoConsulta(novosIdsValidos);
        setConsultaModule(null);
        await finalizarAtendimentoNavegacao(sCpf);
      }
    } catch (error) {
      console.error('Erro ao encerrar atendimento:', error);
      toast.error(error.message || 'Erro ao encerrar atendimento.');
      throw error;
    } finally {
      finishJourneyLockRef.current = false;
      setIsFinishing(false);
    }
  }, [
    journeyState.procedimentosSessao,
    procedimentosLote,
    roleUserId,
    journeyState.agendaId,
    resolvePlanejamentoItemId,
    registrarProcedimentoManual,
    resolvePacienteAtendimento,
    persistirMapaAplicacaoAtual,
    uploadProcedureCapturedPhotos,
    finalizarAtendimentoNavegacao,
    pacienteAtual?.cpf,
    persistirEncerramentoConsulta,
    selectedPatientCpf,
    setIsFinishing,
    toast,
  ]);

  const finishJourney = async () => {
    // Agora o finishJourney (chamado por outros botões de finalizar antigos) apenas delega para encerrarAtendimento
    await encerrarAtendimento();
  };

  const confirmEncerrarConsulta = React.useCallback(async (decision) => {
    try {
      setFinishingMode(decision);
      await autoSaveAnamneseSilently();
      
      if (decision === 'finalizar') {
        await encerrarAtendimento(false);
      } else {
        await encerrarAtendimento(true);
      }
      setEncerrarConsultaOpen(false);
    } catch (e) {
      console.error('Erro ao encerrar consulta a partir do hub:', e);
    } finally {
      setFinishingMode(null);
    }
  }, [
    autoSaveAnamneseSilently,
    journeyState.observacoesExecucao,
    onSairConsulta,
    encerrarAtendimento,
  ]);

  const handleUploadDocumentFiles = () => {
    // Stub: evita ReferenceError no botão de documentos do widget; implementar envio quando houver API.
  };

  const persistAnnotatedPhotoToGallery = React.useCallback(
    async (blob) => {
      if (!blob || !(blob instanceof Blob)) return { ok: false, skipped: true };
      const pid = pacienteAtual?.id;
      if (!pid) return { ok: false, skipped: true, reason: 'no_server_id' };
      const rid = roleUserId;
      if (!rid || !/^[0-9a-f-]{36}$/i.test(String(rid))) {
        toast.warning(
          'Selecione o profissional na barra de contexto para enviar a foto desenhada à galeria no servidor.'
        );
        return { ok: false, skipped: true };
      }
      pendingAnnotatedGalleryBlobsRef.current.push(blob);
      return { ok: true };
    },
    [pacienteAtual?.id, roleUserId, toast]
  );

  // @deprecated — substituído por activeView:'consulta'. Remover na v2 após confirmar que nenhum call site usa 'jornada'.
  const isJornadaView = activeView === 'jornada';
  const isConsultaView = activeView === 'consulta';
  const isAgendaView = activeView === 'agenda';
  const isPaginaPublica =
    typeof window !== 'undefined' && window.location.pathname.startsWith('/c/');
  const isAnamnesePublica = 
    typeof window !== 'undefined' && window.location.pathname.startsWith('/anamnese');
  const isDocumentoPublico =
    typeof window !== 'undefined' && window.location.pathname.startsWith('/documento');
  const isAssinaturaPublica =
    typeof window !== 'undefined' && window.location.pathname.startsWith('/assinar');

  // ============ RENDERIZAÇÃO ============
  if (isPaginaPublica) {
    return <ConfirmacaoPublicaPage />;
  }
  if (isAnamnesePublica) {
    return <AnamnesePage />;
  }
  if (isDocumentoPublico) {
    return <DocumentoPublicoPage />;
  }
  if (isAssinaturaPublica) {
    return <PublicSignatureFlow />;
  }

  if (!authReady) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-[#f0fdfa] to-[#f8fbfb]">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-[#00a88e] border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-[#00a88e] font-bold">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return <LoginForm {...authState} />;
  }

  if (
    isLoggedIn &&
    authUser &&
    authReady &&
    (postLoginGate === null || postLoginGate === 'checking')
  ) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-[#f0fdfa] to-[#f8fbfb]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-[#00a88e] border-t-transparent" />
          <p className="font-bold text-[#00a88e]">Preparando sessão…</p>
        </div>
      </div>
    );
  }

  if (isLoggedIn && authReady && postLoginGate === 'profile') {
    return (
      <CompletarPerfil
        email={authUser?.email}
        onComplete={() => {
          setPostLoginGate('cadastrar-clinica');
        }}
      />
    );
  }

  if (isLoggedIn && authReady && postLoginGate === 'cadastrar-clinica') {
    return (
      <CadastrarClinica
        onComplete={(organizacaoId) => {
          if (organizacaoId) setOrgId(String(organizacaoId));
          setPostLoginGate('ready');
        }}
      />
    );
  }

  if (isLoggedIn && authReady && postLoginGate === 'clinic') {
    return (
      <SelecionarClinica
        setOrgId={setOrgId}
        onComplete={() => {
          setPostLoginGate('ready');
        }}
      />
    );
  }

  return (
    <div className="flex min-h-dvh md:h-screen flex-col md:flex-row font-sans overflow-x-hidden bg-app-canvas text-app-ink md:overflow-hidden">

      {/* Guard de alterações não salvas no Horário de Atendimento */}
      <UnsavedChangesModal
        isOpen={isUnsavedNavModalOpen}
        onContinue={() => {
          setIsUnsavedNavModalOpen(false);
          pendingNavAction.current = null;
        }}
        onDiscard={() => {
          setIsUnsavedNavModalOpen(false);
          const action = pendingNavAction.current;
          pendingNavAction.current = null;
          action?.();
        }}
      />

      {/* Sidebar */}
      <Sidebar
        activeView={activeView}
        setActiveView={goToViewWithGuard}
        handleLogout={handleLogout}
        authUser={authUser}
        onRailWidthPxChange={setSidebarRailWidthPx}
        clinicaNome={clinicaInfo.nome}
        clinicaSubtitulo={clinicaInfo.subtitulo}
        clinicaLogoUrl={clinicaInfo.logoUrl}
        perfilNomeCompleto={perfilInfo.nomeCompleto}
        perfilFotoUrl={perfilInfo.fotoUrl}
        onOpenClinicaSettings={onOpenClinicaSettings}
        onOpenPerfilSettings={onOpenPerfilSettings}
      />

      {/* Main Content */}
      <main
        className={`flex flex-1 flex-col h-full min-h-0 ${
          isJornadaView || isConsultaView
            ? 'overflow-hidden pb-[calc(5rem+env(safe-area-inset-bottom,0px))] lg:pb-0'
            : isAgendaView
              ? 'overflow-hidden max-lg:overflow-y-auto pb-[calc(4rem+env(safe-area-inset-bottom,0px))] lg:pb-0'
              : `overflow-y-auto pb-[calc(4rem+env(safe-area-inset-bottom,0px))] lg:pb-0`
        }`}
      >
        {isJornadaView && (
        <header
          className={`border-b border-app-border shadow-app-card ${
            isJornadaView
              ? 'sticky top-0 z-10 shrink-0 bg-[#f8fbfb] px-4 py-6 sm:px-6 md:px-10 sm:py-8'
              : `z-0 bg-white ${
                  activeView === 'configuracoes'
                    ? 'px-4 sm:px-5 md:px-8 lg:px-10 py-3 sm:py-3.5 md:py-4'
                    : 'px-4 sm:px-6 md:px-10 py-6 sm:py-8'
                }`
          }`}
        >
          {/* @deprecated — substituído por activeView:'consulta'. Remover na v2 após confirmar que nenhum call site usa 'jornada'. */}
          {activeView === 'jornada' ? (
            <>
              <JourneyPatientContextHeader
                pacienteAtual={pacienteAtual}
                onCancelJourney={onCancelJourney}
                getPatientInitials={getPatientInitials}
              />
              <Stepper currentStep={currentStep} />
            </>
          ) : null}
        </header>
        )}

        {/* @deprecated — substituído por isConsultaView + consultaModule. Remover na v2 após confirmar que nenhum call site usa 'jornada'. */}
        {isJornadaView ? (
          <>
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto">
                <div className="mx-auto w-full max-w-[1600px] p-3 pb-28 [-webkit-overflow-scrolling:touch] sm:p-6 md:px-8 md:pt-8 md:pb-28">
                  <div className={`rounded-[20px] border border-app-border bg-white shadow-app-card ${
                    currentStep === 1
                      ? 'p-3 pb-4 sm:p-5 sm:pb-5 md:p-6 md:pb-6'
                      : 'p-4 pb-5 sm:p-8 sm:pb-6 md:pb-8'
                  }`}>
                  <div key={currentStep} className="animate-in fade-in slide-in-from-right-4 duration-200">
                  {currentStep === 1 && (
                    <Step2Anamnese
                      onAutoSaveAnamnese={autoSaveAnamneseSilently}
                      ref={anamneseRef}
                      queixa={journeyState.queixa}
                      setQueixa={journeyState.setQueixa}
                      expectativas={journeyState.expectativas}
                      setExpectativas={journeyState.setExpectativas}
                      pacienteId={pacienteAtual?.id || null}
                      pacienteSexo={pacienteAtual?.sexo || null}
                      roleUserId={roleUserId}
                      step2Errors={journeyState.step2Errors}
                      setStep2Errors={journeyState.setStep2Errors}
                      savedAnamneseState={journeyState.step2AnamneseDraft}
                      onSavedAnamneseStateChange={journeyState.setStep2AnamneseDraft}
                      respostasAnamnese={journeyState.respostasAnamnese}
                      salvarRespostaAnamnese={journeyState.salvarRespostaAnamnese}
                      setRespostasAnamnese={journeyState.setRespostasAnamnese}
                      onQueixaVisibilityChange={setQueixaVisivel}
                      perfilClinicoDraft={journeyState.step2PerfilClinicoDraft ?? null}
                      onPerfilClinicoDraftChange={journeyState.setStep2PerfilClinicoDraft ?? (() => {})}
                    />
                  )}

                  {currentStep === 2 && (
                    <Step3Evaluation
                      pacienteId={pacienteAtual?.id ?? null}
                      roleUserId={roleUserId ?? null}
                      sidebarInsetPx={sidebarRailWidthPx}
                      observacoes={journeyState.observacoes}
                      setObservacoes={journeyState.setObservacoes}
                      pendingCapture={pendingMapeamentoCapture}
                      onCaptureConsumed={() => setPendingMapeamentoCapture(null)}
                      onPrepareCapture={handlePrepareMapeamentoCapture}
                      onGerarPlanoSuccess={(result) => {
                        if (result?.planejamentoId) {
                          journeyState.setJourneyPlanejamentoCtx({
                            planejamentoId: result.planejamentoId,
                            itemIdByCatalogo: result.itemIdByCatalogo ?? {},
                            procedimentosComPontos: Array.isArray(result.procedimentosComPontos)
                              ? result.procedimentosComPontos
                              : [],
                          });
                        }
                      }}
                      onStepComplete={(planoSnapshot) => {
                        if (planoSnapshot?.planejamentoId) {
                          journeyState.setJourneyPlanejamentoCtx({
                            planejamentoId: planoSnapshot.planejamentoId,
                            itemIdByCatalogo: planoSnapshot.itemIdByCatalogo ?? {},
                            procedimentosComPontos: Array.isArray(planoSnapshot.procedimentosComPontos)
                              ? planoSnapshot.procedimentosComPontos
                              : [],
                          });
                        }
                        setCurrentStep(3);
                      }}
                      profissionalLogadoNome={perfilInfo?.nomeCompleto ?? ''}
                      onAgendarPlanejamentoItem={(row, onSaved) => {
                        if (!pacienteAtual?.id || !roleUserId) return;
                        agendaSchedule.openCreateModalForPatient(
                          {
                            id: pacienteAtual.id,
                            nome: pacienteAtual.nome,
                            telefone:
                              pacienteAtual.telefone ||
                              pacienteAtual.phone ||
                              pacienteAtual.telefoneNumero ||
                              pacienteAtual.telefonePrincipal ||
                              '',
                          },
                          {
                            catalogoProcedimentoSaudeIds: [
                              String(row.catalogoProcedimentoSaudeId).trim(),
                            ],
                            planejamentoItemId: row.planejamentoItemId,
                            planejamentoItemIdPorCatalogo: {
                              [String(row.catalogoProcedimentoSaudeId).trim()]:
                                row.planejamentoItemId,
                            },
                            profissionalRoleUserId: roleUserId,
                            onAgendaSaved: onSaved,
                          }
                        );
                      }}
                    />
                  )}

                  {currentStep === 3 && (
                    <Step3Termos
                      termoLido={journeyState.termoLido}
                      setTermoLido={journeyState.setTermoLido}
                      termoAssinaturaDataUrl={journeyState.termoAssinaturaDataUrl}
                      setTermoAssinaturaDataUrl={journeyState.setTermoAssinaturaDataUrl}
                      setTermoAssinado={journeyState.setTermoAssinado}
                      profissionalAssinaturaDataUrl={journeyState.profissionalAssinaturaDataUrl}
                      setProfissionalAssinaturaDataUrl={journeyState.setProfissionalAssinaturaDataUrl}
                      step4Errors={journeyState.step4Errors}
                      setStep4Errors={journeyState.setStep4Errors}
                      termosAssinados={journeyState.termosAssinados}
                      setTermosAssinados={journeyState.setTermosAssinados}
                      termosPendentesIds={journeyState.termosPendentesIds}
                      setTermosPendentesIds={journeyState.setTermosPendentesIds}
                      termoTitulo={journeyTermoTitulo || undefined}
                      termoConteudo={journeyTermoConteudo || undefined}
                      onTermoChange={(id) => journeyState.setTermoSelecionadoId(id)}
                      pacienteId={pacienteAtual?.id ?? null}
                      procedimentoFeitoId={loteProcedimentosFeitosIds[0] ?? null}
                      roleUserId={roleUserId ?? null}
                      onAssinaturaSalva={handleTermoAssinaturaSalva}
                      pacienteCtx={{
                        nome: pacienteAtual?.nomeCompleto || pacienteAtual?.nome,
                        cpf: pacienteAtual?.cpf,
                        telefone:
                          pacienteAtual?.telefone ||
                          pacienteAtual?.phone ||
                          pacienteAtual?.telefoneNumero ||
                          pacienteAtual?.telefonePrincipal,
                      }}
                      clinicaCtx={{
                        nome: clinicaInfo?.nome,
                        cnpj: clinicaInfo?.cnpj,
                        endereco: clinicaInfo?.endereco,
                        telefone: clinicaInfo?.telefone,
                        clinicSlug: clinicaInfo?.slug
                      }}
                      profissionalCtx={{
                        nome: perfilInfo?.nomeCompleto,
                        cpf: perfilInfo?.cpf || perfilInfo?.crm,
                        telefone: perfilInfo?.telefone
                      }}
                    />
                  )}

                  {currentStep === 4 && (
                    <Step4Procedimento
                      onAutoSaveProcedimento={autoSaveProcedimentoSilently}
                      pacienteIdForProcedures={pacienteAtual?.id || null}
                      nomeProcedimento={journeyState.nomeProcedimento}
                      setNomeProcedimento={journeyState.setNomeProcedimento}
                      setNomeProcedimentoCatalogoId={journeyState.setNomeProcedimentoCatalogoId}
                      observacoesExecucao={journeyState.observacoesExecucao}
                      setObservacoesExecucao={journeyState.setObservacoesExecucao}
                      procedureCapturedPhotos={cameraState.procedureCapturedPhotos}
                      procedurePhotoMax={cameraState.EVALUATION_PHOTO_MAX}
                      onProcedureUploadFiles={(files, cat) =>
                        cameraState.uploadProcedureFiles(files, cat)
                      }
                      onProcedureOpenCamera={cameraState.openPhotoModal}
                      onClearMapaCaptureIntent={() => { mapaAplicacaoCaptureVistaRef.current = null; }}
                      onProcedureRemovePhoto={cameraState.removeProcedurePhoto}
                      step4Errors={journeyState.step4Errors}
                      setStep4Errors={journeyState.setStep4Errors}
                      fotosAvaliacao={cameraState.evaluationCapturedPhotos ?? []}
                      onProcedureFotoCategoriaSync={cameraState.setProcedureFotoCategoria}
                      onProcedureAnnotatePhoto={openProcedurePhotoAnnotation}
                      mapaState={mapaAplicacaoState}
                      roleUserId={roleUserId}
                      procedimentoFeitoId={loteProcedimentosFeitosIds[0]}
                      catalogoId={journeyState.nomeProcedimentoCatalogoId}
                      planejamentoItemId={resolvePlanejamentoItemId(
                        journeyState.nomeProcedimentoCatalogoId,
                      )}
                      planejamentoId={journeyState.journeyPlanejamentoCtx?.planejamentoId ?? null}
                      procedimentosComPontos={
                        journeyState.journeyPlanejamentoCtx?.procedimentosComPontos ?? []
                      }
                      sidebarInsetPx={sidebarRailWidthPx}
                      pendingMapaCapture={pendingMapaAplicacaoCapture}
                      onMapaCaptureConsumed={() => setPendingMapaAplicacaoCapture(null)}
                      onPrepareMapaCapture={handlePrepareMapaAplicacaoCapture}
                      onEnsureProcedimento={() =>
                        ensureProcedimentoFeitoForMapa(pacienteAtual)
                      }
                      onSugestaoEnviada={setSugestaoProcedimentoEnviada}
                    />
                  )}

                  {currentStep === 5 && (
                    <Step5Finalization
                      key={String(journeyState.nomeProcedimento || '')}
                      procedimentosLote={journeyState.procedimentosSessao?.length > 0 ? journeyState.procedimentosSessao : procedimentosLote}
                      procedureDateIso={journeyProcedureDateIso}
                      proximoRetornoDisplay={journeyState.proximoRetornoDisplay}
                      setProximoRetornoDisplay={journeyState.setProximoRetornoDisplay}
                      orientacoes={journeyState.orientacoes}
                      orientacoesItens={journeyState.orientacoesItens}
                      setOrientacoesItens={journeyState.setOrientacoesItens}
                      orientacoesCarregadas={journeyState.orientacoesCarregadas}
                      setOrientacoesCarregadas={journeyState.setOrientacoesCarregadas}
                      step5Errors={journeyState.step5Errors}
                      setStep5Errors={journeyState.setStep5Errors}
                      pacienteNome={pacienteAtual?.nomeCompleto ?? pacienteAtual?.nome ?? ''}
                      pacienteIdade={pacienteAtual?.idade ?? null}
                      pacienteCpf={pacienteAtual?.cpf ?? ''}
                      telefonePaciente={
                        pacienteAtual?.telefone ||
                        pacienteAtual?.phone ||
                        pacienteAtual?.telefoneNumero ||
                        pacienteAtual?.telefonePrincipal ||
                        ''
                      }
                      nomeProcedimento={journeyState.nomeProcedimento ?? ''}
                      observacoesProcedimento={journeyState.observacoesExecucao ?? ''}
                      queixa={journeyState.queixa ?? ''}
                      alertasAnamnese={[]}
                      alertasAlergia={[]}
                      profissionalAssinaturaDataUrl={journeyState.profissionalAssinaturaDataUrl ?? ''}
                      termoAssinaturaDataUrl={journeyState.termoAssinaturaDataUrl ?? ''}
                      profAssinaturaTimestamp={null}
                      patAssinaturaTimestamp={null}
                      termoTitulo={journeyTermoTitulo ?? ''}
                      fotosAvaliacao={cameraState.evaluationCapturedPhotos ?? []}
                      fotosProcedimento={cameraState.procedureCapturedPhotos ?? []}
                      nomeUsuario={
                        authUser?.nome || authUser?.name || authUser?.email || authUser?.username || ''
                      }
                      onAnnotateEvaluationPhoto={openEvaluationPhotoAnnotationFromSummary}
                      onAnnotateProcedurePhoto={openProcedurePhotoAnnotation}
                    />
                  )}
                  </div>
                </div>
              </div>
            </div>

            {photoAnnotationScope != null &&
            photoAnnotationIndex != null &&
            (photoAnnotationScope === 'procedure'
              ? (cameraState.procedureCapturedPhotos || [])[photoAnnotationIndex]
              : (cameraState.evaluationCapturedPhotos || [])[photoAnnotationIndex]) ? (
              <JourneyPhotoAnnotationEditor
                sidebarInsetPx={sidebarRailWidthPx}
                photos={
                  photoAnnotationScope === 'procedure'
                    ? cameraState.procedureCapturedPhotos || []
                    : cameraState.evaluationCapturedPhotos || []
                }
                editingIndex={photoAnnotationIndex}
                setEditingIndex={setPhotoAnnotationIndex}
                fallbackSelectedPhotoIndex={photoAnnotationIndex}
                saveListLength={
                  (photoAnnotationScope === 'procedure'
                    ? cameraState.procedureCapturedPhotos
                    : cameraState.evaluationCapturedPhotos
                  )?.length ?? 0
                }
                imageSrc={journeyState.imageSrc}
                activeTool={journeyState.activeTool}
                setActiveTool={journeyState.setActiveTool}
                activeColor={journeyState.activeColor}
                setActiveColor={journeyState.setActiveColor}
                pointSize={journeyState.pointSize}
                setPointSize={journeyState.setPointSize}
                showPointNumbers={journeyState.showPointNumbers}
                setShowPointNumbers={journeyState.setShowPointNumbers}
                eraserSize={journeyState.eraserSize}
                setEraserSize={journeyState.setEraserSize}
                cursorPos={journeyState.cursorPos}
                setCursorPos={journeyState.setCursorPos}
                isHoveringCanvas={journeyState.isHoveringCanvas}
                setIsHoveringCanvas={journeyState.setIsHoveringCanvas}
                paths={journeyState.paths}
                setPaths={journeyState.setPaths}
                isDrawing={journeyState.isDrawing}
                setIsDrawing={journeyState.setIsDrawing}
                canvasRef={canvasRef}
                containerRef={containerRef}
                evaluationAnnotatedPhotoUrl={journeyState.evaluationAnnotatedPhotoUrl}
                setEvaluationAnnotatedPhotoUrl={journeyState.setEvaluationAnnotatedPhotoUrl}
                selectedPatientCpf={selectedPatientCpf}
                cpf={pacienteAtual?.cpf || ''}
                setPatients={setPatients}
                onSelectCapturedPhoto={(i) => {
                  if (photoAnnotationScope === 'procedure') {
                    const ph = (cameraState.procedureCapturedPhotos || [])[i];
                    if (ph?.url) {
                      journeyState.setImageSrc(ph.url);
                      journeyState.setPaths([]);
                    }
                    setPhotoAnnotationIndex(i);
                  } else {
                    handleSelectCapturedPhoto(i);
                    setPhotoAnnotationIndex(i);
                  }
                }}
                onAnnotatedCaptureSaved={
                  photoAnnotationScope === 'procedure'
                    ? ({ index, newUrl, blob }) => {
                        cameraState.replaceProcedureCapturedPhotoAt(index, { url: newUrl, blob });
                        journeyState.setImageSrc(newUrl);
                        journeyState.setPaths([]);
                      }
                    : handleAnnotatedCaptureSaved
                }
                persistAnnotatedPhotoToGallery={
                  photoAnnotationScope === 'evaluation' ? persistAnnotatedPhotoToGallery : undefined
                }
                onClose={closeJourneyPhotoAnnotation}
              />
            ) : null}

            <div
              className="pointer-events-none fixed inset-x-0 bottom-0 z-[30] hidden md:block"
              style={{ paddingLeft: sidebarRailWidthPx }}
            >
              <div className="pointer-events-auto border-t border-[#e2e8f0] bg-white px-6 py-4 shadow-[0_-4px_24px_rgba(15,23,42,0.06)]">
                <div className="mx-auto grid w-full max-w-[1600px] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4">
                  <div className="flex justify-start">
                    <button
                      type="button"
                      onClick={prevStep}
                      disabled={currentStep === 1 || isFinishing}
                      className={`flex items-center justify-center gap-2 rounded-xl border-[2px] px-5 py-2.5 text-[13px] font-semibold outline-none transition-all ${
                        currentStep === 1 || isFinishing
                          ? 'cursor-not-allowed border-[#e2e8f0] bg-[#f8fbfb] text-[#94a3b8]'
                          : 'border-[#e2e8f0] bg-white text-[#00a88e] hover:border-[#00a88e]/40 hover:bg-[#f0fdf9]'
                      }`}
                    >
                      <ChevronLeft className="h-4 w-4" strokeWidth={3} /> Anterior
                    </button>
                  </div>
                  <p className="text-center text-[12px] font-medium text-[#94a3b8]">
                    Etapa {currentStep} de 5
                  </p>
                  <div className="flex justify-end">
                    {currentStep < 5 ? (
                      <button
                        type="button"
                        onClick={handleNextStep}
                        disabled={isFinishing || (currentStep === 1 && step1Busy)}
                        className="flex h-11 items-center justify-center gap-2 rounded-xl border border-transparent bg-[#00a88e] px-6 text-[14px] font-semibold text-white shadow-sm outline-none transition-all hover:bg-[#00967f] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {currentStep === 1 && step1Busy ? 'Salvando…' : 'Próximo'}{' '}
                        {!(currentStep === 1 && step1Busy) && (
                          <ChevronRight className="h-4 w-4" strokeWidth={3} />
                        )}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleNextStep}
                        disabled={
                          isFinishing ||
                          !journeyState.orientacoes ||
                          step5RetornoBloqueiaFinal
                        }
                        className={`flex h-11 items-center justify-center gap-2 rounded-xl border border-transparent px-6 text-[14px] font-semibold shadow-sm outline-none transition-all ${
                          journeyState.orientacoes &&
                          !step5RetornoBloqueiaFinal &&
                          !isFinishing
                            ? 'animate-pulse bg-[#22c55e] text-white hover:bg-[#16a34a]'
                            : 'cursor-not-allowed bg-[#f1f5f9] text-[#64748b]'
                        }`}
                      >
                        {isFinishing
                          ? 'Salvando...'
                          : !journeyState.orientacoes
                            ? 'Confirme as orientações para finalizar'
                            : step5RetornoBloqueiaFinal
                              ? 'Corrija a data de retorno'
                              : 'Finalizar Atendimento ✓'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

            <div className="fixed inset-x-0 bottom-0 z-[125] flex h-16 min-h-[4rem] items-center gap-2 border-t border-[#e2e8f0] bg-white px-3 pb-[env(safe-area-inset-bottom)] pt-1 md:hidden">
              <button
                type="button"
                onClick={prevStep}
                disabled={currentStep === 1 || isFinishing}
                className={`flex min-h-[44px] shrink-0 items-center justify-center gap-1 rounded-xl border-[2px] px-4 text-[14px] font-semibold ${
                  currentStep === 1 || isFinishing
                    ? 'cursor-not-allowed border-[#e2e8f0] bg-[#f8fbfb] text-[#94a3b8]'
                    : 'border-[#e2e8f0] bg-white text-[#00a88e] active:border-[#00a88e]/40'
                }`}
              >
                <ChevronLeft className="h-4 w-4" strokeWidth={3} aria-hidden />
                <span>Anterior</span>
              </button>
              <p className="min-w-0 flex-1 text-center text-[11px] font-medium text-[#94a3b8]">
                Etapa {currentStep} de 5
              </p>
              <button
                type="button"
                onClick={handleNextStep}
                disabled={
                  isFinishing ||
                  (currentStep === 1 && step1Busy) ||
                  (currentStep === 5 &&
                    (!journeyState.orientacoes || step5RetornoBloqueiaFinal))
                }
                className={`flex min-h-[44px] max-w-[160px] flex-1 items-center justify-center gap-1 rounded-xl border border-transparent px-3 text-[14px] font-semibold text-white ${
                  currentStep < 5
                    ? isFinishing || (currentStep === 1 && step1Busy)
                      ? 'cursor-not-allowed bg-[#00a88e]/50'
                      : 'bg-[#00a88e] active:bg-[#00967f]'
                    : journeyState.orientacoes &&
                        !step5RetornoBloqueiaFinal &&
                        !isFinishing
                      ? 'animate-pulse bg-[#22c55e] active:bg-[#16a34a]'
                      : 'cursor-not-allowed bg-[#f1f5f9] text-[#64748b]'
                }`}
              >
                {currentStep < 5 ? (
                  currentStep === 1 && step1Busy ? (
                    'Salvando…'
                  ) : (
                    <>
                      Próximo <ChevronRight className="h-4 w-4" strokeWidth={3} aria-hidden />
                    </>
                  )
                ) : isFinishing ? (
                  'Salvando...'
                ) : !journeyState.orientacoes ? (
                  'Finalizar'
                ) : step5RetornoBloqueiaFinal ? (
                  'Data inválida'
                ) : (
                  'Finalizar ✓'
                )}
              </button>
            </div>
          </>
        ) : isConsultaView ? (
          <>
            <header className="sticky top-0 z-10 shrink-0 border-b border-app-border bg-[#f8fbfb] px-4 py-4 shadow-app-card sm:px-6 sm:py-6 md:px-10">
              <ConsultaModuleHeader
                paciente={pacienteAtual}
                module={consultaModule}
                isRetorno={journeyState.isAgendaRetorno}
                onBack={consultaModule !== 'hub' ? () => setConsultaModule('hub') : undefined}
                getPatientInitials={getPatientInitials}
              />
            </header>
            <ConsultaViewShell>
              <div key={consultaModule} className="animate-in fade-in slide-in-from-right-4 duration-200">
                {consultaModule === 'hub' ? (
                  <ConsultaHub
                    paciente={pacienteAtual}
                    isRetorno={journeyState.isAgendaRetorno}
                    onSelectModule={setConsultaModule}
                    onIniciarRetornoAvulso={handleIniciarRetornoAvulso}
                    onEncerrarConsulta={requestEncerrarConsulta}
                    getPatientInitials={getPatientInitials}
                  />
                ) : null}
                {consultaModule === 'retorno' ? (
                  <ConsultaRetornoFlow
                    retornoAvaliacao={journeyState.retornoAvaliacao}
                    setRetornoAvaliacao={journeyState.setRetornoAvaliacao}
                    houveRetoque={journeyState.houveRetoque}
                    setHouveRetoque={journeyState.setHouveRetoque}
                    evaluationCapturedPhotos={cameraState.evaluationCapturedPhotos ?? []}
                    evaluationPhotoMax={cameraState.EVALUATION_PHOTO_MAX}
                    onEvaluationUploadFiles={cameraState.uploadPhotoFiles}
                    onEvaluationRemovePhoto={cameraState.removeEvaluationPhoto}
                    onConcluirRetorno={handleConcluirRetorno}
                    isConcluirBusy={isSalvandoRetorno}
                  />
                ) : null}
                {consultaModule === 'anamnese' && !journeyState.isAgendaRetorno ? (
                  <Step2Anamnese
                    onAutoSaveAnamnese={autoSaveAnamneseSilently}
                    ref={anamneseRef}
                    queixa={journeyState.queixa}
                    setQueixa={journeyState.setQueixa}
                    expectativas={journeyState.expectativas}
                    setExpectativas={journeyState.setExpectativas}
                    pacienteId={pacienteAtual?.id || null}
                    pacienteSexo={pacienteAtual?.sexo || null}
                    roleUserId={roleUserId}
                    step2Errors={journeyState.step2Errors}
                    setStep2Errors={journeyState.setStep2Errors}
                    savedAnamneseState={journeyState.step2AnamneseDraft}
                    onSavedAnamneseStateChange={journeyState.setStep2AnamneseDraft}
                    respostasAnamnese={journeyState.respostasAnamnese}
                    salvarRespostaAnamnese={journeyState.salvarRespostaAnamnese}
                    setRespostasAnamnese={journeyState.setRespostasAnamnese}
                    onQueixaVisibilityChange={setQueixaVisivel}
                    perfilClinicoDraft={journeyState.step2PerfilClinicoDraft ?? null}
                    onPerfilClinicoDraftChange={journeyState.setStep2PerfilClinicoDraft ?? (() => {})}
                    consultaMode
                    onConcluirAnamnese={handleConcluirAnamnese}
                    isConcluirAnamneseBusy={step1Busy}
                  />
                ) : null}
                {consultaModule === 'avaliacao' && !journeyState.isAgendaRetorno ? (
                  <ConsultaAvaliacaoFlow
                    queixa={journeyState.queixa}
                    setQueixa={journeyState.setQueixa}
                    expectativas={journeyState.expectativas}
                    setExpectativas={journeyState.setExpectativas}
                    evaluationCapturedPhotos={cameraState.evaluationCapturedPhotos ?? []}
                    evaluationPhotoMax={cameraState.EVALUATION_PHOTO_MAX}
                    onEvaluationUploadFiles={cameraState.uploadPhotoFiles}
                    onEvaluationRemovePhoto={cameraState.removeEvaluationPhoto}
                    onAnnotatePhoto={openEvaluationPhotoAnnotationForConsulta}
                    onConcluirAvaliacao={handleConcluirAvaliacao}
                    isConcluirBusy={isSalvandoFotosAvaliacao}
                  />
                ) : null}
                {consultaModule === 'planejamento' && !journeyState.isAgendaRetorno ? (
                  <PlanosTab
                    variant="consulta"
                    pacienteId={pacienteAtual?.id ?? null}
                    roleUserId={roleUserId ?? null}
                    pacienteNome={pacienteAtual?.nome ?? ''}
                    onVoltar={() => setConsultaModule('hub')}
                    onAgendarItem={(item, onSaved) =>
                      handleAgendarPlanoItem(pacienteAtual, item, onSaved)
                    }
                    onAgendarRetornoItem={(item, onSaved) =>
                      handleAgendarRetornoPlanoItem(pacienteAtual, item, onSaved)
                    }
                    onConcluirComRetorno={(plano, refresh) =>
                      handleConcluirPlanoComRetorno(pacienteAtual, plano, refresh)
                    }
                  />
                ) : null}
                {consultaModule === 'termos' ? (
                  <Step3Termos
                    termoLido={journeyState.termoLido}
                    setTermoLido={journeyState.setTermoLido}
                    termoAssinaturaDataUrl={journeyState.termoAssinaturaDataUrl}
                    setTermoAssinaturaDataUrl={journeyState.setTermoAssinaturaDataUrl}
                    setTermoAssinado={journeyState.setTermoAssinado}
                    profissionalAssinaturaDataUrl={journeyState.profissionalAssinaturaDataUrl}
                    setProfissionalAssinaturaDataUrl={journeyState.setProfissionalAssinaturaDataUrl}
                    step4Errors={journeyState.step4Errors}
                    setStep4Errors={journeyState.setStep4Errors}
                    termosAssinados={journeyState.termosAssinados}
                    setTermosAssinados={journeyState.setTermosAssinados}
                    termosPendentesIds={journeyState.termosPendentesIds}
                    setTermosPendentesIds={journeyState.setTermosPendentesIds}
                    termoTitulo={journeyTermoTitulo || undefined}
                    termoConteudo={journeyTermoConteudo || undefined}
                    onTermoChange={(id) => journeyState.setTermoSelecionadoId(id)}
                    pacienteId={pacienteAtual?.id ?? null}
                    procedimentoFeitoId={loteProcedimentosFeitosIds[0] ?? null}
                    roleUserId={roleUserId ?? null}
                    onAssinaturaSalva={handleTermoAssinaturaSalva}
                    pacienteCtx={{
                      nome: pacienteAtual?.nomeCompleto || pacienteAtual?.nome,
                      cpf: pacienteAtual?.cpf,
                      telefone:
                        pacienteAtual?.telefone ||
                        pacienteAtual?.phone ||
                        pacienteAtual?.telefoneNumero ||
                        pacienteAtual?.telefonePrincipal,
                    }}
                    clinicaCtx={{
                      nome: clinicaInfo?.nome,
                      cnpj: clinicaInfo?.cnpj,
                      endereco: clinicaInfo?.endereco,
                      telefone: clinicaInfo?.telefone,
                    }}
                    profissionalCtx={{
                      nome: perfilInfo?.nomeCompleto,
                      cpf: perfilInfo?.cpf || perfilInfo?.crm,
                      telefone: perfilInfo?.telefone,
                    }}
                    onConcluir={() => setConsultaModule('hub')}
                  />
                ) : null}
                {consultaModule === 'procedimento' && !journeyState.isAgendaRetorno ? (
                  <ConsultaProcedimentoFlow
                    pacienteIdForProcedures={pacienteAtual?.id || null}
                    nomeProcedimento={journeyState.nomeProcedimento}
                    setNomeProcedimento={journeyState.setNomeProcedimento}
                    setNomeProcedimentoCatalogoId={journeyState.setNomeProcedimentoCatalogoId}
                    procedimentosLote={journeyState.procedimentosSessao?.length > 0 ? journeyState.procedimentosSessao : procedimentosLote}
                    activeProcedimentoIndex={journeyState.activeProcedureIndex}
                    setActiveProcedimentoIndex={journeyState.setActiveProcedureIndex}
                    updateProcedureByIndex={journeyState.updateProcedureByIndex}
                    observacoesExecucao={journeyState.observacoesExecucao}
                    setObservacoesExecucao={journeyState.setObservacoesExecucao}
                    procedureCapturedPhotos={cameraState.procedureCapturedPhotos}
                    setProcedureCapturedPhotos={cameraState.setProcedureCapturedPhotos}
                    procedurePhotoMax={cameraState.EVALUATION_PHOTO_MAX}
                    onProcedureUploadFiles={(files, cat) => cameraState.uploadProcedureFiles(files, cat)}
                    onProcedureOpenCamera={cameraState.openPhotoModal}
                    onClearMapaCaptureIntent={() => { mapaAplicacaoCaptureVistaRef.current = null; }}
                    onProcedureRemovePhoto={cameraState.removeProcedurePhoto}
                    step4Errors={journeyState.step4Errors}
                    setStep4Errors={journeyState.setStep4Errors}
                    fotosAvaliacao={cameraState.evaluationCapturedPhotos ?? []}
                    onProcedureFotoCategoriaSync={cameraState.setProcedureFotoCategoria}
                    onProcedureAnnotatePhoto={openProcedurePhotoAnnotation}
                    mapaState={mapaAplicacaoState}
                    roleUserId={roleUserId}
                    procedimentoFeitoId={loteProcedimentosFeitosIds[0]}
                    catalogoId={journeyState.nomeProcedimentoCatalogoId}
                    planejamentoItemId={resolvePlanejamentoItemId(
                      journeyState.nomeProcedimentoCatalogoId,
                    )}
                    planejamentoId={journeyState.journeyPlanejamentoCtx?.planejamentoId ?? null}
                    procedimentosComPontos={
                      journeyState.journeyPlanejamentoCtx?.procedimentosComPontos ?? []
                    }
                    sidebarInsetPx={sidebarRailWidthPx}
                    pendingMapaCapture={pendingMapaAplicacaoCapture}
                    onMapaCaptureConsumed={() => setPendingMapaAplicacaoCapture(null)}
                    onPrepareMapaCapture={handlePrepareMapaAplicacaoCapture}
                    onEnsureProcedimento={() =>
                      ensureProcedimentoFeitoForMapa(pacienteAtual)
                    }
                    sugestaoProcedimentoEnviada={sugestaoProcedimentoEnviada}
                    onSugestaoEnviada={setSugestaoProcedimentoEnviada}
                    procedureDateIso={journeyProcedureDateIso}
                    proximoRetornoDisplay={journeyState.proximoRetornoDisplay}
                    setProximoRetornoDisplay={journeyState.setProximoRetornoDisplay}
                    orientacoes={journeyState.orientacoes}
                    orientacoesItens={journeyState.orientacoesItens}
                    setOrientacoesItens={journeyState.setOrientacoesItens}
                    orientacoesCarregadas={journeyState.orientacoesCarregadas}
                    setOrientacoesCarregadas={journeyState.setOrientacoesCarregadas}
                    step5Errors={journeyState.step5Errors}
                    setStep5Errors={journeyState.setStep5Errors}
                    pacienteNome={pacienteAtual?.nome ?? ''}
                    pacienteIdade={pacienteAtual?.idade ?? null}
                    pacienteCpf={pacienteAtual?.cpf ?? ''}
                    telefonePaciente={
                      pacienteAtual?.telefone ||
                      pacienteAtual?.phone ||
                      pacienteAtual?.telefoneNumero ||
                      pacienteAtual?.telefonePrincipal ||
                      ''
                    }
                    queixa={journeyState.queixa ?? ''}
                    profissionalAssinaturaDataUrl={journeyState.profissionalAssinaturaDataUrl ?? ''}
                    termoAssinaturaDataUrl={journeyState.termoAssinaturaDataUrl ?? ''}
                    termoTitulo={journeyTermoTitulo ?? ''}
                    nomeUsuario={
                      authUser?.nome || authUser?.name || authUser?.email || authUser?.username || ''
                    }
                    onAnnotateEvaluationPhoto={openEvaluationPhotoAnnotationFromSummary}
                    onAnnotateProcedurePhoto={openProcedurePhotoAnnotation}
                    encerrarAtendimento={encerrarAtendimento}
                    isSalvandoProcedimento={isSalvandoProcedimento}
                    isFinishing={isFinishing}
                    step5RetornoBloqueiaFinal={step5RetornoBloqueiaFinal}
                    toast={toast}
                  />
                ) : null}
                {consultaModule !== 'hub' ? (
                  <ConsultaEncerrarFooter onEncerrarConsulta={requestEncerrarConsulta} />
                ) : null}
              </div>
            </ConsultaViewShell>

            <ConsultaEncerrarConfirmModal
              open={encerrarConsultaOpen}
              message={getEncerrarConsultaMessage(consultaModule, pacienteAtual?.nome)}
              onCancel={cancelEncerrarConsulta}
              onConfirm={confirmEncerrarConsulta}
              finishingMode={finishingMode}
            />

            <ConsultaRetornoOrigemModal
              key={retornoAvulsoPickerOpen ? `retorno-origem-${pacienteAtual?.id}` : 'retorno-origem-closed'}
              open={retornoAvulsoPickerOpen}
              pacienteId={pacienteAtual?.id}
              onClose={() => setRetornoAvulsoPickerOpen(false)}
              onConfirm={handleRetornoAvulsoPaiEscolhido}
            />

            {photoAnnotationScope != null &&
            photoAnnotationIndex != null &&
            (photoAnnotationScope === 'procedure'
              ? (cameraState.procedureCapturedPhotos || [])[photoAnnotationIndex]
              : (cameraState.evaluationCapturedPhotos || [])[photoAnnotationIndex]) ? (
              <JourneyPhotoAnnotationEditor
                sidebarInsetPx={sidebarRailWidthPx}
                photos={
                  photoAnnotationScope === 'procedure'
                    ? cameraState.procedureCapturedPhotos || []
                    : cameraState.evaluationCapturedPhotos || []
                }
                editingIndex={photoAnnotationIndex}
                setEditingIndex={setPhotoAnnotationIndex}
                fallbackSelectedPhotoIndex={photoAnnotationIndex}
                saveListLength={
                  (photoAnnotationScope === 'procedure'
                    ? cameraState.procedureCapturedPhotos
                    : cameraState.evaluationCapturedPhotos
                  )?.length ?? 0
                }
                imageSrc={journeyState.imageSrc}
                activeTool={journeyState.activeTool}
                setActiveTool={journeyState.setActiveTool}
                activeColor={journeyState.activeColor}
                setActiveColor={journeyState.setActiveColor}
                pointSize={journeyState.pointSize}
                setPointSize={journeyState.setPointSize}
                showPointNumbers={journeyState.showPointNumbers}
                setShowPointNumbers={journeyState.setShowPointNumbers}
                eraserSize={journeyState.eraserSize}
                setEraserSize={journeyState.setEraserSize}
                cursorPos={journeyState.cursorPos}
                setCursorPos={journeyState.setCursorPos}
                isHoveringCanvas={journeyState.isHoveringCanvas}
                setIsHoveringCanvas={journeyState.setIsHoveringCanvas}
                paths={journeyState.paths}
                setPaths={journeyState.setPaths}
                isDrawing={journeyState.isDrawing}
                setIsDrawing={journeyState.setIsDrawing}
                canvasRef={canvasRef}
                containerRef={containerRef}
                evaluationAnnotatedPhotoUrl={journeyState.evaluationAnnotatedPhotoUrl}
                setEvaluationAnnotatedPhotoUrl={journeyState.setEvaluationAnnotatedPhotoUrl}
                selectedPatientCpf={selectedPatientCpf}
                cpf={pacienteAtual?.cpf || ''}
                setPatients={setPatients}
                onSelectCapturedPhoto={(i) => {
                  if (photoAnnotationScope === 'procedure') {
                    const ph = (cameraState.procedureCapturedPhotos || [])[i];
                    if (ph?.url) {
                      journeyState.setImageSrc(ph.url);
                      journeyState.setPaths([]);
                    }
                    setPhotoAnnotationIndex(i);
                  } else {
                    handleSelectCapturedPhoto(i);
                    setPhotoAnnotationIndex(i);
                  }
                }}
                onAnnotatedCaptureSaved={
                  photoAnnotationScope === 'procedure'
                    ? ({ index, newUrl, blob }) => {
                        cameraState.replaceProcedureCapturedPhotoAt(index, { url: newUrl, blob });
                        journeyState.setImageSrc(newUrl);
                        journeyState.setPaths([]);
                      }
                    : handleAnnotatedCaptureSaved
                }
                persistAnnotatedPhotoToGallery={
                  photoAnnotationScope === 'evaluation' ? persistAnnotatedPhotoToGallery : undefined
                }
                onClose={closeJourneyPhotoAnnotation}
              />
            ) : null}
          </>
        ) : (
        <>
        <GlobalHeader
          activeView={activeView}
          onPatientSelect={handleGlobalPatientSelect}
          onNovoPaciente={handleGlobalNovoPaciente}
          onAgendamento={handleGlobalAgendamento}
          onOpenNotificacoes={handleOpenNotificacoes}
          notificacoesRefreshKey={notifVersion}
          patientSearchQuery={patientSearchQuery}
          setPatientSearchQuery={setPatientSearchQuery}
        />
        <div
          className={`w-full mx-auto ${
            activeView === 'configuracoes' || activeView === 'gestao-equipe'
              ? 'px-3 pt-2 pb-3 sm:px-6 sm:pt-3 sm:pb-6 md:px-8 md:pt-4 md:pb-8 max-w-[1100px] md:max-w-none lg:max-w-[min(100%,1380px)] xl:max-w-[min(100%,1600px)] 2xl:max-w-[min(100%,1800px)]'
              : isAgendaView
                ? 'flex min-h-0 flex-1 flex-col overflow-hidden px-3 pt-1 pb-3 sm:px-5 sm:pt-2 sm:pb-4 md:px-6 lg:px-6 lg:py-4 xl:px-8 max-w-[1100px] md:max-w-none lg:max-w-[min(100%,1420px)] xl:max-w-[min(100%,1680px)] 2xl:max-w-[min(100%,1720px)]'
                : activeView === 'pacientes'
                  ? 'px-3 pt-1 pb-6 sm:px-5 sm:pt-2 sm:pb-8 md:px-6 md:pt-2 md:pb-8 lg:px-8 lg:pt-3 lg:pb-10 xl:px-10 max-w-[1100px] md:max-w-none lg:max-w-[min(100%,1420px)] xl:max-w-[min(100%,1680px)] 2xl:max-w-[min(100%,1920px)] flex flex-col'
                  : 'p-3 sm:p-6 md:p-8 max-w-[1600px]'
          }`}
        >
          <div
            className={
              isAgendaView
                ? 'flex min-h-0 flex-1 flex-col overflow-hidden p-3 sm:p-4 lg:p-5'
                : activeView === 'pacientes'
                  ? 'flex flex-col p-4 sm:p-5 md:p-6 lg:p-8 pb-6 sm:pb-8'
                  : activeView === 'configuracoes' || activeView === 'gestao-equipe'
                  ? 'rounded-[20px] border border-app-border bg-white px-4 pt-3 pb-5 shadow-app-card sm:px-6 sm:pt-4 sm:pb-6 md:px-8 md:pt-5 md:pb-8'
                  : 'rounded-[20px] border border-app-border bg-white p-4 pb-5 shadow-app-card sm:p-8 sm:pb-6'
            }
          >

            {activeView === 'pacientes' && (
              <RoleGuard requiredPermission="PACIENTE_VER" minLevel="NIVEL_1" showError>
                <PatientsView
                  isRecepcionista={isRecepcionista}
                  patients={patients}
                  patientView={patientView}
                  selectedPatientCpf={selectedPatientCpf}
                  setSelectedPatientCpf={setSelectedPatientCpf}
                  patientDetailTab={patientDetailTab}
                  setPatientDetailTab={setPatientDetailTab}
                  setPatientView={setPatientView}
                  patientSearchQuery={patientSearchQuery}
                  setPatientSearchQuery={setPatientSearchQuery}
                  getPatientInitials={getPatientInitials}
                  onCreatePatient={handleCreatePatientFromPatients}
                  onStartAttendance={handleStartAttendance}
                  onAgendarPaciente={(p) => agendaSchedule.openCreateModalForPatient(p)}
                  onReagendarPlanoItem={handleReagendarPlanoItem}
                  onUpdatePatient={handleUpdatePatientProfile}
                  onAddGalleryFiles={handleAddGalleryFiles}
                  onDeleteGalleryPhoto={handleDeleteGalleryPhoto}
                  onPatientCreated={refreshPatientsAndPagedList}
                  clinicaInfo={clinicaInfo}
                  perfilInfo={perfilInfo}
                  mergePatientById={mergePatientById}
                  refreshPatients={refreshPatientsAndPagedList}
                  patientListItems={patientListItems}
                  patientListPage={patientListPage}
                  setPatientListPage={setPatientListPage}
                  patientListLoading={patientListLoading}
                  patientListMeta={patientListMeta}
                  patientListSortBy={patientListSortBy}
                  setPatientListSortBy={setPatientListSortBy}
                  statusPlanoFilter={statusPlanoFilter}
                  setStatusPlanoFilter={setStatusPlanoFilter}
                  anamneseDesatualizadaFilter={anamneseDesatualizadaFilter}
                  setAnamneseDesatualizadaFilter={setAnamneseDesatualizadaFilter}
                  semRetornoFilter={semRetornoFilter}
                  setSemRetornoFilter={setSemRetornoFilter}
                  ehNovoFilter={ehNovoFilter}
                  setEhNovoFilter={setEhNovoFilter}
                  ehAniversarianteFilter={ehAniversarianteFilter}
                  setEhAniversarianteFilter={setEhAniversarianteFilter}
                  patientListBump={patientListBump}
                  kpi={kpiState}
                  kpiLoading={kpiState.loading}
                  nomeUsuario={perfilInfo.nomeCompleto}
                  onNavigateToAgenda={() => goToViewWithGuard('agenda')}
                  roleUserId={roleUserId}
                  patientQuickFilter={patientQuickFilter}
                  setPatientQuickFilter={setPatientQuickFilter}
                  captureProfileNavSnapshot={captureProfileNavSnapshot}
                  navigateProfilePatient={navigateProfilePatient}
                  profileNav={profileNav}
                  clearProfileNavSnapshot={clearProfileNavSnapshot}
                  clinicSlug={clinicaInfo.slug}
                  agendaSchedule={agendaSchedule}
                />
              </RoleGuard>
            )}

            {activeView === 'configuracoes' && (
              <RoleGuard condition={canSeeConfig} showError>
                <ConfiguracoesView
                  canSeeAnamnese={canSeeConfigAnamnese}
                  canSeeProcedimentos={canSeeConfigProcedimentos}
                  canSeeTermos={canSeeConfigTermos}
                  canSeePerfil={canSeeConfigPerfil}
                  canSeeClinica={canSeeConfigClinica}
                  canSeeAgendaConfig={canSeeConfigAgenda}
                  canSeeEquipe={canSeeConfigEquipe}
                  configSection={configSection}
                  setConfigSection={setConfigSection}
                  onClinicaAtualizada={(nome, logoUrl) =>
                    setClinicaInfo({ nome, subtitulo: 'Harmonização Premium', logoUrl: logoUrl ?? '' })
                  }
                  onPerfilAtualizado={(data) => setPerfilInfo((prev) => ({ ...prev, ...data }))}
                  onPacientesCatalogRefresh={refreshPatientsAndPagedList}
                  onDisponibilidadeInvalidate={agendaSchedule.invalidateDisponibilidade}
                  onDirtyHorariosChange={setIsDirtyHorarios}
                />
              </RoleGuard>
            )}

            {activeView === 'gestao-equipe' && (
              <RoleGuard requiredPermission="USUARIO_VER" minLevel="NIVEL_5" showError>
                <GestaoUsuariosView
                  onDisponibilidadeInvalidate={agendaSchedule.invalidateDisponibilidade}
                />
              </RoleGuard>
            )}

            {activeView === 'notificacoes' && (
              <NotificacoesView
                onVoltar={handleVoltarNotificacoes}
                onNavigateToCatalogo={handleNavigateToCatalogo}
                onNavigateToAgenda={handleNavigateToAgenda}
                onNotificacoesChanged={handleNotificacoesChanged}
              />
            )}

            {activeView === 'agenda' && (
              <RoleGuard requiredPermission="AGENDA_VER" minLevel="NIVEL_1" showError>
                <div className="flex min-h-0 flex-1 flex-col">
                <AgendaDashboard
                  agenda={agendaSchedule}
                  patients={patients}
                  clinicaNome={clinicaInfo.nome}
                  clinicaSlug={clinicaInfo.slug}
                  profissionalNome={perfilInfo.nomeCompleto || roleNome}
                  onStartAttendance={handleAgendaStartAttendance}
                  onSlotCancelar={(target) => {
                    const row = scheduleRowFromTarget(target) || (target?.agendaId ? { agenda: target } : null);
                    if (row) setScheduleCancelRow(row);
                  }}
                  onSlotReagendar={handleSlotReagendar}
                  shortcutsBlocked={Boolean(scheduleCancelRow?.agenda)}
                />
                </div>
              </RoleGuard>
            )}

            {/* @deprecated — 'jornada' legado; 'consulta' reservado para ConsultaHub (render-block). */}
            {!['jornada', 'consulta', 'pacientes', 'agenda', 'configuracoes', 'gestao-equipe', 'notificacoes'].includes(activeView) && (
              <div className="p-6 rounded-2xl border border-app-border bg-app-surface text-[#64748b] font-bold text-[14px]">
                Visao nao encontrada.
              </div>
            )}
          </div>
        </div>
        </>
        )}
      </main>

      {!isJornadaView && !isConsultaView ? (
        <MobileNavigation
          activeView={activeView}
          onGoPacientes={() => goToViewWithGuard('pacientes')}
          onGoAgenda={() => goToViewWithGuard('agenda')}
          onGoGestaoEquipe={() => goToViewWithGuard('gestao-equipe')}
          onGoConfiguracoes={() => goToViewWithGuard('configuracoes')}
          onLogout={handleLogout}
        />
      ) : null}

      {finishJourneyModal ? (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-slate-900/45 px-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="finish-journey-modal-title"
            className="w-full max-w-md rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <h4 id="finish-journey-modal-title" className="text-[16px] font-bold text-[#0f172a]">
                {finishJourneyModal.title}
              </h4>
              <button
                type="button"
                onClick={() => closeFinishJourneyModal(false)}
                className="shrink-0 rounded-lg p-2 text-[#64748b] hover:bg-[#f1f5f9]"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" strokeWidth={2.5} />
              </button>
            </div>
            <p className="mt-3 text-[14px] font-medium leading-relaxed text-[#475569]">{finishJourneyModal.message}</p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => closeFinishJourneyModal(false)}
                className="h-10 rounded-lg border border-[#e2e8f0] bg-white px-4 text-[13px] font-semibold text-[#64748b] hover:bg-[#f8fafc]"
              >
                {finishJourneyModal.cancelLabel}
              </button>
              <button
                type="button"
                onClick={() => closeFinishJourneyModal(true)}
                className="h-10 rounded-lg bg-[#00a88e] px-4 text-[13px] font-semibold text-white hover:bg-[#00967f]"
              >
                {finishJourneyModal.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ProcedureCameraWidget
        visible={
          (isConsultaView && ['avaliacao', 'procedimento', 'termos'].includes(consultaModule)) ||
          (activeView === 'jornada' && currentStep >= 2 && currentStep <= 4)
        }
        photoThumbUrl={cameraState.anamnesePhotoUrl}
        photoModalOpen={cameraState.photoModalOpen}
        openPhotoModal={cameraState.openPhotoModal}
        closePhotoModal={cameraState.closePhotoModal}
        videoRef={cameraState.videoRef}
        videoReady={cameraState.videoReady}
        isCameraStarting={cameraState.isCameraStarting}
        photoPreviewUrl={cameraState.photoPreviewUrl}
        photoPreviewBlob={cameraState.photoPreviewBlob}
        cameraError={cameraState.cameraError}
        capturePhoto={cameraState.capturePhoto}
        retakePhoto={cameraState.retakePhoto}
        confirmPhoto={handleConfirmProcedurePhoto}
        uploadPhotoFiles={cameraState.uploadPhotoFiles}
        uploadDocumentFiles={handleUploadDocumentFiles}
        cameraFacing={cameraState.preferredFacing}
        onToggleCameraFacing={cameraState.toggleCameraFacing}
      />

      {authSessionReady ? (
        <>
          <AgendaFormModal agenda={agendaSchedule} />
          <AgendaBloqueioModal agenda={agendaSchedule} />
          {agendaSchedule.foraDispModal}
          {scheduleCancelRow?.agenda ? (
            <CancelarAgendaModal
              agenda={scheduleCancelRow.agenda}
              onClose={() => setScheduleCancelRow(null)}
              onConfirm={handleScheduleConfirmCancelar}
              isSubmitting={scheduleCancelSubmitting}
            />
          ) : null}
          {/* ReagendarAgendaModal removido — reagendar agora usa AgendaFormModal v8 em modo 'reagendar'. */}
          {iniciarTolModal ? (
            <IniciarAtendimentoToleranciaModal
              variant={iniciarTolModal.variant}
              scheduledTimeLabel={iniciarTolModal.scheduledTimeLabel}
              nowTimeLabel={iniciarTolModal.nowTimeLabel}
              antecedenciaTexto={iniciarTolModal.antecedenciaTexto}
              atrasoTexto={iniciarTolModal.atrasoTexto}
              detailMessage={iniciarTolModal.detailMessage}
              adiantarSubmitting={iniciarTolAdiantarSubmitting}
              onCancel={closeIniciarTolModal}
              onKeepSchedule={() => {
                const snap = iniciarTolModal;
                if (!snap || snap.variant !== 'early') return;
                closeIniciarTolModal();
                handleStartAttendance(snap.patient, snap.options);
              }}
              onAdvanceNow={handleIniciarTolAdvanceNow}
              onStartAnyway={() => {
                const snap = iniciarTolModal;
                if (!snap || snap.variant !== 'late') return;
                closeIniciarTolModal();
                handleStartAttendance(snap.patient, snap.options);
              }}
              onBack={() =>
                setIniciarTolModal((prev) =>
                  prev && prev.variant === 'conflict'
                    ? { ...prev, variant: 'early', detailMessage: undefined }
                    : prev,
                )
              }
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export default function App() {
  return (
    <DisponibilidadeRevisionProvider>
      <AppRefactoredInner />
    </DisponibilidadeRevisionProvider>
  );
}
