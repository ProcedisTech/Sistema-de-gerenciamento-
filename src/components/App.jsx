import React, { useState, useRef, useEffect } from 'react';
import { 
  Shield, Calendar, Users, LogOut, ChevronLeft, ChevronRight, 
  UserCheck, FileText, Eye, Syringe, FileCheck, GitCommit,
  CheckCircle, Square, CheckSquare, CheckCircle2, Award,
  Lock, User as UserIcon, EyeOff, Search, AlertTriangle, 
  ClipboardList, Palette, PenTool, Circle, Eraser, 
  Undo, Trash2, Upload, Image as ImageIcon, Lightbulb
} from 'lucide-react';

const api = (path) =>
  `${import.meta.env.VITE_API_BASE_URL ?? ''}${path}`;

export default function App() {
  // ================= ESTADOS DE AUTENTICAÇÃO =================
  const [authReady, setAuthReady] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginSubmitting, setLoginSubmitting] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(api('/api/auth/me'), { credentials: 'include' })
      .then((res) => {
        if (!cancelled && res.ok) setIsLoggedIn(true);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setAuthReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ================= ESTADO GLOBAL DA JORNADA =================
  const [currentStep, setCurrentStep] = useState(1);
  const [isFinishing, setIsFinishing] = useState(false);

  // ================= ESTADOS DA ETAPA 1 (Check-in) =================
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

  // ================= ESTADOS DA ETAPA 2 (Anamnese) =================
  const [queixa, setQueixa] = useState('');
  const [expectativas, setExpectativas] = useState('');
  const [gestante, setGestante] = useState(false);
  const [amamentando, setAmamentando] = useState(false);
  const [anticoagulantes, setAnticoagulantes] = useState(false);
  const [queloides, setQueloides] = useState(false);

  // ================= ESTADOS DA ETAPA 3 (Avaliação/Mapeamento) =================
  const [imageSrc, setImageSrc] = useState(null);
  const [activeTool, setActiveTool] = useState('draw');
  const [activeColor, setActiveColor] = useState('#ef4444');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [pointSize, setPointSize] = useState(12); // Novo estado para tamanho do ponto
  const [showPointNumbers, setShowPointNumbers] = useState(true); // Novo estado para mostrar numeração
  const [eraserSize, setEraserSize] = useState(20); // Novo estado para tamanho da borracha
  const [cursorPos, setCursorPos] = useState({ x: -100, y: -100 }); // Novo estado para posicao do mouse
  const [isHoveringCanvas, setIsHoveringCanvas] = useState(false); // Controle de hover
  const [paths, setPaths] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  // ================= ESTADOS DA ETAPA 4 (LGPD) =================
  const [termoLido, setTermoLido] = useState(false);
  const [termoAssinado, setTermoAssinado] = useState(false);

  // ================= ESTADOS DA ETAPA 5 (Finalização) =================
  const [orientacoes, setOrientacoes] = useState(false);
  const [satisfacao, setSatisfacao] = useState(false);

  // ================= MÁSCARAS DE FORMATAÇÃO =================
  const maskCPF = (value) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2')
      .replace(/(-\d{2})\d+?$/, '$1');
  };

  const maskRG = (value) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{2})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2')
      .replace(/(-\d{1})\d+?$/, '$1');
  };

  const maskTelefone = (value) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4,5})(\d{4})/, '$1-$2')
      .replace(/(-\d{4})\d+?$/, '$1');
  };

  // ================= FUNÇÕES GERAIS =================
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoginSubmitting(true);
    try {
      const res = await fetch(api('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLoginError(data.error || 'Usuário ou senha incorretos.');
        return;
      }
      setIsLoggedIn(true);
      setPassword('');
    } catch {
      setLoginError(
        'Não foi possível conectar ao servidor. Inicie a API (npm run server) ou use npm run dev:full.'
      );
    } finally {
      setLoginSubmitting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch(api('/api/auth/logout'), {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      /* sessão localmente encerrada */
    }
    setIsLoggedIn(false);
    setUsername('');
    setPassword('');
    setLoginError('');
    resetJourney();
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
      setStep1Errors({});
    }

    if (currentStep === 2) {
      if (!queixa.trim() || !expectativas.trim()) {
        alert("Por favor, preencha a Queixa Principal e as Expectativas antes de avançar.");
        return;
      }
    }

    if (currentStep < 5) setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleFinishJourney = () => {
    setIsFinishing(true);
    setTimeout(() => {
      alert("Jornada finalizada e paciente salvo com sucesso!");
      resetJourney();
      setIsFinishing(false);
    }, 1000);
  };

  const resetJourney = () => {
    setCurrentStep(1);
    setActiveTab('existente');
    setSearchQuery('');
    setDataNascimento(''); setIdade('');
    setNome(''); setSexo(''); setEstadoCivil(''); setProfissao(''); setAlergias(''); setStep1Errors({});
    setCpf(''); setRg(''); setTelefone(''); setEmail('');
    setQueixa(''); setExpectativas('');
    setGestante(false); setAmamentando(false); setAnticoagulantes(false); setQueloides(false);
    setImageSrc(null); setPaths([]);
    setPointSize(12); setShowPointNumbers(true); setEraserSize(20);
    setCursorPos({ x: -100, y: -100 }); setIsHoveringCanvas(false);
    setTermoLido(false); setTermoAssinado(false);
    setOrientacoes(false); setSatisfacao(false);
  };

  // ================= LÓGICA DO CANVAS (ETAPA 3) =================
  const colors = ['#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e'];

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setImageSrc(event.target.result);
        setPaths([]);
      };
      reader.readAsDataURL(file);
    }
  };

  const redrawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    let currentPointNumber = 1;

    paths.forEach(path => {
      ctx.beginPath();
      ctx.strokeStyle = path.tool === 'erase' ? 'rgba(0,0,0,1)' : path.color;
      ctx.fillStyle = path.tool === 'erase' ? 'rgba(0,0,0,1)' : path.color;
      ctx.lineWidth = path.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalCompositeOperation = path.tool === 'erase' ? 'destination-out' : 'source-over';

      if (path.tool === 'point' && path.points.length > 0) {
        const pt = path.points[0];
        const radius = path.size || 12; // Recupera o tamanho salvo no ponto
        
        ctx.arc(pt.x, pt.y, radius, 0, 2 * Math.PI);
        ctx.fill();

        // Lógica para desenhar o número do ponto
        if (showPointNumbers) {
          ctx.globalCompositeOperation = 'source-over';
          
          const fontSize = Math.max(12, Math.min(radius * 1.2, 20));
          ctx.font = `bold ${fontSize}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          if (radius >= 12) {
            // Desenha número DENTRO do círculo
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = 'rgba(0,0,0,0.4)';
            ctx.shadowBlur = 3;
            ctx.fillText(currentPointNumber.toString(), pt.x, pt.y + 1); // +1 para alinhamento ótico
            ctx.shadowBlur = 0; // Limpa sombra
          } else {
            // Desenha número FORA do círculo (para pontos minúsculos)
            ctx.fillStyle = path.color;
            ctx.shadowColor = 'rgba(255,255,255,0.9)';
            ctx.shadowBlur = 4;
            ctx.fillText(currentPointNumber.toString(), pt.x + radius + 10, pt.y - radius - 5);
            ctx.shadowBlur = 0; // Limpa sombra
          }
        }
        currentPointNumber++;

      } else if (path.points.length > 0) {
        ctx.moveTo(path.points[0].x, path.points[0].y);
        for (let i = 1; i < path.points.length; i++) ctx.lineTo(path.points[i].x, path.points[i].y);
        ctx.stroke();
      }
    });
    ctx.globalCompositeOperation = 'source-over';
  };

  useEffect(() => {
    if (currentStep === 3 && imageSrc && canvasRef.current && containerRef.current) {
      const updateCanvasSize = () => {
        const { width, height } = containerRef.current.getBoundingClientRect();
        canvasRef.current.width = width;
        canvasRef.current.height = height;
        redrawCanvas();
      };
      updateCanvasSize();
      window.addEventListener('resize', updateCanvasSize);
      return () => window.removeEventListener('resize', updateCanvasSize);
    }
  }, [imageSrc, paths, currentStep, showPointNumbers]); // showPointNumbers na dependência para atualizar numeração em tempo real

  const getCoordinates = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const startDrawing = (e) => {
    if (!imageSrc) return;
    setIsDrawing(true);
    setPaths([...paths, { 
      tool: activeTool, 
      color: activeColor, 
      width: activeTool === 'erase' ? eraserSize : strokeWidth, 
      size: pointSize, // Armazena o tamanho específico do ponto
      points: [getCoordinates(e)] 
    }]);
  };

  const draw = (e) => {
    if (!isDrawing || !imageSrc || activeTool === 'point') return;
    e.preventDefault();
    setPaths(prev => {
      const newPaths = [...prev];
      newPaths[newPaths.length - 1].points.push(getCoordinates(e));
      return newPaths;
    });
  };

  const endDrawing = () => setIsDrawing(false);

  const handleMouseMove = (e) => {
    if (activeTool === 'erase' || activeTool === 'point') {
      setCursorPos(getCoordinates(e));
    }
    draw(e);
  };

  const handleMouseLeave = () => {
    setIsHoveringCanvas(false);
    endDrawing();
  };

  const handleMouseEnter = () => {
    setIsHoveringCanvas(true);
  };

  // ================= RENDERIZADORES DE UI =================
  if (!authReady) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center p-4 font-sans gap-4"
        style={{ backgroundColor: '#f8fbfb', color: '#0f172a' }}
      >
        <div className="bg-[#00a88e] w-14 h-14 rounded-[1.25rem] flex items-center justify-center shadow-md border-[3px] border-[#00a88e]/30 animate-pulse">
          <Shield className="text-white w-7 h-7" strokeWidth={1.5} />
        </div>
        <p className="text-[15px] text-[#475569] font-medium">Verificando sessão…</p>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 font-sans" style={{ backgroundColor: '#f8fbfb', color: '#0f172a' }}>
        <div className="flex flex-col items-center mb-8">
          <div className="bg-[#00a88e] w-16 h-16 rounded-[1.25rem] flex items-center justify-center mb-6 shadow-md border-[3px] border-[#00a88e]/30">
            <Shield className="text-white w-8 h-8" strokeWidth={1.5} />
          </div>
          <h1 className="text-[32px] font-semibold text-[#0f172a] mb-2 tracking-tight">Procedi</h1>
          <p className="text-[15px] text-[#475569] mb-1.5">Sistema de Harmonização Facial Premium</p>
        </div>
        <div className="bg-white w-full max-w-[440px] rounded-2xl shadow-[0_8px_30px_rgb(0,168,142,0.08)] border-[3px] border-[#00a88e]/25 p-8">
          <form onSubmit={handleLogin} className="space-y-5">
            {loginError && (
              <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-[14px] font-medium text-center border-[3px] border-red-300">
                {loginError}
              </div>
            )}
            <div className="space-y-2">
              <label className="text-[13px] font-bold text-[#0f766e] ml-1">Usuário</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <UserIcon className="h-[18px] w-[18px] text-[#00a88e]/60" strokeWidth={2} />
                </div>
                <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-[#f8fbfb] border-[3px] border-[#00a88e]/25 rounded-xl text-[14px] focus:ring-4 outline-none focus:ring-[#00a88e]/20 focus:border-[#00a88e] transition-all" placeholder="Digite o seu usuário" required />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[13px] font-bold text-[#0f766e] ml-1">Senha</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="h-[18px] w-[18px] text-[#00a88e]/60" strokeWidth={2} />
                </div>
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-10 pr-10 py-3 bg-[#f8fbfb] border-[3px] border-[#00a88e]/25 rounded-xl text-[14px] focus:ring-4 outline-none focus:ring-[#00a88e]/20 focus:border-[#00a88e] transition-all" placeholder="Digite a sua senha" required />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#00a88e]/60 hover:text-[#00a88e]">
                  {showPassword ? <EyeOff className="h-[18px] w-[18px]" strokeWidth={2} /> : <Eye className="h-[18px] w-[18px]" strokeWidth={2} />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loginSubmitting}
              className="w-full bg-[#00a88e] hover:bg-[#00967f] disabled:opacity-60 disabled:cursor-not-allowed text-white py-3 px-4 rounded-xl text-[15px] font-bold transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 mt-4"
            >
              <Shield className="w-5 h-5" strokeWidth={2.5} />{' '}
              {loginSubmitting ? 'Entrando…' : 'Entrar no Sistema'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const renderStepper = () => {
    const steps = [
      { id: 1, icon: UserCheck, title: "Check-in", sub: "Identificação" },
      { id: 2, icon: FileText, title: "Anamnese", sub: "Histórico Médico" },
      { id: 3, icon: Eye, title: "Avaliação", sub: "Mapeamento" },
      { id: 4, icon: Syringe, title: "Execução", sub: "LGPD + Procedimento" },
      { id: 5, icon: FileCheck, title: "Finalização", sub: "Orientações" }
    ];

    return (
      <div className="flex items-center justify-between max-w-[1000px] overflow-x-auto pb-4 custom-scrollbar">
        {steps.map((step, index) => {
          const isCompleted = currentStep > step.id;
          const isActive = currentStep === step.id;
          const Icon = isCompleted ? CheckCircle : step.icon;
          
          return (
            <React.Fragment key={step.id}>
              <div className={`px-4 py-3 rounded-xl flex flex-col items-center justify-center min-w-[140px] transition-all border-[3px] ${isCompleted ? 'bg-[#00a88e] border-[#00a88e] shadow-sm' : isActive ? 'bg-[#e6f7f5] border-[#00a88e]/40 shadow-sm' : 'bg-white border-[#00a88e]/15'}`}>
                <div className={`flex items-center gap-2 font-semibold text-[14px] mb-1 ${isCompleted ? 'text-white' : isActive ? 'text-[#00a88e]' : 'text-[#64748b]'}`}>
                  <Icon className="w-[18px] h-[18px]" strokeWidth={2.5} /> {step.title}
                </div>
                <span className={`text-[12px] font-medium ${isCompleted ? 'text-white/90' : isActive ? 'text-[#00a88e]/80' : 'text-[#94a3b8]'}`}>{step.sub}</span>
              </div>
              {index < steps.length - 1 && (
                <div className={`flex-1 h-[4px] mx-4 min-w-[20px] max-w-[40px] transition-colors rounded-full ${isCompleted ? 'bg-[#00a88e]' : 'bg-[#00a88e]/15'}`}></div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex h-screen font-sans overflow-hidden" style={{ backgroundColor: '#f8fbfb', color: '#0f172a' }}>
      <aside className="w-[280px] bg-white border-r-[3px] border-[#00a88e]/15 flex flex-col h-full flex-shrink-0 shadow-[4px_0_24px_rgb(0,168,142,0.02)] z-10">
        <div className="p-6 flex items-center gap-3 mb-2">
          <div className="bg-[#00a88e] p-2 rounded-xl border-[3px] border-[#00a88e]/25 shadow-sm">
            <Shield className="text-white w-6 h-6" strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-[19px] font-bold text-[#0f172a] leading-tight">Procedi</h1>
            <p className="text-[11px] text-[#64748b] font-medium">Harmonização Premium</p>
          </div>
        </div>
        <div className="mx-4 mb-6 bg-[#e6f7f5] rounded-[14px] p-3 flex items-center gap-3 border-[3px] border-[#00a88e]/25 shadow-sm">
          <div className="w-10 h-10 rounded-full bg-[#00a88e] flex items-center justify-center text-white font-bold text-sm">RS</div>
          <div className="flex-1">
            <h2 className="text-[14px] font-bold text-[#0f766e] leading-tight">Rafael Silva</h2>
            <p className="text-[12px] text-[#00a88e] font-medium">Administrador</p>
          </div>
        </div>
        <nav className="flex-1 px-4 space-y-2">
          <button className="w-full flex items-center gap-3 px-4 py-3 bg-[#e6f7f5] text-[#00a88e] border-[3px] border-[#00a88e]/25 rounded-xl font-bold text-[14px] shadow-sm">
            <GitCommit className="w-5 h-5" strokeWidth={2.5} /> Jornada do Paciente
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3 text-[#64748b] hover:bg-[#f0fdfa] hover:text-[#00a88e] border-[3px] border-transparent hover:border-[#00a88e]/20 rounded-xl font-semibold text-[14px] transition-all">
            <Calendar className="w-5 h-5" /> Agenda
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3 text-[#64748b] hover:bg-[#f0fdfa] hover:text-[#00a88e] border-[3px] border-transparent hover:border-[#00a88e]/20 rounded-xl font-semibold text-[14px] transition-all">
            <Users className="w-5 h-5" /> Pacientes
          </button>
        </nav>
        <div className="p-4 border-t-[3px] border-[#00a88e]/10">
          <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-3 text-[#ef4444] hover:bg-red-50 border-[3px] border-transparent hover:border-red-100 w-full rounded-xl font-bold text-[14px] transition-all">
            <LogOut className="w-5 h-5" strokeWidth={2.5} /> Sair do Sistema
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-full overflow-y-auto">
        <header className="bg-white px-10 py-8 border-b-[3px] border-[#00a88e]/15 shadow-[0_4px_24px_rgb(0,168,142,0.02)] z-0">
          <h2 className="text-[24px] font-bold text-[#0f172a] mb-1">Jornada de Harmonização Otimizada</h2>
          <p className="text-[#64748b] text-[14px] mb-8 font-medium">Processo completo em 5 etapas</p>
          {renderStepper()}
        </header>

        <div className="p-8 max-w-[1100px] mx-auto w-full">
          <div className="bg-white rounded-[20px] border-[3px] border-[#00a88e]/25 shadow-lg shadow-[#00a88e]/5 p-8 pb-6">
            
            {/* ETAPA 1: CHECK-IN */}
            {currentStep === 1 && (
              <div className="animate-in fade-in duration-300">
                <div className="flex items-center gap-4 mb-8">
                  <div className="bg-[#e6f7f5] p-3 rounded-2xl text-[#00a88e] border-[3px] border-[#00a88e]/25"><UserCheck className="w-7 h-7" strokeWidth={2.5} /></div>
                  <div>
                    <h3 className="text-[20px] font-bold text-[#0f172a]">Check-in do Paciente</h3>
                    <p className="text-[#64748b] text-[14px] font-medium">Selecione ou cadastre novo paciente</p>
                  </div>
                </div>
                <div className="flex bg-[#f8fbfb] p-1.5 rounded-2xl mb-8 border-[3px] border-[#00a88e]/15">
                  <button onClick={() => setActiveTab('existente')} className={`flex-1 py-3 text-[14px] font-bold rounded-xl transition-all ${activeTab === 'existente' ? 'bg-[#00a88e] text-white shadow-md' : 'text-[#64748b] hover:text-[#00a88e] hover:bg-white'}`}>Paciente Existente</button>
                  <button onClick={() => setActiveTab('novo')} className={`flex-1 py-3 text-[14px] font-bold rounded-xl transition-all ${activeTab === 'novo' ? 'bg-[#00a88e] text-white shadow-md' : 'text-[#64748b] hover:text-[#00a88e] hover:bg-white'}`}>Novo Paciente</button>
                </div>

                {activeTab === 'existente' ? (
                  <>
                    <div className="relative mb-8">
                      <Search className="absolute left-4 top-3.5 h-5 w-5 text-[#00a88e]/60" strokeWidth={2.5} />
                      <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar por nome, CPF ou telefone..." className="w-full pl-12 pr-4 py-3.5 bg-[#f8fbfb] border-[3px] border-[#00a88e]/25 rounded-2xl text-[14px] focus:ring-4 outline-none focus:ring-[#00a88e]/20 focus:border-[#00a88e] transition-all font-medium" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-5 rounded-2xl border-[3px] border-[#00a88e]/40 bg-[#f0fdfa] cursor-pointer flex gap-4 shadow-sm hover:shadow-md transition-all hover:border-[#00a88e]">
                        <div className="w-12 h-12 rounded-full bg-[#00a88e] text-white flex items-center justify-center font-bold text-[16px] flex-shrink-0 shadow-sm">AC</div>
                        <div className="flex-1">
                          <h4 className="text-[16px] font-bold text-[#0f766e] mb-1.5">Ana Carolina Silva</h4>
                          <div className="text-[13px] text-[#475569] space-y-0.5 mb-2 font-medium"><p>123.456.789-00</p><p>(11) 98765-4321</p></div>
                          <div className="flex items-center gap-1.5 text-[#ef4444] text-[12px] font-bold bg-red-50 w-fit px-2.5 py-1.5 rounded-lg border-[3px] border-red-100">
                            <AlertTriangle className="w-3.5 h-3.5" strokeWidth={2.5} /> Alergias: Penicilina
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <form className="space-y-6">
                    {Object.keys(step1Errors).length > 0 && (
                      <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-[14px] font-bold border-[3px] border-red-200 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 flex-shrink-0" strokeWidth={2.5} />
                        Por favor, preencha todos os campos obrigatórios (*) e o termo LGPD para avançar.
                      </div>
                    )}

                    <div className={`border-[3px] rounded-2xl p-6 transition-colors ${step1Errors.nome || step1Errors.dataNascimento || step1Errors.sexo || step1Errors.estadoCivil || step1Errors.profissao ? 'border-red-300 bg-red-50/10' : 'border-[#00a88e]/25 bg-white'}`}>
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-8 h-8 rounded-full bg-[#00a88e] text-white flex items-center justify-center font-bold text-[14px] shadow-sm">1</div>
                        <h4 className="text-[18px] font-bold text-[#0f766e]">Dados Pessoais</h4>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                        <div className="md:col-span-2 space-y-1.5">
                          <label className="text-[13px] font-bold text-[#00a88e]">Nome Completo <span className="text-red-500">*</span></label>
                          <input type="text" value={nome} onChange={(e) => {setNome(e.target.value); setStep1Errors({...step1Errors, nome: false});}} placeholder="Nome completo do paciente" className={`w-full px-4 py-3 bg-[#f8fbfb] border-[3px] rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/20 transition-all ${step1Errors.nome ? 'border-red-400 bg-red-50' : 'border-[#00a88e]/25 focus:border-[#00a88e]'}`} />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[13px] font-bold text-[#00a88e]">Data de Nascimento <span className="text-red-500">*</span></label>
                          <input type="date" value={dataNascimento} onChange={(e) => {handleDataNascimentoChange(e); setStep1Errors({...step1Errors, dataNascimento: false});}} className={`w-full px-4 py-3 bg-[#f8fbfb] border-[3px] rounded-xl text-[14px] text-[#0f172a] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/20 transition-all ${step1Errors.dataNascimento ? 'border-red-400 bg-red-50' : 'border-[#00a88e]/25 focus:border-[#00a88e]'}`} />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[13px] font-bold text-[#00a88e]">Idade</label>
                          <input type="text" value={idade !== '' ? `${idade} anos` : ''} placeholder="Calculada automaticamente" disabled className="w-full px-4 py-3 bg-[#e2e8f0]/40 border-[3px] border-[#00a88e]/15 rounded-xl text-[14px] text-[#0f172a] font-bold cursor-not-allowed" />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[13px] font-bold text-[#00a88e]">Sexo <span className="text-red-500">*</span></label>
                          <select value={sexo} onChange={(e) => {setSexo(e.target.value); setStep1Errors({...step1Errors, sexo: false});}} className={`w-full px-4 py-3 bg-[#f8fbfb] border-[3px] rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/20 appearance-none transition-all ${step1Errors.sexo ? 'border-red-400 bg-red-50' : 'border-[#00a88e]/25 focus:border-[#00a88e]'}`}>
                            <option value="">Selecione...</option>
                            <option value="f">Feminino</option>
                            <option value="m">Masculino</option>
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[13px] font-bold text-[#00a88e]">Estado Civil <span className="text-red-500">*</span></label>
                          <select value={estadoCivil} onChange={(e) => {setEstadoCivil(e.target.value); setStep1Errors({...step1Errors, estadoCivil: false});}} className={`w-full px-4 py-3 bg-[#f8fbfb] border-[3px] rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/20 appearance-none transition-all ${step1Errors.estadoCivil ? 'border-red-400 bg-red-50' : 'border-[#00a88e]/25 focus:border-[#00a88e]'}`}>
                            <option value="">Selecione...</option>
                            <option value="solteiro">Solteiro(a)</option>
                            <option value="casado">Casado(a)</option>
                          </select>
                        </div>
                        <div className="md:col-span-2 space-y-1.5">
                          <label className="text-[13px] font-bold text-[#00a88e]">Profissão <span className="text-red-500">*</span></label>
                          <input type="text" value={profissao} onChange={(e) => {setProfissao(e.target.value); setStep1Errors({...step1Errors, profissao: false});}} placeholder="Ex: Advogada, Empresário, Estudante..." className={`w-full px-4 py-3 bg-[#f8fbfb] border-[3px] rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/20 transition-all ${step1Errors.profissao ? 'border-red-400 bg-red-50' : 'border-[#00a88e]/25 focus:border-[#00a88e]'}`} />
                        </div>
                      </div>
                    </div>

                    <div className={`border-[3px] rounded-2xl p-6 transition-colors ${step1Errors.cpf ? 'border-red-300 bg-red-50/10' : 'border-[#3b82f6]/25 bg-white'}`}>
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-8 h-8 rounded-full bg-[#3b82f6] text-white flex items-center justify-center font-bold text-[14px] shadow-sm">2</div>
                        <h4 className="text-[18px] font-bold text-[#1d4ed8]">Documentos</h4>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                        <div className="space-y-1.5">
                          <label className="text-[13px] font-bold text-[#3b82f6]">CPF <span className="text-red-500">*</span></label>
                          <input type="text" value={cpf} onChange={(e) => {setCpf(maskCPF(e.target.value)); setStep1Errors({...step1Errors, cpf: false});}} placeholder="000.000.000-00" className={`w-full px-4 py-3 bg-[#eff6ff] border-[3px] rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#3b82f6]/20 transition-all ${step1Errors.cpf ? 'border-red-400 bg-red-50' : 'border-[#3b82f6]/30 focus:border-[#3b82f6]'}`} />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[13px] font-bold text-[#3b82f6]">RG</label>
                          <input type="text" value={rg} onChange={(e) => setRg(maskRG(e.target.value))} placeholder="00.000.000-0" className="w-full px-4 py-3 bg-[#eff6ff] border-[3px] border-[#3b82f6]/30 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#3b82f6]/20 focus:border-[#3b82f6] transition-all" />
                        </div>
                      </div>
                    </div>

                    <div className={`border-[3px] rounded-2xl p-6 transition-colors ${step1Errors.telefone || step1Errors.email ? 'border-red-300 bg-red-50/10' : 'border-[#a855f7]/25 bg-white'}`}>
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-8 h-8 rounded-full bg-[#a855f7] text-white flex items-center justify-center font-bold text-[14px] shadow-sm">3</div>
                        <h4 className="text-[18px] font-bold text-[#7e22ce]">Contato</h4>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                        <div className="space-y-1.5">
                          <label className="text-[13px] font-bold text-[#a855f7]">Telefone <span className="text-red-500">*</span></label>
                          <input type="text" value={telefone} onChange={(e) => {setTelefone(maskTelefone(e.target.value)); setStep1Errors({...step1Errors, telefone: false});}} placeholder="(00) 00000-0000" className={`w-full px-4 py-3 bg-[#faf5ff] border-[3px] rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#a855f7]/20 transition-all ${step1Errors.telefone ? 'border-red-400 bg-red-50' : 'border-[#a855f7]/30 focus:border-[#a855f7]'}`} />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[13px] font-bold text-[#a855f7]">E-mail <span className="text-red-500">*</span></label>
                          <input type="email" value={email} onChange={(e) => {setEmail(e.target.value); setStep1Errors({...step1Errors, email: false});}} placeholder="email@exemplo.com" className={`w-full px-4 py-3 bg-[#faf5ff] border-[3px] rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#a855f7]/20 transition-all ${step1Errors.email ? 'border-red-400 bg-red-50' : 'border-[#a855f7]/30 focus:border-[#a855f7]'}`} />
                        </div>
                        <div className="md:col-span-2 space-y-1.5">
                          <label className="text-[13px] font-bold text-[#a855f7]">Endereço Completo</label>
                          <input type="text" placeholder="Rua, número, bairro, cidade - UF, CEP" className="w-full px-4 py-3 bg-[#faf5ff] border-[3px] border-[#a855f7]/30 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#a855f7]/20 focus:border-[#a855f7] transition-all" />
                        </div>
                      </div>
                    </div>

                    <div className="border-[3px] border-[#f59e0b]/25 rounded-2xl p-6 bg-white">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-8 h-8 rounded-full bg-[#f59e0b] text-white flex items-center justify-center font-bold text-[14px] shadow-sm">4</div>
                        <h4 className="text-[18px] font-bold text-[#b45309]">Opcionais</h4>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                        <div className="space-y-1.5">
                          <label className="text-[13px] font-bold text-[#f59e0b]">Indicação</label>
                          <input type="text" placeholder="Quem indicou?" className="w-full px-4 py-3 bg-[#fffbeb] border-[3px] border-[#f59e0b]/30 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#f59e0b]/20 focus:border-[#f59e0b] transition-all" />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[13px] font-bold text-[#f59e0b]">Instagram</label>
                          <input type="text" placeholder="@usuario" className="w-full px-4 py-3 bg-[#fffbeb] border-[3px] border-[#f59e0b]/30 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#f59e0b]/20 focus:border-[#f59e0b] transition-all" />
                        </div>
                      </div>
                    </div>

                    <div className={`bg-[#fef2f2] border-[3px] rounded-2xl p-6 transition-colors ${step1Errors.alergias ? 'border-red-400 ring-[5px] ring-red-100' : 'border-red-300'}`}>
                      <div className="flex items-center gap-3 mb-6 text-[#dc2626]">
                        <AlertTriangle className="w-6 h-6" strokeWidth={2.5} />
                        <h4 className="text-[18px] font-bold">Histórico Médico Importante</h4>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[13px] font-bold text-[#dc2626]">Alergias <span className="text-red-500">*</span></label>
                        <input type="text" value={alergias} onChange={(e) => {setAlergias(e.target.value); setStep1Errors({...step1Errors, alergias: false});}} placeholder="Ex: Penicilina, Látex, ou digite 'Nenhuma'" className={`w-full px-4 py-3 bg-white border-[3px] rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-red-200 transition-all ${step1Errors.alergias ? 'border-red-500 bg-red-50' : 'border-red-300 focus:border-red-500'}`} />
                        {step1Errors.alergias && <p className="text-[12px] text-red-600 font-bold mt-1">Este campo é obrigatório.</p>}
                      </div>
                    </div>

                    <div className={`bg-[#f0fdfa] border-[3px] rounded-2xl p-6 transition-colors ${step1Errors.lgpdInicial ? 'border-red-400 ring-[5px] ring-red-100' : 'border-[#00a88e]/30'}`}>
                      <div className="flex items-center gap-3 mb-5 text-[#00a88e]">
                        <Shield className="w-6 h-6" strokeWidth={2.5} />
                        <h4 className="text-[18px] font-bold text-[#0f766e]">Termo LGPD Inicial</h4>
                      </div>
                      <div onClick={() => {setLgpdInicial(!lgpdInicial); setStep1Errors({...step1Errors, lgpdInicial: false});}} className={`flex items-start gap-4 p-4 bg-white border-[3px] rounded-xl cursor-pointer hover:bg-[#e6f7f5] transition-all shadow-sm ${step1Errors.lgpdInicial ? 'border-red-300 bg-red-50/50' : 'border-[#00a88e]/25'}`}>
                        {lgpdInicial ? <CheckSquare className="w-6 h-6 text-[#00a88e] mt-0.5" strokeWidth={2.5} /> : <Square className={`w-6 h-6 mt-0.5 ${step1Errors.lgpdInicial ? 'text-red-400' : 'text-[#00a88e]/40'}`} strokeWidth={2.5} />}
                        <div>
                          <p className={`text-[15px] font-bold mb-1 ${lgpdInicial ? 'text-[#00a88e]' : step1Errors.lgpdInicial ? 'text-red-600' : 'text-[#0f766e]'}`}>O paciente assinou o termo da LGPD</p>
                          <p className="text-[13px] text-[#475569] font-medium leading-relaxed">Declaro que li e concordo com os termos de uso e autorizo o tratamento dos meus dados pessoais.</p>
                        </div>
                      </div>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* ETAPA 2: ANAMNESE */}
            {currentStep === 2 && (
              <div className="animate-in fade-in duration-300">
                <div className="flex items-center gap-4 mb-8">
                  <div className="bg-[#f3e8ff] p-3 rounded-2xl text-[#a855f7] border-[3px] border-[#a855f7]/25"><ClipboardList className="w-7 h-7" strokeWidth={2.5} /></div>
                  <div>
                    <h3 className="text-[20px] font-bold text-[#0f172a]">Anamnese Completa</h3>
                    <p className="text-[#64748b] text-[14px] font-medium">Histórico médico e contraindicações</p>
                  </div>
                </div>
                <form className="space-y-6 bg-white border-[3px] border-[#00a88e]/25 rounded-2xl p-6">
                  <div className="space-y-2">
                    <label className="text-[13px] font-bold text-[#00a88e] ml-1">Queixa Principal <span className="text-red-500">*</span></label>
                    <textarea value={queixa} onChange={(e) => setQueixa(e.target.value)} rows={3} className="w-full p-4 bg-[#f8fbfb] border-[3px] border-[#00a88e]/25 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/20 focus:border-[#00a88e]" placeholder="Descreva o motivo da consulta..." />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[13px] font-bold text-[#00a88e] ml-1">Expectativas do Paciente <span className="text-red-500">*</span></label>
                    <textarea value={expectativas} onChange={(e) => setExpectativas(e.target.value)} rows={3} className="w-full p-4 bg-[#f8fbfb] border-[3px] border-[#00a88e]/25 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/20 focus:border-[#00a88e]" placeholder="O que o paciente espera do procedimento..." />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                    {[
                      { state: gestante, setter: setGestante, label: 'Gestante' },
                      { state: amamentando, setter: setAmamentando, label: 'Amamentando' },
                      { state: anticoagulantes, setter: setAnticoagulantes, label: 'Uso de Anticoagulantes' },
                      { state: queloides, setter: setQueloides, label: 'Tendência a Queloides' }
                    ].map((item, idx) => (
                      <div key={idx} onClick={() => item.setter(!item.state)} className={`flex items-center gap-3 p-4 border-[3px] rounded-xl cursor-pointer hover:bg-[#e6f7f5] transition-all shadow-sm ${item.state ? 'border-[#00a88e] bg-[#f0fdfa]' : 'border-[#00a88e]/20 bg-[#f8fbfb]'}`}>
                        {item.state ? <CheckSquare className="w-5 h-5 text-[#00a88e]" strokeWidth={2.5} /> : <Square className="w-5 h-5 text-[#00a88e]/40" strokeWidth={2.5} />}
                        <span className={`text-[14px] font-bold ${item.state ? 'text-[#0f766e]' : 'text-[#475569]'}`}>{item.label}</span>
                      </div>
                    ))}
                  </div>
                </form>
              </div>
            )}

            {/* ETAPA 3: AVALIAÇÃO / MAPA */}
            {currentStep === 3 && (
              <div className="animate-in fade-in duration-300">
                <div className="flex items-center gap-4 mb-8">
                  <div className="bg-[#eff6ff] p-3 rounded-2xl text-[#3b82f6] border-[3px] border-[#3b82f6]/25"><Eye className="w-7 h-7" strokeWidth={2.5} /></div>
                  <div>
                    <h3 className="text-[20px] font-bold text-[#0f172a]">Mapeamento Facial Avançado</h3>
                    <p className="text-[#64748b] text-[14px] font-medium">Faça o upload da foto e desenhe marcações específicas</p>
                  </div>
                </div>

                <div className={`border-[3px] border-[#00a88e]/25 bg-white shadow-sm rounded-2xl p-6 mb-8 transition-opacity ${!imageSrc ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                  <div className="flex flex-col md:flex-row gap-6 mb-4">
                    <div className="flex-1">
                      <span className="text-[13px] font-bold text-[#00a88e] mb-3 block">Ferramentas</span>
                      <div className="flex gap-2">
                        {['draw', 'point', 'erase'].map(t => (
                          <button key={t} onClick={() => setActiveTool(t)} className={`flex-1 py-2.5 rounded-xl text-[13px] font-bold border-[3px] transition-all outline-none ${activeTool === t ? 'bg-[#00a88e] text-white border-[#00a88e] shadow-md' : 'bg-[#f8fbfb] text-[#475569] border-[#00a88e]/20 hover:bg-[#e6f7f5] hover:text-[#00a88e]'}`}>
                            {t === 'draw' ? 'Desenhar' : t === 'point' ? 'Ponto' : 'Apagar'}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex-1">
                      <span className="text-[13px] font-bold text-[#00a88e] mb-3 block">Cores</span>
                      <div className="flex flex-wrap gap-2">
                        {colors.slice(0, 10).map((color) => (
                          <button key={color} onClick={() => { setActiveColor(color); setActiveTool(activeTool === 'erase' ? 'draw' : activeTool); }} className={`w-8 h-8 rounded-full shadow-sm transition-all outline-none ${activeColor === color && activeTool !== 'erase' ? 'ring-[4px] ring-offset-2 ring-[#00a88e]/30 scale-110' : 'hover:scale-110'}`} style={{ backgroundColor: color }} />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* NOVO BLOCO: Configurações do Ponto */}
                  {activeTool === 'point' && (
                    <div className="flex flex-col md:flex-row items-center gap-6 mb-6 p-4 bg-[#f8fbfb] border-[3px] border-[#00a88e]/15 rounded-xl animate-in fade-in slide-in-from-top-2">
                      <div className="flex-1 w-full">
                        <div className="flex justify-between items-center mb-2">
                          <label className="text-[13px] font-bold text-[#0f766e]">Tamanho do Ponto</label>
                          <span className="text-[12px] font-bold text-[#00a88e] bg-[#e6f7f5] px-2 py-0.5 rounded-md">{pointSize}px</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <input 
                            type="range" 
                            min="3" max="40" 
                            value={pointSize} 
                            onChange={(e) => setPointSize(parseInt(e.target.value))}
                            className="w-full h-2 bg-[#00a88e]/20 rounded-lg appearance-none cursor-pointer accent-[#00a88e]"
                          />
                          <div className="w-10 h-10 flex items-center justify-center shrink-0 bg-white border-[2px] border-[#00a88e]/20 rounded-xl shadow-sm">
                            <div className="rounded-full transition-all" style={{ width: Math.min(pointSize * 2, 28), height: Math.min(pointSize * 2, 28), backgroundColor: activeColor }} />
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 w-full md:w-auto md:min-w-[200px]">
                        <div onClick={() => setShowPointNumbers(!showPointNumbers)} className={`flex items-center gap-3 p-3 w-full border-[3px] rounded-xl cursor-pointer transition-all shadow-sm ${showPointNumbers ? 'border-[#00a88e] bg-[#e6f7f5]' : 'border-[#00a88e]/20 bg-white hover:bg-[#f8fbfb]'}`}>
                          {showPointNumbers ? <CheckSquare className="w-5 h-5 text-[#00a88e]" strokeWidth={2.5} /> : <Square className="w-5 h-5 text-[#00a88e]/40" strokeWidth={2.5} />}
                          <span className={`text-[13px] font-bold ${showPointNumbers ? 'text-[#0f766e]' : 'text-[#475569]'}`}>Numerar Pontos</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* NOVO BLOCO: Configurações da Borracha */}
                  {activeTool === 'erase' && (
                    <div className="flex flex-col md:flex-row items-center gap-6 mb-6 p-4 bg-[#f8fbfb] border-[3px] border-[#00a88e]/15 rounded-xl animate-in fade-in slide-in-from-top-2">
                      <div className="flex-1 w-full">
                        <div className="flex justify-between items-center mb-2">
                          <label className="text-[13px] font-bold text-[#0f766e]">Tamanho da Borracha</label>
                          <span className="text-[12px] font-bold text-[#00a88e] bg-[#e6f7f5] px-2 py-0.5 rounded-md">{eraserSize}px</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <input 
                            type="range" 
                            min="5" max="100" 
                            value={eraserSize} 
                            onChange={(e) => setEraserSize(parseInt(e.target.value))}
                            className="w-full h-2 bg-[#00a88e]/20 rounded-lg appearance-none cursor-pointer accent-[#00a88e]"
                          />
                          <div className="w-10 h-10 flex items-center justify-center shrink-0 bg-white border-[2px] border-[#00a88e]/20 rounded-xl shadow-sm relative overflow-hidden">
                             <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'radial-gradient(#00a88e 2px, transparent 2px)', backgroundSize: '6px 6px' }} />
                             <div className="rounded-full border-[2px] border-gray-700 bg-white/80 z-10 transition-all" style={{ width: Math.min(eraserSize, 28), height: Math.min(eraserSize, 28) }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-4 mt-2">
                    <button onClick={() => setPaths(prev => prev.slice(0, -1))} className="flex-1 py-2.5 bg-[#fffbeb] border-[3px] border-[#f59e0b]/40 hover:bg-[#fef3c7] text-[#b45309] rounded-xl font-bold text-[13px] transition-all outline-none shadow-sm">Desfazer</button>
                    <button onClick={() => setPaths([])} className="flex-1 py-2.5 bg-[#fef2f2] border-[3px] border-red-300 hover:bg-red-50 text-red-600 rounded-xl font-bold text-[13px] transition-all outline-none shadow-sm">Limpar Tudo</button>
                  </div>
                </div>

                <div className="mb-6">
                  {!imageSrc ? (
                    <label className="flex flex-col items-center justify-center w-full h-[300px] border-[3px] border-dashed border-[#00a88e]/40 rounded-2xl cursor-pointer bg-[#f0fdfa] hover:bg-[#e6f7f5] transition-all">
                      <Upload className="w-10 h-10 text-[#00a88e] mb-4" strokeWidth={2} />
                      <p className="font-bold text-[#0f766e] text-[16px]">Carregar foto do paciente</p>
                      <p className="text-[13px] text-[#00a88e]/70 mt-1 font-medium">Clique para escolher uma imagem do seu computador</p>
                      <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                    </label>
                  ) : (
                    <div className="relative rounded-[20px] overflow-hidden border-[4px] border-[#00a88e]/30 shadow-lg" ref={containerRef}>
                      <img src={imageSrc} alt="Paciente" className="w-full max-h-[500px] object-contain block bg-[#f8fbfb]" />
                      <canvas 
                        ref={canvasRef} 
                        onMouseDown={startDrawing} 
                        onMouseMove={handleMouseMove} 
                        onMouseUp={endDrawing} 
                        onMouseLeave={handleMouseLeave} 
                        onMouseEnter={handleMouseEnter}
                        onTouchStart={startDrawing} 
                        onTouchMove={handleMouseMove} 
                        onTouchEnd={handleMouseLeave} 
                        className={`absolute top-0 left-0 w-full h-full touch-none ${activeTool === 'erase' || activeTool === 'point' ? 'cursor-none' : 'cursor-crosshair'}`} 
                        style={{ zIndex: 10 }} 
                      />
                      
                      {/* VISUALIZADOR DA BORRACHA E PONTO NO CANVAS */}
                      {isHoveringCanvas && (activeTool === 'erase' || activeTool === 'point') && (
                        <div
                          className="absolute rounded-full pointer-events-none z-20 shadow-sm"
                          style={{
                            width: activeTool === 'erase' ? eraserSize : pointSize * 2,
                            height: activeTool === 'erase' ? eraserSize : pointSize * 2,
                            left: cursorPos.x - (activeTool === 'erase' ? eraserSize / 2 : pointSize),
                            top: cursorPos.y - (activeTool === 'erase' ? eraserSize / 2 : pointSize),
                            border: `2px solid ${activeTool === 'erase' ? 'rgba(0,0,0,0.6)' : activeColor}`,
                            backgroundColor: activeTool === 'erase' ? 'rgba(255,255,255,0.7)' : `${activeColor}40`,
                          }}
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ETAPA 4: LGPD */}
            {currentStep === 4 && (
              <div className="animate-in fade-in duration-300">
                <div className="flex items-center gap-4 mb-6">
                  <div className="bg-[#dcfce7] p-3 rounded-2xl text-[#22c55e] border-[3px] border-[#22c55e]/25"><Shield className="w-7 h-7" strokeWidth={2.5} /></div>
                  <div>
                    <h3 className="text-[20px] font-bold text-[#0f172a]">Termo de Consentimento LGPD</h3>
                    <p className="text-[#64748b] text-[14px] font-medium">Autorização antes do procedimento</p>
                  </div>
                </div>
                <div className="bg-[#f0fdfa] border-[3px] border-[#00a88e]/25 rounded-2xl p-8 h-[240px] overflow-y-auto mb-6 shadow-inner">
                  <h4 className="font-bold text-[#0f766e] mb-3 text-[16px]">TERMO DE CONSENTIMENTO</h4>
                  <p className="text-[14px] text-[#334155] mb-3 font-medium leading-relaxed">Autorizo o tratamento de meus dados pessoais conforme a LGPD (Lei 13.709/2018), incluindo a coleta, armazenamento e uso de informações de saúde estritamente para a finalidade de realização dos procedimentos estéticos.</p>
                  <p className="text-[14px] text-[#334155] font-medium leading-relaxed">Declaro que forneci informações verdadeiras sobre meu histórico médico e assumo a responsabilidade por omitir qualquer condição de saúde que possa interferir no procedimento.</p>
                </div>
                <div className="space-y-3">
                  <div onClick={() => setTermoLido(!termoLido)} className={`flex items-center gap-4 p-4 border-[3px] rounded-xl cursor-pointer transition-all shadow-sm ${termoLido ? 'border-[#00a88e] bg-[#e6f7f5]' : 'border-[#00a88e]/25 bg-white hover:bg-[#f8fbfb]'}`}>
                    {termoLido ? <CheckSquare className="w-6 h-6 text-[#00a88e]" strokeWidth={2.5} /> : <Square className="w-6 h-6 text-[#00a88e]/40" strokeWidth={2.5} />}
                    <span className={`text-[14px] font-bold ${termoLido ? 'text-[#0f766e]' : 'text-[#475569]'}`}>Li e concordo com os termos. Autorizo a realização do procedimento.</span>
                  </div>
                  <div onClick={() => setTermoAssinado(!termoAssinado)} className={`flex items-center gap-4 p-4 border-[3px] rounded-xl cursor-pointer transition-all shadow-sm ${termoAssinado ? 'border-[#00a88e] bg-[#e6f7f5]' : 'border-[#00a88e]/25 bg-white hover:bg-[#f8fbfb]'}`}>
                    {termoAssinado ? <CheckSquare className="w-6 h-6 text-[#00a88e]" strokeWidth={2.5} /> : <Square className="w-6 h-6 text-[#00a88e]/40" strokeWidth={2.5} />}
                    <span className={`text-[14px] font-bold ${termoAssinado ? 'text-[#0f766e]' : 'text-[#475569]'}`}>Assino digitalmente este termo de consentimento</span>
                  </div>
                </div>
              </div>
            )}

            {/* ETAPA 5: FINALIZAÇÃO */}
            {currentStep === 5 && (
              <div className="animate-in fade-in duration-300">
                <div className="flex items-center gap-4 mb-8">
                  <div className="bg-[#dcfce7] p-3 rounded-2xl text-[#22c55e] border-[3px] border-[#22c55e]/25"><Award className="w-7 h-7" strokeWidth={2.5} /></div>
                  <div>
                    <h3 className="text-[20px] font-bold text-[#0f172a]">Finalização do Procedimento</h3>
                    <p className="text-[#64748b] text-[14px] font-medium">Orientações e confirmações finais</p>
                  </div>
                </div>
                <div className="bg-[#f0fdfa] border-[3px] border-[#00a88e]/25 rounded-2xl p-6 mb-6 shadow-sm">
                  <h4 className="text-[16px] font-bold text-[#0f766e] mb-5 flex items-center gap-2">
                    <Lightbulb className="w-5 h-5 text-[#f59e0b]" /> Orientações Pós-Procedimento
                  </h4>
                  <ul className="space-y-4">
                    {['Evitar exposição solar por 48 horas', 'Não realizar exercícios físicos intensos por 24 horas', 'Aplicar compressa fria se houver edema', 'Retorno em 15 dias para avaliação'].map((txt, i) => (
                      <li key={i} className="flex items-center gap-3 text-[#00a88e]">
                        <CheckCircle2 className="w-5 h-5 text-[#00a88e]" strokeWidth={2.5} /><span className="text-[14px] font-bold text-[#334155]">{txt}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="space-y-3">
                  <div onClick={() => setOrientacoes(!orientacoes)} className={`flex items-center gap-4 p-4 border-[3px] rounded-xl cursor-pointer transition-all shadow-sm ${orientacoes ? 'border-[#00a88e] bg-[#e6f7f5]' : 'border-[#00a88e]/25 bg-white hover:bg-[#f8fbfb]'}`}>
                    {orientacoes ? <CheckSquare className="w-6 h-6 text-[#00a88e]" strokeWidth={2.5} /> : <Square className="w-6 h-6 text-[#00a88e]/40" strokeWidth={2.5} />}
                    <span className={`text-[14px] font-bold ${orientacoes ? 'text-[#0f766e]' : 'text-[#475569]'}`}>Orientações pós-procedimento fornecidas e compreendidas</span>
                  </div>
                  <div onClick={() => setSatisfacao(!satisfacao)} className={`flex items-center gap-4 p-4 border-[3px] rounded-xl cursor-pointer transition-all shadow-sm ${satisfacao ? 'border-[#00a88e] bg-[#e6f7f5]' : 'border-[#00a88e]/25 bg-white hover:bg-[#f8fbfb]'}`}>
                    {satisfacao ? <CheckSquare className="w-6 h-6 text-[#00a88e]" strokeWidth={2.5} /> : <Square className="w-6 h-6 text-[#00a88e]/40" strokeWidth={2.5} />}
                    <span className={`text-[14px] font-bold ${satisfacao ? 'text-[#0f766e]' : 'text-[#475569]'}`}>Paciente confirma satisfação com o resultado</span>
                  </div>
                </div>
              </div>
            )}

            {/* BOTÕES DE NAVEGAÇÃO GLOBAIS */}
            <div className="flex justify-between items-center mt-10 pt-6 border-t-[3px] border-[#00a88e]/15">
              <button 
                onClick={prevStep}
                disabled={currentStep === 1 || isFinishing}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-[14px] transition-all outline-none shadow-sm border-[3px] ${currentStep === 1 ? 'text-[#94a3b8] bg-[#f8fbfb] border-[#e2e8f0] cursor-not-allowed' : 'text-[#00a88e] bg-white border-[#00a88e]/25 hover:bg-[#e6f7f5] hover:border-[#00a88e]'}`}
              >
                <ChevronLeft className="w-4 h-4" strokeWidth={3} /> Anterior
              </button>
              
              {currentStep < 5 ? (
                <button 
                  onClick={handleNextStep}
                  className="flex items-center gap-2 bg-[#00a88e] hover:bg-[#00967f] text-white px-6 py-3 rounded-xl font-bold text-[14px] transition-all outline-none shadow-md hover:shadow-lg border-[3px] border-transparent"
                >
                  Próximo <ChevronRight className="w-4 h-4" strokeWidth={3} />
                </button>
              ) : (
                <button 
                  onClick={handleFinishJourney}
                  disabled={!orientacoes || !satisfacao || isFinishing}
                  className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-[14px] transition-all outline-none shadow-md border-[3px] ${orientacoes && satisfacao ? 'bg-[#00a88e] hover:bg-[#00967f] text-white border-transparent' : 'bg-[#f8fbfb] text-[#94a3b8] border-[#e2e8f0] cursor-not-allowed shadow-none'}`}
                >
                  {isFinishing ? 'Salvando...' : 'Finalizar Jornada'} <CheckCircle className="w-4 h-4" strokeWidth={3} />
                </button>
              )}
            </div>

          </div>
        </div>
      </main>
      
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #00a88e; border-radius: 10px; opacity: 0.5; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #00967f; }
      `}} />
    </div>
  );
}