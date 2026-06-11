import React, { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

// Hooks de estado
import {
  useAuthState,
  usePatientState,
  useJourneyState,
  useProcedureCamera,
} from './hooks';
import { usePatientsKpi } from './hooks/usePatientsKpi.js';

// Componentes de Autenticação
import { LoginForm } from './auth';
import { CompletarPerfil } from './auth/CompletarPerfil.jsx';
import { CadastrarClinica } from './auth/CadastrarClinica.jsx';
import { SelecionarClinica } from './auth/SelecionarClinica.jsx';

// Componentes de Layout
import { RoleGuard } from './auth/RoleGuard.jsx';
import { Sidebar, Stepper, MobileNavigation } from './layout';

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
  procedimentosApi,
  termoAssinaturaApi,
  termosApi,
} from '../services/api';
import { formatGaleriaLegendaForUpload, GALERIA_CATEGORIA } from '../utils/pacienteGaleria.js';
import { toLocalISODate } from '../utils/dateLimits.js';
import { convertToWebP } from '../utils/imageUtils.js';
import { evaluateProximoRetornoStep5 } from '../utils/proximoRetornoStep5.js';

import { PatientsView } from './patients';
import { ConfiguracoesView, GestaoUsuariosView } from './configuracoes';
import { AgendaDashboard } from './agenda';
import { AgendaFormModal } from './agenda/AgendaFormModal.jsx';
import { AgendaBloqueioModal } from './agenda/AgendaBloqueioModal.jsx';
import CancelarAgendaModal from './agenda/CancelarAgendaModal.jsx';
// ReagendarAgendaModal removido — substituído por AgendaFormModal em modo 'reagendar'.
import { IniciarAtendimentoToleranciaModal } from './agenda/IniciarAtendimentoToleranciaModal.jsx';
import { useAgendaPage } from './agenda/useAgendaPage.js';
import { ConfirmacaoPublicaPage } from './agenda/ConfirmacaoPublicaPage';
import { AnamnesePage } from '../pages/AnamnesePublica/AnamnesePage';
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
import { ConsultaHub, ConsultaModuleHeader, ConsultaViewShell, PlanejamentoPlaceholder, ConsultaProcedimentoFlow } from './consulta';
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
  try {
    URL.revokeObjectURL(url);
  } catch {
    // ignore
  }
}

export default function App() {
  const { roleUserId, setRoleUserId, setOrgId, orgId, setPapel, setRoleNome, roleNome } = useOrg();
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
          headers: { ...authHeadersForFetch({ needsOrg: false }) },
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
        const orgRes = await fetch(resolveApiUrl('/api/v1/organizacoes/minhas'), {
          credentials: 'include',
          headers: { ...authHeadersForFetch({ needsOrg: true }) },
        });
        const orgJson = await orgRes.json().catch(() => ({}));
        if (cancelled) return;
        const list = Array.isArray(orgJson) ? orgJson : orgJson?.content ?? orgJson?.organizacoes ?? orgJson?.data ?? [];
        const arr = Array.isArray(list) ? list : [];
        if (arr.length === 1) {
          const id = arr[0]?.id ?? arr[0]?.organizacaoSaudeId;
          if (id) setOrgId(String(id));
          const clinicaRes = await fetch(resolveApiUrl('/api/v1/clinica'), {
            credentials: 'include',
            headers: { ...authHeadersForFetch({ needsOrg: true }) },
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
  }, [authState.isLoggedIn, authState.authUser, authState.authReady, setOrgId]);
  const patientState = usePatientState({ authEnabled: authSessionReady });
  const journeyState = useJourneyState();
  /** Data local (YYYY-MM-DD) do início do atendimento — limite mínimo para “próximo retorno”. */
  const [journeyProcedureDateIso, setJourneyProcedureDateIso] = useState(() => toLocalISODate());
  /** Sincronizado com Step2: false quando a ficha tem perguntas (bloco queixa oculto). */
  const [queixaVisivel, setQueixaVisivel] = useState(true);
  const [step1Busy, setStep1Busy] = useState(false);
  /** Procedimento já registrado no Step 4, quando existir (na etapa 3 costuma ser null). */
  const [ultimoProcedimentoId, setUltimoProcedimentoId] = React.useState(null);
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
  const [journeyTermoTitulo, setJourneyTermoTitulo] = React.useState('');
  const [journeyTermoConteudo, setJourneyTermoConteudo] = React.useState('');
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const anamneseRef = useRef(null);
  /** Vista alvo ao confirmar foto da câmera no step 2 (mapeamento). */
  const mapeamentoCaptureVistaRef = useRef(null);
  const [pendingMapeamentoCapture, setPendingMapeamentoCapture] = React.useState(null);
  /** Id do preenchimento retornado por `createPaciente` (PATCH de observações ao finalizar). */
  const anamnesePreenchimentoIdRef = useRef(null);
  /** Último paciente resolvido na jornada — mantém header quando catálogo/search está temporariamente vazio. */
  const pacienteAtualRef = useRef(null);
  /** Evita duplo clique em “Finalizar”. */
  const finishJourneyLockRef = useRef(false);
  const [isSalvandoFotosAvaliacao, setIsSalvandoFotosAvaliacao] = React.useState(false);
  const [isSalvandoProcedimento, setIsSalvandoProcedimento] = React.useState(false);
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
  const [scheduleCancelRow, setScheduleCancelRow] = React.useState(null);
  const [scheduleCancelSubmitting, setScheduleCancelSubmitting] = React.useState(false);
  const [iniciarTolModal, setIniciarTolModal] = React.useState(null);
  const [iniciarTolAdiantarSubmitting, setIniciarTolAdiantarSubmitting] = React.useState(false);

  const handleScheduleExcluirFromEdit = React.useCallback(() => {
    const row = agendaSchedule.editingAppointment;
    if (row?.agendaId) {
      setScheduleCancelRow({ agenda: row });
      agendaSchedule.closeModal();
    }
  }, [agendaSchedule]);

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pacienteAtual?.id]);

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
    if (currentStep === 2 && mapeamentoCaptureVistaRef.current) {
      const vista = mapeamentoCaptureVistaRef.current;
      const blob = cameraState.photoPreviewBlob;
      if (blob) {
        setPendingMapeamentoCapture({ vista, blob });
      }
      mapeamentoCaptureVistaRef.current = null;
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

  /** Editor fullscreen compartilhado (procedimento / resumo etapa 5). */
  const [photoAnnotationScope, setPhotoAnnotationScope] = React.useState(null);
  const [photoAnnotationIndex, setPhotoAnnotationIndex] = React.useState(null);

  const closeJourneyPhotoAnnotation = React.useCallback(() => {
    setPhotoAnnotationScope(null);
    setPhotoAnnotationIndex(null);
    journeyState.setPaths([]);
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

  // ============ FUNÇÕES DE NAVEGAÇÃO ============
  const [consultaModule, setConsultaModule] = React.useState(null);
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
    setActiveView(view);
  };

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
            headers: { ...authHeadersForFetch({ needsOrg: false }) },
          }),
          fetch(resolveApiUrl('/api/v1/clinica'), {
            credentials: 'include',
            headers: { ...authHeadersForFetch({ needsOrg: true }) },
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
    }
    const nomeAgenda = options.procedimentoNome != null ? String(options.procedimentoNome).trim() : '';
    const catAgenda =
      options.catalogoProcedimentoSaudeId != null && String(options.catalogoProcedimentoSaudeId).trim() !== ''
        ? String(options.catalogoProcedimentoSaudeId).trim()
        : null;
    journeyState.setNomeProcedimentoCatalogoId(catAgenda);
    journeyState.setNomeProcedimento(nomeAgenda);
    journeyState.setAgendaId(options.agendaId ?? null);
    const mod = options.initialModule ?? LEGACY_STEP_TO_MODULE[options.initialStep] ?? 'hub';
    setConsultaModule(mod);
    setActiveView('consulta');
    setPatientView('list');
  };

  const onSairConsulta = React.useCallback(() => {
    setConsultaModule(null);
    setActiveView('pacientes');
  }, [setActiveView]);

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

  const handleNextStep = async () => {
    if (currentStep === 5 && isFinishing) return;

    if (currentStep === 1) {
      setStep1Busy(true);
      try {
      if (!pacienteAtual) {
        toast.error('Selecione um paciente na aba Pacientes antes de continuar a jornada.');
        return;
      }
      upsertPatientLocal({ ensureSelected: true });

      // Regra 4 do plano: PUT perfil ANTES da validação de queixa/ficha
      if (anamneseRef.current?.isPerfilDirty?.()) {
        if (!roleUserId) {
          toast.error('Selecione o profissional responsável antes de salvar o perfil clínico.');
          return;
        }
        const perfilResult = await anamneseRef.current.savePerfilClinico();
        if (!perfilResult?.ok) {
          toast.error(
            getApiErrorToastMessage(
              perfilResult?.error,
              'Erro ao salvar o perfil clínico. Verifique a conexão e tente novamente.',
            ),
          );
          return;
        }
      }

      const validacaoObrigatorias = anamneseRef.current?.validateObrigatorias?.();
      if (validacaoObrigatorias && !validacaoObrigatorias.ok) {
        toast.error('Preencha todas as perguntas obrigatórias da ficha.');
        return;
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
          return;
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
            return;
          }
        }
      }
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
      const obsP = String(journeyState.observacoesExecucao || '').trim();
      if (!nomeP || !obsP) {
        journeyState.setStep4Errors({
          nomeProcedimento: !nomeP,
          observacoesExecucao: !obsP,
        });
        toast.error('Preencha o nome do procedimento e as observações da execução para continuar.');
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

  const uploadPendingAnnotatedGalleryBlobs = React.useCallback(
    async ({ paciente, procIdOpt, dataRefSessao }) => {
      const ridUpload = roleUserId;
      const ridOk = ridUpload && /^[0-9a-f-]{36}$/i.test(String(ridUpload));
      const queuedAnnotated =
        ridOk && paciente?.id ? pendingAnnotatedGalleryBlobsRef.current.splice(0) : [];

      if (queuedAnnotated.length > 0 && paciente?.id && ridOk) {
        const uploadsAval = queuedAnnotated.map(async (blob, idx) => {
          try {
            const file = new File([blob], `avaliacao_${Date.now()}_${idx}.jpg`, { type: 'image/jpeg' });
            await pacientesGaleriaApi.upload(paciente.id, file, {
              roleUserId: ridUpload,
              procedimentoFeitoId: procIdOpt,
              legenda: formatGaleriaLegendaForUpload(
                GALERIA_CATEGORIA.PLANEJAMENTO,
                journeyState.nomeProcedimento.trim() || 'Mapeamento'
              ),
              dataReferencia: dataRefSessao,
            });
          } catch (e) {
            console.warn('Erro ao salvar foto de avaliação na galeria:', e);
          }
        });
        await Promise.allSettled(uploadsAval);
      }
    },
    [roleUserId, journeyState.nomeProcedimento]
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
      const dataRefSessao = new Date().toISOString().slice(0, 10);
      const procIdOpt = ultimoProcedimentoId ?? undefined;
      await uploadPendingAnnotatedGalleryBlobs({ paciente, procIdOpt, dataRefSessao });
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
    ultimoProcedimentoId,
    uploadPendingAnnotatedGalleryBlobs,
  ]);

  const handleConcluirAvaliacao = React.useCallback(async () => {
    try {
      await salvarFotosAvaliacao();
      setConsultaModule('hub');
    } catch {
      /* toast já exibido em salvarFotosAvaliacao */
    }
  }, [salvarFotosAvaliacao]);

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
    journeyState.setAgendaId(null);
    journeyState.setStep2Errors({});
    journeyState.setStep4Errors({});
    journeyState.setStep5Errors({});
    anamnesePreenchimentoIdRef.current = null;
    pendingAnnotatedGalleryBlobsRef.current = [];
    journeyState.setTermoSelecionadoId(null);
    setUltimoProcedimentoId(null);
    setAssinaturasRealizadasIds([]);
    patientState.setSelectedPatientCpf(null);
    patientState.setPatientView('list');
    setJourneyProcedureDateIso(toLocalISODate());
    setQueixaVisivel(true);
    mapeamentoCaptureVistaRef.current = null;
    setPendingMapeamentoCapture(null);
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
    setUltimoProcedimentoId,
  ]);

  const registrarProcedimentoManual = React.useCallback(
    async (paciente) => {
      let procedimentoFeitoIdParaVinculo = ultimoProcedimentoId;
      const snapshotCatalogoId =
        journeyState.nomeProcedimentoCatalogoId != null &&
        String(journeyState.nomeProcedimentoCatalogoId).trim() !== ''
          ? String(journeyState.nomeProcedimentoCatalogoId).trim()
          : null;

      if (journeyState.nomeProcedimento.trim() && paciente?.id && roleUserId) {
        const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const agendaIdValido =
          journeyState.agendaId && UUID_REGEX.test(journeyState.agendaId)
            ? journeyState.agendaId
            : null;
        const resultado = await procedimentosApi.registrarManual(paciente.id, {
          nome: journeyState.nomeProcedimento.trim(),
          roleUserId,
          observacao: String(journeyState.observacoesExecucao || '').trim() || null,
          agendaId: agendaIdValido,
          catalogoProcedimentoSaudeId: snapshotCatalogoId,
        });
        const pid = resultado?.id ?? resultado?.procedimentoId ?? resultado?.procedimentoFeitoId;
        if (pid != null && pid !== '') {
          procedimentoFeitoIdParaVinculo = String(pid);
          setUltimoProcedimentoId(String(pid));
        }
      }
      return procedimentoFeitoIdParaVinculo;
    },
    [
      journeyState.agendaId,
      journeyState.nomeProcedimento,
      journeyState.nomeProcedimentoCatalogoId,
      journeyState.observacoesExecucao,
      roleUserId,
      ultimoProcedimentoId,
    ]
  );

  const uploadProcedureCapturedPhotos = React.useCallback(
    async (paciente, procIdOpt, dataRefSessao) => {
      const ridUpload = roleUserId;
      const ridOk = ridUpload && /^[0-9a-f-]{36}$/i.test(String(ridUpload));
      const fotosProcedimento = cameraState.procedureCapturedPhotos || [];
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
            if (!fileToUpload) return;
            const webp = await convertToWebP(fileToUpload, 0.85, 1920);
            await pacientesGaleriaApi.upload(paciente.id, webp, {
              roleUserId: ridUpload,
              procedimentoFeitoId: procIdOpt,
              legenda: formatGaleriaLegendaForUpload(
                foto.meta?.categoria || GALERIA_CATEGORIA.DEPOIS,
                journeyState.nomeProcedimento.trim() || 'Foto do procedimento'
              ),
              dataReferencia: dataRefSessao,
            });
          } catch (e) {
            console.warn('Erro ao salvar foto do procedimento:', e);
          }
        });
        await Promise.allSettled(uploads);
      } else if (fotosProcedimento.length > 0 && paciente?.id && !ridOk) {
        console.warn(
          'Fotos do procedimento não enviadas: selecione o profissional (roleUserId) na barra de contexto.'
        );
      }
    },
    [cameraState.procedureCapturedPhotos, journeyState.nomeProcedimento, roleUserId]
  );

  const persistirEncerramentoConsulta = React.useCallback(
    async (procedimentoFeitoIdParaVinculo) => {
      if (assinaturasRealizadasIds.length > 0 && procedimentoFeitoIdParaVinculo) {
        for (const assinaturaId of assinaturasRealizadasIds) {
          try {
            await termoAssinaturaApi.vincularProcedimento(assinaturaId, procedimentoFeitoIdParaVinculo);
          } catch (e) {
            console.warn(`Não foi possível vincular assinatura ${assinaturaId} ao procedimento:`, e);
          }
        }
      }

      const snapshotNome = String(journeyState.nomeProcedimento || '').trim();
      const snapshotCatalogoId =
        journeyState.nomeProcedimentoCatalogoId != null &&
        String(journeyState.nomeProcedimentoCatalogoId).trim() !== ''
          ? String(journeyState.nomeProcedimentoCatalogoId).trim()
          : null;
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

      if (procedimentoFeitoIdParaVinculo && orientacoesPayload.length > 0) {
        await orientacoesApi.salvar(procedimentoFeitoIdParaVinculo, orientacoesPayload);
      }

      let tplSig = '';
      if (snapshotNome) {
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
          tplSig = '';
        }
      }
      const curSig = orientacoesTemplateSignature(orientacoesPayload);
      const shouldOfferTemplate = Boolean(
        snapshotNome && orientacoesPayload.length > 0 && (tplSig === '' || tplSig !== curSig)
      );
      if (shouldOfferTemplate) {
        const saveTpl = await askFinishJourneyConfirm({
          title: 'Salvar como padrão?',
          message: `Salvar estas orientações como padrão para "${snapshotNome}"?`,
        });
        if (saveTpl) {
          try {
            await perfilApi.salvarOrientacoesTemplate(snapshotNome, orientacoesPayload);
          } catch (e) {
            toast.error(getApiErrorDetail(e) || 'Não foi possível salvar o template de orientações.');
          }
        }
      }

      if (snapshotNome && !snapshotCatalogoId) {
        let catalogNames = [];
        try {
          const cats = await catalogosApi.list();
          const arr = Array.isArray(cats) ? cats : cats?.content || [];
          catalogNames = (Array.isArray(arr) ? arr : [])
            .map((c) => String(c.nomeProcedimento || c.nome || '').trim())
            .filter(Boolean);
        } catch (e) {
          console.warn('catalogos list:', e);
        }
        const hit = catalogNames.some((n) => n.toLowerCase() === snapshotNome.toLowerCase());
        if (!hit) {
          const add = await askFinishJourneyConfirm({
            title: 'Catálogo',
            message: `Procedimento não cadastrado no catálogo. Deseja cadastrá-lo como "${snapshotNome}"?`,
          });
          if (add) {
            try {
              await catalogosApi.criar({ nomeProcedimento: snapshotNome });
              toast.success('Procedimento adicionado ao catálogo.');
            } catch (e) {
              toast.error(getApiErrorDetail(e) || 'Não foi possível cadastrar no catálogo.');
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

  const salvarProcedimentoEFotos = React.useCallback(async () => {
    if (finishJourneyLockRef.current) return;
    finishJourneyLockRef.current = true;
    setIsSalvandoProcedimento(true);
    try {
      const paciente = resolvePacienteAtendimento();
      const procedimentoFeitoIdParaVinculo = await registrarProcedimentoManual(paciente);
      const dataRefSessao = new Date().toISOString().slice(0, 10);
      const procIdOpt = procedimentoFeitoIdParaVinculo ?? undefined;
      await uploadProcedureCapturedPhotos(paciente, procIdOpt, dataRefSessao);
    } catch (error) {
      console.error('Erro ao salvar procedimento e fotos:', error);
      toast.error(error.message || 'Erro ao salvar procedimento e fotos.');
      throw error;
    } finally {
      finishJourneyLockRef.current = false;
      setIsSalvandoProcedimento(false);
    }
  }, [
    registrarProcedimentoManual,
    resolvePacienteAtendimento,
    toast,
    uploadProcedureCapturedPhotos,
  ]);

  const encerrarAtendimento = React.useCallback(async () => {
    if (finishJourneyLockRef.current) return;
    finishJourneyLockRef.current = true;
    setIsFinishing(true);
    try {
      const sCpf = String(selectedPatientCpf || pacienteAtual?.cpf || '').trim();
      const procedimentoFeitoIdParaVinculo = ultimoProcedimentoId;
      await persistirEncerramentoConsulta(procedimentoFeitoIdParaVinculo);
      setConsultaModule(null);
      await finalizarAtendimentoNavegacao(sCpf);
    } catch (error) {
      console.error('Erro ao encerrar atendimento:', error);
      toast.error(error.message || 'Erro ao encerrar atendimento.');
      throw error;
    } finally {
      finishJourneyLockRef.current = false;
      setIsFinishing(false);
    }
  }, [
    finalizarAtendimentoNavegacao,
    pacienteAtual?.cpf,
    persistirEncerramentoConsulta,
    selectedPatientCpf,
    setIsFinishing,
    toast,
    ultimoProcedimentoId,
  ]);

  const finishJourney = async () => {
    if (finishJourneyLockRef.current) return;
    finishJourneyLockRef.current = true;
    setIsFinishing(true);
    try {
      const sCpf = String(selectedPatientCpf || pacienteAtual?.cpf || '').trim();
      const paciente = resolvePacienteAtendimento();
      const procedimentoFeitoIdParaVinculo = await registrarProcedimentoManual(paciente);
      await persistirEncerramentoConsulta(procedimentoFeitoIdParaVinculo);
      const dataRefSessao = new Date().toISOString().slice(0, 10);
      const procIdOpt = procedimentoFeitoIdParaVinculo ?? undefined;
      await uploadPendingAnnotatedGalleryBlobs({ paciente, procIdOpt, dataRefSessao });
      await uploadProcedureCapturedPhotos(paciente, procIdOpt, dataRefSessao);
      await finalizarAtendimentoNavegacao(sCpf);
    } catch (error) {
      console.error('Erro ao finalizar jornada:', error);
      toast.error(error.message || 'Erro ao finalizar jornada.');
    } finally {
      finishJourneyLockRef.current = false;
      setIsFinishing(false);
    }
  };

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

  // ============ RENDERIZAÇÃO ============
  if (isPaginaPublica) {
    return <ConfirmacaoPublicaPage />;
  }
  if (isAnamnesePublica) {
    return <AnamnesePage />;
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

      {/* Sidebar */}
      <Sidebar
        activeView={activeView}
        setActiveView={setActiveView}
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
                      onStepComplete={() => setCurrentStep(3)}
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
                            catalogoProcedimentoSaudeIds: [row.catalogoProcedimentoSaudeId],
                            planejamentoItemIdPorCatalogo: {
                              [row.catalogoProcedimentoSaudeId]: row.planejamentoItemId,
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
                      procedimentoFeitoId={ultimoProcedimentoId ?? null}
                      roleUserId={roleUserId ?? null}
                      onAssinaturaSalva={handleTermoAssinaturaSalva}
                      pacienteCtx={{
                        nome: pacienteAtual?.nome,
                        cpf: pacienteAtual?.cpf,
                        telefone: pacienteAtual?.telefone || pacienteAtual?.phone || pacienteAtual?.telefoneNumero || pacienteAtual?.telefonePrincipal
                      }}
                      clinicaCtx={{
                        nome: clinicaInfo?.nome,
                        cnpj: clinicaInfo?.cnpj,
                        endereco: clinicaInfo?.endereco,
                        telefone: clinicaInfo?.telefone
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
                      onProcedureRemovePhoto={cameraState.removeProcedurePhoto}
                      step4Errors={journeyState.step4Errors}
                      setStep4Errors={journeyState.setStep4Errors}
                      fotosAvaliacao={cameraState.evaluationCapturedPhotos ?? []}
                      onProcedureFotoCategoriaSync={cameraState.setProcedureFotoCategoria}
                      onProcedureAnnotatePhoto={openProcedurePhotoAnnotation}
                    />
                  )}

                  {currentStep === 5 && (
                    <Step5Finalization
                      key={String(journeyState.nomeProcedimento || '')}
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
                onBack={consultaModule !== 'hub' ? () => setConsultaModule('hub') : undefined}
                onSair={onSairConsulta}
                getPatientInitials={getPatientInitials}
              />
            </header>
            <ConsultaViewShell>
              <div key={consultaModule} className="animate-in fade-in slide-in-from-right-4 duration-200">
                {consultaModule === 'hub' ? (
                  <ConsultaHub
                    paciente={pacienteAtual}
                    onSelectModule={setConsultaModule}
                    onSair={onSairConsulta}
                    getPatientInitials={getPatientInitials}
                  />
                ) : null}
                {consultaModule === 'anamnese' ? (
                  <Step2Anamnese
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
                ) : null}
                {consultaModule === 'avaliacao' ? (
                  <Step3Evaluation
                    pacienteId={pacienteAtual?.id ?? null}
                    roleUserId={roleUserId ?? null}
                    sidebarInsetPx={sidebarRailWidthPx}
                    observacoes={journeyState.observacoes}
                    setObservacoes={journeyState.setObservacoes}
                    pendingCapture={pendingMapeamentoCapture}
                    onCaptureConsumed={() => setPendingMapeamentoCapture(null)}
                    onPrepareCapture={handlePrepareMapeamentoCapture}
                    onStepComplete={() => setConsultaModule('termos')}
                    profissionalLogadoNome={perfilInfo?.nomeCompleto ?? ''}
                    consultaMode
                    onConcluirAvaliacao={handleConcluirAvaliacao}
                    isConcluirAvaliacaoBusy={isSalvandoFotosAvaliacao}
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
                          catalogoProcedimentoSaudeIds: [row.catalogoProcedimentoSaudeId],
                          planejamentoItemIdPorCatalogo: {
                            [row.catalogoProcedimentoSaudeId]: row.planejamentoItemId,
                          },
                          profissionalRoleUserId: roleUserId,
                          onAgendaSaved: onSaved,
                        }
                      );
                    }}
                  />
                ) : null}
                {consultaModule === 'planejamento' ? (
                  <PlanejamentoPlaceholder onVoltar={() => setConsultaModule('hub')} />
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
                    procedimentoFeitoId={ultimoProcedimentoId ?? null}
                    roleUserId={roleUserId ?? null}
                    onAssinaturaSalva={handleTermoAssinaturaSalva}
                    pacienteCtx={{
                      nome: pacienteAtual?.nome,
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
                {consultaModule === 'procedimento' ? (
                  <ConsultaProcedimentoFlow
                    pacienteIdForProcedures={pacienteAtual?.id || null}
                    nomeProcedimento={journeyState.nomeProcedimento}
                    setNomeProcedimento={journeyState.setNomeProcedimento}
                    setNomeProcedimentoCatalogoId={journeyState.setNomeProcedimentoCatalogoId}
                    observacoesExecucao={journeyState.observacoesExecucao}
                    setObservacoesExecucao={journeyState.setObservacoesExecucao}
                    procedureCapturedPhotos={cameraState.procedureCapturedPhotos}
                    procedurePhotoMax={cameraState.EVALUATION_PHOTO_MAX}
                    onProcedureUploadFiles={(files, cat) => cameraState.uploadProcedureFiles(files, cat)}
                    onProcedureRemovePhoto={cameraState.removeProcedurePhoto}
                    step4Errors={journeyState.step4Errors}
                    setStep4Errors={journeyState.setStep4Errors}
                    fotosAvaliacao={cameraState.evaluationCapturedPhotos ?? []}
                    onProcedureFotoCategoriaSync={cameraState.setProcedureFotoCategoria}
                    onProcedureAnnotatePhoto={openProcedurePhotoAnnotation}
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
                    salvarProcedimentoEFotos={salvarProcedimentoEFotos}
                    encerrarAtendimento={encerrarAtendimento}
                    isSalvandoProcedimento={isSalvandoProcedimento}
                    isFinishing={isFinishing}
                    step5RetornoBloqueiaFinal={step5RetornoBloqueiaFinal}
                    toast={toast}
                  />
                ) : null}
              </div>
            </ConsultaViewShell>

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
        <div
          className={`w-full mx-auto ${
            activeView === 'configuracoes' || activeView === 'gestao-equipe'
              ? 'px-3 pt-2 pb-3 sm:px-6 sm:pt-3 sm:pb-6 md:px-8 md:pt-4 md:pb-8 max-w-[1100px] md:max-w-none lg:max-w-[min(100%,1380px)] xl:max-w-[min(100%,1600px)] 2xl:max-w-[min(100%,1800px)]'
              : isAgendaView
                ? 'flex min-h-0 flex-1 flex-col overflow-hidden px-3 pt-1 pb-3 sm:px-5 sm:pt-2 sm:pb-4 md:px-6 lg:px-6 lg:py-4 xl:px-8 max-w-[1100px] md:max-w-none lg:max-w-[min(100%,1420px)] xl:max-w-[min(100%,1680px)] 2xl:max-w-[min(100%,1920px)]'
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
              <RoleGuard minLevel="NIVEL_1" showError>
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
                  onUpdatePatient={handleUpdatePatientProfile}
                  onAddGalleryFiles={handleAddGalleryFiles}
                  onDeleteGalleryPhoto={handleDeleteGalleryPhoto}
                  onPatientCreated={refreshPatientsAndPagedList}
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
                  kpi={kpiState}
                  kpiLoading={kpiState.loading}
                  nomeUsuario={perfilInfo.nomeCompleto}
                  onNavigateToAgenda={() => setActiveView('agenda')}
                  roleUserId={roleUserId}
                  patientQuickFilter={patientQuickFilter}
                  setPatientQuickFilter={setPatientQuickFilter}
                  captureProfileNavSnapshot={captureProfileNavSnapshot}
                  navigateProfilePatient={navigateProfilePatient}
                  profileNav={profileNav}
                  clearProfileNavSnapshot={clearProfileNavSnapshot}
                />
              </RoleGuard>
            )}

            {activeView === 'configuracoes' && (
              <RoleGuard minLevel="NIVEL_3" showError>
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
                />
              </RoleGuard>
            )}

            {activeView === 'gestao-equipe' && (
              <RoleGuard minLevel="NIVEL_5" showError>
                <GestaoUsuariosView />
              </RoleGuard>
            )}

            {activeView === 'agenda' && (
              <RoleGuard minLevel="NIVEL_1" showError>
                <div className="flex min-h-0 flex-1 flex-col">
                <AgendaDashboard
                  agenda={agendaSchedule}
                  patients={patients}
                  authEnabled={authSessionReady}
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
            {!['jornada', 'consulta', 'pacientes', 'agenda', 'configuracoes', 'gestao-equipe'].includes(activeView) && (
              <div className="p-6 rounded-2xl border border-app-border bg-app-surface text-[#64748b] font-bold text-[14px]">
                Visao nao encontrada.
              </div>
            )}
          </div>
        </div>
        )}
      </main>

      {!isJornadaView && !isConsultaView ? (
        <MobileNavigation
          activeView={activeView}
          onGoPacientes={() => goToView('pacientes')}
          onGoAgenda={() => goToView('agenda')}
          onGoGestaoEquipe={() => goToView('gestao-equipe')}
          onGoConfiguracoes={() => goToView('configuracoes')}
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
          <AgendaFormModal agenda={agendaSchedule} onExcluirClick={handleScheduleExcluirFromEdit} />
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

