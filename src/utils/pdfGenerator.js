import { jsPDF } from 'jspdf';

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

  // Processar HTML rico e placeholders
  let html = String(conteudo || '').trim();
  html = html
    .replace(/\[NOME DO PACIENTE\]/gi, nomePaciente)
    .replace(/\[CPF DO PACIENTE\]/gi, cpfPaciente)
    .replace(/\[NOME DA CLÍNICA\]/gi, nomeClinica)
    .replace(/\[CNPJ DA CLÍNICA\]/gi, clinica.cnpj || '[CNPJ DA CLÍNICA]')
    .replace(/\[NOME DO PROFISSIONAL\]/gi, nomeProfissional);

  // Parse Inteligente de HTML para Array de Parágrafos (Preservando Alinhamento, Indentação e Headings)
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = html;
  
  let paragraphs = [];
  let currentLine = { text: '', align: 'left', indent: 0, isHeading: false, forceEmpty: false };
  
  const flushLine = () => {
    const trimmed = currentLine.text.trim();
    if (trimmed || currentLine.forceEmpty) {
      paragraphs.push({ ...currentLine });
    }
    currentLine = { text: '', align: 'left', indent: 0, isHeading: false, forceEmpty: false };
  };

  const traverse = (node, indentLevel = 0, align = 'left', listContext = { type: null, index: 0 }) => {
    if (node.nodeType === 3) {
      const text = node.nodeValue;
      if (text.trim()) {
         currentLine.text += text.replace(/\n/g, ' ');
      } else if (text.includes(' ') && currentLine.text.length > 0 && !currentLine.text.endsWith(' ')) {
         currentLine.text += ' ';
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
      
      if (isBlock && currentLine.text.length > 0) flushLine();
      
      currentLine.align = currentAlign;
      currentLine.indent = totalIndent;
      if (['h1', 'h2', 'h3'].includes(tag)) currentLine.isHeading = true;
      
      if (tag === 'br') {
        currentLine.forceEmpty = true;
        flushLine();
        currentLine.align = currentAlign;
        currentLine.indent = totalIndent;
      } else if (tag === 'ul') {
        listContext = { type: 'ul', index: 0 };
        if (currentLine.text.length > 0) flushLine();
      } else if (tag === 'ol') {
        listContext = { type: 'ol', index: 1 };
        if (currentLine.text.length > 0) flushLine();
      } else if (tag === 'li') {
        const prefix = listContext.type === 'ol' ? `${listContext.index++}. ` : '• ';
        currentLine.text += prefix;
        currentLine.indent = totalIndent + 1; // Recuo extra visual para itens de lista
      }
      
      node.childNodes.forEach(child => {
        traverse(child, totalIndent, currentAlign, listContext);
      });
      
      if (isBlock || tag === 'ul' || tag === 'ol') {
        flushLine();
      }
    }
  };

  traverse(tempDiv);
  
  // Limpar quebras de linha múltiplas consecutivas
  const finalParagraphs = [];
  let emptyCount = 0;
  for (const p of paragraphs) {
    if (!p.text.trim()) {
      emptyCount++;
      if (emptyCount > 1) continue; 
    } else {
      emptyCount = 0;
    }
    finalParagraphs.push(p);
  }

  // Renderizar o texto extraído no PDF aplicando propriedades dinâmicas
  doc.setTextColor(0, 0, 0);

  finalParagraphs.forEach(p => {
    // Calculamos o x real e a largura máxima permitida para essa linha
    const indentOffset = p.indent * 8; // 8mm por nível de indentação
    let availableWidth = maxWidth - indentOffset;
    if (availableWidth < 50) availableWidth = 50; // limite de segurança
    
    // Configurar fonte caso seja um cabeçalho
    doc.setFont('helvetica', p.isHeading ? 'bold' : 'normal');
    doc.setFontSize(p.isHeading ? 13 : 11);
    
    // Quebrar o texto considerando o espaço livre
    const wrappedLines = doc.splitTextToSize(p.text, availableWidth);
    
    wrappedLines.forEach(wLine => {
      checkPage(7);
      
      let xPos = margin + indentOffset;
      let alignOption = 'left';
      
      if (p.align === 'center') {
        xPos = pageWidth / 2;
        alignOption = 'center';
      } else if (p.align === 'right') {
        xPos = pageWidth - margin;
        alignOption = 'right';
      }
      
      // Renderizar linha vazia ou texto
      if (wLine.trim() || p.forceEmpty) {
        if (wLine.trim()) doc.text(wLine, xPos, y, { align: alignOption });
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
