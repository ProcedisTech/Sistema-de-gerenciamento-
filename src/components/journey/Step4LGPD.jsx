import React from 'react';
import { Shield, Square, CheckSquare, PenLine, Eraser, RotateCw, X, Upload, Image as ImageIcon, Trash2, Stethoscope, ClipboardList } from 'lucide-react';

export function Step4LGPD({
  termoLido, setTermoLido,
  termoAssinado, setTermoAssinado,
  termoAssinaturaDataUrl,
  setTermoAssinaturaDataUrl,
  lgpdCapturedPhotos = [],
  lgpdPhotoMax = 30,
  onLgpdUploadFiles,
  onLgpdRemovePhoto,
  step4Errors = {},
  setStep4Errors = () => {},
  nomeProcedimento = '',
  setNomeProcedimento = () => {},
  observacoesExecucao = '',
  setObservacoesExecucao = () => {},
}) {
  const [signatureModalOpen, setSignatureModalOpen] = React.useState(false);
  const [mobilePortrait, setMobilePortrait] = React.useState(false);
  const dialogRef = React.useRef(null);
  const closeButtonRef = React.useRef(null);
  const openSignatureRef = React.useRef(null);
  const canvasRef = React.useRef(null);
  const isDrawingRef = React.useRef(false);
  const hasStrokeRef = React.useRef(Boolean(termoAssinaturaDataUrl));
  const lgpdUploadInputRef = React.useRef(null);

  React.useEffect(() => {
    const evaluateOrientation = () => {
      const isMobile = window.matchMedia('(max-width: 767px)').matches;
      const isPortrait = window.matchMedia('(orientation: portrait)').matches;
      setMobilePortrait(isMobile && isPortrait);
    };

    evaluateOrientation();
    window.addEventListener('resize', evaluateOrientation);
    return () => window.removeEventListener('resize', evaluateOrientation);
  }, []);

  const resizeAndPaintCanvas = React.useCallback((dataUrl) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(rect.width * ratio));
    canvas.height = Math.max(1, Math.floor(rect.height * ratio));

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);

    if (dataUrl) {
      const image = new Image();
      image.onload = () => {
        ctx.drawImage(image, 0, 0, rect.width, rect.height);
      };
      image.src = dataUrl;
    }
  }, []);

  React.useEffect(() => {
    if (!signatureModalOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement;
    const openSignatureNode = openSignatureRef.current;
    document.body.style.overflow = 'hidden';

    const onResize = () => {
      const currentCanvas = canvasRef.current;
      if (!currentCanvas) return;
      const currentData = currentCanvas.toDataURL('image/png');
      resizeAndPaintCanvas(currentData);
    };

    const raf = window.requestAnimationFrame(() => {
      resizeAndPaintCanvas(termoAssinaturaDataUrl || '');
      closeButtonRef.current?.focus();
    });

    window.addEventListener('resize', onResize);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      document.body.style.overflow = previousOverflow;

      const focusTarget = openSignatureNode || previouslyFocused;
      if (focusTarget && typeof focusTarget.focus === 'function') {
        focusTarget.focus();
      }
    };
  }, [signatureModalOpen, resizeAndPaintCanvas, termoAssinaturaDataUrl]);

  React.useEffect(() => {
    if (!signatureModalOpen) return undefined;

    const getFocusableElements = () => {
      if (!dialogRef.current) return [];
      return Array.from(
        dialogRef.current.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
      ).filter((el) => !el.hasAttribute('disabled'));
    };

    const onKeyDown = (event) => {
      if (event.key === 'Escape') setSignatureModalOpen(false);

      if (event.key !== 'Tab') return;
      const focusable = getFocusableElements();
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [signatureModalOpen]);

  const getPoint = (event) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  };

  const handlePointerDown = (event) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const point = getPoint(event);
    const ctx = canvas.getContext('2d');
    if (!point || !ctx) return;

    event.preventDefault();
    canvas.setPointerCapture?.(event.pointerId);

    isDrawingRef.current = true;
    hasStrokeRef.current = true;
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f766e';
  };

  const handlePointerMove = (event) => {
    if (!isDrawingRef.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const point = getPoint(event);
    const ctx = canvas.getContext('2d');
    if (!point || !ctx) return;

    event.preventDefault();
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  };

  const handlePointerUp = () => {
    isDrawingRef.current = false;
  };

  const clearSignature = () => {
    resizeAndPaintCanvas('');
    hasStrokeRef.current = false;
  };

  const saveSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasStrokeRef.current) {
      alert('Faça a assinatura antes de salvar.');
      return;
    }

    const dataUrl = canvas.toDataURL('image/png');
    setTermoAssinaturaDataUrl(dataUrl);
    setTermoAssinado(true);
    setStep4Errors((prev) => ({ ...prev, termoAssinado: false }));
    setSignatureModalOpen(false);
  };

  const handleSignatureAction = () => {
    if (termoAssinado && termoAssinaturaDataUrl) {
      setTermoAssinado(false);
      setTermoAssinaturaDataUrl('');
      return;
    }

    setSignatureModalOpen(true);
  };

  const handleLgpdImageUpload = (event) => {
    const files = Array.from(event.target.files || []).filter((f) => String(f.type || '').startsWith('image/'));
    event.target.value = '';
    if (!files.length) return;
    onLgpdUploadFiles?.(files);
  };

  return (
    <div className="animate-in fade-in duration-300">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="bg-[#dcfce7] p-3 rounded-2xl text-[#22c55e] border-[3px] border-[#22c55e]/25">
            <Shield className="w-7 h-7" strokeWidth={2.5} />
          </div>
          <div>
            <h3 className="text-[20px] font-bold text-[#0f172a]">Termo de Consentimento LGPD</h3>
            <p className="text-[#64748b] text-[14px] font-medium">Autorização antes do procedimento</p>
          </div>
        </div>

        <div className="flex flex-col items-start sm:items-end gap-1.5">
          <button
            type="button"
            onClick={() => lgpdUploadInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border-[3px] border-transparent bg-[#16a34a] text-white text-[13px] font-bold shadow-sm hover:bg-[#15803d] transition-all"
          >
            <Upload className="w-4 h-4" strokeWidth={2.5} />
            Upload de imagens
          </button>
          <input
            ref={lgpdUploadInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleLgpdImageUpload}
          />
          <span className="text-[12px] font-bold text-[#15803d]">
            {(lgpdCapturedPhotos || []).length}/{lgpdPhotoMax} imagens na jornada
          </span>
        </div>
      </div>

      <div className="bg-white border-[3px] border-[#00a88e]/25 rounded-2xl p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-[#e6f7f5] flex items-center justify-center">
            <ClipboardList className="w-5 h-5 text-[#00a88e]" strokeWidth={2.25} />
          </div>
          <div>
            <h4 className="text-[15px] font-bold text-[#0f172a]">Observações da Execução</h4>
            <p className="text-[12px] text-[#64748b]">Registre o que foi realizado</p>
          </div>
        </div>
        <textarea
          value={observacoesExecucao}
          onChange={(e) => setObservacoesExecucao(e.target.value)}
          placeholder="Descreva o que foi feito durante o procedimento..."
          rows={4}
          className="w-full border-[2px] border-[#e2e8f0] rounded-xl px-4 py-3 text-[14px] focus:border-[#00a88e] outline-none resize-none"
        />
      </div>

      <div className="bg-white border-[3px] border-[#00a88e]/25 rounded-2xl p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-[#e6f7f5] flex items-center justify-center">
            <Stethoscope className="w-5 h-5 text-[#00a88e]" />
          </div>
          <div>
            <h4 className="text-[15px] font-bold text-[#0f172a]">Procedimento Realizado</h4>
            <p className="text-[12px] text-[#64748b]">Registre o procedimento executado</p>
          </div>
        </div>
        <input
          type="text"
          placeholder="Nome do procedimento *"
          value={nomeProcedimento}
          onChange={(e) => setNomeProcedimento(e.target.value)}
          className="w-full border-[2px] border-[#e2e8f0] rounded-xl px-4 py-3 text-[14px] focus:border-[#00a88e] outline-none"
        />
      </div>

      <div className="bg-[#f0fdfa] border-[3px] border-[#00a88e]/25 rounded-2xl p-8 h-[240px] overflow-y-auto mb-6 shadow-inner">
        <h4 className="font-bold text-[#0f766e] mb-3 text-[16px]">TERMO DE CONSENTIMENTO</h4>
        <p className="text-[14px] text-[#334155] mb-3 font-medium leading-relaxed">
          Autorizo o tratamento de meus dados pessoais conforme a LGPD (Lei 13.709/2018), incluindo a coleta, armazenamento e uso de informações de saúde estritamente para a finalidade de realização dos procedimentos estéticos.
        </p>
        <p className="text-[14px] text-[#334155] font-medium leading-relaxed">
          Declaro que forneci informações verdadeiras sobre meu histórico médico e assumo a responsabilidade por omitir qualquer condição de saúde que possa interferir no procedimento.
        </p>
      </div>

      <div className="space-y-3">
        <div
          onClick={() => {
            setTermoLido(!termoLido);
            setStep4Errors((prev) => ({ ...prev, termoLido: false }));
          }}
          className={`flex items-center gap-4 p-4 border-[3px] rounded-xl cursor-pointer transition-all shadow-sm ${
            step4Errors.termoLido
              ? 'border-red-500 bg-red-50 ring-1 ring-red-200'
              : termoLido
                ? 'border-[#00a88e] bg-[#e6f7f5]'
                : 'border-[#00a88e]/25 bg-white hover:bg-[#f8fbfb]'
          }`}
        >
          {termoLido ? (
            <CheckSquare className="w-6 h-6 text-[#00a88e]" strokeWidth={2.5} />
          ) : (
            <Square className="w-6 h-6 text-[#00a88e]/40" strokeWidth={2.5} />
          )}
          <span className={`text-[14px] font-bold ${termoLido ? 'text-[#0f766e]' : 'text-[#475569]'}`}>
            Li e concordo com os termos. Autorizo a realização do procedimento.
          </span>
        </div>

        <div
          ref={openSignatureRef}
          onClick={() => {
            setStep4Errors((prev) => ({ ...prev, termoAssinado: false }));
            handleSignatureAction();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              setStep4Errors((prev) => ({ ...prev, termoAssinado: false }));
              handleSignatureAction();
            }
          }}
          role="button"
          tabIndex={0}
          className={`flex items-center gap-4 p-4 border-[3px] rounded-xl cursor-pointer transition-all shadow-sm ${
            step4Errors.termoAssinado
              ? 'border-red-500 bg-red-50 ring-1 ring-red-200'
              : termoAssinado
                ? 'border-[#00a88e] bg-[#e6f7f5]'
                : 'border-[#00a88e]/25 bg-white hover:bg-[#f8fbfb]'
          }`}
        >
          {termoAssinado ? (
            <CheckSquare className="w-6 h-6 text-[#00a88e]" strokeWidth={2.5} />
          ) : (
            <Square className="w-6 h-6 text-[#00a88e]/40" strokeWidth={2.5} />
          )}
          <span className={`text-[14px] font-bold ${termoAssinado ? 'text-[#0f766e]' : 'text-[#475569]'}`}>
            Assino digitalmente este termo de consentimento
          </span>
        </div>

        {termoAssinaturaDataUrl && (
          <div className="border-[3px] border-[#00a88e]/20 rounded-xl p-3 bg-white">
            <p className="text-[12px] font-bold text-[#0f766e] mb-2">Assinatura registrada</p>
            <div className="h-[120px] rounded-lg border-[2px] border-[#00a88e]/20 bg-[#f8fbfb] overflow-hidden">
              <img src={termoAssinaturaDataUrl} alt="Assinatura digital" className="w-full h-full object-contain" />
            </div>
          </div>
        )}

        {(lgpdCapturedPhotos || []).length === 0 ? (
          <div className="bg-[#f8fbfb] border-[3px] border-[#00a88e]/15 rounded-2xl p-4 text-[#64748b] text-[13px] font-medium flex items-center gap-2">
            <ImageIcon className="w-4 h-4" />
            Use o botao verde para anexar as imagens de consentimento/LGPD.
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            {(lgpdCapturedPhotos || []).map((ph, idx) => (
              <div key={`${ph.url}_${idx}`} className="relative">
                <div className="w-20 h-20 rounded-2xl overflow-hidden border-[3px] border-[#00a88e]/15 bg-white">
                  <img src={ph.url} alt="Imagem LGPD" className="w-full h-full object-cover" />
                </div>
                <button
                  type="button"
                  onClick={() => onLgpdRemovePhoto?.(idx)}
                  className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-red-500 hover:bg-red-600 text-white border-[3px] border-white flex items-center justify-center shadow-md"
                  aria-label="Remover imagem LGPD"
                  title="Remover imagem"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {signatureModalOpen && (
        <div className="fixed inset-0 z-[220] flex items-end sm:items-center justify-center p-0 sm:p-4" onMouseDown={() => setSignatureModalOpen(false)}>
          <div className="absolute inset-0 bg-black/65" onClick={() => setSignatureModalOpen(false)} />

          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="lgpd-sign-title"
            className="relative w-full max-w-[980px] max-h-[100dvh] sm:max-h-[92vh] bg-white rounded-t-2xl sm:rounded-2xl border-[3px] border-[#00a88e]/25 shadow-xl overflow-hidden"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="p-3 sm:p-4 border-b-[3px] border-[#00a88e]/15 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="bg-[#e6f7f5] p-2 rounded-xl border-[3px] border-[#00a88e]/25">
                  <PenLine className="w-5 h-5 text-[#00a88e]" strokeWidth={2.5} />
                </div>
                <div className="min-w-0">
                  <h4 id="lgpd-sign-title" className="text-[14px] sm:text-[16px] font-bold text-[#0f172a] truncate">Assinatura Digital do Termo</h4>
                  <p className="text-[11px] sm:text-[12px] font-medium text-[#64748b]">Use mouse no computador ou dedo no celular</p>
                </div>
              </div>

              <button
                ref={closeButtonRef}
                type="button"
                onClick={() => setSignatureModalOpen(false)}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl hover:bg-[#f8fbfb] border-[3px] border-transparent text-[#94a3b8] hover:text-[#00a88e] transition-all flex items-center justify-center shrink-0"
                aria-label="Fechar assinatura"
              >
                <X className="w-5 h-5" strokeWidth={2.5} />
              </button>
            </div>

            <div className="p-3 sm:p-4 overflow-y-auto max-h-[calc(100dvh-72px)] sm:max-h-[calc(92vh-76px)] space-y-3">
              {mobilePortrait && (
                <div className="flex items-center gap-2 text-[12px] font-bold text-[#0f766e] bg-[#e6f7f5] border-[3px] border-[#00a88e]/20 rounded-xl px-3 py-2">
                  <RotateCw className="w-4 h-4" strokeWidth={2.5} />
                  Para assinar com mais conforto, vire o celular na horizontal.
                </div>
              )}

              <div className="rounded-xl border-[3px] border-[#00a88e]/25 bg-[#f8fbfb] p-2 sm:p-3">
                <canvas
                  ref={canvasRef}
                  className="w-full h-[220px] sm:h-[300px] bg-white rounded-lg border-[2px] border-[#00a88e]/20 touch-none"
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                  onPointerLeave={handlePointerUp}
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={clearSignature}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-[3px] border-[#f59e0b]/35 bg-[#fffbeb] text-[#b45309] font-bold text-[13px] hover:bg-[#fef3c7] transition-all"
                >
                  <Eraser className="w-4 h-4" strokeWidth={2.5} />
                  Limpar assinatura
                </button>
                <button
                  type="button"
                  onClick={saveSignature}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-[3px] border-transparent bg-[#00a88e] text-white font-bold text-[13px] hover:bg-[#00967f] transition-all"
                >
                  <CheckSquare className="w-4 h-4" strokeWidth={2.5} />
                  Salvar assinatura
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
