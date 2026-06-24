import { jsPDF } from 'jspdf';
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
  tempDiv.innerHTML = html;
  
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
