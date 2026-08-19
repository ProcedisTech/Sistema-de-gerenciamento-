import { useState, useCallback, useMemo } from 'react';

export const useJourneyState = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isFinishing, setIsFinishing] = useState(false);
  const [journeyId, setJourneyId] = useState(null);
  const [agendaId, setAgendaId] = useState(null);

  const [step2Errors, setStep2Errors] = useState({});
  const [step4Errors, setStep4Errors] = useState({});
  const [step5Errors, setStep5Errors] = useState({});

  // ============ ETAPA 1: ANAMNESE (UI Step2Anamnese) ============
  const [queixa, setQueixa] = useState('');
  const [expectativas, setExpectativas] = useState('');
  const [step2AnamneseDraft, setStep2AnamneseDraft] = useState({
    pacienteId: null,
    fichaSelecionadaId: '',
    fichaDropdownNovo: '',
    respostas: {},
    preenchimentoAnterior: null,
    modoVisualizacao: false,
  });
  const [respostasAnamnese, setRespostasAnamnese] = useState({});

  /**
   * Draft do perfil clínico (Bloco 1) — separado do draft da anamnese da visita.
   * Shape: { pacienteId: string|null, state: object, isDirty: boolean } | null
   */
  const [step2PerfilClinicoDraft, setStep2PerfilClinicoDraft] = useState(null);

  // ============ ETAPA 2: AVALIAÇÃO — contexto do plano (step 2 → 4) ============
  /** { planejamentoId, itemIdByCatalogo, procedimentosComPontos? } */
  const [journeyPlanejamentoCtx, setJourneyPlanejamentoCtx] = useState(null);

  // ============ ETAPA 2: AVALIAÇÃO ============
  /** Observações clínicas e expectativas registradas durante a avaliação (antes do upload de fotos). */
  const [observacoes, setObservacoes] = useState('');
  const [imageSrc, setImageSrc] = useState(null);
  const [activeTool, setActiveTool] = useState('draw');
  const [activeColor, setActiveColor] = useState('#ef4444');
  const [strokeWidth] = useState(3);
  const [pointSize, setPointSize] = useState(12);
  const [showPointNumbers, setShowPointNumbers] = useState(true);
  const [eraserSize, setEraserSize] = useState(20);
  const [cursorPos, setCursorPos] = useState({ x: -100, y: -100 });
  const [isHoveringCanvas, setIsHoveringCanvas] = useState(false);
  const [paths, setPaths] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);

  // ============ ETAPA 4: PROCEDIMENTO (campos gravados no passo 4) ============
  const [procedimentosSessao, setProcedimentosSessao] = useState([]);
  const [activeProcedureIndex, setActiveProcedureIndex] = useState(0);

  // Derivados para manter compatibilidade temporária com chamadas antigas se existirem
  const currentProc = procedimentosSessao[activeProcedureIndex] || {};
  const observacoesExecucao = currentProc.observacoesExecucao || '';
  const nomeProcedimento = currentProc.nomeProcedimento || currentProc.procedimentoNome || '';
  const nomeProcedimentoCatalogoId = currentProc.nomeProcedimentoCatalogoId || currentProc.catalogoProcedimentoSaudeId || null;

  const updateActiveProcedure = useCallback((patch) => {
    setProcedimentosSessao((prev) => {
      const next = [...prev];
      if (!next[activeProcedureIndex]) {
        next[activeProcedureIndex] = {};
      }
      next[activeProcedureIndex] = {
        ...next[activeProcedureIndex],
        ...(typeof patch === 'function' ? patch(next[activeProcedureIndex]) : patch)
      };
      return next;
    });
  }, [activeProcedureIndex]);

  const updateProcedureByIndex = useCallback((index, patch) => {
    setProcedimentosSessao((prev) => {
      const next = [...prev];
      if (!next[index]) {
        next[index] = {};
      }
      next[index] = {
        ...next[index],
        ...(typeof patch === 'function' ? patch(next[index]) : patch)
      };
      return next;
    });
  }, []);

  const setObservacoesExecucao = useCallback((val) => updateActiveProcedure({ observacoesExecucao: val }), [updateActiveProcedure]);
  const setNomeProcedimentoCatalogoId = useCallback((val) => updateActiveProcedure({ nomeProcedimentoCatalogoId: val }), [updateActiveProcedure]);


  /** 'consulta' | 'retorno' — derivado de agenda.tipoProcedimentoCodigo ao iniciar atendimento. */
  const [tipoAtendimento, setTipoAtendimento] = useState('consulta');
  const [procedimentoFeitoOrigemId, setProcedimentoFeitoOrigemId] = useState(null);
  const [attendanceStartTimeState, setAttendanceStartTimeState] = useState(null);

  /** Salva o horário de início no state e no sessionStorage escopado pelo CPF do paciente (com trava de mesmo dia). */
  const setAttendanceStartTime = useCallback((timeIso, patientCpf) => {
    setAttendanceStartTimeState(timeIso);
    if (!timeIso) {
      if (patientCpf) {
        try {
          sessionStorage.removeItem(`procedis_start_time_${patientCpf}`);
        } catch {
          // ignore
        }
      }
      return;
    }
    if (patientCpf) {
      try {
        const payload = JSON.stringify({ time: timeIso, date: timeIso.slice(0, 10) });
        sessionStorage.setItem(`procedis_start_time_${patientCpf}`, payload);
      } catch {
        // ignore
      }
    }
  }, []);

  /** Recupera o horário de início do state ou do sessionStorage se for do mesmo dia. */
  const getAttendanceStartTime = useCallback((patientCpf) => {
    if (attendanceStartTimeState) return attendanceStartTimeState;
    if (!patientCpf) return null;
    try {
      const raw = sessionStorage.getItem(`procedis_start_time_${patientCpf}`);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const todayIso = new Date().toISOString().slice(0, 10);
      if (parsed?.date === todayIso && parsed?.time) {
        return parsed.time;
      }
      sessionStorage.removeItem(`procedis_start_time_${patientCpf}`);
    } catch {
      // ignore
    }
    return null;
  }, [attendanceStartTimeState]);

  const [retornoAvaliacao, setRetornoAvaliacao] = useState({
    satisfacao: null,
    simetria: '',
    dor: null,
  });
  const [houveRetoque, setHouveRetoque] = useState(false);

  const isAgendaRetorno = tipoAtendimento === 'retorno';

  // ============ ETAPA 3: TERMOS / LGPD ============
  const [termoLido, setTermoLido] = useState(false);
  const [termoAssinado, setTermoAssinado] = useState(false);
  const [termoAssinaturaDataUrl, setTermoAssinaturaDataUrl] = useState('');
  const [profissionalAssinaturaDataUrl, setProfissionalAssinaturaDataUrl] = useState('');
  /** Id do termo escolhido na etapa LGPD (sincronizado via Step3Termos → onTermoChange). */
  const [termoSelecionadoId, setTermoSelecionadoId] = useState(null);
  
  /** Array de termos já assinados na jornada atual. { termoId, termoTitulo, assinaturaProfissional, assinaturaPaciente, backendAssinaturaId } */
  const [termosAssinados, setTermosAssinados] = useState([]);
  
  /** Array de IDs dos termos selecionados, mas ainda pendentes de leitura/assinatura. */
  const [termosPendentesIds, setTermosPendentesIds] = useState([]);

  // ============ ETAPA 5: FINALIZAÇÃO ============
  /** Itens editáveis de orientação pós-procedimento. */
  const [orientacoesItens, setOrientacoesItens] = useState([]);
  /** Evita refetch do template após primeira carga no Step 5 (reset ao reiniciar jornada). */
  const [orientacoesCarregadas, setOrientacoesCarregadas] = useState(false);
  /** Derivado: true se pelo menos um item estiver marcado (validação “continuar/finalizar”). */
  const orientacoes = useMemo(
    () => Array.isArray(orientacoesItens) && orientacoesItens.some((i) => i && i.checado),
    [orientacoesItens],
  );
  /** Texto mascarado DD/MM/AAAA do próximo retorno (opcional). */
  const [proximoRetornoDisplay, setProximoRetornoDisplay] = useState('');

  /** Ao mudar o nome (trim), permite novo fetch de template no Step 5 e evita lista desalinhada. */
  const setNomeProcedimento = useCallback((value) => {
    setProcedimentosSessao((prev) => {
      const nextArr = [...prev];
      const cur = nextArr[activeProcedureIndex] || {};
      const prevVal = cur.nomeProcedimento || '';
      const nextVal = typeof value === 'function' ? value(prevVal) : value;
      const prevTrim = String(prevVal ?? '').trim();
      const nextTrim = String(nextVal ?? '').trim();

      if (prevTrim !== nextTrim) {
        queueMicrotask(() => {
          setOrientacoesCarregadas(false);
          setOrientacoesItens([]);
        });
      }
      
      nextArr[activeProcedureIndex] = { ...cur, nomeProcedimento: nextVal };
      return nextArr;
    });
  }, [activeProcedureIndex]);

  const setProcedimentoDoCatalogo = useCallback((nome, catalogoId) => {
    setProcedimentosSessao((prev) => {
      const nextArr = [...prev];
      const cur = nextArr[activeProcedureIndex] || {};
      const nextNome = nome != null ? String(nome) : '';
      const prevTrim = String(cur.nomeProcedimento || '').trim();
      const nextTrim = nextNome.trim();
      if (prevTrim !== nextTrim) {
        queueMicrotask(() => {
          setOrientacoesCarregadas(false);
          setOrientacoesItens([]);
        });
      }
      nextArr[activeProcedureIndex] = {
        ...cur,
        nomeProcedimento: nextNome,
        nomeProcedimentoCatalogoId:
          catalogoId != null && String(catalogoId).trim() !== '' ? String(catalogoId).trim() : null,
      };
      return nextArr;
    });
  }, [activeProcedureIndex]);

  // ============ FOTOS ============
  const EVALUATION_PHOTO_MAX = 30;
  const [evaluationCapturedPhotos, setEvaluationCapturedPhotos] = useState([]);
  const [evaluationSelectedPhotoIndex, setEvaluationSelectedPhotoIndex] = useState(null);
  const [evaluationAnnotatedPhotoUrl, setEvaluationAnnotatedPhotoUrl] = useState(null);

  // ============ FOTOS DURANTE PROCEDIMENTO ============
  const [anamnesePhotoUrl, setAnamnesePhotoUrl] = useState(null);
  const [anamnesePhotoBlob, setAnamnesePhotoBlob] = useState(null);
  const [anamnesePhotoMeta, setAnamnesePhotoMeta] = useState(null);

  const salvarRespostaAnamnese = useCallback((perguntaId, valor) => {
    if (perguntaId == null || perguntaId === '') return;
    setRespostasAnamnese((prev) => ({
      ...prev,
      [String(perguntaId)]: valor,
    }));
  }, []);

  return {
    currentStep,
    setCurrentStep,
    isFinishing,
    setIsFinishing,
    journeyId,
    setJourneyId,
    agendaId,
    setAgendaId,
    step2Errors,
    setStep2Errors,
    step4Errors,
    setStep4Errors,
    step5Errors,
    setStep5Errors,
    activeProcedureIndex,
    setActiveProcedureIndex,
    queixa,
    setQueixa,
    expectativas,
    setExpectativas,
    step2AnamneseDraft,
    setStep2AnamneseDraft,
    step2PerfilClinicoDraft,
    setStep2PerfilClinicoDraft,
    respostasAnamnese,
    setRespostasAnamnese,
    salvarRespostaAnamnese,
    journeyPlanejamentoCtx,
    setJourneyPlanejamentoCtx,
    observacoes,
    setObservacoes,
    imageSrc,
    setImageSrc,
    activeTool,
    setActiveTool,
    activeColor,
    setActiveColor,
    strokeWidth,
    pointSize,
    setPointSize,
    showPointNumbers,
    setShowPointNumbers,
    eraserSize,
    setEraserSize,
    cursorPos,
    setCursorPos,
    isHoveringCanvas,
    setIsHoveringCanvas,
    paths,
    setPaths,
    isDrawing,
    setIsDrawing,
    procedimentosSessao,
    setProcedimentosSessao,

    updateActiveProcedure,
    updateProcedureByIndex,
    observacoesExecucao,
    setObservacoesExecucao,
    nomeProcedimento,
    setNomeProcedimento,
    nomeProcedimentoCatalogoId,
    setNomeProcedimentoCatalogoId,
    setProcedimentoDoCatalogo,
    tipoAtendimento,
    setTipoAtendimento,
    procedimentoFeitoOrigemId,
    setProcedimentoFeitoOrigemId,
    attendanceStartTime: attendanceStartTimeState,
    setAttendanceStartTime,
    getAttendanceStartTime,
    isAgendaRetorno,
    retornoAvaliacao,
    setRetornoAvaliacao,
    houveRetoque,
    setHouveRetoque,
    termoLido,
    setTermoLido,
    termoAssinado,
    setTermoAssinado,
    termoAssinaturaDataUrl,
    setTermoAssinaturaDataUrl,
    profissionalAssinaturaDataUrl,
    setProfissionalAssinaturaDataUrl,
    termoSelecionadoId,
    setTermoSelecionadoId,
    termosAssinados,
    setTermosAssinados,
    termosPendentesIds,
    setTermosPendentesIds,
    orientacoes,
    orientacoesItens,
    setOrientacoesItens,
    orientacoesCarregadas,
    setOrientacoesCarregadas,
    proximoRetornoDisplay,
    setProximoRetornoDisplay,
    EVALUATION_PHOTO_MAX,
    evaluationCapturedPhotos,
    setEvaluationCapturedPhotos,
    evaluationSelectedPhotoIndex,
    setEvaluationSelectedPhotoIndex,
    evaluationAnnotatedPhotoUrl,
    setEvaluationAnnotatedPhotoUrl,
    anamnesePhotoUrl,
    setAnamnesePhotoUrl,
    anamnesePhotoBlob,
    setAnamnesePhotoBlob,
    anamnesePhotoMeta,
    setAnamnesePhotoMeta,
  };
};
