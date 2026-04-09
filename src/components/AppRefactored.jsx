import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// Hooks de estado
import {
  useAuthState,
  usePatientState,
  useJourneyState,
  useProcedureCamera,
} from './hooks';

// Componentes de Autenticação
import { LoginForm, CookieConsent } from './auth';

// Componentes de Layout
import { Sidebar, Stepper, MobileNavigation } from './layout';

import { useOrg } from '../contexts/OrgContext';
import { useToast } from '../contexts/useToast.js';
import { anamneseApi, pacientesApi } from '../services/api';
import { mapBackendPatient, journeyToPacienteCreateDTO } from '../utils/patientMapping';

import { PatientsView } from './patients';
import { AnamneseAdminView } from './anamnese';
import { ProcedureCameraWidget } from './canvas';

// Componentes da Jornada (5 Etapas)
import { Step1CheckIn, Step2Anamnese, Step3Evaluation, Step4LGPD, Step5Finalization } from './journey';

// Utilitarios
import { getPatientInitials } from './utils';

const STEP1_FIELD_LABELS = {
  nome: 'nome completo',
  dataNascimento: 'data de nascimento',
  sexo: 'sexo',
  estadoCivil: 'estado civil',
  profissao: 'profissão',
  cpf: 'CPF',
  telefone: 'telefone',
  email: 'e-mail',
  alergias: 'alergias',
  lgpdInicial: 'aceite de LGPD',
};

function messageForMissingStep1Fields(errors) {
  const keys = Object.keys(errors);
  if (keys.length === 0) return '';
  const labels = keys.map((k) => STEP1_FIELD_LABELS[k] || k);
  if (labels.length === 1) return `Para prosseguir, preencha ${labels[0]}.`;
  if (labels.length === 2) return `Para prosseguir, preencha ${labels[0]} e ${labels[1]}.`;
  const last = labels.pop();
  return `Para prosseguir, preencha ${labels.join(', ')} e ${last}.`;
}

export default function App() {
  const { roleUserId, setRoleUserId, setOrgId } = useOrg();
  const toast = useToast();
  // ============ ESTADO GLOBAL ============
  const authState = useAuthState({ setRoleUserId, setOrgId });
  const authSessionReady = authState.authReady && authState.cookieConsentAccepted && authState.isLoggedIn;
  const patientState = usePatientState({ authEnabled: authSessionReady });
  const journeyState = useJourneyState();
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const anamneseRef = useRef(null);
  /** Evita duplo clique em “Finalizar”. */
  const finishJourneyLockRef = useRef(false);

  // ============ Estados destructurados para facilitar leitura ============
  const { authReady, isLoggedIn, authUser, handleLogout, cookieConsentAccepted, acceptCookies } = authState;
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
    refreshPatients,
    mergePatientById,
  } = patientState;

  const cameraState = useProcedureCamera({
    currentStep,
    journeyId,
    setJourneyId: journeyState.setJourneyId,
    selectedPatientCpf,
    cpf: journeyState.cpf,
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

  const handleDeleteCapturedPhoto = (idx) => {
    const current = cameraState.evaluationCapturedPhotos;
    if (!Array.isArray(current) || idx < 0 || idx >= current.length) return;

    const removed = current[idx];
    const next = current.filter((_, i) => i !== idx);

    const previousSelected = cameraState.evaluationSelectedPhotoIndex;
    let nextSelected = null;
    if (next.length > 0) {
      if (previousSelected === idx) nextSelected = Math.min(idx, next.length - 1);
      else if (previousSelected > idx) nextSelected = previousSelected - 1;
      else nextSelected = previousSelected;
    }

    cameraState.setEvaluationCapturedPhotos(next);
    cameraState.setEvaluationSelectedPhotoIndex(nextSelected);

    const nextImageSrc = nextSelected !== null ? next[nextSelected]?.url || null : null;
    journeyState.setImageSrc(nextImageSrc);
    journeyState.setPaths([]);
    journeyState.setEvaluationAnnotatedPhotoUrl(null);

    const targetCpf = String(selectedPatientCpf || journeyState.cpf || '').trim();
    if (targetCpf) {
      setPatients((prev) =>
        prev.map((p) => {
          if (String(p?.cpf || '').trim() !== targetCpf) return p;
          return {
            ...p,
            evaluationCapturedPhotos: next.map((ph) => ({
              url: ph.url,
              meta: ph.meta,
            })),
            evaluationSelectedPhotoIndex: nextSelected,
          };
        })
      );
    }

    try {
      if (removed?.url) URL.revokeObjectURL(removed.url);
    } catch {
      // ignore
    }
  };

  const handleConfirmProcedurePhoto = () => {
    const previewUrl = cameraState.photoPreviewUrl;
    cameraState.confirmPhoto();

    if (previewUrl) {
      journeyState.setImageSrc(previewUrl);
      journeyState.setPaths([]);
      journeyState.setEvaluationAnnotatedPhotoUrl(null);
    }
  };
  
  // ============ FUNÇÕES DE NAVEGAÇÃO ============
  const [activeView, setActiveView] = React.useState('jornada');
  const goToView = (view) => {
    setActiveView(view);
  };

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

  const handleStartAttendance = (patient) => {
    if (!patient) return;
    selectPatient(patient);
    setCurrentStep(2);
    setActiveView('jornada');
    setPatientView('list');
  };

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
    const cpfTrim = String(journeyState.cpf || '').trim();
    const selectedTrim = String(selectedPatientCpf || '').trim();
    const matchKey = cpfTrim || selectedTrim;

    const existingPatient = patients.find((p) => {
      const pCpf = String(p?.cpf || '').trim();
      return matchKey && pCpf === matchKey;
    });

    const patientPayload = {
      id: existingPatient?.id || crypto.randomUUID(),
      nome: journeyState.nome || '',
      dataNascimento: journeyState.dataNascimento || '',
      idade: journeyState.idade || '',
      sexo: journeyState.sexo || '',
      estadoCivil: journeyState.estadoCivil || '',
      profissao: journeyState.profissao || '',
      alergias: journeyState.alergias || '',
      cpf: cpfTrim,
      rg: journeyState.rg || '',
      telefone: journeyState.telefone || '',
      email: journeyState.email || '',
      // Persistencia local da anamnese (mock) ate migracao para banco.
      anamnese: {
        queixa: journeyState.queixa || '',
        expectativas: journeyState.expectativas || '',
        updatedAt: new Date().toISOString(),
      },
      lgpdInicial: Boolean(journeyState.lgpdInicial),
      termoLido: Boolean(journeyState.termoLido),
      termoAssinado: Boolean(journeyState.termoAssinado),
      termoAssinaturaDataUrl: journeyState.termoAssinaturaDataUrl || '',
      orientacoes: Boolean(journeyState.orientacoes),
      satisfacao: Boolean(journeyState.satisfacao),
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

    if (ensureSelected) {
      const selectedKey = cpfTrim || selectedTrim;
      if (selectedKey) {
        setSelectedPatientCpf(selectedKey);
      }
    }
  };

  const handleNextStep = async () => {
    if (currentStep === 5 && isFinishing) return;
    if (currentStep === 1) {
      if (journeyState.activeTab === 'novo') {
        const { nome, dataNascimento, sexo, estadoCivil, profissao, cpf, telefone, email, alergias, lgpdInicial } =
          journeyState;
        const errors = {};
        if (!nome.trim()) errors.nome = true;
        if (!dataNascimento) errors.dataNascimento = true;
        if (!sexo) errors.sexo = true;
        if (!estadoCivil) errors.estadoCivil = true;
        if (!profissao.trim()) errors.profissao = true;
        if (!cpf.trim()) errors.cpf = true;
        if (!telefone.trim()) errors.telefone = true;
        if (!email.trim()) errors.email = true;
        if (!alergias.trim()) errors.alergias = true;
        if (!lgpdInicial) errors.lgpdInicial = true;

        if (Object.keys(errors).length > 0) {
          journeyState.setStep1Errors(errors);
          toast.warning(messageForMissingStep1Fields(errors));
          return;
        }

        try {
          const dto = await pacientesApi.create(journeyToPacienteCreateDTO(journeyState));
          const mapped = mapBackendPatient(dto);
          setPatients((prev) => {
            const cpfKey = String(mapped.cpf || '').trim();
            const idx = prev.findIndex((p) => String(p?.cpf || '').trim() === cpfKey);
            if (idx >= 0) {
              const copy = [...prev];
              copy[idx] = { ...copy[idx], ...mapped };
              return copy;
            }
            return [...prev, mapped];
          });
          patientState.setSelectedPatientCpf(mapped.cpf || null);
          journeyState.setCpf(mapped.cpf || '');
          upsertPatientLocal({ ensureSelected: true });
        } catch (err) {
          toast.error(err.message || 'Erro ao cadastrar paciente no servidor.');
          return;
        }
      } else {
        const hasSelectedPatient = Boolean((selectedPatientCpf || '').trim() || (journeyState.cpf || '').trim());
        if (!hasSelectedPatient) {
          toast.warning('Para prosseguir, selecione um paciente para continuar à anamnese.');
          return;
        }
        upsertPatientLocal({ ensureSelected: true });
      }

      journeyState.setStep1Errors({});
    }

    if (currentStep === 2) {
      const { queixa, expectativas } = journeyState;
      if (!queixa.trim() || !expectativas.trim()) {
        toast.warning('Para prosseguir, preencha a queixa principal e as expectativas.');
        return;
      }

      upsertPatientLocal({ ensureSelected: true });

      const anamneseData = anamneseRef.current?.getAnamneseData?.();
      if (anamneseData && anamneseData.respostas.length > 0) {
        const paciente = patients.find((p) => {
          const pCpf = String(p?.cpf || '').trim();
          const sCpf = String(selectedPatientCpf || journeyState.cpf || '').trim();
          return sCpf && pCpf === sCpf;
        });
        const rid = roleUserId;
        if (!rid) {
          console.warn('roleUserId ausente: faça login novamente para vincular o profissional.');
        }
        if (paciente?.id && rid) {
          anamneseApi
            .createPaciente(paciente.id, rid, {
              anamneseId: anamneseData.anamneseId,
              observacoes: `Queixa: ${queixa}. Expectativas: ${expectativas}`,
              respostas: anamneseData.respostas,
            })
            .catch((err) => console.warn('Erro ao salvar anamnese:', err.message));
        }
      }
    }

    if (currentStep === 4) {
      const { termoLido, termoAssinado } = journeyState;
      if (!termoLido || !termoAssinado) {
        toast.warning('Para prosseguir, confirme a leitura e a assinatura do termo LGPD.');
        return;
      }

      upsertPatientLocal({ ensureSelected: true });
    }

    if (currentStep === 5) {
      const { orientacoes, satisfacao } = journeyState;
      if (!orientacoes || !satisfacao) {
        toast.warning('Para prosseguir, confirme as orientações e o nível de satisfação.');
        return;
      }

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
      setCurrentStep(currentStep - 1);
    }
  };

  const finishJourney = async () => {
    if (finishJourneyLockRef.current) return;
    finishJourneyLockRef.current = true;
    setIsFinishing(true);
    try {
      refreshPatients();
      toast.success('Jornada finalizada com sucesso.');
      resetJourney();
    } catch (error) {
      console.error('Erro ao finalizar jornada:', error);
      toast.error(error.message || 'Erro ao finalizar jornada.');
    } finally {
      finishJourneyLockRef.current = false;
      setIsFinishing(false);
    }
  };

  const resetJourney = () => {
    setCurrentStep(1);
    journeyState.setNome('');
    journeyState.setDataNascimento('');
    journeyState.setIdade('');
    journeyState.setSexo('');
    journeyState.setEstadoCivil('');
    journeyState.setProfissao('');
    journeyState.setAlergias('');
    journeyState.setCpf('');
    journeyState.setRg('');
    journeyState.setTelefone('');
    journeyState.setEmail('');
    journeyState.setQueixa('');
    journeyState.setExpectativas('');
    journeyState.setImageSrc(null);
    journeyState.setPaths([]);
    journeyState.setTermoLido(false);
    journeyState.setTermoAssinado(false);
    journeyState.setTermoAssinaturaDataUrl('');
    journeyState.setOrientacoes(false);
    journeyState.setSatisfacao(false);
    patientState.setSelectedPatientCpf(null);
    patientState.setPatientView('list');
  };

  const selectPatient = (patient) => {
    const selectedCpfNorm = String(selectedPatientCpf || '').trim();
    const patientCpfNorm = String(patient?.cpf || '').trim();

    // Toggle: clicking the same selected patient deselects it.
    if (!patient || (patientCpfNorm && selectedCpfNorm === patientCpfNorm)) {
      journeyState.setNome('');
      journeyState.setDataNascimento('');
      journeyState.setIdade('');
      journeyState.setSexo('');
      journeyState.setEstadoCivil('');
      journeyState.setProfissao('');
      journeyState.setAlergias('');
      journeyState.setCpf('');
      journeyState.setRg('');
      journeyState.setTelefone('');
      journeyState.setEmail('');
      journeyState.setStep1Errors({});
      patientState.setSelectedPatientCpf(null);
      journeyState.setActiveTab('existente');
      return;
    }

    journeyState.setNome(patient.nome || '');
    journeyState.setDataNascimento(patient.dataNascimento || '');
    journeyState.setIdade(patient.idade !== undefined && patient.idade !== null ? String(patient.idade) : '');
    journeyState.setSexo(patient.sexo || '');
    journeyState.setEstadoCivil(patient.estadoCivil || '');
    journeyState.setProfissao(patient.profissao || '');
    journeyState.setAlergias(patient.alergias || '');
    journeyState.setCpf(patient.cpf || '');
    journeyState.setRg(patient.rg || '');
    journeyState.setTelefone(patient.telefone || '');
    journeyState.setEmail(patient.email || '');
    journeyState.setStep1Errors({});
    patientState.setSelectedPatientCpf(patient.cpf || null);
    journeyState.setActiveTab('existente');
  };

  // ============ RENDERIZAÇÃO ============
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
    return (
      <>
        <LoginForm {...authState} />
        <CookieConsent cookieConsentAccepted={cookieConsentAccepted} acceptCookies={acceptCookies} />
      </>
    );
  }

  return (
    <div className="flex min-h-screen md:h-screen flex-col md:flex-row font-sans overflow-x-hidden md:overflow-hidden" style={{ backgroundColor: '#f8fbfb', color: '#0f172a' }}>
      <CookieConsent cookieConsentAccepted={cookieConsentAccepted} acceptCookies={acceptCookies} />

      {/* Sidebar */}
      <Sidebar
        activeView={activeView}
        setActiveView={setActiveView}
        handleLogout={handleLogout}
        authUser={authUser}
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-y-auto pb-[112px] md:pb-0">
        {/* Header — anamnese/pacientes: compacto; jornada: título + stepper */}
        <header
          className={`bg-white border-b-[3px] border-[#00a88e]/15 shadow-[0_4px_24px_rgb(0,168,142,0.02)] z-0 ${
            activeView === 'anamnese' || activeView === 'pacientes'
              ? 'px-4 sm:px-5 md:px-8 lg:px-10 py-3 sm:py-3.5 md:py-4'
              : 'px-4 sm:px-6 md:px-10 py-6 sm:py-8'
          }`}
        >
          {activeView === 'anamnese' ? (
            <div className="min-w-0">
              <h2 className="text-[18px] sm:text-[21px] md:text-[22px] font-bold text-[#0f172a] leading-tight mb-0.5">Anamnese</h2>
              <p className="text-[#64748b] text-[12px] sm:text-[13px] md:text-[14px] font-medium leading-snug">
                Categorias, perguntas e fichas reutilizáveis
              </p>
            </div>
          ) : activeView === 'pacientes' ? (
            <div className="min-w-0">
              <h2 className="text-[19px] sm:text-[22px] md:text-[24px] font-bold text-[#0f172a] leading-tight mb-0.5">Pacientes</h2>
              <p className="text-[#64748b] text-[12px] sm:text-[13px] md:text-[14px] font-medium leading-snug">
                Cadastro, prontuário, histórico e galeria
              </p>
            </div>
          ) : activeView === 'jornada' ? (
            <>
              <h2 className="text-[20px] sm:text-[24px] font-bold text-[#0f172a] mb-1">Fluxo de atendimento</h2>
              <p className="text-[#64748b] text-[13px] sm:text-[14px] mb-5 sm:mb-8 font-medium">Check-in, anamnese, avaliação, LGPD e finalização</p>
              <Stepper currentStep={currentStep} />
            </>
          ) : null}
        </header>

        {/* Content Area — anamnese usa largura e altura maiores no desktop */}
        <div
          className={`w-full mx-auto ${
            activeView === 'anamnese'
              ? 'px-3 pt-2 pb-3 sm:px-6 sm:pt-3 sm:pb-6 md:px-8 md:pt-4 md:pb-8 max-w-[1100px] md:max-w-none lg:max-w-[min(100%,1380px)] xl:max-w-[min(100%,1600px)] 2xl:max-w-[min(100%,1800px)]'
              : activeView === 'pacientes'
                ? 'px-3 pt-1 pb-6 sm:px-5 sm:pt-2 sm:pb-8 md:px-6 md:pt-2 md:pb-8 lg:px-8 lg:pt-3 lg:pb-10 xl:px-10 max-w-[1100px] md:max-w-none lg:max-w-[min(100%,1420px)] xl:max-w-[min(100%,1680px)] 2xl:max-w-[min(100%,1920px)] flex flex-col'
                : 'p-3 sm:p-6 md:p-8 max-w-[1600px]'
          }`}
        >
          <div
            className={`bg-white rounded-[20px] border-[3px] border-[#00a88e]/25 shadow-lg shadow-[#00a88e]/5 ${
              activeView === 'anamnese'
                ? 'px-4 pt-3 pb-5 sm:px-6 sm:pt-4 sm:pb-6 md:px-8 md:pt-5 md:pb-8'
                : activeView === 'pacientes'
                  ? 'flex flex-col p-4 sm:p-5 md:p-6 lg:p-8 pb-6 sm:pb-8'
                  : 'p-4 sm:p-8 pb-5 sm:pb-6'
            }`}
          >

            {activeView === 'jornada' && (
              <>
                {/* ============ ETAPA 1: CHECK-IN ============ */}
                {currentStep === 1 && (
                  <Step1CheckIn
                    activeTab={journeyState.activeTab}
                    setActiveTab={journeyState.setActiveTab}
                    searchQuery={journeyState.searchQuery}
                    setSearchQuery={journeyState.setSearchQuery}
                    selectedPatientCpf={selectedPatientCpf}
                    patients={patients}
                    nome={journeyState.nome}
                    setNome={journeyState.setNome}
                    dataNascimento={journeyState.dataNascimento}
                    setDataNascimento={journeyState.setDataNascimento}
                    idade={journeyState.idade}
                    setIdade={journeyState.setIdade}
                    sexo={journeyState.sexo}
                    setSexo={journeyState.setSexo}
                    estadoCivil={journeyState.estadoCivil}
                    setEstadoCivil={journeyState.setEstadoCivil}
                    profissao={journeyState.profissao}
                    setProfissao={journeyState.setProfissao}
                    alergias={journeyState.alergias}
                    setAlergias={journeyState.setAlergias}
                    cpf={journeyState.cpf}
                    setCpf={journeyState.setCpf}
                    rg={journeyState.rg}
                    setRg={journeyState.setRg}
                    telefone={journeyState.telefone}
                    setTelefone={journeyState.setTelefone}
                    email={journeyState.email}
                    setEmail={journeyState.setEmail}
                    lgpdInicial={journeyState.lgpdInicial}
                    setLgpdInicial={journeyState.setLgpdInicial}
                    step1Errors={journeyState.step1Errors}
                    setStep1Errors={journeyState.setStep1Errors}
                    selectPatient={selectPatient}
                  />
                )}

                {/* ============ ETAPA 2: ANAMNESE ============ */}
                {currentStep === 2 && (
                  <Step2Anamnese
                    ref={anamneseRef}
                    queixa={journeyState.queixa}
                    setQueixa={journeyState.setQueixa}
                    expectativas={journeyState.expectativas}
                    setExpectativas={journeyState.setExpectativas}
                  />
                )}

                {/* ============ ETAPA 3: AVALIAÇÃO ============ */}
                {currentStep === 3 && (
                  <Step3Evaluation
                    imageSrc={journeyState.imageSrc}
                    setImageSrc={journeyState.setImageSrc}
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
                    cpf={journeyState.cpf}
                    patients={patients}
                    setPatients={setPatients}
                    evaluationCapturedPhotos={cameraState.evaluationCapturedPhotos}
                    evaluationSelectedPhotoIndex={cameraState.evaluationSelectedPhotoIndex}
                    setEvaluationSelectedPhotoIndex={cameraState.setEvaluationSelectedPhotoIndex}
                    onSelectCapturedPhoto={handleSelectCapturedPhoto}
                    onDeleteCapturedPhoto={handleDeleteCapturedPhoto}
                    evaluationPhotoMax={cameraState.EVALUATION_PHOTO_MAX}
                  />
                )}

                {/* ============ ETAPA 4: LGPD ============ */}
                {currentStep === 4 && (
                  <Step4LGPD
                    termoLido={journeyState.termoLido}
                    setTermoLido={journeyState.setTermoLido}
                    termoAssinado={journeyState.termoAssinado}
                    setTermoAssinado={journeyState.setTermoAssinado}
                    termoAssinaturaDataUrl={journeyState.termoAssinaturaDataUrl}
                    setTermoAssinaturaDataUrl={journeyState.setTermoAssinaturaDataUrl}
                  />
                )}

                {/* ============ ETAPA 5: FINALIZAÇÃO ============ */}
                {currentStep === 5 && (
                  <Step5Finalization
                    orientacoes={journeyState.orientacoes}
                    setOrientacoes={journeyState.setOrientacoes}
                    satisfacao={journeyState.satisfacao}
                    setSatisfacao={journeyState.setSatisfacao}
                  />
                )}

                {/* ============ BOTÕES DE NAVEGAÇÃO ============ */}
                <div className="flex flex-col-reverse sm:flex-row justify-between items-stretch sm:items-center gap-3 mt-8 sm:mt-10 pt-5 sm:pt-6 border-t-[3px] border-[#00a88e]/15">
                  <button
                    onClick={prevStep}
                    disabled={currentStep === 1 || isFinishing}
                    className={`w-full sm:w-auto justify-center flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-[14px] transition-all outline-none shadow-sm border-[3px] ${
                      currentStep === 1 || isFinishing
                        ? 'text-[#94a3b8] bg-[#f8fbfb] border-[#e2e8f0] cursor-not-allowed'
                        : 'text-[#00a88e] bg-white border-[#00a88e]/25 hover:bg-[#e6f7f5] hover:border-[#00a88e]'
                    }`}
                  >
                    <ChevronLeft className="w-4 h-4" strokeWidth={3} /> Anterior
                  </button>

                  {currentStep < 5 ? (
                    <button
                      onClick={handleNextStep}
                      disabled={isFinishing}
                        className="w-full sm:w-auto justify-center flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-[14px] transition-all outline-none shadow-md border-[3px] border-transparent text-white bg-[#00a88e] hover:bg-[#00967f] disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      Próxima Etapa <ChevronRight className="w-4 h-4" strokeWidth={3} />
                    </button>
                  ) : (
                    <button
                      onClick={handleNextStep}
                      disabled={isFinishing}
                        className="w-full sm:w-auto justify-center flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-[14px] transition-all outline-none shadow-md border-[3px] border-transparent text-white bg-[#22c55e] hover:bg-[#16a34a] disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      Finalizar Procedimento ✓
                    </button>
                  )}
                </div>
              </>
            )}

            {activeView === 'pacientes' && (
              <PatientsView
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
                onUpdatePatient={handleUpdatePatientProfile}
                onAddGalleryFiles={handleAddGalleryFiles}
                onDeleteGalleryPhoto={handleDeleteGalleryPhoto}
                onPatientCreated={patientState.refreshPatients}
                mergePatientById={mergePatientById}
                refreshPatients={refreshPatients}
                roleUserId={roleUserId}
              />
            )}

            {activeView === 'anamnese' && <AnamneseAdminView />}

            {!['jornada', 'pacientes', 'anamnese'].includes(activeView) && (
              <div className="p-6 rounded-2xl border-[3px] border-[#00a88e]/15 bg-[#f8fbfb] text-[#64748b] font-bold text-[14px]">
                Visao nao encontrada.
              </div>
            )}
          </div>
        </div>
      </main>

      {/* CSS Global */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #00a88e; border-radius: 10px; opacity: 0.5; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #00967f; }
      `}} />

      <MobileNavigation
        activeView={activeView}
        onGoJornada={() => goToView('jornada')}
        onGoPacientes={() => goToView('pacientes')}
        onGoAnamnese={() => goToView('anamnese')}
        onLogout={handleLogout}
      />

      <ProcedureCameraWidget
        visible={activeView === 'jornada' && currentStep >= 2 && currentStep <= 5}
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
        uploadDocumentFiles={(files) => handleUploadDocumentFiles(files)}
      />
    </div>
  );
}

