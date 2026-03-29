import { useEffect, useRef, useState } from 'react';
import { generateJourneyId } from '../utils';

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

  const EVALUATION_PHOTO_MAX = 5;
  const [evaluationCapturedPhotos, setEvaluationCapturedPhotos] = useState([]);
  const [evaluationSelectedPhotoIndex, setEvaluationSelectedPhotoIndex] = useState(null);
  const [evaluationAnnotatedPhotoUrl, setEvaluationAnnotatedPhotoUrl] = useState(null);

  const videoRef = useRef(null);
  const streamRef = useRef(null);

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
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });
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

  const revokePreviewUrl = (url) => {
    if (!url) return;
    try {
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  };

  const openPhotoModal = () => {
    if (evaluationCapturedPhotos.length >= EVALUATION_PHOTO_MAX) {
      setCameraError(`Limite de ${EVALUATION_PHOTO_MAX} fotos atingido.`);
      return;
    }
    if (!journeyId) setJourneyId(generateJourneyId());
    setCameraError('');
    setPhotoPreviewUrl(null);
    setPhotoPreviewBlob(null);
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

  useEffect(() => {
    if (!photoModalOpen) return;
    startCamera().catch(() => {});
    return () => {
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoModalOpen]);

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
  };
}


