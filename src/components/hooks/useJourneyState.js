import { useState, useCallback } from 'react';

export const useJourneyState = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isFinishing, setIsFinishing] = useState(false);
  const [journeyId, setJourneyId] = useState(null);

  const [step2Errors, setStep2Errors] = useState({});
  const [step4Errors, setStep4Errors] = useState({});
  const [step5Errors, setStep5Errors] = useState({});

  // ============ ETAPA 1: ANAMNESE (UI Step2Anamnese) ============
  const [queixa, setQueixa] = useState('');
  const [expectativas, setExpectativas] = useState('');
  const [step2AnamneseDraft, setStep2AnamneseDraft] = useState({
    fichaSelecionadaId: '',
    fichaDropdownNovo: '',
    respostas: {},
    preenchimentoAnterior: null,
    modoVisualizacao: false,
  });
  const [respostasAnamnese, setRespostasAnamnese] = useState({});

  const salvarRespostaAnamnese = useCallback((perguntaId, valor) => {
    if (perguntaId == null || perguntaId === '') return;
    setRespostasAnamnese((prev) => ({
      ...prev,
      [String(perguntaId)]: valor,
    }));
  }, []);

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
  const [observacoesExecucao, setObservacoesExecucao] = useState('');
  const [nomeProcedimento, setNomeProcedimento] = useState('');

  // ============ ETAPA 3: TERMOS / LGPD ============
  const [termoLido, setTermoLido] = useState(false);
  const [termoAssinado, setTermoAssinado] = useState(false);
  const [termoAssinaturaDataUrl, setTermoAssinaturaDataUrl] = useState('');
  const [profissionalAssinaturaDataUrl, setProfissionalAssinaturaDataUrl] = useState('');
  /** Id do termo escolhido na etapa LGPD (sincronizado via Step3Termos → onTermoChange). */
  const [termoSelecionadoId, setTermoSelecionadoId] = useState(null);

  // ============ ETAPA 5: FINALIZAÇÃO ============
  const [orientacoes, setOrientacoes] = useState(false);
  /** Texto mascarado DD/MM/AAAA do próximo retorno (opcional). */
  const [proximoRetornoDisplay, setProximoRetornoDisplay] = useState('');

  // ============ FOTOS ============
  const EVALUATION_PHOTO_MAX = 30;
  const [evaluationCapturedPhotos, setEvaluationCapturedPhotos] = useState([]);
  const [evaluationSelectedPhotoIndex, setEvaluationSelectedPhotoIndex] = useState(null);
  const [evaluationAnnotatedPhotoUrl, setEvaluationAnnotatedPhotoUrl] = useState(null);

  // ============ FOTOS DURANTE PROCEDIMENTO ============
  const [anamnesePhotoUrl, setAnamnesePhotoUrl] = useState(null);
  const [anamnesePhotoBlob, setAnamnesePhotoBlob] = useState(null);
  const [anamnesePhotoMeta, setAnamnesePhotoMeta] = useState(null);

  return {
    currentStep,
    setCurrentStep,
    isFinishing,
    setIsFinishing,
    journeyId,
    setJourneyId,
    step2Errors,
    setStep2Errors,
    step4Errors,
    setStep4Errors,
    step5Errors,
    setStep5Errors,
    queixa,
    setQueixa,
    expectativas,
    setExpectativas,
    step2AnamneseDraft,
    setStep2AnamneseDraft,
    respostasAnamnese,
    setRespostasAnamnese,
    salvarRespostaAnamnese,
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
    observacoesExecucao,
    setObservacoesExecucao,
    nomeProcedimento,
    setNomeProcedimento,
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
    orientacoes,
    setOrientacoes,
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
