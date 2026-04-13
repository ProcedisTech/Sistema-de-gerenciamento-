import React, { useRef, useState } from 'react';
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
import { anamneseApi, pacientesApi, pacientesGaleriaApi, procedimentosApi, termosApi } from '../services/api';
import { mapBackendPatient, journeyToPacienteCreateDTO } from '../utils/patientMapping';
import { formatGaleriaLegendaForUpload, GALERIA_CATEGORIA } from '../utils/pacienteGaleria.js';

import { PatientsView } from './patients';
import { AnamneseAdminView } from './anamnese';
import { TermosManager } from './termos/TermosManager';
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

export default function App() {
  const { roleUserId, setRoleUserId, setOrgId } = useOrg();
  const toast = useToast();
  // ============ ESTADO GLOBAL ============
  const authState = useAuthState({ setRoleUserId, setOrgId });
  const authSessionReady = authState.authReady && authState.cookieConsentAccepted && authState.isLoggedIn;
  const patientState = usePatientState({ authEnabled: authSessionReady });
  const journeyState = useJourneyState();
  /** Remonta Step1CheckIn ao resetar jornada (estado local da data mascarada). */
  const [step1CheckInKey, setStep1CheckInKey] = useState(0);
  const [journeyTermoTitulo, setJourneyTermoTitulo] = React.useState('');
  const [journeyTermoConteudo, setJourneyTermoConteudo] = React.useState('');
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const anamneseRef = useRef(null);
  /** Id do preenchimento retornado por `createPaciente` (PATCH de observações ao finalizar). */
  const anamnesePreenchimentoIdRef = useRef(null);
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
    patientsListOrder,
    setPatientsListOrder,
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

  /** Grava na lista da câmera o JPEG já com desenho (etapa 3), para LGPD/galeria usarem a mesma imagem. */
  const handleAnnotatedCaptureSaved = ({ index, newUrl, blob }) => {
    cameraState.replaceEvaluationCapturedPhotoAt(index, { url: newUrl, blob });
    journeyState.setImageSrc(newUrl);
    journeyState.setPaths([]);
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
  const [activeView, _setActiveView] = React.useState(() => {
    try {
      return sessionStorage.getItem('activeView') || 'jornada';
    } catch {
      return 'jornada';
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
    setActiveView(view);
  };

  React.useEffect(() => {
    if (activeView !== 'jornada') return undefined;
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
  }, [activeView]);

  React.useEffect(() => {
    if (activeView !== 'jornada' || currentStep !== 4) return undefined;
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
  }, [activeView, currentStep]);

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
      estadoCivil: existingPatient?.estadoCivil || '',
      estadoCivilId: journeyState.estadoCivilId || existingPatient?.estadoCivilId || '',
      profissao: journeyState.profissao || '',
      alergias: existingPatient?.alergias ?? '',
      endereco: journeyState.endereco || existingPatient?.endereco || '',
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
        const { nome, dataNascimento, sexo, estadoCivilId, profissao, cpf, telefone, email } = journeyState;
        const errors = {};
        if (!nome.trim()) errors.nome = true;
        if (!dataNascimento) errors.dataNascimento = true;
        if (!sexo) errors.sexo = true;
        if (!String(estadoCivilId || '').trim()) errors.estadoCivil = true;
        if (!profissao.trim()) errors.profissao = true;
        if (!cpf.trim()) errors.cpf = true;
        if (!telefone.trim()) errors.telefone = true;
        if (!email.trim()) errors.email = true;

        if (Object.keys(errors).length > 0) {
          journeyState.setStep1Errors(errors);
          toast.error(messageForMissingStep1Fields(errors));
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
          toast.error('Para prosseguir, selecione um paciente para continuar à anamnese.');
          return;
        }
        upsertPatientLocal({ ensureSelected: true });
      }

      journeyState.setStep1Errors({});
    }

    if (currentStep === 2) {
      const { queixa, expectativas, observacoesExecucao } = journeyState;
      if (!queixa.trim() || !expectativas.trim()) {
        const e2 = {};
        if (!queixa.trim()) e2.queixa = true;
        if (!expectativas.trim()) e2.expectativas = true;
        journeyState.setStep2Errors(e2);
        toast.error('Para prosseguir, preencha a queixa principal e as expectativas.');
        return;
      }

      journeyState.setStep2Errors({});
      upsertPatientLocal({ ensureSelected: true });

      const anamneseData = anamneseRef.current?.getAnamneseData?.();
      const temFicha =
        Boolean(anamneseData?.anamneseId) && (anamneseData?.respostas?.length ?? 0) > 0;
      const temObservacoes = Boolean(queixa.trim() || expectativas.trim());

      if (temFicha || temObservacoes) {
        const paciente = patients.find((p) => {
          const pCpf = String(p?.cpf || '').trim();
          const sCpf = String(selectedPatientCpf || journeyState.cpf || '').trim();
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
          const observacoesBase = `Queixa: ${queixa}. Expectativas: ${expectativas}`;
          const execTrim = String(observacoesExecucao || '').trim();
          const observacoes = execTrim
            ? `${observacoesBase}\n\nObservações de execução: ${execTrim}`
            : observacoesBase;
          try {
            const created = await anamneseApi.createPaciente(paciente.id, rid, {
              anamneseId,
              observacoes,
              respostas: anamneseData?.respostas || [],
            });
            const pid = created?.id ?? created?.preenchimentoId;
            if (pid != null && pid !== '') {
              anamnesePreenchimentoIdRef.current = String(pid);
            }
          } catch (err) {
            console.warn('Erro ao salvar anamnese:', err.message);
          }
        }
      }
    }

    if (currentStep === 4) {
      const { termoLido, termoAssinado } = journeyState;
      if (!termoLido || !termoAssinado) {
        journeyState.setStep4Errors({
          termoLido: !termoLido,
          termoAssinado: !termoAssinado,
        });
        toast.error('Para prosseguir, confirme a leitura e a assinatura do termo LGPD.');
        return;
      }

      journeyState.setStep4Errors({});
      upsertPatientLocal({ ensureSelected: true });
    }

    if (currentStep === 5) {
      const { orientacoes, satisfacao } = journeyState;
      if (!orientacoes || !satisfacao) {
        journeyState.setStep5Errors({
          orientacoes: !orientacoes,
          satisfacao: !satisfacao,
        });
        toast.error('Para prosseguir, confirme as orientações e o nível de satisfação.');
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
      if (currentStep === 2) journeyState.setStep2Errors({});
      if (currentStep === 4) journeyState.setStep4Errors({});
      if (currentStep === 5) journeyState.setStep5Errors({});
      setCurrentStep(currentStep - 1);
    }
  };

  const finishJourney = async () => {
    if (finishJourneyLockRef.current) return;
    finishJourneyLockRef.current = true;
    setIsFinishing(true);
    try {
      const execTrim = String(journeyState.observacoesExecucao || '').trim();
      const sCpf = String(selectedPatientCpf || journeyState.cpf || '').trim();
      const paciente = sCpf
        ? patients.find((p) => String(p?.cpf || '').trim() === sCpf)
        : null;
      if (execTrim && paciente?.id && anamnesePreenchimentoIdRef.current) {
        await anamneseApi.atualizarObservacoesAnamnese(
          paciente.id,
          anamnesePreenchimentoIdRef.current,
          execTrim
        );
      }
      if (journeyState.nomeProcedimento.trim() && paciente?.id && roleUserId) {
        await procedimentosApi.registrarManual(paciente.id, {
          nome: journeyState.nomeProcedimento.trim(),
          roleUserId,
          observacao: String(journeyState.observacoesExecucao || '').trim() || null,
        });
      }
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

  const handleUploadDocumentFiles = () => {
    // Stub: evita ReferenceError no botão de documentos do widget; implementar envio quando houver API.
  };

  const resetJourney = () => {
    setCurrentStep(1);
    journeyState.setNome('');
    journeyState.setDataNascimento('');
    journeyState.setIdade('');
    journeyState.setSexo('');
    journeyState.setEstadoCivilId('');
    journeyState.setProfissao('');
    journeyState.setEndereco('');
    journeyState.setCpf('');
    journeyState.setRg('');
    journeyState.setTelefone('');
    journeyState.setEmail('');
    journeyState.setQueixa('');
    journeyState.setExpectativas('');
    journeyState.setStep2AnamneseDraft({
      fichaSelecionadaId: '',
      fichaDropdownNovo: '',
      respostas: {},
      preenchimentoAnterior: null,
      modoVisualizacao: false,
    });
    journeyState.setRespostasAnamnese({});
    journeyState.setImageSrc(null);
    journeyState.setPaths([]);
    journeyState.setTermoLido(false);
    journeyState.setTermoAssinado(false);
    journeyState.setTermoAssinaturaDataUrl('');
    journeyState.setOrientacoes(false);
    journeyState.setSatisfacao(false);
    journeyState.setObservacoesExecucao('');
    journeyState.setNomeProcedimento('');
    journeyState.setStep2Errors({});
    journeyState.setStep4Errors({});
    journeyState.setStep5Errors({});
    anamnesePreenchimentoIdRef.current = null;
    setStep1CheckInKey((k) => k + 1);
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
      journeyState.setEstadoCivilId('');
      journeyState.setProfissao('');
      journeyState.setEndereco('');
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
    const sx = String(patient.sexo || '').trim().toUpperCase();
    journeyState.setSexo(sx === 'F' || sx === 'M' ? sx : '');
    journeyState.setEstadoCivilId(
      patient.estadoCivilId != null && String(patient.estadoCivilId).trim() !== ''
        ? String(patient.estadoCivilId)
        : ''
    );
    journeyState.setProfissao(patient.profissao || '');
    journeyState.setEndereco(patient.endereco || '');
    journeyState.setCpf(patient.cpf || '');
    journeyState.setRg(patient.rg || '');
    journeyState.setTelefone(patient.telefone || '');
    journeyState.setEmail(patient.email || '');
    journeyState.setStep1Errors({});
    patientState.setSelectedPatientCpf(patient.cpf || null);
    journeyState.setActiveTab('existente');
  };

  const pacienteAtual = React.useMemo(() => {
    const sCpf = String(selectedPatientCpf || journeyState.cpf || '').trim();
    if (!sCpf) return null;
    return patients.find((p) => String(p?.cpf || '').trim() === sCpf) ?? null;
  }, [patients, selectedPatientCpf, journeyState.cpf]);

  /** Envia o JPEG com desenho para a galeria do paciente (mesma API do perfil). */
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
      const file = new File([blob], `avaliacao_${Date.now()}.jpg`, { type: 'image/jpeg' });
      await pacientesGaleriaApi.upload(pid, file, {
        roleUserId: rid,
        legenda: formatGaleriaLegendaForUpload(GALERIA_CATEGORIA.PLANEJAMENTO, 'Mapeamento'),
        dataReferencia: new Date().toISOString().slice(0, 10),
      });
      return { ok: true };
    },
    [pacienteAtual?.id, roleUserId, toast]
  );

  const isJornadaView = activeView === 'jornada';

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
      <main
        className={`flex flex-1 flex-col h-full pb-[112px] md:pb-0 ${
          isJornadaView ? 'min-h-0 overflow-hidden' : 'overflow-y-auto'
        }`}
      >
        <header
          className={`border-b-[3px] border-[#00a88e]/15 shadow-[0_4px_24px_rgb(0,168,142,0.02)] ${
            isJornadaView
              ? 'sticky top-0 z-10 shrink-0 bg-[#f8fbfb] px-4 py-6 sm:px-6 md:px-10 sm:py-8'
              : `z-0 bg-white ${
                  activeView === 'anamnese' || activeView === 'pacientes' || activeView === 'termos'
                    ? 'px-4 sm:px-5 md:px-8 lg:px-10 py-3 sm:py-3.5 md:py-4'
                    : 'px-4 sm:px-6 md:px-10 py-6 sm:py-8'
                }`
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
          ) : activeView === 'termos' ? (
            <div className="min-w-0">
              <h2 className="text-[18px] sm:text-[21px] md:text-[22px] font-bold text-[#0f172a] leading-tight mb-0.5">Termos</h2>
              <p className="text-[#64748b] text-[12px] sm:text-[13px] md:text-[14px] font-medium leading-snug">
                Texto de consentimento exibido na jornada (LGPD)
              </p>
            </div>
          ) : activeView === 'jornada' ? (
            <>
              <Stepper currentStep={currentStep} />
              {(journeyState.nome || journeyState.telefone) && (
                <div className="flex items-center gap-4 mt-2 px-1 text-[13px] text-[#475569]">
                  {journeyState.nome && (
                    <span className="font-bold text-[#0f766e]">{journeyState.nome}</span>
                  )}
                  {journeyState.idade && (
                    <span>{journeyState.idade} anos</span>
                  )}
                  {journeyState.telefone && (
                    <span>{journeyState.telefone}</span>
                  )}
                </div>
              )}
            </>
          ) : null}
        </header>

        {isJornadaView ? (
          <>
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto">
                <div className="mx-auto w-full max-w-[1600px] p-3 pb-20 sm:p-6 md:px-8 md:pt-8 md:pb-8">
                  <div className="rounded-[20px] border-[3px] border-[#00a88e]/25 bg-white p-4 pb-5 shadow-lg shadow-[#00a88e]/5 sm:p-8 sm:pb-6 md:pb-8">
                  {currentStep === 1 && (
                    <Step1CheckIn
                      key={step1CheckInKey}
                      activeTab={journeyState.activeTab}
                      setActiveTab={journeyState.setActiveTab}
                      searchQuery={journeyState.searchQuery}
                      setSearchQuery={journeyState.setSearchQuery}
                      selectedPatientCpf={selectedPatientCpf}
                      setSelectedPatientCpf={setSelectedPatientCpf}
                      patients={patients}
                      nome={journeyState.nome}
                      setNome={journeyState.setNome}
                      dataNascimento={journeyState.dataNascimento}
                      setDataNascimento={journeyState.setDataNascimento}
                      idade={journeyState.idade}
                      setIdade={journeyState.setIdade}
                      sexo={journeyState.sexo}
                      setSexo={journeyState.setSexo}
                      estadoCivilId={journeyState.estadoCivilId}
                      setEstadoCivilId={journeyState.setEstadoCivilId}
                      profissao={journeyState.profissao}
                      setProfissao={journeyState.setProfissao}
                      endereco={journeyState.endereco}
                      setEndereco={journeyState.setEndereco}
                      cpf={journeyState.cpf}
                      setCpf={journeyState.setCpf}
                      rg={journeyState.rg}
                      setRg={journeyState.setRg}
                      telefone={journeyState.telefone}
                      setTelefone={journeyState.setTelefone}
                      email={journeyState.email}
                      setEmail={journeyState.setEmail}
                      step1Errors={journeyState.step1Errors}
                      setStep1Errors={journeyState.setStep1Errors}
                      selectPatient={selectPatient}
                    />
                  )}

                  {currentStep === 2 && (
                    <Step2Anamnese
                      ref={anamneseRef}
                      queixa={journeyState.queixa}
                      setQueixa={journeyState.setQueixa}
                      expectativas={journeyState.expectativas}
                      setExpectativas={journeyState.setExpectativas}
                      pacienteId={pacienteAtual?.id || null}
                      step2Errors={journeyState.step2Errors}
                      setStep2Errors={journeyState.setStep2Errors}
                      savedAnamneseState={journeyState.step2AnamneseDraft}
                      onSavedAnamneseStateChange={journeyState.setStep2AnamneseDraft}
                      respostasAnamnese={journeyState.respostasAnamnese}
                      salvarRespostaAnamnese={journeyState.salvarRespostaAnamnese}
                      setRespostasAnamnese={journeyState.setRespostasAnamnese}
                    />
                  )}

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
                      onAnnotatedCaptureSaved={handleAnnotatedCaptureSaved}
                      persistAnnotatedPhotoToGallery={persistAnnotatedPhotoToGallery}
                      evaluationPhotoMax={cameraState.EVALUATION_PHOTO_MAX}
                    />
                  )}

                  {currentStep === 4 && (
                    <Step4LGPD
                      termoLido={journeyState.termoLido}
                      setTermoLido={journeyState.setTermoLido}
                      termoAssinado={journeyState.termoAssinado}
                      setTermoAssinado={journeyState.setTermoAssinado}
                      termoAssinaturaDataUrl={journeyState.termoAssinaturaDataUrl}
                      setTermoAssinaturaDataUrl={journeyState.setTermoAssinaturaDataUrl}
                      lgpdCapturedPhotos={cameraState.evaluationCapturedPhotos}
                      lgpdPhotoMax={cameraState.EVALUATION_PHOTO_MAX}
                      onLgpdUploadFiles={cameraState.uploadPhotoFiles}
                      onLgpdRemovePhoto={handleDeleteCapturedPhoto}
                      step4Errors={journeyState.step4Errors}
                      setStep4Errors={journeyState.setStep4Errors}
                      nomeProcedimento={journeyState.nomeProcedimento}
                      setNomeProcedimento={journeyState.setNomeProcedimento}
                      observacoesExecucao={journeyState.observacoesExecucao}
                      setObservacoesExecucao={journeyState.setObservacoesExecucao}
                      termoTitulo={journeyTermoTitulo || undefined}
                      termoConteudo={journeyTermoConteudo || undefined}
                    />
                  )}

                  {currentStep === 5 && (
                    <Step5Finalization
                      orientacoes={journeyState.orientacoes}
                      setOrientacoes={journeyState.setOrientacoes}
                      satisfacao={journeyState.satisfacao}
                      setSatisfacao={journeyState.setSatisfacao}
                      step5Errors={journeyState.step5Errors}
                      setStep5Errors={journeyState.setStep5Errors}
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="hidden md:block shrink-0 border-t-[3px] border-[#00a88e]/15 bg-[#f8fbfb]/98 backdrop-blur-sm shadow-[0_-6px_28px_-8px_rgba(15,23,42,0.08)] z-20">
              <div className="mx-auto w-full max-w-[1600px] px-3 py-3 sm:px-6 md:px-8 md:py-4">
                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={prevStep}
                    disabled={currentStep === 1 || isFinishing}
                    className={`flex w-full items-center justify-center gap-2 rounded-xl border-[3px] px-6 py-3 text-[14px] font-bold shadow-sm outline-none transition-all sm:w-auto ${
                      currentStep === 1 || isFinishing
                        ? 'cursor-not-allowed border-[#e2e8f0] bg-[#f8fbfb] text-[#94a3b8]'
                        : 'border-[#00a88e]/25 bg-white text-[#00a88e] hover:border-[#00a88e] hover:bg-[#e6f7f5]'
                    }`}
                  >
                    <ChevronLeft className="h-4 w-4" strokeWidth={3} /> Etapa anterior
                  </button>

                  {currentStep < 5 ? (
                    <button
                      type="button"
                      onClick={handleNextStep}
                      disabled={isFinishing}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border-[3px] border-transparent bg-[#00a88e] px-6 py-3 text-[14px] font-bold text-white shadow-md outline-none transition-all hover:bg-[#00967f] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                    >
                      Próxima etapa <ChevronRight className="h-4 w-4" strokeWidth={3} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleNextStep}
                      disabled={isFinishing}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border-[3px] border-transparent bg-[#22c55e] px-6 py-3 text-[14px] font-bold text-white shadow-md outline-none transition-all hover:bg-[#16a34a] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                    >
                      Finalizar procedimento ✓
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

            <div className="md:hidden pointer-events-none fixed inset-x-0 top-0 bottom-0 z-[125]">
              <div className="pointer-events-auto absolute left-3 bottom-[calc(5.75rem+env(safe-area-inset-bottom,0px))]">
                <button
                  type="button"
                  onClick={prevStep}
                  disabled={currentStep === 1 || isFinishing}
                  aria-label="Etapa anterior"
                  className={`flex h-12 w-12 items-center justify-center rounded-full border-[3px] border-white/40 bg-[#00a88e] text-white shadow-lg outline-none transition-all ${
                    currentStep === 1 || isFinishing
                      ? 'cursor-not-allowed opacity-45'
                      : 'hover:bg-[#00967f] active:scale-[0.98]'
                  }`}
                >
                  <ChevronLeft className="h-6 w-6" strokeWidth={2.75} aria-hidden />
                </button>
              </div>
              <div className="pointer-events-auto absolute right-3 bottom-[calc(5.75rem+env(safe-area-inset-bottom,0px))]">
                <button
                  type="button"
                  onClick={handleNextStep}
                  disabled={isFinishing}
                  aria-label={currentStep < 5 ? 'Próxima etapa' : 'Finalizar procedimento'}
                  className={`flex h-12 w-12 items-center justify-center rounded-full border-[3px] border-white/40 text-white shadow-lg outline-none transition-all ${
                    currentStep < 5 ? 'bg-[#00a88e]' : 'bg-[#22c55e] border-[#22c55e]/50'
                  } ${
                    isFinishing ? 'cursor-not-allowed opacity-45' : 'hover:opacity-95 active:scale-[0.98]'
                  }`}
                >
                  <ChevronRight className="h-6 w-6" strokeWidth={2.75} aria-hidden />
                </button>
              </div>
            </div>
          </>
        ) : (
        <div
          className={`w-full mx-auto ${
            activeView === 'anamnese' || activeView === 'termos'
              ? 'px-3 pt-2 pb-3 sm:px-6 sm:pt-3 sm:pb-6 md:px-8 md:pt-4 md:pb-8 max-w-[1100px] md:max-w-none lg:max-w-[min(100%,1380px)] xl:max-w-[min(100%,1600px)] 2xl:max-w-[min(100%,1800px)]'
              : activeView === 'pacientes'
                ? 'px-3 pt-1 pb-6 sm:px-5 sm:pt-2 sm:pb-8 md:px-6 md:pt-2 md:pb-8 lg:px-8 lg:pt-3 lg:pb-10 xl:px-10 max-w-[1100px] md:max-w-none lg:max-w-[min(100%,1420px)] xl:max-w-[min(100%,1680px)] 2xl:max-w-[min(100%,1920px)] flex flex-col'
                : 'p-3 sm:p-6 md:p-8 max-w-[1600px]'
          }`}
        >
          <div
            className={`bg-white rounded-[20px] border-[3px] border-[#00a88e]/25 shadow-lg shadow-[#00a88e]/5 ${
              activeView === 'anamnese' || activeView === 'termos'
                ? 'px-4 pt-3 pb-5 sm:px-6 sm:pt-4 sm:pb-6 md:px-8 md:pt-5 md:pb-8'
                : activeView === 'pacientes'
                  ? 'flex flex-col p-4 sm:p-5 md:p-6 lg:p-8 pb-6 sm:pb-8'
                  : 'p-4 sm:p-8 pb-5 sm:pb-6'
            }`}
          >

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
                patientsListOrder={patientsListOrder}
                setPatientsListOrder={setPatientsListOrder}
                roleUserId={roleUserId}
              />
            )}

            {activeView === 'anamnese' && <AnamneseAdminView />}

            {activeView === 'termos' && <TermosManager />}

            {!['jornada', 'pacientes', 'anamnese', 'termos'].includes(activeView) && (
              <div className="p-6 rounded-2xl border-[3px] border-[#00a88e]/15 bg-[#f8fbfb] text-[#64748b] font-bold text-[14px]">
                Visao nao encontrada.
              </div>
            )}
          </div>
        </div>
        )}
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
        uploadDocumentFiles={handleUploadDocumentFiles}
        cameraFacing={cameraState.preferredFacing}
        onToggleCameraFacing={cameraState.toggleCameraFacing}
      />
    </div>
  );
}

