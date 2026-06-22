import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle,
  Square,
  CheckSquare,
  BookOpen,
  FileText,
  Download,
  User,
  Calendar,
  Stethoscope,
  AlertTriangle,
  Camera,
  PenLine,
  MessageCircle,
  Plus,
  Trash2,
} from 'lucide-react';
import { useToast } from '../../contexts/useToast.js';
import { perfilApi } from '../../services/api.js';
import {
  newOrientacaoId,
  normalizeOrientacoesTemplateResponse,
  normalizeWaPhoneDigits,
} from '../../utils/orientacoesJourney.js';
import { toLocalISODate, maxIsoDate, addCalendarYearsToIso } from '../../utils/dateLimits.js';
import { evaluateProximoRetornoStep5 } from '../../utils/proximoRetornoStep5.js';
import {
  sanitizeBirthDateDigits,
  formatBirthDigitsBR,
  validateCalendarDateDigits8,
} from '../utils/formatters';

const ORIENTACOES_ITENS = [
  'Evite exposição solar direta por 48 horas',
  'Não toque na área tratada nas primeiras 6 horas',
  'Mantenha a pele hidratada',
  'Use protetor solar SPF 50+ nos próximos 7 dias',
  'Evite atividades físicas intensas por 24 horas',
  'Entre em contato conosco em caso de dúvidas ou reações',
];

function fallbackOrientacoesFromDefaults() {
  return ORIENTACOES_ITENS.map((texto, ordem) => ({
    id: newOrientacaoId(),
    descricao: texto,
    ordem,
    checado: false,
  }));
}

function isoToBR(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '').trim());
  if (!m) return '';
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function formatTs(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function Step5Finalization({
  procedureDateIso,
  proximoRetornoDisplay,
  setProximoRetornoDisplay,
  /** Pelo menos um item checado (derivado no hook; usado para borda de erro). */
  orientacoes: orientacoesOk = false,
  orientacoesItens = [],
  setOrientacoesItens = () => {},
  orientacoesCarregadas = false,
  setOrientacoesCarregadas = () => {},
  step5Errors = {},
  setStep5Errors = () => {},
  pacienteNome = '',
  pacienteIdade = null,
  pacienteCpf = '',
  telefonePaciente = '',
  nomeProcedimento = '',
  observacoesProcedimento = '',
  queixa = '',
  alertasAnamnese = [],
  alertasAlergia = [],
  profissionalAssinaturaDataUrl = '',
  termoAssinaturaDataUrl = '',
  profAssinaturaTimestamp = null,
  patAssinaturaTimestamp = null,
  termoTitulo = '',
  fotosAvaliacao = [],
  fotosProcedimento = [],
  nomeUsuario = '',
  onAnnotateEvaluationPhoto,
  onAnnotateProcedurePhoto,
  hideProximoRetorno = false,
  procedimentosLote = [],
}) {
  const toast = useToast();
  const todayIso = useMemo(() => toLocalISODate(), []);
  const minReturnIso = useMemo(
    () => maxIsoDate(procedureDateIso || todayIso, todayIso),
    [procedureDateIso, todayIso],
  );
  const maxReturnIso = useMemo(() => addCalendarYearsToIso(todayIso, 10), [todayIso]);

  const lastRangeToastIsoRef = useRef('');
  const resumoRef = useRef(null);
  const [editingId, setEditingId] = useState(null);

  const allObservacoes = useMemo(() => {
    if (procedimentosLote && procedimentosLote.length > 0) {
      const obs = procedimentosLote.map(p => p.observacoesExecucao).filter(Boolean).join('\n\n');
      if (obs) return obs;
    }
    return observacoesProcedimento;
  }, [procedimentosLote, observacoesProcedimento]);

  const allFotosProcedimento = useMemo(() => {
    if (procedimentosLote && procedimentosLote.length > 0) {
      const photos = [];
      procedimentosLote.forEach(p => {
        if (Array.isArray(p.fotosSnapshot)) photos.push(...p.fotosSnapshot);
      });
      if (photos.length > 0) return photos;
    }
    return fotosProcedimento || [];
  }, [procedimentosLote, fotosProcedimento]);

  useEffect(() => {
    if (orientacoesCarregadas) return;
    let cancelled = false;
    
    const nomesArray = procedimentosLote && procedimentosLote.length > 0
      ? procedimentosLote.map(p => String(p.nomeProcedimento || p.procedimentoNome || '').trim()).filter(Boolean)
      : [String(nomeProcedimento || '').trim()].filter(Boolean);
      
    const nomesUnicos = [...new Set(nomesArray)];

    (async () => {
      try {
        let allParsed = [];
        if (nomesUnicos.length > 0) {
          const promises = nomesUnicos.map(n => 
             perfilApi.getOrientacoesTemplate(n).catch(e => {
               if (e?.status !== 404 && e?.status !== 400) {
                 console.warn(`orientacoes-template (${n}):`, e?.message || e);
               }
               return null;
             })
          );
          
          const results = await Promise.all(promises);
          if (cancelled) return;
          
          for (const raw of results) {
            if (raw) {
               const parsed = normalizeOrientacoesTemplateResponse(raw);
               allParsed.push(...parsed);
            }
          }
        }
        
        if (allParsed.length > 0) {
          const uniqueTexts = new Set();
          const uniqueParsed = [];
          
          allParsed.forEach(item => {
             const textKey = String(item.descricao || '').trim().toLowerCase();
             if (!uniqueTexts.has(textKey)) {
                uniqueTexts.add(textKey);
                uniqueParsed.push({ ...item, id: newOrientacaoId() });
             }
          });
          
          const finalParsed = uniqueParsed.map((item, idx) => ({ ...item, ordem: idx }));
          
          setOrientacoesItens(finalParsed);
          setOrientacoesCarregadas(true);
          return;
        }
      } catch (e) {
        console.warn('orientacoes-template batch:', e?.message || e);
      }

      if (!cancelled) {
        setOrientacoesItens(fallbackOrientacoesFromDefaults());
        setOrientacoesCarregadas(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [nomeProcedimento, procedimentosLote, orientacoesCarregadas, setOrientacoesItens, setOrientacoesCarregadas]);

  const sortedItens = useMemo(
    () => [...(Array.isArray(orientacoesItens) ? orientacoesItens : [])].sort((a, b) => a.ordem - b.ordem),
    [orientacoesItens],
  );

  const updateItem = (id, patch) => {
    setOrientacoesItens((prev) =>
      (Array.isArray(prev) ? prev : []).map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
    setStep5Errors((e) => ({ ...e, orientacoes: false }));
  };

  const removeItem = (id) => {
    setOrientacoesItens((prev) => {
      const next = (Array.isArray(prev) ? prev : []).filter((row) => row.id !== id);
      return next.map((row, idx) => ({ ...row, ordem: idx }));
    });
    if (editingId === id) setEditingId(null);
    setStep5Errors((e) => ({ ...e, orientacoes: false }));
  };

  const addItem = () => {
    setOrientacoesItens((prev) => {
      const list = Array.isArray(prev) ? prev : [];
      const maxOrd = list.reduce((m, r) => Math.max(m, Number(r.ordem) || 0), -1);
      return [
        ...list,
        { id: newOrientacaoId(), descricao: '', ordem: maxOrd + 1, checado: false },
      ];
    });
    setStep5Errors((e) => ({ ...e, orientacoes: false }));
  };

  const handleWhatsApp = () => {
    const phone = normalizeWaPhoneDigits(telefonePaciente);
    if (!phone) {
      toast.error('Cadastre o telefone do paciente para enviar por WhatsApp.');
      return;
    }
    const lines = sortedItens.filter((i) => i.checado && String(i.descricao || '').trim());
    if (lines.length === 0) {
      toast.error('Marque ao menos uma orientação para enviar.');
      return;
    }
    const header = [
      pacienteNome ? `Olá, ${pacienteNome}!` : 'Olá!',
      nomeProcedimento ? `Orientações pós — ${nomeProcedimento}` : 'Orientações pós-procedimento',
      '',
    ]
      .filter(Boolean)
      .join('\n');
    const body = lines.map((i) => `• ${String(i.descricao).trim()}`).join('\n');
    const texto = `${header}\n\n${body}`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(texto)}`, '_blank', 'noopener,noreferrer');
  };

  const handleReturnDateChange = (raw) => {
    const digits = sanitizeBirthDateDigits(raw);
    const display = formatBirthDigitsBR(digits);
    setProximoRetornoDisplay(display);

    if (digits.length < 8) {
      lastRangeToastIsoRef.current = '';
      return;
    }

    const cal = validateCalendarDateDigits8(digits);
    if (!cal.ok) {
      lastRangeToastIsoRef.current = '';
      return;
    }

    if (cal.iso < minReturnIso || cal.iso > maxReturnIso) {
      if (lastRangeToastIsoRef.current !== cal.iso) {
        lastRangeToastIsoRef.current = cal.iso;
        toast.error('Data de retorno fora do período permitido.');
      }
      return;
    }

    lastRangeToastIsoRef.current = '';
  };

  const { fieldMessage: returnDateFieldMessage } = evaluateProximoRetornoStep5(
    procedureDateIso,
    proximoRetornoDisplay
  );
  const returnDateInputInvalid = Boolean(returnDateFieldMessage);

  const handleExportPDF = async () => {
    try {
      const { default: jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = 210;
      const pageH = 297;
      const margin = 14;
      const contentW = pageW - margin * 2;
      let y = margin;
      const teal = [0, 184, 148];
      const dark = [26, 35, 50];
      const gray = [90, 103, 120];
      const lightGray = [232, 236, 239];
      const bgLight = [240, 253, 249];

      const checkPage = (needed = 10) => {
        if (y + needed > pageH - margin) {
          doc.addPage();
          y = margin;
        }
      };
      const drawLine = () => {
        checkPage(6);
        doc.setDrawColor(...lightGray);
        doc.setLineWidth(0.3);
        doc.line(margin, y, pageW - margin, y);
        y += 5;
      };
      const drawLabel = (text) => {
        checkPage(6);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...teal);
        doc.text(text.toUpperCase(), margin, y);
        y += 5;
      };
      const drawValue = (text, size = 11) => {
        checkPage(7);
        doc.setFontSize(size);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...dark);
        const lines = doc.splitTextToSize(text, contentW);
        doc.text(lines, margin, y);
        y += lines.length * (size * 0.4) + 2;
      };
      const drawSubtext = (text) => {
        checkPage(6);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...gray);
        const lines = doc.splitTextToSize(text, contentW);
        doc.text(lines, margin, y);
        y += lines.length * 4 + 1;
      };

      doc.setFillColor(...teal);
      doc.rect(0, 0, pageW, 22, 'F');
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(margin, 5, 12, 12, 2, 2, 'F');
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...teal);
      doc.text('P', margin + 4.5, 13.5);
      doc.setFontSize(12);
      doc.setTextColor(255, 255, 255);
      doc.text('Procedi', margin + 15, 11);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text('Sistema de Gestão Clínica', margin + 15, 16);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Resumo de Atendimento', pageW - margin, 11, { align: 'right' });
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `Gerado em ${new Date().toLocaleString('pt-BR', {
          timeZone: 'America/Sao_Paulo',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}`,
        pageW - margin,
        16,
        { align: 'right' },
      );
      y = 30;

      drawLabel('Paciente');
      drawValue([pacienteNome || '—', pacienteIdade ? `${pacienteIdade} anos` : ''].filter(Boolean).join(', '));
      if (pacienteCpf) drawSubtext(`CPF: ${pacienteCpf}`);
      drawLine();

      drawLabel('Data e Profissional');
      drawValue(procedureDateIso ? isoToBR(procedureDateIso) : '—');
      if (nomeUsuario) drawSubtext(`Profissional: ${nomeUsuario}`);
      drawLine();

      const nomesProcedimentosRender = (procedimentosLote && procedimentosLote.length > 0)
        ? procedimentosLote.map(p => String(p.procedimentoNome || p.nomeProcedimento || '').trim()).filter(Boolean)
        : [nomeProcedimento].filter(Boolean);

      if (nomesProcedimentosRender.length > 0) {
        drawLabel('Procedimento Realizado');
        nomesProcedimentosRender.forEach(nome => {
          drawValue(nome);
        });
        if (allObservacoes) drawSubtext(allObservacoes);
        drawLine();
      }

      if (queixa) {
        drawLabel('Queixa do Paciente');
        drawSubtext(queixa);
        drawLine();
      }

      if (alertasAlergia.length > 0 || alertasAnamnese.length > 0) {
        drawLabel('Alertas Clínicos');
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(220, 38, 38);
        alertasAlergia.forEach((a) => {
          checkPage(6);
          doc.text(`⚠ ${a.titulo}: ${a.valor}`, margin, y);
          y += 5;
        });
        alertasAnamnese
          .filter((a) => !alertasAlergia.find((al) => al.key === a.key))
          .slice(0, 3)
          .forEach((a) => {
            checkPage(6);
            doc.setFont('helvetica', 'normal');
            doc.text(`• ${a.titulo}: ${a.valor}`, margin, y);
            y += 5;
          });
        drawLine();
      }

      if (profissionalAssinaturaDataUrl || termoAssinaturaDataUrl) {
        drawLabel(`Termo: ${termoTitulo || 'Consentimento'}`);
        y += 2;
        const sigW = (contentW - 6) / 2;
        const sigH = 25;

        doc.setFillColor(...bgLight);
        doc.setDrawColor(...lightGray);
        doc.roundedRect(margin, y, sigW, sigH + 10, 2, 2, 'FD');
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...gray);
        doc.text('PROFISSIONAL', margin + 3, y + 5);
        if (profissionalAssinaturaDataUrl) {
          try {
            doc.addImage(profissionalAssinaturaDataUrl, 'PNG', margin + 2, y + 7, sigW - 4, sigH - 4, undefined, 'SLOW');
          } catch {
            /* ignore */
          }
        }
        if (profAssinaturaTimestamp) {
          doc.setFontSize(7);
          doc.setFont('helvetica', 'normal');
          doc.text(formatTs(profAssinaturaTimestamp), margin + 3, y + sigH + 7);
        }

        const px = margin + sigW + 6;
        doc.setFillColor(...bgLight);
        doc.roundedRect(px, y, sigW, sigH + 10, 2, 2, 'FD');
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...gray);
        doc.text('PACIENTE', px + 3, y + 5);
        if (termoAssinaturaDataUrl) {
          try {
            doc.addImage(termoAssinaturaDataUrl, 'PNG', px + 2, y + 7, sigW - 4, sigH - 4, undefined, 'SLOW');
          } catch {
            /* ignore */
          }
        }
        if (patAssinaturaTimestamp) {
          doc.setFontSize(7);
          doc.setFont('helvetica', 'normal');
          doc.text(formatTs(patAssinaturaTimestamp), px + 3, y + sigH + 7);
        }
        y += sigH + 14;
        drawLine();
      }

      const toDataUrl = (url) =>
        new Promise((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            const c = document.createElement('canvas');
            const scale = 2;
            c.width = img.naturalWidth * scale;
            c.height = img.naturalHeight * scale;
            const ctx = c.getContext('2d');
            if (!ctx) {
              resolve(null);
              return;
            }
            ctx.scale(scale, scale);
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0);
            resolve(c.toDataURL('image/jpeg', 0.95));
          };
          img.onerror = () => resolve(null);
          img.src = url;
        });

      const drawFotos = async (fotos, titulo) => {
        if (!fotos.length) return;
        checkPage(20);
        drawLabel(titulo);
        y += 1;
        const cols = 3;
        const gap = 3;
        const photoW = (contentW - gap * (cols - 1)) / cols;
        const photoH = photoW * 0.75;

        for (let row = 0; row < Math.ceil(fotos.length / cols); row += 1) {
          if (y + photoH + 5 > pageH - margin - 12) {
            doc.addPage();
            y = margin;
          }
          const rowStartY = y;
          for (let col = 0; col < cols; col += 1) {
            const idx = row * cols + col;
            if (idx >= fotos.length) break;
            const x = margin + col * (photoW + gap);
            doc.setFillColor(241, 245, 249);
            doc.setDrawColor(...lightGray);
            doc.roundedRect(x, rowStartY, photoW, photoH, 2, 2, 'FD');
            try {
              const dataUrl = await toDataUrl(fotos[idx].url);
              if (dataUrl) {
                doc.addImage(dataUrl, 'JPEG', x, rowStartY, photoW, photoH, undefined, 'SLOW');
              }
            } catch {
              /* ignore */
            }
            doc.setFillColor(0, 0, 0);
            doc.roundedRect(x + 1.5, rowStartY + photoH - 6, 7, 5, 1, 1, 'F');
            doc.setFontSize(7);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(255, 255, 255);
            doc.text(String(idx + 1), x + 3.5, rowStartY + photoH - 2.5);
          }
          y = rowStartY + photoH + gap;
        }
        y += 5;
        drawLine();
      };

      if (fotosAvaliacao.length > 0) {
        await drawFotos(fotosAvaliacao, `Avaliação e Mapeamento (${fotosAvaliacao.length})`);
      }
      if (fotosProcedimento.length > 0) {
        await drawFotos(fotosProcedimento, `Registro do Procedimento (${fotosProcedimento.length})`);
      }

      const orientChecked = (Array.isArray(orientacoesItens) ? orientacoesItens : []).filter(
        (i) => i && i.checado && String(i.descricao || '').trim(),
      );
      if (orientChecked.length > 0) {
        checkPage(14);
        drawLabel('Orientações Pós-Procedimento');
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...dark);
        [...orientChecked]
          .sort((a, b) => (Number(a.ordem) || 0) - (Number(b.ordem) || 0))
          .forEach((i) => {
            checkPage(6);
            const t = `✓ ${String(i.descricao || '').trim()}`;
            const lines = doc.splitTextToSize(t, contentW);
            doc.text(lines, margin, y);
            y += lines.length * 4.2 + 1;
          });
        drawLine();
      }

      const totalPages = doc.internal.getNumberOfPages();
      for (let p = 1; p <= totalPages; p += 1) {
        doc.setPage(p);
        doc.setFillColor(248, 251, 251);
        doc.rect(0, pageH - 12, pageW, 12, 'F');
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...gray);
        doc.text('Documento gerado automaticamente pelo sistema Procedi — Registro Clínico Interno', margin, pageH - 5);
        doc.text(`Página ${p} de ${totalPages}`, pageW - margin, pageH - 5, { align: 'right' });
      }

      const nomeArquivo = `resumo-${(pacienteNome || 'paciente')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '-')}-${procedureDateIso || 'atendimento'}.pdf`;
      doc.save(nomeArquivo);
    } catch (e) {
      console.error('Erro ao gerar PDF:', e);
      toast.error('Erro ao gerar PDF. Tente novamente.');
    }
  };

  return (
    <div className="min-w-0 pb-4">
      {/* ── RESUMO DO ATENDIMENTO ── */}
      <div className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-[#00a88e]" strokeWidth={2} />
            <h4 className="text-[16px] font-bold text-[#0f172a]">Resumo do Atendimento</h4>
          </div>
          <button
            type="button"
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 text-[12px] font-semibold text-[#64748b] transition-colors hover:border-[#00a88e]/40 hover:text-[#00a88e]"
          >
            <Download className="h-3.5 w-3.5" strokeWidth={2.5} />
            Exportar PDF
          </button>
        </div>

        <div ref={resumoRef} className="space-y-4 rounded-2xl border border-[#e2e8f0] bg-white p-5">
          <div className="flex items-center justify-between border-b border-[#f1f5f9] pb-3">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-[#94a3b8]">
                Procedi — Sistema de Gestão Clínica
              </div>
              <div className="mt-0.5 text-[11px] text-[#94a3b8]">Gerado em {formatTs(Date.now())}</div>
            </div>
          </div>

          <div className="flex items-start gap-4 py-1">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f0fdfa]">
              <User className="h-4 w-4 text-[#00a88e]" strokeWidth={2} />
            </div>
            <div>
              <div className="text-[12px] font-bold uppercase tracking-widest text-[#94a3b8]">Paciente</div>
              <div className="text-[15px] font-semibold text-[#0f172a]">
                {pacienteNome || '—'}
                {pacienteIdade ? `, ${pacienteIdade} anos` : ''}
              </div>
              {pacienteCpf ? <div className="text-[13px] text-[#64748b]">CPF: {pacienteCpf}</div> : null}
            </div>
          </div>

          <div className="border-b border-[#f1f5f9]" />

          <div className="flex items-start gap-4 py-1">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f0fdfa]">
              <Calendar className="h-4 w-4 text-[#00a88e]" strokeWidth={2} />
            </div>
            <div>
              <div className="text-[12px] font-bold uppercase tracking-widest text-[#94a3b8]">Data e Profissional</div>
              <div className="text-[15px] font-semibold text-[#0f172a]">
                {procedureDateIso ? isoToBR(procedureDateIso) : '—'}
              </div>
              {nomeUsuario ? <div className="text-[13px] text-[#64748b]">Profissional: {nomeUsuario}</div> : null}
            </div>
          </div>

          <div className="border-b border-[#f1f5f9]" />

          {((procedimentosLote && procedimentosLote.length > 0) || nomeProcedimento) ? (
            <>
              <div className="flex items-start gap-4 py-1">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f0fdfa]">
                  <Stethoscope className="h-4 w-4 text-[#00a88e]" strokeWidth={2} />
                </div>
                <div>
                  <div className="text-[12px] font-bold uppercase tracking-widest text-[#94a3b8]">Procedimento{procedimentosLote?.length > 1 ? 's' : ''}</div>
                  <div className="text-[15px] font-semibold text-[#0f172a]">
                    {(procedimentosLote && procedimentosLote.length > 0)
                      ? procedimentosLote.map((p, idx) => (
                          <div key={idx}>{p.procedimentoNome || p.nomeProcedimento}</div>
                        ))
                      : nomeProcedimento}
                  </div>
                  {allObservacoes ? (
                    <div className="mt-1 text-[13px] leading-relaxed text-[#475569] whitespace-pre-wrap">{allObservacoes}</div>
                  ) : null}
                </div>
              </div>
              <div className="border-b border-[#f1f5f9]" />
            </>
          ) : null}

          {queixa ? (
            <>
              <div className="flex items-start gap-4 py-1">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f0fdfa]">
                  <BookOpen className="h-4 w-4 text-[#00a88e]" strokeWidth={2} />
                </div>
                <div>
                  <div className="text-[12px] font-bold uppercase tracking-widest text-[#94a3b8]">Queixa</div>
                  <div className="text-[13px] leading-relaxed text-[#475569]">{queixa}</div>
                </div>
              </div>
              <div className="border-b border-[#f1f5f9]" />
            </>
          ) : null}

          {alertasAlergia.length > 0 || alertasAnamnese.length > 0 ? (
            <>
              <div className="flex items-start gap-4 py-1">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#fef2f2]">
                  <AlertTriangle className="h-4 w-4 text-[#dc2626]" strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-bold uppercase tracking-widest text-[#dc2626]">Alertas Clínicos</div>
                  <div className="mt-1 space-y-1">
                    {alertasAlergia.map((a) => (
                      <div key={a.key} className="text-[12px] font-semibold text-[#dc2626]">
                        ⚠ {a.titulo}: {a.valor}
                      </div>
                    ))}
                    {alertasAnamnese
                      .filter((a) => !alertasAlergia.find((al) => al.key === a.key))
                      .slice(0, 3)
                      .map((a) => (
                        <div key={a.key} className="text-[12px] text-[#dc2626]">
                          • {a.titulo}: {a.valor}
                        </div>
                      ))}
                  </div>
                </div>
              </div>
              <div className="border-b border-[#f1f5f9]" />
            </>
          ) : null}

          {fotosAvaliacao.length > 0 || allFotosProcedimento.length > 0 ? (
            <>
              <div className="flex items-start gap-4 py-1">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f0fdfa]">
                  <Camera className="h-4 w-4 text-[#00a88e]" strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-bold uppercase tracking-widest text-[#94a3b8]">
                    Registro Fotográfico
                  </div>
                  <div className="mt-0.5 text-[13px] text-[#64748b]">
                    {fotosAvaliacao.length + allFotosProcedimento.length} foto(s) registrada(s)
                  </div>

                  {fotosAvaliacao.length > 0 ? (
                    <div className="mt-3">
                      <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#00a88e]">
                        Avaliação ({fotosAvaliacao.length})
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {fotosAvaliacao.map((foto, idx) => (
                          <div
                            key={idx}
                            className="group relative aspect-square overflow-hidden rounded-lg border border-[#e2e8f0] bg-[#f1f5f9]"
                          >
                            <img
                              src={foto.url}
                              alt=""
                              crossOrigin="anonymous"
                              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                            />
                            <div className="absolute bottom-1 left-1 rounded bg-black/50 px-1.5 py-0.5 text-[10px] font-bold text-white">
                              {idx + 1}
                            </div>
                            {typeof onAnnotateEvaluationPhoto === 'function' ? (
                              <button
                                type="button"
                                onClick={() => onAnnotateEvaluationPhoto(idx)}
                                className="absolute inset-0 z-[1] flex items-center justify-center bg-black/35 opacity-100 transition-all sm:bg-black/0 sm:opacity-0 sm:group-hover:bg-black/45 sm:group-hover:opacity-100"
                              >
                                <span className="rounded-lg bg-white px-2 py-1.5 text-[11px] font-bold text-[#0f172a] shadow sm:text-[12px]">
                                  Anotar
                                </span>
                              </button>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {allFotosProcedimento.length > 0 ? (
                    <div className="mt-3">
                      <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#64748b]">
                        Procedimento ({allFotosProcedimento.length})
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {allFotosProcedimento.map((foto, idx) => (
                          <div
                            key={idx}
                            className="group relative aspect-square overflow-hidden rounded-lg border border-[#e2e8f0] bg-[#f1f5f9]"
                          >
                            <img
                              src={foto.url}
                              alt=""
                              crossOrigin="anonymous"
                              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                            />
                            <div className="absolute bottom-1 left-1 rounded bg-black/50 px-1.5 py-0.5 text-[10px] font-bold text-white">
                              {idx + 1}
                            </div>
                            {typeof onAnnotateProcedurePhoto === 'function' ? (
                              <button
                                type="button"
                                onClick={() => onAnnotateProcedurePhoto(idx)}
                                className="absolute inset-0 z-[1] flex items-center justify-center bg-black/35 opacity-100 transition-all sm:bg-black/0 sm:opacity-0 sm:group-hover:bg-black/45 sm:group-hover:opacity-100"
                              >
                                <span className="rounded-lg bg-white px-2 py-1.5 text-[11px] font-bold text-[#0f172a] shadow sm:text-[12px]">
                                  Anotar
                                </span>
                              </button>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="border-b border-[#f1f5f9]" />
            </>
          ) : null}

          {profissionalAssinaturaDataUrl || termoAssinaturaDataUrl ? (
            <>
              <div className="flex items-start gap-4 py-1">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f0fdfa]">
                  <PenLine className="h-4 w-4 text-[#00a88e]" strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-bold uppercase tracking-widest text-[#94a3b8]">
                    {termoTitulo || 'Termo de Consentimento'}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-3">
                    {profissionalAssinaturaDataUrl ? (
                      <div>
                        <div className="mb-1 text-[11px] text-[#64748b]">Profissional</div>
                        <div className="flex h-16 w-full items-center justify-center overflow-hidden rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-2">
                          <img
                            src={profissionalAssinaturaDataUrl}
                            alt=""
                            style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain', display: 'block' }}
                          />
                        </div>
                        <div className="mt-0.5 text-[10px] text-[#94a3b8]">{formatTs(profAssinaturaTimestamp)}</div>
                      </div>
                    ) : null}
                    {termoAssinaturaDataUrl ? (
                      <div>
                        <div className="mb-1 text-[11px] text-[#64748b]">Paciente</div>
                        <div className="flex h-16 w-full items-center justify-center overflow-hidden rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-2">
                          <img
                            src={termoAssinaturaDataUrl}
                            alt=""
                            style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain', display: 'block' }}
                          />
                        </div>
                        <div className="mt-0.5 text-[10px] text-[#94a3b8]">{formatTs(patAssinaturaTimestamp)}</div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="border-b border-[#f1f5f9]" />
            </>
          ) : null}

          <div className="pt-1 text-center">
            <div className="text-[10px] text-[#94a3b8]">
              Documento gerado pelo sistema Procedi — válido como registro clínico interno
            </div>
          </div>
        </div>
      </div>
      {/* ── FIM RESUMO ── */}

      <div className="mb-8 flex items-center gap-4">
        <div className="rounded-2xl border border-emerald-200 bg-[#dcfce7] p-3 text-[#22c55e]">
          <CheckCircle className="h-7 w-7" strokeWidth={2.5} />
        </div>
        <div>
          <h3 className="text-[20px] font-bold text-[#0f172a]">Finalização do Procedimento</h3>
          <p className="text-[14px] font-medium text-[#64748b]">Orientações e confirmações finais</p>
        </div>
      </div>

      <div
        className={`space-y-6 rounded-2xl border bg-white p-6 ${
          step5Errors.orientacoes && !orientacoesOk ? 'border-red-300' : 'border-[#00a88e]/25'
        }`}
      >
        <div>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h4 className="text-[18px] font-bold text-[#0f766e]">Orientações Pós-Procedimento</h4>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={addItem}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#00a88e]/40 bg-[#f0fdf9] px-3 py-2 text-[12px] font-bold text-[#0f766e] transition-colors hover:bg-[#e6f7f5]"
              >
                <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                Adicionar orientação
              </button>
              <button
                type="button"
                onClick={handleWhatsApp}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#25D366]/50 bg-[#dcfce7] px-3 py-2 text-[12px] font-bold text-[#166534] transition-colors hover:bg-[#bbf7d0]"
              >
                <MessageCircle className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                Enviar por WhatsApp
              </button>
            </div>
          </div>
          <div className="space-y-2">
            {sortedItens.length === 0 ? (
              <p className="text-[13px] font-medium text-[#64748b]">Carregando orientações…</p>
            ) : (
              sortedItens.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-start gap-3 rounded-lg border p-3 ${
                    item.checado ? 'border-[#86efac] bg-[#f0fdf4]' : 'border-[#e2e8f0] bg-[#f8fafc]'
                  }`}
                >
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={item.checado}
                    onClick={() => updateItem(item.id, { checado: !item.checado })}
                    className="mt-0.5 shrink-0 rounded p-0.5 text-[#00a88e] outline-none focus-visible:ring-2 focus-visible:ring-[#00a88e]/40"
                  >
                    {item.checado ? (
                      <CheckSquare className="h-5 w-5" strokeWidth={2.5} aria-hidden />
                    ) : (
                      <Square className="h-5 w-5 text-[#94a3b8]" strokeWidth={2.5} aria-hidden />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    {editingId === item.id ? (
                      <textarea
                        value={item.descricao}
                        onChange={(e) => updateItem(item.id, { descricao: e.target.value })}
                        onBlur={() => setEditingId(null)}
                        rows={2}
                        className="w-full resize-y rounded-lg border border-[#00a88e]/40 bg-white px-3 py-2 text-[14px] font-medium text-[#0f172a] outline-none focus:ring-2 focus:ring-[#00a88e]/20"
                        autoFocus
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEditingId(item.id)}
                        className="w-full rounded-lg px-1 py-0.5 text-left text-[14px] font-medium leading-snug text-[#0f172a] hover:bg-black/[0.03]"
                      >
                        {item.descricao ? item.descricao : <span className="text-[#94a3b8]">Clique para editar</span>}
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="shrink-0 rounded-lg p-2 text-[#94a3b8] transition-colors hover:bg-red-50 hover:text-red-600"
                    aria-label="Remover orientação"
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={2.5} />
                  </button>
                </div>
              ))
            )}
          </div>
          {step5Errors.orientacoes && !orientacoesOk ? (
            <p className="mt-2 text-[12px] font-bold text-red-600" role="alert">
              Marque ao menos uma orientação para continuar.
            </p>
          ) : null}
        </div>

        {!hideProximoRetorno ? (
        <div className="space-y-1.5 border-t border-[#e2e8f0] pt-5">
          <label htmlFor="next-return-date" className="text-[13px] font-bold text-[#00a88e]">
            Data do próximo retorno (opcional)
          </label>
          <input
            id="next-return-date"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={proximoRetornoDisplay}
            onChange={(e) => handleReturnDateChange(e.target.value)}
            placeholder="DD/MM/AAAA"
            maxLength={10}
            className={`w-full max-w-xs rounded-xl border bg-[#f8fbfb] px-4 py-3 text-[14px] font-medium text-[#0f172a] outline-none transition-all focus:ring-4 focus:ring-[#00a88e]/20 ${
              returnDateInputInvalid
                ? 'border-red-400 bg-red-50'
                : 'border-[#00a88e]/25 focus:border-[#00a88e]'
            }`}
          />
          <p className="text-[12px] font-medium text-[#64748b]">
            Entre {isoToBR(minReturnIso)} e {isoToBR(maxReturnIso)}.
          </p>
          {returnDateFieldMessage ? (
            <p className="text-[12px] font-bold text-red-600" role="alert">
              {returnDateFieldMessage}
            </p>
          ) : null}
        </div>
        ) : null}

      </div>
    </div>
  );
}
