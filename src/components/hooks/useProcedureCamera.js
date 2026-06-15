import { useCallback, useEffect, useRef, useState } from 'react';
import { generateJourneyId } from '../utils';
import { GALERIA_CATEGORIA } from '../../utils/pacienteGaleria.js';

const STEP4_FOTO_CATEGORIAS = new Set([
  GALERIA_CATEGORIA.ANTES,
  GALERIA_CATEGORIA.DEPOIS,
  GALERIA_CATEGORIA.MAPA,
]);

function normalizeStep4FotoCategoria(categoria) {
  return STEP4_FOTO_CATEGORIAS.has(categoria) ? categoria : GALERIA_CATEGORIA.ANTES;
}

export function useProcedureCamera({
  currentStep,
  journeyId,
  setJourneyId,
  selectedPatientCpf,
  cpf,
  setPatients,
}) {
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [isCameraStarting, setIsCameraStarting] = useState(false);
  const [anamnesePhotoUrl, setAnamnesePhotoUrl] = useState(null);
  const [anamnesePhotoBlob, setAnamnesePhotoBlob] = useState(null);
  const [anamnesePhotoMeta, setAnamnesePhotoMeta] = useState(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState(null);
  const [photoPreviewBlob, setPhotoPreviewBlob] = useState(null);
  const [videoReady, setVideoReady] = useState(false);
  const [preferredFacing, setPreferredFacing] = useState('environment');

  const EVALUATION_PHOTO_MAX = 30;
  const [evaluationCapturedPhotos, setEvaluationCapturedPhotos] = useState([]);
  const [procedureCapturedPhotos, setProcedureCapturedPhotos] = useState([]);
  /** 'antes' | 'depois' | 'mapa' — alinhado ao seletor do Step 4 e à câmera flutuante. */
  const [procedureFotoCategoria, setProcedureFotoCategoria] = useState(GALERIA_CATEGORIA.ANTES);
  const [evaluationSelectedPhotoIndex, setEvaluationSelectedPhotoIndex] = useState(null);
  const [evaluationAnnotatedPhotoUrl, setEvaluationAnnotatedPhotoUrl] = useState(null);

  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const revokePreviewUrl = (url) => {
    if (!url) return;
    try {
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  };

  const resetProcedureCapturedPhotos = useCallback(() => {
    setProcedureCapturedPhotos((prev) => {
      (prev || []).forEach((ph) => {
        try {
          if (ph?.url) URL.revokeObjectURL(ph.url);
        } catch {
          /* ignore */
        }
      });
      return [];
    });
  }, []);

  const resetEvaluationPhotos = useCallback(() => {
    setEvaluationCapturedPhotos((prev) => {
      (prev || []).forEach((ph) => {
        try {
          if (ph?.url) URL.revokeObjectURL(ph.url);
        } catch {
          /* ignore */
        }
      });
      return [];
    });
    setEvaluationSelectedPhotoIndex(null);
  }, []);

  const stopCamera = () => {
    try {
      const stream = streamRef.current;
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    } catch {
      // ignore
    } finally {
      streamRef.current = null;
      setVideoReady(false);
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }
  };

  const startCamera = async () => {
    if (!navigator?.mediaDevices?.getUserMedia) {
      setCameraError('Seu navegador nao suporta camera.');
      return;
    }
    setCameraError('');
    setIsCameraStarting(true);
    stopCamera();
    const primary = preferredFacing;
    const secondary = primary === 'environment' ? 'user' : 'environment';
    const requestStream = (facing) =>
      navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facing } },
        audio: false,
      });
    try {
      let stream;
      try {
        stream = await requestStream(primary);
      } catch {
        stream = await requestStream(secondary);
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setVideoReady(true);
    } catch (err) {
      setCameraError(
        err?.name === 'NotAllowedError'
          ? 'Permissao da camera negada. Ajuste as permissoes do navegador.'
          : 'Nao foi possivel acessar a camera.'
      );
    } finally {
      setIsCameraStarting(false);
    }
  };

  const toggleCameraFacing = () => {
    setPreferredFacing((f) => (f === 'environment' ? 'user' : 'environment'));
  };

  const openPhotoModal = () => {
    const count =
      currentStep === 4 ? procedureCapturedPhotos.length : evaluationCapturedPhotos.length;
    if (count >= EVALUATION_PHOTO_MAX) {
      setCameraError(`Limite de ${EVALUATION_PHOTO_MAX} fotos atingido.`);
      return;
    }
    if (!journeyId) setJourneyId(generateJourneyId());
    setCameraError('');
    setPhotoPreviewUrl(null);
    setPhotoPreviewBlob(null);
    setPreferredFacing('environment');
    setPhotoModalOpen(true);
  };

  const closePhotoModal = () => {
    stopCamera();
    setPhotoModalOpen(false);
    setCameraError('');
    revokePreviewUrl(photoPreviewUrl);
    setPhotoPreviewUrl(null);
    setPhotoPreviewBlob(null);
  };

  const retakePhoto = () => {
    revokePreviewUrl(photoPreviewUrl);
    setPhotoPreviewUrl(null);
    setPhotoPreviewBlob(null);
  };

  const capturePhoto = async () => {
    const videoEl = videoRef.current;
    if (!videoEl || !videoReady) return;

    const canvas = document.createElement('canvas');
    const width = videoEl.videoWidth || 640;
    const height = videoEl.videoHeight || 480;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(videoEl, 0, 0, width, height);

    const blob = await new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92));
    if (!blob) return;

    revokePreviewUrl(photoPreviewUrl);
    const url = URL.createObjectURL(blob);
    setPhotoPreviewUrl(url);
    setPhotoPreviewBlob(blob);
  };

  const confirmPhoto = () => {
    if (!photoPreviewUrl) return;

    if (currentStep === 4) {
      if (procedureCapturedPhotos.length >= EVALUATION_PHOTO_MAX) {
        setCameraError(`Limite de ${EVALUATION_PHOTO_MAX} fotos atingido.`);
        return;
      }

      const meta = {
        journeyId: journeyId || generateJourneyId(),
        capturedAt: new Date().toISOString(),
        stepCaptured: 4,
        source: 'camera',
        categoria: normalizeStep4FotoCategoria(procedureFotoCategoria),
      };

      const newEntry = { url: photoPreviewUrl, blob: photoPreviewBlob, meta };
      const newPhotos = [...procedureCapturedPhotos, newEntry];

      setAnamnesePhotoUrl(photoPreviewUrl);
      setAnamnesePhotoBlob(photoPreviewBlob);
      setAnamnesePhotoMeta(meta);

      setProcedureCapturedPhotos(newPhotos);

      setPhotoPreviewUrl(null);
      setPhotoPreviewBlob(null);
      stopCamera();
      setPhotoModalOpen(false);
      setCameraError('');
      return;
    }

    if (evaluationCapturedPhotos.length >= EVALUATION_PHOTO_MAX) {
      setCameraError(`Limite de ${EVALUATION_PHOTO_MAX} fotos atingido.`);
      return;
    }

    const meta = {
      journeyId: journeyId || generateJourneyId(),
      capturedAt: new Date().toISOString(),
      stepCaptured: currentStep,
    };

    const newEntry = { url: photoPreviewUrl, blob: photoPreviewBlob, meta };
    const newPhotos = [...evaluationCapturedPhotos, newEntry];
    const newSelectedIdx = newPhotos.length - 1;

    setAnamnesePhotoUrl(photoPreviewUrl);
    setAnamnesePhotoBlob(photoPreviewBlob);
    setAnamnesePhotoMeta(meta);

    setEvaluationCapturedPhotos(newPhotos);
    setEvaluationSelectedPhotoIndex(newSelectedIdx);

    const targetCpf = (selectedPatientCpf || cpf || '').trim();
    if (targetCpf) {
      setPatients((prev) =>
        prev.map((p) => {
          if ((p.cpf || '').trim() !== targetCpf) return p;
          return {
            ...p,
            evaluationCapturedPhotos: newPhotos.map((ph) => ({
              url: ph.url,
              meta: ph.meta,
            })),
            evaluationSelectedPhotoIndex: newSelectedIdx,
          };
        })
      );
    }

    setPhotoPreviewUrl(null);
    setPhotoPreviewBlob(null);
    stopCamera();
    setPhotoModalOpen(false);
    setCameraError('');
  };

  const uploadPhotoFiles = (fileList) => {
    const files = Array.from(fileList || []).filter((f) => f && String(f.type || '').startsWith('image/'));
    if (!files.length) return;

    const remaining = Math.max(0, EVALUATION_PHOTO_MAX - evaluationCapturedPhotos.length);
    if (remaining <= 0) {
      setCameraError(`Limite de ${EVALUATION_PHOTO_MAX} fotos atingido.`);
      return;
    }

    const slice = files.slice(0, remaining);
    const nowIso = new Date().toISOString();
    const nextPhotos = [
      ...evaluationCapturedPhotos,
      ...slice.map((file) => ({
        url: URL.createObjectURL(file),
        blob: file,
        meta: {
          journeyId: journeyId || generateJourneyId(),
          capturedAt: nowIso,
          stepCaptured: currentStep,
          source: 'upload',
          fileName: file.name,
        },
      })),
    ];

    const newSelectedIdx = nextPhotos.length - 1;
    setEvaluationCapturedPhotos(nextPhotos);
    setEvaluationSelectedPhotoIndex(newSelectedIdx);
    setAnamnesePhotoUrl(nextPhotos[newSelectedIdx]?.url || null);
    setAnamnesePhotoBlob(nextPhotos[newSelectedIdx]?.blob || null);
    setAnamnesePhotoMeta(nextPhotos[newSelectedIdx]?.meta || null);

    const targetCpf = (selectedPatientCpf || cpf || '').trim();
    if (targetCpf) {
      setPatients((prev) =>
        prev.map((p) => {
          if ((p.cpf || '').trim() !== targetCpf) return p;
          return {
            ...p,
            evaluationCapturedPhotos: nextPhotos.map((ph) => ({
              url: ph.url,
              meta: ph.meta,
            })),
            evaluationSelectedPhotoIndex: newSelectedIdx,
          };
        })
      );
    }

    if (slice.length < files.length) {
      setCameraError(`Foram adicionadas ${slice.length} fotos. Limite de ${EVALUATION_PHOTO_MAX} atingido.`);
    } else {
      setCameraError('');
    }
  };

  const uploadProcedureFiles = (fileList, categoria = 'antes') => {
    const files = Array.from(fileList || []).filter((f) => f && String(f.type || '').startsWith('image/'));
    if (!files.length) return;

    const cat = normalizeStep4FotoCategoria(categoria);

    setProcedureCapturedPhotos((prev) => {
      const remaining = Math.max(0, EVALUATION_PHOTO_MAX - prev.length);
      if (remaining <= 0) {
        setCameraError(`Limite de ${EVALUATION_PHOTO_MAX} fotos atingido.`);
        return prev;
      }
      const slice = files.slice(0, remaining);
      const nowIso = new Date().toISOString();
      const nextPhotos = [
        ...prev,
        ...slice.map((file) => ({
          url: URL.createObjectURL(file),
          blob: file,
          meta: {
            journeyId: journeyId || generateJourneyId(),
            capturedAt: nowIso,
            stepCaptured: 4,
            source: 'upload',
            fileName: file.name,
            categoria: cat,
          },
        })),
      ];
      if (slice.length < files.length) {
        setCameraError(`Foram adicionadas ${slice.length} fotos. Limite de ${EVALUATION_PHOTO_MAX} atingido.`);
      } else {
        setCameraError('');
      }
      return nextPhotos;
    });
  };

  const removeProcedurePhoto = useCallback((idx) => {
    setProcedureCapturedPhotos((prev) => {
      if (!Array.isArray(prev) || idx < 0 || idx >= prev.length) return prev;
      const row = prev[idx];
      try {
        if (row?.url) URL.revokeObjectURL(row.url);
      } catch {
        /* ignore */
      }
      return prev.filter((_, i) => i !== idx);
    });
  }, []);

  const removeEvaluationPhoto = useCallback(
    (idx) => {
      let nextSnapshot = null;
      setEvaluationCapturedPhotos((prev) => {
        if (!Array.isArray(prev) || idx < 0 || idx >= prev.length) return prev;
        const row = prev[idx];
        try {
          if (row?.url) URL.revokeObjectURL(row.url);
        } catch {
          /* ignore */
        }
        nextSnapshot = prev.filter((_, i) => i !== idx);
        return nextSnapshot;
      });

      if (!nextSnapshot) return;

      const targetCpf = (selectedPatientCpf || cpf || '').trim();
      if (targetCpf) {
        setPatients((pPrev) =>
          pPrev.map((p) => {
            if ((p.cpf || '').trim() !== targetCpf) return p;
            return {
              ...p,
              evaluationCapturedPhotos: nextSnapshot.map((ph) => ({
                url: ph.url,
                meta: ph.meta,
              })),
            };
          })
        );
      }
    },
    [selectedPatientCpf, cpf, setPatients]
  );

  /** Substitui um item da lista de fotos do procedimento pelo JPEG já com desenho. */
  const replaceProcedureCapturedPhotoAt = useCallback((index, entry) => {
    const newUrl = entry?.url;
    if (!newUrl) return;

    setProcedureCapturedPhotos((prev) => {
      if (!Array.isArray(prev) || index < 0 || index >= prev.length) return prev;
      const old = prev[index];
      try {
        if (old?.url) URL.revokeObjectURL(old.url);
      } catch {
        // ignore
      }
      const mergedMeta = {
        ...(old?.meta || {}),
        ...(entry.meta || {}),
        annotated: true,
      };
      const next = [...prev];
      next[index] = {
        url: newUrl,
        blob: entry.blob ?? null,
        meta: mergedMeta,
      };
      return next;
    });
  }, []);

  /** Substitui um item da lista de avaliação pelo JPEG já com desenho (mesmo índice selecionado na etapa 3). */
  const replaceEvaluationCapturedPhotoAt = useCallback(
    (index, entry) => {
      const newUrl = entry?.url;
      if (!newUrl) return;

      let nextSnapshot = null;
      setEvaluationCapturedPhotos((prev) => {
        if (!Array.isArray(prev) || index < 0 || index >= prev.length) return prev;
        const old = prev[index];
        try {
          if (old?.url) URL.revokeObjectURL(old.url);
        } catch {
          // ignore
        }
        const mergedMeta = {
          ...(old?.meta || {}),
          ...(entry.meta || {}),
          annotated: true,
        };
        nextSnapshot = [...prev];
        nextSnapshot[index] = {
          url: newUrl,
          blob: entry.blob ?? null,
          meta: mergedMeta,
        };
        return nextSnapshot;
      });

      if (!nextSnapshot) return;

      const targetCpf = (selectedPatientCpf || cpf || '').trim();
      if (targetCpf) {
        setPatients((pPrev) =>
          pPrev.map((p) => {
            if ((p.cpf || '').trim() !== targetCpf) return p;
            return {
              ...p,
              evaluationCapturedPhotos: nextSnapshot.map((ph) => ({
                url: ph.url,
                meta: ph.meta,
              })),
              evaluationAnnotatedPhotoUrl: newUrl,
            };
          })
        );
      }
    },
    [selectedPatientCpf, cpf, setPatients]
  );

  useEffect(() => {
    if (!photoModalOpen) return;
    startCamera().catch(() => {});
    return () => {
      stopCamera();
    };
    // preferredFacing triggers restart when user toggles; startCamera reads latest preferredFacing from closure on each run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoModalOpen, preferredFacing]);

  return {
    EVALUATION_PHOTO_MAX,
    photoModalOpen,
    cameraError,
    isCameraStarting,
    anamnesePhotoUrl,
    setAnamnesePhotoUrl,
    anamnesePhotoBlob,
    setAnamnesePhotoBlob,
    anamnesePhotoMeta,
    setAnamnesePhotoMeta,
    photoPreviewUrl,
    setPhotoPreviewUrl,
    photoPreviewBlob,
    setPhotoPreviewBlob,
    videoReady,
    videoRef,
    evaluationCapturedPhotos,
    setEvaluationCapturedPhotos,
    procedureCapturedPhotos,
    setProcedureCapturedPhotos,
    resetProcedureCapturedPhotos,
    resetEvaluationPhotos,
    evaluationSelectedPhotoIndex,
    setEvaluationSelectedPhotoIndex,
    evaluationAnnotatedPhotoUrl,
    setEvaluationAnnotatedPhotoUrl,
    stopCamera,
    revokePreviewUrl,
    openPhotoModal,
    closePhotoModal,
    retakePhoto,
    capturePhoto,
    confirmPhoto,
    uploadPhotoFiles,
    uploadProcedureFiles,
    procedureFotoCategoria,
    setProcedureFotoCategoria,
    removeProcedurePhoto,
    removeEvaluationPhoto,
    replaceProcedureCapturedPhotoAt,
    replaceEvaluationCapturedPhotoAt,
    preferredFacing,
    toggleCameraFacing,
  };
}
