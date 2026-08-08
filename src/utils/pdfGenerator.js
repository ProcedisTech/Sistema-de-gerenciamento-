import { jsPDF } from 'jspdf';
import DOMPurify from 'dompurify';
import { replaceTermVariables } from './replaceTermVariables';

export const generateTermoPdf = async ({
  titulo,
  conteudo,
  assinaturaPaciente,
  assinaturaProfissional,
  metadados,
  fileName = 'termo_de_consentimento.pdf',
  pacienteCtx,
  clinicaCtx,
  profissionalCtx
}) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const margin = 20;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - margin * 2;
  const TEAL = [0, 168, 142];
  
  let y = margin;

  // Cabeçalho Teal
  const headerHeight = 26;
  doc.setFillColor(TEAL[0], TEAL[1], TEAL[2]);
  doc.rect(0, 0, pageWidth, headerHeight, 'F');

  const clinica = clinicaCtx || {};
  const prof = profissionalCtx || {};
  const pac = pacienteCtx || {};

  const nomeClinica = clinica.nome || '[Nome da Clínica]';
  const enderecoClinica = clinica.endereco || '[Endereço da Clínica]';
  const contatoClinica = clinica.telefone || '[Telefone da Clínica]';

  const nomeProfissional = prof.nome || (metadados && metadados.profissionalNome) || '[Nome do Profissional]';
  const cpfCrmProfissional = prof.cpf || prof.crm || '[CPF/CRM do Profissional]';

  const nomePaciente = pac.nome || (metadados && metadados.pacienteNome) || '[Nome do Paciente]';
  const cpfPaciente = pac.cpf || '[CPF do Paciente]';
  const contatoPaciente = pac.telefone || pac.phone || pac.telefoneNumero || '[Telefone do Paciente]';

  // Logo Quadrado Branco
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, 8, 10, 10, 1.5, 1.5, 'D');

  const startX = margin + 14;
  let yQualif = 10;
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  
  doc.setFont('helvetica', 'bold');
  doc.text('CLÍNICA:', startX, yQualif);
  doc.setFont('helvetica', 'normal');
  doc.text(`${nomeClinica} — ${enderecoClinica} — Contato: ${contatoClinica}`, startX + 14, yQualif);
  
  yQualif += 5;
  doc.setFont('helvetica', 'bold');
  doc.text('PROFISSIONAL:', startX, yQualif);
  doc.setFont('helvetica', 'normal');
  doc.text(`${nomeProfissional} — Registro/CPF: ${cpfCrmProfissional}`, startX + 24, yQualif);
  
  yQualif += 5;
  doc.setFont('helvetica', 'bold');
  doc.text('PACIENTE:', startX, yQualif);
  doc.setFont('helvetica', 'normal');
  doc.text(`${nomePaciente} — CPF: ${cpfPaciente} — Contato: ${contatoPaciente}`, startX + 16, yQualif);

  // Faixa Cyan
  const bannerHeight = 12;
  doc.setFillColor(240, 253, 250); 
  doc.rect(0, headerHeight, pageWidth, bannerHeight, 'F');
  doc.setDrawColor(226, 232, 240); 
  doc.setLineWidth(0.3);
  doc.line(0, headerHeight + bannerHeight, pageWidth, headerHeight + bannerHeight);

  doc.setTextColor(15, 23, 42); 
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  const titleText = (titulo || 'Termo de Consentimento LGPD').toUpperCase();
  const titleWidth = doc.getTextWidth(titleText);
  doc.text(titleText, (pageWidth - titleWidth) / 2, headerHeight + 7.5);

  y = headerHeight + bannerHeight + 10; 

  const checkPage = (needed = 10) => {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      doc.setFillColor(TEAL[0], TEAL[1], TEAL[2]);
      doc.rect(0, 0, pageWidth, 10, 'F');
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(255, 255, 255);
      doc.text(`Procedi - ${(titulo || 'Termo de Consentimento').substring(0, 50)} (continuação)`, margin, 7);
      y = margin;
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(11);
    }
  };

  let html = replaceTermVariables(String(conteudo || '').trim(), { pac: pacienteCtx, clinica: clinicaCtx, prof: profissionalCtx });

  // Parse Inteligente de HTML para Array de Parágrafos (Preservando Alinhamento, Indentação e Headings)
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = DOMPurify.sanitize(html);
  
  let paragraphs = [];
  let currentLine = { segments: [], align: 'left', indent: 0, isHeading: false, forceEmpty: false };
  
  const flushLine = () => {
    const hasText = currentLine.segments.some(s => s.text.trim().length > 0);
    if (hasText || currentLine.forceEmpty) {
      paragraphs.push({ ...currentLine });
    }
    currentLine = { segments: [], align: 'left', indent: 0, isHeading: false, forceEmpty: false };
  };

  const traverse = (node, indentLevel = 0, align = 'left', format = { isBold: false, isItalic: false }, listContext = { type: null, index: 0 }) => {
    if (node.nodeType === 3) {
      let text = node.nodeValue.replace(/\n/g, ' ').replace(/\u00A0/g, ' ').replace(/&nbsp;/g, ' ');
      if (text.trim() || text.includes(' ')) {
         if (!text.trim() && currentLine.segments.length > 0) {
            const lastSeg = currentLine.segments[currentLine.segments.length - 1];
            if (lastSeg.text.endsWith(' ')) return;
            text = ' ';
         }
         currentLine.segments.push({ text, isBold: format.isBold, isItalic: format.isItalic });
      }
      return;
    }
    
    if (node.nodeType === 1) {
      const tag = node.tagName.toLowerCase();
      let extraIndent = 0;
      let currentAlign = align;
      
      if (node.className && typeof node.className === 'string') {
        const match = node.className.match(/ql-indent-(\d+)/);
        if (match) extraIndent = parseInt(match[1], 10);
        
        if (node.className.includes('ql-align-center')) currentAlign = 'center';
        else if (node.className.includes('ql-align-right')) currentAlign = 'right';
        else if (node.className.includes('ql-align-justify')) currentAlign = 'justify';
      }
      
      const totalIndent = indentLevel + extraIndent;
      const isBlock = ['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li'].includes(tag);
      
      if (isBlock && currentLine.segments.length > 0) flushLine();
      
      currentLine.align = currentAlign;
      currentLine.indent = totalIndent;
      if (['h1', 'h2', 'h3'].includes(tag)) currentLine.isHeading = true;
      
      const nextFormat = { ...format };
      if (['strong', 'b'].includes(tag)) nextFormat.isBold = true;
      if (['em', 'i'].includes(tag)) nextFormat.isItalic = true;
      if (tag === 'u') nextFormat.isUnderline = true;
      
      if (tag === 'br') {
        currentLine.forceEmpty = true;
        flushLine();
        currentLine.align = currentAlign;
        currentLine.indent = totalIndent;
      } else if (tag === 'ul') {
        listContext = { type: 'ul', index: 0 };
        if (currentLine.segments.length > 0) flushLine();
      } else if (tag === 'ol') {
        listContext = { type: 'ol', index: 1 };
        if (currentLine.segments.length > 0) flushLine();
      } else if (tag === 'li') {
        const prefix = listContext.type === 'ol' ? `${listContext.index++}. ` : '• ';
        currentLine.segments.push({ text: prefix, isBold: nextFormat.isBold, isItalic: nextFormat.isItalic });
        currentLine.indent = totalIndent + 1;
      }
      
      node.childNodes.forEach(child => {
        traverse(child, totalIndent, currentAlign, nextFormat, listContext);
      });
      
      if (isBlock || tag === 'ul' || tag === 'ol') {
        flushLine();
      }
    }
  };

  traverse(tempDiv);
  
  const finalParagraphs = [];
  let emptyCount = 0;
  for (const p of paragraphs) {
    const fullText = p.segments.map(s => s.text).join('').trim();
    if (!fullText) {
      emptyCount++;
      if (emptyCount > 1) continue; 
    } else {
      emptyCount = 0;
    }
    finalParagraphs.push(p);
  }

  doc.setTextColor(0, 0, 0);

  finalParagraphs.forEach(p => {
    const indentOffset = p.indent * 8;
    let availableWidth = maxWidth - indentOffset;
    if (availableWidth < 50) availableWidth = 50;
    
    const fullText = p.segments.map(s => s.text).join('');
    
    doc.setFont('helvetica', p.isHeading ? 'bold' : 'normal');
    doc.setFontSize(p.isHeading ? 13 : 11);
    
    const wrappedLines = doc.splitTextToSize(fullText, availableWidth);
    
    let globalCharIndex = 0;
    
    wrappedLines.forEach((wLine, lineIdx) => {
      checkPage(7);
      
      let xPos = margin + indentOffset;
      const lineWidth = doc.getTextWidth(wLine);
      
      if (p.align === 'center') {
        xPos = (pageWidth - lineWidth) / 2;
      } else if (p.align === 'right') {
        xPos = pageWidth - margin - lineWidth;
      }
      
      if (wLine.trim() || p.forceEmpty) {
        let lineCharsRemaining = wLine.length;
        
        while (lineCharsRemaining > 0 && globalCharIndex < fullText.length) {
          let segIndex = 0;
          let charsBeforeSeg = 0;
          for (let i = 0; i < p.segments.length; i++) {
            if (globalCharIndex < charsBeforeSeg + p.segments[i].text.length) {
              segIndex = i;
              break;
            }
            charsBeforeSeg += p.segments[i].text.length;
          }
          
          const seg = p.segments[segIndex];
          if (!seg) break;
          
          const offsetInSeg = globalCharIndex - charsBeforeSeg;
          const charsFromSeg = Math.min(lineCharsRemaining, seg.text.length - offsetInSeg);
          const textToDraw = seg.text.substr(offsetInSeg, charsFromSeg);
          
          doc.setFont('helvetica', seg.isBold || p.isHeading ? 'bold' : (seg.isItalic ? 'italic' : 'normal'));
          doc.text(textToDraw, xPos, y);
          xPos += doc.getTextWidth(textToDraw);
          
          globalCharIndex += charsFromSeg;
          lineCharsRemaining -= charsFromSeg;
        }
        
        const nextWLine = wrappedLines[lineIdx + 1];
        if (nextWLine) {
           const nextIdx = fullText.indexOf(nextWLine, globalCharIndex);
           if (nextIdx !== -1 && nextIdx - globalCharIndex <= 5) {
              globalCharIndex = nextIdx;
           }
        }

        y += p.isHeading ? 8 : 6;
      }
    });
  });

  y += 10;
  checkPage(50);

  // Assinaturas
  const sigWidth = 80;
  const sigHeight = 35;
  const gap = 15;
  
  if (assinaturaPaciente && assinaturaPaciente.startsWith('data:image')) {
    try { doc.addImage(assinaturaPaciente, 'PNG', margin, y, sigWidth, sigHeight); } catch { /* ignore */ }
  } else if (metadados?.recusado || assinaturaPaciente === 'RECUSADO') {
    doc.setTextColor(220, 38, 38);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('RECUSADO PELO PACIENTE', margin, y + sigHeight / 2);
    doc.setTextColor(0, 0, 0);
  } else {
    doc.line(margin, y + sigHeight, margin + sigWidth, y + sigHeight);
  }

  if (assinaturaProfissional && assinaturaProfissional.startsWith('data:image')) {
    try { doc.addImage(assinaturaProfissional, 'PNG', margin + sigWidth + gap, y, sigWidth, sigHeight); } catch { /* ignore */ }
  } else {
    doc.line(margin + sigWidth + gap, y + sigHeight, margin + sigWidth * 2 + gap, y + sigHeight);
  }

  y += sigHeight + 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`Paciente: ${metadados?.pacienteNome || '____________________'}`, margin, y);
  doc.text(`Profissional: ${metadados?.profissionalNome || '____________________'}`, margin + sigWidth + gap, y);
  
  y += 15;
  if (metadados?.dataHora || metadados?.ipAddress) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(100);
    let footerText = 'Documento assinado digitalmente.';
    if (metadados?.dataHora) footerText += ` Data/Hora: ${metadados.dataHora}.`;
    if (metadados?.ipAddress) footerText += ` IP: ${metadados.ipAddress}.`;
    doc.text(footerText, margin, y);
  }

  doc.save(fileName);
};

/** Nome de arquivo seguro pra filesystem: remove caracteres reservados do Windows, troca espaço por `_`. */
function buildFichaFileName(nomePaciente) {
  const dataStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const nomeSafe = String(nomePaciente || 'paciente')
    .trim()
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, '_');
  return `ficha_${nomeSafe || 'paciente'}_${dataStr}.pdf`;
}

/** Texto seguro: `null`/`undefined`/vazio (após trim) vira o fallback. */
function safe(value, fallback = '—') {
  const s = value == null ? '' : String(value).trim();
  return s || fallback;
}

/**
 * Ficha do Paciente (v2), em A4, seguindo o leiaute editorial minimalista do design
 * handoff ("Ficha do Paciente v2.dc.html"): preto/branco/cinza, cabeçalho fino,
 * grade de identificação, seções numeradas finas (sem badges/caixas coloridas),
 * assinaturas e rodapé LGPD. Anotações internas nunca aparecem nesta ficha — é
 * sempre a via do paciente.
 *
 * Todo campo de texto já deve chegar pronto pra exibição (formatado/traduzido pelo
 * chamador) — esta função só posiciona texto e aplica fallback "—" em campo vazio.
 * `canSeeProntuario` controla a presença das seções clínicas inteiras.
 */
export const generateFichaPacientePdf = ({
  fileName,
  clinicaCtx,
  pacienteCtx,
  numeroProntuario,
  dataCadastroDisplay,
  estatisticas,
  canSeeProntuario,
  perfilClinico,
  historico,
  prescricoes,
}) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const margin = 20;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - margin * 2;
  const INK = [26, 26, 26];
  const GRAY = [118, 118, 118];
  const BORDER = [230, 230, 230];
  const ROW_BORDER = [240, 240, 240];

  const clinica = clinicaCtx || {};
  const pac = pacienteCtx || {};
  const est = estatisticas || {};
  const perfil = perfilClinico || {};
  const hist = historico || {};
  const plano = hist.planoAtivo || {};

  let y = margin;

  const checkPage = (needed = 10) => {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.setTextColor(...GRAY);
      doc.text(`Ficha do paciente — ${safe(pac.nome, 'Paciente')} (continuação)`, margin, 12);
      doc.setDrawColor(...BORDER);
      doc.setLineWidth(0.3);
      doc.line(margin, 14, pageWidth - margin, 14);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(...INK);
      y = margin;
    }
  };

  /** Símbolo Procedi (3 nós) — mesmo desenho de `ProcediSymbol.jsx`/`favicon.svg`,
   *  redesenhado com primitivas do jsPDF (2 linhas + 3 círculos) pra ficar vetorial
   *  no PDF, sem precisar embutir imagem. viewBox original é 32×32. */
  const drawProcediSymbol = (x, yTop, size) => {
    const s = size / 32;
    const sx = (v) => x + v * s;
    const sy = (v) => yTop + v * s;
    doc.setDrawColor(15, 81, 50);
    doc.setLineWidth(2.6 * s);
    doc.line(sx(16), sy(8), sx(16), sy(16));
    doc.line(sx(16), sy(16), sx(16), sy(24));
    doc.circle(sx(16), sy(8), 5 * s, 'S');
    doc.setFillColor(13, 122, 95);
    doc.circle(sx(16), sy(16), 6 * s, 'F');
    doc.setFillColor(10, 46, 35);
    doc.circle(sx(16), sy(24), 5 * s, 'F');
  };

  // ── Cabeçalho fino ────────────────────────────────────────────────
  const logoSize = 9;
  drawProcediSymbol(margin, margin - 2, logoSize);
  const dividerX = margin + logoSize + 4;
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.line(dividerX, margin - 2, dividerX, margin - 2 + logoSize);
  const headerTextX = dividerX + 4;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...INK);
  doc.text(safe(clinica.nome, 'Clínica'), headerTextX, y);
  const fichaTitle = 'FICHA DO PACIENTE';
  doc.text(fichaTitle, pageWidth - margin - doc.getTextWidth(fichaTitle), y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  const enderecoTelefone = [clinica.endereco, clinica.telefone].filter(Boolean).join(' · ');
  if (enderecoTelefone) doc.text(enderecoTelefone, headerTextX, y);
  const emitidaEm = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const nLabel = `Nº ${safe(numeroProntuario)} · emitida em ${emitidaEm}`;
  doc.text(nLabel, pageWidth - margin - doc.getTextWidth(nLabel), y);
  y += 4;
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  doc.setTextColor(...INK);
  y += 10;

  // ── Helpers de layout ───────────────────────────────────────────
  const colWidth = (maxWidth - 10) / 2;

  /** Cabeçalho de seção numerada: número mono-cinza + título maiúsculo + borda inferior. */
  const drawSectionHeader = (number, title, note) => {
    checkPage(12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.text(number, margin, y);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...INK);
    doc.text(title.toUpperCase(), margin + 10, y);
    if (note) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...GRAY);
      doc.text(note, pageWidth - margin - doc.getTextWidth(note), y);
    }
    y += 2.5;
    doc.setDrawColor(...INK);
    doc.setLineWidth(0.4);
    doc.line(margin, y, pageWidth - margin, y);
    doc.setTextColor(...INK);
    y += 7;
  };

  /** Grade de 2 colunas de rótulo/valor — cada par vira uma linha (com borda fina
   *  embaixo, como o design), com wrap dinâmico pra valores longos. */
  const drawFieldGrid = (pairs) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    for (let i = 0; i < pairs.length; i += 2) {
      const leftWrapped = doc.splitTextToSize(safe(pairs[i][1]), colWidth);
      const rightWrapped = pairs[i + 1] ? doc.splitTextToSize(safe(pairs[i + 1][1]), colWidth) : [];
      const lineCount = Math.max(leftWrapped.length, rightWrapped.length, 1);
      const rowHeight = 5 + lineCount * 4.2 + 2;
      checkPage(rowHeight);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(...GRAY);
      doc.text(pairs[i][0].toUpperCase(), margin, y);
      const x2 = margin + colWidth + 10;
      if (pairs[i + 1]) doc.text(pairs[i + 1][0].toUpperCase(), x2, y);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(...INK);
      leftWrapped.forEach((line, li) => doc.text(line, margin, y + 5 + li * 4.2));
      if (pairs[i + 1]) rightWrapped.forEach((line, li) => doc.text(line, x2, y + 5 + li * 4.2));

      y += rowHeight;
      doc.setDrawColor(...ROW_BORDER);
      doc.setLineWidth(0.25);
      doc.line(margin, y - 2, pageWidth - margin, y - 2);
    }
    y += 3;
  };

  /** Tabela simples com cabeçalho cinza e linhas separadas por borda fina (sem zebra). */
  const drawTable = (columns, rows, emptyLabel) => {
    checkPage(10);
    const colWidths = columns.map((c) => c.width);
    let cx = margin;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...GRAY);
    columns.forEach((c, i) => {
      doc.text(c.label.toUpperCase(), cx, y);
      cx += colWidths[i];
    });
    y += 4;
    doc.setDrawColor(...ROW_BORDER);
    doc.setLineWidth(0.3);
    doc.line(margin, y - 2.5, pageWidth - margin, y - 2.5);

    if (!rows || rows.length === 0) {
      checkPage(6);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(...GRAY);
      doc.text(emptyLabel, margin, y);
      doc.setTextColor(...INK);
      y += 7;
      return;
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    rows.forEach((row) => {
      const cellLines = columns.map((c, i) => doc.splitTextToSize(safe(row[c.key]), colWidths[i] - 3));
      const lineCount = Math.max(...cellLines.map((l) => l.length), 1);
      checkPage(lineCount * 4.2 + 2);
      cx = margin;
      doc.setTextColor(...INK);
      columns.forEach((c, i) => {
        cellLines[i].forEach((line, li) => doc.text(line, cx, y + li * 4.2));
        cx += colWidths[i];
      });
      y += lineCount * 4.2 + 2;
      doc.setDrawColor(...ROW_BORDER);
      doc.line(margin, y - 1.5, pageWidth - margin, y - 1.5);
    });
    y += 3;
  };

  // ── Identificação (sem número de seção) ──────────────────────────
  const enderecoLinha = [pac.logradouroDisplay, pac.numeroDisplay].filter(Boolean).join(', ');
  const enderecoValue = [enderecoLinha, pac.bairroDisplay].filter(Boolean).join(' · ');
  const cidadeCepValue = [
    [pac.cidadeDisplay, pac.ufDisplay].filter(Boolean).join('/'),
    pac.cepDisplay,
  ]
    .filter(Boolean)
    .join(' · ');

  drawFieldGrid([
    ['Nome completo', pac.nome],
    ['Nome social', pac.nomeSocialDisplay],
    ['Sexo', pac.sexoDisplay],
    ['Gênero', pac.generoDisplay],
    ['Nascimento', pac.nascimentoDisplay ? `${pac.nascimentoDisplay} · ${safe(pac.idadeDisplay)}` : ''],
    ['CPF', pac.cpfDisplay],
    ['Telefone', pac.telefoneDisplay],
    ['E-mail', pac.emailDisplay],
    ['Endereço', enderecoValue],
    ['Cidade / CEP', cidadeCepValue],
    ['Profissão', pac.profissaoDisplay],
    ['Emergência', pac.contatoEmergenciaDisplay],
    ['Paciente desde', dataCadastroDisplay],
    ['Indicação', pac.origemIndicacaoDisplay],
  ]);

  // ── Seção 01 — Alertas clínicos ───────────────────────────────────
  if (canSeeProntuario) {
    drawSectionHeader('01', 'Alertas clínicos', 'verificar antes de qualquer procedimento');
    drawFieldGrid([
      ['Alergias alimentares', (perfil.alergias || []).map((i) => i.nome).join('; ')],
      ['Alergias medicamentosas', (perfil.alergiasPrincipioAtivo || []).map((i) => i.nome).join('; ')],
      ['Medicamentos em uso', (perfil.medicamentosEmUso || []).map((i) => i.nome).join('; ')],
      ['Antecedentes', (perfil.antecedentes || []).map((i) => i.nome).join('; ')],
      ['Gestação / lactação', (perfil.gestacaoLactacao || []).map((i) => i.nome).join('; ')],
    ]);
  }

  // ── Seção 02 — Histórico de atendimentos ─────────────────────────
  if (canSeeProntuario) {
    checkPage(28); // reserva espaço pro título + cabeçalho da tabela ficarem juntos, sem orfanato de seção
    drawSectionHeader('02', 'Histórico de atendimentos');
    drawTable(
      [
        { key: 'dataDisplay', label: 'Data', width: 22 },
        { key: 'nome', label: 'Procedimento', width: 42 },
        { key: 'regiaoDisplay', label: 'Região e técnica', width: 42 },
        { key: 'profissional', label: 'Profissional', width: 35 },
        { key: 'intercorrenciaDisplay', label: 'Intercorrência', width: maxWidth - 22 - 42 - 42 - 35 },
      ],
      hist.procedimentos,
      'Nenhum procedimento registrado'
    );

    const planoCols = [
      ['Plano ativo', plano.nomeDisplay],
      ['Sessões', plano.sessoesTotal ? `${plano.sessoesFeitas} de ${plano.sessoesTotal}` : ''],
      ['Manutenção', plano.manutencaoSugeridaDisplay],
    ];
    const pcw = maxWidth / planoCols.length;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const planoWraps = planoCols.map(([, value]) => doc.splitTextToSize(safe(value), pcw - 4));
    const planoLineCount = Math.max(...planoWraps.map((w) => w.length), 1);
    checkPage(5 + planoLineCount * 4.2);
    planoCols.forEach(([label], i) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(...GRAY);
      doc.text(label.toUpperCase(), margin + i * pcw, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...INK);
      planoWraps[i].forEach((line, li) => doc.text(line, margin + i * pcw, y + 5 + li * 4.2));
    });
    y += 5 + planoLineCount * 4.2 + 6;
  }

  // ── Seção 03 — Prescrições e orientações ─────────────────────────
  if (canSeeProntuario) {
    drawSectionHeader('03', 'Prescrições e orientações');
    if (!prescricoes || prescricoes.length === 0) {
      checkPage(7);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(...GRAY);
      doc.text('Nenhuma prescrição registrada', margin, y);
      doc.setTextColor(...INK);
      y += 9;
    } else {
      const leftColW = 54;
      const leftLineH = 4.2;
      prescricoes.forEach((p) => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        const titleWrapped = doc.splitTextToSize(safe(p.titulo, 'Procedimento'), leftColW);
        const orientWrapped = doc.splitTextToSize(safe(p.orientacoes), maxWidth - 68);

        const leftHeight = titleWrapped.length * leftLineH + leftLineH * 2 + 4;
        const rightHeight = orientWrapped.length * 4.6;
        const blockHeight = Math.max(leftHeight, rightHeight, 14);
        checkPage(blockHeight + 8);
        const blockTop = y;

        let ly = y;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(...INK);
        titleWrapped.forEach((line) => {
          doc.text(line, margin, ly);
          ly += leftLineH;
        });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(...GRAY);
        doc.text(safe(p.dataDisplay), margin, ly);
        ly += leftLineH;
        doc.text([p.profissional, p.registroProfissional].filter(Boolean).join(' · ') || '—', margin, ly);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(...INK);
        orientWrapped.forEach((line, i) => doc.text(line, margin + 66, blockTop + i * 4.6));

        y = blockTop + blockHeight + 4;
        doc.setDrawColor(...ROW_BORDER);
        doc.setLineWidth(0.3);
        doc.line(margin, y - 2, pageWidth - margin, y - 2);
      });
    }
  }

  // ── Assinaturas ───────────────────────────────────────────────────
  checkPage(30);
  y += 8;
  const sigColW = (maxWidth - 40) / 2;
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.4);
  doc.line(margin, y + 14, margin + sigColW, y + 14);
  doc.line(margin + sigColW + 40, y + 14, margin + sigColW * 2 + 40, y + 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  const respTecLabel = `Responsável técnico · ${safe(est.responsavelTecnicoNome)} · ${safe(est.responsavelTecnicoRegistro)}`;
  doc.text(doc.splitTextToSize(respTecLabel, sigColW), margin, y + 19);
  doc.text(`Paciente · ${safe(pac.nome)}`, margin + sigColW + 40, y + 19);
  doc.setTextColor(...INK);
  y += 26;

  // ── Rodapé LGPD ───────────────────────────────────────────────────
  checkPage(20);
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  const numLabel = `Nº ${safe(numeroProntuario)}`;
  doc.text(numLabel, pageWidth - margin - doc.getTextWidth(numLabel), y);
  const lgpdText =
    'Documento sigiloso. O paciente é titular dos seus dados e pode solicitar cópia, correção ou portabilidade conforme a LGPD (Lei 13.709/2018).';
  const lgpdWrapped = doc.splitTextToSize(lgpdText, maxWidth - 35);
  lgpdWrapped.forEach((line) => {
    checkPage(4.5);
    doc.text(line, margin, y);
    y += 4.2;
  });
  doc.setTextColor(...INK);

  // ── Rodapé de página (nome clínica + data/hora + "Página X de Y") ──
  const geradoEm = new Date().toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(100);
    doc.text(`${safe(clinica.nome, 'Clínica')} — Gerado em ${geradoEm}`, margin, pageHeight - 10);
    const pageLabel = `Página ${i} de ${totalPages}`;
    const pageLabelWidth = doc.getTextWidth(pageLabel);
    doc.text(pageLabel, pageWidth - margin - pageLabelWidth, pageHeight - 10);
    doc.setTextColor(0, 0, 0);
  }

  doc.save(fileName || buildFichaFileName(pac.nome));
};
