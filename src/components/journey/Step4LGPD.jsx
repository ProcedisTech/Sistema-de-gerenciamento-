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
  Search,
  Calendar,
  Eye,
} from 'lucide-react';
import { procedimentosApi, termoAssinaturaApi, termosApi } from '../../services/api';
import { useToast } from '../../contexts/useToast.js';

const DEFAULT_TERMO_TITULO = 'TERMO DE CONSENTIMENTO';

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
function SignatureFullscreenModal({
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
  termoLido,
  setTermoLido,
  termoAssinaturaDataUrl,
  setTermoAssinaturaDataUrl,
  setTermoAssinado,
  profissionalAssinaturaDataUrl,
  setProfissionalAssinaturaDataUrl,
  step4Errors = {},
  setStep4Errors = () => {},
  termoTitulo,
  termoConteudo,
  onTermoChange,
  onAssinaturaSalva,
  pacienteId = null,
  procedimentoFeitoId = null,
  roleUserId = null,
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

  useEffect(() => {
    setAssinaturaPersistida(false);
  }, [termoSelecionadoId]);

  useEffect(() => {
    if (
      !profissionalAssinaturaDataUrl ||
      !termoAssinaturaDataUrl ||
      !termoSelecionadoId ||
      !pacienteId ||
      assinaturaPersistida
    ) {
      return;
    }

    const salvar = async () => {
      try {
        setAssinaturaPersistida(true);
        const resultado = await termoAssinaturaApi.criar({
          termoId: termoSelecionadoId,
          pacienteId,
          procedimentoFeitoId: procedimentoFeitoId ?? null,
          roleUserId: roleUserId ?? null,
          assinaturaProfissional: profissionalAssinaturaDataUrl,
          assinaturaPaciente: termoAssinaturaDataUrl,
          profissionalAssinouEm:
            profAssinaturaTimestamp != null
              ? new Date(profAssinaturaTimestamp).toISOString()
              : new Date().toISOString(),
          pacienteAssinouEm:
            patAssinaturaTimestamp != null
              ? new Date(patAssinaturaTimestamp).toISOString()
              : new Date().toISOString(),
        });
        toast.success('Termo assinado e salvo com sucesso.');
        onAssinaturaSalva?.(resultado);
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
        setTermosDisponiveis(list.filter((t) => t.ativo !== false));
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
  const conteudoExibicao =
    termoSelecionado?.conteudo ?? termoSelecionado?.content ?? conteudoFallbackProp;
  const temConteudoTexto = String(conteudoExibicao || '').trim().length > 0;

  const termosFiltradosBusca = useMemo(() => {
    const q = termoSearch.trim().toLowerCase();
    if (!q) return termosDisponiveis;
    return termosDisponiveis.filter((t) =>
      String(t.titulo ?? t.title ?? '')
        .toLowerCase()
        .includes(q)
    );
  }, [termosDisponiveis, termoSearch]);

  const aplicarSelecaoTermo = useCallback(
    (termo) => {
      if (!termo) return;
      const id = termo.id != null ? String(termo.id) : null;
      setTermoSelecionadoId(id);
      setTermoSelecionado(termo);
      setTermoMenuOpen(false);
      setTermoSearch('');
      setTermoLido(false);
      setProfissionalAssinaturaDataUrl('');
      setTermoAssinaturaDataUrl('');
      if (typeof setTermoAssinado === 'function') setTermoAssinado(false);
      setProfAssinaturaTimestamp(null);
      setPatAssinaturaTimestamp(null);
      setAssinaturaPersistida(false);
      setStep4Errors({});
      onTermoChange?.(id, termo);
    },
    [onTermoChange, setTermoLido, setProfissionalAssinaturaDataUrl, setTermoAssinaturaDataUrl, setTermoAssinado, setStep4Errors]
  );

  const handleConfirmProf = (dataUrl) => {
    setProfissionalAssinaturaDataUrl(dataUrl);
    setTermoAssinaturaDataUrl('');
    if (typeof setTermoAssinado === 'function') setTermoAssinado(false);
    setStep4Errors((prev) => ({ ...prev, termoLido: false }));
    setProfAssinaturaTimestamp(Date.now());
    setPatAssinaturaTimestamp(null);
    setProfSigningOpen(false);
    toast.success('Assinatura do profissional registrada');
  };

  const handleConfirmPat = (dataUrl) => {
    setTermoAssinaturaDataUrl(dataUrl);
    if (typeof setTermoAssinado === 'function') setTermoAssinado(true);
    setStep4Errors((prev) => ({ ...prev, termoLido: false }));
    setPatAssinaturaTimestamp(Date.now());
    setPatSigningOpen(false);
    toast.success('Assinatura do paciente registrada');
  };

  const podeExibirAssinaturas = Boolean(termoSelecionadoId) && termoLido;
  const mostrarBuscaDropdown = termosDisponiveis.length > 3;

  return (
    <div className="min-w-0">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="rounded-2xl border-[3px] border-[#22c55e]/25 bg-[#dcfce7] p-3 text-[#22c55e]">
            <Shield className="h-7 w-7" strokeWidth={2.5} />
          </div>
          <div>
            <h3 className="text-[20px] font-bold text-[#0f172a]">Termo de consentimento</h3>
            <p className="text-[14px] font-medium text-[#64748b]">Leitura e assinaturas (profissional e paciente)</p>
          </div>
        </div>
      </div>

      <div className="relative mb-6" ref={termoMenuRef}>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[#94a3b8]">
          Selecionar termo de consentimento
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
                {termoSelecionado ? (
                  <>
                    <p className="text-[14px] font-semibold text-[#0f172a]">
                      {termoSelecionado.titulo ?? termoSelecionado.title ?? '—'}
                    </p>
                    <p className="mt-0.5 line-clamp-1 text-[12px] text-[#64748b]">
                      {(termoSelecionado.conteudo ?? termoSelecionado.content ?? '').replace(/\s+/g, ' ').trim()}
                    </p>
                  </>
                ) : (
                  <p className="text-[14px] text-[#94a3b8]">Selecione o termo...</p>
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
                      const sel = termoSelecionadoId != null && String(t.id) === String(termoSelecionadoId);
                      const preview = String(t.conteudo ?? t.content ?? '')
                        .replace(/\s+/g, ' ')
                        .trim()
                        .slice(0, 96);
                      return (
                        <button
                          key={String(t.id)}
                          type="button"
                          onClick={() => aplicarSelecaoTermo(t)}
                          className="flex w-full items-start gap-3 border-b border-[#f8fafc] px-3 py-2.5 text-left last:border-0 hover:bg-[#f8fafc]"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-[14px] font-semibold text-[#0f172a]">{t.titulo ?? t.title ?? '—'}</p>
                            <p className="mt-0.5 line-clamp-1 text-[12px] text-[#64748b]">{preview || '—'}</p>
                          </div>
                          {sel ? <Check className="mt-1 h-4 w-4 shrink-0 text-[#00a88e]" strokeWidth={2.5} /> : null}
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

      {!termosLoading && termosDisponiveis.length === 0 ? (
        <div className="mb-6 rounded-xl border border-[#fde68a] bg-[#fffbeb] px-4 py-4 text-[13px] font-medium text-[#92400e]">
          Nenhum termo cadastrado. Crie termos em Configurações → Clínica → Termos
        </div>
      ) : null}

      {!termosLoading && termosDisponiveis.length > 0 && termoSelecionadoId ? (
        <>
          <h3 className="mb-3 text-[17px] font-bold text-[#0f172a]">{tituloExibicao}</h3>
          <div className="mb-8 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-5">
            {temConteudoTexto ? (
              <div className="whitespace-pre-wrap break-words text-[14px] leading-relaxed text-[#334155]">{conteudoExibicao}</div>
            ) : (
              <>
                <p className="mb-3 text-[14px] leading-relaxed text-[#334155]">
                  Autorizo o tratamento de meus dados pessoais conforme a LGPD (Lei 13.709/2018), incluindo a coleta,
                  armazenamento e uso de informações de saúde estritamente para a finalidade de realização dos procedimentos
                  estéticos.
                </p>
                <p className="text-[14px] leading-relaxed text-[#334155]">
                  Declaro que forneci informações verdadeiras sobre meu histórico médico e assumo a responsabilidade por
                  omitir qualquer condição de saúde que possa interferir no procedimento.
                </p>
              </>
            )}
          </div>

          <div className="mb-8">
            <button
              type="button"
              onClick={() => {
                setTermoLido(!termoLido);
                setStep4Errors((prev) => ({ ...prev, termoLido: false }));
              }}
              className={`flex w-full items-center gap-4 rounded-xl border-2 p-4 text-left transition-all ${
                step4Errors.termoLido
                  ? 'border-red-400 bg-red-50 ring-1 ring-red-200'
                  : termoLido
                    ? 'border-[#86efac] bg-[#f0fdf4] shadow-sm'
                    : 'border-[#e2e8f0] bg-white hover:bg-[#f8fafc]'
              }`}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                  termoLido ? 'border-[#16a34a] bg-[#16a34a]' : 'border-[#94a3b8] bg-white'
                }`}
                aria-hidden
              >
                {termoLido ? <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} /> : null}
              </span>
              <span className={`text-[14px] font-bold ${termoLido ? 'text-[#166534]' : 'text-[#475569]'}`}>
                Li e concordo com os termos. Autorizo a realização do procedimento.
              </span>
            </button>
          </div>
        </>
      ) : null}

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
              {termoAssinaturaDataUrl && profissionalAssinaturaDataUrl ? (
                <span className="rounded-md bg-emerald-600 px-2 py-0.5 text-[11px] font-bold text-white">✓ Assinado</span>
              ) : (
                <span className="rounded-md bg-[#64748b] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                  Após profissional
                </span>
              )}
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
            ) : (
              <div className="flex flex-col items-center gap-4 py-6 text-center">
                <PenLine className="h-12 w-12 text-[#94a3b8]" strokeWidth={1.75} aria-hidden />
                <p className="text-[13px] font-medium text-[#64748b]">Clique para assinar digitalmente</p>
                <button
                  type="button"
                  onClick={() => setPatSigningOpen(true)}
                  className="rounded-lg bg-[#00a88e] px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#00967f]"
                >
                  Assinar como Paciente
                </button>
              </div>
            )}
          </div>
        </div>
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
    </div>
  );
}

export function Step4Procedimento({
  pacienteIdForProcedures = null,
  nomeProcedimento = '',
  setNomeProcedimento = () => {},
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
}) {
  const uploadInputRef = React.useRef(null);
  const datalistId = React.useId();
  const [procedureSuggestions, setProcedureSuggestions] = React.useState([]);
  /** Legenda por foto; chave = `ph.url` (estável ao remover; índice não é). */
  const [legendas, setLegendas] = React.useState({});
  const [fotoCategoria, setFotoCategoria] = React.useState('antes');
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

  React.useEffect(() => {
    if (!pacienteIdForProcedures) {
      setProcedureSuggestions([]);
      return undefined;
    }
    let cancelled = false;
    procedimentosApi
      .byPaciente(pacienteIdForProcedures)
      .then((rows) => {
        if (cancelled) return;
        const names = new Set();
        (Array.isArray(rows) ? rows : []).forEach((r) => {
          const n = String(r.procedimentoNome || r.nome || '').trim();
          if (n) names.add(n);
        });
        setProcedureSuggestions([...names].sort((a, b) => a.localeCompare(b, 'pt-BR')));
      })
      .catch(() => {
        if (!cancelled) setProcedureSuggestions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [pacienteIdForProcedures]);

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
        <div className="rounded-2xl border-[3px] border-[#00a88e]/25 bg-[#e6f7f5] p-3 text-[#00a88e]">
          <Stethoscope className="h-7 w-7" strokeWidth={2.5} />
        </div>
        <div>
          <h3 className="text-[20px] font-bold text-[#0f172a]">Procedimento</h3>
          <p className="text-[14px] font-medium text-[#64748b]">Registro do que foi realizado e imagens</p>
        </div>
      </div>

      <div
        className={`mb-6 space-y-5 rounded-2xl border-[3px] bg-white p-4 sm:p-6 ${
          step4Errors.nomeProcedimento || step4Errors.observacoesExecucao ? 'border-red-300' : 'border-[#00a88e]/25'
        }`}
      >
        <div className="space-y-1.5">
          <label className="text-[13px] font-bold text-[#00a88e]">
            Nome do procedimento <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            list={procedureSuggestions.length ? datalistId : undefined}
            placeholder="Nome do procedimento realizado"
            value={nomeProcedimento}
            onChange={(e) => {
              setNomeProcedimento(e.target.value);
              setStep4Errors((prev) => ({ ...prev, nomeProcedimento: false }));
            }}
            className={`w-full rounded-xl border-[2px] px-4 py-3 text-[16px] outline-none focus:border-[#00a88e] sm:text-[14px] ${
              step4Errors.nomeProcedimento ? 'border-red-400 bg-red-50' : 'border-[#e2e8f0]'
            }`}
          />
          {procedureSuggestions.length > 0 ? (
            <datalist id={datalistId}>
              {procedureSuggestions.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          ) : null}
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
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setFotoCategoria('antes')}
            className={`rounded-xl border-2 px-4 py-2 text-[13px] font-semibold transition-colors ${
              fotoCategoria === 'antes'
                ? 'border-[#00a88e] bg-[#e6f7f5] text-[#00a88e]'
                : 'border-[#e2e8f0] bg-white text-[#64748b] hover:border-[#00a88e]/40'
            }`}
          >
            Antes
          </button>
          <button
            type="button"
            onClick={() => setFotoCategoria('depois')}
            className={`rounded-xl border-2 px-4 py-2 text-[13px] font-semibold transition-colors ${
              fotoCategoria === 'depois'
                ? 'border-[#00a88e] bg-[#e6f7f5] text-[#00a88e]'
                : 'border-[#e2e8f0] bg-white text-[#64748b] hover:border-[#00a88e]/40'
            }`}
          >
            Depois
          </button>
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
                  ph.meta?.categoria === 'depois' ? 'bg-[#22c55e]' : 'bg-[#f59e0b]'
                }`}
              >
                {ph.meta?.categoria === 'depois' ? 'Depois' : 'Antes'}
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
