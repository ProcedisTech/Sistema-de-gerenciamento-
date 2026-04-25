import React, { useMemo, useRef, useState } from 'react';
import {
  CheckCircle,
  Square,
  CheckSquare,
  CheckCircle2,
  BookOpen,
  FileText,
  Download,
  User,
  Calendar,
  Stethoscope,
  AlertTriangle,
  Camera,
  PenLine,
} from 'lucide-react';
import { useToast } from '../../contexts/useToast.js';
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
  orientacoes,
  setOrientacoes,
  step5Errors = {},
  setStep5Errors = () => {},
  pacienteNome = '',
  pacienteIdade = null,
  pacienteCpf = '',
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

      if (nomeProcedimento) {
        drawLabel('Procedimento Realizado');
        drawValue(nomeProcedimento);
        if (observacoesProcedimento) drawSubtext(observacoesProcedimento);
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

          {nomeProcedimento ? (
            <>
              <div className="flex items-start gap-4 py-1">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f0fdfa]">
                  <Stethoscope className="h-4 w-4 text-[#00a88e]" strokeWidth={2} />
                </div>
                <div>
                  <div className="text-[12px] font-bold uppercase tracking-widest text-[#94a3b8]">Procedimento</div>
                  <div className="text-[15px] font-semibold text-[#0f172a]">{nomeProcedimento}</div>
                  {observacoesProcedimento ? (
                    <div className="mt-1 text-[13px] leading-relaxed text-[#475569]">{observacoesProcedimento}</div>
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

          {fotosAvaliacao.length > 0 || fotosProcedimento.length > 0 ? (
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
                    {fotosAvaliacao.length + fotosProcedimento.length} foto(s) registrada(s)
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

                  {fotosProcedimento.length > 0 ? (
                    <div className="mt-3">
                      <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#64748b]">
                        Procedimento ({fotosProcedimento.length})
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {fotosProcedimento.map((foto, idx) => (
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
          step5Errors.orientacoes ? 'border-red-300' : 'border-[#00a88e]/25'
        }`}
      >
        <div>
          <h4 className="mb-4 text-[18px] font-bold text-[#0f766e]">Orientações Pós-Procedimento</h4>
          <div className="space-y-2">
            {ORIENTACOES_ITENS.map((texto) => (
              <div
                key={texto}
                className="flex items-start gap-3 rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] p-3"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#16a34a]" strokeWidth={2.5} aria-hidden />
                <p className="text-[14px] font-medium leading-snug text-[#0f172a]">{texto}</p>
              </div>
            ))}
          </div>
        </div>

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

        <div className="border-t border-[#e2e8f0] pt-5">
          <div
            role="button"
            tabIndex={0}
            onClick={() => {
              setOrientacoes(!orientacoes);
              setStep5Errors((prev) => ({ ...prev, orientacoes: false }));
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setOrientacoes(!orientacoes);
                setStep5Errors((prev) => ({ ...prev, orientacoes: false }));
              }
            }}
            className={`flex cursor-pointer items-center gap-4 rounded-xl border p-4 shadow-sm transition-all ${
              step5Errors.orientacoes
                ? 'border-red-500 bg-red-50 ring-1 ring-red-200'
                : orientacoes
                  ? 'border-[#00a88e] bg-[#e6f7f5]'
                  : 'border-[#00a88e]/25 bg-white hover:bg-[#f8fbfb]'
            }`}
          >
            {orientacoes ? (
              <CheckSquare className="h-6 w-6 shrink-0 text-[#00a88e]" strokeWidth={2.5} />
            ) : (
              <Square className="h-6 w-6 shrink-0 text-[#00a88e]/40" strokeWidth={2.5} />
            )}
            <BookOpen className="h-4 w-4 shrink-0 text-[#64748b]" strokeWidth={2.5} aria-hidden />
            <span className={`text-[14px] font-bold ${orientacoes ? 'text-[#0f766e]' : 'text-[#475569]'}`}>
              Recebi e compreendi as orientações pós-procedimento
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
