import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Shield,
  RotateCw,
  Image as ImageIcon,
  Trash2,
  Stethoscope,
  ChevronDown,
  Lock,
  Check,
  Camera,
  PenLine,
  X,
  FileText,
  Calendar,
  Eye,
  AlertTriangle,
  MessageCircle,
  Mail,
  Link2,
  QrCode,
} from 'lucide-react';
import {
  authHeadersForFetch,
  termoAssinaturaApi,
  termosApi,
} from '../../services/api';
import { ProcedimentoAutocomplete } from '../shared/ProcedimentoAutocomplete.jsx';
import { useProcedimentosOptions } from '../../hooks/useProcedimentosOptions';
import { TermoVisualizacao } from '../termos/TermoVisualizacao';
import { resolveApiUrl } from '../../config/apiEnv';
import { useToast } from '../../contexts/useToast.js';
import { buildLgpdConsentText } from './lgpd/lgpdConsentText';
import { MapaAplicacaoPanel } from './mapa-aplicacao/MapaAplicacaoPanel.jsx';
import { GALERIA_CATEGORIA, GALERIA_CATEGORIA_LABELS } from '../../utils/pacienteGaleria.js';

const STEP4_FOTO_CATEGORIAS = [
  GALERIA_CATEGORIA.ANTES,
  GALERIA_CATEGORIA.MAPA,
  GALERIA_CATEGORIA.DEPOIS,
];

const STEP4_FOTO_OVERLAY_BADGE = {
  [GALERIA_CATEGORIA.ANTES]: 'bg-[#f59e0b]',
  [GALERIA_CATEGORIA.MAPA]: 'bg-[#a855f7]',
  [GALERIA_CATEGORIA.DEPOIS]: 'bg-[#22c55e]',
};

const DEFAULT_TERMO_TITULO = 'TERMO DE CONSENTIMENTO';

/**
 * ID virtual usado para o Termo LGPD padrão do Procedi.
 * Começa com '__' para não colidir com IDs numéricos do backend.
 */
const LGPD_VIRTUAL_ID = '__lgpd_padrao';

function formatTimestamp(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Modal fullscreen de assinatura (profissional ou paciente). */
export function SignatureFullscreenModal({
  open,
  title,
  onClose,
  canvasRef,
  hasStrokeRef,
  mobilePortrait,
  onConfirm,
}) {
  const wrapRef = useRef(null);
  const drawingRef = useRef(false);
  const [strokePresent, setStrokePresent] = useState(false);

  const resizeAndPaintCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const rect = wrap.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    let snap = '';
    try {
      if (hasStrokeRef.current && canvas.width) snap = canvas.toDataURL('image/png');
    } catch {
      snap = '';
    }
    canvas.width = Math.max(1, Math.floor(rect.width * ratio));
    canvas.height = Math.max(1, Math.floor(rect.height * ratio));
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);
    if (snap) {
      const image = new Image();
      image.onload = () => {
        ctx.drawImage(image, 0, 0, rect.width, rect.height);
      };
      image.src = snap;
    }
  }, [canvasRef, hasStrokeRef]);

  useLayoutEffect(() => {
    if (!open) return undefined;
    hasStrokeRef.current = false;
    setStrokePresent(false);
    drawingRef.current = false;
    resizeAndPaintCanvas();
    const wrap = wrapRef.current;
    if (!wrap) return undefined;
    const ro = new ResizeObserver(() => resizeAndPaintCanvas());
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [open, hasStrokeRef, resizeAndPaintCanvas]);

  const getPoint = (event) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const touch = event.touches?.[0] || event.changedTouches?.[0];
    const cx = (touch?.clientX ?? event.clientX) - rect.left;
    const cy = (touch?.clientY ?? event.clientY) - rect.top;
    return { x: cx, y: cy };
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
    setStrokePresent(true);
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
    setStrokePresent(false);
    drawingRef.current = false;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const rect = wrap.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(rect.width * ratio));
    canvas.height = Math.max(1, Math.floor(rect.height * ratio));
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);
  };

  const handleConfirm = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasStrokeRef.current) return;
    onConfirm(canvas.toDataURL('image/png'));
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[300] flex flex-col bg-white">
      <header className="flex shrink-0 items-center justify-between border-b border-[#e2e8f0] px-4 py-3">
        <h3 className="text-[16px] font-bold text-[#0f172a]">{title}</h3>
        <button
          type="button"
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-[#64748b] hover:bg-[#f1f5f9]"
          aria-label="Fechar"
        >
          <X className="h-5 w-5" strokeWidth={2.5} />
        </button>
      </header>

      <div
        ref={wrapRef}
        className="relative min-h-[200px] w-full flex-1 touch-none bg-white [-webkit-overflow-scrolling:touch] sm:min-h-0"
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full touch-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={onPointerUp}
        />
        <div
          className="pointer-events-none absolute left-0 right-0 border-b-2 border-dashed border-[#e2e8f0]"
          style={{ top: '60%' }}
          aria-hidden
        />
        {!strokePresent ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-[15px] text-[#cbd5e1]">
            Assine aqui
          </div>
        ) : null}
      </div>

      {mobilePortrait ? (
        <div className="flex shrink-0 items-center gap-2 border-t border-[#e2e8f0] bg-[#e6f7f5] px-4 py-2.5 text-[11px] font-bold text-[#0f766e]">
          <RotateCw className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
          Vire o aparelho na horizontal para assinar com mais conforto.
        </div>
      ) : null}

      <footer className="flex shrink-0 flex-col gap-2 border-t border-[#e2e8f0] px-4 py-3 sm:flex-row sm:gap-3">
        <button
          type="button"
          onClick={clearCanvas}
          className="h-12 w-full rounded-lg border-2 border-[#e2e8f0] bg-white text-[14px] font-semibold text-[#64748b] active:bg-[#f8fafc] sm:h-11 sm:flex-1 sm:text-[13px] sm:hover:bg-[#f8fafc]"
        >
          Limpar
        </button>
        <button
          type="button"
          disabled={!strokePresent}
          onClick={handleConfirm}
          className="h-12 w-full rounded-lg bg-[#00a88e] text-[14px] font-semibold text-white transition-colors active:bg-[#00967f] disabled:cursor-not-allowed disabled:bg-[#e2e8f0] disabled:text-[#94a3b8] sm:h-11 sm:flex-1 sm:text-[13px] sm:hover:bg-[#00967f]"
        >
          Confirmar assinatura
        </button>
      </footer>
    </div>
  );
}

export function Step3Termos({
  _termoLido,
  setTermoLido,
  termoAssinaturaDataUrl,
  setTermoAssinaturaDataUrl,
  setTermoAssinado,
  profissionalAssinaturaDataUrl,
  setProfissionalAssinaturaDataUrl,
  _step4Errors = {},
  setStep4Errors = () => {},
  termosAssinados = [],
  setTermosAssinados = () => {},
  termosPendentesIds = [],
  setTermosPendentesIds = () => {},
  termoTitulo,
  termoConteudo,
  onTermoChange,
  onAssinaturaSalva,
  pacienteId = null,
  procedimentoFeitoId = null,
  roleUserId = null,
  pacienteCtx,
  clinicaCtx,
  profissionalCtx,
  onConcluir,
}) {
  const toast = useToast();
  const [termosDisponiveis, setTermosDisponiveis] = useState([]);
  const [termosLoading, setTermosLoading] = useState(true);
  const [termoSelecionadoId, setTermoSelecionadoId] = useState(null);
  const [termoSelecionado, setTermoSelecionado] = useState(null);
  const [termoMenuOpen, setTermoMenuOpen] = useState(false);
  const termoMenuRef = useRef(null);
  const [termoSearch, setTermoSearch] = useState('');
  const termoSearchInputRef = useRef(null);
  const [profSigningOpen, setProfSigningOpen] = useState(false);
  const [patSigningOpen, setPatSigningOpen] = useState(false);
  const profCanvasRef = useRef(null);
  const patCanvasRef = useRef(null);
  const profHasStrokeRef = useRef(false);
  const patHasStrokeRef = useRef(false);
  const [mobilePortrait, setMobilePortrait] = useState(false);
  const [profAssinaturaTimestamp, setProfAssinaturaTimestamp] = useState(null);
  const [patAssinaturaTimestamp, setPatAssinaturaTimestamp] = useState(null);
  const [assinaturaPersistida, setAssinaturaPersistida] = useState(false);

  const [pacienteRecusou, setPacienteRecusou] = useState(false);

  const [showSalvarPadraoPrompt, setShowSalvarPadraoPrompt] = useState(false);
  const [savingPadraoPrompt, setSavingPadraoPrompt] = useState(false);
  const [pendingNextTermoId, setPendingNextTermoId] = useState(null);
  const [termoToCancel, setTermoToCancel] = useState(null);
  const [backendAssinaturaId, setBackendAssinaturaId] = useState(null);
  const [showQr, setShowQr] = useState(false);
  const [showConcluirConfirm, setShowConcluirConfirm] = useState(false);
  const [autoSignatureApplied, setAutoSignatureApplied] = useState(false);
  const assinaturaProfRecenteRef = useRef('');

  useEffect(() => {
    setAssinaturaPersistida(false);
  }, [termoSelecionadoId]);

  useEffect(() => {
    if (
      !profissionalAssinaturaDataUrl ||
      (!termoAssinaturaDataUrl && !pacienteRecusou) ||
      !termoSelecionadoId ||
      !pacienteId ||
      assinaturaPersistida
    ) {
      return;
    }

    const salvar = async () => {
      try {
        setAssinaturaPersistida(true);
        // O conteúdo do termo selecionado é enviado como snapshot imutável
        // para garantir validade jurídica (o paciente assinou ESTE texto).
        // Usamos conteudoExibicao para garantir que as interpolações
        // (como [NOME DO PACIENTE]) já estejam aplicadas no snapshot salvo.
        const conteudoSnapshot = String(conteudoExibicao || '').trim() || null;

        let ipAddress = null;
        try {
          const res = await fetch('https://api.ipify.org?format=json');
          if (res.ok) {
            const data = await res.json();
            ipAddress = data.ip;
          }
        } catch (e) {
          console.warn('Não foi possível capturar o IP', e);
        }

        const resultado = await termoAssinaturaApi.criar({
          // Para termos virtuais (LGPD padrão) não há ID numérico no banco;
          // enviamos null e o backend persiste somente via conteudoSnapshot.
          termoId: termoSelecionado?._virtual ? null : termoSelecionadoId,
          pacienteId,
          procedimentoFeitoId: procedimentoFeitoId ?? null,
          roleUserId: roleUserId ?? null,
          assinaturaProfissional: profissionalAssinaturaDataUrl,
          assinaturaPaciente: pacienteRecusou ? null : termoAssinaturaDataUrl,
          pacienteRecusou: pacienteRecusou,
          profissionalAssinouEm:
            profAssinaturaTimestamp != null
              ? new Date(profAssinaturaTimestamp).toISOString()
              : new Date().toISOString(),
          pacienteAssinouEm:
            patAssinaturaTimestamp != null
              ? new Date(patAssinaturaTimestamp).toISOString()
              : new Date().toISOString(),
          conteudoSnapshot,
          userAgent: navigator.userAgent,
          ipAddress,
        });

        if (resultado?.id) {
          setBackendAssinaturaId(resultado.id);
        }
        toast.success('Termo assinado e salvo com sucesso.');
        onAssinaturaSalva?.(resultado);

        const novoTermoAssinado = {
          termoId: termoSelecionado?._virtual ? null : termoSelecionadoId,
          termoTitulo: tituloExibicao,
          backendAssinaturaId: resultado?.id,
          resultadoCompleto: resultado,
        };
        setTermosAssinados(prev => [...prev, novoTermoAssinado]);
        
        // Remover da fila de pendentes se estiver lá
        setTermosPendentesIds(prev => {
          const newList = prev.filter(id => String(id) !== String(termoSelecionadoId));
          if (newList.length > 0) {
            setPendingNextTermoId(newList[0]);
          }
          return newList;
        });
        
        // Limpar para permitir um novo termo
        setProfissionalAssinaturaDataUrl('');
        setTermoAssinaturaDataUrl('');
        setProfAssinaturaTimestamp(null);
        setPatAssinaturaTimestamp(null);
        setPacienteRecusou(false);
        if (typeof setTermoAssinado === 'function') setTermoAssinado(false);
        setTermoSelecionadoId(null);
        setTermoSelecionado(null);
        setAssinaturaPersistida(false);
      } catch (e) {
        setAssinaturaPersistida(false);
        toast.error('Erro ao salvar assinatura: ' + (e?.message || 'Tente novamente'));
      }
    };

    salvar();
  }, [
    profissionalAssinaturaDataUrl,
    termoAssinaturaDataUrl,
    termoSelecionadoId,
    pacienteId,
    assinaturaPersistida,
    procedimentoFeitoId,
    roleUserId,
    profAssinaturaTimestamp,
    patAssinaturaTimestamp,
    onAssinaturaSalva,
    toast,
  ]);

  useEffect(() => {
    termosApi
      .list()
      .then((raw) => {
        const list = Array.isArray(raw) ? raw : raw?.content ?? [];
        const ativos = list.filter((t) => t.ativo !== false);
        // Se a clínica ainda não cadastrou nenhum termo, injetamos o template
        // LGPD como item virtual para que o fluxo não fique bloqueado.
        if (ativos.length === 0) {
          setTermosDisponiveis([
            {
              id: LGPD_VIRTUAL_ID,
              titulo: 'Termo de Consentimento LGPD (Padrão Procedi)',
              conteudo: buildLgpdConsentText({}),
              ativo: true,
              _virtual: true, // marca para tratamento especial ao salvar
            },
          ]);
        } else {
          setTermosDisponiveis(ativos);
        }
      })
      .catch(() => setTermosDisponiveis([]))
      .finally(() => setTermosLoading(false));
  }, []);

  useEffect(() => {
    if (!termoMenuOpen) return undefined;
    const handler = (e) => {
      if (termoMenuRef.current && !termoMenuRef.current.contains(e.target)) {
        setTermoMenuOpen(false);
        setTermoSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [termoMenuOpen]);

  useEffect(() => {
    if (termoMenuOpen) {
      termoSearchInputRef.current?.focus();
    }
  }, [termoMenuOpen]);

  useEffect(() => {
    const ev = () => {
      const isMobile = window.matchMedia('(max-width: 639px)').matches;
      const isPortrait = window.matchMedia('(orientation: portrait)').matches;
      setMobilePortrait(isMobile && isPortrait);
    };
    ev();
    window.addEventListener('resize', ev);
    return () => window.removeEventListener('resize', ev);
  }, []);

  const tituloFallbackProp =
    typeof termoTitulo === 'string' && termoTitulo.trim() ? termoTitulo.trim() : DEFAULT_TERMO_TITULO;
  const conteudoFallbackProp =
    typeof termoConteudo === 'string' && termoConteudo.trim() ? termoConteudo.trim() : '';

  const tituloExibicao =
    termoSelecionado?.titulo ?? termoSelecionado?.title ?? tituloFallbackProp;
  
  let conteudoExibicao =
    termoSelecionado?.conteudo ?? termoSelecionado?.content ?? conteudoFallbackProp;

  if (conteudoExibicao) {
    // Interpolação genérica para placeholders de templates
    if (pacienteCtx?.nome) conteudoExibicao = conteudoExibicao.replace(/\[NOME DO PACIENTE\]/gi, pacienteCtx.nome);
    if (pacienteCtx?.cpf) conteudoExibicao = conteudoExibicao.replace(/\[CPF DO PACIENTE\]/gi, pacienteCtx.cpf);
    if (clinicaCtx?.nome) conteudoExibicao = conteudoExibicao.replace(/\[NOME DA CLÍNICA\]/gi, clinicaCtx.nome);
    if (clinicaCtx?.cnpj) conteudoExibicao = conteudoExibicao.replace(/\[CNPJ DA CLÍNICA\]/gi, clinicaCtx.cnpj);
    if (profissionalCtx?.nome) conteudoExibicao = conteudoExibicao.replace(/\[NOME DO PROFISSIONAL\]/gi, profissionalCtx.nome);
  }

  const _temConteudoTexto = String(conteudoExibicao || '').trim().length > 0;

  const termosFiltradosBusca = useMemo(() => {
    const q = termoSearch.trim().toLowerCase();
    if (!q) return termosDisponiveis;
    return termosDisponiveis.filter((t) =>
      String(t.titulo ?? t.title ?? '')
        .toLowerCase()
        .includes(q)
    );
  }, [termosDisponiveis, termoSearch]);

  const toggleTermoPendente = useCallback((termo) => {
    if (!termo) return;
    const id = termo.id != null ? String(termo.id) : null;
    if (!id) return;
    
    setTermosPendentesIds((prev) => {
      if (prev.includes(id)) {
        const novo = prev.filter((pId) => String(pId) !== id);
        if (String(termoSelecionadoId) === id) {
          setTermoSelecionadoId(null);
          setTermoSelecionado(null);
        }
        return novo;
      } else {
        return [...prev, id];
      }
    });
  }, [setTermosPendentesIds, termoSelecionadoId]);

  const abrirTermoParaAssinatura = useCallback(
    (id) => {
      const termo = termosDisponiveis.find((t) => String(t.id) === String(id));
      if (!termo) return;
      if (typeof onTermoChange === 'function') onTermoChange(String(id));
      setTermoSelecionadoId(String(id));
      setTermoSelecionado(termo);
      
      setProfissionalAssinaturaDataUrl('');
      setTermoAssinaturaDataUrl('');
      setProfAssinaturaTimestamp(null);
      setPatAssinaturaTimestamp(null);
      setAssinaturaPersistida(false);
      setBackendAssinaturaId(null);
      
      if (typeof setStep4Errors === 'function') {
        setStep4Errors((prev) => ({ ...prev, lerTermo: false, profissional: false, paciente: false }));
      }
    },
    [onTermoChange, setTermoLido, setProfissionalAssinaturaDataUrl, setTermoAssinaturaDataUrl, setTermoAssinado, setStep4Errors, termosDisponiveis]
  );

  const applyProfissionalSignature = useCallback((dataUrl, { auto = false } = {}) => {
    assinaturaProfRecenteRef.current = dataUrl;
    setProfissionalAssinaturaDataUrl(dataUrl);
    setAutoSignatureApplied(auto);
    setTermoAssinaturaDataUrl('');
    if (typeof setTermoAssinado === 'function') setTermoAssinado(false);
    setStep4Errors((prev) => ({ ...prev, termoLido: false }));
    setProfAssinaturaTimestamp(Date.now());
    setPatAssinaturaTimestamp(null);
  }, [setProfissionalAssinaturaDataUrl, setTermoAssinaturaDataUrl, setTermoAssinado, setStep4Errors]);

  const fetchAssinaturaPadrao = useCallback(async () => {
    const res = await fetch(resolveApiUrl('/api/v1/perfil/assinatura'), {
      credentials: 'include',
      headers: { ...authHeadersForFetch({ needsOrg: false }) },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return null;
    return data?.assinaturaPadrao ?? data?.assinatura_padrao ?? null;
  }, []);

  useEffect(() => {
    if (profissionalAssinaturaDataUrl) return;
    if (!termoSelecionado) return;
    // O preenchimento automático só ocorre se o termo for virtual (LGPD padrão) 
    // ou se a flag autoAssinarProfissional estiver ativada no termo.
    if (!termoSelecionado._virtual && !termoSelecionado.autoAssinarProfissional) return;

    let cancelled = false;
    (async () => {
      try {
        const assinaturaPadrao = await fetchAssinaturaPadrao();
        if (cancelled || !assinaturaPadrao) return;
        applyProfissionalSignature(assinaturaPadrao, { auto: true });
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyProfissionalSignature, fetchAssinaturaPadrao, profissionalAssinaturaDataUrl, termoSelecionado]);

  // Removido useEffect duplicado que forçava auto-assinatura ao abrir modal

  const handleConfirmProf = async (dataUrl) => {
    applyProfissionalSignature(dataUrl, { auto: false });
    setProfSigningOpen(false);
    toast.success('Assinatura do profissional registrada');
    try {
      const assinaturaPadrao = await fetchAssinaturaPadrao();
      if (!assinaturaPadrao) setShowSalvarPadraoPrompt(true);
    } catch {
      // ignore
    }
  };

  const handleConfirmPat = (dataUrl) => {
    setTermoAssinaturaDataUrl(dataUrl);
    if (typeof setTermoAssinado === 'function') setTermoAssinado(true);
    setStep4Errors((prev) => ({ ...prev, termoLido: false }));
    setPatAssinaturaTimestamp(Date.now());
    setPatSigningOpen(false);
    toast.success('Assinatura do paciente registrada');
  };

  const linkUrl = useMemo(() => {
    if (!clinicaCtx?.clinicSlug || !pacienteCtx?.cpf) return '';
    if (!termoSelecionadoId && !backendAssinaturaId) return '';
    const base = window.location.origin;
    const cleanCpf = String(pacienteCtx.cpf).replace(/\D/g, '');
    if (backendAssinaturaId) {
      return `${base}/documento?cpf=${cleanCpf}&clinic=${encodeURIComponent(clinicaCtx.clinicSlug)}&tipo=TERMO_SESSAO&documento_id=${backendAssinaturaId}`;
    } else {
      return `${base}/documento?cpf=${cleanCpf}&clinic=${encodeURIComponent(clinicaCtx.clinicSlug)}&tipo=TERMO&documento_id=${termoSelecionadoId}`;
    }
  }, [termoSelecionadoId, backendAssinaturaId, clinicaCtx?.clinicSlug, pacienteCtx?.cpf]);

  const qrUrl = useMemo(() => {
    if (!linkUrl) return '';
    return `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(linkUrl)}&size=200x200`;
  }, [linkUrl]);

  const handleVerificarAssinaturaRemota = async () => {
    if (!backendAssinaturaId) return;
    try {
      const res = await termoAssinaturaApi.buscar(backendAssinaturaId);
      if (res && res.assinaturaPaciente) {
        setTermoAssinaturaDataUrl(res.assinaturaPaciente);
        setPatAssinaturaTimestamp(res.pacienteAssinouEm ? new Date(res.pacienteAssinouEm).getTime() : Date.now());
        if (typeof setTermoAssinado === 'function') setTermoAssinado(true);
        toast.success('Assinatura do paciente recebida!');
      } else if (res && res.recusado) {
        setPacienteRecusou(true);
        toast.error('O paciente recusou assinar o documento.');
      } else {
        toast.info('Aguardando assinatura. O paciente ainda não assinou.');
      }
    } catch {
      toast.error('Erro ao verificar assinatura remota.');
    }
  };

  const podeExibirAssinaturas = Boolean(termoSelecionadoId);
  const mostrarBuscaDropdown = termosDisponiveis.length > 3;

  const handleAssinarManualmente = () => {
    setAutoSignatureApplied(false);
    setProfissionalAssinaturaDataUrl('');
    setProfAssinaturaTimestamp(null);
    setTermoAssinaturaDataUrl('');
    setPatAssinaturaTimestamp(null);
    if (typeof setTermoAssinado === 'function') setTermoAssinado(false);
    setProfSigningOpen(true);
  };

  const handleSalvarAssinaturaPadrao = async () => {
    if (!assinaturaProfRecenteRef.current) {
      setShowSalvarPadraoPrompt(false);
      return;
    }
    setSavingPadraoPrompt(true);
    try {
      const res = await fetch(resolveApiUrl('/api/v1/perfil/assinatura'), {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...authHeadersForFetch({ needsOrg: false }),
        },
        body: JSON.stringify({ assinaturaPadrao: assinaturaProfRecenteRef.current }),
      });
      const errBody = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(
          errBody?.message || errBody?.detail || errBody?.error || `Erro ao salvar assinatura padrão (${res.status}).`
        );
        return;
      }
      toast.success('Assinatura padrão salva com sucesso.');
      setShowSalvarPadraoPrompt(false);
    } catch {
      toast.error('Falha ao salvar assinatura padrão.');
    } finally {
      setSavingPadraoPrompt(false);
    }
  };

  const handleConcluirClick = () => {
    if (typeof onConcluir !== 'function') return;
    const nenhumAssinado = termosAssinados.length === 0;
    const temPendentes = termosPendentesIds.length > 0;
    if (nenhumAssinado || temPendentes) {
      setShowConcluirConfirm(true);
      return;
    }
    onConcluir();
  };

  const concluirConfirmMessage = (() => {
    const nenhumAssinado = termosAssinados.length === 0;
    const temPendentes = termosPendentesIds.length > 0;
    if (nenhumAssinado && temPendentes) {
      return `Nenhum termo foi assinado. Ainda há ${termosPendentesIds.length} termo(s) aguardando assinatura. Deseja sair mesmo assim?`;
    }
    if (nenhumAssinado) {
      return 'Nenhum termo foi assinado. Deseja sair mesmo assim?';
    }
    return `Ainda há ${termosPendentesIds.length} termo(s) aguardando assinatura. Deseja sair mesmo assim?`;
  })();

  return (
    <div className="min-w-0">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="rounded-2xl border border-emerald-200 bg-[#dcfce7] p-3 text-[#22c55e]">
            <Shield className="h-7 w-7" strokeWidth={2.5} />
          </div>
          <div>
            <h3 className="text-[20px] font-bold text-[#0f172a]">Termos de consentimento</h3>
            <p className="text-[14px] font-medium text-[#64748b]">Leitura e assinaturas (profissional e paciente)</p>
          </div>
        </div>
      </div>

      {termosAssinados.length > 0 && (
        <div className="mb-8 space-y-3">
          <h4 className="text-[14px] font-bold text-[#0f172a]">Termos assinados nesta jornada</h4>
          {termosAssinados.map((t, index) => (
            <div key={index} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                  <Check className="h-4 w-4" strokeWidth={3} />
                </div>
                <div>
                  <p className="text-[14px] font-bold text-emerald-900">{t.termoTitulo || 'Termo de Consentimento'}</p>
                  <p className="text-[12px] text-emerald-700">Assinado e salvo com sucesso.</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    import('../../utils/pdfGenerator.js').then(({ generateTermoPdf }) => {
                      generateTermoPdf({
                        titulo: t.termoTitulo || 'Termo',
                        conteudo: t.resultadoCompleto?.conteudoSnapshot || '',
                        fileName: `termo_assinado_${t.backendAssinaturaId}.pdf`,
                        pacienteCtx: pacienteCtx,
                        clinicaCtx: clinicaCtx,
                        profissionalCtx: profissionalCtx,
                        assinaturaProfissional: t.resultadoCompleto?.assinaturaProfissional,
                        assinaturaPaciente: t.resultadoCompleto?.assinaturaPaciente,
                        metadados: {
                          pacienteNome: pacienteCtx?.nome || t.resultadoCompleto?.pacienteNome,
                          profissionalNome: profissionalCtx?.nome || t.resultadoCompleto?.profissionalNome,
                          dataHora: t.resultadoCompleto?.profissionalAssinouEm ? new Date(t.resultadoCompleto.profissionalAssinouEm).toLocaleString('pt-BR') : undefined,
                          ipAddress: t.resultadoCompleto?.ipAddress,
                        }
                      });
                    });
                  }}
                  className="rounded-lg bg-white px-3 py-1.5 text-[12px] font-bold text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                >
                  Ver PDF
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTermoToCancel(t);
                  }}
                  className="rounded-lg bg-red-50 px-3 py-1.5 text-[12px] font-bold text-red-600 border border-red-200 hover:bg-red-100 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="relative mb-6" ref={termoMenuRef}>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[#94a3b8]">
          {termosAssinados.length > 0 ? 'Adicionar outro termo' : 'Selecionar termo de consentimento'}
        </p>
        {termosLoading ? (
          <div className="flex h-12 items-center gap-2 rounded-xl border border-[#e2e8f0] bg-white px-4 text-[13px] text-[#64748b]">
            Carregando termos…
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setTermoMenuOpen((o) => !o)}
              className={`flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3.5 transition-all duration-150 ${
                termoMenuOpen
                  ? 'border-[#00a88e] bg-[#f0fdfa] ring-2 ring-[#00a88e]/20'
                  : termoSelecionado
                    ? 'border-[#00a88e] bg-[#f0fdfa]'
                    : 'border-[#e2e8f0] bg-white hover:border-[#00a88e]/40 hover:bg-[#f8fafc]'
              }`}
            >
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                  termoSelecionado ? 'bg-[#00a88e]' : 'bg-[#f1f5f9]'
                }`}
              >
                <FileText
                  className={`h-4 w-4 ${termoSelecionado ? 'text-white' : 'text-[#94a3b8]'}`}
                  strokeWidth={2}
                  aria-hidden
                />
              </div>
              <div className="min-w-0 flex-1 text-left">
                {termosPendentesIds.length > 0 ? (
                  <>
                    <p className="text-[14px] font-semibold text-[#0f172a]">
                      {termosPendentesIds.length} termo(s) selecionado(s)
                    </p>
                    <p className="mt-0.5 text-[12px] text-[#64748b]">
                      Clique para adicionar ou remover termos
                    </p>
                  </>
                ) : (
                  <p className="text-[14px] text-[#94a3b8]">Selecione os termos...</p>
                )}
              </div>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-[#94a3b8] transition-transform duration-150 ${termoMenuOpen ? 'rotate-180' : ''}`}
                strokeWidth={2}
                aria-hidden
              />
            </button>

            {termoMenuOpen && termosDisponiveis.length > 0 ? (
              <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-[#e2e8f0] bg-white shadow-xl animate-in fade-in slide-in-from-top-2 duration-150">
                {mostrarBuscaDropdown ? (
                  <div className="border-b border-[#f1f5f9] px-3 pb-2 pt-3">
                    <div className="relative">
                      <Search
                        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]"
                        strokeWidth={2}
                        aria-hidden
                      />
                      <input
                        ref={termoSearchInputRef}
                        type="search"
                        placeholder="Buscar termo..."
                        value={termoSearch}
                        onChange={(e) => setTermoSearch(e.target.value)}
                        className="h-9 w-full rounded-lg border border-[#e2e8f0] py-2 pl-9 pr-3 text-[13px] outline-none focus:border-[#00a88e] focus:ring-2 focus:ring-[#00a88e]/10"
                      />
                    </div>
                  </div>
                ) : null}
                <div className="max-h-[240px] overflow-y-auto [-webkit-overflow-scrolling:touch]">
                  {termosFiltradosBusca.length === 0 ? (
                    <div className="px-4 py-6 text-center text-[13px] text-[#94a3b8]">Nenhum termo encontrado</div>
                  ) : (
                    termosFiltradosBusca.map((t) => {
                      const sel = termosPendentesIds.includes(String(t.id));
                      const preview = String(t.conteudo ?? t.content ?? '')
                        .replace(/\s+/g, ' ')
                        .trim()
                        .slice(0, 96);
                      return (
                        <button
                          key={String(t.id)}
                          type="button"
                          onClick={(e) => { e.stopPropagation(); toggleTermoPendente(t); }}
                          className="flex w-full items-start gap-3 border-b border-[#f8fafc] px-3 py-2.5 text-left last:border-0 hover:bg-[#f8fafc]"
                        >
                          <div className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${sel ? 'border-[#00a88e] bg-[#00a88e]' : 'border-[#cbd5e1] bg-white'}`}>
                            {sel && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[14px] font-semibold text-[#0f172a]">{t.titulo ?? t.title ?? '—'}</p>
                            <p className="mt-0.5 line-clamp-1 text-[12px] text-[#64748b]">{preview || '—'}</p>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>

      {/* Lista de Termos Pendentes */}
      {termosPendentesIds.length > 0 && (
        <div className="mb-6 space-y-3">
          <h4 className="text-[14px] font-bold text-[#0f172a]">Termos aguardando assinatura</h4>
          {termosPendentesIds.map((pId) => {
            const t = termosDisponiveis.find((item) => String(item.id) === String(pId));
            if (!t) return null;
            const isOpen = String(termoSelecionadoId) === String(pId);
            return (
              <div key={pId} className={`rounded-xl border ${isOpen ? 'border-[#00a88e] ring-2 ring-[#00a88e]/20' : 'border-[#e2e8f0]'} bg-white px-4 py-3 shadow-sm transition-all`}>
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[14px] font-bold text-[#0f172a] truncate">{t.titulo ?? t.title ?? '—'}</p>
                    <p className="text-[12px] text-[#64748b]">Aguardando leitura e assinatura</p>
                  </div>
                  <div className="shrink-0">
                    {!isOpen && (
                      <button
                        type="button"
                        onClick={() => abrirTermoParaAssinatura(pId)}
                        className="rounded-lg bg-[#f1f5f9] px-3 py-1.5 text-[12px] font-bold text-[#0f172a] hover:bg-[#e2e8f0]"
                      >
                        Ler e Assinar
                      </button>
                    )}
                    {isOpen && (
                      <span className="rounded bg-[#00a88e]/10 px-2 py-1 text-[11px] font-bold text-[#00a88e]">Aberto abaixo</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!termosLoading && termosDisponiveis.length === 0 ? (
        <div className="mb-6 rounded-xl border border-[#fde68a] bg-[#fffbeb] px-4 py-4 text-[13px] font-medium text-[#92400e]">
          Nenhum termo cadastrado. Crie termos em Configurações → Clínica → Termos
        </div>
      ) : null}

      {/* Banner informativo quando o Termo LGPD virtual está ativo */}
      {!termosLoading && termosDisponiveis.length > 0 && termosDisponiveis[0]?._virtual ? (
        <div className="mb-6 flex gap-3 rounded-xl border border-[#bfdbfe] bg-[#eff6ff] px-4 py-3 text-[13px] text-[#1e40af]">
          <Shield className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
          <span>
            Usando o <strong>Termo LGPD padrão do Procedi</strong>. Para criar um termo personalizado da sua clínica,
            acesse <strong>Configurações → Clínica → Termos</strong>.
          </span>
        </div>
      ) : null}

      {!termosLoading && termosDisponiveis.length > 0 && termoSelecionadoId ? (
        <>
          <div className="mb-3 flex items-center justify-end">
            <button
              type="button"
              onClick={() => {
                import('../../utils/pdfGenerator.js').then(({ generateTermoPdf }) => {
                  generateTermoPdf({
                    titulo: tituloExibicao,
                    conteudo: conteudoExibicao,
                    fileName: `termo_em_branco_${new Date().getTime()}.pdf`,
                    pacienteCtx,
                    clinicaCtx,
                    profissionalCtx
                  });
                });
              }}
              className="flex items-center gap-1.5 rounded-lg border border-[#e2e8f0] bg-white px-2.5 py-1.5 text-[12px] font-semibold text-[#0f172a] shadow-sm hover:bg-[#f8fafc] transition-colors"
            >
              Exportar PDF em branco
            </button>
          </div>
          <div className="mb-8">
            <TermoVisualizacao
              titulo={tituloExibicao}
              conteudo={conteudoExibicao}
              pacienteCtx={pacienteCtx}
              clinicaCtx={clinicaCtx}
              profissionalCtx={profissionalCtx}
            >
              {podeExibirAssinaturas ? (
                <div className="space-y-6">
                  <div className="rounded-xl border border-[#e2e8f0] bg-white p-5 shadow-sm">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                      <h4 className="text-[15px] font-bold text-[#0f172a]">1. Assinatura do Profissional</h4>
                      {profissionalAssinaturaDataUrl ? (
                        <span className="rounded-md bg-emerald-600 px-2 py-0.5 text-[11px] font-bold text-white">✓ Assinado</span>
                      ) : (
                        <span className="rounded-md bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                          Obrigatório
                        </span>
                      )}
                    </div>
                    {profissionalAssinaturaDataUrl ? (
                      <div className="flex flex-col items-stretch gap-2">
                        <img
                          src={profissionalAssinaturaDataUrl}
                          alt="Assinatura do profissional"
                          className="mx-auto h-20 max-w-full rounded-lg border border-[#e2e8f0] bg-[#f8fafc] object-contain"
                        />
                        <div className="flex items-center gap-1.5 text-[12px] text-[#64748b]">
                          <Calendar className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
                          <span>Assinado em {formatTimestamp(profAssinaturaTimestamp)}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setAssinaturaPersistida(false);
                            setProfissionalAssinaturaDataUrl('');
                            setAutoSignatureApplied(false);
                            setProfAssinaturaTimestamp(null);
                            setTermoAssinaturaDataUrl('');
                            setPatAssinaturaTimestamp(null);
                            if (typeof setTermoAssinado === 'function') setTermoAssinado(false);
                            setProfSigningOpen(true);
                          }}
                          className="self-start text-[12px] font-medium text-[#64748b] hover:text-[#475569]"
                        >
                          Refazer assinatura
                        </button>
                        {autoSignatureApplied ? (
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                              Assinatura automática aplicada
                            </span>
                            <button
                              type="button"
                              onClick={handleAssinarManualmente}
                              className="text-[12px] font-medium text-[#00a88e] hover:text-[#0f766e]"
                            >
                              Assinar manualmente
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-4 py-6 text-center">
                        <PenLine className="h-12 w-12 text-[#94a3b8]" strokeWidth={1.75} aria-hidden />
                        <p className="text-[13px] font-medium text-[#64748b]">Clique para assinar digitalmente</p>
                        <button
                          type="button"
                          onClick={() => setProfSigningOpen(true)}
                          className="rounded-lg bg-[#00a88e] px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#00967f]"
                        >
                          Assinar como Profissional
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="relative min-h-[220px] overflow-hidden rounded-xl border border-[#e2e8f0] bg-white p-5 shadow-sm">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                      <h4 className="text-[15px] font-bold text-[#0f172a]">2. Assinatura do Paciente</h4>
                      <div className="flex items-center gap-2">
                        {assinaturaPersistida && (
                          <button
                            type="button"
                            onClick={() => {
                              import('../../utils/pdfGenerator.js').then(({ generateTermoPdf }) => {
                                generateTermoPdf({
                                  titulo: tituloExibicao,
                                  conteudo: conteudoExibicao,
                                  assinaturaPaciente: termoAssinaturaDataUrl,
                                  assinaturaProfissional: profissionalAssinaturaDataUrl,
                                  metadados: {
                                    pacienteNome: pacienteCtx?.nome,
                                    profissionalNome: profissionalCtx?.nome,
                                    dataHora: new Date().toLocaleString('pt-BR'),
                                  },
                                  fileName: `termo_assinado_${new Date().getTime()}.pdf`
                                });
                              });
                            }}
                            className="flex items-center gap-1.5 rounded-lg bg-[#0f172a] px-3 py-1 text-[11px] font-bold text-white shadow-sm hover:bg-[#1e293b] transition-colors"
                          >
                            Baixar Termo Assinado
                          </button>
                        )}
                        {termoAssinaturaDataUrl && profissionalAssinaturaDataUrl ? (
                          <span className="rounded-md bg-emerald-600 px-2 py-0.5 text-[11px] font-bold text-white">✓ Assinado</span>
                        ) : (
                          <span className="rounded-md bg-[#64748b] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                            Após profissional
                          </span>
                        )}
                      </div>
                    </div>

                    {!profissionalAssinaturaDataUrl ? (
                      <div className="relative flex min-h-[180px] flex-col items-center justify-center rounded-lg bg-[#f8fafc]">
                        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-lg bg-slate-500/85 px-4 text-center">
                          <Lock className="h-10 w-10 text-white" strokeWidth={2} aria-hidden />
                          <p className="text-[13px] font-semibold text-white">Aguardando assinatura do profissional</p>
                          <button
                            type="button"
                            disabled
                            className="cursor-not-allowed rounded-lg bg-[#00a88e] px-4 py-2.5 text-[13px] font-semibold text-white opacity-50"
                          >
                            Assinar como Paciente
                          </button>
                        </div>
                      </div>
                    ) : termoAssinaturaDataUrl ? (
                      <div className="flex flex-col items-stretch gap-2">
                        <img
                          src={termoAssinaturaDataUrl}
                          alt="Assinatura do paciente"
                          className="mx-auto h-20 max-w-full rounded-lg border border-[#e2e8f0] bg-[#f8fafc] object-contain"
                        />
                        <div className="flex items-center gap-1.5 text-[12px] text-[#64748b]">
                          <Calendar className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
                          <span>Assinado em {formatTimestamp(patAssinaturaTimestamp)}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setAssinaturaPersistida(false);
                            setTermoAssinaturaDataUrl('');
                            setPatAssinaturaTimestamp(null);
                            if (typeof setTermoAssinado === 'function') setTermoAssinado(false);
                            setPatSigningOpen(true);
                          }}
                          className="self-start text-[12px] font-medium text-[#64748b] hover:text-[#475569]"
                        >
                          Refazer assinatura
                        </button>
                      </div>
                    ) : pacienteRecusou ? (
                      <div className="flex flex-col items-center gap-3 py-5 text-center border-2 border-dashed border-red-300 rounded-xl bg-red-50">
                        <AlertTriangle className="h-10 w-10 text-red-500" strokeWidth={1.5} />
                        <p className="text-[13px] font-bold text-red-700">O paciente recusou assinar o documento.</p>
                        <p className="text-[12px] text-red-600 max-w-[300px]">
                          Como o consentimento não foi concedido, o procedimento não poderá ser realizado.
                        </p>
                        <button
                          type="button"
                          onClick={() => setPacienteRecusou(false)}
                          className="mt-2 rounded-lg bg-white border border-red-300 px-4 py-2 text-[11px] font-bold text-red-700 transition-colors hover:bg-red-50 shadow-sm"
                        >
                          Mudar de ideia (Assinar)
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-4 py-6 text-center">
                        <PenLine className="h-12 w-12 text-[#94a3b8]" strokeWidth={1.75} aria-hidden />
                        <p className="text-[13px] font-medium text-[#64748b]">Disponibilize o dispositivo para o paciente</p>
                        <div className="flex flex-col sm:flex-row gap-3">
                          <button
                            type="button"
                            onClick={() => setPatSigningOpen(true)}
                            className="rounded-lg bg-[#0f172a] px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#1e293b]"
                          >
                            Assinar no dispositivo
                          </button>
                          
                          {linkUrl && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  const msg = `Olá! Acesse o link abaixo para assinar o documento da clínica:\n${linkUrl}`;
                                  const phone = pacienteCtx?.telefone?.replace(/\D/g, '') || '';
                                  window.open(`https://wa.me/${phone ? `55${phone}` : ''}?text=${encodeURIComponent(msg)}`, '_blank');
                                }}
                                className="flex items-center gap-2 rounded-lg bg-[#25D366] px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#1ebd5b]"
                              >
                                <MessageCircle className="h-4 w-4" />
                                WhatsApp
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const subject = 'Assinatura de Documento';
                                  const body = `Olá!\n\nAcesse o link abaixo para assinar seu documento:\n${linkUrl}`;
                                  const email = pacienteCtx?.email || '';
                                  window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                                }}
                                className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-[13px] font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                              >
                                <Mail className="h-4 w-4" />
                                Email
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (navigator.clipboard) {
                                    navigator.clipboard.writeText(linkUrl);
                                    toast.success('Link copiado!');
                                  }
                                }}
                                className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-[13px] font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                              >
                                <Link2 className="h-4 w-4" />
                                Copiar Link
                              </button>
                              <button
                                type="button"
                                onClick={() => setShowQr(!showQr)}
                                className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-[13px] font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                              >
                                <QrCode className="h-4 w-4" />
                                {showQr ? 'Ocultar QR Code' : 'Mostrar QR Code'}
                              </button>
                            </>
                          )}

                          <button
                            type="button"
                            onClick={() => setPacienteRecusou(true)}
                            className="rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-[13px] font-semibold text-red-700 transition-colors hover:bg-red-100"
                          >
                            Recusar a assinar
                          </button>
                        </div>
                        {showQr && linkUrl && qrUrl ? (
                          <div className="flex w-full max-w-xs flex-col items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
                            <img
                              src={qrUrl}
                              alt="QR Code do link"
                              width={200}
                              height={200}
                              className="rounded-lg"
                            />
                            <p className="text-center text-[11px] text-slate-400">
                              O paciente pode escanear este QR Code para acessar o documento
                            </p>
                          </div>
                        ) : null}
                        {linkUrl && backendAssinaturaId && (
                          <div className="mt-2 text-center">
                            <button
                              type="button"
                              onClick={handleVerificarAssinaturaRemota}
                              className="text-[13px] font-bold text-[#00a88e] hover:text-[#00967f] underline"
                            >
                              Atualizar status (Verificar assinatura remota)
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </TermoVisualizacao>
          </div>
        </>
      ) : null}

      <SignatureFullscreenModal
        open={profSigningOpen}
        title="Assinatura do Profissional"
        onClose={() => setProfSigningOpen(false)}
        canvasRef={profCanvasRef}
        hasStrokeRef={profHasStrokeRef}
        mobilePortrait={mobilePortrait}
        onConfirm={handleConfirmProf}
      />
      <SignatureFullscreenModal
        open={patSigningOpen}
        title="Assinatura do Paciente"
        onClose={() => setPatSigningOpen(false)}
        canvasRef={patCanvasRef}
        hasStrokeRef={patHasStrokeRef}
        mobilePortrait={mobilePortrait}
        onConfirm={handleConfirmPat}
      />
      {showSalvarPadraoPrompt ? (
        <div className="fixed inset-0 z-[320] flex items-center justify-center bg-slate-900/45 px-4">
          <div className="w-full max-w-md rounded-xl border border-[#e2e8f0] bg-white p-5 shadow-2xl">
            <h4 className="text-[16px] font-bold text-[#0f172a]">Assinatura detectada!</h4>
            <p className="mt-2 text-[14px] text-[#475569]">
              Deseja salvar esta assinatura para agilizar os próximos atendimentos?
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={handleSalvarAssinaturaPadrao}
                disabled={savingPadraoPrompt}
                className="h-10 flex-1 rounded-lg bg-[#00a88e] px-3 text-[13px] font-semibold text-white hover:bg-[#00967f] disabled:cursor-not-allowed disabled:bg-[#e2e8f0] disabled:text-[#94a3b8]"
              >
                {savingPadraoPrompt ? 'Salvando…' : 'Sim, salvar'}
              </button>
              <button
                type="button"
                onClick={() => setShowSalvarPadraoPrompt(false)}
                disabled={savingPadraoPrompt}
                className="h-10 flex-1 rounded-lg border border-[#e2e8f0] bg-white px-3 text-[13px] font-semibold text-[#64748b] hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Agora não
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Popup de Próximo Termo */}
      {pendingNextTermoId ? (
        <div className="fixed inset-0 z-[320] flex items-center justify-center bg-slate-900/45 px-4">
          <div className="w-full max-w-md rounded-xl border border-[#e2e8f0] bg-white p-5 shadow-2xl">
            <h4 className="text-[16px] font-bold text-[#0f172a]">Termo salvo com sucesso!</h4>
            <p className="mt-2 text-[14px] text-[#475569]">
              Ainda há {termosPendentesIds.length} termo(s) aguardando assinatura. Deseja abrir o próximo agora?
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  abrirTermoParaAssinatura(pendingNextTermoId);
                  setPendingNextTermoId(null);
                }}
                className="h-10 flex-1 rounded-lg bg-[#00a88e] px-3 text-[13px] font-semibold text-white hover:bg-[#00967f]"
              >
                Sim, abrir próximo
              </button>
              <button
                type="button"
                onClick={() => setPendingNextTermoId(null)}
                className="h-10 flex-1 rounded-lg border border-[#e2e8f0] bg-white px-3 text-[13px] font-semibold text-[#64748b] hover:bg-[#f8fafc]"
              >
                Deixar para depois
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Popup de Cancelar Assinatura */}
      {termoToCancel ? (
        <div className="fixed inset-0 z-[320] flex items-center justify-center bg-slate-900/45 px-4">
          <div className="w-full max-w-md rounded-xl border border-[#e2e8f0] bg-white p-5 shadow-2xl">
            <h4 className="text-[16px] font-bold text-[#0f172a]">Cancelar Assinatura</h4>
            <p className="mt-2 text-[14px] text-[#475569]">
              Deseja realmente cancelar a assinatura deste documento? O termo <strong>{termoToCancel.termoTitulo || 'Termo de Consentimento'}</strong> voltará para a fila de pendentes.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setTermosAssinados(prev => prev.filter(item => item.backendAssinaturaId !== termoToCancel.backendAssinaturaId));
                  if (termoToCancel.termoId) {
                    setTermosPendentesIds(prev => {
                      if (!prev.includes(String(termoToCancel.termoId))) return [...prev, String(termoToCancel.termoId)];
                      return prev;
                    });
                  }
                  if (typeof setTermoAssinado === 'function' && termosAssinados.length <= 1) {
                     setTermoAssinado(false);
                  }
                  setTermoToCancel(null);
                }}
                className="h-10 flex-1 rounded-lg bg-red-600 px-3 text-[13px] font-semibold text-white hover:bg-red-700"
              >
                Sim, cancelar
              </button>
              <button
                type="button"
                onClick={() => setTermoToCancel(null)}
                className="h-10 flex-1 rounded-lg border border-[#e2e8f0] bg-white px-3 text-[13px] font-semibold text-[#64748b] hover:bg-[#f8fafc]"
              >
                Voltar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showConcluirConfirm ? (
        <div className="fixed inset-0 z-[320] flex items-center justify-center bg-slate-900/45 px-4">
          <div className="w-full max-w-md rounded-xl border border-[#e2e8f0] bg-white p-5 shadow-2xl">
            <h4 className="text-[16px] font-bold text-[#0f172a]">Sair sem assinar?</h4>
            <p className="mt-2 text-[14px] text-[#475569]">{concluirConfirmMessage}</p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setShowConcluirConfirm(false)}
                className="h-10 flex-1 rounded-lg border border-[#e2e8f0] bg-white px-3 text-[13px] font-semibold text-[#64748b] hover:bg-[#f8fafc]"
              >
                Continuar assinando
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowConcluirConfirm(false);
                  onConcluir();
                }}
                className="h-10 flex-1 rounded-lg bg-[#00a88e] px-3 text-[13px] font-semibold text-white hover:bg-[#00967f]"
              >
                Sim, sair
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {typeof onConcluir === 'function' ? (
        <div className="mt-6 flex justify-end border-t border-[#e2e8f0] pt-5">
          <button
            type="button"
            onClick={handleConcluirClick}
            className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-[#00a88e] px-6 py-3 text-[14px] font-semibold text-white shadow-sm transition-colors hover:bg-[#00967f]"
          >
            Concluir Termos
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function Step4Procedimento({
  pacienteIdForProcedures: _pacienteIdForProcedures = null,
  nomeProcedimento = '',
  setNomeProcedimento = () => {},
  setNomeProcedimentoCatalogoId = () => {},
  observacoesExecucao = '',
  setObservacoesExecucao = () => {},
  procedureCapturedPhotos = [],
  procedurePhotoMax = 30,
  onProcedureUploadFiles,
  onProcedureRemovePhoto,
  step4Errors = {},
  setStep4Errors = () => {},
  fotosAvaliacao = [],
  onProcedureFotoCategoriaSync = () => {},
  onProcedureAnnotatePhoto,
  mapaState = null,
  roleUserId = null,
  procedimentoFeitoId = null,
  catalogoId = null,
  planejamentoItemId = null,
  planejamentoId = null,
  procedimentosComPontos = [],
  sidebarInsetPx = 0,
  pendingMapaCapture = null,
  onMapaCaptureConsumed = () => {},
  onPrepareMapaCapture = () => {},
  onEnsureProcedimento = () => Promise.resolve(null),
}) {
  const uploadInputRef = React.useRef(null);
  const { options: catalogoOptions } = useProcedimentosOptions();
  /** Legenda por foto; chave = `ph.url` (estável ao remover; índice não é). */
  const [legendas, setLegendas] = React.useState({});
  const [fotoCategoria, setFotoCategoria] = React.useState(GALERIA_CATEGORIA.ANTES);
  /** Lightbox somente leitura para fotos da avaliação (referência). */
  const [referencePreviewUrl, setReferencePreviewUrl] = React.useState(null);

  React.useEffect(() => {
    onProcedureFotoCategoriaSync(fotoCategoria);
  }, [fotoCategoria, onProcedureFotoCategoriaSync]);

  React.useEffect(() => {
    if (!referencePreviewUrl) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setReferencePreviewUrl(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [referencePreviewUrl]);

  React.useEffect(() => {
    const urls = new Set((procedureCapturedPhotos || []).map((p) => p.url).filter(Boolean));
    setLegendas((prev) => {
      const next = { ...prev };
      let changed = false;
      Object.keys(next).forEach((u) => {
        if (!urls.has(u)) {
          delete next[u];
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [procedureCapturedPhotos]);


  const handleImageUpload = (event) => {
    const files = Array.from(event.target.files || []).filter((f) => String(f.type || '').startsWith('image/'));
    event.target.value = '';
    if (!files.length) return;
    onProcedureUploadFiles?.(files, fotoCategoria);
  };

  const photos = procedureCapturedPhotos || [];

  return (
    <div className="min-w-0">
      <div className="mb-6 flex items-center gap-4">
        <div className="rounded-2xl border border-app-border bg-[#e6f7f5] p-3 text-[#00a88e]">
          <Stethoscope className="h-7 w-7" strokeWidth={2.5} />
        </div>
        <div>
          <h3 className="text-[20px] font-bold text-[#0f172a]">Procedimento</h3>
          <p className="text-[14px] font-medium text-[#64748b]">Registro do que foi realizado e imagens</p>
        </div>
      </div>

      <div
        className={`mb-6 space-y-5 rounded-2xl border bg-white p-4 sm:p-6 ${
          step4Errors.nomeProcedimento || step4Errors.observacoesExecucao ? 'border-red-300' : 'border-[#00a88e]/25'
        }`}
      >
        <div className="space-y-1.5">
          <label className="text-[13px] font-bold text-[#00a88e]">
            Nome do procedimento <span className="text-red-500">*</span>
          </label>
          <ProcedimentoAutocomplete
            value={nomeProcedimento}
            onInputChange={(nome) => {
              setNomeProcedimento(nome);
              setNomeProcedimentoCatalogoId(null);
              setStep4Errors((prev) => ({ ...prev, nomeProcedimento: false }));
            }}
            onCommit={(nome, catalogoId) => {
              setNomeProcedimento(nome);
              setNomeProcedimentoCatalogoId(catalogoId);
              setStep4Errors((prev) => ({ ...prev, nomeProcedimento: false }));
            }}
            placeholder="Nome do procedimento realizado"
            catalogoOptions={catalogoOptions}
            error={Boolean(step4Errors.nomeProcedimento)}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[13px] font-bold text-[#00a88e]">
            Descrição detalhada do que foi realizado <span className="text-red-500">*</span>
          </label>
          <textarea
            value={observacoesExecucao}
            onChange={(e) => {
              setObservacoesExecucao(e.target.value);
              setStep4Errors((prev) => ({ ...prev, observacoesExecucao: false }));
            }}
            placeholder="Ex: Aplicação de 20U de toxina botulínica na glabela, 10U nas linhas frontais. Produto: Dysport lote #XXXX. Paciente tolerou bem..."
            rows={5}
            className={`w-full resize-none rounded-xl border-[2px] px-4 py-3 text-[16px] outline-none focus:border-[#00a88e] sm:text-[14px] ${
              step4Errors.observacoesExecucao ? 'border-red-400 bg-red-50' : 'border-[#e2e8f0]'
            }`}
          />
        </div>
      </div>

      {mapaState ? (
        <MapaAplicacaoPanel
          mapaState={mapaState}
          pacienteId={_pacienteIdForProcedures}
          roleUserId={roleUserId}
          procedimentoFeitoId={procedimentoFeitoId}
          catalogoId={catalogoId}
          nomeProcedimento={nomeProcedimento}
          planejamentoItemId={planejamentoItemId}
          planejamentoId={planejamentoId}
          procedimentosComPontos={procedimentosComPontos}
          sidebarInsetPx={sidebarInsetPx}
          pendingCapture={pendingMapaCapture}
          onCaptureConsumed={onMapaCaptureConsumed}
          onPrepareCapture={onPrepareMapaCapture}
          onEnsureProcedimento={onEnsureProcedimento}
          disabled={!String(nomeProcedimento || '').trim() || !catalogoId}
          disabledHint="Selecione o procedimento na lista do catálogo (autocomplete) para habilitar o mapa de aplicação."
        />
      ) : null}

      {fotosAvaliacao.length > 0 && (
        <div className="mb-4">
          <div className="mb-2 flex items-center gap-2">
            <Eye className="h-4 w-4 text-[#64748b]" strokeWidth={2} />
            <span className="text-[12px] font-semibold uppercase tracking-wide text-[#64748b]">
              Avaliação — apenas referência
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 opacity-70">
            {fotosAvaliacao.slice(0, 3).map((foto, idx) => (
              <button
                key={foto.url ? `${foto.url}_${idx}` : idx}
                type="button"
                onClick={() => foto.url && setReferencePreviewUrl(foto.url)}
                title="Ampliar (somente visualização)"
                className="group relative aspect-square w-full cursor-zoom-in overflow-hidden rounded-xl border-2 border-dashed border-[#e2e8f0] p-0 text-left outline-none transition-opacity hover:opacity-100 focus-visible:ring-2 focus-visible:ring-[#00a88e] focus-visible:ring-offset-2"
              >
                <img src={foto.url} alt="" className="h-full w-full object-cover" />
                <div className="pointer-events-none absolute inset-0 bg-black/10 transition-colors group-hover:bg-black/5" />
                <span className="pointer-events-none absolute bottom-1 left-1 rounded bg-black/50 px-1 text-[9px] font-bold text-white">
                  Ref.{idx + 1}
                </span>
                <span className="pointer-events-none absolute right-1 top-1 rounded bg-black/45 px-1.5 py-0.5 text-[8px] font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100 sm:text-[9px]">
                  Ver
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mb-3 flex items-center gap-3">
        <span className="text-[13px] font-semibold text-[#64748b]">Categoria das fotos:</span>
        <div className="flex flex-wrap gap-2">
          {STEP4_FOTO_CATEGORIAS.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setFotoCategoria(cat)}
              className={`rounded-xl border-2 px-4 py-2 text-[13px] font-semibold transition-colors ${
                fotoCategoria === cat
                  ? 'border-[#00a88e] bg-[#e6f7f5] text-[#00a88e]'
                  : 'border-[#e2e8f0] bg-white text-[#64748b] hover:border-[#00a88e]/40'
              }`}
            >
              {GALERIA_CATEGORIA_LABELS[cat]}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-2 flex items-center justify-between gap-2">
        <h4 className="text-[13px] font-bold text-[#00a88e]">Fotos do procedimento</h4>
        <span className="text-[12px] font-semibold text-[#64748b]">
          {photos.length}/{procedurePhotoMax}
        </span>
      </div>

      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleImageUpload}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {photos.map((ph, idx) => (
          <div key={`${ph.url}_${idx}`} className="min-w-0">
            <div className="group relative aspect-square overflow-hidden rounded-xl bg-[#f1f5f9]">
              <div
                className={`absolute left-1 top-1 z-10 rounded px-1.5 py-0.5 text-[10px] font-bold text-white ${
                  STEP4_FOTO_OVERLAY_BADGE[ph.meta?.categoria] || STEP4_FOTO_OVERLAY_BADGE[GALERIA_CATEGORIA.ANTES]
                }`}
              >
                {GALERIA_CATEGORIA_LABELS[ph.meta?.categoria] || GALERIA_CATEGORIA_LABELS.antes}
              </div>
              <img src={ph.url} alt="" className="h-full w-full object-cover" />
              {typeof onProcedureAnnotatePhoto === 'function' ? (
                <button
                  type="button"
                  onClick={() => onProcedureAnnotatePhoto(idx)}
                  className="absolute inset-0 z-[1] flex items-center justify-center bg-black/35 opacity-100 transition-all sm:bg-black/0 sm:opacity-0 sm:group-hover:bg-black/45 sm:group-hover:opacity-100"
                >
                  <span className="rounded-lg bg-white px-3 py-2 text-[12px] font-bold text-[#0f172a] shadow sm:py-1.5">
                    Anotar
                  </span>
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => onProcedureRemovePhoto?.(idx)}
                className="absolute right-1 top-1 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-[#dc2626] text-white shadow-md active:bg-[#b91c1c] sm:h-7 sm:w-7 sm:hover:bg-[#b91c1c]"
                aria-label="Remover imagem"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={2.5} />
              </button>
            </div>
            <input
              type="text"
              value={legendas[ph.url] ?? ''}
              onChange={(e) =>
                setLegendas((prev) => ({ ...prev, [ph.url]: e.target.value }))
              }
              placeholder="Ex: Antes, Depois, Detalhe..."
              className="mt-1 w-full rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-2 py-1 text-[11px] text-[#0f172a] outline-none placeholder:text-[#cbd5e1] focus:border-[#00a88e]"
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() => uploadInputRef.current?.click()}
          className="col-span-2 flex min-h-[120px] flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-[#cbd5e1] bg-[#fafafa] px-4 py-2 text-[#64748b] transition-colors active:border-[#00a88e]/50 active:bg-[#f0fdf9] active:text-[#00a88e] sm:col-span-1 sm:aspect-square sm:min-h-0 sm:hover:border-[#00a88e]/50 sm:hover:bg-[#f0fdf9] sm:hover:text-[#00a88e]"
        >
          <Camera className="h-6 w-6" strokeWidth={2} />
          <span className="px-1 text-center text-[11px] font-semibold leading-tight">Upload de imagens</span>
        </button>
      </div>

      {photos.length === 0 ? (
        <p className="mt-3 flex items-center gap-2 text-[12px] font-medium text-[#94a3b8]">
          <ImageIcon className="h-4 w-4 shrink-0" />
          A câmera flutuante da jornada também adiciona fotos aqui.
        </p>
      ) : null}

      {referencePreviewUrl ? (
        <div
          className="fixed inset-0 z-[145] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setReferencePreviewUrl(null)}
          role="presentation"
        >
          <img
            src={referencePreviewUrl}
            alt=""
            className="max-h-[90dvh] max-w-full rounded-xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            onClick={() => setReferencePreviewUrl(null)}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-lg font-bold text-white transition-colors hover:bg-white/30"
            aria-label="Fechar"
          >
            ×
          </button>
          <p className="pointer-events-none absolute bottom-6 left-0 right-0 text-center text-[12px] font-medium text-white/80">
            Referência da avaliação — somente visualização
          </p>
        </div>
      ) : null}
    </div>
  );
}
