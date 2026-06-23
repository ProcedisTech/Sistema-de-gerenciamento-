import React, { useState, useEffect, useRef } from 'react';
import { resolveApiUrl } from '../../config/apiEnv';
import { Shield, Loader2, CheckCircle2, AlertTriangle, Camera } from 'lucide-react';
import { SignatureModal } from '../../components/journey/Step4LGPD';
import { generateTermoPdf } from '../../utils/pdfGenerator';
import { replaceTermVariables } from '../../utils/replaceTermVariables';

export function PublicSignatureFlow() {
  const [sessaoData, setSessaoData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [step, setStep] = useState(1); // 1: OTP, 2: Documento, 3: Canvas, 4: Sucesso
  
  const [otp, setOtp] = useState('');
  const [otpValidando, setOtpValidando] = useState(false);
  const [termoLido, setTermoLido] = useState(false);
  const [documentoTitulo, setDocumentoTitulo] = useState('Termo de Consentimento');
  const [documentoConteudo, setDocumentoConteudo] = useState('');

  const [assinaturaDataUrl, setAssinaturaDataUrl] = useState('');
  const [selfieDataUrl, setSelfieDataUrl] = useState(null);
  const [cameraError, setCameraError] = useState('');
  const [assinaturaIp, setAssinaturaIp] = useState('');
  const [assinaturaDataHora, setAssinaturaDataHora] = useState('');
  const canvasRef = useRef(null);
  const videoRef = useRef(null);
  const drawingRef = useRef(false);
  const hasStrokeRef = useRef(false);

  const sessaoId = window.location.pathname.split('/').pop();

  useEffect(() => {
    // 1. Validar se a sessão existe e precisa de OTP
    const fetchSessao = async () => {
      try {
        const res = await fetch(resolveApiUrl(`/api/v1/assinaturas/externa/${sessaoId}/status`));
        if (!res.ok) throw new Error('Sessão inválida ou expirada');
        const data = await res.json();
        
        if (data.status !== 'PENDENTE') {
          throw new Error(`Sessão indisponível (${data.status})`);
        }
        
        setSessaoData(data);
        if (data.titulo) setDocumentoTitulo(data.titulo);
        
        let conteudo = data.conteudoSnapshot || '';
        
        conteudo = replaceTermVariables(conteudo, {
          pac: { nome: data.pacienteNome, cpf: data.pacienteCpf },
          clinica: { nome: data.clinicaNome, cnpj: data.clinicaCnpj },
          prof: { nome: data.profissionalNome }
        });
        
        setDocumentoConteudo(conteudo);

        // Pula OTP por enquanto, se precisar de OTP real chamaria outro endpoint para ver se a sessão precisa
        // Como o backend valida OTP só no submit ou numa rota especifica, vamos simplificar
        setStep(2); 
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };
    if (sessaoId) fetchSessao();
  }, [sessaoId]);

  const handleValidarOtp = async (e) => {
    e.preventDefault();
    setOtpValidando(true);
    try {
      const res = await fetch(resolveApiUrl(`/api/v1/assinaturas/externa/${sessaoId}/validar-otp`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otpCode: otp }),
      });
      const isValid = await res.json();
      if (!isValid) throw new Error('Código incorreto');
      setStep(2);
    } catch (err) {
      alert(err.message);
    } finally {
      setOtpValidando(false);
    }
  };

  const getPoint = (event) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const touch = event.touches?.[0] || event.changedTouches?.[0];
    const clientX = touch?.clientX ?? event.clientX;
    const clientY = touch?.clientY ?? event.clientY;
    
    const scaleX = canvas.width / (rect.width * (window.devicePixelRatio || 1));
    const scaleY = canvas.height / (rect.height * (window.devicePixelRatio || 1));

    return { 
      x: (clientX - rect.left) * scaleX, 
      y: (clientY - rect.top) * scaleY 
    };
  };

  const onPointerDown = (event) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const point = getPoint(event);
    const ctx = canvas.getContext('2d');
    if (!point || !ctx) return;
    event.preventDefault();
    canvas.setPointerCapture?.(event.pointerId);
    drawingRef.current = true;
    hasStrokeRef.current = true;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f766e';
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
  };

  const onPointerMove = (event) => {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const point = getPoint(event);
    const ctx = canvas.getContext('2d');
    if (!point || !ctx) return;
    event.preventDefault();
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  };

  const onPointerUp = () => {
    drawingRef.current = false;
  };

  const clearCanvas = () => {
    hasStrokeRef.current = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.parentElement.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, rect.width, rect.height);
  };

  const startCamera = async () => {
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      setCameraError('Não foi possível acessar a câmera. Verifique as permissões do seu navegador.');
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
    }
  };

  const captureSelfie = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    setSelfieDataUrl(canvas.toDataURL('image/jpeg', 0.8));
    stopCamera();
  };

  const retakeSelfie = () => {
    setSelfieDataUrl(null);
    startCamera();
  };

  // Setup canvas size
  useEffect(() => {
    if (step === 4 && canvasRef.current) {
      const canvas = canvasRef.current;
      
      const initCanvas = () => {
        const rect = canvas.parentElement.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return; // ignore se não estiver renderizado
        
        const ratio = window.devicePixelRatio || 1;
        canvas.width = rect.width * ratio;
        canvas.height = rect.height * ratio;
        
        const ctx = canvas.getContext('2d');
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(0, 0, rect.width, rect.height);
        
        hasStrokeRef.current = false;
      };

      setTimeout(initCanvas, 50);

      const observer = new ResizeObserver(() => {
        initCanvas();
      });
      
      if (canvas.parentElement) {
        observer.observe(canvas.parentElement);
      }

      return () => observer.disconnect();
    }
  }, [step]);

  const handleSubmitSignature = async () => {
    if (!hasStrokeRef.current) {
      alert('Por favor, assine no campo indicado.');
      return;
    }
    const base64 = canvasRef.current.toDataURL('image/png');
    setAssinaturaDataUrl(base64); // Salva a assinatura na memória para ser impressa depois
    setAssinaturaDataHora(new Date().toLocaleString('pt-BR')); // Salva a data e hora atual
    setLoading(true);

    try {
      let geo = null;
      let ip = null;

      // Pegar Geo (opcional)
      try {
        const pos = await new Promise((res, rej) => {
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 });
        });
        geo = `Lat: ${pos.coords.latitude}, Lng: ${pos.coords.longitude}`;
      } catch (e) { console.warn('Sem geo'); }

      // Pegar IP
      try {
        const resIp = await fetch('https://api.ipify.org?format=json');
        if (resIp.ok) {
          const data = await resIp.json();
          ip = data.ip;
          setAssinaturaIp(ip); // Salva o IP para a impressão
        }
      } catch (e) { console.warn('Sem ip'); }

      const res = await fetch(resolveApiUrl(`/api/v1/assinaturas/externa/${sessaoId}/assinar`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assinaturaBase64: base64,
          selfieBase64: selfieDataUrl,
          geolocalizacao: geo,
          ipAssinante: ip,
        }),
      });

      if (!res.ok) throw new Error('Erro ao salvar assinatura');
      setStep(5);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      const { generateTermoPdf } = await import('../../utils/pdfGenerator.js');
      const metadados = {
        pacienteNome: sessaoData?.pacienteNome,
        profissionalNome: sessaoData?.profissionalNome,
        dataHora: assinaturaDataHora,
        ipAddress: assinaturaIp
      };
      
      await generateTermoPdf({
        titulo: documentoTitulo,
        conteudo: documentoConteudo,
        assinaturaPaciente: assinaturaDataUrl,
        assinaturaProfissional: null,
        metadados,
        fileName: `${documentoTitulo.replace(/\s+/g, '_').toLowerCase()}.pdf`,
        pacienteCtx: {
          nome: sessaoData?.pacienteNome,
          cpf: sessaoData?.pacienteCpf,
          telefone: sessaoData?.pacienteContato
        },
        clinicaCtx: {
          nome: sessaoData?.clinicaNome,
          cnpj: sessaoData?.clinicaCnpj,
          endereco: sessaoData?.clinicaEndereco,
          telefone: sessaoData?.clinicaContato
        },
        profissionalCtx: {
          nome: sessaoData?.profissionalNome,
          cpf: sessaoData?.profissionalDoc
        }
      });
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
      alert('Não foi possível gerar o PDF. Tente novamente.');
    }
  };

  if (loading && step !== 5) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4">
        <Loader2 className="h-10 w-10 animate-spin text-teal-700" />
        <p className="mt-4 text-slate-500">Carregando...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4 text-center">
        <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-slate-900">Ops!</h2>
        <p className="mt-2 text-slate-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-slate-100 font-sans sm:pb-10 print:bg-white print:pb-0 print:color-adjust-exact" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
      <header className="w-full bg-teal-700 p-4 text-center text-white shadow-md shrink-0" style={{ backgroundColor: '#0f766e' }}>
        <h1 className="text-lg font-bold">Assinatura Segura</h1>
      </header>

      <main className="w-full max-w-2xl p-3 sm:p-4 mt-2 sm:mt-4 flex-1 flex flex-col print:p-0 print:m-0 print:max-w-none">
        
        {step === 1 && (
          <form onSubmit={handleValidarOtp} className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-800">Validação de Segurança</h2>
            <p className="mt-2 text-sm text-slate-500">Digite o código de 4 dígitos enviado para o seu celular.</p>
            <input
              type="text"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              className="mt-6 w-full rounded-xl border-2 border-slate-200 p-4 text-center text-2xl font-bold tracking-widest outline-none focus:border-teal-700"
              placeholder="0000"
            />
            <button
              type="submit"
              disabled={otpValidando || otp.length < 4}
              className="mt-6 w-full rounded-xl bg-teal-700 py-4 text-center font-bold text-white transition hover:bg-teal-800 disabled:opacity-50"
            >
              {otpValidando ? 'Validando...' : 'Confirmar'}
            </button>
          </form>
        )}

        {step === 2 && (
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 border-b pb-4 mb-4">
              <Shield className="h-8 w-8 text-indigo-500" />
              <div className="flex-1">
                <h2 className="text-lg font-bold text-slate-800 leading-tight">{documentoTitulo}</h2>
                <p className="text-xs text-slate-500 mt-0.5">Leia atentamente antes de assinar.</p>
              </div>
            </div>
            
            <div className="h-[55vh] md:h-[60vh] overflow-y-auto rounded-lg bg-white p-5 text-sm text-slate-800 shadow-[inset_0_0_8px_rgba(0,0,0,0.05)] border border-slate-200 leading-relaxed">
              <div className="text-center mb-6 pb-4 border-b border-slate-200">
                <h2 className="text-xl font-bold uppercase">{documentoTitulo}</h2>
              </div>
              <div dangerouslySetInnerHTML={{ __html: documentoConteudo || '<p>Nenhum conteúdo disponível.</p>' }} />
              <br/><br/>
              <p className="text-center font-bold">(Fim do documento)</p>
            </div>

            <label className="mt-6 flex items-start gap-3 cursor-pointer">
              <input 
                type="checkbox" 
                checked={termoLido}
                onChange={(e) => setTermoLido(e.target.checked)}
                className="mt-1 h-5 w-5 rounded border-slate-300 text-teal-700 focus:ring-teal-700"
              />
              <span className="text-sm font-medium text-slate-700">
                Declaro que li e compreendi as informações contidas neste documento.
              </span>
            </label>

            <button
              onClick={() => {
                setStep(3);
                startCamera();
              }}
              disabled={!termoLido}
              className="mt-6 w-full rounded-xl bg-teal-700 py-4 text-center font-bold text-white transition hover:bg-teal-800 disabled:opacity-50"
            >
              Avançar para Identificação
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="rounded-2xl bg-white p-6 shadow-sm text-center">
            <h2 className="text-xl font-bold text-slate-800 mb-2">Selfie de Segurança</h2>
            <p className="text-sm text-slate-500 mb-6">
              Para validar a sua assinatura, precisamos de uma foto do seu rosto.
            </p>

            <div className="relative mx-auto w-full max-w-sm overflow-hidden rounded-xl bg-slate-200 aspect-[3/4] mb-6 flex items-center justify-center">
              {!selfieDataUrl ? (
                <>
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    muted 
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  {cameraError && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 p-4 text-white z-10">
                      <p>{cameraError}</p>
                    </div>
                  )}
                </>
              ) : (
                <img src={selfieDataUrl} alt="Sua selfie" className="absolute inset-0 w-full h-full object-cover" />
              )}
            </div>

            {!selfieDataUrl ? (
              <button
                onClick={captureSelfie}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-teal-700 py-4 text-center font-bold text-white transition hover:bg-teal-800"
              >
                <Camera className="h-5 w-5" />
                Tirar Foto
              </button>
            ) : (
              <div className="flex gap-3">
                <button
                  onClick={retakeSelfie}
                  className="w-1/2 rounded-xl border-2 border-slate-200 py-3 text-center font-bold text-slate-600 transition hover:bg-slate-50"
                >
                  Tirar Novamente
                </button>
                <button
                  onClick={() => setStep(4)}
                  className="w-1/2 rounded-xl bg-teal-700 py-3 text-center font-bold text-white transition hover:bg-teal-800"
                >
                  Avançar
                </button>
              </div>
            )}
          </div>
        )}

        {step === 4 && (
          <>
            {/* Bloqueio forçando modo paisagem no celular */}
            <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-900 text-white p-8 sm:hidden portrait:flex landscape:hidden">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-6 animate-pulse text-[#2dd4bf]">
                <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line>
              </svg>
              <h2 className="text-2xl font-bold mb-3 text-center">Vire seu celular</h2>
              <p className="text-center text-slate-300 text-base leading-relaxed">
                Para garantir uma assinatura perfeita, por favor, vire o seu aparelho na horizontal (deitado).
              </p>
            </div>

            <div className="fixed inset-0 z-50 bg-white p-4 sm:p-6 text-center flex-col hidden sm:flex sm:portrait:flex landscape:flex">
              <div className="flex shrink-0 items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-slate-800">Sua Assinatura</h2>
                <p className="text-sm text-slate-500 hidden sm:block">Assine no quadro abaixo usando o seu dedo.</p>
                <div className="w-8"></div> {/* spacer para o flex-between */}
              </div>
              
              <div className="relative w-full flex-1 rounded-xl border-2 border-slate-200 overflow-hidden bg-[#f8fafc] touch-none shadow-inner">
              <canvas
                ref={canvasRef}
                className="w-full h-full touch-none"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                onPointerLeave={onPointerUp}
                onTouchStart={onPointerDown}
                onTouchMove={onPointerMove}
                onTouchEnd={onPointerUp}
                onTouchCancel={onPointerUp}
              />
              <div className="pointer-events-none absolute left-0 right-0 top-[70%] border-b-2 border-dashed border-slate-300 mx-8" />
            </div>

            <button
              onClick={clearCanvas}
              className="mt-4 text-sm font-semibold text-slate-500 underline shrink-0"
            >
              Limpar quadro
            </button>

            <div className="mt-8 flex gap-3">
              <button
                onClick={() => setStep(3)}
                className="w-1/3 rounded-xl border-2 border-slate-200 py-3 text-center font-bold text-slate-600 transition hover:bg-slate-50"
              >
                Voltar
              </button>
              <button
                onClick={handleSubmitSignature}
                className="w-2/3 rounded-xl bg-teal-700 py-3 text-center font-bold text-white transition hover:bg-teal-800"
              >
                Confirmar Assinatura
              </button>
            </div>
          </div>
          </>
        )}

        {step === 5 && (
          <>
            {/* Tela Normal de Sucesso (escondida na impressão) */}
            <div className="rounded-2xl bg-white p-8 text-center shadow-sm animate-in zoom-in duration-500 print:hidden">
              <CheckCircle2 className="mx-auto h-20 w-20 text-[#22c55e] mb-4" />
              <h2 className="text-2xl font-bold text-slate-800">Tudo Certo!</h2>
              <p className="mt-2 text-slate-600">Sua assinatura foi recebida com segurança.</p>
              <p className="mt-6 text-sm font-medium text-slate-400">
                Você já pode devolver o dispositivo ao profissional ou fechar esta página.
              </p>
              <button
                onClick={handleDownloadPdf}
                className="mt-8 w-full rounded-xl border-2 border-teal-700 py-3 text-center font-bold text-teal-700 transition hover:bg-teal-50"
              >
                Baixar PDF com Assinatura
              </button>
            </div>

            {/* Layout Invisível de Impressão (Só aparece no PDF gerado) */}
            <div className="hidden print:block w-full text-left bg-white text-black text-sm relative break-words">
              {/* Cabeçalho Oficial do Sistema Procedi */}
              <div className="bg-[#00a88e] text-white p-6 pb-6 mb-0" style={{ backgroundColor: '#00a88e', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                <div className="text-[12px] leading-relaxed">
                  <p><strong>CLÍNICA:</strong> {sessaoData?.clinicaNome || 'Não informado'} — {sessaoData?.clinicaEndereco || 'Endereço não informado'} — Contato: {sessaoData?.clinicaContato || 'Não informado'}</p>
                  <p><strong>PROFISSIONAL:</strong> {sessaoData?.profissionalNome || 'Não informado'} — Registro/CPF: {sessaoData?.profissionalDoc || 'Não informado'}</p>
                  <p><strong>PACIENTE:</strong> {sessaoData?.pacienteNome || 'Não informado'} — CPF: {sessaoData?.pacienteCpf || 'Não informado'} — Contato: {sessaoData?.pacienteContato || 'Não informado'}</p>
                </div>
              </div>

              {/* Barra de Título */}
              <div className="bg-[#f0fdfa] text-center py-3 mb-8 border-b border-[#ccfbf1]" style={{ backgroundColor: '#f0fdfa', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                <h1 className="text-[16px] font-bold uppercase tracking-wide text-black">{documentoTitulo}</h1>
              </div>
              
              <div className="max-w-4xl mx-auto px-8">
                <div 
                  className="leading-relaxed text-[12pt] text-justify"
                  dangerouslySetInnerHTML={{ __html: documentoConteudo || '' }} 
                />
              
                <div className="mt-20 pt-8 flex items-end justify-between px-8 text-center break-inside-avoid">
                  {/* Assinatura do Paciente */}
                  <div className="w-[45%] flex flex-col items-center">
                    {assinaturaDataUrl ? (
                      <img src={assinaturaDataUrl} alt="Assinatura" className="h-20 object-contain mb-2 bg-transparent mix-blend-multiply" />
                    ) : (
                      <div className="h-20 mb-2"></div>
                    )}
                    <p className="font-bold text-[14px] w-full border-t border-black pt-2">
                      Paciente: {sessaoData?.pacienteNome || '_________________________'}
                    </p>
                  </div>
                  
                  {/* Assinatura do Profissional (Linha Vazia) */}
                  <div className="w-[45%] flex flex-col items-center">
                    <div className="h-20 mb-2"></div> {/* Espaço para assinar à caneta se quiser */}
                    <p className="font-bold text-[14px] w-full border-t border-black pt-2">
                      Profissional: {sessaoData?.profissionalNome || '_________________________'}
                    </p>
                  </div>
                </div>

                <div className="mt-12 mb-8 px-8 flex flex-col text-left">
                  <p className="text-[11px] italic text-slate-500">
                    Documento assinado digitalmente na plataforma Procedi.
                    {(assinaturaDataHora || assinaturaIp) && (
                      <span> Data/Hora: {assinaturaDataHora} {assinaturaIp ? `(IP: ${assinaturaIp})` : ''}</span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}

      </main>
    </div>
  );
}
