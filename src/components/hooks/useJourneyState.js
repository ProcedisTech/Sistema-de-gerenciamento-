import { useState, useCallback, useEffect } from 'react';

/** Formato antigo do horário de início no sessionStorage (com o CPF do paciente na chave): só para remover. */
const PREFIXO_HORARIO_ANTIGO = 'procedis_start_time_';

/** Remove as chaves antigas do horário de início (o CPF não fica no storage). */
function removerHorariosAntigos() {
  try {
    const antigas = [];
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(PREFIXO_HORARIO_ANTIGO)) antigas.push(k);
    }
    antigas.forEach((k) => sessionStorage.removeItem(k));
  } catch {
    // ignore
  }
}

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
  /**
   * Observações clínicas da avaliação (antes do upload de fotos). Vai ao servidor como `observacoesAvaliacao`
   * (PATCH /atendimentos/{id}/avaliacao-texto). `observacoes`/`setObservacoes` seguem no retorno como alias.
   */
  const [observacoesAvaliacao, setObservacoesAvaliacao] = useState('');
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

  // Na primeira leitura, as chaves antigas do horário de início (com CPF) saem do sessionStorage.
  useEffect(() => {
    removerHorariosAntigos();
  }, []);

  /** Horário de início só em memória (o storage não guarda nada com o CPF; depois do F5 vale o do servidor). */
  const setAttendanceStartTime = useCallback((timeIso) => {
    setAttendanceStartTimeState(timeIso || null);
  }, []);

  /** O horário de início em memória ou, sem ele, o `iniciadoEm` da consulta no servidor. */
  const getAttendanceStartTime = useCallback(
    (iniciadoEmDoServidor) => attendanceStartTimeState || iniciadoEmDoServidor || null,
    [attendanceStartTimeState],
  );

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
  // F5b: as orientações vivem em cada linha de `procedimentosSessao` (`orient`, `itemId`, `legado`); não há mais
  // lista única nem "próximo retorno" aqui.

  /**
   * B-42 F3: quando a pessoa troca o nome que a tela mostra por outro (não vazio), a linha perde a marca
   * `nomeSoDeTela` e o nome passa a ir para o servidor. `{ manterMarca: true }` (entrada na consulta) não mexe nela.
   */
  const setNomeProcedimento = useCallback((value, opcoes = {}) => {
    setProcedimentosSessao((prev) => {
      const nextArr = [...prev];
      const cur = nextArr[activeProcedureIndex] || {};
      const prevVal = cur.nomeProcedimento || '';
      const nextVal = typeof value === 'function' ? value(prevVal) : value;
      const nextTrim = String(nextVal ?? '').trim();

      const naTela = String(cur.nomeProcedimento || cur.procedimentoNome || '').trim();
      const trocouONome = !opcoes?.manterMarca && nextTrim !== '' && nextTrim !== naTela;
      nextArr[activeProcedureIndex] = {
        ...cur,
        nomeProcedimento: nextVal,
        ...(trocouONome ? { nomeSoDeTela: false } : {}),
      };
      return nextArr;
    });
  }, [activeProcedureIndex]);

  const setProcedimentoDoCatalogo = useCallback((nome, catalogoId) => {
    setProcedimentosSessao((prev) => {
      const nextArr = [...prev];
      const cur = nextArr[activeProcedureIndex] || {};
      const nextNome = nome != null ? String(nome) : '';
      const nextTrim = nextNome.trim();
      const catalogo = catalogoId != null && String(catalogoId).trim() !== '' ? String(catalogoId).trim() : null;
      const naTela = String(cur.nomeProcedimento || cur.procedimentoNome || '').trim();
      // B-42 F3: escolher do catálogo (ou outro nome) é a pessoa mudando o procedimento: a linha perde a marca.
      const trocou = catalogo != null || (nextTrim !== '' && nextTrim !== naTela);
      nextArr[activeProcedureIndex] = {
        ...cur,
        nomeProcedimento: nextNome,
        nomeProcedimentoCatalogoId: catalogo,
        ...(trocou ? { nomeSoDeTela: false } : {}),
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
    observacoesAvaliacao,
    setObservacoesAvaliacao,
    /** Alias de `observacoesAvaliacao`/`setObservacoesAvaliacao` (nome antigo; mantido por compatibilidade). */
    observacoes: observacoesAvaliacao,
    setObservacoes: setObservacoesAvaliacao,
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
