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
  getPresetOrientacoesByProcedimento,
} from '../../utils/orientacoesJourney.js';
import { formatarInstante } from '../../utils/datasClinica.js';
import { useAgoraDaClinica } from '../hooks/useAgoraDaClinica.js';

function fallbackOrientacoesFromDefaults(nomesArray = []) {
  const itens = getPresetOrientacoesByProcedimento(nomesArray);
  return itens.map((texto, ordem) => ({
    id: newOrientacaoId(),
    descricao: texto,
    ordem,
    checado: false,
  }));
}

/** Modelo do perfil pelo nome do procedimento; reserva: lista fixa por palavra-chave. */
async function carregarModeloDoItem(nome) {
  const nomeLimpo = String(nome || '').trim();
  if (nomeLimpo) {
    try {
      const raw = await perfilApi.getOrientacoesTemplate(nomeLimpo);
      const parsed = normalizeOrientacoesTemplateResponse(raw);
      if (parsed.length > 0) {
        return parsed.map((row, idx) => ({ ...row, id: newOrientacaoId(), ordem: idx }));
      }
    } catch (e) {
      if (e?.status !== 404 && e?.status !== 400) {
        console.warn(`orientacoes-template (${nomeLimpo}):`, e?.message || e);
      }
    }
  }
  return fallbackOrientacoesFromDefaults([nomeLimpo].filter(Boolean));
}

/** Lista ordenada por `ordem` (estável para linhas sem `ordem`). */
function ordenar(lista) {
  return (Array.isArray(lista) ? lista : [])
    .map((row, idx) => ({ row, idx }))
    .sort((a, b) => (Number(a.row.ordem) || 0) - (Number(b.row.ordem) || 0) || a.idx - b.idx)
    .map((x) => x.row);
}

/** Renumera `ordem` de 0..n-1 na ordem atual. */
function renumerar(lista) {
  return lista.map((row, idx) => ({ ...row, ordem: idx }));
}

function chaveDoItem(item, indice) {
  return item?.itemId != null && item.itemId !== '' ? `id:${item.itemId}` : `idx:${indice}`;
}

function nomeDoItem(item, indice) {
  return String(item?.nome || '').trim() || `Procedimento ${indice + 1}`;
}

function isoToBR(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '').trim());
  if (!m) return '';
  return `${m[3]}/${m[2]}/${m[1]}`;
}

const FORMATO_TS = {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
};

function formatTs(ts, fuso) {
  if (!ts) return '—';
  return formatarInstante(ts, fuso, FORMATO_TS);
}

/**
 * Orientações por item da consulta.
 * `itensOrientacoes[i].orient === null` = nunca definido (carrega o modelo); `[]` = a pessoa limpou (não recarrega).
 * Item `legado` mostra as orientações do procedimento já registrado, só leitura.
 */
export function Step5Finalization({
  procedureDateIso,
  /** Um por linha de procedimento da consulta, na ordem das abas. */
  itensOrientacoes = [],
  /** Grava a lista inteira do item `indice` (o núcleo manda o PATCH). */
  setOrientacoesDoItem = () => {},
  /** Índices dos itens que bloqueiam o encerrar (sem orientação marcada). */
  itensSemOrientacaoMarcada = [],
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
  procedimentosLote = [],
}) {
  const toast = useToast();
  const { fuso } = useAgoraDaClinica();

  const resumoRef = useRef(null);
  /** `"<indice>:<posicao>"` da linha em edição. */
  const [editingKey, setEditingKey] = useState(null);

  const itens = useMemo(
    () => (Array.isArray(itensOrientacoes) ? itensOrientacoes : []),
    [itensOrientacoes],
  );
  const variosItens = itens.length > 1;
  const orientacoesOk = (itensSemOrientacaoMarcada || []).length === 0;

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

  /** Chaves (itemId ou índice) cujo modelo já foi pedido nesta montagem. */
  const modeloPedidoRef = useRef(new Set());
  const montadoRef = useRef(true);
  useEffect(() => {
    montadoRef.current = true;
    return () => {
      montadoRef.current = false;
    };
  }, []);

  useEffect(() => {
    itens.forEach((item, indice) => {
      if (!item || item.legado) return;
      if (item.orient !== null && item.orient !== undefined) return;
      const chave = chaveDoItem(item, indice);
      if (modeloPedidoRef.current.has(chave)) return;
      modeloPedidoRef.current.add(chave);
      (async () => {
        const lista = await carregarModeloDoItem(item.nome);
        if (!montadoRef.current) return;
        setOrientacoesDoItem(indice, lista);
      })();
    });
  }, [itens, setOrientacoesDoItem]);

  const listasOrdenadas = useMemo(() => itens.map((item) => ordenar(item?.orient)), [itens]);

  const limparErro = () => setStep5Errors((e) => ({ ...e, orientacoes: false }));

  const gravar = (indice, lista) => {
    setOrientacoesDoItem(indice, renumerar(lista));
    limparErro();
  };

  const updateRow = (indice, posicao, patch) => {
    const lista = listasOrdenadas[indice] || [];
    gravar(
      indice,
      lista.map((row, idx) => (idx === posicao ? { ...row, ...patch } : row)),
    );
  };

  const removeRow = (indice, posicao) => {
    const lista = listasOrdenadas[indice] || [];
    gravar(
      indice,
      lista.filter((_, idx) => idx !== posicao),
    );
    if (editingKey === `${indice}:${posicao}`) setEditingKey(null);
  };

  const addRow = (indice) => {
    const lista = listasOrdenadas[indice] || [];
    gravar(indice, [...lista, { id: newOrientacaoId(), descricao: '', ordem: lista.length, checado: false }]);
  };

  /** Marcadas de todos os itens, com o nome do item (só quando há mais de um). */
  const blocosMarcados = useMemo(
    () =>
      itens
        .map((item, indice) => ({
          nome: nomeDoItem(item, indice),
          linhas: (listasOrdenadas[indice] || []).filter(
            (i) => i && i.checado && String(i.descricao || '').trim(),
          ),
        }))
        .filter((b) => b.linhas.length > 0),
    [itens, listasOrdenadas],
  );

  const handleWhatsApp = () => {
    const phone = normalizeWaPhoneDigits(telefonePaciente);
    if (!phone) {
      toast.error('Cadastre o telefone do paciente para enviar por WhatsApp.');
      return;
    }
    if (blocosMarcados.length === 0) {
      toast.error('Marque ao menos uma orientação para enviar.');
      return;
    }
    const tituloUnico = variosItens ? '' : blocosMarcados[0]?.nome || nomeProcedimento;
    const header = [
      pacienteNome ? `Olá, ${pacienteNome}!` : 'Olá!',
      tituloUnico ? `Orientações pós — ${tituloUnico}` : 'Orientações pós-procedimento',
    ].join('\n');
    const body = blocosMarcados
      .map((b) => {
        const linhas = b.linhas.map((i) => `• ${String(i.descricao).trim()}`).join('\n');
        return variosItens ? `*${b.nome}*\n${linhas}` : linhas;
      })
      .join('\n\n');
    const texto = `${header}\n\n${body}`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(texto)}`, '_blank', 'noopener,noreferrer');
  };

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
        `Gerado em ${formatarInstante(Date.now(), fuso, FORMATO_TS)}`,
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
          doc.text(formatTs(profAssinaturaTimestamp, fuso), margin + 3, y + sigH + 7);
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
          doc.text(formatTs(patAssinaturaTimestamp, fuso), px + 3, y + sigH + 7);
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

      if (blocosMarcados.length > 0) {
        checkPage(14);
        drawLabel('Orientações Pós-Procedimento');
        blocosMarcados.forEach((bloco) => {
          if (variosItens) {
            checkPage(7);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...dark);
            doc.text(bloco.nome, margin, y);
            y += 5;
          }
          doc.setFontSize(10);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...dark);
          bloco.linhas.forEach((i) => {
            checkPage(6);
            const t = `✓ ${String(i.descricao || '').trim()}`;
            const lines = doc.splitTextToSize(t, contentW);
            doc.text(lines, margin, y);
            y += lines.length * 4.2 + 1;
          });
          if (variosItens) y += 2;
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
              <div className="mt-0.5 text-[11px] text-[#94a3b8]">Gerado em {formatTs(Date.now(), fuso)}</div>
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
                        <div className="mt-0.5 text-[10px] text-[#94a3b8]">{formatTs(profAssinaturaTimestamp, fuso)}</div>
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
                        <div className="mt-0.5 text-[10px] text-[#94a3b8]">{formatTs(patAssinaturaTimestamp, fuso)}</div>
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h4 className="text-[18px] font-bold text-[#0f766e]">Orientações Pós-Procedimento</h4>
          <div className="flex flex-wrap gap-2">
            {!variosItens && itens[0] && !itens[0].legado ? (
              <button
                type="button"
                onClick={() => addRow(0)}
                {...(itens[0].itemId != null && itens[0].itemId !== ''
                  ? { 'data-campo-consulta': `item:${itens[0].itemId}:orient` }
                  : {})}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#00a88e]/40 bg-[#f0fdf9] px-3 py-2 text-[12px] font-bold text-[#0f766e] transition-colors hover:bg-[#e6f7f5]"
              >
                <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                Adicionar orientação
              </button>
            ) : null}
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

        {itens.length === 0 ? (
          <p className="text-[13px] font-medium text-[#64748b]">Carregando orientações…</p>
        ) : null}

        {itens.map((item, indice) => {
          const lista = listasOrdenadas[indice] || [];
          const legado = Boolean(item?.legado);
          const carregando = !legado && (item?.orient === null || item?.orient === undefined);
          const semMarcada = (itensSemOrientacaoMarcada || []).includes(indice);
          // Chave da fila de edição: o hook protege a lista inteira do item enquanto qualquer controle dela tem foco.
          const campoAttr =
            !legado && item?.itemId != null && item.itemId !== ''
              ? { 'data-campo-consulta': `item:${item.itemId}:orient` }
              : {};
          return (
            <section
              key={chaveDoItem(item, indice)}
              data-item-orientacoes={indice}
              className={variosItens ? 'border-t border-[#e2e8f0] pt-5' : ''}
            >
              {variosItens ? (
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <h5 className="text-[15px] font-bold text-[#0f172a]">{nomeDoItem(item, indice)}</h5>
                  {!legado ? (
                    <button
                      type="button"
                      onClick={() => addRow(indice)}
                      {...campoAttr}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#00a88e]/40 bg-[#f0fdf9] px-3 py-2 text-[12px] font-bold text-[#0f766e] transition-colors hover:bg-[#e6f7f5]"
                    >
                      <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                      Adicionar orientação
                    </button>
                  ) : null}
                </div>
              ) : null}
              {legado ? (
                <p className="mb-2 text-[12px] font-medium text-[#64748b]">
                  Orientações do procedimento já registrado
                </p>
              ) : null}
              <div className="space-y-2">
                {carregando ? (
                  <p className="text-[13px] font-medium text-[#64748b]">Carregando orientações…</p>
                ) : lista.length === 0 ? (
                  <p className="text-[13px] font-medium text-[#64748b]">
                    {legado ? 'Sem orientações registradas.' : 'Nenhuma orientação. Adicione uma para continuar.'}
                  </p>
                ) : (
                  lista.map((row, posicao) => {
                    const chave = `${indice}:${posicao}`;
                    if (legado) {
                      return (
                        <div
                          key={row.id ?? chave}
                          className={`flex items-start gap-3 rounded-lg border p-3 ${
                            row.checado ? 'border-[#86efac] bg-[#f0fdf4]' : 'border-[#e2e8f0] bg-[#f8fafc]'
                          }`}
                        >
                          <span
                            role="checkbox"
                            aria-checked={Boolean(row.checado)}
                            aria-disabled="true"
                            className="mt-0.5 shrink-0 rounded p-0.5 text-[#00a88e]"
                          >
                            {row.checado ? (
                              <CheckSquare className="h-5 w-5" strokeWidth={2.5} aria-hidden />
                            ) : (
                              <Square className="h-5 w-5 text-[#94a3b8]" strokeWidth={2.5} aria-hidden />
                            )}
                          </span>
                          <div className="min-w-0 flex-1 px-1 py-0.5 text-[14px] font-medium leading-snug text-[#0f172a]">
                            {row.descricao}
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div
                        key={row.id ?? chave}
                        className={`flex items-start gap-3 rounded-lg border p-3 ${
                          row.checado ? 'border-[#86efac] bg-[#f0fdf4]' : 'border-[#e2e8f0] bg-[#f8fafc]'
                        }`}
                      >
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={Boolean(row.checado)}
                          onClick={() => updateRow(indice, posicao, { checado: !row.checado })}
                          {...campoAttr}
                          className="mt-0.5 shrink-0 rounded p-0.5 text-[#00a88e] outline-none focus-visible:ring-2 focus-visible:ring-[#00a88e]/40"
                        >
                          {row.checado ? (
                            <CheckSquare className="h-5 w-5" strokeWidth={2.5} aria-hidden />
                          ) : (
                            <Square className="h-5 w-5 text-[#94a3b8]" strokeWidth={2.5} aria-hidden />
                          )}
                        </button>
                        <div className="min-w-0 flex-1">
                          {editingKey === chave ? (
                            <textarea
                              value={row.descricao}
                              onChange={(e) => updateRow(indice, posicao, { descricao: e.target.value })}
                              onBlur={() => setEditingKey(null)}
                              {...campoAttr}
                              rows={2}
                              className="w-full resize-y rounded-lg border border-[#00a88e]/40 bg-white px-3 py-2 text-[14px] font-medium text-[#0f172a] outline-none focus:ring-2 focus:ring-[#00a88e]/20"
                              autoFocus
                            />
                          ) : (
                            <button
                              type="button"
                              onClick={() => setEditingKey(chave)}
                              {...campoAttr}
                              className="w-full rounded-lg px-1 py-0.5 text-left text-[14px] font-medium leading-snug text-[#0f172a] hover:bg-black/[0.03]"
                            >
                              {row.descricao ? row.descricao : <span className="text-[#94a3b8]">Clique para editar</span>}
                            </button>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeRow(indice, posicao)}
                          {...campoAttr}
                          className="shrink-0 rounded-lg p-2 text-[#94a3b8] transition-colors hover:bg-red-50 hover:text-red-600"
                          aria-label="Remover orientação"
                        >
                          <Trash2 className="h-4 w-4" strokeWidth={2.5} />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
              {step5Errors.orientacoes && semMarcada ? (
                <p className="mt-2 text-[12px] font-bold text-red-600" role="alert">
                  Marque ao menos uma orientação para continuar.
                </p>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}
