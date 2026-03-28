import React, { useRef, useEffect } from 'react';
import { Eye, Upload, Image as ImageIcon, CheckCircle, Square, CheckSquare } from 'lucide-react';

const colors = ['#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e'];

export function Step3Evaluation({
  imageSrc, setImageSrc,
  activeTool, setActiveTool,
  activeColor, setActiveColor,
  pointSize, setPointSize,
  showPointNumbers, setShowPointNumbers,
  eraserSize, setEraserSize,
  cursorPos, setCursorPos,
  isHoveringCanvas, setIsHoveringCanvas,
  paths, setPaths,
  isDrawing, setIsDrawing,
  canvasRef, containerRef,
  evaluationAnnotatedPhotoUrl, setEvaluationAnnotatedPhotoUrl,
  selectedPatientCpf, cpf,
  patients, setPatients,
}) {
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

    paths.forEach((path) => {
      ctx.beginPath();
      ctx.strokeStyle = path.tool === 'erase' ? 'rgba(0,0,0,1)' : path.color;
      ctx.fillStyle = path.tool === 'erase' ? 'rgba(0,0,0,1)' : path.color;
      ctx.lineWidth = path.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalCompositeOperation = path.tool === 'erase' ? 'destination-out' : 'source-over';

      if (path.tool === 'point' && path.points.length > 0) {
        const pt = path.points[0];
        const radius = path.size || 12;

        ctx.arc(pt.x, pt.y, radius, 0, 2 * Math.PI);
        ctx.fill();

        if (showPointNumbers) {
          ctx.globalCompositeOperation = 'source-over';

          const fontSize = Math.max(12, Math.min(radius * 1.2, 20));
          ctx.font = `bold ${fontSize}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          if (radius >= 12) {
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = 'rgba(0,0,0,0.4)';
            ctx.shadowBlur = 3;
            ctx.fillText(currentPointNumber.toString(), pt.x, pt.y + 1);
            ctx.shadowBlur = 0;
          } else {
            ctx.fillStyle = path.color;
            ctx.shadowColor = 'rgba(255,255,255,0.9)';
            ctx.shadowBlur = 4;
            ctx.fillText(currentPointNumber.toString(), pt.x + radius + 10, pt.y - radius - 5);
            ctx.shadowBlur = 0;
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

  const saveAnnotatedEvaluationPhoto = async () => {
    if (!imageSrc) return;
    const overlayCanvas = canvasRef.current;
    if (!overlayCanvas) return;
    if (!paths || paths.length === 0) {
      alert('Desenhe algo no canvas antes de salvar.');
      return;
    }

    const outCanvas = document.createElement('canvas');
    outCanvas.width = overlayCanvas.width;
    outCanvas.height = overlayCanvas.height;
    const ctx = outCanvas.getContext('2d');
    if (!ctx) return;

    const baseImg = new Image();
    baseImg.src = imageSrc;
    await new Promise((resolve, reject) => {
      baseImg.onload = () => resolve();
      baseImg.onerror = () => reject(new Error('Falha ao carregar imagem base.'));
    });

    const baseW = baseImg.naturalWidth || baseImg.width;
    const baseH = baseImg.naturalHeight || baseImg.height;
    const scale = Math.min(outCanvas.width / baseW, outCanvas.height / baseH);
    const drawW = baseW * scale;
    const drawH = baseH * scale;
    const dx = (outCanvas.width - drawW) / 2;
    const dy = (outCanvas.height - drawH) / 2;

    ctx.clearRect(0, 0, outCanvas.width, outCanvas.height);
    ctx.drawImage(baseImg, dx, dy, drawW, drawH);
    ctx.drawImage(overlayCanvas, 0, 0);

    const blob = await new Promise((resolve) =>
      outCanvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92)
    );
    if (!blob) return;

    const url = URL.createObjectURL(blob);
    if (evaluationAnnotatedPhotoUrl) {
      try {
        URL.revokeObjectURL(evaluationAnnotatedPhotoUrl);
      } catch {
        // ignore
      }
    }
    setEvaluationAnnotatedPhotoUrl(url);

    const targetCpf = (selectedPatientCpf || cpf || '').trim();
    if (targetCpf) {
      setPatients((prev) =>
        prev.map((p) =>
          (p.cpf || '').trim() !== targetCpf ? p : { ...p, evaluationAnnotatedPhotoUrl: url }
        )
      );
    }

    alert('Foto desenhada salva na ficha do paciente (mock).');
  };

  useEffect(() => {
    if (imageSrc && canvasRef.current && containerRef.current) {
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
  }, [imageSrc, paths, showPointNumbers]);

  const startDrawing = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left || e.touches[0].clientX - rect.left;
    const y = e.clientY - rect.top || e.touches[0].clientY - rect.top;

    setIsDrawing(true);

    if (activeTool === 'point') {
      setPaths((prev) => [...prev, { tool: 'point', points: [{ x, y }], color: activeColor, size: pointSize, width: 3 }]);
    } else {
      setPaths((prev) => [...prev, { tool: activeTool, points: [{ x, y }], color: activeColor, width: activeTool === 'erase' ? eraserSize : 3 }]);
    }
  };

  const handleMouseMove = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left || e.touches[0].clientX - rect.left;
    const y = e.clientY - rect.top || e.touches[0].clientY - rect.top;

    setCursorPos({ x, y });

    if (!isDrawing || !canvasRef.current) return;

    setPaths((prev) => {
      const newPaths = [...prev];
      if (newPaths.length > 0) {
        const lastPath = newPaths[newPaths.length - 1];
        lastPath.points.push({ x, y });
      }
      return newPaths;
    });
  };

  const endDrawing = () => {
    setIsDrawing(false);
  };

  const handleMouseLeave = () => {
    setIsDrawing(false);
    setIsHoveringCanvas(false);
  };

  const handleMouseEnter = () => {
    setIsHoveringCanvas(true);
  };

  return (
    <div className="animate-in fade-in duration-300">
      <div className="flex items-center gap-4 mb-8">
        <div className="bg-[#eff6ff] p-3 rounded-2xl text-[#3b82f6] border-[3px] border-[#3b82f6]/25">
          <Eye className="w-7 h-7" strokeWidth={2.5} />
        </div>
        <div>
          <h3 className="text-[20px] font-bold text-[#0f172a]">Avaliação e Mapeamento</h3>
          <p className="text-[#64748b] text-[14px] font-medium">Desenhe e marque pontos na foto do paciente</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white border-[3px] border-[#00a88e]/25 rounded-2xl p-6 mb-6">
        {/* Ferramentas e Cores */}
        <div className="flex flex-col md:flex-row gap-6 mb-6">
          <div className="flex-1">
            <span className="text-[13px] font-bold text-[#00a88e] mb-3 block">Ferramentas</span>
            <div className="flex gap-2">
              {['draw', 'point', 'erase'].map((t) => (
                <button
                  key={t}
                  onClick={() => setActiveTool(t)}
                  className={`flex-1 py-2.5 rounded-xl text-[13px] font-bold border-[3px] transition-all outline-none ${
                    activeTool === t
                      ? 'bg-[#00a88e] text-white border-[#00a88e] shadow-md'
                      : 'bg-[#f8fbfb] text-[#475569] border-[#00a88e]/20 hover:bg-[#e6f7f5] hover:text-[#00a88e]'
                  }`}
                >
                  {t === 'draw' ? 'Desenhar' : t === 'point' ? 'Ponto' : 'Apagar'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1">
            <span className="text-[13px] font-bold text-[#00a88e] mb-3 block">Cores</span>
            <div className="flex flex-wrap gap-2">
              {colors.slice(0, 10).map((color) => (
                <button
                  key={color}
                  onClick={() => {
                    setActiveColor(color);
                    setActiveTool(activeTool === 'erase' ? 'draw' : activeTool);
                  }}
                  className={`w-8 h-8 rounded-full shadow-sm transition-all outline-none ${
                    activeColor === color && activeTool !== 'erase' ? 'ring-[4px] ring-offset-2 ring-[#00a88e]/30 scale-110' : 'hover:scale-110'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Configurações do Ponto */}
        {activeTool === 'point' && (
          <div className="flex flex-col md:flex-row items-center gap-6 mb-6 p-4 bg-[#f8fbfb] border-[3px] border-[#00a88e]/15 rounded-xl">
            <div className="flex-1 w-full">
              <div className="flex justify-between items-center mb-2">
                <label className="text-[13px] font-bold text-[#0f766e]">Tamanho do Ponto</label>
                <span className="text-[12px] font-bold text-[#00a88e] bg-[#e6f7f5] px-2 py-0.5 rounded-md">{pointSize}px</span>
              </div>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="3"
                  max="40"
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
              <div
                onClick={() => setShowPointNumbers(!showPointNumbers)}
                className={`flex items-center gap-3 p-3 w-full border-[3px] rounded-xl cursor-pointer transition-all shadow-sm ${
                  showPointNumbers ? 'border-[#00a88e] bg-[#e6f7f5]' : 'border-[#00a88e]/20 bg-white hover:bg-[#f8fbfb]'
                }`}
              >
                {showPointNumbers ? <CheckSquare className="w-5 h-5 text-[#00a88e]" strokeWidth={2.5} /> : <Square className="w-5 h-5 text-[#00a88e]/40" strokeWidth={2.5} />}
                <span className={`text-[13px] font-bold ${showPointNumbers ? 'text-[#0f766e]' : 'text-[#475569]'}`}>Numerar Pontos</span>
              </div>
            </div>
          </div>
        )}

        {/* Configurações da Borracha */}
        {activeTool === 'erase' && (
          <div className="flex flex-col md:flex-row items-center gap-6 mb-6 p-4 bg-[#f8fbfb] border-[3px] border-[#00a88e]/15 rounded-xl">
            <div className="flex-1 w-full">
              <div className="flex justify-between items-center mb-2">
                <label className="text-[13px] font-bold text-[#0f766e]">Tamanho da Borracha</label>
                <span className="text-[12px] font-bold text-[#00a88e] bg-[#e6f7f5] px-2 py-0.5 rounded-md">{eraserSize}px</span>
              </div>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="5"
                  max="100"
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

        {/* Botões */}
        <div className="flex gap-4 mt-2">
          <button
            onClick={() => setPaths((prev) => prev.slice(0, -1))}
            className="flex-1 py-2.5 bg-[#fffbeb] border-[3px] border-[#f59e0b]/40 hover:bg-[#fef3c7] text-[#b45309] rounded-xl font-bold text-[13px] transition-all outline-none shadow-sm"
          >
            Desfazer
          </button>
          <button
            onClick={() => setPaths([])}
            className="flex-1 py-2.5 bg-[#fef2f2] border-[3px] border-red-300 hover:bg-red-50 text-red-600 rounded-xl font-bold text-[13px] transition-all outline-none shadow-sm"
          >
            Limpar Tudo
          </button>
        </div>
      </div>

      {/* Canvas Area */}
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
              className={`absolute top-0 left-0 w-full h-full touch-none ${
                activeTool === 'erase' || activeTool === 'point' ? 'cursor-none' : 'cursor-crosshair'
              }`}
              style={{ zIndex: 10 }}
            />

            {/* Cursor Preview */}
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

      {/* Ações */}
      {imageSrc && (
        <div className="mt-4 flex items-center justify-between gap-4 flex-wrap">
          <label className="cursor-pointer text-[13px] font-bold text-[#00a88e] hover:text-[#00967f] bg-[#e6f7f5] border-[3px] border-[#00a88e]/15 hover:bg-[#f0fdfa] px-4 py-2 rounded-xl transition-all">
            Trocar por upload
            <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
          </label>

          <button
            type="button"
            onClick={saveAnnotatedEvaluationPhoto}
            disabled={!imageSrc || !paths || paths.length === 0}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-[14px] transition-all outline-none shadow-sm border-[3px] ${
              paths && paths.length > 0
                ? 'bg-[#00a88e] hover:bg-[#00967f] text-white border-transparent'
                : 'bg-[#f8fbfb] text-[#94a3b8] border-[#e2e8f0] cursor-not-allowed shadow-none'
            }`}
          >
            <CheckCircle className="w-4 h-4" strokeWidth={3} />
            Salvar foto desenhada
          </button>

          {evaluationAnnotatedPhotoUrl && (
            <div className="w-20 h-20 rounded-2xl overflow-hidden border-[3px] border-[#00a88e]/20 bg-white shadow-sm">
              <img src={evaluationAnnotatedPhotoUrl} alt="Foto desenhada salva" className="w-full h-full object-cover" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

