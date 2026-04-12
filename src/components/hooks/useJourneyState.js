import { useState } from 'react';

export const useJourneyState = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isFinishing, setIsFinishing] = useState(false);
  const [journeyId, setJourneyId] = useState(null);

  // ============ ETAPA 1: CHECK-IN ============
  const [activeTab, setActiveTab] = useState('existente');
  const [searchQuery, setSearchQuery] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [idade, setIdade] = useState('');
  const [nome, setNome] = useState('');
  const [sexo, setSexo] = useState('');
  const [estadoCivilId, setEstadoCivilId] = useState('');
  const [profissao, setProfissao] = useState('');
  const [step1Errors, setStep1Errors] = useState({});
  const [step2Errors, setStep2Errors] = useState({});
  const [step4Errors, setStep4Errors] = useState({});
  const [step5Errors, setStep5Errors] = useState({});
  const [cpf, setCpf] = useState('');
  const [rg, setRg] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [endereco, setEndereco] = useState('');

  // ============ ETAPA 2: ANAMNESE ============
  const [queixa, setQueixa] = useState('');
  const [expectativas, setExpectativas] = useState('');

  // ============ ETAPA 3: AVALIAÇÃO ============
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

  // ============ EXECUÇÃO / PROCEDIMENTO ============
  const [observacoesExecucao, setObservacoesExecucao] = useState('');
  const [nomeProcedimento, setNomeProcedimento] = useState('');

  // ============ ETAPA 4: LGPD ============
  const [termoLido, setTermoLido] = useState(false);
  const [termoAssinado, setTermoAssinado] = useState(false);
  const [termoAssinaturaDataUrl, setTermoAssinaturaDataUrl] = useState('');

  // ============ ETAPA 5: FINALIZAÇÃO ============
  const [orientacoes, setOrientacoes] = useState(false);
  const [satisfacao, setSatisfacao] = useState(false);

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
    // Gerais
    currentStep,
    setCurrentStep,
    isFinishing,
    setIsFinishing,
    journeyId,
    setJourneyId,
    // Etapa 1
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    dataNascimento,
    setDataNascimento,
    idade,
    setIdade,
    nome,
    setNome,
    sexo,
    setSexo,
    estadoCivilId,
    setEstadoCivilId,
    profissao,
    setProfissao,
    step1Errors,
    setStep1Errors,
    step2Errors,
    setStep2Errors,
    step4Errors,
    setStep4Errors,
    step5Errors,
    setStep5Errors,
    cpf,
    setCpf,
    rg,
    setRg,
    telefone,
    setTelefone,
    email,
    setEmail,
    endereco,
    setEndereco,
    // Etapa 2
    queixa,
    setQueixa,
    expectativas,
    setExpectativas,
    // Etapa 3
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
    // Execução / procedimento
    observacoesExecucao,
    setObservacoesExecucao,
    nomeProcedimento,
    setNomeProcedimento,
    // Etapa 4
    termoLido,
    setTermoLido,
    termoAssinado,
    setTermoAssinado,
    termoAssinaturaDataUrl,
    setTermoAssinaturaDataUrl,
    // Etapa 5
    orientacoes,
    setOrientacoes,
    satisfacao,
    setSatisfacao,
    // Fotos
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

