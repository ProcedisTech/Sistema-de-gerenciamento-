import { useEffect } from 'react';

export function useJourneyController({
  state,
  setters,
  helpers,
}) {
  const {
    currentStep,
    activeTab,
    nome,
    dataNascimento,
    sexo,
    estadoCivil,
    profissao,
    alergias,
    cpf,
    rg,
    telefone,
    email,
    lgpdInicial,
    idade,
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
    setEstadoCivil,
    setProfissao,
    setAlergias,
    setCpf,
    setRg,
    setTelefone,
    setEmail,
    setStep1Errors,
    setSelectedPatientCpf,
    setPatients,
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
    setGestante,
    setAmamentando,
    setAnticoagulantes,
    setQueloides,
    setPointSize,
    setShowPointNumbers,
    setEraserSize,
    setCursorPos,
    setIsHoveringCanvas,
    setTermoLido,
    setTermoAssinado,
    setOrientacoes,
    setSatisfacao,
  } = setters;

  const { calculateAgeFromISODate, generateJourneyId, api } = helpers;

  const selectPatient = (patient) => {
    if (!patient) return;
    setNome(patient.nome || '');
    setDataNascimento(patient.dataNascimento || '');
    setIdade(patient.idade !== undefined && patient.idade !== null ? String(patient.idade) : '');
    setSexo(patient.sexo || '');
    setEstadoCivil(patient.estadoCivil || '');
    setProfissao(patient.profissao || '');
    setAlergias(patient.alergias || '');
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
    if (currentStep === 1 && activeTab === 'novo') {
      const errors = {};
      if (!nome.trim()) errors.nome = true;
      if (!dataNascimento) errors.dataNascimento = true;
      if (!sexo) errors.sexo = true;
      if (!estadoCivil) errors.estadoCivil = true;
      if (!profissao.trim()) errors.profissao = true;
      if (!alergias.trim()) errors.alergias = true;
      if (!cpf.trim()) errors.cpf = true;
      if (!telefone.trim()) errors.telefone = true;
      if (!email.trim()) errors.email = true;
      if (!lgpdInicial) errors.lgpdInicial = true;

      if (Object.keys(errors).length > 0) {
        setStep1Errors(errors);
        return;
      }

      const newCpf = cpf.trim();
      const patientAge = idade !== '' && idade !== null ? idade : calculateAgeFromISODate(dataNascimento);

      const newPatient = {
        id: `patient_${Date.now()}_${Math.random().toString(16).slice(2)}`,
        nome: nome.trim(),
        dataNascimento,
        idade: patientAge !== '' ? patientAge : '',
        sexo,
        estadoCivil,
        profissao: profissao.trim(),
        alergias: alergias.trim(),
        cpf: newCpf,
        rg: rg || '',
        telefone: telefone || '',
        email: email || '',
      };

      setPatients((prev) => {
        if (!newCpf) return [...prev, newPatient];
        const idx = prev.findIndex((p) => p.cpf === newCpf);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = { ...copy[idx], ...newPatient, id: copy[idx].id };
          return copy;
        }
        return [...prev, newPatient];
      });

      setSelectedPatientCpf(newCpf || null);
      setActiveTab('existente');
      setStep1Errors({});
    }

    if (currentStep === 2) {
      if (!queixa.trim() || !expectativas.trim()) {
        alert('Por favor, preencha a Queixa Principal e as Expectativas antes de avancar.');
        return;
      }
    }

    if (currentStep < 5) setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const resetJourney = () => {
    setCurrentStep(1);
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
    setEstadoCivil('');
    setProfissao('');
    setAlergias('');
    setStep1Errors({});
    setCpf('');
    setRg('');
    setTelefone('');
    setEmail('');
    setQueixa('');
    setExpectativas('');
    setGestante(false);
    setAmamentando(false);
    setAnticoagulantes(false);
    setQueloides(false);
    setImageSrc(null);
    setPaths([]);
    setPointSize(12);
    setShowPointNumbers(true);
    setEraserSize(20);
    setCursorPos({ x: -100, y: -100 });
    setIsHoveringCanvas(false);
    setTermoLido(false);
    setTermoAssinado(false);
    setOrientacoes(false);
    setSatisfacao(false);
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
          });
        } catch {
          // ignore
        }
      };

      Promise.resolve(sendPhoto()).finally(() => {
        alert('Jornada finalizada e paciente salvo com sucesso!');
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

