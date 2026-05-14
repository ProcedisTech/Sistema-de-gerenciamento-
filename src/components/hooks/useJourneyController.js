import { useEffect } from 'react';
import { useToast } from '../../contexts/useToast.js';
import { authHeadersForFetch } from '../../services/api.js';
import { normalizeSexoForApi } from '../../utils/patientMapping.js';

export function useJourneyController({
  state,
  setters,
  helpers,
}) {
  const toast = useToast();
  const {
    currentStep,
    queixa,
    expectativas,
    journeyId,
    anamnesePhotoBlob,
    anamnesePhotoMeta,
    anamnesePhotoUrl,
    photoPreviewUrl,
    evaluationAnnotatedPhotoUrl,
  } = state;

  const {
    setCurrentStep,
    setActiveTab,
    setSearchQuery,
    setNome,
    setDataNascimento,
    setIdade,
    setSexo,
    setEstadoCivilId,
    setProfissaoId,
    setCpf,
    setRg,
    setTelefone,
    setEmail,
    setEndereco,
    setStep1Errors,
    setSelectedPatientCpf,
    setEvaluationCapturedPhotos,
    setEvaluationSelectedPhotoIndex,
    setEvaluationAnnotatedPhotoUrl,
    setImageSrc,
    setPaths,
    setIsFinishing,
    setJourneyId,
    setAnamnesePhotoUrl,
    setAnamnesePhotoBlob,
    setAnamnesePhotoMeta,
    setPhotoPreviewUrl,
    setPhotoPreviewBlob,
    setQueixa,
    setExpectativas,
    setPointSize,
    setShowPointNumbers,
    setEraserSize,
    setCursorPos,
    setIsHoveringCanvas,
    setTermoLido,
    setTermoAssinado,
    setOrientacoesItens = () => {},
    setOrientacoesCarregadas = () => {},
  } = setters;

  const { generateJourneyId, api } = helpers;

  const selectPatient = (patient) => {
    if (!patient) return;
    setNome(patient.nome || '');
    setDataNascimento(patient.dataNascimento || '');
    setIdade(patient.idade !== undefined && patient.idade !== null ? String(patient.idade) : '');
    const sx = normalizeSexoForApi(patient.sexo);
    setSexo(sx || '');
    setEstadoCivilId(
      patient.estadoCivilId != null && String(patient.estadoCivilId).trim() !== ''
        ? String(patient.estadoCivilId)
        : ''
    );
    setProfissaoId(patient.profissaoId ?? null);
    setEndereco(patient.endereco || '');
    setCpf(patient.cpf || '');
    setRg(patient.rg || '');
    setTelefone(patient.telefone || '');
    setEmail(patient.email || '');
    setStep1Errors({});
    setSelectedPatientCpf(patient.cpf || null);

    const photos = patient.evaluationCapturedPhotos || [];
    setEvaluationCapturedPhotos(photos);

    const selectedIdx =
      patient.evaluationSelectedPhotoIndex !== undefined && patient.evaluationSelectedPhotoIndex !== null
        ? patient.evaluationSelectedPhotoIndex
        : photos.length > 0
          ? photos.length - 1
          : null;

    setEvaluationSelectedPhotoIndex(selectedIdx);
    setEvaluationAnnotatedPhotoUrl(patient.evaluationAnnotatedPhotoUrl || null);

    if (selectedIdx !== null && photos[selectedIdx]?.url) {
      setImageSrc(photos[selectedIdx].url);
      setPaths([]);
    } else {
      setImageSrc(null);
      setPaths([]);
    }

    setActiveTab('existente');
  };

  const handleDataNascimentoChange = (e) => {
    const novaData = e.target.value;
    setDataNascimento(novaData);
    if (novaData) {
      const [ano, mes, dia] = novaData.split('-');
      const dataNasc = new Date(ano, mes - 1, dia);
      const hoje = new Date();
      let idadeCalculada = hoje.getFullYear() - dataNasc.getFullYear();
      const m = hoje.getMonth() - dataNasc.getMonth();
      if (m < 0 || (m === 0 && hoje.getDate() < dataNasc.getDate())) {
        idadeCalculada--;
      }
      setIdade(idadeCalculada);
    } else {
      setIdade('');
    }
  };

  const handleNextStep = () => {
    if (currentStep === 2) {
      if (!queixa.trim() || !expectativas.trim()) {
        toast.warning('Para prosseguir, preencha a queixa principal e as expectativas.');
        return;
      }
    }

    if (currentStep < 5) setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    if (currentStep > 2) setCurrentStep(currentStep - 1);
  };

  const resetJourney = () => {
    setCurrentStep(2);
    setActiveTab('existente');
    setSearchQuery('');

    if (anamnesePhotoUrl) {
      try {
        URL.revokeObjectURL(anamnesePhotoUrl);
      } catch {
        // ignore
      }
    }

    setJourneyId(null);
    setAnamnesePhotoUrl(null);
    setAnamnesePhotoBlob(null);
    setAnamnesePhotoMeta(null);

    if (photoPreviewUrl) {
      try {
        URL.revokeObjectURL(photoPreviewUrl);
      } catch {
        // ignore
      }
    }

    setPhotoPreviewUrl(null);
    setPhotoPreviewBlob(null);
    setEvaluationCapturedPhotos([]);
    setEvaluationSelectedPhotoIndex(null);

    if (evaluationAnnotatedPhotoUrl) {
      try {
        URL.revokeObjectURL(evaluationAnnotatedPhotoUrl);
      } catch {
        // ignore
      }
    }

    setEvaluationAnnotatedPhotoUrl(null);
    setDataNascimento('');
    setIdade('');
    setNome('');
    setSexo('');
    setEstadoCivilId('');
    setProfissaoId(null);
    setEndereco('');
    setStep1Errors({});
    setCpf('');
    setRg('');
    setTelefone('');
    setEmail('');
    setQueixa('');
    setExpectativas('');
    setImageSrc(null);
    setPaths([]);
    setPointSize(12);
    setShowPointNumbers(true);
    setEraserSize(20);
    setCursorPos({ x: -100, y: -100 });
    setIsHoveringCanvas(false);
    setTermoLido(false);
    setTermoAssinado(false);
    setOrientacoesItens([]);
    setOrientacoesCarregadas(false);
  };

  const handleFinishJourney = () => {
    setIsFinishing(true);
    setTimeout(() => {
      const sendPhoto = async () => {
        if (!anamnesePhotoBlob || !journeyId) return;

        try {
          const form = new FormData();
          form.append('journeyId', journeyId);
          form.append('photo', anamnesePhotoBlob, `anamnese_${journeyId}.jpg`);
          if (anamnesePhotoMeta) form.append('meta', JSON.stringify(anamnesePhotoMeta));

          await fetch(api(`/api/journeys/${journeyId}/photos`), {
            method: 'POST',
            body: form,
            credentials: 'include',
            headers: { ...authHeadersForFetch() },
          });
        } catch {
          // ignore
        }
      };

      Promise.resolve(sendPhoto()).finally(() => {
        toast.success('Jornada finalizada e paciente salvo com sucesso.');
        resetJourney();
        setIsFinishing(false);
      });
    }, 1000);
  };

  useEffect(() => {
    if (currentStep === 2 && !journeyId) {
      setJourneyId(generateJourneyId());
    }
  }, [currentStep, journeyId, setJourneyId, generateJourneyId]);

  return {
    selectPatient,
    handleDataNascimentoChange,
    handleNextStep,
    prevStep,
    handleFinishJourney,
    resetJourney,
  };
}

