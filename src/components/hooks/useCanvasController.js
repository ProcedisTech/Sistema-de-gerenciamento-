import { useCallback, useEffect, useRef, useState } from 'react';

export function useCanvasController({
  currentStep,
  selectedPatientCpf,
  cpf,
  setPatients,
  setEvaluationSelectedPhotoIndex,
}) {
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
  const [evaluationAnnotatedPhotoUrl, setEvaluationAnnotatedPhotoUrl] = useState(null);

  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  const colors = [
    '#ef4444',
    '#f97316',
    '#f59e0b',
    '#eab308',
    '#84cc16',
    '#22c55e',
    '#10b981',
    '#14b8a6',
    '#06b6d4',
    '#0ea5e9',
    '#3b82f6',
    '#6366f1',
    '#8b5cf6',
    '#a855f7',
    '#d946ef',
    '#ec4899',
    '#f43f5e',
  ];

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setImageSrc(event.target.result);
      setPaths([]);
      setEvaluationSelectedPhotoIndex(null);
      setEvaluationAnnotatedPhotoUrl(null);
    };
    reader.readAsDataURL(file);
  };

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

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
        for (let i = 1; i < path.points.length; i++) {
          ctx.lineTo(path.points[i].x, path.points[i].y);
        }
        ctx.stroke();
      }
    });

    ctx.globalCompositeOperation = 'source-over';
  }, [paths, showPointNumbers]);

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

    const blob = await new Promise((resolve) => outCanvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92));
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
    if (currentStep !== 3 || !imageSrc || !canvasRef.current || !containerRef.current) return;

    const updateCanvasSize = () => {
      const { width, height } = containerRef.current.getBoundingClientRect();
      canvasRef.current.width = width;
      canvasRef.current.height = height;
      redrawCanvas();
    };

    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, [currentStep, imageSrc, redrawCanvas]);

  const getCoordinates = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const startDrawing = (e) => {
    if (!imageSrc) return;

    setIsDrawing(true);
    setPaths([
      ...paths,
      {
        tool: activeTool,
        color: activeColor,
        width: activeTool === 'erase' ? eraserSize : strokeWidth,
        size: pointSize,
        points: [getCoordinates(e)],
      },
    ]);
  };

  const draw = (e) => {
    if (!isDrawing || !imageSrc || activeTool === 'point') return;

    e.preventDefault();
    setPaths((prev) => {
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

  return {
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
    evaluationAnnotatedPhotoUrl,
    setEvaluationAnnotatedPhotoUrl,
    canvasRef,
    containerRef,
    colors,
    handleImageUpload,
    saveAnnotatedEvaluationPhoto,
    startDrawing,
    handleMouseMove,
    endDrawing,
    handleMouseLeave,
    handleMouseEnter,
  };
}


