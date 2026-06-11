import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const generateAnamnesePdf = (anamnese, clinicaCtx = {}, pacienteCtx = {}, profissionalCtx = {}) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  
  const margin = 20;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - margin * 2;
  const TEAL = [0, 168, 142];
  
  let y = margin;

  // ==========================================
  // Cabeçalho (Header) Teal
  // ==========================================
  const headerHeight = 26;
  doc.setFillColor(TEAL[0], TEAL[1], TEAL[2]);
  doc.rect(0, 0, pageWidth, headerHeight, 'F');

  // Qualificação
  const nomeClinica = clinicaCtx.nome || clinicaCtx.nome_fantasia || 'CLÍNICA';
  const enderecoClinica = clinicaCtx.endereco ? `${clinicaCtx.endereco.logradouro || ''}, ${clinicaCtx.endereco.numero || ''} - ${clinicaCtx.endereco.cidade || ''}` : '';
  const contatoClinica = clinicaCtx.telefone || '';

  const nomeProfissional = profissionalCtx.nome || anamnese.profissionalNome || 'Profissional';
  const cpfCrmProfissional = profissionalCtx.cpf || profissionalCtx.crm || ''; 

  const nomePaciente = pacienteCtx.nome || anamnese.pacienteNome || '[Nome do Paciente]';
  const cpfPaciente = pacienteCtx.cpf || '';
  const contatoPaciente = pacienteCtx.telefone || pacienteCtx.telefoneNumero || '';
  const nascimentoPaciente = pacienteCtx.dataNascimento ? new Date(pacienteCtx.dataNascimento + 'T12:00:00Z').toLocaleDateString('pt-BR') : '';

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
  doc.text(`${nomeClinica} ${enderecoClinica ? `— ${enderecoClinica}` : ''} ${contatoClinica ? `— Contato: ${contatoClinica}` : ''}`, startX + 14, yQualif);
  
  yQualif += 5;
  doc.setFont('helvetica', 'bold');
  doc.text('PROFISSIONAL:', startX, yQualif);
  doc.setFont('helvetica', 'normal');
  doc.text(`${nomeProfissional} ${cpfCrmProfissional ? `— Registro/CPF: ${cpfCrmProfissional}` : ''}`, startX + 24, yQualif);
  
  yQualif += 5;
  doc.setFont('helvetica', 'bold');
  doc.text('PACIENTE:', startX, yQualif);
  doc.setFont('helvetica', 'normal');
  doc.text(`${nomePaciente} ${cpfPaciente ? `— CPF: ${cpfPaciente}` : ''} ${contatoPaciente ? `— Contato: ${contatoPaciente}` : ''} ${nascimentoPaciente ? `— Nasc: ${nascimentoPaciente}` : ''}`, startX + 16, yQualif);

  // ==========================================
  // Faixa do Título (Light Cyan)
  // ==========================================
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
  const titleText = `ANAMNESE: ${anamnese.anamneseNome || 'Preenchida'}`.toUpperCase();
  const titleWidth = doc.getTextWidth(titleText);
  doc.text(titleText, (pageWidth - titleWidth) / 2, headerHeight + 7.5);

  y = headerHeight + bannerHeight + 10; // Espaço inicial do conteúdo

  // Data e Status
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const dataPreenchimento = anamnese.dataHora ? new Date(anamnese.dataHora).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
  doc.text(`Data: ${dataPreenchimento}   |   Status: ${anamnese.status || '-'}   |   Preenchido por: ${anamnese.respondidoPeloPaciente ? 'Paciente (via Link Público)' : anamnese.profissionalNome}`, margin, y);
  y += 10;

  const checkPage = (needed = 10) => {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      doc.setFillColor(TEAL[0], TEAL[1], TEAL[2]);
      doc.rect(0, 0, pageWidth, 10, 'F');
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(255, 255, 255);
      doc.text(`Procedi - Anamnese (continuação)`, margin, 7);
      y = margin + 5;
      doc.setTextColor(0, 0, 0);
    }
  };

  // ==========================================
  // Respostas da Anamnese
  // ==========================================
  const tableData = [];
  if (anamnese.respostasTratadas && anamnese.respostasTratadas.length > 0) {
    anamnese.respostasTratadas.forEach(resp => {
      tableData.push([resp.pergunta, resp.resposta]);
    });
  } else {
    tableData.push(['Nenhuma resposta registrada', '']);
  }

  autoTable(doc, {
    startY: y,
    head: [['Pergunta', 'Resposta']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: TEAL, textColor: 255 },
    styles: { fontSize: 10, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 'auto' },
    },
    margin: { left: margin, right: margin },
    didDrawPage: (data) => {
      // Ajusta Y ao finalizar tabela
      y = data.cursor.y;
    }
  });

  y = doc.lastAutoTable ? doc.lastAutoTable.finalY + 10 : y + 10;

  // ==========================================
  // Observações Extras
  // ==========================================
  if (anamnese.observacoes) {
    checkPage(30);
    doc.setFont('helvetica', 'bold');
    doc.text('Observações:', margin, y);
    doc.setFont('helvetica', 'normal');
    const obsLines = doc.splitTextToSize(anamnese.observacoes, maxWidth);
    doc.text(obsLines, margin, y + 7);
    y += 15 + (doc.getTextDimensions(anamnese.observacoes).h);
  }

  // ==========================================
  // Assinaturas
  // ==========================================
  if (anamnese.assinaturaPaciente) {
    checkPage(60);
    y += 10;
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Termo de Responsabilidade e Assinatura:', margin, y);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const termText = "Declaro que as informações acima prestadas são verdadeiras e assumo inteira responsabilidade pelas mesmas.";
    doc.text(termText, margin, y + 6, { maxWidth });
    
    y += 15;

    const sigWidth = 80;
    const sigHeight = 35;
    
    try {
      doc.addImage(anamnese.assinaturaPaciente, 'PNG', margin, y, sigWidth, sigHeight);
    } catch (e) {
      console.error('Erro ao adicionar img assinatura paciente', e);
    }

    y += sigHeight + 5;
    
    doc.line(margin, y, margin + sigWidth, y);
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`Paciente: ${anamnese.pacienteNome || '____________________'}`, margin, y + 5);
    
    y += 15;
  }

  // ==========================================
  // Metadados Jurídicos (Auditoria)
  // ==========================================
  if (anamnese.dataHora || anamnese.ipAddress) {
    checkPage(20);
    y += 5;
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(50);
    doc.text('Registro de Auditoria Digital', margin, y);
    
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100);
    
    if (anamnese.dataHora) {
      doc.text(`Data e Hora: ${new Date(anamnese.dataHora).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}`, margin, y);
      y += 4;
    }
    if (anamnese.ipAddress) {
      doc.text(`Endereço IP: ${anamnese.ipAddress}`, margin, y);
      y += 4;
    }
    if (anamnese.userAgent) {
      doc.text(`Dispositivo: ${anamnese.userAgent.substring(0, 80)}`, margin, y);
      y += 4;
    }
  }

  // ==========================================
  // Salva o PDF
  // ==========================================
  const dataHoje = new Date();
  const dataString = `${String(dataHoje.getDate()).padStart(2, '0')}${String(dataHoje.getMonth() + 1).padStart(2, '0')}${dataHoje.getFullYear()}`;
  const filename = `Anamnese_${anamnese.pacienteNome?.replace(/\s+/g, '_') || 'Paciente'}_${dataString}.pdf`;
  doc.save(filename);
};
