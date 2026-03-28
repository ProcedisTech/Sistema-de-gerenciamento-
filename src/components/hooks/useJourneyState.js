import { useState } from 'react';

export const useJourneyState = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isFinishing, setIsFinishing] = useState(false);
  const [journeyId, setJourneyId] = useState(null);

  // ============ ETAPA 1: CHECK-IN ============
  const [activeTab, setActiveTab] = useState('existente');
  const [searchQuery, setSearchQuery] = useState('');
  const [lgpdInicial, setLgpdInicial] = useState(false);
  const [dataNascimento, setDataNascimento] = useState('');
  const [idade, setIdade] = useState('');
  const [nome, setNome] = useState('');
  const [sexo, setSexo] = useState('');
  const [estadoCivil, setEstadoCivil] = useState('');
  const [profissao, setProfissao] = useState('');
  const [alergias, setAlergias] = useState('');
  const [step1Errors, setStep1Errors] = useState({});
  const [cpf, setCpf] = useState('');
  const [rg, setRg] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');

  // ============ ETAPA 2: ANAMNESE ============
  const [queixa, setQueixa] = useState('');
  const [expectativas, setExpectativas] = useState('');
  const [gestante, setGestante] = useState(false);
  const [amamentando, setAmamentando] = useState(false);
  const [anticoagulantes, setAnticoagulantes] = useState(false);
  const [queloides, setQueloides] = useState(false);

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

  // ============ ETAPA 4: LGPD ============
  const [termoLido, setTermoLido] = useState(false);
  const [termoAssinado, setTermoAssinado] = useState(false);

  // ============ ETAPA 5: FINALIZAÇÃO ============
  const [orientacoes, setOrientacoes] = useState(false);
  const [satisfacao, setSatisfacao] = useState(false);

  // ============ FOTOS ============
  const EVALUATION_PHOTO_MAX = 5;
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
    lgpdInicial,
    setLgpdInicial,
    dataNascimento,
    setDataNascimento,
    idade,
    setIdade,
    nome,
    setNome,
    sexo,
    setSexo,
    estadoCivil,
    setEstadoCivil,
    profissao,
    setProfissao,
    alergias,
    setAlergias,
    step1Errors,
    setStep1Errors,
    cpf,
    setCpf,
    rg,
    setRg,
    telefone,
    setTelefone,
    email,
    setEmail,
    // Etapa 2
    queixa,
    setQueixa,
    expectativas,
    setExpectativas,
    gestante,
    setGestante,
    amamentando,
    setAmamentando,
    anticoagulantes,
    setAnticoagulantes,
    queloides,
    setQueloides,
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
    // Etapa 4
    termoLido,
    setTermoLido,
    termoAssinado,
    setTermoAssinado,
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

