/**
 * lgpdPdfGenerator.js
 *
 * Gerador do PDF do Termo de Consentimento LGPD.
 * Visual idêntico ao Resumo de Atendimento (Step5Finalization):
 *   - Cabeçalho verde (#00a88e) com ícone de escudo e branding Procedi
 *   - Seções com labels em teal e corpo em cinza-escuro
 *   - Rodapé discreto com numeração de páginas
 */

/**
 * Gera e faz download do PDF do Termo LGPD com o visual do Resumo de Atendimento.
 *
 * @param {string} text       Texto completo do termo (já interpolado)
 * @param {string} [filename] Nome do arquivo baixado
 * @returns {Promise<Blob>}
 */
export async function gerarPdfLgpd(text, filename = 'termo-consentimento-lgpd.pdf') {
  /* ── Import lazy (code-splitting) ─────────────────────────────────────── */
  const mod   = await import('jspdf');
  const jsPDF = mod.jsPDF ?? mod.default;
  const domPurifyMod = await import('dompurify');
  const DOMPurify = domPurifyMod.default ?? domPurifyMod;

  const doc    = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pageW  = 210;
  const pageH  = 297;
  const M      = 14;          // margin
  const W      = pageW - M * 2; // content width

  /* ── Cores (valores RGB explícitos) ───────────────────────────────────── */
  const TEAL  = [0,   168, 142];
  const DARK  = [26,  35,  50 ];
  const GRAY  = [90,  103, 120];
  const LGRAY = [232, 236, 239];
  const BGTL  = [240, 253, 249];

  let y = M;

  /* ── Helpers ─────────────────────────────────────────────────────────── */
  function checkPage(needed = 10) {
    if (y + needed > pageH - M) {
      doc.addPage();
      // mini-cabeçalho nas páginas seguintes
      doc.setFillColor(TEAL[0], TEAL[1], TEAL[2]);
      doc.rect(0, 0, pageW, 10, 'F');
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(255, 255, 255);
      doc.text('Procedi - Termo de Consentimento LGPD (continuacao)', M, 7);
      y = 16;
    }
  }

  function hline() {
    checkPage(6);
    doc.setDrawColor(LGRAY[0], LGRAY[1], LGRAY[2]);
    doc.setLineWidth(0.3);
    doc.line(M, y, pageW - M, y);
    y += 5;
  }

  function label(txt) {
    checkPage(7);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(TEAL[0], TEAL[1], TEAL[2]);
    doc.text(txt.toUpperCase(), M, y);
    y += 5;
  }

  function body(txt) {
    if (!txt) return;
    checkPage(8);
    const lines = doc.splitTextToSize(txt, W);
    lines.forEach((ln) => { 
      checkPage(5); 
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(DARK[0], DARK[1], DARK[2]);
      doc.text(ln, M, y); 
      y += 4.5; 
    });
    y += 1;
  }

  function metaLine(txt) {
    if (!txt) return;
    checkPage(6);
    const lines = doc.splitTextToSize(txt, W);
    lines.forEach((ln) => { 
      checkPage(5); 
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
      doc.text(ln, M, y); 
      y += 4.2; 
    });
  }

  function listItem(txt) {
    if (!txt) return;
    checkPage(5);
    const full  = '- ' + txt;
    const lines = doc.splitTextToSize(full, W - 3);
    lines.forEach((ln, i) => {
      checkPage(5);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(DARK[0], DARK[1], DARK[2]);
      doc.text(ln, M + (i === 0 ? 0 : 3), y);
      y += 4.5;
    });
  }

  /* ── Cabeçalho principal ─────────────────────────────────────────────── */
  // Barra verde
  doc.setFillColor(TEAL[0], TEAL[1], TEAL[2]);
  doc.rect(0, 0, pageW, 22, 'F');

  // Quadrado branco para o ícone
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(M, 5, 12, 12, 2, 2, 'F');

  // ── Escudo verde dentro do quadrado branco ───────────────────────────
  // cx=M+6=20, cy=11  —  desenho em 3 partes: topo arredondado + ponta
  const cx = M + 6;
  const cy = 11;

  // Parte superior arredondada do escudo
  doc.setFillColor(TEAL[0], TEAL[1], TEAL[2]);
  doc.roundedRect(cx - 3.8, cy - 4.8, 7.6, 6.5, 1.0, 1.0, 'F');

  // Ponta inferior (triângulo via poly-line fechada)
  const ptTop  = cy - 4.8 + 6.5;   // = cy + 1.7
  const ptBot  = cy + 4.5;
  const ptHalf = 3.8;
  doc.setFillColor(TEAL[0], TEAL[1], TEAL[2]);
  doc.lines(
    [
      [ptHalf * 2,  0             ],
      [-ptHalf,     ptBot - ptTop ],
      [-ptHalf,    -(ptBot - ptTop)],
    ],
    cx - ptHalf,
    ptTop,
    [1, 1],
    'F',
    true,
  );

  // Check-mark branco
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.65);
  doc.lines(
    [[ 1.0,  1.1], [ 2.1, -2.2]],
    cx - 1.6,
    cy - 0.4,
    [1, 1],
    'S',
  );

  // Textos brancos do cabeçalho
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('Procedi', M + 15, 11);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Sistema de Gestao Clinica', M + 15, 16);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Termo de Consentimento LGPD', pageW - M, 11, { align: 'right' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Gerado em ${new Date().toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })}`,
    pageW - M,
    16,
    { align: 'right' },
  );

  y = 30;

  /* ── Parse do texto por seções ───────────────────────────────────────── */
  // Strip HTML caso o texto venha do editor rico
  let tempDiv = document.createElement("div");
  tempDiv.innerHTML = DOMPurify.sanitize(text || '');
  const cleanText = tempDiv.innerText || tempDiv.textContent || '';
  
  const rawLines = cleanText.split('\n');
  let buf       = [];
  let firstLine = true;
  let inSection = false;

  function flushBuf() {
    const s = buf.join(' ').trim();
    if (s) body(s);
    buf = [];
  }

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i].trim();

    /* Primeira linha = título do documento (já está no header, pulamos) */
    if (firstLine) {
      firstLine = false;
      // ignora — o título já está na barra teal
      continue;
    }

    /* Linha em branco */
    if (!line) { flushBuf(); if (inSection) y += 1; continue; }

    /* Seção numerada: "1. Dos Dados Coletados" */
    const sec = line.match(/^(\d+)\.\s+(.+)/);
    if (sec) {
      flushBuf();
      if (i > 1) hline();
      label(`${sec[1]}. ${sec[2]}`);
      inSection = true;
      continue;
    }

    /* Metadados do cabeçalho (Clinica Controladora, CNPJ, Sistema, Profissional) */
    if (/^(Cl.nica Controladora|CNPJ|Sistema Operador|Profissional Respons)/i.test(line)) {
      flushBuf();
      metaLine(line);
      continue;
    }

    /* Frase de aceite final */
    if (/^Por estar de acordo/i.test(line)) {
      flushBuf();
      if (inSection) hline();
      checkPage(12);
      doc.setFillColor(BGTL[0], BGTL[1], BGTL[2]);
      doc.setDrawColor(LGRAY[0], LGRAY[1], LGRAY[2]);
      doc.roundedRect(M, y, W, 10, 2, 2, 'FD');
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(TEAL[0], TEAL[1], TEAL[2]);
      doc.text(line, M + W / 2, y + 6.5, { align: 'center' });
      y += 15;
      continue;
    }

    /* Item de lista */
    if (line.startsWith('- ')) {
      flushBuf();
      listItem(line.slice(2));
      continue;
    }

    /* Corpo normal */
    buf.push(line);
  }

  flushBuf();

  /* ── Rodapé em todas as páginas ──────────────────────────────────────── */
  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFillColor(248, 251, 251);
    doc.rect(0, pageH - 12, pageW, 12, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
    doc.text(
      'Documento gerado pelo sistema Procedi - Validade juridica LGPD (Lei 13.709/2018)',
      M,
      pageH - 5,
    );
    doc.text(`Pagina ${p} de ${totalPages}`, pageW - M, pageH - 5, { align: 'right' });
  }

  /* ── Download ────────────────────────────────────────────────────────── */
  const blob = doc.output('blob');
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);

  return blob;
}
