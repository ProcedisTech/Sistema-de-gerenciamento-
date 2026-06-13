import { jsPDF } from 'jspdf';

export const generateTermoPdf = async ({
  titulo,
  conteudo,
  assinaturaPaciente, // dataUrl
  assinaturaProfissional, // dataUrl
  metadados, // { pacienteNome, profissionalNome, ipAddress, dataHora }
  fileName = 'termo_de_consentimento.pdf',
  pacienteCtx,
  clinicaCtx,
  profissionalCtx
}) => {
  // Inicializa o jsPDF (retrato, mm, A4)
  const doc = new jsPDF('p', 'mm', 'a4');
  
  const margin = 20;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - margin * 2;
  const TEAL = [0, 168, 142];
  
  let y = margin;

  // Cabeçalho (Header) Teal
  const headerHeight = 26;
  doc.setFillColor(TEAL[0], TEAL[1], TEAL[2]);
  doc.rect(0, 0, pageWidth, headerHeight, 'F');

  // Qualificação (Extração de Dados)
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

  // Logo (Escudo simulado)
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, 8, 10, 10, 1.5, 1.5, 'D');

  // Textos de Qualificação (Brancos dentro do Teal)
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

  // Faixa do Título (Light Cyan)
  const bannerHeight = 12;
  doc.setFillColor(240, 253, 250); // #f0fdfa
  doc.rect(0, headerHeight, pageWidth, bannerHeight, 'F');

  // Borda inferior da faixa
  doc.setDrawColor(226, 232, 240); // #e2e8f0
  doc.setLineWidth(0.3);
  doc.line(0, headerHeight + bannerHeight, pageWidth, headerHeight + bannerHeight);

  // Texto do Título Centralizado
  doc.setTextColor(15, 23, 42); // #0f172a
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  const titleText = (titulo || 'Termo de Consentimento LGPD').toUpperCase();
  const titleWidth = doc.getTextWidth(titleText);
  doc.text(titleText, (pageWidth - titleWidth) / 2, headerHeight + 7.5);

  y = headerHeight + bannerHeight + 10; // Espaço inicial do conteúdo

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
    }
  };

  // Substituir placeholders
  let conteudoTexto = String(conteudo || '').trim();
  conteudoTexto = conteudoTexto
    .replace(/\[NOME DO PACIENTE\]/gi, nomePaciente)
    .replace(/\[CPF DO PACIENTE\]/gi, cpfPaciente)
    .replace(/\[NOME DA CLÍNICA\]/gi, nomeClinica)
    .replace(/\[CNPJ DA CLÍNICA\]/gi, clinica.cnpj || '[CNPJ DA CLÍNICA]')
    .replace(/\[NOME DO PROFISSIONAL\]/gi, nomeProfissional);

  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);

  const textLines = doc.splitTextToSize(conteudoTexto, maxWidth);
  
  // Imprimir linhas cuidando de page break
  textLines.forEach(line => {
    checkPage(6);
    doc.text(line, margin, y);
    y += 6;
  });

  y += 10;

  // Assinaturas
  checkPage(50);

  const sigWidth = 80;
  const sigHeight = 35;
  const gap = 15;
  
  // Assinatura do Paciente
  if (assinaturaPaciente && assinaturaPaciente.startsWith('data:image')) {
    try {
      doc.addImage(assinaturaPaciente, 'PNG', margin, y, sigWidth, sigHeight);
    } catch (e) {
      console.error('Erro ao adicionar img assinatura paciente', e);
    }
  } else if (metadados?.recusado || assinaturaPaciente === 'RECUSADO') {
    doc.setTextColor(220, 38, 38); // red-600
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('RECUSADO PELO PACIENTE', margin, y + sigHeight / 2);
    doc.setTextColor(0, 0, 0);
  } else {
    // Linha em branco
    doc.line(margin, y + sigHeight, margin + sigWidth, y + sigHeight);
  }

  // Assinatura do Profissional
  if (assinaturaProfissional) {
    try {
      doc.addImage(assinaturaProfissional, 'PNG', margin + sigWidth + gap, y, sigWidth, sigHeight);
    } catch (e) {
      console.error('Erro ao adicionar img assinatura profissional', e);
    }
  } else {
    // Linha em branco
    doc.line(margin + sigWidth + gap, y + sigHeight, margin + sigWidth * 2 + gap, y + sigHeight);
  }

  y += sigHeight + 5;

  // Labels das assinaturas
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  
  doc.text(`Paciente: ${metadados?.pacienteNome || '____________________'}`, margin, y);
  doc.text(`Profissional: ${metadados?.profissionalNome || '____________________'}`, margin + sigWidth + gap, y);
  
  y += 15;

  // Metadados Jurídicos (Auditoria)
  if (metadados?.dataHora || metadados?.ipAddress) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(100);
    
    let footerText = 'Documento assinado digitalmente.';
    if (metadados?.dataHora) footerText += ` Data/Hora: ${metadados.dataHora}.`;
    if (metadados?.ipAddress) footerText += ` IP: ${metadados.ipAddress}.`;
    
    doc.text(footerText, margin, y);
  }

  // Baixa o arquivo
  doc.save(fileName);
};
